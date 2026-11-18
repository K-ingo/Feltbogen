// Ét netkald med en øvre grænse for, hvor længe det må tage.
//
// En browser giver ikke selv op. Et kald ud i et mobilnet med én streg står
// og venter i minutter, og så længe står knappen og siger "Tjekker…" eller
// "Synkroniserer…" uden at noget sker. Det er værre end en fejl: man ved ikke,
// om man skal vente eller gå.
//
// Derfor går alle appens netkald gennem `hentMedTimeout` — de rå fetch-kald og
// PocketBase-klientens (via `pb.beforeSend` i pb.ts). Tager et kald for lang
// tid, afbrydes det med en AbortController og kaster `TimeoutFejl`, der har
// en dansk besked, man kan sætte direkte på skærmen.
//
// Svaret tæller som kommet, når headerne er der. Selve kroppen læses bagefter
// af kalderen; den tid er ikke med, fordi timeren er ryddet til den tid.

// Almindelige kald: et opslag, en post, et helbredstjek. 15 sekunder er længe
// nok til et langsomt mobilnet og kort nok til, at man ikke tror, appen er
// gået i stå.
export const TIMEOUT_MS = 15_000;

// Kald der sender eller henter en fil. Et billede med original er flere
// megabyte, og op gennem et mobilnet i skoven tager det sin tid — det skal
// ikke afbrydes, fordi det er langsomt, kun fordi det er gået i stå.
export const TIMEOUT_FIL_MS = 120_000;

export class TimeoutFejl extends Error {
  readonly ms: number;

  constructor(ms: number) {
    super(timeouttekst(ms));
    this.name = 'TimeoutFejl';
    this.ms = ms;
    Object.setPrototypeOf(this, TimeoutFejl.prototype);
  }
}

// "Serveren svarede ikke inden for 15 sekunder. …"
export function timeouttekst(ms: number): string {
  const sek = Math.max(1, Math.round(ms / 1000));
  return `Serveren svarede ikke inden for ${sek} sekunder. Tjek din forbindelse og prøv igen.`;
}

// Om fejlen er en timeout — også når PocketBase-klienten har pakket den ind.
// Klienten lægger den oprindelige fejl i `originalError`.
export function erTimeout(e: unknown): boolean {
  if (e instanceof TimeoutFejl) return true;
  if (!e || typeof e !== 'object') return false;

  const indpakket = (e as { originalError?: unknown }).originalError;
  return indpakket instanceof TimeoutFejl
    || (!!indpakket && typeof indpakket === 'object' && (indpakket as { name?: unknown }).name === 'TimeoutFejl');
}

// Fejlen som en sætning, en bruger kan læse. Rå fejltekster fra browseren
// ("Failed to fetch", "NetworkError when attempting to fetch resource") er
// engelske og siger ikke, hvad man skal gøre.
export function netfejltekst(e: unknown): string {
  if (erTimeout(e)) {
    const ms = e instanceof TimeoutFejl
      ? e.ms
      : ((e as { originalError?: { ms?: number } }).originalError?.ms ?? TIMEOUT_MS);
    return timeouttekst(ms);
  }
  return 'Kunne ikke nå serveren. Tjek din forbindelse og prøv igen.';
}

// Hvor længe et kald må tage, ud fra hvad det sender. En FormData eller en
// Blob er en fil på vej op.
export function timeoutFor(init?: RequestInit): number {
  const krop = init?.body;
  if (typeof FormData !== 'undefined' && krop instanceof FormData) return TIMEOUT_FIL_MS;
  if (typeof Blob !== 'undefined' && krop instanceof Blob) return TIMEOUT_FIL_MS;
  return TIMEOUT_MS;
}

// fetch med timeout. Samme signatur som fetch, plus grænsen.
//
// Har kalderen selv et signal med — PocketBase-klienten kan have det — bliver
// det respekteret: afbryder kalderen, afbrydes kaldet, og fejlen er kalderens
// egen AbortError, ikke en timeout.
//
// `hent` er selve fetch-funktionen. Den kan sættes, så en test kan give en
// attrap ind uden at erstatte den globale.
export async function hentMedTimeout(
  adresse: RequestInfo | URL,
  init: RequestInit = {},
  ms: number = timeoutFor(init),
  hent: typeof fetch = (a, i) => fetch(a, i)
): Promise<Response> {
  const kontrol = new AbortController();
  let udloebet = false;

  const timer = setTimeout(() => {
    udloebet = true;
    kontrol.abort();
  }, ms);

  const ydre = init.signal;
  const afbrydUdefra = () => kontrol.abort();
  if (ydre) {
    if (ydre.aborted) kontrol.abort();
    else ydre.addEventListener('abort', afbrydUdefra, { once: true });
  }

  try {
    return await hent(adresse, { ...init, signal: kontrol.signal });
  } catch (e) {
    if (udloebet) throw new TimeoutFejl(ms);
    throw e;
  } finally {
    clearTimeout(timer);
    ydre?.removeEventListener('abort', afbrydUdefra);
  }
}
