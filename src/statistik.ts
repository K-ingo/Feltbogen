import type { Item, Tur, Gruppe, Reference } from './db';
import { itemUidsPaaTur } from './smartMotor';

export type Periode = 'i_aar' | 'sidste_aar' | 'alt';

export function filtrererTure(ture: Tur[], periode: Periode, nu: Date = new Date()): Tur[] {
  const iAarStart = new Date(nu.getFullYear(), 0, 1);
  const sidsteAarStart = new Date(nu.getFullYear() - 1, 0, 1);
  const sidsteAarSlut = new Date(nu.getFullYear() - 1, 11, 31);

  return ture.filter((t) => {
    if (periode === 'alt') return true;
    if (!t.startdato) return false;
    const d = new Date(t.startdato);
    if (periode === 'i_aar') return d >= iAarStart;
    if (periode === 'sidste_aar') return d >= sidsteAarStart && d <= sidsteAarSlut;
    return true;
  });
}

export function samletInventarvaerdi(items: Item[]): number {
  return items
    .filter((i) => i.status === 'ejer')
    .reduce((sum, i) => sum + i.pris_kr * i.antal, 0);
}

export function samletVaegt(items: Item[]): number {
  return items
    .filter((i) => i.status === 'ejer')
    .reduce((sum, i) => sum + i.vaegt_g * i.antal, 0);
}

export function antalItems(items: Item[]): number {
  return items.filter((i) => i.status === 'ejer').length;
}

export interface AntalFordeling {
  ejer: number;
  overvejer: number;
  solgt: number;
}

export function antalPrStatus(items: Item[]): AntalFordeling {
  return {
    ejer: items.filter((i) => i.status === 'ejer').length,
    overvejer: items.filter((i) => i.status === 'overvejer').length,
    solgt: items.filter((i) => i.status === 'solgt').length
  };
}

// Købsdatoen skrives som MM/ÅÅÅÅ. Alt andet er ikke til at regne på, og et
// tomt felt er det normale — de fleste kender ikke datoen på gammelt gear.
export function koebsaar(koebsdato: string): number | null {
  const traef = /^(\d{1,2})\/(\d{4})$/.exec(koebsdato.trim());
  if (!traef) return null;

  const maaned = Number(traef[1]);
  if (maaned < 1 || maaned > 12) return null;

  return Number(traef[2]);
}

// Hvor meget værdi der kom til i et bestemt år. Gear uden købsdato tæller
// ikke med — det ville ellers lande i det år man tilfældigvis oprettede det.
export function vaerditilvaekst(items: Item[], aar: number): number {
  return items
    .filter((i) => i.status !== 'solgt' && koebsaar(i.koebsdato) === aar)
    .reduce((sum, i) => sum + i.pris_kr * i.antal, 0);
}

export function tureFordeltPrMaaned(ture: Tur[]): number[] {
  const maaneder = new Array(12).fill(0);
  ture.forEach((t) => {
    if (t.startdato) {
      const dato = new Date(t.startdato);
      if (!Number.isNaN(dato.getTime())) maaneder[dato.getMonth()]++;
    }
  });
  return maaneder;
}

interface ItemBrugSum {
  item: Item;
  antalTure: number;
}

export function mestBrugte(items: Item[], ture: Tur[], grupper: Gruppe[], topN: number = 5): ItemBrugSum[] {
  const taeller = new Map<string, number>();
  const itemsPrUid = new Map(items.map((item) => [item.uid, item]));

  ture.forEach((t) => {
    itemUidsPaaTur(t, grupper).forEach((uid) => taeller.set(uid, (taeller.get(uid) ?? 0) + 1));
  });

  return Array.from(taeller.entries())
    .map(([uid, antalTure]) => ({
      item: itemsPrUid.get(uid),
      antalTure
    }))
    .filter((x): x is ItemBrugSum => x.item !== undefined)
    .sort((a, b) => b.antalTure - a.antalTure)
    .slice(0, topN);
}

interface UbrugtInfo {
  antal: number;
  vaerdi: number;
  vaegt: number;
  items: Item[];
}

export function ubrugteItems(items: Item[], ture: Tur[], grupper: Gruppe[]): UbrugtInfo {
  const brugte = new Set<string>();
  const nu = new Date();
  const etAarSiden = new Date(nu.getFullYear() - 1, nu.getMonth(), nu.getDate());

  ture.forEach((t) => {
    if (!t.startdato) return;
    if (new Date(t.startdato) < etAarSiden) return;
    itemUidsPaaTur(t, grupper).forEach((uid) => brugte.add(uid));
  });

  const ubrugte = items.filter((i) => i.status === 'ejer' && !brugte.has(i.uid));

  return {
    antal: ubrugte.length,
    vaerdi: ubrugte.reduce((s, i) => s + i.pris_kr * i.antal, 0),
    vaegt: ubrugte.reduce((s, i) => s + i.vaegt_g * i.antal, 0),
    items: ubrugte
  };
}

interface GruppeFordeling {
  navn: string;
  vaegt: number;
  procent: number;
}

export function fordelingPrGruppe(items: Item[], grupper: Gruppe[]): GruppeFordeling[] {
  const totalVaegt = samletVaegt(items);
  if (totalVaegt === 0) return [];

  return grupper
    .map((g) => {
      const gItems = items.filter((i) => g.item_ids.includes(i.uid));
      const vaegt = gItems.reduce((s, i) => s + i.vaegt_g * i.antal, 0);
      return {
        navn: g.navn,
        vaegt,
        procent: (vaegt / totalVaegt) * 100
      };
    })
    .filter((g) => g.vaegt > 0)
    .sort((a, b) => b.vaegt - a.vaegt)
    .slice(0, 5);
}
// Seneste turdato pr. item, til kolonnen "Sidst brugt". Items der aldrig har
// været med, står ikke i kortet.
export function sidstBrugtPrItem(ture: Tur[], grupper: Gruppe[]): Map<Reference, string> {
  const sidst = new Map<Reference, string>();

  ture.forEach((tur) => {
    if (!tur.startdato) return;
    itemUidsPaaTur(tur, grupper).forEach((uid) => {
      const kendt = sidst.get(uid);
      if (!kendt || tur.startdato > kendt) sidst.set(uid, tur.startdato);
    });
  });

  return sidst;
}

// Gruppenavne pr. item. Grupper står i stedet for kategorier i datamodellen,
// så det er dem kolonnen "Kategori" viser.
export function grupperPrItem(grupper: Gruppe[]): Map<Reference, string[]> {
  const pr = new Map<Reference, string[]>();

  grupper.forEach((gruppe) => {
    gruppe.item_ids.forEach((uid) => {
      pr.set(uid, [...(pr.get(uid) ?? []), gruppe.navn]);
    });
  });

  return pr;
}

// Turene et item har været med på, nyeste først. Bruges til brugsstatistikken
// på item-detaljen: hvor mange gange, og hvornår sidst.
export function turePrItem(ture: Tur[], grupper: Gruppe[]): Map<Reference, Tur[]> {
  const pr = new Map<Reference, Tur[]>();

  ture.forEach((tur) => {
    itemUidsPaaTur(tur, grupper).forEach((uid) => {
      pr.set(uid, [...(pr.get(uid) ?? []), tur]);
    });
  });

  // Ture uden startdato ryger bagerst — de kan ikke placeres i tid.
  pr.forEach((liste) => liste.sort((a, b) => (b.startdato || '').localeCompare(a.startdato || '')));
  return pr;
}
