import type { Item } from './db';

// Vurderinger: 1-5 stjerner på et stykke grej og på en tur.
//
// Det er den eneste ting appen ved, som ikke er et tal eller en dato. Den ved
// hvad der var med, hvad der blev brugt, hvad der gik i stykker — men ikke om
// man var glad for det. En sovepose kan være brugt hver eneste nat og stadig
// være noget man frøs i.
//
// Skalaen er 1-5 og ikke en tommelfinger op/ned, fordi grej sjældent er godt
// eller skidt: det er som regel "fint nok". Og null er en rigtig værdi — de
// fleste ting bliver aldrig vurderet, og det skal ikke tælle som en dårlig
// vurdering.

export const MINDSTE = 1;
export const HOEJESTE = 5;

// Fra hvornår et stykke grej regnes som noget man holder af.
//
// Fire og ikke fem: fem er sjældent, og en regel der kun gælder for det man
// elsker allerhøjest, gælder næsten aldrig. Grænsen står her og ikke ude i
// motoren, så den er ét sted når den skal justeres.
export const GODT = 4;

// Og fra hvornår man har sagt fra. To og derunder — tre er "fint nok", og at
// regne "fint nok" som en advarsel ville gøre skalaen til et ja/nej.
export const SKIDT = 2;

// Læser en vurdering fra en post der måske er ældre end feltet, og afviser
// værdier uden for skalaen. Sync og import kan levere hvad som helst.
export function vurderingAf(item: Pick<Item, 'vurdering'>): number | null {
  return gyldig(item.vurdering ?? null);
}

export function gyldig(v: unknown): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;

  const helt = Math.round(v);
  return helt >= MINDSTE && helt <= HOEJESTE ? helt : null;
}

// Om man har sagt god for det. Bruges af motoren til at lade være med at
// foreslå at skifte det ud.
export function erGodtVurderet(item: Pick<Item, 'vurdering'>): boolean {
  const v = vurderingAf(item);
  return v !== null && v >= GODT;
}

export interface Gennemsnit {
  snit: number;
  // Hvor mange der ligger bag tallet. Et gennemsnit af én vurdering er ikke
  // et gennemsnit, og skærmen skal kunne sige hvor tyndt det er.
  antal: number;
}

// Gennemsnittet af det der er vurderet. Ting uden vurdering tælles ikke med —
// de er ikke nuller, de er ubesvarede.
export function gennemsnit(items: Pick<Item, 'vurdering'>[]): Gennemsnit | null {
  const vurderinger = items.map(vurderingAf).filter((v): v is number => v !== null);
  if (vurderinger.length === 0) return null;

  const sum = vurderinger.reduce((a, b) => a + b, 0);

  return {
    // Én decimal. To ville lade som om skalaen er finere end fem trin.
    snit: Math.round((sum / vurderinger.length) * 10) / 10,
    antal: vurderinger.length
  };
}

// "4,6 / 5" — som tal skrives på dansk.
export function snittekst(g: Gennemsnit): string {
  return `${g.snit.toFixed(1).replace('.', ',')} / ${HOEJESTE}`;
}
