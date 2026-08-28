import type { Deltager, Item, Reference, Tur } from './db';

// Hvem bærer hvad.
//
// Det fælles grej er turens tungeste enkeltdele — teltet, kogegrejet, tarpen —
// og de skal bæres af én. Fordelingen laves i dag i hånden, ét stykke ad
// gangen, og resultatet bliver som regel, at den der pakkede først, slæber
// mest.
//
// Motoren regner et forslag ud og skriver ingenting. Det er det samme mønster
// som vægtbytterne: en ren funktion, der siger hvad den ville gøre og hvad det
// ville betyde, og en `anvend`, som skærmen kalder, hvis nogen siger ja.
//
// To ting holder den fast på:
//
// Kun det fælles grej flyttes. En sovepose er personlig — motoren ved ikke,
// hvis den er, og et forslag om at give sin sovepose til en anden er ikke et
// forslag, det er en fejl. Det personlige grej tæller med i, hvad man bærer,
// men det bliver, hvor det er.
//
// Og fordelingen skal være mærkbart bedre, ellers foreslås den ikke. Uden den
// regel ville motoren bytte rundt på alting for at flytte halvtreds gram — og
// et forslag, der ikke er værd at følge, gør de andre forslag mindre værd.

export interface Fordelingslinje {
  // Deltagerens id på turen.
  id: string;
  navn: string;
  foer_g: number;
  efter_g: number;
}

export interface Flytning {
  item: Item;
  // Deltager-id'et grejet ligger hos nu. Null når ingen har taget det endnu.
  fra: string | null;
  til: string;
}

export interface Fordelingsforslag {
  linjer: Fordelingslinje[];
  flytninger: Flytning[];
  // Forskellen mellem den tungeste og den letteste rygsæk. Det er tallet,
  // fordelingen handler om: en gennemsnitsvægt kan være fin, mens én slæber
  // det hele.
  spredning_foer_g: number;
  spredning_efter_g: number;
  // Fælles grej som ingen havde taget endnu. Det tæller ikke med i
  // spredningen før — ingen bar det — og derfor kan spredningen godt stige,
  // når det bliver fordelt. Det er ikke en forværring: vægten var der hele
  // tiden, den stod bare ikke på nogens ryg.
  ufordelt_g: number;
  ufordelt_antal: number;
  begrundelse: string;
}

// Under det her er der ikke noget at komme efter. Et par hundrede gram
// forskel mellem to rygsække mærkes ikke, og et forslag om at bytte rundt for
// at flytte dem ville gøre alle de andre forslag mindre værd.
export const MINDSTE_GEVINST_G = 200;

export function foreslaaFordeling(tur: Tur, pakItems: Item[]): Fordelingsforslag | null {
  // Med én deltager er der ingenting at fordele — hun bærer det hele
  // uanset hvad.
  if (tur.deltagere.length < 2) return null;

  const delte = pakItems.filter((i) => i.delt);
  if (delte.length === 0) return null;

  const vaegte = new Map(pakItems.map((i) => [i.uid, i.vaegt_g]));
  const vaegt = (uid: Reference) => vaegte.get(uid) ?? 0;

  // Det, der ligger fast: hver deltagers personlige grej.
  const grundvaegt = new Map(
    tur.deltagere.map((d) => [d.id, d.personligt_gear_ids.reduce((s, uid) => s + vaegt(uid), 0)])
  );

  const baererNu = new Map<Reference, string>();
  tur.deltagere.forEach((d) => d.baerer_delt_ids.forEach((uid) => baererNu.set(uid, d.id)));

  const foer = new Map(grundvaegt);
  for (const item of delte) {
    const b = baererNu.get(item.uid);
    if (b !== undefined && foer.has(b)) foer.set(b, foer.get(b)! + item.vaegt_g);
  }

  // Tungest først, så de store klodser placeres, mens der stadig er plads at
  // vælge imellem. Uid'et som andet kriterium, så to lige tunge ting altid
  // lander samme sted — et forslag, der skifter mellem to visninger, er ikke
  // til at tage stilling til.
  const iRaekkefoelge = [...delte].sort(
    (a, b) => b.vaegt_g - a.vaegt_g || a.uid.localeCompare(b.uid)
  );

  const efter = new Map(grundvaegt);
  const tildelt = new Map<Reference, string>();

  for (const item of iRaekkefoelge) {
    let valgt = tur.deltagere[0].id;
    let mindst = Infinity;

    for (const d of tur.deltagere) {
      const v = efter.get(d.id) ?? 0;
      // Står to lige, beholder den, der bærer det i forvejen, sit grej.
      // Ellers ville motoren bytte rundt for ingenting.
      const bedre = v < mindst || (v === mindst && baererNu.get(item.uid) === d.id);
      if (bedre) {
        mindst = v;
        valgt = d.id;
      }
    }

    efter.set(valgt, mindst + item.vaegt_g);
    tildelt.set(item.uid, valgt);
  }

  const linjer: Fordelingslinje[] = tur.deltagere.map((d) => ({
    id: d.id,
    navn: d.navn || 'Uden navn',
    foer_g: foer.get(d.id) ?? 0,
    efter_g: efter.get(d.id) ?? 0
  }));

  const spredningFoer = spredning(linjer.map((l) => l.foer_g));
  const spredningEfter = spredning(linjer.map((l) => l.efter_g));

  const ufordelt = delte.filter((i) => !baererNu.has(i.uid));
  const ufordeltG = ufordelt.reduce((s, i) => s + i.vaegt_g, 0);

  // To grunde til at sige noget: der ligger fælles grej, ingen har taget, eller
  // fordelingen er skæv nok til at det kan mærkes. Den første er den vigtigste
  // — grej uden en bærer er noget, der bliver glemt.
  const gevinst = spredningFoer - spredningEfter;
  if (ufordelt.length === 0 && gevinst < MINDSTE_GEVINST_G) return null;

  const flytninger: Flytning[] = iRaekkefoelge
    .filter((item) => tildelt.get(item.uid) !== baererNu.get(item.uid))
    .map((item) => ({
      item,
      fra: baererNu.get(item.uid) ?? null,
      til: tildelt.get(item.uid)!
    }));

  // Kan der ikke peges på en eneste ting at flytte, er der heller ikke noget
  // at sige ja til. Det bør ikke kunne ske, når spredningen er faldet, men
  // et forslag uden en handling er værre end intet forslag.
  if (flytninger.length === 0) return null;

  return {
    linjer,
    flytninger,
    spredning_foer_g: spredningFoer,
    spredning_efter_g: spredningEfter,
    ufordelt_g: ufordeltG,
    ufordelt_antal: ufordelt.length,
    begrundelse: begrundelse(linjer, ufordelt.length, ufordeltG, spredningFoer, spredningEfter)
  };
}

