import type { Item, Tur, Gruppe, Reference } from './db';
import { itemUidsPaaTur, itemsPaaTur, foreslaaGrupper, laesDanskDato, dageTil } from './smartMotor';
import { filtrererTure } from './statistik';
import { manglerPakAfTjek, dageSidenSlut, PAK_AF_FRIST_DAGE } from './pakAfTjek';
import { udlaanteItems, dageUdlaant, erOverskredet, laengde, LANGT_UDLAAN_DAGE } from './udlaan';
import { forfaldne, forfaldstekst, VARSEL_DAGE } from './vedligehold';
import { vaegtbrydere, samletBesparelse } from './vaegtbrydere';
import { foreslaaKopi } from './ligesomSidst';

// Logikken bag startskærmen. Alt herinde er rene funktioner, så rækkefølgen og
// grænserne kan testes uden at rende skærmen igennem.

// ─────────────────────────────────────────────
// Næste tur
// ─────────────────────────────────────────────

// Den tur man er på vej på — eller er midt i. En tur der er gået i gang, men
// ikke slut endnu, tæller stadig: det er den man har brug for at åbne.
export function naesteTur(ture: Tur[], nu: Date = new Date()): Tur | null {
  const idag = iso(nu);

  const kommende = ture.filter((t) => {
    if (t.status === 'afsluttet' || !t.startdato) return false;
    return (t.slutdato || t.startdato) >= idag;
  });

  if (kommende.length === 0) return null;
  return kommende.sort((a, b) => a.startdato.localeCompare(b.startdato))[0];
}

// "om 8 dage" / "i dag" / "i gang" — teksten over turkortet.
export function naarBegynder(tur: Tur, nu: Date = new Date()): string {
  const dage = dageTil(new Date(tur.startdato), nu);
  if (dage > 1) return `om ${dage} dage`;
  if (dage === 1) return 'i morgen';
  if (dage === 0) return 'i dag';
  return 'i gang';
}

// ─────────────────────────────────────────────
// Handlinger
// ─────────────────────────────────────────────

export type HandlingsType =
  | 'garanti'
  | 'kladde_naer_start'
  | 'pak_af_tjek_mangler'
  | 'vedligehold_forfalder'
  | 'udlaan_laenge'
  | 'koebsinfo'
  | 'ubrugt';

// Hvad kortet fører hen til. Gear-handlinger peger på et item, tur-handlinger
// på en tur — begge dele skal kunne åbnes fra startskærmen.
export interface Maal {
  slags: 'item' | 'tur';
  uid: Reference;
}

export interface Handling {
  type: HandlingsType;
  titel: string;
  detalje: string;
  maal: Maal;
  // Reglen der udløste handlingen, skrevet ud. Vises bag "hvorfor?".
  begrundelse: string;
  // Kortet farves rødt. Sættes af den enkelte handling og ikke af skærmen, så
  // grænsen for hvornår noget haster står sammen med reglen der finder det.
  haster: boolean;
}

// Hvor mange forgangne ture et item skal have været fra, før det regnes som
// ubrugt. Under den grænse har en ny bruger ikke turhistorik nok til at det
// betyder noget.
const UBRUGT_EFTER_TURE = 5;

// Så tæt på starten er en kladde ikke længere en kladde man er i gang med —
// den er en tur der mangler at blive gjort klar.
const KLADDE_VARSEL_DAGE = 3;

