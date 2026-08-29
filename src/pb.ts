import PocketBase from 'pocketbase';
import { noterFejl, rydFejl } from './syncfejl';

// Overstyres med VITE_PB_URL i .env — fallback er den nuværende Railway-instans,
// så appen virker uden opsætning indtil vi flytter til egen server.
const PB_URL = import.meta.env.VITE_PB_URL ?? 'https://pocketbase-production-6188.up.railway.app';

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
  return PB_URL;
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
    await noterFejl(e);
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