const kg = (g: number) => `${(g / 1000).toFixed(1)} kg`;

// Hvorfor motoren siger det, den siger. Teksten skrives her, hvor reglen står,
// så forklaringen og reglen bliver ved med at være det samme sted.
function begrundelse(
  linjer: Fordelingslinje[],
  ufordeltAntal: number,
  ufordeltG: number,
  foer: number,
  efter: number
): string {
  const fast = 'Det fælles grej fordeles tungest først til den, der bærer mindst. '
    + 'Kun fælles grej flyttes — det personlige bliver, hvor det er.';

  if (ufordeltAntal > 0) {
    return `${ufordeltAntal} ${ufordeltAntal === 1 ? 'stykke' : 'stykker'} fælles grej på `
      + `${kg(ufordeltG)} har ingen bærer endnu. ${fast}`;
  }

  const tungest = linjer.reduce((a, b) => (b.foer_g > a.foer_g ? b : a));
  const lettest = linjer.reduce((a, b) => (b.foer_g < a.foer_g ? b : a));

  return `${tungest.navn} bærer ${kg(tungest.foer_g)} mod ${lettest.navn}s ${kg(lettest.foer_g)}. `
    + `${fast} Så falder forskellen fra ${kg(foer)} til ${kg(efter)}.`;
}

// Forskellen mellem den tungeste og den letteste rygsæk.
export function spredning(vaegte: number[]): number {
  return vaegte.length === 0 ? 0 : Math.max(...vaegte) - Math.min(...vaegte);
}

// Ændringen, skærmen skal skrive, hvis nogen siger ja. Formen er den samme som
// vægtbytternes: motoren rører ikke basen.
export function anvendFordeling(tur: Tur, forslag: Fordelingsforslag): Partial<Tur> {
  const til = new Map(forslag.flytninger.map((f) => [f.item.uid, f.til]));

  const deltagere: Deltager[] = tur.deltagere.map((d) => ({
    ...d,
    baerer_delt_ids: [
      // Det, der ikke flyttes, bliver liggende — også fælles grej, som
      // forslaget ikke nævner.
      ...d.baerer_delt_ids.filter((uid) => !til.has(uid)),
      ...[...til.entries()].filter(([, id]) => id === d.id).map(([uid]) => uid)
    ]
  }));

  return { deltagere };
}

// Deltagerens navn til en linje i forslaget. Null er "ingen har taget den
// endnu" og skal siges, ikke vises som et tomt navn.
export function navnFor(tur: Tur, id: string | null): string {
  if (id === null) return 'Ingen';
  return tur.deltagere.find((d) => d.id === id)?.navn || 'Uden navn';
}
