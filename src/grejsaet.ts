import type { Gruppe, Item, Reference, Tur } from './db';
import { itemUidsPaaTur } from './smartMotor';
import { gram, kilo } from './talformat';
import { faseAf, FASENAVN } from './turfase';

// ─────────────────────────────────────────────
// Grejsæt
//
// Et grejsæt er en gemt pakning: det grej, man alligevel altid tager med på
// den slags tur. Skærmen `GrupperListe.tsx` viser dem, men regnestykkerne
// står her, så de kan efterprøves uden en browser — jf. AGENTS.md.
//
// Det, der skal kunne besvares:
//   · hvad vejer sættet, og hvor mange ting er der i det
//   · hvornår var det sidst med på en tur
//   · hvad sker der, hvis jeg lægger det på *den her* tur
//
// Det sidste er det vigtigste. "Brug på tur" må ikke være en stille
// overskrivning: man skal kunne se, hvad der bliver lagt til, før man siger ja.
// ─────────────────────────────────────────────

export interface Saetindhold {
  // Grejet i sættet, som det ser ud i inventaret nu. Uid'er, der peger på
  // noget slettet, tælles ikke med — så ville antallet sige mere, end der er.
  items: Item[];
  antal: number;
  vaegt_g: number;
}

export function saetindhold(gruppe: Gruppe, items: Item[]): Saetindhold {
  const iSaettet = new Set(gruppe.item_ids);
  const valgte = items.filter((i) => iSaettet.has(i.uid));

  return {
    items: valgte,
    antal: valgte.length,
    // Vægten pr. stykke grej og ikke gange antal. Et sæt siger *hvilket* grej
    // der skal med, ikke hvor mange af hver — samme regel som på turen selv.
    vaegt_g: valgte.reduce((sum, i) => sum + i.vaegt_g, 0)
  };
}

// "890 g" under kiloet, "1,2 kg" over. Gram er det, der står på et stykke
// grej; kilo er det, man bærer. Skiftet ligger, hvor tallet ellers bliver
// uhandterligt langt.
export function vaegttekst(vaegt_g: number): string {
  return vaegt_g < 1000 ? `${gram(vaegt_g)} g` : `${kilo(vaegt_g, 1)} kg`;
}

// Delt grej bæres af én og bruges af alle; personligt grej har man selv med.
// Ordene er dem, referencen skriver på hver række i sættet.
export function delingstekst(item: Item): string {
  return item.delt ? 'fælles' : 'personligt';
}

// Den seneste tur, hvert sæt har været på. Samme regel som `sidstBrugtPrItem`
// i statistik.ts: turen med den nyeste startdato, uanset hvilken fase den er
// i. To steder i appen må ikke svare forskelligt på "hvornår var det med
// sidst".
export function sidstBrugtPrSaet(ture: Tur[]): Map<Reference, Tur> {
  const sidst = new Map<Reference, Tur>();

  ture.forEach((tur) => {
    if (!tur.startdato) return;
    tur.gruppe_ids.forEach((uid) => {
      const kendt = sidst.get(uid);
      if (!kendt || tur.startdato > kendt.startdato) sidst.set(uid, tur);
    });
  });

  return sidst;
}

export function turnavn(tur: Tur): string {
  return tur.navn.trim() || 'Uden navn';
}

// "brugt på Fovslet Skov" eller "aldrig brugt på tur". Et sæt, der aldrig har
// været med, er værd at få at vide: enten er det ikke færdigt, eller også er
// det ikke det, man rækker ud efter.
export function brugttekst(tur: Tur | undefined): string {
  return tur ? `brugt på ${turnavn(tur)}` : 'aldrig brugt på tur';
}

// Linjen under navnet i sætlisten: "8 ting · 6,2 kg · brugt på Fovslet Skov".
export function saetlinje(indhold: Saetindhold, sidsteTur: Tur | undefined): string {
  return [
    `${indhold.antal} ting`,
    `${kilo(indhold.vaegt_g, 1)} kg`,
    brugttekst(sidsteTur)
  ].join(' · ');
}

