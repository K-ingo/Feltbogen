import type { Deltager, Person, Tur, Reference } from './db';

// Faste rejseselskaber som selvstændige poster. "Mikkel" på to ture er to
// fremmede for en app der kun kender fritekst — her bliver det den samme, og
// så kan appen begynde at sige "ture med Mikkel: 8".
//
// Fritekst-flowet bevares hele vejen: man skal kunne skrive et navn og komme
// afsted uden først at oprette en person.

const MAKS_FORSLAG = 5;

// Turene en person har været med på, nyeste først.
export function tureMedPerson(ture: Tur[], personUid: Reference): Tur[] {
  return ture
    .filter((t) => t.deltagere.some((d) => d.person_uid === personUid))
    .sort((a, b) => (b.startdato || '').localeCompare(a.startdato || ''));
}

export function antalTurePrPerson(ture: Tur[]): Map<Reference, number> {
  const antal = new Map<Reference, number>();

  ture.forEach((tur) => {
    // Står den samme person to gange på én tur, tæller turen stadig kun én
    // gang — ellers ville en fejlindtastning se ud som et venskab.
    const paaTuren = new Set(tur.deltagere.map((d) => d.person_uid).filter(Boolean));
    paaTuren.forEach((uid) => antal.set(uid, (antal.get(uid) ?? 0) + 1));
  });

  return antal;
}

// Personer der matcher det man er ved at skrive, dem man rejser mest med
// først. Allerede tilføjede deltagere holdes ude — de kan ikke tilføjes igen.
export function foreslaaPersoner(
  personer: Person[],
  ture: Tur[],
  soegetekst: string,
  alleredePaaTuren: Reference[] = []
): Person[] {
  const soeg = soegetekst.trim().toLowerCase();
  const taget = new Set(alleredePaaTuren.filter(Boolean));
  const antal = antalTurePrPerson(ture);

  return personer
    .filter((p) => !taget.has(p.uid))
    .filter((p) => soeg === '' || p.navn.toLowerCase().includes(soeg))
    .sort((a, b) => {
      const forskel = (antal.get(b.uid) ?? 0) - (antal.get(a.uid) ?? 0);
      return forskel !== 0 ? forskel : a.navn.localeCompare(b.navn, 'da');
    })
    .slice(0, MAKS_FORSLAG);
}

// En deltager bygget ud fra en person. Standardovernatningen følger med, så
// den der altid sover i hængekøje ikke skal sættes op for hver tur.
export function deltagerFraPerson(person: Person): Deltager {
  return {
    id: crypto.randomUUID(),
    navn: person.navn,
    overnatning: person.standard_overnatning,
    personligt_gear_ids: [],
    baerer_delt_ids: [],
    person_uid: person.uid
  };
}

// En deltager skrevet ind i hånden. Samme form, bare uden kobling.
export function deltagerFraNavn(navn: string): Deltager {
  return {
    id: crypto.randomUUID(),
    navn: navn.trim(),
    overnatning: null,
    personligt_gear_ids: [],
    baerer_delt_ids: [],
    person_uid: ''
  };
}

export function personForDeltager(deltager: Deltager, personer: Person[]): Person | null {
  if (!deltager.person_uid) return null;
  return personer.find((p) => p.uid === deltager.person_uid) ?? null;
}

// Navne der er skrevet i hånden på tværs af turene, og som der ikke findes en
// person til. Det er dem det giver mening at tilbyde at oprette.
export function ukendteNavne(ture: Tur[], personer: Person[]): string[] {
  const kendte = new Set(personer.map((p) => p.navn.trim().toLowerCase()));
  const fundne = new Map<string, string>();

  ture.forEach((tur) => {
    tur.deltagere.forEach((d) => {
      const navn = d.navn.trim();
      if (!navn || d.person_uid) return;
      if (kendte.has(navn.toLowerCase())) return;
      fundne.set(navn.toLowerCase(), navn);
    });
  });

  return [...fundne.values()].sort((a, b) => a.localeCompare(b, 'da'));
}