export function handlinger(
  items: Item[],
  ture: Tur[],
  grupper: Gruppe[],
  nu: Date = new Date()
): Handling[] {
  const ejet = items.filter((i) => i.status === 'ejer');

  // Garantier der er ved at løbe ud — det mest tidskritiske, så de står først,
  // og den der haster mest øverst.
  const garantier: Handling[] = ejet
    .map((item) => ({ item, dage: garantiDage(item, nu) }))
    .filter((x): x is { item: Item; dage: number } => x.dage !== null)
    .sort((a, b) => a.dage - b.dage)
    .map(({ item, dage }) => ({
      type: 'garanti' as const,
      titel: 'Garanti udløber',
      detalje: `${item.navn} · ${garantiFrist(dage)}`,
      maal: { slags: 'item', uid: item.uid },
      begrundelse: `Garantien på ${item.navn} udløber ${item.garanti?.udloeber_dato}, og du har bedt om at blive mindet om det ${item.garanti?.paamindelse_dage} dage før.`,
      haster: true
    }));

  // Uden købssted og -dato er en garanti svær at gøre gældende. Kun gear med
  // en pris er værd at spørge til.
  const koebsinfo: Handling[] = ejet
    .filter((i) => i.pris_kr > 0 && !i.koebt_hos.trim() && !i.koebsdato.trim())
    .map((i) => ({
      type: 'koebsinfo',
      titel: 'Manglende købsinfo',
      detalje: i.navn,
      maal: { slags: 'item', uid: i.uid },
      begrundelse: `${i.navn} har en pris på ${i.pris_kr} kr, men hverken købssted eller købsdato. Det er de to ting en garantisag skal bruge, og de er svære at grave frem bagefter.`,
      haster: false
    }));

  const ubrugt = ubrugteEfterSidsteTure(ejet, ture, grupper, nu);

  // Rækkefølgen er prioriteringen: garanti har en frist der koster penge at
  // overskride, turene har en frist der kun koster dem selv, købsinfo er det
  // man skal bruge for at gøre garantien gældende, og ubrugt gear kan vente.
  return foersteProblemPrMaal([
    ...garantier,
    ...kladderNaerStart(ture, nu),
    ...manglendePakAfTjek(ture, nu),
    ...forfaldentVedligehold(ejet, nu),
    ...langeUdlaan(ejet, nu),
    ...koebsinfo,
    ...ubrugt
  ]);
}

// Ét kort pr. post. Et stykke gear kan sagtens have to problemer, men på en
// startskærm med plads til en håndfuld kort skubber gentagelsen andet ud;
// resten står på postens egen side.
function foersteProblemPrMaal(alle: Handling[]): Handling[] {
  const set = new Set<string>();

  return alle.filter((h) => {
    const noegle = `${h.maal.slags}:${h.maal.uid}`;
    if (set.has(noegle)) return false;
    set.add(noegle);
    return true;
  });
}

// Turen begynder om få dage, og den står stadig som kladde. Den nærmeste tur
// først — det er den man skal nå at gøre noget ved.
function kladderNaerStart(ture: Tur[], nu: Date): Handling[] {
  return ture
    .filter((t) => t.status === 'kladde' && t.startdato)
    .map((tur) => ({ tur, dage: dageTil(new Date(tur.startdato), nu) }))
    .filter(({ dage }) => dage >= 0 && dage <= KLADDE_VARSEL_DAGE)
    .sort((a, b) => a.dage - b.dage)
    .map(({ tur, dage }) => ({
      type: 'kladde_naer_start' as const,
      titel: 'Turen er stadig en kladde',
      detalje: `${tur.navn || 'Uden navn'} · ${startFrist(dage)}`,
      maal: { slags: 'tur' as const, uid: tur.uid },
      begrundelse: `Turen begynder ${startOm(dage)} og står stadig som kladde. Varslet går ${KLADDE_VARSEL_DAGE} dage tilbage — så tæt på er en kladde ikke længere noget man er i gang med.`,
      haster: false
    }));
}

