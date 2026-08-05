import { registerSW } from 'virtual:pwa-register';

// Appen ligger i cache, så den kan startes offline. Prisen er at en ny udgave
// ikke slår igennem med det samme: browseren kører videre på det den har,
// henter den nye service worker i baggrunden, og skifter først ved en senere
// indlæsning.
//
// Det er som regel i orden — men når man lige har rettet noget og vil se det,
// er det ikke til at skelne fra at rettelsen aldrig kom med. Derfor kan man
// spørge efter den nyeste med vilje.

let hentNyeste: ((genindlaes?: boolean) => Promise<void>) | null = null;
let registrering: ServiceWorkerRegistration | undefined;

export function startOpdateringer(): void {
  hentNyeste = registerSW({
    immediate: true,
    onRegisteredSW: (_url, r) => { registrering = r; }
  });
}

// Spørger serveren om der er en nyere udgave, og går over på den.
//
// Genindlæsningen sker uanset hvad. Er der ikke noget nyt, koster det et
// øjeblik; er der, er det hele pointen — og et svar der siger "nej, du har
// den nyeste" ville alligevel ikke være til at stole på, når det er cachen
// selv man er i tvivl om.
export async function hentNyesteUdgave(): Promise<void> {
  // update() henter service worker-filen forbi cachen. Uden den ville
  // genindlæsningen bare give den samme udgave en gang til.
  await registrering?.update().catch(() => undefined);
  if (hentNyeste) {
    await hentNyeste(true);
    return;
  }

  // Uden service worker — fx i dev — er en almindelig genindlæsning nok.
  window.location.reload();
}

// Hvilken udgave der kører. Bages ind ved build, så den ikke kan komme til at
// passe på noget andet end det man faktisk har foran sig.
export interface Udgave {
  version: string;
  commit: string;
  bygget: string;
}

export function udgave(): Udgave {
  return { version: __APP_VERSION__, commit: __APP_COMMIT__, bygget: __APP_BYGGET__ };
}

// "5.8.2026 kl. 14.32" — nok til at se om en udrulning er nået frem.
export function byggetekst(iso: string = __APP_BYGGET__): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'ukendt tidspunkt';

  return `${d.toLocaleDateString('da-DK')} kl. ${d.toLocaleTimeString('da-DK', {
    hour: '2-digit',
    minute: '2-digit'
  })}`;
}
