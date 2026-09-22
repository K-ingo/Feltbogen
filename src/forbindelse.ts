import { useEffect, useState } from 'react';

// Om appen faktisk kan nå ud — ikke kun om der er et netværk.
//
// `navigator.onLine` er for svag til en offline-advarsel. Falsk betyder helt
// sikkert ingen forbindelse, men sandt betyder kun, at der er *et* netværk:
// på et wifi uden internet, bag en portal, eller når forespørgsler blokeres,
// bliver den ved med at sige sandt. Pakning på telefonen sagde derfor "også
// uden net" om en telefon, der var uden net (Reed-test på PR #80).
//
// Derfor spørges der også: et lille HEAD-kald til appens egen oprindelse.
// Svarer den overhovedet — også med en fejlkode — er der hul igennem. Kommer
// der intet svar inden for fristen, er man offline.
//
// Adressen har en parameter, som service workerens precache ikke genkender,
// så svaret kan ikke komme fra cachen og lade som om, der er net.

export const PROEVEADRESSE = '/favicon.svg';
export const FRIST_MS = 5000;

export async function kanNaaUd(
  hent: typeof fetch = fetch,
  online: boolean = navigator.onLine,
  fristMs: number = FRIST_MS
): Promise<boolean> {
  // Browseren ved det allerede. Intet kald, intet at vente på.
  if (!online) return false;

  const afbryd = new AbortController();
  const ur = setTimeout(() => afbryd.abort(), fristMs);
  try {
    await hent(`${PROEVEADRESSE}?forbindelse=${Date.now()}`, {
      method: 'HEAD',
      cache: 'no-store',
      signal: afbryd.signal
    });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(ur);
  }
}

// Hvor tit der spørges igen, mens skærmen står fremme. Et kald hvert tiende
// sekund er et par hundrede bytes — og uden det opdager linjen ikke, at nettet
// forsvandt uden at browseren sagde det.
export const SPOERG_HVERT_MS = 10_000;

// Hooken til skærmen. Starter på browserens bud, så første billede ikke står og
// venter, og retter sig, når svaret kommer.
export function useKanNaaUd(): boolean {
  const [forbundet, setForbundet] = useState(() => navigator.onLine);

  useEffect(() => {
    let aktiv = true;
    // Kun det seneste svar tæller. Et langsomt kald, der kommer tilbage efter
    // et hurtigere, må ikke skrive et gammelt svar oven i et nyt.
    let nummer = 0;

    const spoerg = async () => {
      const mit = ++nummer;
      const svar = await kanNaaUd();
      if (aktiv && mit === nummer) setForbundet(svar);
    };

    // Går browseren offline, er det sandt med det samme — det venter ikke på
    // et kald.
    const naarOffline = () => { nummer++; setForbundet(false); };
    const naarOnline = () => void spoerg();
    const naarSynlig = () => { if (document.visibilityState === 'visible') void spoerg(); };

    void spoerg();
    const ur = setInterval(() => void spoerg(), SPOERG_HVERT_MS);
    window.addEventListener('offline', naarOffline);
    window.addEventListener('online', naarOnline);
    document.addEventListener('visibilitychange', naarSynlig);

    return () => {
      aktiv = false;
      clearInterval(ur);
      window.removeEventListener('offline', naarOffline);
      window.removeEventListener('online', naarOnline);
      document.removeEventListener('visibilitychange', naarSynlig);
    };
  }, []);

  return forbundet;
}
