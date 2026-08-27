import type { Item, Reference, Tur } from './db';

// Hvad der er lagt i tasken.
//
// Turen vidste før kun, hvilket grej der var *valgt* til den — ikke hvad man
// faktisk havde pakket. Det er to forskellige ting: den ene er en plan, den
// anden er en status, man står med tasken og opdaterer.
//
// Tilstanden er en liste med uid'er på turen og ikke en tabel for sig. Det
// følger mønsteret fra `loese_item_ids` og `gruppe_ids`, det synkroniserer
// med turen som alt andet, og det kræver hverken ny tabel eller ny
// konfliktstrategi.
//
// Specens §7.1 har fire tilstande: unchecked, packed, blocked og optional. Her
// er der to. "Blocked" (kan ikke pakkes endnu) og "optional" er reelle nok som
// idéer, men appen kan ikke selv udfylde dem, og en tilstand man skal sætte i
// hånden for at få noget ud af, er en tilstand de fleste aldrig sætter. To
// tilstande dækker det, man står og gør: er den i tasken, eller er den ikke.

export interface Pakkefremdrift {
  pakket: number;
  ialt: number;
  // 0–100, afrundet. 100 kun når alt er pakket — 99,6 % rundes ned til 99,
  // fordi "100 %" med noget udenfor tasken er en løgn man opdager i skoven.
  procent: number;
  faerdig: boolean;
  // Det der står tilbage, i den rækkefølge grejet står på turen.
  mangler: Item[];
}

export function pakkede(tur: Tur): Set<Reference> {
  return new Set(tur.pakkede_item_uids ?? []);
}

export function erPakket(tur: Tur, uid: Reference): boolean {
  return pakkede(tur).has(uid);
}

// Krydser af og fra. Returnerer den nye liste — den der kalder, gemmer den.
export function veksl(tur: Tur, uid: Reference): Reference[] {
  const nu = tur.pakkede_item_uids ?? [];
  return nu.includes(uid) ? nu.filter((u) => u !== uid) : [...nu, uid];
}

export function pakAlle(paaTuren: Item[]): Reference[] {
  return paaTuren.map((i) => i.uid);
}

export function ryd(): Reference[] {
  return [];
}

// Fremdriften måles mod det grej, turen har *nu*.
//
// Fjerner man et stykke gear fra turen, efter man har krydset det af, bliver
// dets uid stående på listen. Det ryddes ikke op: at skrive til turen hver
// gang pakkelisten ændrer sig, ville lave sync-trafik for at rette noget, der
// ikke er galt. I stedet tælles der kun det med, der rent faktisk er på turen,
// så tallet aldrig kan blive større end det, det måles imod.
export function fremdrift(tur: Tur, paaTuren: Item[]): Pakkefremdrift {
  const afkrydsede = pakkede(tur);
  const mangler = paaTuren.filter((i) => !afkrydsede.has(i.uid));
  const ialt = paaTuren.length;
  const pakket = ialt - mangler.length;

  return {
    pakket,
    ialt,
    procent: ialt === 0 ? 0 : Math.floor((pakket / ialt) * 100),
    // En tom pakkeliste er ikke færdigpakket — der er ingenting at pakke.
    faerdig: ialt > 0 && pakket === ialt,
    mangler
  };
}

// "12 af 18 pakket" — eller hvad der står, hvor der ikke er plads til mere.
export function fremdriftstekst(f: Pakkefremdrift): string {
  if (f.ialt === 0) return 'Intet grej valgt endnu';
  if (f.faerdig) return 'Alt er pakket';
  return `${f.pakket} af ${f.ialt} pakket`;
}
