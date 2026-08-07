import type { Item, Reference } from './db';
import type { Advarsel } from './smartMotor';

// Låne-loggen. To felter på et item: hvem det er udlånt til, og hvad man selv
// har lånt af andre.
//
// Pointen er at gearet ikke forsvinder ud af bevidstheden. En sovepose der har
// været hos Mikkel i seks uger skal appen spørge til, og den skal ikke stå på
// en pakkeliste som om den lå i skabet.

// Efter så lang tid er et lån ikke længere et lån man har styr på.
export const LANGT_UDLAAN_DAGE = 30;

export function erUdlaant(item: Item): boolean {
  return !!item.udlaan;
}

export function erLaant(item: Item): boolean {
  return !!item.laant_af;
}

export function udlaanteItems(items: Item[]): Item[] {
  return items.filter(erUdlaant);
}

export function laanteItems(items: Item[]): Item[] {
  return items.filter(erLaant);
}

// Dage siden en dato, eller null hvis den mangler eller ikke kan læses.
// Begge retninger af låne-loggen måler det samme, bare fra hvert sit felt.
export function dageSiden(dato: string | undefined, nu: Date = new Date()): number | null {
  if (!dato) return null;

  const d = new Date(dato);
  if (Number.isNaN(d.getTime())) return null;

  return Math.round((dagsnoegle(nu) - dagsnoegle(d)) / 86400000);
}

export function dageUdlaant(item: Item, nu: Date = new Date()): number | null {
  return dageSiden(item.udlaan?.udlaant_dato, nu);
}

export function dageLaant(item: Item, nu: Date = new Date()): number | null {
  return dageSiden(item.laant_af?.laant_dato, nu);
}

// Om noget skulle have været tilbage. Uden en aftalt dato er der ikke noget
// at overskride.
export function erOverskredet(dato: string | undefined, nu: Date = new Date()): boolean {
  if (!dato) return false;

  const frist = new Date(dato);
  if (Number.isNaN(frist.getTime())) return false;

  return dagsnoegle(frist) < dagsnoegle(nu);
}

// "6 uger" / "12 dage" — lån måles i uger når de er blevet lange nok til at
// det er uger man tænker i.
export function laengde(dage: number): string {
  if (dage < 14) return `${dage} ${dage === 1 ? 'dag' : 'dage'}`;

  const uger = Math.round(dage / 7);
  return `${uger} uger`;
}

// Gear på pakkelisten der ikke er hjemme. Det kan sagtens være med vilje —
// man aftaler at Mikkel tager soveposen med — så advarslen er gul og ikke rød.
export function udlaansAdvarsler(pakItems: Item[]): Advarsel[] {
  return pakItems.filter(erUdlaant).map((item) => {
    const hos = item.udlaan!.navn.trim() || 'en anden';

    return {
      niveau: 'gul' as const,
      besked: `${item.navn} er udlånt til ${hos}`,
      detalje: 'Står på pakkelisten, men er ikke hjemme. Hent det, eller aftal at det kommer med.',
      itemUid: item.uid,
      mangler: 'udlånt',
      begrundelse: `Reglen: gear med et åbent udlån står ikke i skabet. ${item.navn} blev lånt ud til ${hos}${item.udlaan!.udlaant_dato ? ` den ${item.udlaan!.udlaant_dato}` : ''}. Gul og ikke rød, fordi det kan være aftalt at ${hos} tager det med.`
    };
  });
}

// Alt der er ude af huset hos den samme person, så en aflevering kan klares
// på én gang. Personer uden kobling grupperes på navnet.
export function udlaanPrLaaner(items: Item[]): Map<string, Item[]> {
  const pr = new Map<string, Item[]>();

  udlaanteItems(items).forEach((item) => {
    const noegle = laanerNoegle(item.udlaan!.person_uid, item.udlaan!.navn);
    pr.set(noegle, [...(pr.get(noegle) ?? []), item]);
  });

  return pr;
}

// En person kendes på sit uid når der er et; ellers på navnet skrevet ens.
function laanerNoegle(personUid: Reference, navn: string): string {
  return personUid || navn.trim().toLowerCase();
}

// Midnat lokalt, så to datoer sammenlignes som dage og ikke som tidspunkter.
function dagsnoegle(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}
