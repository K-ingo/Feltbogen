import type { Sted, Tur, Reference } from './db';
import { nyesteFoerst } from './feltnoter';

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

// Et besøg er en tur, der er sket — eller er i gang. En kladde eller en klar
// tur er en plan: man har ikke været der endnu, og "Været her 1 gang" om den
// tur, man sidder og planlægger, ville være løgn.
export function erBesoeg(tur: Tur): boolean {
  return tur.status === 'aktiv' || tur.status === 'afsluttet';
}

// Besøgene på et sted, nyeste først. Kun turens kobling til stedet tæller —
// aldrig fritekst, og aldrig hvor grejet står derhjemme.
export function besoegPaaSted(ture: Tur[], stedUid: Reference): Tur[] {
  if (!stedUid) return [];
  return turePaaSted(ture, stedUid).filter(erBesoeg);
}

// Besøgene på turens sted fra før denne tur, nyeste først. Turen selv tæller
// aldrig med — heller ikke når den er i gang — og en tur, der ligger efter
// den, man kigger på, er ikke "sidst".
export function tidligereBesoeg(ture: Tur[], tur: Tur): Tur[] {
  return besoegPaaSted(ture, tur.sted_uid).filter(
    (t) =>
      t.uid !== tur.uid &&
      (!tur.startdato || !t.startdato || t.startdato <= tur.startdato)
  );
}

export interface NoteFraSidst {
  // Besøget noten er fra.
  tur: Tur;
  tekst: string;
}

// Det sidste, man skrev om stedet på ét besøg: den nyeste indgang i turlogen,
// ellers turens egne noter. Tom, når man ikke skrev noget — så er der ingen
// note, og der skal ikke stå en.
export function noteFraBesoeg(besoeg: Tur): NoteFraSidst | null {
  const felt = nyesteFoerst(besoeg.feltnoter ?? []).find((n) => n.tekst.trim());
  const tekst = felt?.tekst.trim() || (besoeg.noter ?? '').trim();
  return tekst ? { tur: besoeg, tekst } : null;
}

// Noten fra forrige besøg — kun det ene. Skrev man intet sidst, er svaret
// ingenting, også selvom der står noget fra en tur for tre år siden: "fra
// sidst" skal betyde fra sidst.
export function noteFraSidst(ture: Tur[], tur: Tur): NoteFraSidst | null {
  const forrige = tidligereBesoeg(ture, tur)[0];
  return forrige ? noteFraBesoeg(forrige) : null;
}

// "Første gang her" eller "Været her 2 gange før" — til turen, hvor denne
// tur ikke selv tæller.
export function genbesoegstekst(tidligere: number): string {
  if (tidligere <= 0) return 'Første gang her';
  if (tidligere === 1) return 'Været her 1 gang før';
  return `Været her ${tidligere} gange før`;
}

// Antal besøg pr. sted. Kun ture der faktisk er knyttet til et sted tæller —
// fritekst siger ingenting om hvor man var — og kun ture, der er sket.
export function besoegPrSted(ture: Tur[]): Map<Reference, number> {
  const antal = new Map<Reference, number>();

  ture.forEach((t) => {
    if (!t.sted_uid || !erBesoeg(t)) return;
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

// Alle steder, mest besøgte først. Det er den rækkefølge man leder i: stedet
// man kommer hvert år står før det man så på én gang.
export function sorterEfterBesoeg(steder: Sted[], ture: Tur[]): Sted[] {
  const besoeg = besoegPrSted(ture);

  return [...steder].sort((a, b) => {
    const forskel = (besoeg.get(b.uid) ?? 0) - (besoeg.get(a.uid) ?? 0);
    return forskel !== 0 ? forskel : a.navn.localeCompare(b.navn, 'da');
  });
}

// Gemte steder der matcher det man er ved at skrive.
export function foreslaaSteder(steder: Sted[], ture: Tur[], soegetekst: string): Sted[] {
  const soeg = soegetekst.trim().toLowerCase();
  if (!soeg) return [];

  const traf = steder.filter(
    (s) => s.navn.toLowerCase().includes(soeg) || s.adresse.toLowerCase().includes(soeg)
  );

  return sorterEfterBesoeg(traf, ture).slice(0, MAKS_FORSLAG);
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
