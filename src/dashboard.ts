import type { Item, Tur, Gruppe, Reference } from './db';
import { itemUidsPaaTur, laesDanskDato, dageTil } from './smartMotor';
import { filtrererTure } from './statistik';
import { manglerPakAfTjek, dageSidenSlut, PAK_AF_FRIST_DAGE } from './pakAfTjek';

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

export type HandlingsType =
  | 'garanti'
  | 'kladde_naer_start'
  | 'pak_af_tjek_mangler'
  | 'koebsinfo'
  | 'ubrugt';

// Hvad kortet fører hen til. Gear-handlinger peger på et item, tur-handlinger
// på en tur — begge dele skal kunne åbnes fra startskærmen.
export interface Maal {
  slags: 'item' | 'tur';
  uid: Reference;
}

export interface Handling {
  type: HandlingsType;
  titel: string;
  detalje: string;
  maal: Maal;
  // Kortet farves rødt. Sættes af den enkelte handling og ikke af skærmen, så
  // grænsen for hvornår noget haster står sammen med reglen der finder det.
  haster: boolean;
}

// Hvor mange forgangne ture et item skal have været fra, før det regnes som
// ubrugt. Under den grænse har en ny bruger ikke turhistorik nok til at det
// betyder noget.
const UBRUGT_EFTER_TURE = 5;

// Så tæt på starten er en kladde ikke længere en kladde man er i gang med —
// den er en tur der mangler at blive gjort klar.
const KLADDE_VARSEL_DAGE = 3;

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
      maal: { slags: 'item', uid: item.uid },
      haster: true
    }));

  // Uden købssted og -dato er en garanti svær at gøre gældende. Kun gear med
  // en pris er værd at spørge til.
  const koebsinfo: Handling[] = ejet
    .filter((i) => i.pris_kr > 0 && !i.koebt_hos.trim() && !i.koebsdato.trim())
    .map((i) => ({
      type: 'koebsinfo',
      titel: 'Manglende købsinfo',
      detalje: i.navn,
      maal: { slags: 'item', uid: i.uid },
      haster: false
    }));

  const ubrugt = ubrugteEfterSidsteTure(ejet, ture, grupper, nu);

  // Rækkefølgen er prioriteringen: garanti har en frist der koster penge at
  // overskride, turene har en frist der kun koster dem selv, købsinfo er det
  // man skal bruge for at gøre garantien gældende, og ubrugt gear kan vente.
  return foersteProblemPrMaal([
    ...garantier,
    ...kladderNaerStart(ture, nu),
    ...manglendePakAfTjek(ture, nu),
    ...koebsinfo,
    ...ubrugt
  ]);
}

// Ét kort pr. post. Et stykke gear kan sagtens have to problemer, men på en
// startskærm med plads til en håndfuld kort skubber gentagelsen andet ud;
// resten står på postens egen side.
function foersteProblemPrMaal(alle: Handling[]): Handling[] {
  const set = new Set<string>();

  return alle.filter((h) => {
    const noegle = `${h.maal.slags}:${h.maal.uid}`;
    if (set.has(noegle)) return false;
    set.add(noegle);
    return true;
  });
}

// Turen begynder om få dage, og den står stadig som kladde. Den nærmeste tur
// først — det er den man skal nå at gøre noget ved.
function kladderNaerStart(ture: Tur[], nu: Date): Handling[] {
  return ture
    .filter((t) => t.status === 'kladde' && t.startdato)
    .map((tur) => ({ tur, dage: dageTil(new Date(tur.startdato), nu) }))
    .filter(({ dage }) => dage >= 0 && dage <= KLADDE_VARSEL_DAGE)
    .sort((a, b) => a.dage - b.dage)
    .map(({ tur, dage }) => ({
      type: 'kladde_naer_start' as const,
      titel: 'Turen er stadig en kladde',
      detalje: `${tur.navn || 'Uden navn'} · ${startFrist(dage)}`,
      maal: { slags: 'tur' as const, uid: tur.uid },
      haster: false
    }));
}

// Turen er slut, men den er aldrig gjort op. Uden pak-af-tjekket har motoren
// intet at lære af — derfor er det den ældste tur der står øverst, den er den
// sværeste at huske tilbage på.
function manglendePakAfTjek(ture: Tur[], nu: Date): Handling[] {
  return ture
    .filter(manglerPakAfTjek)
    .map((tur) => ({ tur, dage: dageSidenSlut(tur, nu) }))
    .filter((x): x is { tur: Tur; dage: number } => x.dage !== null && x.dage >= 0)
    .sort((a, b) => b.dage - a.dage)
    .map(({ tur, dage }) => ({
      type: 'pak_af_tjek_mangler' as const,
      titel: 'Mangler pak-af-tjek',
      detalje: `${tur.navn || 'Uden navn'} · ${slutFrist(dage)}`,
      maal: { slags: 'tur' as const, uid: tur.uid },
      // Jo længere tid der går, jo mindre kan man huske. Efter fristen er det
      // ikke længere en note man kan tage sig af i næste uge.
      haster: dage > PAK_AF_FRIST_DAGE
    }));
}

function startFrist(dage: number): string {
  if (dage > 1) return `om ${dage} dage`;
  if (dage === 1) return 'i morgen';
  return 'starter i dag';
}

function slutFrist(dage: number): string {
  if (dage > 1) return `slut for ${dage} dage siden`;
  if (dage === 1) return 'slut i går';
  return 'slut i dag';
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
      maal: { slags: 'item', uid: i.uid },
      haster: false
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
