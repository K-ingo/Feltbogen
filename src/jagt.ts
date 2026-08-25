import type { Tur } from './db';

// Jagtperiode-varsel (§5.5).
//
// Bushcraftere i skoven under drivjagt er ikke en god kombination, og
// Naturstyrelsen lukker enkelte skove helt på jagtdage.
//
// Vigtigt om hvad det her *ikke* er: der findes ikke et åbent API over danske
// jagttider, og bekendtgørelsen er detaljeret — arter, landsdele, undtagelser,
// og den ændres. Appen har derfor ikke en tabel over arter, og den påstår ikke
// at vide om der er jagt netop dér den dag.
//
// Den kender de grove sæsoner, siger hvad de betyder i praksis, og peger på
// den der ved det. Et varsel man kan handle på — "ring til skovdistriktet" —
// er mere værd end en artsliste der kan være et år gammel.

export interface Jagtsaeson {
  navn: string;
  // Måned og dag, 1-indekseret. Perioder der går over nytår skrives med
  // slut før start.
  fra: [number, number];
  til: [number, number];
  betydning: string;
}

export const SAESONER: Jagtsaeson[] = [
  {
    navn: 'Drivjagt',
    fra: [10, 1],
    til: [1, 31],
    betydning: 'Drivjagt og klapjagt ligger typisk her. Naturstyrelsen lukker '
      + 'enkelte skove helt på jagtdage, og de bliver skiltet ved indgangene.'
  },
  {
    navn: 'Almindelig jagtsæson',
    fra: [9, 1],
    til: [1, 31],
    betydning: 'Der er jagt på det meste vildt i den her periode. Bær noget '
      + 'der kan ses, og hold dig til stierne i statsskovene.'
  },
  {
    navn: 'Bukkejagt',
    fra: [5, 16],
    til: [7, 15],
    betydning: 'Jagt på råbuk. Foregår mest tidligt om morgenen og sidst på '
      + 'dagen, og som regel fra skydestiger — ikke som drivjagt.'
  }
];

// Om en dato ligger i perioden. Perioder der går over nytår håndteres ved at
// slutmåneden er mindre end startmåneden.
export function iPerioden(dato: Date, saeson: Jagtsaeson): boolean {
  const nu = (dato.getMonth() + 1) * 100 + dato.getDate();
  const fra = saeson.fra[0] * 100 + saeson.fra[1];
  const til = saeson.til[0] * 100 + saeson.til[1];

  return fra <= til ? nu >= fra && nu <= til : nu >= fra || nu <= til;
}

export interface Jagtvarsel {
  saesoner: Jagtsaeson[];
  begrundelse: string;
}

// Varslet for en tur, eller null hvis der ikke er noget at sige.
//
// Kun ved skov- og mix-terræn: der er ingen drivjagt på en kyststrækning, og
// et varsel der altid står der, holder folk op med at læse.
export function jagtvarsel(tur: Tur): Jagtvarsel | null {
  if (tur.terraen !== 'skov' && tur.terraen !== 'mix') return null;

  const dage = turensDage(tur);
  if (dage.length === 0) return null;

  const traeffer = SAESONER.filter((s) => dage.some((d) => iPerioden(d, s)));
  if (traeffer.length === 0) return null;

  return {
    saesoner: traeffer,
    begrundelse: 'Varslet står her fordi turen er i skov og ligger i en '
      + 'jagtsæson. Appen ved ikke om der faktisk er jagt netop dér — de '
      + 'præcise jagttider står hos Miljøstyrelsen, og Naturstyrelsen '
      + 'offentliggør hvilke skove der lukkes på hvilke dage.'
  };
}

// Turens dage som datoer. En tur der spænder over et sæsonskifte skal varsles
// for begge — det er netop den tur hvor man kan blive overrasket.
function turensDage(tur: Tur): Date[] {
  const start = new Date(tur.startdato);
  if (Number.isNaN(start.getTime())) return [];

  const slut = tur.slutdato ? new Date(tur.slutdato) : start;
  const sidste = Number.isNaN(slut.getTime()) ? start : slut;

  const dage: Date[] = [];
  // En tur på mere end en måned er ikke en tur; loftet holder løkken endelig
  // hvis en slutdato er tastet forkert.
  for (let d = new Date(start); d <= sidste && dage.length < 40; d.setDate(d.getDate() + 1)) {
    dage.push(new Date(d));
  }
  return dage;
}

// Hvor man slår det op. Naturstyrelsens liste over jagtdage er den der
// afgør om skoven er lukket den dag man kommer.
export const JAGTDAGE_LINK = 'https://naturstyrelsen.dk/naturoplevelser/jagt/jagt-paa-statens-arealer/';
export const JAGTTIDER_LINK = 'https://mst.dk/natur-vand/jagt/jagttider';
