import type { Item, Tur, Gruppe, Reference } from './db';
import { itemUidsPaaTur, laesDanskDato, dageTil } from './smartMotor';
import { filtrererTure } from './statistik';
import { manglerPakAfTjek, dageSidenSlut, PAK_AF_FRIST_DAGE } from './pakAfTjek';
import type { Turmaal } from './turmaal';
import { udlaanteItems, dageUdlaant, erOverskredet, laengde, LANGT_UDLAAN_DAGE } from './udlaan';
import { FEJLTEKST, kraeverLogin } from './syncfejl';
import type { Syncfejl } from './syncfejl';
import { forfaldne, forfaldstekst, VARSEL_DAGE } from './vedligehold';

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
// Situationen
//
// Startskærmen skal vise det, der er vigtigt nu — ikke alt, appen kan. Og
// "nu" er ikke det samme hele året: der er forskel på en kladde tre uger ude,
// en tur der begynder i morgen, en man er midt i, og en man lige er kommet
// hjem fra.
//
// Hullet, den her funktion lukker, var det sidste af dem: `naesteTur`
// filtrerer afsluttede ture fra, så når man kom hjem fra en tur, sagde
// forsiden "Ingen ture planlagt" — mens det eneste, der faktisk manglede, var
// at gøre turen op. Det stod nede under handlingerne, hvor man skulle finde
// det selv.
//
// Situationen udledes og gemmes ikke. Et felt til den ville skulle holdes i
// sync med datoer, status og pak-af-tjek, og det ville sige det samme som dem.
// ─────────────────────────────────────────────

// Så tæt på afgang handler turen ikke længere om at planlægge. Så handler den
// om at få det i tasken.
const SNART_DAGE = 3;

export type Situation =
  // Ingen tur i sigte — hverken forude eller lige bag.
  | 'ingen_tur'
  // Turen er lagt, men langt ude endnu.
  | 'kladde'
  // Klar, men der er stadig tid.
  | 'klar'
  // Den begynder om få dage.
  | 'snart'
  // Man er afsted.
  | 'paa_tur'
  // Hjemme, men turen er ikke gjort op.
  | 'gjort_op_mangler';

export interface Hjemsituation {
  situation: Situation;
  // Turen, situationen handler om. Null kun ved 'ingen_tur'.
  tur: Tur | null;
  // Ordet over kortet: "Næste tur · om 8 dage", "På tur", "Hjemme fra".
  overskrift: string;
  // Hvad knappen hedder. Den siger, hvad man skal — ikke hvor man kommer hen.
  handling: string;
  // Hvor på turen knappen lander, når turens forside ikke er stedet.
  // Se turmaal.ts: peger appen på noget, skal man kunne gøre det, hvor man
  // lander.
  maal?: Turmaal;
}

export function hjemsituation(
  ture: Tur[],
  nu: Date = new Date()
): Hjemsituation {
  // Rækkefølgen er prioriteringen: det man er midt i, så det der kommer, og
  // til sidst det man har efterladt. En tur man står i, slår alt andet — man
  // planlægger ikke næste sommer fra en shelter.
  const aktiv = ture.find((t) => t.status === 'aktiv');
  if (aktiv) {
    return {
      situation: 'paa_tur',
      tur: aktiv,
      overskrift: 'På tur',
      handling: 'Fortsæt turen'
    };
  }

  const kommende = naesteTur(ture, nu);
  if (kommende) {
    const dage = kommende.startdato ? dageTil(new Date(kommende.startdato), nu) : 99;
    const overskrift = `Næste tur · ${naarBegynder(kommende, nu)}`;

    if (dage <= SNART_DAGE) {
      return {
        situation: 'snart',
        tur: kommende,
        overskrift,
        handling: 'Pak færdig',
        // Pakkelisten og ikke pakke-fanen: så tæt på afgang er det
        // afkrydsningen, man skal have fat i.
        maal: 'pakkeliste'
      };
    }

    return kommende.status === 'kladde'
      ? { situation: 'kladde', tur: kommende, overskrift, handling: 'Fortsæt planlægningen' }
      : { situation: 'klar', tur: kommende, overskrift, handling: 'Gør klar', maal: 'pakning' };
  }

  // Ikke noget forude. Så er det, man kom hjem fra, det eneste der står
  // tilbage — og kun hvis den ikke er gjort op. Nyeste først: den husker man
  // bedst.
  const uafsluttet = ture
    .filter(manglerPakAfTjek)
    .filter((t) => t.slutdato || t.startdato)
    .sort((a, b) => (b.slutdato || b.startdato).localeCompare(a.slutdato || a.startdato))[0];

  if (uafsluttet) {
    return {
      situation: 'gjort_op_mangler',
      tur: uafsluttet,
      overskrift: 'Hjemme fra',
      handling: 'Gør turen op'
    };
  }

  return {
    situation: 'ingen_tur',
    tur: null,
    overskrift: 'Næste tur',
    handling: 'Planlæg en tur'
  };
}

