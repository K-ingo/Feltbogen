// "Kom i gang" — det, en tom konto får at se på Hjem, Ture og Grej.
//
// En tom skærm skal give værdi, før der findes et inventar. Det gør den ikke
// med en rundvisning i funktioner, men med de to første ting, der gør appen
// brugbar: en tur at pakke til og noget grej at pakke med.
//
// Et tredje skridt — et gæstelink at kigge på som demo — er bevidst udeladt.
// Gæstevisningen findes, men den kræver login og en rigtig, delt tur; en demo
// ville være opdigtede data, og dem viser Feltbogen ikke.
//
// Hvor langt man er, regnes ud af det, der ligger i basen. Intet gemmes om
// selve listen: har man lavet tingen, er skridtet gjort.

// Fem er ikke et krav, men et startmål: nok til at et grejsæt og en pakkeliste
// har noget at regne på, og få nok til at man gør det nu.
export const GREJ_START = 5;

export type Startskridt = 'tur' | 'grej';

export interface Skridt {
  id: Startskridt;
  titel: string;
  detalje: string;
  // Knappens tekst. Et gjort skridt har ingen knap.
  knap: string;
  gjort: boolean;
}

export function startskridt(antalTure: number, antalEjet: number): Skridt[] {
  const turGjort = antalTure > 0;
  const grejGjort = antalEjet >= GREJ_START;

  return [
    {
      id: 'tur',
      titel: 'Opret første tur',
      detalje: turGjort
        ? 'Du har en tur at pakke til.'
        : 'Hvor, hvornår og hvad for en tur. Alt kan springes over og rettes bagefter.',
      knap: 'Opret første tur',
      gjort: turGjort
    },
    {
      id: 'grej',
      titel: `Tilføj ${GREJ_START} grej`,
      detalje: grejGjort
        ? `${antalEjet} ting skrevet ind.`
        : antalEjet === 0
          ? 'Start med det, du altid har med — fx telt, sovepose, underlag, kogegrej og lygte. Navn er nok; vægt kan komme senere.'
          : `${antalEjet} af ${GREJ_START} skrevet ind.`,
      knap: antalEjet === 0 ? `Tilføj ${GREJ_START} grej` : 'Tilføj mere grej',
      gjort: grejGjort
    }
  ];
}

// Knapperne er aldrig fyldte: skærmen har sin egen fyldte accent (Hjems
// næste-eventyr-kort, "+ Ny tur", "+ Tilføj grej"). Skærmens eget skridt —
// turen på Ture, grejet på Grej — får outline som næste prioritet, så længe
// det mangler; ellers det første skridt, der mangler. Resten står som tekst.
//
// `udenKnap` er skridt, skærmen allerede har en knap til et andet sted — på
// Hjem står "Planlæg en tur" på kortet lige ovenover.
export function knapvariant(
  skridt: Skridt[],
  id: Startskridt,
  fokus: Startskridt,
  udenKnap: Startskridt[] = []
): 'sekundaer' | 'tekst' {
  const mangler = skridt.filter((s) => !s.gjort && !udenKnap.includes(s.id));
  const fremhaevet = mangler.find((s) => s.id === fokus) ?? mangler[0];
  return fremhaevet?.id === id ? 'sekundaer' : 'tekst';
}