export interface Indlaesning {
  // Ting i sættet, der stadig findes i inventaret.
  iSaettet: number;
  // Dem, turen ikke har i forvejen.
  nye: number;
  // Dem, turen har i forvejen — via et andet sæt eller som løst grej.
  dubletter: number;
  foer: number;
  efter: number;
  // Sat, når selve sættet allerede er lagt på turen. Så er der ingenting at
  // gøre, og knappen skal sige det frem for at lade som om.
  alleredePaaTuren: boolean;
}

// Hvad der sker, hvis sættet lægges på turen.
//
// Grej ligger på turen som uid'er, og et uid kan kun stå der én gang. Et
// stykke grej, turen har i forvejen, bliver derfor ikke lagt til to gange —
// dubletter merges af sig selv. Det, der mangler, er at kunne *se* det på
// forhånd, og det er hele pointen med det her regnestykke.
export function indlaesning(tur: Tur, gruppe: Gruppe, grupper: Gruppe[], items: Item[]): Indlaesning {
  const kendte = new Set(items.map((i) => i.uid));
  const saet = [...new Set(gruppe.item_ids)].filter((uid) => kendte.has(uid));
  const foer = [...itemUidsPaaTur(tur, grupper)].filter((uid) => kendte.has(uid));
  const paaTuren = new Set(foer);
  const nye = saet.filter((uid) => !paaTuren.has(uid));

  return {
    iSaettet: saet.length,
    nye: nye.length,
    dubletter: saet.length - nye.length,
    foer: paaTuren.size,
    efter: paaTuren.size + nye.length,
    alleredePaaTuren: tur.gruppe_ids.includes(gruppe.uid)
  };
}

// Overblikket, man får at se, før man bekræfter. Én sætning — står der mere,
// bliver det noget, man klikker forbi.
export function indlaesningstekst(i: Indlaesning): string {
  if (i.alleredePaaTuren) return 'Sættet ligger allerede på turen. Der er ikke noget at lægge til.';
  if (i.iSaettet === 0) return 'Sættet er tomt. Læg grej i det under Rediger først.';
  if (i.dubletter === 0) return `Turen går fra ${i.foer} til ${i.efter} ting.`;
  if (i.nye === 0) {
    return `Alle ${i.iSaettet} ting er allerede på turen — de lægges ikke til to gange. Turen bliver på ${i.efter} ting, og sættet står som brugt på den.`;
  }

  return `${i.dubletter} af sættets ting er allerede på turen og lægges ikke til to gange. Turen går fra ${i.foer} til ${i.efter} ting.`;
}

// Turens nye `gruppe_ids`. Står sættet der allerede, bliver listen som den er
// — et sæt to gange på samme tur er det samme grej talt to gange.
export function medSaet(tur: Tur, gruppe: Gruppe): Reference[] {
  return tur.gruppe_ids.includes(gruppe.uid) ? tur.gruppe_ids : [...tur.gruppe_ids, gruppe.uid];
}

// Grejet på en tur, som `item_ids` til et nyt sæt. Det er dét, "Opret fra
// tur" gemmer: pakningen, man allerede har lavet én gang.
export function saetFraTur(tur: Tur, grupper: Gruppe[], items: Item[]): Reference[] {
  const kendte = new Set(items.map((i) => i.uid));
  return [...itemUidsPaaTur(tur, grupper)].filter((uid) => kendte.has(uid));
}

// Turene i den rækkefølge, man skal kigge dem igennem: de igangværende og
// planlagte først, de afsluttede sidst, og inden for hver gruppe den nyeste
// øverst. Man lægger grej på den tur, man er på vej på.
export function tureTilValg(ture: Tur[]): Tur[] {
  return [...ture].sort((a, b) => {
    const afsluttet = (t: Tur) => (t.status === 'afsluttet' ? 1 : 0);
    if (afsluttet(a) !== afsluttet(b)) return afsluttet(a) - afsluttet(b);
    return (b.startdato || '').localeCompare(a.startdato || '');
  });
}

// "Fovslet Skov · Klar" — turens navn og den fase, man ville kalde den.
// Ordene kommer fra `turfase.ts` og skrives ikke af igen her: hedder en fase
// noget andet i morgen, skal den hedde det samme begge steder.
export function turlinje(tur: Tur): string {
  return `${turnavn(tur)} · ${FASENAVN[faseAf(tur)]}`;
}
