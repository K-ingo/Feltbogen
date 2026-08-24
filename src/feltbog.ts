import type { Billede, BudgetLinje, Gruppe, Item, Sted, Tur } from './db';
import { etiket } from './db';
import type { VejrDag } from './smartMotor';
import { formatterPeriode } from './datotekst';
import { efterDag } from './feltnoter';
import { billederPaaTur, hero } from './billeder';
import type { Dag } from './feltnoter';
import {
  aarsoverskrift,
  aarstalFor,
  tureIAaret,
  vejrPaaTuren
} from './aarsopgoerelse';
import type { Aarstal } from './aarsopgoerelse';

// Årets feltbog, sat op til at blive trykt.
//
// Det er det samme år som årsopgørelsen, men læst den anden vej: opgørelsen
// er tallene, bogen er turene. Én side pr. tur med alt hvad der står skrevet
// om den — periode, sted, selskab, vejr, pakkeliste, budget og feltnoter.
//
// Sammenstillingen ligger her og ikke i skærmen, fordi det er den del der kan
// blive forkert. En printet side kan ikke rettes bagefter.

export interface Pakkedel {
  // Gruppens navn, eller "Løst grej" for det der blev valgt enkeltvis.
  navn: string;
  items: Item[];
  vaegt_g: number;
}

export interface Budget {
  linjer: BudgetLinje[];
  forventet: number;
  faktisk: number;
}

export interface Turside {
  tur: Tur;
  // "10.–12. juli" — året står på forsiden og gentages ikke pr. side.
  periode: string;
  sted: string;
  // Turens kendetegn skrevet ud, klar til at sættes som en liste.
  fakta: { navn: string; vaerdi: string }[];
  deltagere: string[];
  vejr: VejrDag[];
  pakkeliste: Pakkedel[];
  vaegt_g: number;
  budget: Budget | null;
  // Forsidebilledet først, resten kronologisk. Billeder uden både blob og
  // url udelades: de kan ikke tegnes, og en tom firkant på papiret er værre
  // end ingen firkant.
  billeder: Billede[];
  // Feltnoterne i den rækkefølge de blev skrevet. `efterDag` sorterer
  // nyeste først til skærmen; en dagbog læses forfra.
  dage: Dag[];
}

export interface Feltbog {
  aar: number;
  tal: Aarstal;
  overskrift: string;
  sider: Turside[];
}

export function bygFeltbog(
  aar: number,
  ture: Tur[],
  items: Item[],
  grupper: Gruppe[],
  steder: Sted[],
  billeder: Billede[] = []
): Feltbog {
  const tal = aarstalFor(ture, items, aar);

  return {
    aar,
    tal,
    overskrift: aarsoverskrift(tal),
    sider: tureIAaret(ture, aar).map((tur) => turside(tur, items, grupper, steder, billeder))
  };
}

export function turside(
  tur: Tur,
  items: Item[],
  grupper: Gruppe[],
  steder: Sted[],
  billeder: Billede[] = []
): Turside {
  const pakkeliste = pakkedele(tur, items, grupper);

  return {
    tur,
    periode: formatterPeriode(tur.startdato, tur.slutdato),
    sted: stednavn(tur, steder),
    fakta: fakta(tur),
    deltagere: (tur.deltagere ?? []).map((d) => d.navn.trim()).filter(Boolean),
    vejr: vejrPaaTuren(tur),
    pakkeliste,
    vaegt_g: pakkeliste.reduce((s, d) => s + d.vaegt_g, 0),
    budget: budget(tur.budget_linjer ?? []),
    billeder: tilTryk(tur, billeder),
    dage: [...efterDag(tur.feltnoter ?? [])].reverse()
  };
}

// Det gemte steds navn når turen er koblet til kartoteket, ellers friteksten.
function stednavn(tur: Tur, steder: Sted[]): string {
  const gemt = tur.sted_uid ? steder.find((s) => s.uid === tur.sted_uid) : undefined;
  return gemt?.navn ?? tur.sted.trim();
}

