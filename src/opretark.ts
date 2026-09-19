import type { Deltager, Item, ItemStatus, Tur } from './db';

// Felterne i opret-arkene, og reglerne for hvornår de er nok til at oprette
// noget.
//
// Arket var svaret på en rigtig fejl. Før lå oprettelsen i `opret.ts`: et tryk
// på "Ny tur" skrev med det samme en navnløs tur i basen og åbnede den.
// Fortrød man ved at gå tilbage, blev den ryddet op igen — men fortrød man ved
// at lukke fanen, nåede den op på serveren og blev stående som "Din næste tur"
// på alle ens enheder. Designsystemet forbyder derfor at der oprettes noget,
// før man trykker Opret.
//
// Logikken ligger her og ikke i arket, fordi et regnestykke skal kunne prøves
// uden en browser. Arket samler tekst ind; det her laver den om til en post.

const DAG_MS = 86400000;

export interface NyTurFelter {
  titel: string;
  fra: string;
  til: string;
  sted: string;
  deltagere: string;
}

export interface NytGrejFelter {
  navn: string;
  status: ItemStatus;
  vaegt: string;
  pris: string;
  antal: string;
}

export function tommeTurfelter(idag: string): NyTurFelter {
  return { titel: '', fra: idag, til: idag, sted: '', deltagere: '' };
}

export function tommeGrejfelter(status: ItemStatus = 'ejer'): NytGrejFelter {
  return { navn: '', status, vaegt: '', pris: '', antal: '1' };
}

// Kun titlen afgør, om der kan oprettes. Resten må gerne være tomt — en tur
// uden sted er en tur man ikke har besluttet sig om endnu, og det skal man
// kunne skrive ned. Det er også derfor arket ikke spørger om andet end det,
// der skal til for at posten kan findes igen.
export function turKanOprettes(felter: NyTurFelter): boolean {
  return felter.titel.trim().length > 0;
}

export function grejKanOprettes(felter: NytGrejFelter): boolean {
  return felter.navn.trim().length > 0;
}

// Nætter mellem to datoer. Samme regnestykke som `antalDage` i turdag.ts, den
// anden vej: tre dage er to nætter.
//
// Er datoerne tomme, byttet om eller vrøvl, er svaret 0. En negativ tur findes
// ikke, og et gæt ville være værre end ingenting — man kan rette tallet inde
// på turen bagefter.
export function naetterMellem(fra: string, til: string): number {
  if (!fra || !til) return 0;

  const start = new Date(fra);
  const slut = new Date(til);
  if (Number.isNaN(start.getTime()) || Number.isNaN(slut.getTime())) return 0;

  return Math.max(0, Math.round((slut.getTime() - start.getTime()) / DAG_MS));
}

// Navne skrevet med komma imellem. Tomme led falder fra, så "Emil, , Zindy"
// bliver to personer og ikke tre — man kommer til at taste et komma for meget.
export function deltagernavne(tekst: string): string[] {
  return tekst.split(',').map((n) => n.trim()).filter(Boolean);
}

function somDeltager(navn: string): Deltager {
  return {
    id: crypto.randomUUID(),
    navn,
    overnatning: null,
    personligt_gear_ids: [],
    baerer_delt_ids: [],
    // Fritekst er nok til at komme i gang. Koblingen til person-tabellen
    // laves inde på turen, når man vil have den.
    person_uid: ''
  };
}

// Et tal skrevet i hånden. Tomt felt betyder standardværdien og ikke nul —
// "Antal" står med 1 i forvejen, og sletter man det, mente man ikke 0 stk.
//
// Komma som decimaltegn accepteres. Man skriver 1,5 på dansk, og et felt, der
// tier om det, ser ud som om det ikke virker.
export function tal(tekst: string, standard = 0): number {
  const renset = tekst.trim().replace(',', '.');
  if (!renset) return standard;

  const n = Number(renset);
  return Number.isFinite(n) && n >= 0 ? n : standard;
}

// Felterne oven på en tom tur. Kun det arket har spurgt om — resten kommer fra
// `opretTomTur`, så en tur ser ens ud, uanset hvor den blev startet.
export function turFraArk(felter: NyTurFelter, mitNavn: string): Partial<Tur> {
  const navne = deltagernavne(felter.deltagere);

  return {
    navn: felter.titel.trim(),
    sted: felter.sted.trim(),
    startdato: felter.fra,
    slutdato: felter.til,
    naetter: naetterMellem(felter.fra, felter.til),
    // Den der opretter turen står på den i forvejen. Skrev man andre ind i
    // arket, kommer de efter — og så er personantallet summen af dem alle.
    deltagere: [somDeltager(mitNavn), ...navne.map(somDeltager)],
    personer: 1 + navne.length
  };
}

export function grejFraArk(felter: NytGrejFelter): Partial<Item> {
  return {
    navn: felter.navn.trim(),
    status: felter.status,
    vaegt_g: Math.round(tal(felter.vaegt)),
    pris_kr: tal(felter.pris),
    antal: Math.max(1, Math.round(tal(felter.antal, 1)))
  };
}