// Turen er slut, men den er aldrig gjort op. Uden pak-af-tjekket har motoren
// intet at lære af — derfor er det den ældste tur der står øverst, den er den
// sværeste at huske tilbage på.
function manglendePakAfTjek(ture: Tur[], nu: Date): Handling[] {
  return ture
    .filter(manglerPakAfTjek)
    .map((tur) => ({ tur, dage: dageSidenSlut(tur, nu) }))
    .filter((x): x is { tur: Tur; dage: number } => x.dage !== null && x.dage >= 0)
    .sort((a, b) => b.dage - a.dage)
    .map(({ tur, dage }) => ({
      type: 'pak_af_tjek_mangler' as const,
      titel: 'Mangler pak-af-tjek',
      detalje: `${tur.navn || 'Uden navn'} · ${slutFrist(dage)}`,
      maal: { slags: 'tur' as const, uid: tur.uid },
      begrundelse: `Turen står som afsluttet og sluttede ${sluttedeFor(dage)}, men den er aldrig gjort op. Uden pak-af-tjekket har smart-motoren ingen data at lære af. Efter ${PAK_AF_FRIST_DAGE} dage regnes det som noget der haster, fordi man husker dårligere jo længere tid der går.`,
      // Jo længere tid der går, jo mindre kan man huske. Efter fristen er det
      // ikke længere en note man kan tage sig af i næste uge.
      haster: dage > PAK_AF_FRIST_DAGE
    }));
}

// Gear der skal passes. Det mest overskredne først — imprægneringen der er
// et år bagud haster mere end den der forfalder i næste uge.
function forfaldentVedligehold(ejet: Item[], nu: Date): Handling[] {
  return forfaldne(ejet, nu).map(({ item, handling, dage }) => ({
    type: 'vedligehold_forfalder' as const,
    titel: 'Vedligehold forfalder',
    detalje: `${item.navn} · ${handling.navn.toLowerCase()} ${forfaldstekst(dage)}`,
    maal: { slags: 'item' as const, uid: item.uid },
    begrundelse: `${handling.navn} blev sidst gjort ${handling.sidst_udfoert} og skal gøres hver ${handling.interval_maaneder}. måned. Varslet går ${VARSEL_DAGE} dage forud, så det kan nås inden en tur — en tarp imprægneres bedst før regnen og ikke efter.`,
    // Forfaldent er ikke det samme som forsømt. Først når fristen er
    // passeret, er det noget der skulle have været gjort.
    haster: dage < 0
  }));
}

// Gear der har været ude af huset længe, eller som skulle have været tilbage.
// Det længste lån først — det er det mest glemte.
function langeUdlaan(ejet: Item[], nu: Date): Handling[] {
  return udlaanteItems(ejet)
    .map((item) => ({
      item,
      dage: dageUdlaant(item, nu) ?? 0,
      overskredet: erOverskredet(item.udlaan?.forventet_retur, nu)
    }))
    .filter((x) => x.overskredet || x.dage >= LANGT_UDLAAN_DAGE)
    .sort((a, b) => b.dage - a.dage)
    .map(({ item, dage, overskredet }) => {
      const hos = item.udlaan?.navn.trim() || 'en anden';

      return {
        type: 'udlaan_laenge' as const,
        titel: 'Udlånt gear',
        detalje: `${item.navn} · hos ${hos} i ${laengde(dage)}`,
        maal: { slags: 'item' as const, uid: item.uid },
        begrundelse: overskredet
          ? `${item.navn} skulle have været retur fra ${hos} den ${item.udlaan?.forventet_retur}. Den dato er passeret.`
          : `${item.navn} har været hos ${hos} i ${laengde(dage)}. Efter ${LANGT_UDLAAN_DAGE} dage spørger appen til det — et lån man ikke bliver mindet om, bliver til en foræring.`,
        // En aftalt frist der er overskredet er en anden slags end bare lang
        // tid: dér har nogen sagt en dato, og den er passeret.
        haster: overskredet
      };
    });
}

// Til detaljelinjen på kortet, hvor der ikke er plads til en hel sætning.
function startFrist(dage: number): string {
  if (dage > 1) return `om ${dage} dage`;
  if (dage === 1) return 'i morgen';
  return 'starter i dag';
}

function slutFrist(dage: number): string {
  if (dage > 1) return `slut for ${dage} dage siden`;
  if (dage === 1) return 'slut i går';
  return 'slut i dag';
}

