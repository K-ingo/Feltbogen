import type { Tur } from './db';
import type { VejrDag, VejrData } from './smartMotor';
import { dageTil } from './smartMotor';

// Regnestykkerne bag på-tur-skærmen. De ligger for sig selv, fordi de kan
// afgøres uden at rende en skærm igennem — og fordi det er dem der bestemmer
// hvad man får at vide, mens man står i skoven.

// Grænserne for hvornår vejret er skiftet nok til at man skal vide det på
// forhånd. Resten kan man se ud ad hængekøjen.
const VAADT_MM = 5;
const BLAESENDE_MS = 8;
const KOLDT_C = 2;

export interface Vejrskift {
  dag: VejrDag;
  aarsag: string;
}

// Første dag forude med regn, blæst eller frostnat. Rækkefølgen er
// prioriteringen: vådt er det der ødelægger en tur, blæst det der vælter en
// tarp, kulde det man kan lægge mere tøj på imod.
export function naesteSkift(vejr: VejrData | null, nu: Date = new Date()): Vejrskift | null {
  const idag = iso(nu);

  for (const dag of vejr?.dage ?? []) {
    if (dag.dato <= idag) continue;

    if (dag.nedboer_mm >= VAADT_MM) return { dag, aarsag: `${dag.nedboer_mm} mm regn` };
    if (dag.vind_ms >= BLAESENDE_MS) return { dag, aarsag: `${dag.vind_ms} m/s vind` };
    if (dag.temp_min <= KOLDT_C) return { dag, aarsag: `ned til ${dag.temp_min}°C` };
  }

  return null;
}

export function vejrForDag(vejr: VejrData | null, nu: Date = new Date()): VejrDag | null {
  const idag = iso(nu);
  return vejr?.dage.find((d) => d.dato === idag) ?? null;
}

// "2 dage tilbage" / "sidste dag" — hvor langt man er.
export function dageTilbage(tur: Tur, nu: Date = new Date()): string {
  const slut = tur.slutdato || tur.startdato;
  if (!slut) return '';

  const dato = new Date(slut);
  if (Number.isNaN(dato.getTime())) return '';

  const dage = dageTil(dato, nu);
  if (dage < 0) return 'Slutdatoen er passeret';
  if (dage === 0) return 'Sidste dag';
  if (dage === 1) return '1 dag tilbage';
  return `${dage} dage tilbage`;
}

export function dagsnavn(dato: string): string {
  const d = new Date(dato);
  const dage = ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag'];
  return dage[d.getDay()] ?? dato;
}

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
