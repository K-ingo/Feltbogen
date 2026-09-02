import PocketBase from 'pocketbase';
import { noterFejl, rydFejl } from './syncfejl';

// Appen taler med sit eget domæne. Caddy tager /api/ og sender det videre til
// PocketBase over Railways private netværk, så PocketBase ikke behøver en
// offentlig adresse — se Caddyfile.
//
// En relativ adresse er ikke det samme som ingen adresse: PocketBase-klienten
// sætter `window.location.origin` foran, når basen ikke starter med http.
// Url'er ud af SDK'en — også dem til billedfiler — bliver altså stadig
// absolutte. Det er en forudsætning ét sted til: filteret i gaest.ts, der kun
// lukker http(s) igennem fra et delt snapshot, ville ellers kaste alle
// billeder væk.
//
// VITE_PB_URL overstyrer stadig, og skal pege på en server med adresse og det
// hele. Den bages ind i bundlen ved build — så et privat .railway.internal-
// domæne hører ikke hjemme her: det findes kun inde i Railway, og appen kører
// i en browser ude i skoven.
const PB_URL = import.meta.env.VITE_PB_URL ?? '/';

export const pb = new PocketBase(PB_URL);

pb.autoCancellation(false);

export interface Bruger {
  id: string;
  email: string;
  name?: string;
  created: string;
  updated: string;
}

