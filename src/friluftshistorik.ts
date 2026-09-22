import type { Item, Sted, Tur, Reference } from './db';
import { etiket } from './db';
import { antalItems, samletVaegt } from './statistik';

// Friluftshistorikken: stederne og tallene bag dem.
//
// Skærmen under Mere hedder Friluftshistorik og har to faner — Steder og
// Statistik — men det er den samme historie læst to gange: hvor man har
// været, og hvor meget det blev til. Regnestykkerne ligger her, så skærmen
// kun skal tegne dem, og så de kan efterprøves uden en browser.
//
// Alt herinde er udledt af ture og grej, der allerede findes. Der kommer
// ingen nye felter af det, og der er ikke noget tal her, som ikke kan spores
// tilbage til noget, brugeren selv har skrevet ind.

// ─────────────────────────────────────────────
// Stederne
// ─────────────────────────────────────────────

export interface Stedlinje {
  // Det linjerne samles på: stedets uid, når turen peger på et gemt sted,
  // ellers fritekstnavnet i småt. To ture til "Rold Skov" skrevet i hånden er
  // det samme sted, selvom ingen af dem er gemt.
  noegle: string;
  navn: string;
  // Dexie-id'et, når stedet står i stedbogen. Uden det kan rækken ikke åbnes
  // — stedet findes kun som et navn på en tur.
  id?: number;
  gemt: boolean;
  adresse: string;
  ture: number;
  naetter: number;
  // Den nyeste tur på stedet. Den er det, linjen skriver "sidst" ud fra.
  sidste: Tur | null;
  // Nyeste tur er en kladde. Den tæller med — man har skrevet den ned, og
  // stedet skal kunne findes igen — men tallet skal kunne læses med det
  // forbehold, og derfor står markeringen på linjen.
  kladde: boolean;
}

function nyeste(a: Tur, b: Tur): Tur {
  return (b.startdato || '') > (a.startdato || '') ? b : a;
}

// Hvert sted man har været, med det turene siger om det.
//
// Kilden er turene og ikke stedbogen. Man skriver et sted ind på en tur, ikke
// i et register — og en liste, der kun viste de steder, man havde gemt med
// vilje, ville stå tom for en, der har været ude fire gange. De gemte steder
// er med alligevel: de er oprettet med vilje, og et sted uden ture endnu er
// et sted, man har tænkt sig hen.
export function stederMedBesoeg(steder: Sted[], ture: Tur[]): Stedlinje[] {
  const gemte = new Map<Reference, Sted>(steder.map((s) => [s.uid, s]));
  const linjer = new Map<string, Stedlinje>();

  for (const sted of steder) {
    linjer.set(sted.uid, {
      noegle: sted.uid,
      navn: sted.navn || 'Uden navn',
      id: sted.id,
      gemt: true,
      adresse: sted.adresse,
      ture: 0,
      naetter: 0,
      sidste: null,
      kladde: false
    });
  }

  for (const tur of ture) {
    const gemt = tur.sted_uid ? gemte.get(tur.sted_uid) : undefined;
    const navn = (gemt?.navn || tur.sted).trim();
    if (!navn) continue;

    const noegle = gemt ? gemt.uid : navn.toLowerCase();
    const foer = linjer.get(noegle) ?? {
      noegle,
      navn,
      gemt: false,
      adresse: '',
      ture: 0,
      naetter: 0,
      sidste: null,
      kladde: false
    };

    const sidste = foer.sidste ? nyeste(foer.sidste, tur) : tur;
    linjer.set(noegle, {
      ...foer,
      ture: foer.ture + 1,
      naetter: foer.naetter + tur.naetter,
      sidste,
      kladde: sidste.status === 'kladde'
    });
  }

  // Det sted man kommer igen, står øverst. Det er den rækkefølge man leder i:
  // stedet man vender tilbage til hvert år betyder mere end det, man så på
  // én gang — og et gemt sted uden ture endnu hører nederst, hvor det ikke
  // skygger for dem, man faktisk har været.
  return [...linjer.values()].sort(
    (a, b) =>
      b.ture - a.ture ||
      b.naetter - a.naetter ||
      a.navn.localeCompare(b.navn, 'da')
  );
}