// Kun det der er sat. En trykt side med "0 km" og "bæreafstand: —" er værre
// end en kortere side.
function fakta(tur: Tur): { navn: string; vaerdi: string }[] {
  const raekker: { navn: string; vaerdi: string }[] = [
    { navn: 'Overnatning', vaerdi: etiket(tur.overnatning) },
    { navn: 'Terræn', vaerdi: etiket(tur.terraen) },
    { navn: 'Aktivitet', vaerdi: etiket(tur.aktivitet) },
    { navn: 'Nætter', vaerdi: String(tur.naetter) }
  ];

  if (tur.personer > 0) {
    raekker.push({ navn: 'Personer', vaerdi: String(tur.personer) });
  }
  if (tur.baereafstand_km > 0) {
    raekker.push({ navn: 'Bæreafstand', vaerdi: `${tur.baereafstand_km} km` });
  }
  return raekker;
}

// Pakkelisten delt op som den blev valgt: grupperne for sig, det løse for sig.
//
// Et stykke gear står ét sted. Ligger det både i en valgt gruppe og som løst
// valg, hører det til gruppen — det var derfor det kom med.
function pakkedele(tur: Tur, items: Item[], grupper: Gruppe[]): Pakkedel[] {
  const kendte = new Map(items.map((i) => [i.uid, i]));
  const brugt = new Set<string>();
  const dele: Pakkedel[] = [];

  const saml = (navn: string, uids: string[]) => {
    const valgte: Item[] = [];
    for (const uid of uids) {
      if (brugt.has(uid)) continue;
      const item = kendte.get(uid);
      // Gear der er slettet siden turen, kan ikke trykkes.
      if (!item) continue;
      brugt.add(uid);
      valgte.push(item);
    }
    if (valgte.length === 0) return;

    dele.push({
      navn,
      items: [...valgte].sort((a, b) => a.navn.localeCompare(b.navn, 'da')),
      vaegt_g: valgte.reduce((s, i) => s + i.vaegt_g * i.antal, 0)
    });
  };

  for (const gruppeUid of tur.gruppe_ids ?? []) {
    const gruppe = grupper.find((g) => g.uid === gruppeUid);
    if (gruppe) saml(gruppe.navn.trim() || 'Gruppe uden navn', gruppe.item_ids);
  }
  saml('Løst grej', tur.loese_item_ids ?? []);

  return dele;
}

// Forsidebilledet først. Resten står i den rækkefølge de blev taget.
function tilTryk(tur: Tur, billeder: Billede[]): Billede[] {
  const paaTuren = billederPaaTur(billeder, tur.uid).filter((b) => b.blob || b.url);
  const forside = hero(paaTuren, tur);
  if (!forside) return [];

  return [forside, ...paaTuren.filter((b) => b !== forside)];
}

function budget(linjer: BudgetLinje[]): Budget | null {
  if (linjer.length === 0) return null;

  return {
    linjer,
    forventet: linjer.reduce((s, l) => s + l.forventet_kr, 0),
    faktisk: linjer.reduce((s, l) => s + l.faktisk_kr, 0)
  };
}

// Vejrkoden som et ord. Skærmen bruger et ikon, men et emoji på tryk bliver
// enten en sort firkant eller ingenting — og en feltbog læses uden legende.
// Grænserne er de samme som `vejrIkonKode`, så de to aldrig er uenige.
export function vejrord(kode: number): string {
  if (kode === 0) return 'sol';
  if (kode <= 3) return 'let skyet';
  if (kode <= 48) return 'skyet';
  if (kode <= 67) return 'regn';
  if (kode <= 77) return 'sne';
  if (kode <= 82) return 'byger';
  if (kode <= 99) return 'torden';
  return 'skyet';
}

// Temperaturspændet skrevet ud.
//
// "-11–-3°" er ikke til at læse: tankestregen og minusset løber sammen. Er
// den ene ende under nul, skrives spændet derfor med ord i stedet.
export function temperaturspand(min: number, max: number): string {
  const lav = Math.round(min);
  const hoej = Math.round(max);

  if (lav === hoej) return `${lav}°`;
  return lav < 0 || hoej < 0 ? `${lav}° til ${hoej}°` : `${lav}–${hoej}°`;
}

// Filnavnet browserens print-dialog foreslår, når man gemmer som PDF.
export function filnavn(aar: number): string {
  return `Feltbogen ${aar}`;
}
