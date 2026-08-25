import type { Billede, Tur } from './db';

// Fotos fra turen.
//
// Et billede fra en telefon i dag er 4-8 MB og 4000 px bredt. Det skal ikke i
// IndexedDB i den størrelse, og slet ikke op gennem et mobilnet i en skov.
// Derfor skaleres og komprimeres det på enheden, inden det gemmes — og det
// gemmes lokalt først, ligesom alt andet i appen. Uploaden sker når der er
// dækning, og lykkes den aldrig, ligger billedet der stadig.
//
// Komprimeringen er skrevet her frem for hentet ind som pakke. Det er canvas
// plus en skaleringsregel, og en afhængighed til det ville koste mere i vægt
// og vedligehold end den sparer i linjer.

// Længste kant efter skalering. 1600 px er nok til at fylde en telefonskærm
// og til at blive trykt på en A4-side, og småt nok til at et helt turgalleri
// kan ligge på enheden.
export const MAKS_KANT = 1600;

// JPEG-kvalitet. 0,82 er der hvor artefakterne holder op med at kunne ses på
// et fotografi, og filen stadig er en brøkdel af originalen.
export const KVALITET = 0.82;

// Over det her afvises filen. Et billede der ikke kan skaleres — fordi
// browseren ikke kan afkode det — ville ellers ryge råt i basen.
export const MAKS_BYTE = 25 * 1024 * 1024;

export function erBillede(type: string): boolean {
  return type.startsWith('image/');
}

// Målene efter skalering. Billeder der allerede er mindre end grænsen,
// forstørres ikke — det ville koste plads uden at give et bedre billede.
export function beregnMaal(
  bredde: number,
  hoejde: number,
  maks: number = MAKS_KANT
): { bredde: number; hoejde: number } {
  const laengst = Math.max(bredde, hoejde);
  if (laengst <= maks || laengst === 0) return { bredde, hoejde };

  const faktor = maks / laengst;
  return {
    bredde: Math.max(1, Math.round(bredde * faktor)),
    hoejde: Math.max(1, Math.round(hoejde * faktor))
  };
}

