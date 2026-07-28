import type { Item, Tur, Gruppe } from './db';

export type Periode = 'i_aar' | 'sidste_aar' | 'alt';

export function filtrererTure(ture: Tur[], periode: Periode): Tur[] {
  const nu = new Date();
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

export function tureFordeltPrMaaned(ture: Tur[]): number[] {
  const maaneder = new Array(12).fill(0);
  ture.forEach((t) => {
    if (t.startdato) {
      const m = new Date(t.startdato).getMonth();
      maaneder[m]++;
    }
  });
  return maaneder;
}

interface ItemBrugSum {
  item: Item;
  antalTure: number;
}

export function mestBrugte(items: Item[], ture: Tur[], grupper: Gruppe[], topN: number = 5): ItemBrugSum[] {
  const taeller = new Map<number, number>();

  ture.forEach((t) => {
    const itemIds = new Set<number>();
    t.loese_item_ids.forEach((id) => itemIds.add(id));
    t.gruppe_ids.forEach((gId) => {
      const g = grupper.find((x) => x.id === gId);
      if (g) g.item_ids.forEach((id) => itemIds.add(id));
    });
    itemIds.forEach((id) => taeller.set(id, (taeller.get(id) ?? 0) + 1));
  });

  return Array.from(taeller.entries())
    .map(([id, antalTure]) => ({
      item: items.find((i) => i.id === id),
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
  const brugte = new Set<number>();
  const nu = new Date();
  const etAarSiden = new Date(nu.getFullYear() - 1, nu.getMonth(), nu.getDate());

  ture.forEach((t) => {
    if (!t.startdato) return;
    const d = new Date(t.startdato);
    if (d < etAarSiden) return;

    t.loese_item_ids.forEach((id) => brugte.add(id));
    t.gruppe_ids.forEach((gId) => {
      const g = grupper.find((x) => x.id === gId);
      if (g) g.item_ids.forEach((id) => brugte.add(id));
    });
  });

  const ubrugte = items.filter((i) => i.status === 'ejer' && i.id && !brugte.has(i.id));

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
      const gItems = items.filter((i) => i.id && g.item_ids.includes(i.id));
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