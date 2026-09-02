import { useLiveQuery } from 'dexie-react-hooks';
import { saet, laes } from './indstillinger';

// Hvorfor sync ikke virker.
//
// Baggrundssynkroniseringen fangede sine fejl og skrev dem i konsollen. Det er
// nok for den, der har udviklerværktøjet åbent, og ingenting for alle andre:
// statuslinjen kunne stå og sige "3 ændringer på vej op" i ugevis, uden at
// nogen af dem nogensinde kom op. En fejl, appen tier om, er værre end en
// fejl — for man opdager den først, når man står og mangler dataene.
//
// Derfor huskes den seneste fejl, og den bliver vist.
//
// Tre ting holder den fast på:
//
// Det er ikke en log. Der gemmes én fejl — den seneste — og ikke en liste.
// En liste ville skulle vedligeholdes og ryddes, og ingen læser den.
//
// Den ryddes af, at det lykkes, og ikke af tiden. Går forbindelsen ned og kommer
// igen, skal beskeden væk, fordi der blev sendt — ikke fordi der er gået en
// time. "Det lykkedes" er en hel kørsel og ikke en enkelt post: en sync rører
// mange poster, og at én af dem gik igennem siger ingenting om de andre. Se
// `koersel` i sync.ts.
//
// Og den ligger på enheden. Om *denne* telefon kunne nå serveren er ikke data
// om turene, og det skal ikke synkroniseres — allerede fordi det er
// synkroniseringen selv, der er i stykker.

// Arterne følger, hvad man skal gøre ved dem, og ikke HTTP-koderne. To fejl
// med hver sin kode, der kræver det samme af den, der står med telefonen, er
// den samme fejl her.
export type Fejlart =
  // Serveren blev aldrig nået. PocketBase-klienten pakker en fejlet fetch ind
  // som status 0.
  | 'ingen_forbindelse'
  // Sessionen er ikke gyldig længere.
  | 'ikke_logget_ind'
  // Serveren svarede og sagde nej til dataene. Det er den farlige: se
  // POCKETBASE.md — et felt, samlingen ikke har, forsvinder lydløst, mens en
  // regel, der ikke passer, giver et rungende afslag.
  | 'afvist'
  // Det, appen spurgte efter, er der ikke. En 404 er ikke et afslag på
  // dataene, og rådet om at kigge i skemaet passede ikke på den: er det en
  // post, er den slettet deroppe, og er det en hel samling, findes den ikke.
  | 'findes_ikke'
  | 'server'
  | 'ukendt';

export interface Syncfejl {
  art: Fejlart;
  // Serverens egen tekst, hvis den sagde noget. Den er engelsk, men den er
  // præcis — og den er det eneste, der kan skelne to afviste felter fra
  // hinanden.
  //
  // Kun `response.message` tæller. PocketBase-klienten sætter selv en
  // `message` på fejlen, når svaret ikke havde nogen — "Something went wrong."
  // — og den er klientens ord, ikke serverens. Skærmen skrev den ud som
  // "Serveren sagde: Something went wrong." om en server, der aldrig svarede.
  detalje: string;
  // Hvad appen var i gang med, da det gik galt — fx `items · oprettelse af
  // "Toaks 1L gryde"`. Arten siger hvad slags fejl det var, og serverens
  // besked siger hvad den hedder på engelsk; ingen af dem siger hvilken post
  // eller hvilken samling. Uden det er en afvisning ikke til at gå efter: man
  // ved at *noget* blev afvist, og skal så gætte hvad.
  hvor?: string;
  // De felter serveren pegede på, når den gjorde det. PocketBase lægger dem i
  // svarets `data` og ikke i `message` — en afvist post svarer "Failed to
  // create record." med det egentlige svar, feltet og hvorfor, et andet sted i
  // kroppen. Det er den ene oplysning, der peger direkte på skemaet.
  felter?: string;
  // ISO. Bruges til at sige hvornår det gik galt, ikke til at rydde op efter.
  hvornaar: string;
}

