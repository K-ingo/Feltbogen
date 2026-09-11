import type { Item, Tur, Gruppe, Reference } from './db';
import { itemsPaaTur } from './smartMotor';
import { brugPrItem } from './pakAfTjek';
import { vurderingAf } from './vurdering';

// ─────────────────────────────────────────────
// Læringssløjfen
//
// Appen har samlet på svar i to år: hvad der var med på turen, hvad der blev
// brugt, hvad der gik i stykker, og hvad man selv syntes om det. Tallene stod
// hver for sig — på gearet, på turen, i årsopgørelsen. Her lægges de sammen
// til det, man faktisk lærer af: *hvad slæber jeg rundt på uden at bruge det,
// og hvad holder ikke?*
//
// To regler går igen gennem hele modulet, og de er de samme, som resten af
// appen følger:
//
// **En tur uden pak-af-tjek ved ingenting.** Den tælles hverken som brugt
// eller ubrugt. Talte man den som ubrugt, ville alt gear se ud som hyldevarer,
// så snart man holdt op med at gøre turene op.
//
// **`null` er ikke en dårlig karakter.** De fleste ting bliver aldrig vurderet,
// og de tælles hverken med i et gennemsnit eller imod noget.
// ─────────────────────────────────────────────

// Hvor mange gange noget skal være set, før det er et mønster og ikke et
// tilfælde. Tærsklen er sat efter mavefornemmelse som resten af appens — den
// er nem at justere, men kun meningsfuldt, når den har været brugt på rigtige
// data over en sæson.
export const MINDST_FOR_ET_MOENSTER = 3;

// Hvor mange ting en top-liste viser. Fem er nok til at genkende sig selv i
// den, og kort nok til at kunne læses uden at folde ud.
export const TOPLISTE = 5;

// ─────────────────────────────────────────────
// Turene talt op
// ─────────────────────────────────────────────

export interface Turtal {
  ture: number;
  naetter: number;
  // To nætter er tre dage — samme regnestykke som årsopgørelsen bruger.
  dage: number;
  // Nætter pr. tur, én decimal. null når der ingen ture er: et snit af
  // ingenting er ikke nul, det er ikke noget.
  snit_naetter: number | null;
  // Ture man tog afsted på uden at overnatte.
  dagsture: number;
  // Ture der er gjort op. Det er dem, alt herunder bygger på.
  gjort_op: number;
}

export function turtal(ture: Tur[]): Turtal {
  const naetter = ture.reduce((s, t) => s + t.naetter, 0);

  return {
    ture: ture.length,
    naetter,
    dage: ture.reduce((s, t) => s + t.naetter + 1, 0),
    snit_naetter: ture.length === 0 ? null : Math.round((naetter / ture.length) * 10) / 10,
    dagsture: ture.filter((t) => t.naetter === 0).length,
    gjort_op: ture.filter((t) => t.pak_af_tjek !== null && t.pak_af_tjek !== undefined).length
  };
}

// ─────────────────────────────────────────────
// Vægten, tur for tur
// ─────────────────────────────────────────────

export interface Vaegttal {
  snit_g: number;
  letteste: { tur: Tur; vaegt_g: number };
  tungeste: { tur: Tur; vaegt_g: number };
  // Hvor mange ture der ligger bag tallet. En tur uden valgt grej tælles ikke
  // med som nul — den siger ingenting om, hvad man plejer at bære.
  antal: number;
}

export function gennemsnitsvaegt(ture: Tur[], grupper: Gruppe[], items: Item[]): Vaegttal | null {
  const vejede = ture
    .map((tur) => ({
      tur,
      vaegt_g: itemsPaaTur(tur, grupper, items).reduce((s, i) => s + i.vaegt_g, 0)
    }))
    .filter((v) => v.vaegt_g > 0);

  if (vejede.length === 0) return null;

  const sum = vejede.reduce((s, v) => s + v.vaegt_g, 0);
  const sorteret = [...vejede].sort((a, b) => a.vaegt_g - b.vaegt_g);

  return {
    snit_g: Math.round(sum / vejede.length),
    letteste: sorteret[0],
    tungeste: sorteret[sorteret.length - 1],
    antal: vejede.length
  };
}

// ─────────────────────────────────────────────
// Stjernerne
//
// Det eneste, appen ved, som ikke er et tal eller en dato: om man var glad for
// det. En sovepose kan være brugt hver eneste nat og stadig være noget, man
// frøs i.
// ─────────────────────────────────────────────

export interface Stjernegrej {
  item: Item;
  vurdering: number;
}

function vurderet(items: Item[]): Stjernegrej[] {
  return items
    .filter((i) => i.status === 'ejer')
    .map((item) => ({ item, vurdering: vurderingAf(item) }))
    .filter((s): s is Stjernegrej => s.vurdering !== null);
}

// Sorteres efter stjerner, og derefter efter navn — så rækkefølgen er den
// samme hver gang, også når to ting har fået lige mange.
export function bedsteGrej(items: Item[], antal: number = TOPLISTE): Stjernegrej[] {
  return vurderet(items)
    .sort((a, b) => (b.vurdering - a.vurdering) || a.item.navn.localeCompare(b.item.navn, 'da'))
    .slice(0, antal);
}

