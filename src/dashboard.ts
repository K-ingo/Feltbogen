import type { Item, Tur, Gruppe, Reference } from './db';
import { itemUidsPaaTur, laesDanskDato, dageTil } from './smartMotor';
import { filtrererTure } from './statistik';

// Logikken bag startskærmen. Alt herinde er rene funktioner, så rækkefølgen og
// grænserne kan testes uden at rende skærmen igennem.

// ─────────────────────────────────────────────
// Næste tur
// ─────────────────────────────────────────────

// Den tur man er på vej på — eller er midt i. En tur der er gået i gang, men
// ikke slut endnu, tæller stadig: det er den man har brug for at åbne.
export function naesteTur(ture: Tur[], nu: Date = new Date()): Tur | null {
  const idag = iso(nu);

  const kommende = ture.filter((t) => {
    if (t.status === 'afsluttet' || !t.startdato) return false;
    return (t.slutdato || t.startdato) >= idag;
  });

  if (kommende.length === 0) return null;
  return kommende.sort((a, b) => a.startdato.localeCompare(b.startdato))[0];
}

// "om 8 dage" / "i dag" / "i gang" — teksten over turkortet.
export function naarBegynder(tur: Tur, nu: Date = new Date()): string {
  const dage = dageTil(new Date(tur.startdato), nu);
  if (dage > 1) return `om ${dage} dage`;
  if (dage === 1) return 'i morgen';
  if (dage === 0) return 'i dag';
  return 'i gang';
}

// ─────────────────────────────────────────────
// Handlinger
// ─────────────────────────────────────────────

export type HandlingsType = 'garanti' | 'koebsinfo' | 'ubrugt';

export interface Handling {
  type: HandlingsType;
  titel: string;
  detalje: string;
  itemUid: Reference;
}

// Hvor mange forgangne ture et item skal have været fra, før det regnes som
// ubrugt. Under den grænse har en ny bruger ikke turhistorik nok til at det
// betyder noget.
const UBRUGT_EFTER_TURE = 5;

export function handlinger(
  items: Item[],
  ture: Tur[],
  grupper: Gruppe[],
  nu: Date = new Date()
): Handling[] {
  const ejet = items.filter((i) => i.status === 'ejer');

  // Garantier der er ved at løbe ud — det mest tidskritiske, så de står først,
  // og den der haster mest øverst.
  const garantier: Handling[] = ejet
    .map((item) => ({ item, dage: garantiDage(item, nu) }))
    .filter((x): x is { item: Item; dage: number } => x.dage !== null)
    .sort((a, b) => a.dage - b.dage)
    .map(({ item, dage }) => ({
      type: 'garanti' as const,
      titel: 'Garanti udløber',
      detalje: `${item.navn} · ${garantiFrist(dage)}`,
      itemUid: item.uid
    }));

  // Uden købssted og -dato er en garanti svær at gøre gældende. Kun gear med
  // en pris er værd at spørge til.
  const koebsinfo: Handling[] = ejet
    .filter((i) => i.pris_kr > 0 && !i.koebt_hos.trim() && !i.koebsdato.trim())
    .map((i) => ({
      type: 'koebsinfo',
      titel: 'Manglende købsinfo',
      detalje: i.navn,
      itemUid: i.uid
    }));

  const ubrugt = ubrugteEfterSidsteTure(ejet, ture, grupper, nu);

  // Rækkefølgen er prioriteringen: garanti har en frist, købsinfo er det man
  // skal bruge for at gøre garantien gældende, ubrugt gear kan altid vente.
  return foersteProblemPrItem([...garantier, ...koebsinfo, ...ubrugt]);
}

// Ét kort pr. item. Et stykke gear kan sagtens have to problemer, men på en
// startskærm med plads til en håndfuld kort skubber gentagelsen andet gear ud;
// resten står på itemets egen side.
function foersteProblemPrItem(alle: Handling[]): Handling[] {
  const set = new Set<Reference>();

  return alle.filter((h) => {
    if (set.has(h.itemUid)) return false;
    set.add(h.itemUid);
    return true;
  });
}

// Gear der ikke har været med på nogen af de seneste ture. Måles i ture og
// ikke i måneder, fordi det er turene der siger noget om brug.
function ubrugteEfterSidsteTure(
  ejet: Item[],
  ture: Tur[],
  grupper: Gruppe[],
  nu: Date
): Handling[] {
  const idag = iso(nu);
  const forgangne = ture
    .filter((t) => t.startdato && t.startdato <= idag)
    .sort((a, b) => b.startdato.localeCompare(a.startdato))
    .slice(0, UBRUGT_EFTER_TURE);

  if (forgangne.length < UBRUGT_EFTER_TURE) return [];

  const brugt = new Set<Reference>();
  forgangne.forEach((t) => itemUidsPaaTur(t, grupper).forEach((uid) => brugt.add(uid)));

  return ejet
    .filter((i) => !brugt.has(i.uid))
    .map((i) => ({
      type: 'ubrugt' as const,
      titel: 'Ubrugt gear',
      detalje: `${i.navn} · ${forgangne.length} ture`,
      itemUid: i.uid
    }));
}

// Dage til garantien udløber, eller null hvis der ikke er nogen — eller hvis
// der er længere igen end påmindelsesvinduet.
function garantiDage(item: Item, nu: Date): number | null {
  if (!item.garanti) return null;

  const udloeber = laesDanskDato(item.garanti.udloeber_dato);
  if (!udloeber) return null;

  const dage = dageTil(udloeber, nu);
  return dage <= item.garanti.paamindelse_dage ? dage : null;
}

function garantiFrist(dage: number): string {
  if (dage > 1) return `${dage} dage`;
  if (dage === 1) return '1 dag';
  if (dage === 0) return 'i dag';
  return 'udløbet';
}

// ─────────────────────────────────────────────
// Nøgletal
// ─────────────────────────────────────────────

export interface AarsTal {
  iAar: number;
  sidsteAar: number;
  // null når der ikke var nogen ture sidste år at måle imod.
  aendringPct: number | null;
}

export function tureIAar(ture: Tur[], nu: Date = new Date()): AarsTal {
  const iAar = filtrererTure(ture, 'i_aar', nu).length;
  const sidsteAar = filtrererTure(ture, 'sidste_aar', nu).length;

  return {
    iAar,
    sidsteAar,
    aendringPct: sidsteAar === 0 ? null : Math.round(((iAar - sidsteAar) / sidsteAar) * 100)
  };
}

export function sidstTilfoejede(items: Item[], antal: number = 5): Item[] {
  return [...items]
    .sort((a, b) => b.oprettet.getTime() - a.oprettet.getTime())
    .slice(0, antal);
}

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