interface PbFejl {
  status?: number;
  response?: {
    message?: string;
    data?: Record<string, { code?: string; message?: string }>;
  };
}

// Felterne serveren afviste, som én linje: `uid: Unknown field.`
//
// Kun feltnavnet og beskeden. Koden bag ("validation_unknown_field") siger det
// samme en gang til, på maskinsprog, og linjen skal kunne læses af den, der
// står med telefonen og skal rette et skema.
export function felterAf(e: unknown): string {
  const data = ((e ?? {}) as PbFejl).response?.data;
  if (!data) return '';

  return Object.entries(data)
    .map(([felt, detalje]) => {
      const besked = detalje?.message ?? detalje?.code ?? '';
      return besked ? `${felt}: ${besked}` : felt;
    })
    .join(' · ');
}

export function fejlartAf(e: unknown): Fejlart {
  const fejl = (e ?? {}) as PbFejl;
  const status = fejl.status;

  if (status === 0 || status === undefined) return 'ingen_forbindelse';
  if (status === 401 || status === 403) return 'ikke_logget_ind';
  if (status >= 500) return 'server';
  if (status === 404) return 'findes_ikke';
  if (status >= 400) return 'afvist';
  return 'ukendt';
}

// Hvad der står på skærmen. Første sætning siger, hvad der skete; anden siger,
// hvad man kan gøre. Uden den anden er beskeden bare en anklage.
export const FEJLTEKST: Record<Fejlart, string> = {
  ingen_forbindelse: 'Kunne ikke nå serveren. Dine ting står sikkert på enheden og bliver sendt, så snart den svarer igen.',
  ikke_logget_ind: 'Din session er udløbet. Log ind igen, så kommer det op.',
  afvist: 'Serveren afviste dataene. Det plejer at betyde, at et felt mangler i PocketBase-skemaet — se POCKETBASE.md.',
  findes_ikke: 'Det, appen spurgte efter, findes ikke på serveren. Er det en post, er den slettet deroppe, og så opretter appen den på ny næste gang, den sender. Er det en hel samling, mangler den i PocketBase — se POCKETBASE.md.',
  server: 'Serveren har problemer lige nu. Appen prøver igen af sig selv.',
  ukendt: 'Noget gik galt undervejs op. Dine ting står stadig på enheden.'
};

// Teksten på skærmen.
//
// `ingen_forbindelse` betyder to forskellige ting, og de kræver hver sit: enten
// er man selv uden dækning, eller også svarer serveren ikke. Browseren ved
// hvilken, og forskellen er hele forskellen på "vent" og "der er noget galt med
// serveren".
export function fejltekst(art: Fejlart, online: boolean = true): string {
  if (art === 'ingen_forbindelse' && online) {
    return 'Serveren svarede ikke. Din enhed er på nettet, så det er serveren, der ikke er oppe — eller også afviser den kald fra appens adresse. '
      + 'Dine ting står sikkert på enheden og bliver sendt, så snart den svarer igen.';
  }
  return FEJLTEKST[art];
}

// Kun den ene art kan brugeren selv gøre noget ved med det samme.
export function kraeverLogin(fejl: Syncfejl | null): boolean {
  return fejl?.art === 'ikke_logget_ind';
}

export const SYNCFEJL_NOEGLE = 'seneste_syncfejl';

export async function noterFejl(e: unknown, hvor = '', nu: Date = new Date()): Promise<void> {
  const fejl = (e ?? {}) as PbFejl;
  const felter = felterAf(e);

  const noteret: Syncfejl = {
    art: fejlartAf(e),
    detalje: fejl.response?.message ?? '',
    hvornaar: nu.toISOString()
  };
  // Tomme felter skrives ikke. Beskeden ligger som JSON på enheden og kan være
  // skrevet af en ældre udgave af appen; jo færre nøgler, jo færre måder den
  // kan komme til at love noget, den ikke har.
  if (hvor) noteret.hvor = hvor;
  if (felter) noteret.felter = felter;

  await saet(SYNCFEJL_NOEGLE, JSON.stringify(noteret));
}