// Kortet øverst ejer sin tur.
//
// Handlingerne og situationen kigger på de samme data, så de kan nå frem til
// det samme: står man hjemme fra en tur uden pak-af-tjek, siger turkortet
// "Gør turen op", og handlingen under det siger "Mangler pak-af-tjek" om
// præcis den tur. To kort om det samme fylder to pladser og siger én ting.
//
// Handlingerne om *andre* ture bliver stående — det er kun dubletten, der
// ryger.
export function udenDubletAfSituationen(
  alle: Handling[],
  situation: Hjemsituation
): Handling[] {
  const turUid = situation.tur?.uid;
  if (!turUid) return alle;

  return alle.filter((h) => !(h.maal.slags === 'tur' && h.maal.uid === turUid));
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
// Sync-status
//
// Fundamentet siger, at den skal være synlig uden at være dominerende. Den
// skal især ikke ligne en fejl, når den ikke er en: at have ændringer
// liggende uden dækning er den normale tilstand for en app, der bruges i
// skoven, og ikke noget der er gået galt.
// ─────────────────────────────────────────────

export type SyncTilstand = 'synkroniseret' | 'venter' | 'offline' | 'kun_lokalt' | 'fejl';

export interface Syncstatus {
  tilstand: SyncTilstand;
  tekst: string;
  // Kun sat ved 'fejl': det, brugeren kan gøre ved det. Se syncfejl.ts.
  forklaring?: string;
  // Om skærmen skal tilbyde et login. Den står her og ikke i skærmen, fordi
  // teksten og knappen skal komme fra den samme beslutning — ellers kan de
  // modsige hinanden, og det gjorde de: linjen sagde "Gemt på denne enhed",
  // mens knappen under den bad om at logge ind igen.
  kanLoggeInd?: boolean;
}

export function syncstatus(
  usendt: number,
  online: boolean,
  harKonto: boolean,
  fejl: Syncfejl | null = null
): Syncstatus {
  // Uden konto er der ikke noget at synkronisere med. Så er "usendt" ikke en
  // kø, det er bare det, der står på enheden — og det er ikke en mangel.
  //
  // Med én undtagelse: en udløbet session rydder sig selv, og så står appen
  // som "uden konto". Det er sandt, men ikke hele sandheden — man *var* logget
  // ind, og der er noget, der ikke kommer op. Den skal siges, ikke gemmes bag
  // "Gemt på denne enhed".
  if (!harKonto) {
    if (fejl?.art === 'ikke_logget_ind') {
      return {
        tilstand: 'fejl',
        tekst: 'Du er blevet logget ud',
        forklaring: FEJLTEKST.ikke_logget_ind,
        kanLoggeInd: true
      };
    }
    // "Gemt på denne enhed" er sandt, men det er ikke til at høre, at det
    // også betyder "og kommer ingen steder". Den, der tror hun synkroniserer,
    // læser det som en betryggelse — og opdager først, at det ikke skete, når
    // hun står med en ny telefon.
    //
    // Derfor står vejen videre lige der. Det er den samme regel som i
    // turmaal.ts: siger appen, at noget mangler, skal man kunne gøre noget
    // ved det, hvor man står.
    return {
      tilstand: 'kun_lokalt',
      tekst: 'Gemt på denne enhed',
      forklaring: 'Uden en konto bliver dine ting på den her telefon — de sendes ikke op, og du kan ikke dele en tur.',
      kanLoggeInd: true
    };
  }

  // Uden dækning er en fejl forventet, og så er den ikke en fejl. At skrive
  // "kunne ikke nå serveren" til en, der selv kan se, at der ikke er net, er
  // at gøre den normale tilstand i skoven til noget, der er gået galt.
  if (!online) {
    return usendt === 0
      ? { tilstand: 'synkroniseret', tekst: 'Alt er sendt op · offline' }
      : { tilstand: 'offline', tekst: `${aendringstekst(usendt)} venter på dækning` };
  }

  // Fejlen går forud for optællingen. Er hentningen den, der fejlede, er der
  // ingenting usendt — og så ville "alt er sendt op" være rigtigt om det, der
  // skulle op, og forkert om det, appen lige har prøvet.
  if (fejl) {
    return {
      tilstand: 'fejl',
      tekst: usendt === 0 ? 'Sync fejlede' : `${aendringstekst(usendt)} kom ikke op`,
      forklaring: FEJLTEKST[fejl.art],
      kanLoggeInd: kraeverLogin(fejl)
    };
  }

  if (usendt === 0) {
    return { tilstand: 'synkroniseret', tekst: 'Alt er sendt op' };
  }

  return { tilstand: 'venter', tekst: `${aendringstekst(usendt)} på vej op` };
}

function aendringstekst(usendt: number): string {
  return `${usendt} ${usendt === 1 ? 'ændring' : 'ændringer'}`;
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