// Hvilken server appen faktisk taler med. Den er sat af `VITE_PB_URL` ved
// build, og en forkert værdi er ikke til at se på nogen anden måde: appen
// opfører sig ens, den bliver bare ved med at ringe til den forkerte adresse.
// Derfor står den på indstillingsskærmen.
export function serveradresse(): string {
  if (/^https?:\/\//i.test(PB_URL)) return PB_URL;

  // Relativ adresse: appen og PocketBase deler domæne. Origin alene ville
  // ikke sige om kaldene går gennem proxyen eller direkte til en server et
  // andet sted — og det er præcis det, rækken er sat op for at vise.
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  const base = `${origin}${PB_URL === '/' ? '' : PB_URL}`;
  return base ? `${base} (samme domæne som appen)` : 'samme domæne som appen';
}

// ─────────────────────────────────────────────
// Tjek af forbindelsen
//
// Sync fortæller kun noget, når der er noget at sende. Er køen tom, og virker
// det alligevel ikke, står man med en app, der ikke siger noget, og en server,
// man ikke kan se. Det her spørger PocketBase direkte, om den er der, og
// oversætter svaret — også de svar, der ligner et svar uden at være det.
//
// Formen på fejlene er kendt på forhånd, fordi de følger af opsætningen:
// proxyen sender /api/ videre (Caddyfile), og gør den ikke det, svarer
// adressen med appens egen index.html — 200 OK på noget, der ikke er
// PocketBase. Det er den fejl, der ellers er sværest at få øje på.
// ─────────────────────────────────────────────

export interface Forbindelsestjek {
  ok: boolean;
  tekst: string;
}

// Adressen helbredstjekket går til. Bygges af den samme base som alle andre
// kald, så tjekket ikke kan komme til at svare for en anden server end den,
// appen bruger.
export function helbredsadresse(): string {
  const base = /^https?:\/\//i.test(PB_URL)
    ? PB_URL
    : `${typeof window === 'undefined' ? '' : window.location.origin}${PB_URL}`;
  return `${base.replace(/\/+$/, '')}/api/health`;
}

// Svaret, oversat. Ligger for sig selv, fordi det er her, det er værd at være
// præcis: de tre-fire måder opsætningen kan være gal på, giver hver sit svar,
// og de skal kunne kendes fra hinanden uden en netværksfane.
export function laesHelbred(status: number, indholdstype: string, krop: string): Forbindelsestjek {
  const erJson = indholdstype.includes('json') || krop.trimStart().startsWith('{');

  if (status >= 200 && status < 300) {
    if (erJson) return { ok: true, tekst: 'PocketBase svarer. Forbindelsen er i orden.' };

    // 200 OK, og alligevel forkert: proxyen sendte ikke /api/ videre, så
    // adressen svarede med appens egen side. Alle kald får HTML tilbage, hvor
    // de venter JSON.
    return {
      ok: false,
      tekst: 'Adressen svarede, men med appens egen side i stedet for PocketBase. '
        + 'Kaldene til /api/ bliver ikke sendt videre — se handle /api/* i Caddyfile, '
        + 'eller PB_PROXY_TARGET hvis det er npm run dev.'
    };
  }

  if (status === 404) {
    return {
      ok: false,
      tekst: 'Serveren svarede 404 på /api/health. Der er ikke nogen PocketBase på adressen — '
        + 'enten peger proxyen et forkert sted hen, eller også er VITE_PB_URL sat til noget andet.'
    };
  }

  if (status === 502 || status === 503 || status === 504) {
    return {
      ok: false,
      tekst: `Proxyen svarede ${status}. Den blev nået, men den kunne ikke nå PocketBase — `
        + 'tjek POCKETBASE_ORIGIN og porten, PocketBase faktisk lytter på (se Caddyfile).'
    };
  }

  if (status === 401 || status === 403) {
    return { ok: false, tekst: `Serveren svarede ${status} på et kald, der ikke kræver login. Den afviser appen.` };
  }

  return { ok: false, tekst: `Serveren svarede ${status}.` };
}

export async function tjekForbindelse(): Promise<Forbindelsestjek> {
  const adresse = helbredsadresse();

  try {
    const svar = await fetch(adresse, { cache: 'no-store' });
    return laesHelbred(svar.status, svar.headers.get('content-type') ?? '', await svar.text());
  } catch {
    // Der kom aldrig et svar. Browseren siger ikke hvorfor — en server, der er
    // nede, og en, der afviser appens adresse, ser ens ud herfra — så begge
    // muligheder skal stå der.
    return {
      ok: false,
      tekst: `Kunne ikke nå ${adresse} overhovedet. Enten er du uden forbindelse, `
        + 'eller også er serveren nede eller afviser kald fra appens adresse.'
    };
  }
}

export function erLoggetInd(): boolean {
  return pb.authStore.isValid;
}

// En udløbet session er ikke en session. `authStore.record` bliver liggende i
// localStorage når tokenet udløber, og spurgte man kun til den, troede appen
// den var logget ind: sync sendte af sted med et dødt token, PocketBase så et
// uautentificeret kald, og `createRule` afviste det med 400 og tom `data` —
// altså en tavs fejl der gentog sig i det uendelige. `isValid` tjekker
// udløbstiden, og det er den der afgør om der er en bruger.
export function nuvaerendeBruger(): Bruger | null {
  const model = pb.authStore.isValid ? pb.authStore.record : null;
  if (!model) return null;
  return {
    id: model.id,
    email: model.email,
    name: model.name,
    created: model.created,
    updated: model.updated
  };
}

export async function opretKonto(email: string, password: string): Promise<Bruger> {
  const data = {
    email,
    password,
    passwordConfirm: password,
    emailVisibility: false
  };
  await pb.collection('users').create(data);
  await pb.collection('users').authWithPassword(email, password);
  const bruger = nuvaerendeBruger();
  if (!bruger) throw new Error('Kunne ikke logge ind efter oprettelse');
  return bruger;
}

export async function logInd(email: string, password: string): Promise<Bruger> {
  await pb.collection('users').authWithPassword(email, password);
  const bruger = nuvaerendeBruger();
  if (!bruger) throw new Error('Kunne ikke logge ind');
  return bruger;
}

export function logUd(): void {
  pb.authStore.clear();
  // En fejl fra den forrige session skal ikke blive stående og bede en, der
  // selv har logget ud, om at logge ind igen.
  void rydFejl();
}

// Forlænger sessionen ved opstart og når forbindelsen kommer tilbage.
//
// Tokenet har en udløbstid, og uden det her ville en app man åbner hver anden
// uge logge sig selv ud med jævne mellemrum. Værre: udløbet sker på uret, så
// ingen `onChange` fortæller appen det — den ville blive stående som "logget
// ind" mens hver skrivning blev afvist.
//
// Afviser serveren tokenet — skiftet kodeord, slettet konto — ryddes det, og
// så beder appen om login. En netværksfejl rører det derimod ikke: står man
// uden dækning, skal man blive logget ind.
export async function fornyLogin(): Promise<void> {
  if (!pb.authStore.isValid) return;

  try {
    await pb.collection('users').authRefresh();
    return;
  } catch (e) {
    const status = (e as { status?: number })?.status;
    // En netværksfejl rører ikke sessionen: står man uden dækning, skal man
    // blive logget ind.
    if (status !== 401 && status !== 403) return;

    // Serveren afviste tokenet. Sessionen ryddes — og det skal noteres, før
    // den er væk: bagefter står appen som "uden konto", og så ville det se ud
    // som om man aldrig havde været logget ind. Det var netop det, der gjorde
    // en udløbet session tavs: alt holdt op med at komme op, og skærmen sagde
    // "Gemt på denne enhed". Se syncfejl.ts.
    await noterFejl(e, 'fornyelse af login');
    pb.authStore.clear();
  }
}
// Navnet man optræder med for de andre på en delt tur. E-mailen er ikke et
// navn — og den skal heller ikke stå på en fælles pakkeliste.
export async function gemNavn(navn: string): Promise<void> {
  const bruger = nuvaerendeBruger();
  if (!bruger) return;
  await pb.collection('users').update(bruger.id, { name: navn.trim() });
}

// Navnet, eller tom hvis man ikke har sat et. Kalderen bestemmer hvad der
// så skal stå — "En deltager" hører til på turen, ikke her.
export function mitNavn(): string {
  return nuvaerendeBruger()?.name?.trim() ?? '';
}