// De samme to frister, bøjet så de kan stå midt i en sætning.
function startOm(dage: number): string {
  if (dage > 1) return `om ${dage} dage`;
  return dage === 1 ? 'i morgen' : 'i dag';
}

function sluttedeFor(dage: number): string {
  if (dage > 1) return `for ${dage} dage siden`;
  return dage === 1 ? 'i går' : 'i dag';
}

// Gear der ikke har været med på nogen af de seneste ture. Måles i ture og
// ikke i måneder, fordi det er turene der siger noget om brug.
function ubrugteEfterSidsteTure(
  ejet: Item[],
  ture: Tur[],
  grupper: Gruppe[],
  nu: Date
): Handling[] {
  const idag = iso(nu);
  const forgangne = ture
    .filter((t) => t.startdato && t.startdato <= idag)
    .sort((a, b) => b.startdato.localeCompare(a.startdato))
    .slice(0, UBRUGT_EFTER_TURE);

  if (forgangne.length < UBRUGT_EFTER_TURE) return [];

  const brugt = new Set<Reference>();
  forgangne.forEach((t) => itemUidsPaaTur(t, grupper).forEach((uid) => brugt.add(uid)));

  return ejet
    .filter((i) => !brugt.has(i.uid))
    .map((i) => ({
      type: 'ubrugt' as const,
      titel: 'Ubrugt gear',
      detalje: `${i.navn} · ${forgangne.length} ture`,
      maal: { slags: 'item', uid: i.uid },
      begrundelse: `${i.navn} var ikke med på nogen af de seneste ${forgangne.length} ture — hverken løst eller via en gruppe. Der måles i ture og ikke i måneder, fordi det er turene der siger noget om brug.`,
      haster: false
    }));
}

// Dage til garantien udløber, eller null hvis der ikke er nogen — eller hvis
// der er længere igen end påmindelsesvinduet.
function garantiDage(item: Item, nu: Date): number | null {
  if (!item.garanti) return null;

  const udloeber = laesDanskDato(item.garanti.udloeber_dato);
  if (!udloeber) return null;

  const dage = dageTil(udloeber, nu);
  return dage <= item.garanti.paamindelse_dage ? dage : null;
}

function garantiFrist(dage: number): string {
  if (dage > 1) return `${dage} dage`;
  if (dage === 1) return '1 dag';
  if (dage === 0) return 'i dag';
  return 'udløbet';
}

// ─────────────────────────────────────────────
// Feltbogen foreslår
//
// Handlingerne ovenfor er ting, der er gået skævt. Det her er det modsatte:
// hvad appen ville gøre, hvis den måtte. Den må ikke — forslagene skriver
// ingenting, de peger på turen, hvor man selv siger ja.
//
// Alle tre kilder er motorens egne og har allerede en begrundelse med. Der
// laves ingen nye regler her; der vælges kun, hvilke der er værd at vise på
// en startskærm.
// ─────────────────────────────────────────────

export type ForslagsType = 'kopi' | 'gruppe' | 'vaegt';

export interface Turforslag {
  type: ForslagsType;
  titel: string;
  detalje: string;
  begrundelse: string;
}

// Så mange forslag ad gangen. Startskærmen skal kunne læses på fem sekunder,
// og et forslag man ikke når at læse, er ikke et forslag.
const MAKS_FORSLAG = 3;

