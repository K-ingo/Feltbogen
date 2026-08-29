import type { Pakkelinje } from './smartMotor';
import { saet, laes } from './indstillinger';

// Gæstens egen pakkeliste.
//
// Ejeren krydser af på turen: `pakkede_item_uids` står på hendes tur og følger
// med op. En gæst har ikke turen — hun har et frosset øjebliksbillede af den,
// og hun kan ikke skrive i den.
//
// Men hun skal pakke. Og "har jeg lagt den i tasken" er hendes eget spørgsmål
// om hendes egen taske: det er ikke data om turen, og de andre har ikke brug
// for at vide, hvor langt hun er. Derfor ligger afkrydsningen lokalt, i den
// samme indstillingstabel som resten af enhedens egne valg — og derfor kræver
// den hverken en ny samling eller et felt i PocketBase.
//
// Nøglen er turens delingstoken. To delte ture på den samme telefon skal have
// hver sin liste.

export function noegleFor(token: string): string {
  return `pakket:${token}`;
}

// En linje kan komme to steder fra: ejerens grej, som har et uid, og en
// deltagers eget, som ikke findes i nogen base og kun er et navn og en vægt.
// Nøglen skal virke for begge, og den skal blive ved med at pege på det samme,
// når listen bliver bygget igen.
export function linjenoegle(linje: Pakkelinje): string {
  return linje.uid || `fri:${linje.navn}:${linje.vaegt_g}`;
}

export function laesPakkede(tekst: string | null): Set<string> {
  if (!tekst) return new Set();

  try {
    const raa = JSON.parse(tekst);
    return new Set(Array.isArray(raa) ? raa.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

export function veksl(pakkede: Set<string>, noegle: string): string[] {
  const naeste = new Set(pakkede);
  if (naeste.has(noegle)) naeste.delete(noegle); else naeste.add(noegle);
  return [...naeste];
}

export function gemPakkede(token: string, noegler: string[]): Promise<void> {
  return saet(noegleFor(token), JSON.stringify(noegler));
}

export function hentPakkede(token: string): Promise<string | null> {
  return laes(noegleFor(token));
}

export interface Gaestefremdrift {
  pakket: number;
  ialt: number;
  // 0–100, rundet ned. 100 kun når alt er pakket — "100 %" med noget uden for
  // tasken er en løgn, man opdager i skoven.
  procent: number;
  faerdig: boolean;
}

// Fremdriften måles mod de linjer, listen har *nu*. Krydser man noget af og
// henter så ejerens nyeste, hvor det er væk, bliver nøglen stående — men den
// tælles ikke med, så tallet kan aldrig blive større end det, det måles imod.
export function fremdrift(pakkede: Set<string>, linjer: Pakkelinje[]): Gaestefremdrift {
  const ialt = linjer.length;
  const pakket = linjer.filter((l) => pakkede.has(linjenoegle(l))).length;

  return {
    pakket,
    ialt,
    procent: ialt === 0 ? 0 : Math.floor((pakket / ialt) * 100),
    // En tom pakkeliste er ikke færdigpakket — der er ingenting at pakke.
    faerdig: ialt > 0 && pakket === ialt
  };
}

export function fremdriftstekst(f: Gaestefremdrift): string {
  if (f.ialt === 0) return 'Der er ikke valgt gear endnu';
  if (f.faerdig) return 'Alt er pakket';
  return `${f.pakket} af ${f.ialt} pakket`;
}

// Gæstens egen bunke.
//
// Pakkelisten skal svare på ét spørgsmål: hvad skal *jeg* have i tasken. Hele
// turens grej er en anden liste — den hører til under Deltagere, hvor man kan
// se, hvordan byrden ligger.
//
// Tre ting er ens egne, og de kommer tre steder fra:
//
// Det man selv har skrevet, man tager med. Det står på ens egen række.
//
// Det fælles, man selv har meldt sig til at bære. Også ens egen række.
//
// Og det, ejeren har fordelt til én — enten i hånden eller ved at tage imod
// motorens forslag. Det står i snapshottet som et navn på gearet, for det er
// alt, en gæst får at vide om de andres fordeling.
//
// Navnematchet er skrøbeligt, og det er med vilje synligt her: snapshottet
// bærer navne og ikke id'er, fordi en gæst ikke skal kunne se ejerens
// deltager-id'er. Hedder man noget andet på turen, end man hedder på sin
// konto, får man ikke sit gear at se — og så er det navnet, der skal rettes.
export function mineLinjer(linjer: Pakkelinje[], mitNavn: string): Pakkelinje[] {
  const mig = mitNavn.trim().toLowerCase();
  if (!mig) return [];

  return linjer.filter((l) =>
    l.baerer.split(' og ').some((navn) => navn.trim().toLowerCase() === mig));
}

// Alle linjer krydset af, eller listen tømt. Samme to knapper som ejeren har.
export function alle(linjer: Pakkelinje[]): string[] {
  return linjer.map(linjenoegle);
}