export function daarligsteGrej(items: Item[], antal: number = TOPLISTE): Stjernegrej[] {
  return vurderet(items)
    .sort((a, b) => (a.vurdering - b.vurdering) || a.item.navn.localeCompare(b.item.navn, 'da'))
    .slice(0, antal);
}

// Hvor mange af ens ting der overhovedet er vurderet. Uden det tal ser en
// top-fem ud, som om den bygger på hele skabet.
export function andelVurderet(items: Item[]): { vurderet: number; i_alt: number } {
  const egne = items.filter((i) => i.status === 'ejer');
  return { vurderet: vurderet(egne).length, i_alt: egne.length };
}

// ─────────────────────────────────────────────
// Hyldevarerne
//
// Det skarpeste, appen kan sige. `ubrugteItems` i statistik.ts finder det, der
// aldrig kommer *med* — det her finder det, der kommer med hver gang og bliver
// liggende i tasken. Det er en anden og dyrere fejl: den koster vægt på ryggen
// hver eneste tur.
// ─────────────────────────────────────────────

export interface Hyldevare {
  item: Item;
  // Ture hvor tingen stod på et udfyldt pak-af-tjek.
  med: number;
  brugt: number;
  vaegt_g: number;
}

export function hyldevarer(
  items: Item[],
  ture: Tur[],
  mindst: number = MINDST_FOR_ET_MOENSTER
): Hyldevare[] {
  const brug = brugPrItem(ture);

  return items
    .filter((i) => i.status === 'ejer')
    .map((item) => ({ item, b: brug.get(item.uid) }))
    .filter((x): x is { item: Item; b: NonNullable<typeof x.b> } => x.b !== undefined)
    // Aldrig brugt, og set nok gange til at det ikke er et tilfælde. "Brugt 0
    // af 1 gange" er ikke en hyldevare, det er én tur.
    .filter(({ b }) => b.gjort_op >= mindst && b.brugt === 0)
    .map(({ item, b }) => ({
      item,
      med: b.gjort_op,
      brugt: b.brugt,
      vaegt_g: item.vaegt_g * item.antal
    }))
    // Tungest først: det er dér, der er mest at hente ved at lade den blive
    // hjemme.
    .sort((a, b) => (b.vaegt_g - a.vaegt_g) || (b.med - a.med));
}

// Hvad man ville spare ved at lade dem alle blive hjemme.
export function hyldevarevaegt(varer: Hyldevare[]): number {
  return varer.reduce((s, v) => s + v.vaegt_g, 0);
}

// ─────────────────────────────────────────────
// Det der ikke holder
// ─────────────────────────────────────────────

export interface Skroebeligt {
  item: Item;
  gange: number;
  med: number;
}

// Grej der er gået i stykker mere end én gang. Én gang er uheld; to er en
// egenskab ved tingen.
export function skroebeligtGrej(items: Item[], ture: Tur[], mindst: number = 2): Skroebeligt[] {
  const brug = brugPrItem(ture);

  return items
    .map((item) => ({ item, b: brug.get(item.uid) }))
    .filter((x) => x.b !== undefined && x.b.i_stykker >= mindst)
    .map(({ item, b }) => ({ item, gange: b!.i_stykker, med: b!.gjort_op }))
    .sort((a, b) => b.gange - a.gange);
}

// ─────────────────────────────────────────────
// Hvad man kan sige, og hvad man ikke kan
//
// Tallene herover er kun værd at vise, når der er noget bag dem. Uden det
// ville en ny bruger møde en side, der påstår at kende hendes vaner efter én
// tur — og det er en dårligere start end en side, der siger fra.
// ─────────────────────────────────────────────

export interface Grundlag {
  // Ture der er gjort op. Det er dem, alt om brug bygger på.
  gjort_op: number;
  // Nok til at sige noget om mønstre?
  nok: boolean;
  // Hvad der mangler, skrevet ud.
  mangler: string;
}

export function grundlag(ture: Tur[], mindst: number = MINDST_FOR_ET_MOENSTER): Grundlag {
  const gjort_op = turtal(ture).gjort_op;
  if (gjort_op >= mindst) return { gjort_op, nok: true, mangler: '' };

  const tilbage = mindst - gjort_op;

  return {
    gjort_op,
    nok: false,
    mangler: gjort_op === 0
      ? 'Der er ingen ture gjort op endnu. Pak-af-tjekket er det, appen lærer af.'
      : `${tilbage} ${tilbage === 1 ? 'tur mere' : 'ture mere'} gjort op, så kan der siges noget om mønstre.`
  };
}

// Alt gearet på en tur, som et opslag. Bruges af skærmen til at vise, hvad et
// enkelt tal bygger på, uden at regne det ud igen.
export function itemUidsGjortOp(ture: Tur[]): Set<Reference> {
  const set = new Set<Reference>();
  ture.forEach((t) => t.pak_af_tjek?.linjer.forEach((l) => set.add(l.item_uid)));
  return set;
}
