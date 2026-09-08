import type { Gruppe, Item, Reference, Tur } from './db';
import { itemsPaaTur, foreslaaGrupper } from './smartMotor';
import { vaegtresultat, bedsteBytter } from './vaegtbrydere';
import type { Risiko } from './vaegtbrydere';
import { foreslaaFordeling } from './fordeling';
import { foreslaaKopi } from './ligesomSidst';

// Smart-motorens forslag, i én form.
//
// Motoren har haft tre slags forslag med hver sin form: et kopiforslag med en
// score, et grejsætforslag med en trafliste, og en vægtbryder med
// alternativer. Hver skærm har så pakket dem om til det, den lige havde brug
// for — og de tre steder, der gjorde det, valgte tre forskellige ord for det
// samme.
//
// Specens §13 beder om én type med titel, forklaring, virkning, tiltro og to
// handlinger. Det er ikke en ren oprydning: den fælles form er dét, der gør,
// at en fjerde slags forslag kan komme til uden en fjerde slags kort.
//
// Tre ting følger af specen og holdes fast her:
//
// Motoren skriver ingenting. Der er ingen funktion i filen, der rører basen.
// `handling` er to stykker tekst — det, knapperne skal hedde — og skærmen
// afgør, hvad der sker, når nogen trykker.
//
// Samme input giver samme output. Derfor er `id` udledt af, hvad forslaget
// handler om, og ikke et tilfældigt uuid: to kald med de samme data giver de
// samme id'er, så en skærm kan huske, hvad man har afvist, uden at forslaget
// skifter identitet mellem to renderinger.
//
// Og hvert forslag har en forklaring. Den er ikke skrevet her — den kommer
// fra den motor, der fandt forslaget, så teksten og reglen bliver ved med at
// være det samme sted.

// Specens typer er water, food, gas, gear, weight og history. De tre første
// er ikke med, og det er med vilje: `beregnForbrug` regner vand, mad og gas
// ud, og tallene står på turens egen skærm, hvor man planlægger dem. Et
// forslag, der gentager et tal, man kan se i forvejen, er ikke et forslag —
// og en type, som ingenting producerer, er et løfte, appen ikke holder.
export type Forslagstype = 'grej' | 'vaegt' | 'historik' | 'fordeling';

// Hvor meget motoren selv tror på det.
//
// Den er regnet af, hvor godt datagrundlaget er — hvor mange af turens
// kendetegn der ramte, hvor sikkert et bytte er — og aldrig af, hvor stor
// gevinsten ville være. En stor gevinst gør ikke et gæt til andet end et gæt.
export type Tiltro = 'lav' | 'mellem' | 'hoej';

// Hvad forslaget ville betyde, hvis man tog imod det. Null når det ikke kan
// gøres op i et tal — at tage et grejsæt med gør ikke turen målbart bedre,
// det gør den bare mere komplet.
export interface Virkning {
  vaegt_g?: number;
  antal?: number;
}

export interface Forslag {
  id: string;
  type: Forslagstype;
  titel: string;
  detalje: string;
  begrundelse: string;
  virkning: Virkning | null;
  tiltro: Tiltro;
  // Ordene på de to knapper. Motoren foreslår; skærmen handler.
  handling: { tag_imod: string; afvis: string };
}

// Så mange forslag ad gangen. Startskærmen skal kunne læses på fem sekunder,
// og et forslag man ikke når at læse, er ikke et forslag.
export const MAKS_FORSLAG = 3;

export function forslagTilTur(
  tur: Tur | null,
  grupper: Gruppe[],
  items: Item[],
  alleTure: Tur[]
): Forslag[] {
  if (!tur) return [];

  const ejet = items.filter((i) => i.status === 'ejer');
  const paaTuren = itemsPaaTur(tur, grupper, ejet);

  const forslag = [
    ...(paaTuren.length === 0 ? historik(tur, grupper, alleTure) : []),
    ...grej(tur, grupper),
    // Fordelingen står før vægtbryderne. En skæv fordeling mærkes hele turen;
    // et par hundrede gram lettere gear gør ikke.
    ...(paaTuren.length > 0 ? fordeling(tur, paaTuren) : []),
    ...(paaTuren.length > 0 ? vaegt(tur, grupper, ejet, paaTuren) : [])
  ];

  return forslag.slice(0, MAKS_FORSLAG);
}