// "2,4 MB". Vises på billedet, så man kan se hvad der fylder.
export function filstoerrelse(byte: number): string {
  if (byte < 1024) return `${byte} B`;
  if (byte < 1024 * 1024) return `${Math.round(byte / 1024)} kB`;
  return `${(byte / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

export interface Skaleret {
  blob: Blob;
  bredde: number;
  hoejde: number;
}

// Billedet afkodet, med EXIF-rotationen anvendt.
//
// `imageOrientation: 'from-image'` er det der får telefonfotos til at vende
// rigtigt: rotationen ligger i filen, og tegner man bare pixels over på et
// canvas uden den, ender halvdelen af billederne på siden.
//
// Ældre Safari tager ikke imod options-objektet, og et iPhone-foto er
// præcis den fil der har brug for det. Derfor tre forsøg i rækkefølge, og
// det sidste — et <img>-element — virker overalt: browseren anvender
// orienteringen selv, fordi CSS'ens `image-orientation` som standard er
// `from-image`.
async function afkod(fil: Blob): Promise<CanvasImageSource & { width: number; height: number; close?: () => void }> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(fil, { imageOrientation: 'from-image' });
    } catch {
      // Options-objektet blev afvist. Uden det vender billedet måske forkert,
      // men et billede der vender skævt er bedre end intet billede.
      try {
        return await createImageBitmap(fil);
      } catch {
        // Formatet kan ikke afkodes ad den vej. Så prøver vi som <img>.
      }
    }
  }

  const url = URL.createObjectURL(fil);
  try {
    const billede = new Image();
    await new Promise<void>((ok, fejl) => {
      billede.onload = () => ok();
      billede.onerror = () => fejl(new Error('Kunne ikke læse billedet'));
      billede.src = url;
    });
    return billede;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Skalerer og komprimerer. Kaster hvis filen ikke kan læses som et billede.
export async function skaler(
  fil: Blob,
  maks: number = MAKS_KANT,
  kvalitet: number = KVALITET
): Promise<Skaleret> {
  const kilde = await afkod(fil);
  const maal = beregnMaal(kilde.width, kilde.height, maks);

  try {
    // Et almindeligt canvas frem for OffscreenCanvas: det sidste kom sent til
    // Safari, og appen skal virke på den telefon man rent faktisk har med.
    const laerred = document.createElement('canvas');
    laerred.width = maal.bredde;
    laerred.height = maal.hoejde;

    const tegn = laerred.getContext('2d');
    if (!tegn) throw new Error('Kunne ikke tegne billedet');
    tegn.drawImage(kilde, 0, 0, maal.bredde, maal.hoejde);

    const blob = await new Promise<Blob | null>((ok) => {
      laerred.toBlob(ok, 'image/jpeg', kvalitet);
    });
    if (!blob) throw new Error('Kunne ikke komprimere billedet');

    return { blob, bredde: maal.bredde, hoejde: maal.hoejde };
  } finally {
    // Kun en ImageBitmap skal lukkes; et <img> rydder browseren selv op efter.
    kilde.close?.();
  }
}

// Tidspunktet billedet skal stå under. Filens egen `lastModified` er det
// nærmeste vi kommer optagetidspunktet uden at læse EXIF, og for et foto
// hentet fra kamerarullen er den rigtig.
export function optagetid(fil: File | Blob, nu: Date = new Date()): string {
  const stemplet = (fil as File).lastModified;
  if (typeof stemplet !== 'number' || !Number.isFinite(stemplet) || stemplet <= 0) {
    return nu.toISOString();
  }
  return new Date(stemplet).toISOString();
}

// ─────────────────────────────────────────────
// Billederne på en tur
// ─────────────────────────────────────────────

// Kronologisk. En turdagbog læses forfra, og billeder taget samme sekund
// falder tilbage på den rækkefølge de kom ind i.
export function billederPaaTur(billeder: Billede[], turUid: string): Billede[] {
  return billeder
    .filter((b) => b.tur_uid === turUid)
    .sort((a, b) => a.tid.localeCompare(b.tid) || a.uid.localeCompare(b.uid));
}

// Forsidebilledet. Peger `hero_billede` på noget der er slettet — eller er
// det aldrig sat — falder valget tilbage på det ældste.
export function hero(billeder: Billede[], tur: Tur): Billede | null {
  const paaTuren = billederPaaTur(billeder, tur.uid);
  if (paaTuren.length === 0) return null;

  return paaTuren.find((b) => b.uid === tur.hero_billede) ?? paaTuren[0];
}

// Om billedet kan vises her og nu. Et billede der kun findes som url, og
// hvor der ikke er dækning, kan ikke.
export function kanVises(billede: Billede, online: boolean = true): boolean {
  return billede.blob !== null || (billede.url !== '' && online);
}

// ─────────────────────────────────────────────
// Originalen
// ─────────────────────────────────────────────

// Adressen man kan hente originalen fra, eller tom hvis den ikke er nået op.
//
// `?download=1` får PocketBase til at sende filen med Content-Disposition:
// attachment. Uden den åbner browseren billedet i en fane i stedet for at
// gemme det — og på en telefon er det forskellen på at have billedet og at
// kigge på det.
export function hentelink(billede: Billede): string {
  if (!billede.original_url) return '';

  const adskiller = billede.original_url.includes('?') ? '&' : '?';
  return `${billede.original_url}${adskiller}download=1`;
}

// Filnavnet originalen skal hedde når den er hentet ned. Postens eget navn er
// det filen kom ind med, og det er det man kender den på.
export function hentenavn(billede: Billede): string {
  return billede.navn.trim() || `${billede.uid}.jpg`;
}

// Hvor mange af turens billeder man kan hente i fuld kvalitet.
//
// Billeder lagt ind før originalen blev gemt, har ingen — og den kommer ikke
// igen. Derfor tælles der frem for at love noget der ikke holder.
export function medOriginal(billeder: Billede[]): Billede[] {
  return billeder.filter((b) => b.original_url !== '');
}

// Hvor mange der endnu ikke er nået op. Vises som en linje i galleriet, så
// man ved at der stadig er noget i kø.
export function usendte(billeder: Billede[]): number {
  return billeder.filter((b) => !b.url).length;
}
