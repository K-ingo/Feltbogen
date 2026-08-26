import type { Gruppe, Tur, TurStatus } from './db';
import { itemUidsPaaTur } from './smartMotor';
import { fremdrift } from './afgangsTjek';

// Hvor turen er i sit forløb, og hvad det næste skridt er.
//
// Turen havde fire tilstande og en knap, der førte videre til den næste. Det
// virkede, men knappen sagde kun hvad den gjorde — ikke hvad turen manglede,
// før det gav mening at trykke på den. Man kunne markere en tur klar uden
// datoer og uden grej, og appen sagde ingenting.
//
// Herinde ligger svaret på "hvad nu?" for en tur, som ren logik: hvilken fase,
// hvad det næste skridt er, og hvad der er værd at gøre først.
//
// To ting med vilje:
//
// Manglerne blokerer ikke. Fundamentet siger, at Feltbogen hjælper men aldrig
// tvinger, og at manglende data er i orden — man skal kunne tage afsted på en
// tur, appen synes er halvfærdig. Derfor er de oplysninger under knappen og
// ikke en lås på den.
//
// Og "evalueret" er ikke en femte tilstand i basen. Den er udledt af, om
// pak-af-tjekket er udfyldt. En tilstand mere ville skulle migreres, synkes og
// holdes i sync med et felt, der allerede siger det samme.

export type Fase = 'kladde' | 'klar' | 'aktiv' | 'afsluttet' | 'evalueret';

// Hvad knappen gør. Domænet siger hvilken slags skridt det er; skærmen
// oversætter det til en handling. Så kan reglerne testes uden en skærm.
export type Naesteskridt =
  | { slags: 'status'; til: TurStatus; label: string }
  | { slags: 'pak_af_tjek'; label: string }
  | { slags: 'ingen' };

export interface Turfase {
  fase: Fase;
  // Ordet på badgen i turlisten.
  navn: string;
  naeste: Naesteskridt;
  // Hvorfor det næste skridt er det næste. Vises bag "hvorfor?".
  begrundelse: string;
  // Hvad der står tilbage. Tom liste betyder ikke at turen er perfekt — kun
  // at der ikke er noget, appen kan få øje på.
  mangler: string[];
}

// Fasen alene. Turlisten skal kunne sætte det rigtige ord på hver tur uden at
// regne mangler ud for dem alle sammen.
export function faseAf(tur: Tur): Fase {
  if (tur.status === 'afsluttet' && tur.pak_af_tjek) return 'evalueret';
  return tur.status;
}

export const FASENAVN: Record<Fase, string> = {
  kladde: 'Kladde',
  klar: 'Klar',
  aktiv: 'På tur',
  afsluttet: 'Afsluttet',
  // "Gjort op" frem for "evalueret" — det er det, man ville sige om en tur,
  // man har været igennem bagefter.
  evalueret: 'Gjort op'
};

export function turfase(tur: Tur, grupper: Gruppe[]): Turfase {
  switch (tur.status) {
    case 'kladde':
      return {
        fase: 'kladde',
        navn: FASENAVN.kladde,
        naeste: { slags: 'status', til: 'klar', label: 'Markér som klar' },
        begrundelse:
          'En kladde er en tur, du er ved at lægge. Markerer du den klar, flytter den op som noget, der skal afsted — og startknappen kommer frem. Du kan altid gå tilbage.',
        mangler: kladdemangler(tur, grupper)
      };

    case 'klar':
      return {
        fase: 'klar',
        navn: FASENAVN.klar,
        naeste: { slags: 'status', til: 'aktiv', label: 'Start tur' },
        begrundelse:
          'Turen er lagt. Når du starter den, skifter appen til på-tur-skærmen: store knapper, vejret, dagens noter — og ikke redigering af gear og indstillinger.',
        mangler: klarmangler(tur)
      };

    case 'aktiv':
      return {
        fase: 'aktiv',
        navn: FASENAVN.aktiv,
        naeste: { slags: 'status', til: 'afsluttet', label: 'Afslut tur' },
        begrundelse:
          'Turen er i gang. Afslutter du den, lukkes den for redigering af planen, og pak-af-tjekket kommer frem — det er dér, appen lærer af turen.',
        mangler: []
      };

    case 'afsluttet':
      // Den eneste sted, fasen ikke er den samme som tilstanden i basen.
      return tur.pak_af_tjek
        ? {
            fase: 'evalueret',
            navn: FASENAVN.evalueret,
            naeste: { slags: 'pak_af_tjek', label: 'Se pak-af-tjek' },
            begrundelse:
              'Turen er gjort op. Det du svarede, er med i motorens forslag til næste tur — hvad du brugte, hvad der lå urørt, og hvad der gik i stykker.',
            mangler: []
          }
        : {
            fase: 'afsluttet',
            navn: FASENAVN.afsluttet,
            naeste: { slags: 'pak_af_tjek', label: 'Lav pak-af-tjek' },
            begrundelse:
              'Turen er slut, men ikke gjort op. Uden pak-af-tjekket ved appen kun, hvad du tog med — ikke hvad du faktisk brugte, og så kan den ikke foreslå bedre næste gang. Jo før, jo mere kan du huske.',
            mangler: []
          };
  }
}

// Hvad en kladde mangler, før det giver mening at kalde den klar.
//
// Rækkefølgen er den, man ville gøre tingene i: hvornår, hvorhen, hvad med,
// hvem med. Kun det appen kan få øje på — at man har glemt at spørge om fri,
// kan den ikke vide.
function kladdemangler(tur: Tur, grupper: Gruppe[]): string[] {
  const mangler: string[] = [];

  if (!tur.startdato) {
    mangler.push('Ingen datoer');
  } else if (!tur.slutdato) {
    mangler.push('Ingen slutdato');
  }

  if (!tur.sted.trim()) mangler.push('Intet sted');

  if (itemUidsPaaTur(tur, grupper).size === 0) mangler.push('Intet grej valgt');

  // Kun værd at nævne når turen selv siger, at der kommer nogen med. Er man
  // afsted alene, er en tom deltagerliste det rigtige.
  if (tur.personer > 1 && tur.deltagere.length === 0) {
    mangler.push(`Turen er sat til ${tur.personer} personer, men ingen er skrevet på`);
  }

  return mangler;
}

// Det sidste inden afgang. Afgangs-tjekket er den eneste liste, appen kan
// måle på — resten af "er du klar?" ved den ikke noget om.
function klarmangler(tur: Tur): string[] {
  const { afkrydsede, ialt, faerdig } = fremdrift(tur.afgangs_tjek ?? null);

  if (ialt === 0) return ['Afgangs-tjekket er ikke taget i brug'];
  if (!faerdig) return [`Afgangs-tjek: ${ialt - afkrydsede} tilbage af ${ialt}`];

  return [];
}