// Er der ikke valgt noget grej endnu, er den tomme liste det eneste problem
// der er værd at løse. En tidligere tur der ligner, er et bedre sted at
// begynde end ingenting.
function historik(tur: Tur, grupper: Gruppe[], alleTure: Tur[]): Forslag[] {
  const kopi = foreslaaKopi(tur, alleTure, grupper)[0];
  if (!kopi) return [];

  return [{
    id: `historik:${kopi.tur.uid}`,
    type: 'historik',
    titel: `Pak ligesom ${kopi.tur.navn || 'sidste tur'}`,
    detalje: `${kopi.antalItems} ${kopi.antalItems === 1 ? 'ting' : 'ting'} at kopiere over`,
    begrundelse: kopi.begrundelse,
    virkning: { antal: kopi.antalItems },
    tiltro: tiltroAf(kopi.score / kopi.maks),
    handling: { tag_imod: 'Kopiér grejet', afvis: 'Ikke denne gang' }
  }];
}

// Grejsæt hvis tags rammer turens. Kun det bedste match: to forslag om at
// tilføje en gruppe ad gangen er ikke hjælp, det er en liste.
function grej(tur: Tur, grupper: Gruppe[]): Forslag[] {
  const bedste = foreslaaGrupper(tur, grupper).filter((g) => g.score > 0)[0];
  if (!bedste) return [];

  return [{
    id: `grej:${bedste.gruppe.uid}`,
    type: 'grej',
    titel: `Tag ${bedste.gruppe.navn} med`,
    detalje: `Passer på ${bedste.traf.join(', ')}`,
    begrundelse: bedste.begrundelse,
    // Sættets vægt kendes ikke herfra — det ville kræve inventaret slået op
    // mod hvert uid, og tallet ville alligevel ændre sig, når sættet gør.
    virkning: null,
    // Målt mod sættets egne tags og ikke mod turens: et sæt med ét tag, der
    // rammer, ved mindre om turen end et sæt, hvor alle tre rammer.
    tiltro: tiltroAf(bedste.traf.length / Math.max(1, bedste.gruppe.tags.length)),
    handling: { tag_imod: 'Tag sættet med', afvis: 'Ikke på denne tur' }
  }];
}

// Hvem der bærer det fælles grej. Reglerne står i fordeling.ts; her bliver de
// til et kort.
function fordeling(tur: Tur, paaTuren: Item[]): Forslag[] {
  const f = foreslaaFordeling(tur, paaTuren);
  if (!f) return [];

  const tungestFoer = Math.max(...f.linjer.map((l) => l.foer_g));
  const tungestEfter = Math.max(...f.linjer.map((l) => l.efter_g));
  const ufordelt = f.ufordelt_antal > 0;

  return [{
    id: `fordeling:${tur.uid}`,
    type: 'fordeling',
    titel: ufordelt ? 'Fælles grej uden en bærer' : 'Rygsækkene er skæve',
    detalje: ufordelt
      ? `${f.ufordelt_antal} ${f.ufordelt_antal === 1 ? 'ting' : 'ting'} på `
        + `${(f.ufordelt_g / 1000).toFixed(1)} kg er ikke fordelt`
      : `${(f.spredning_foer_g / 1000).toFixed(1)} kg mellem den tungeste og den letteste`,
    begrundelse: f.begrundelse,
    // Er der ufordelt grej, bliver den tungeste rygsæk tungere af at fordele
    // det — vægten var der hele tiden, den stod bare ikke på nogens ryg. Så
    // ville et minustal være en påstand, motoren ikke kan holde.
    virkning: ufordelt
      ? { antal: f.flytninger.length }
      : { vaegt_g: tungestEfter - tungestFoer, antal: f.flytninger.length },
    // Regnestykket er sikkert; om man vil bære sådan, er noget andet. Grej
    // uden en bærer er der til gengæld ikke noget at diskutere om.
    tiltro: ufordelt ? 'hoej' : 'mellem',
    handling: { tag_imod: 'Se fordelingen', afvis: 'Vi bærer som vi gør' }
  }];
}

