import type { Sted, Tur, Reference } from './db';

// Steder som genbrugsressource. Et sted er ikke en egenskab ved én tur — man
// kommer tilbage til det, og det man lærte sidst skal stå der næste gang.
//
// Alt herinde er rene funktioner over de lister skærmene alligevel har hentet.

// Hvor tæt to punkter skal ligge for at regnes som det samme sted. Shelteret
// og bålpladsen ved siden af er samme sted; nabosheltret en kilometer væk er
// det ikke.
export const SAMME_STED_KM = 0.4;

// Så mange steder foreslås ad gangen. En liste man skal scrolle i er ikke et
// forslag længere.
const MAKS_FORSLAG = 5;

// Turene der har været på et sted, nyeste først.
export function turePaaSted(ture: Tur[], stedUid: Reference): Tur[] {
  return ture
    .filter((t) => t.sted_uid === stedUid)
    .sort((a, b) => (b.startdato || '').localeCompare(a.startdato || ''));
}

// Antal besøg pr. sted. Kun ture der faktisk er knyttet til et sted tæller —
// fritekst siger ingenting om hvor man var.
export function besoegPrSted(ture: Tur[]): Map<Reference, number> {
  const antal = new Map<Reference, number>();

  ture.forEach((t) => {
    if (!t.sted_uid) return;
    antal.set(t.sted_uid, (antal.get(t.sted_uid) ?? 0) + 1);
  });

  return antal;
}

export function stedForTur(tur: Tur, steder: Sted[]): Sted | null {
  if (!tur.sted_uid) return null;
  return steder.find((s) => s.uid === tur.sted_uid) ?? null;
}

// "Været her 3 gange" — eller ingenting første gang, hvor der ikke er noget
// at prale af.
export function besoegstekst(antal: number): string {
  if (antal <= 0) return 'Aldrig været her';
  if (antal === 1) return 'Været her 1 gang';
  return `Været her ${antal} gange`;
}

// Gemte steder der matcher det man er ved at skrive. De steder man kommer
// mest, står øverst — det er dem man leder efter.
export function foreslaaSteder(steder: Sted[], ture: Tur[], soegetekst: string): Sted[] {
  const soeg = soegetekst.trim().toLowerCase();
  if (!soeg) return [];

  const besoeg = besoegPrSted(ture);

  return steder
    .filter((s) => s.navn.toLowerCase().includes(soeg) || s.adresse.toLowerCase().includes(soeg))
    .sort((a, b) => {
      const forskel = (besoeg.get(b.uid) ?? 0) - (besoeg.get(a.uid) ?? 0);
      return forskel !== 0 ? forskel : a.navn.localeCompare(b.navn, 'da');
    })
    .slice(0, MAKS_FORSLAG);
}

// Det gemte sted man allerede står på, hvis der er et. Bruges når koordinater
// sættes på en tur: så kan appen spørge "er det her ikke Rold Skov?" i stedet
// for at lave stedet igen.
export function naermesteSted(
  steder: Sted[],
  punkt: { lat: number; lng: number },
  maksKm: number = SAMME_STED_KM
): Sted | null {
  const indenfor = steder
    .filter((s): s is Sted & { koordinater: { lat: number; lng: number } } => s.koordinater !== null)
    .map((sted) => ({ sted, km: afstandKm(punkt, sted.koordinater) }))
    .filter((x) => x.km <= maksKm)
    .sort((a, b) => a.km - b.km);

  return indenfor[0]?.sted ?? null;
}

// Afstand i kilometer mellem to punkter (haversine). Jordens krumning betyder
// ingenting på de afstande vi måler, men formlen er kort nok til at tage med.
export function afstandKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const JORDRADIUS_KM = 6371;
  const rad = (grader: number) => (grader * Math.PI) / 180;

  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;

  return 2 * JORDRADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}
