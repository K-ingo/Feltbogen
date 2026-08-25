import type { VejrDag } from './smartMotor';

// Bål og tørke (§5.1).
//
// Oplægget vil have DMI's skovbrandindeks. Det er den rigtige kilde, men det
// kræver en API-nøgle, og afbrændingsforbud udstedes af de enkelte
// beredskaber uden noget centralt feed. Appens øvrige tjenester er gratis og
// uden nøgle, og det bliver de ved med at være.
//
// Så det her er ikke et skovbrandindeks, og udgiver sig ikke for at være det.
// Det er en observation på den udsigt appen allerede har hentet: har det
// været tørt og varmt, siger den det og peger på den der bestemmer. Et tal
// opfundet af temperatur og nedbør ville se ud som DMI's indeks uden at være
// det, og det ville være værre end ingenting.

// Under det regnes en dag som tør. Under en millimeter når ikke ned gennem
// kronerne, og skovbunden mærker den ikke.
export const TOER_MM = 1;

// Over det begynder tørt løv og nåle at antænde let.
export const VARM_GRAD = 20;

export type Toerhed = 'vaadt' | 'almindeligt' | 'toert';

export interface Baaltjek {
  toerhed: Toerhed;
  toerreDage: number;
  nedboer_mm: number;
  varmest: number;
  tekst: string;
  begrundelse: string;
}

// Ser på turens dage, eller null hvis der ikke er nogen udsigt at se på.
export function baaltjek(dage: VejrDag[]): Baaltjek | null {
  if (dage.length === 0) return null;

  const nedboer = dage.reduce((s, d) => s + taerskel(d.nedboer_mm), 0);
  const toerreDage = dage.filter((d) => taerskel(d.nedboer_mm) < TOER_MM).length;
  const varmest = Math.max(...dage.map((d) => taerskel(d.temp_max)));

  // Vurderingen tælles i dage og ikke i millimeter lagt sammen. En sum kan
  // gøres våd af én skybrudsdag, mens de andre er knastørre — og det er dem
  // man skal advares om. Tørt er kun tørt hvis *hver* dag er det.
  const toerhed: Toerhed = toerreDage === dage.length && varmest >= VARM_GRAD ? 'toert'
    : toerreDage === 0 ? 'vaadt'
      : 'almindeligt';

  return {
    toerhed,
    toerreDage,
    nedboer_mm: Math.round(nedboer * 10) / 10,
    varmest: Math.round(varmest),
    tekst: tekstFor(toerhed, dage.length, toerreDage, varmest),
    begrundelse: 'Regnet ud af den vejrudsigt der blev hentet til turen — '
      + `tørre dage er under ${TOER_MM} mm, varmt er over ${VARM_GRAD}°. `
      + 'Det er ikke DMI\'s skovbrandindeks, og det ved ikke om der er '
      + 'afbrændingsforbud. Det afgør dit beredskab.'
  };
}

function taerskel(v: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

function tekstFor(toerhed: Toerhed, dage: number, toerre: number, varmest: number): string {
  if (toerhed === 'toert') {
    return `Der er ikke meldt regn på ${dage === 1 ? 'turens dag' : `nogen af turens ${dage} dage`}`
      + `, og op til ${Math.round(varmest)}°. Tjek for afbrændingsforbud inden du regner med bål.`;
  }
  if (toerhed === 'vaadt') {
    return 'Der er meldt regn på turen. Tørt brænde bliver det svære, ikke forbuddet.';
  }
  return `${toerre} af turens ${dage} dage er meldt tørre. Tjek for afbrændingsforbud hvis du regner med bål.`;
}

// Beredskabsstyrelsen samler de gældende afbrændingsforbud. Det er dem der
// afgør det, ikke en vejrudsigt.
export const FORBUD_LINK = 'https://www.brs.dk/da/redningsberedskab-myndighed/forebyggelse/afbraendingsforbud/';