// Lettere alternativer i skabet. Kun værd at nævne når der er valgt grej at
// gøre lettere, og kun hvis der reelt er noget at hente.
function vaegt(tur: Tur, grupper: Gruppe[], ejet: Item[], paaTuren: Item[]): Forslag[] {
  const resultat = vaegtresultat(tur, grupper, ejet, paaTuren);
  if (resultat.potentiel_besparelse_g <= 0) return [];

  const bytter = bedsteBytter(resultat.brydere);
  const antal = bytter.length;

  return [{
    id: `vaegt:${bytter[0].tung.uid}`,
    type: 'vaegt',
    // Ikke "Vægten kan ned". Det er en påstand om vægten, og den siger
    // hverken hvad man kan gøre, eller hvor. Det, der findes, er lettere gear,
    // man allerede ejer — og det er dét, kortet fører hen til.
    titel: 'Lettere grej i skabet',
    detalje: `${(resultat.potentiel_besparelse_g / 1000).toFixed(1)} kg at hente på ${antal} ${antal === 1 ? 'ting' : 'ting'}`,
    begrundelse: resultat.brydere[0].begrundelse,
    virkning: { vaegt_g: -resultat.potentiel_besparelse_g, antal },
    // Tiltroen er byttets risiko vendt om. Et bytte, motoren kalder vovet, er
    // ikke et forslag, den er sikker på.
    tiltro: TILTRO_VED_RISIKO[bytter[0].risiko],
    handling: { tag_imod: 'Se byttene', afvis: 'Vægten er fin' }
  }];
}

const TILTRO_VED_RISIKO: Record<Risiko, Tiltro> = {
  lav: 'hoej',
  mellem: 'mellem',
  hoej: 'lav'
};

// Andelen af det, der kunne ramme, som ramte. To tredjedele er grænsen for
// "høj": under det er der lige så meget, motoren ikke ved, som den ved.
export function tiltroAf(andel: number): Tiltro {
  if (andel >= 2 / 3) return 'hoej';
  if (andel >= 1 / 3) return 'mellem';
  return 'lav';
}

export const TILTRONAVN: Record<Tiltro, string> = {
  lav: 'Gæt',
  mellem: 'Kvalificeret',
  hoej: 'Sikker'
};

// Hvad forslaget handler om: grejsættets, turens eller det tunge stykke gears
// uid. Det er anden halvdel af id'et — de to hænger sammen med vilje, så et
// forslag ikke kan pege ét sted hen og hedde noget andet.
export function maalFor(forslag: Forslag): Reference {
  return forslag.id.slice(forslag.id.indexOf(':') + 1);
}

// Aftrykket af et forslag: hvad det handler om, og hvad det bygger på.
//
// Id'et alene kan ikke bære en afvisning, der skal overleve, at man går ud af
// turen og ind i den igen. Id'et er udledt af *målet* — det tunge stykke
// gear, grejsættet, turen — og det bliver ved med at være det samme, selvom
// tallene bag forslaget flytter sig. Afviste man "1,2 kg at hente på 3 ting"
// og pakkede tre tunge ting mere, ville det samme id dække over noget helt
// andet, og nej'et ville gælde et forslag, man aldrig havde set.
//
// Aftrykket tager derfor det med, forslaget siger: titlen, detaljen og
// virkningen. De er alle sammen regnet af turens data, så de flytter sig
// præcis når grundlaget gør — og kun da. Begrundelsen er ikke med: den er
// lang, og den forklarer den samme regel som de tre andre allerede bærer
// tallene fra.
//
// Det er samme aftale som id'et: samme input giver samme aftryk. To
// renderinger af den samme situation må ikke give to forskellige aftryk,
// ellers ville et afvist forslag komme igen af sig selv.
export function aftrykAf(forslag: Forslag): string {
  const v = forslag.virkning;
  const virkning = v ? `${v.vaegt_g ?? ''}/${v.antal ?? ''}` : '';
  return [forslag.id, forslag.titel, forslag.detalje, virkning].join('|');
}

// Forslag man har afvist, sorteret fra.
//
// Sættet er aftryk og ikke id'er — se `aftrykAf`. Hvor afvisningerne gemmes,
// er ikke motorens sag: den her fil rører aldrig basen. Se `afviste.ts`.
export function udenAfviste(forslag: Forslag[], afviste: Set<string>): Forslag[] {
  return forslag.filter((f) => !afviste.has(aftrykAf(f)));
}
