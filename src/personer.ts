import type { Deltager, Item, Person, Tur, Reference } from './db';

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

// Hvad en person plejer at have med, og hvad hun plejer at bære.
//
// Specens §17 vil have typisk gear og typisk vægt på persondetaljen. Begge
// dele kan udledes af turene: en deltager bærer noget personligt gear og
// noget af det fælles, og begge lister peger på ejerens inventar.
//
// To ting med vilje:
//
// Vægten er et snit over de ture, hvor hun faktisk bar noget — ikke over alle
// hendes ture. Har man ikke fordelt grejet på tre ud af fem ture, siger de tre
// ingenting om, hvad hun plejer at slæbe, og at tælle dem med som nul ville
// gøre snittet til en påstand om noget, appen ikke ved. Samme regel som
// vurderingerne: ubesvarede tælles ikke med.
//
// Og gearet er tælt i ture og ikke i stykker. "Med på 6 af 8 ture" siger
// noget; "6 gange" gør ikke, når man ikke ved hvor mange ture der var.
export interface Typiskgear {
  item: Item;
  ture: number;
}

export interface Baereprofil {
  // Snittet af det hun bar, over de ture hvor der var fordelt noget til hende.
  snit_g: number;
  // Hvor mange ture der ligger bag. Skærmen skal kunne sige, hvor tyndt det er.
  ture: number;
}

export interface Personprofil {
  ture: Tur[];
  typiskGear: Typiskgear[];
  baerer: Baereprofil | null;
}

// Så mange stykker gear vises. Er listen længere, er det ikke længere "det
// hun plejer at have med" — så er det hendes halve inventar.
const MAKS_TYPISK = 5;

export function personprofil(person: Person, ture: Tur[], items: Item[]): Personprofil {
  const hendes = tureMedPerson(ture, person.uid);
  const vaegte = new Map(items.map((i) => [i.uid, i.vaegt_g]));
  const itemsPrUid = new Map(items.map((item) => [item.uid, item]));

  const gangePrItem = new Map<Reference, number>();
  const baaret: number[] = [];

  hendes.forEach((tur) => {
    // Står hun to gange på den samme tur, tæller turen stadig kun én gang.
    const uids = new Set<Reference>();
    tur.deltagere
      .filter((d) => d.person_uid === person.uid)
      .forEach((d) => {
        d.personligt_gear_ids.forEach((uid) => uids.add(uid));
        d.baerer_delt_ids.forEach((uid) => uids.add(uid));
      });

    if (uids.size === 0) return;

    uids.forEach((uid) => gangePrItem.set(uid, (gangePrItem.get(uid) ?? 0) + 1));
    baaret.push([...uids].reduce((sum, uid) => sum + (vaegte.get(uid) ?? 0), 0));
  });

  const typiskGear = [...gangePrItem.entries()]
    .map(([uid, gange]) => ({ item: itemsPrUid.get(uid), ture: gange }))
    // Gear der er slettet siden, tælles ikke med — der er ikke noget at vise.
    .filter((x): x is Typiskgear => x.item !== undefined)
    .sort((a, b) => (b.ture - a.ture) || (b.item.vaegt_g - a.item.vaegt_g))
    .slice(0, MAKS_TYPISK);

  return {
    ture: hendes,
    typiskGear,
    baerer: baaret.length === 0
      ? null
      : {
          snit_g: Math.round(baaret.reduce((a, b) => a + b, 0) / baaret.length),
          ture: baaret.length
        }
  };
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
