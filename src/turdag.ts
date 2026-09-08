import { etiket } from './db';
import type { Tur, TurDag, Reference } from './db';

// ─────────────────────────────────────────────
// Dagene på en flerdagestur
//
// Turen svarer for helheden: ét sted, én overnatning, én aktivitet. Dagene her
// er det, turen ikke selv kan sige — at man vandrer den første dag og padler
// den anden.
//
// Halvdelen af dagbegrebet fandtes i forvejen: `turjournal.ts` grupperer
// feltnoterne dag for dag med `dagnummer()`, udledt af datoerne. Det er dagen
// som *det, der skete*, og den skal ikke gemmes. Det her er dagen som *en
// plan*, og den kan ikke udledes af noget.
// ─────────────────────────────────────────────

const DAG_MS = 86400000;

// Hvor mange dage turen varer. To nætter er tre dage — samme regnestykke som
// årsopgørelsen bruger.
export function antalDage(tur: Tur): number {
  return Math.max(1, tur.naetter + 1);
}

// Datoen for en dag, udledt af turens start.
//
// Den gemmes ikke på dagen. Flyttes turen en uge, følger alle dage med af sig
// selv, og der er ingen anden sandhed at holde den i sync med. Tom streng, når
// turen ikke har en startdato at tælle fra — så har dagen et nummer og ikke en
// dato, og det er et ærligt svar.
export function datoFor(tur: Tur, dagNr: number): string {
  if (!tur.startdato || dagNr < 1) return '';

  const start = new Date(tur.startdato);
  if (Number.isNaN(start.getTime())) return '';

  return new Date(start.getTime() + (dagNr - 1) * DAG_MS).toISOString().slice(0, 10);
}

// Turens egne dage, i rækkefølge.
export function dageFor(dage: TurDag[], turUid: Reference): TurDag[] {
  return dage
    .filter((d) => d.tur_uid === turUid)
    .sort((a, b) => a.dag_nr - b.dag_nr);
}

// En ny dag, som den skal se ud, før nogen har rørt den.
//
// Den arver turens aktivitet og overnatning frem for at stå tom. Det er
// næsten altid rigtigt — en tur er sjældent en anden slags hver dag — og det,
// der skal rettes, er undtagelsen. Destinationen arves derimod ikke: at man
// sover samme sted hver nat er præcis det, en flerdagestur ikke gør.
export function nyDag(tur: Tur, eksisterende: TurDag[]): Omit<TurDag, 'id' | 'uid'> {
  const mine = dageFor(eksisterende, tur.uid);
  const nu = new Date();

  return {
    tur_uid: tur.uid,
    dag_nr: naesteNummer(mine),
    aktivitet: tur.aktivitet,
    overnatning: tur.overnatning,
    destination: '',
    destination_sted_uid: '',
    noter: '',
    oprettet: nu,
    aendret: nu
  };
}

// Næste ledige nummer. Højeste plus én og ikke antallet: er dag 2 slettet uden
// omnummerering, ville antallet give et nummer, der allerede er i brug.
export function naesteNummer(dage: TurDag[]): number {
  return dage.reduce((hoejest, d) => Math.max(hoejest, d.dag_nr), 0) + 1;
}

// Hvilke dage der skal have nyt nummer, for at rækken er 1, 2, 3 … uden huller.
//
// Returnerer kun dem, der faktisk skal flyttes, så kalderen kan skrive netop de
// poster og ikke hele rækken. Ligger de rigtigt i forvejen, er listen tom.
export function omnummerering(dage: TurDag[]): { dag: TurDag; dag_nr: number }[] {
  return dageFor(dage, dage[0]?.tur_uid ?? '')
    .map((dag, i) => ({ dag, dag_nr: i + 1 }))
    .filter(({ dag, dag_nr }) => dag.dag_nr !== dag_nr);
}

// Byt to dage om. Returnerer de ændringer, der skal skrives — igen kun dem,
// der flytter sig.
export function flyt(dage: TurDag[], fraNr: number, tilNr: number): { dag: TurDag; dag_nr: number }[] {
  const raekke = dageFor(dage, dage[0]?.tur_uid ?? '');
  const fra = raekke.findIndex((d) => d.dag_nr === fraNr);
  const til = raekke.findIndex((d) => d.dag_nr === tilNr);
  if (fra < 0 || til < 0 || fra === til) return [];

  const flyttet = [...raekke];
  const [taget] = flyttet.splice(fra, 1);
  flyttet.splice(til, 0, taget);

  return flyttet
    .map((dag, i) => ({ dag, dag_nr: i + 1 }))
    .filter(({ dag, dag_nr }) => dag.dag_nr !== dag_nr);
}

// De dage, der ligger uden for turens egen længde.
//
// Den blokerer ikke. Man skal kunne planlægge en dag mere, før man har rettet
// nætterne — men appen skal have sagt det. Samme regel som resten af
// advarslerne: de siger fra, de spærrer ikke.
export function dageUdenForTuren(tur: Tur, dage: TurDag[]): TurDag[] {
  const loft = antalDage(tur);
  return dageFor(dage, tur.uid).filter((d) => d.dag_nr > loft);
}

// Har turen dage nok til at være beskrevet hele vejen?
//
// Ingen dage er ikke et hul — det er en tur, der ikke har brug for dem. Først
// når nogen er begyndt, betyder de manglende noget.
export function manglendeDage(tur: Tur, dage: TurDag[]): number {
  const mine = dageFor(dage, tur.uid);
  if (mine.length === 0) return 0;

  return Math.max(0, antalDage(tur) - mine.length);
}

// Skifter turen slags undervejs? Det er svaret på, om turen overhovedet er en
// flerdagestur i den forstand, dagene findes for.
export function varierer(dage: TurDag[], turUid: Reference): boolean {
  const mine = dageFor(dage, turUid);
  if (mine.length < 2) return false;

  return new Set(mine.map((d) => d.aktivitet)).size > 1
    || new Set(mine.map((d) => d.overnatning)).size > 1;
}

// Har turen overhovedet brug for dage?
//
// En dagstur har én dag, og en dagsplan for den ene dag er en liste med ét
// punkt, der ikke siger noget, turen ikke allerede siger.
export function harBrugForDage(tur: Tur): boolean {
  return tur.naetter >= 1;
}

// Linjen under overskriften, når sektionen er foldet sammen. Den skal kunne
// læses uden at folde ud: hvor langt man er, og om turen skifter slags.
export function dagsplanResume(tur: Tur, dage: TurDag[]): string {
  const mine = dageFor(dage, tur.uid);
  if (mine.length === 0) return `${antalDage(tur)} dage · ikke planlagt`;

  const slags = [...new Set(mine.map((d) => etiket(d.aktivitet)))];
  const mangler = manglendeDage(tur, mine);

  const dele = [`${mine.length} af ${antalDage(tur)} dage`, slags.join(', ')];
  if (mangler > 0) dele.push(`${mangler} mangler`);
  return dele.join(' · ');
}