// Ryddes når noget lykkes. Skrivningen springes over, når der ikke stod
// noget — ellers ville hver eneste vellykkede sync skrive til basen og få alle
// skærme, der lytter, til at tegne om.
export async function rydFejl(): Promise<void> {
  if ((await laes(SYNCFEJL_NOEGLE)) === null) return;
  await saet(SYNCFEJL_NOEGLE, '');
}

// Teksten kan komme fra en ældre udgave af appen. En fejlbesked, der selv går
// i stykker, er en dårlig fejlbesked.
export function laesSyncfejl(tekst: string | null): Syncfejl | null {
  if (!tekst) return null;

  let raa: unknown;
  try {
    raa = JSON.parse(tekst);
  } catch {
    return null;
  }
  if (typeof raa !== 'object' || raa === null) return null;

  const o = raa as Record<string, unknown>;
  const art = o.art;
  if (typeof art !== 'string' || !(art in FEJLTEKST)) return null;

  const fejl: Syncfejl = {
    art: art as Fejlart,
    detalje: typeof o.detalje === 'string' ? o.detalje : '',
    hvornaar: typeof o.hvornaar === 'string' ? o.hvornaar : ''
  };
  if (typeof o.hvor === 'string' && o.hvor) fejl.hvor = o.hvor;
  if (typeof o.felter === 'string' && o.felter) fejl.felter = o.felter;
  return fejl;
}

// Den gemte fejl, læst her og nu.
//
// Skærmen har den allerede gennem `useSyncfejl`, men den værdi er den, der
// gjaldt da skærmen sidst blev tegnet. Skal man svare på, hvordan det gik med
// en kørsel, man selv lige har sat i gang, skal fejlen læses efter kørslen og
// ikke før — ellers svarer man på det forrige forsøg.
export async function laesSeneste(): Promise<Syncfejl | null> {
  return laesSyncfejl(await laes(SYNCFEJL_NOEGLE));
}

// Kvitteringen på et tryk på "Synkronisér nu".
//
// Den stod før på ét tal: var der ingenting tilbage i køen, sagde den "Alt er
// synkroniseret." Men køen er kun det, der skal *op*. Har man ingen lokale
// ændringer, er den tom, uanset hvordan det gik med at hente ned — og så stod
// den grønne kvittering og den orange advarsel side om side og sagde hver
// sit om det samme tryk.
//
// Reglen er den samme som `syncstatus` i dashboard.ts allerede følger: fejlen
// går forud for optællingen. Forskellen på de to er, at statuslinjen
// beskriver en tilstand, mens den her svarer på noget, man selv bad om — og
// derfor tæller offline også som "det kom ikke igennem". At svare "Alt er
// synkroniseret." på et tryk, hvor intet nåede frem, er forkert, uanset hvor
// god grunden er.
//
// Årsagen står ikke her. Den står i advarslen lige under, som kender både
// arten og om enheden er på nettet — se `fejltekst`. To beskeder om det
// samme, hvor den ene gætter, er en for meget.
export function synckvittering(
  usendt: number,
  fejl: Syncfejl | null
): { slags: 'ok' | 'fejl'; tekst: string } {
  if (usendt > 0) {
    return {
      slags: 'fejl',
      tekst: `${usendt} ${usendt === 1 ? 'ændring ligger' : 'ændringer ligger'} stadig og venter.`
    };
  }

  if (fejl) {
    return { slags: 'fejl', tekst: 'Intet venter på at blive sendt, men appen nåede ikke serveren.' };
  }

  return { slags: 'ok', tekst: 'Alt er synkroniseret.' };
}

export function useSyncfejl(): Syncfejl | null {
  return laesSyncfejl(useLiveQuery(() => laes(SYNCFEJL_NOEGLE)) ?? null);
}
