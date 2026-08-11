import type { Item, Vedligehold } from './db';
import { laesDanskDato } from './smartMotor';

// Vedligeholds-loggen. Imprægnering af tarp, slibning af økse, olie i lygte.
//
// Det fanger den skjulte grund til at gear går i stykker: det bliver ikke
// passet. Mønstret er det samme som garantien — en dato og et interval — men
// hvor garantien løber ud én gang, går det her i ring.

// Hvor lang tid før forfald der mindes om det. Imprægnering skal helst ske
// inden turen, ikke bagefter.
export const VARSEL_DAGE = 21;

// Nogle almindelige at vælge imellem, så man ikke skal skrive dem selv hver
// gang. De er forslag og ikke en liste man skal holde sig til.
export const FORSLAG: readonly { navn: string; interval_maaneder: number }[] = [
  { navn: 'Imprægnering', interval_maaneder: 12 },
  { navn: 'Slibning', interval_maaneder: 6 },
  { navn: 'Rens og smøring', interval_maaneder: 12 },
  { navn: 'Dunvask', interval_maaneder: 24 },
  { navn: 'Tætningstjek', interval_maaneder: 12 }
];

export function nyHandling(navn = '', interval_maaneder = 12): Vedligehold {
  return {
    id: crypto.randomUUID(),
    navn,
    sidst_udfoert: '',
    interval_maaneder,
    noter: ''
  };
}

export function tilfoejHandling(item: Item, handling: Vedligehold): Vedligehold[] {
  return [...(item.vedligehold ?? []), handling];
}

export function opdaterHandling(
  liste: Vedligehold[],
  id: string,
  aendringer: Partial<Vedligehold>
): Vedligehold[] {
  return liste.map((h) => (h.id === id ? { ...h, ...aendringer } : h));
}

export function fjernHandling(liste: Vedligehold[], id: string): Vedligehold[] {
  return liste.filter((h) => h.id !== id);
}

// Datoen skrives som MM/ÅÅÅÅ. Man husker sjældent hvilken dag man
// imprægnerede, og måneden er præcis nok til et interval på et år.
export function laesMaaned(tekst: string): Date | null {
  const dele = tekst.trim().split('/');
  if (dele.length !== 2) return null;

  const [maaned, aar] = dele.map(Number);
  if (!Number.isFinite(maaned) || !Number.isFinite(aar)) return null;
  if (maaned < 1 || maaned > 12 || aar < 1900 || aar > 2200) return null;

  return new Date(aar, maaned - 1, 1);
}

export function skrivMaaned(d: Date): string {
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

// Hvornår handlingen skal gøres igen, eller null hvis den aldrig er udført
// eller ikke har et interval.
export function naesteGang(handling: Vedligehold): Date | null {
  if (handling.interval_maaneder <= 0) return null;

  const sidst = laesMaaned(handling.sidst_udfoert) ?? laesDanskDato(handling.sidst_udfoert);
  if (!sidst) return null;

  return new Date(sidst.getFullYear(), sidst.getMonth() + handling.interval_maaneder, 1);
}

// Dage til handlingen forfalder. Negativt tal betyder at den er overskredet;
// null når der ikke er noget at regne på.
export function dageTilForfald(handling: Vedligehold, nu: Date = new Date()): number | null {
  const naeste = naesteGang(handling);
  if (!naeste) return null;

  const enDag = 1000 * 60 * 60 * 24;
  const fra = new Date(nu.getFullYear(), nu.getMonth(), nu.getDate());
  return Math.round((naeste.getTime() - fra.getTime()) / enDag);
}

export function erForfalden(handling: Vedligehold, nu: Date = new Date()): boolean {
  const dage = dageTilForfald(handling, nu);
  return dage !== null && dage <= VARSEL_DAGE;
}

// "Sidst imprægneret 08/2025 · næste 08/2026" — linjen på gear-siden.
export function statustekst(handling: Vedligehold): string {
  if (!handling.sidst_udfoert.trim()) return 'Aldrig udført';

  const naeste = naesteGang(handling);
  if (!naeste) return `Sidst ${handling.sidst_udfoert}`;

  return `Sidst ${handling.sidst_udfoert} · næste ${skrivMaaned(naeste)}`;
}

// "om 3 uger" / "overskredet med 2 måneder" — kortformen til et handlingskort.
export function forfaldstekst(dage: number): string {
  if (dage < 0) return `overskredet med ${varighed(-dage)}`;
  if (dage === 0) return 'forfalder i dag';
  return `om ${varighed(dage)}`;
}

function varighed(dage: number): string {
  if (dage < 14) return `${dage} ${dage === 1 ? 'dag' : 'dage'}`;
  if (dage < 60) return `${Math.round(dage / 7)} uger`;
  return `${Math.round(dage / 30)} måneder`;
}

export interface Forfalden {
  item: Item;
  handling: Vedligehold;
  dage: number;
}

// Alt gear der skal passes, det mest overskredne først. Kun gear man ejer —
// noget man har solgt behøver man ikke imprægnere.
export function forfaldne(items: Item[], nu: Date = new Date()): Forfalden[] {
  return items
    .filter((i) => i.status === 'ejer')
    .flatMap((item) =>
      (item.vedligehold ?? []).map((handling) => ({
        item,
        handling,
        dage: dageTilForfald(handling, nu)
      }))
    )
    .filter((x): x is Forfalden => x.dage !== null && x.dage <= VARSEL_DAGE)
    .sort((a, b) => a.dage - b.dage);
}