// Stederne man er kommet tilbage til. Ét besøg er et sted man har været; to
// er en vane.
export function gentagneSteder(linjer: Stedlinje[]): number {
  return linjer.filter((l) => l.ture >= 2).length;
}

export interface Stedtal {
  i_alt: number;
  // Stederne der kommer af en tur. Resten er gemt i hånden — et sted, man har
  // tænkt sig hen, men ikke har været endnu.
  fra_ture: number;
  uden_ture: number;
  gensyn: number;
}

// Optællingen bag linjen over stedlisten og rækken under Mere.
//
// De tre tal holdes fra hinanden med vilje. Den gamle Mere-række lagde dem
// sammen og kaldte summen "steder du kommer tilbage til" — men et sted, man
// har oprettet, er ikke et sted, man har været, og ét besøg er ikke et gensyn.
export function stedtal(linjer: Stedlinje[]): Stedtal {
  const fraTure = linjer.filter((l) => l.ture > 0).length;

  return {
    i_alt: linjer.length,
    fra_ture: fraTure,
    uden_ture: linjer.length - fraTure,
    gensyn: gentagneSteder(linjer)
  };
}

// "Bushcraft · skov" — det turen var, skrevet som man siger det. Tom, når
// stedet kun findes i stedbogen og ikke på en tur endnu.
export function turkarakter(sidste: Tur | null): string {
  if (!sidste) return '';
  return [etiket(sidste.aktivitet), etiket(sidste.terraen)].filter(Boolean).join(' · ');
}

// "2 ture · 4 nætter i alt". Nætterne udelades, når der ikke var nogen: en
// dagstur er ikke nul nætter, den er en dagstur.
export function besoegstal(linje: Stedlinje): string {
  if (linje.ture === 0) return 'Ingen ture herfra endnu';

  const ture = `${linje.ture} ${linje.ture === 1 ? 'tur' : 'ture'}`;
  if (linje.naetter === 0) return ture;

  const naetter = `${linje.naetter} ${linje.naetter === 1 ? 'nat' : 'nætter'}`;
  return `${ture} · ${naetter}${linje.ture > 1 ? ' i alt' : ''}`;
}

// ─────────────────────────────────────────────
// Tallene
// ─────────────────────────────────────────────

export interface Historiktal {
  ture: number;
  naetter: number;
  // Grejet og kiloene er ikke periodetal. De er inventaret, som det ser ud
  // nu, og de skifter ikke, fordi man vælger et andet år. Skærmen skriver det
  // under felterne — et tal, der står stille, når resten flytter sig, skal
  // forklares, ikke skjules.
  grej: number;
  vaegt_g: number;
}

export function historiktal(ture: Tur[], items: Item[]): Historiktal {
  return {
    ture: ture.length,
    naetter: ture.reduce((s, t) => s + t.naetter, 0),
    grej: antalItems(items),
    vaegt_g: samletVaegt(items)
  };
}

export interface Maanedsnaetter {
  // 0-11, som Date.getMonth().
  maaned: number;
  naetter: number;
}

// Nætter fordelt på måneder. Turen tælles i den måned, den begyndte — en tur
// hen over et månedsskifte hører til dér, man tog afsted.
export function naetterPrMaaned(ture: Tur[]): number[] {
  const maaneder = new Array<number>(12).fill(0);

  for (const tur of ture) {
    if (!tur.startdato) continue;
    const dato = new Date(tur.startdato);
    if (Number.isNaN(dato.getTime())) continue;
    maaneder[dato.getMonth()] += tur.naetter;
  }

  return maaneder;
}

// Sæsonen: fra den første måned med nætter til den sidste.
//
// Tolv søjler, hvor de ni er nul, er ikke en graf — det er en kalender. Til
// gengæld hører de tomme måneder *inde* i sæsonen med: at der ikke blev
// sovet ude i juli mellem juni og august er selve oplysningen.
export function saesonen(ture: Tur[]): Maanedsnaetter[] {
  const maaneder = naetterPrMaaned(ture);
  const foerste = maaneder.findIndex((n) => n > 0);
  if (foerste === -1) return [];

  const sidste = maaneder.length - 1 - [...maaneder].reverse().findIndex((n) => n > 0);

  return maaneder
    .slice(foerste, sidste + 1)
    .map((naetter, i) => ({ maaned: foerste + i, naetter }));
}