export function turforslag(
  tur: Tur | null,
  grupper: Gruppe[],
  items: Item[],
  alleTure: Tur[]
): Turforslag[] {
  if (!tur) return [];

  const ejet = items.filter((i) => i.status === 'ejer');
  const paaTuren = itemsPaaTur(tur, grupper, ejet);
  const forslag: Turforslag[] = [];

  // Er der ikke valgt noget grej endnu, er den tomme liste det eneste
  // problem der er værd at løse. En tidligere tur der ligner, er et bedre
  // sted at begynde end ingenting.
  if (paaTuren.length === 0) {
    const kopi = foreslaaKopi(tur, alleTure, grupper)[0];
    if (kopi) {
      forslag.push({
        type: 'kopi',
        titel: `Pak ligesom ${kopi.tur.navn || 'sidste tur'}`,
        detalje: `${kopi.antalItems} ${kopi.antalItems === 1 ? 'ting' : 'ting'} at kopiere over`,
        begrundelse: kopi.begrundelse
      });
    }
  }

  // Grejsæt hvis tags rammer turens. Kun det bedste match: to forslag om at
  // tilføje en gruppe ad gangen er ikke hjælp, det er en liste.
  const gruppe = foreslaaGrupper(tur, grupper).filter((g) => g.score > 0)[0];
  if (gruppe) {
    forslag.push({
      type: 'gruppe',
      titel: `Tag ${gruppe.gruppe.navn} med`,
      detalje: `Passer på ${gruppe.traf.join(', ')}`,
      begrundelse: gruppe.begrundelse
    });
  }

  // Lettere alternativer i skabet. Kun værd at nævne når der er valgt grej
  // at gøre lettere, og kun hvis der reelt er noget at hente.
  if (paaTuren.length > 0) {
    const brydere = vaegtbrydere(tur, grupper, ejet, paaTuren);
    const sparet = samletBesparelse(brydere);
    if (sparet > 0) {
      forslag.push({
        type: 'vaegt',
        titel: 'Vægten kan ned',
        detalje: `${(sparet / 1000).toFixed(1)} kg at hente på ${brydere.length} ${brydere.length === 1 ? 'ting' : 'ting'}`,
        begrundelse: brydere[0].begrundelse
      });
    }
  }

  return forslag.slice(0, MAKS_FORSLAG);
}

// ─────────────────────────────────────────────
// Sync-status
//
// Fundamentet siger, at den skal være synlig uden at være dominerende. Den
// skal især ikke ligne en fejl, når den ikke er en: at have ændringer
// liggende uden dækning er den normale tilstand for en app, der bruges i
// skoven, og ikke noget der er gået galt.
// ─────────────────────────────────────────────

export type SyncTilstand = 'synkroniseret' | 'venter' | 'offline' | 'kun_lokalt';

export interface Syncstatus {
  tilstand: SyncTilstand;
  tekst: string;
}

export function syncstatus(usendt: number, online: boolean, harKonto: boolean): Syncstatus {
  // Uden konto er der ikke noget at synkronisere med. Så er "usendt" ikke en
  // kø, det er bare det, der står på enheden — og det er ikke en mangel.
  if (!harKonto) {
    return { tilstand: 'kun_lokalt', tekst: 'Gemt på denne enhed' };
  }

  if (usendt === 0) {
    return { tilstand: 'synkroniseret', tekst: online ? 'Alt er sendt op' : 'Alt er sendt op · offline' };
  }

  const aendringer = `${usendt} ${usendt === 1 ? 'ændring' : 'ændringer'}`;

  return online
    ? { tilstand: 'venter', tekst: `${aendringer} på vej op` }
    : { tilstand: 'offline', tekst: `${aendringer} venter på dækning` };
}

// ─────────────────────────────────────────────
// Nøgletal
// ─────────────────────────────────────────────

export interface AarsTal {
  iAar: number;
  sidsteAar: number;
  // null når der ikke var nogen ture sidste år at måle imod.
  aendringPct: number | null;
}

export function tureIAar(ture: Tur[], nu: Date = new Date()): AarsTal {
  const iAar = filtrererTure(ture, 'i_aar', nu).length;
  const sidsteAar = filtrererTure(ture, 'sidste_aar', nu).length;

  return {
    iAar,
    sidsteAar,
    aendringPct: sidsteAar === 0 ? null : Math.round(((iAar - sidsteAar) / sidsteAar) * 100)
  };
}

export function sidstTilfoejede(items: Item[], antal: number = 5): Item[] {
  return [...items]
    .sort((a, b) => b.oprettet.getTime() - a.oprettet.getTime())
    .slice(0, antal);
}

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
