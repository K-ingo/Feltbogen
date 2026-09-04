import { etiket } from './db';
import type { Item, Tur, Gruppe, Deltager, Overnatning, Reference, Aktivitetsniveau } from './db';

export interface VejrDag {
  dato: string;
  temp_min: number;
  temp_max: number;
  nedboer_mm: number;
  vind_ms: number;
  vejrkode: number;
  sol_op: string;
  sol_ned: string;
} 

export interface VejrData {
  dage: VejrDag[];
  observationer: string[];
  hentet: string;
} 

// open-meteo udelader værdier den ikke har for en given dag, derfor `| null`.
interface OpenMeteoForecast {
  daily?: {
    time: string[];
    temperature_2m_min: (number | null)[];
    temperature_2m_max: (number | null)[];
    precipitation_sum: (number | null)[];
    windspeed_10m_max: (number | null)[];
    weathercode: (number | null)[];
    sunrise: (string | null)[];
    sunset: (string | null)[];
  };
}

export async function hentVejr(
  lat: number,
  lng: number,
  startdato: string,
  slutdato: string
): Promise<VejrData | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max,weathercode,sunrise,sunset&timezone=Europe/Copenhagen&start_date=${startdato}&end_date=${slutdato}`;
    const svar = await fetch(url);
    if (!svar.ok) return null;

    const data: OpenMeteoForecast = await svar.json();
    const daglig = data.daily;
    if (!daglig) return null;

    const dage: VejrDag[] = daglig.time.map((dato, i) => ({
      dato,
      temp_min: Math.round(daglig.temperature_2m_min[i] ?? 0),
      temp_max: Math.round(daglig.temperature_2m_max[i] ?? 0),
      nedboer_mm: Math.round(daglig.precipitation_sum[i] ?? 0),
      vind_ms: Math.round((daglig.windspeed_10m_max[i] ?? 0) / 3.6),
      vejrkode: daglig.weathercode[i] ?? 0,
      sol_op: daglig.sunrise[i]?.slice(11, 16) ?? '',
      sol_ned: daglig.sunset[i]?.slice(11, 16) ?? ''
    }));

    return {
      dage,
      observationer: lavObservationer(dage),
      hentet: new Date().toISOString()
    };
  } catch (e) {
    console.error('Vejr-fejl:', e);
    return null;
  }
}

function lavObservationer(dage: VejrDag[]): string[] {
  if (dage.length === 0) return [];
  const obs: string[] = [];

  const total_nedboer = dage.reduce((s, d) => s + d.nedboer_mm, 0);
  const gns_temp = dage.reduce((s, d) => s + (d.temp_min + d.temp_max) / 2, 0) / dage.length;

  const vaadeste = [...dage].sort((a, b) => b.nedboer_mm - a.nedboer_mm)[0];
  if (vaadeste.nedboer_mm >= 5) {
    obs.push(`Vådeste dag: ${dagsnavn(vaadeste.dato)} — ${vaadeste.nedboer_mm} mm regn`);
  }

  const vindigste = [...dage].sort((a, b) => b.vind_ms - a.vind_ms)[0];
  if (vindigste.vind_ms >= 8) {
    obs.push(`Vindigste dag: ${dagsnavn(vindigste.dato)} — ${vindigste.vind_ms} m/s`);
  }

  const koldeste = [...dage].sort((a, b) => a.temp_min - b.temp_min)[0];
  if (koldeste.temp_min <= 5) {
    obs.push(`Koldeste nat: ${dagsnavn(koldeste.dato)} — ${koldeste.temp_min}°C`);
  }

  obs.push(`Total nedbør: ${total_nedboer} mm · gennemsnit ${Math.round(gns_temp)}°C`);

  return obs;
}

function dagsnavn(dato: string): string {
  const d = new Date(dato);
  const dage = ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag'];
  return dage[d.getDay()];
}

export function vejrIkonKode(kode: number): string {
  if (kode === 0) return '☀';
  if (kode <= 3) return '⛅';
  if (kode <= 48) return '☁';
  if (kode <= 67) return '🌧';
  if (kode <= 77) return '❄';
  if (kode <= 82) return '🌦';
  if (kode <= 99) return '⛈';
  return '☁';
}

// ─────────────────────────────────────────────
// Forventet forbrug
//
// Tallene er råd, ikke facit. Derfor følger der en begrundelse med hvert af
// dem: brugeren skal kunne se hvad de bygger på og selv vurdere om det passer
// på hende. Se fundamentets §15 om motoren som rådgiver frem for automat.
// ─────────────────────────────────────────────

// Vandbehovet glider mellem de to yderpunkter hen over året. Før var det et
// binært spring mellem marts og april, og et hop på 40 % mellem to nabodage er
// ikke til at tro på.
const VAND_VINTER_L = 2.5;
const VAND_SOMMER_L = 3.8;

// Mad går den anden vej: man brænder mere af på at holde varmen. Gennemsnittet
// over året lander på de 0,6 kg der stod her før.
const MAD_VINTER_KG = 0.65;
const MAD_SOMMER_KG = 0.55;

const GAS_PR_PERSON_PR_DAG_G = 25;

// Den krop satserne ovenfor er skrevet for. Er der ikke oplyst en vægt, er det
// den der regnes med — og så opfører motoren sig som før.
const REFERENCE_VAEGT_KG = 75;

// En tastefejl i vægtfeltet må ikke kunne fordoble eller halvere pakkelisten.
const MINDSTE_VAEGTFAKTOR = 0.7;
const STOERSTE_VAEGTFAKTOR = 1.4;

// Bøjet som tillægsord, så begrundelsen kan sige "højt aktivitetsniveau" og
// ikke "høj aktivitetsniveau".
const NIVEAU_ORD: Record<Aktivitetsniveau, string> = {
  lav: 'lavt',
  middel: 'middel',
  hoej: 'højt'
};

const AKTIVITETSFAKTOR: Record<Aktivitetsniveau, number> = {
  lav: 0.85,
  middel: 1,
  hoej: 1.2
};

// Tør turmad ligger omkring 5 kcal/g. Bruges kun når man selv har skrevet et
// kaloriebehov ind — ellers regnes der i kilo hele vejen.
const KCAL_PR_KG_MAD = 5000;

// Koldest omkring midten af januar. Kurven er en cosinus gennem året, så to
// nabodage aldrig kan springe.
const KOLDESTE_DAG = 15;
const DAGE_PR_AAR = 365;

export interface Kropsdata {
  kropsvaegt_kg?: number;
  aktivitetsniveau?: Aktivitetsniveau;
  // Valgfri: sætter man den, regnes maden ud fra kalorier i stedet.
  daglig_kalorie?: number;
}

export interface Beregninger {
  vand_liter: number;
  mad_kg: number;
  gas_g: number;
  // Hvordan hvert tal er nået frem. Vises bag "hvorfor?".
  begrundelser: { vand: string; mad: string; gas: string };
}

// 0 i dybvinter, 1 i højsommer, og alt derimellem glidende.
export function saesonfaktor(dato: string): number {
  const dag = dagIAaret(dato);
  if (dag === null) return 1;

  return (1 - Math.cos((2 * Math.PI * (dag - KOLDESTE_DAG)) / DAGE_PR_AAR)) / 2;
}

export function beregnForbrug(tur: Tur, krop: Kropsdata = {}): Beregninger {
  const naetter = Number.isFinite(tur.naetter) ? Math.max(0, Math.round(tur.naetter)) : 0;
  const personer = Number.isFinite(tur.personer) ? Math.max(1, Math.round(tur.personer)) : 1;
  const dage = naetter + 1;
  const faktor = saesonfaktor(tur.startdato);

  const vaegtfaktor = beregnVaegtfaktor(krop.kropsvaegt_kg);
  const niveau = krop.aktivitetsniveau;
  const aktivitetsfaktor = niveau ? AKTIVITETSFAKTOR[niveau] : 1;
  const kropsfaktor = vaegtfaktor * aktivitetsfaktor;

  const vandPrDag = mellem(VAND_VINTER_L, VAND_SOMMER_L, faktor) * kropsfaktor;

  // Har man selv skrevet et kaloriebehov ind, er spørgsmålet besvaret — så
  // skal hverken vægt, aktivitetsniveau eller årstid gætte oveni.
  const egetKaloriebehov = (krop.daglig_kalorie ?? 0) > 0;
  const madPrDag = egetKaloriebehov
    ? krop.daglig_kalorie! / KCAL_PR_KG_MAD
    : mellem(MAD_VINTER_KG, MAD_SOMMER_KG, faktor) * kropsfaktor;

  const omfang = `${antal(personer, 'person', 'personer')} × ${antal(dage, 'dag', 'dage')}`;
  const kropstekst = kropsbegrundelse(krop, vaegtfaktor, aktivitetsfaktor);

  return {
    vand_liter: afrundet(personer * dage * vandPrDag),
    mad_kg: afrundet(personer * dage * madPrDag),
    gas_g: Math.round(personer * dage * GAS_PR_PERSON_PR_DAG_G),
    begrundelser: {
      vand: [
        `${omfang} × ${tal(vandPrDag)} L pr. dag.`,
        `Grundsatsen glider fra ${tal(VAND_VINTER_L)} L i dybvinter til ${tal(VAND_SOMMER_L)} L i højsommer;`,
        `${saesontekst(tur.startdato, faktor)}.`,
        kropstekst
      ].filter(Boolean).join(' '),
      mad: [
        `${omfang} × ${tal(madPrDag)} kg pr. dag.`,
        egetKaloriebehov
          ? `Regnet ud fra dit eget behov på ${Math.round(krop.daglig_kalorie!)} kcal om dagen og ca. ${KCAL_PR_KG_MAD / 1000} kcal pr. gram tør turmad.`
          : `Grundsatsen går den modsatte vej af vandet — ${tal(MAD_VINTER_KG, 2)} kg i dybvinter mod ${tal(MAD_SOMMER_KG, 2)} kg i højsommer, fordi kulden brænder mere af. ${stort(saesontekst(tur.startdato, faktor))}.`,
        egetKaloriebehov ? '' : kropstekst
      ].filter(Boolean).join(' '),
      gas: `${omfang} × ${GAS_PR_PERSON_PR_DAG_G} g pr. dag. En fast sats — hvor meget der koges af, afhænger mere af hvad man laver end af årstiden.`
    }
  };
}

function beregnVaegtfaktor(kropsvaegt_kg?: number): number {
  if (!kropsvaegt_kg || kropsvaegt_kg <= 0) return 1;

  const raa = kropsvaegt_kg / REFERENCE_VAEGT_KG;
  return Math.min(STOERSTE_VAEGTFAKTOR, Math.max(MINDSTE_VAEGTFAKTOR, raa));
}

function kropsbegrundelse(krop: Kropsdata, vaegtfaktor: number, aktivitetsfaktor: number): string {
  const dele = [
    krop.kropsvaegt_kg ? `din vægt på ${Math.round(krop.kropsvaegt_kg)} kg (×${tal(vaegtfaktor, 2)})` : '',
    krop.aktivitetsniveau ? `${NIVEAU_ORD[krop.aktivitetsniveau]} aktivitetsniveau (×${tal(aktivitetsfaktor, 2)})` : ''
  ].filter(Boolean);

  if (dele.length === 0) {
    return `Ingen kropsdata sat, så der regnes med en person på ${REFERENCE_VAEGT_KG} kg — sæt din vægt i indstillingerne for et tal der passer på dig.`;
  }
  return `Justeret for ${dele.join(' og ')}.`;
}

function saesontekst(dato: string, faktor: number): string {
  const pct = Math.round(faktor * 100);
  if (!dagIAaret(dato)) return 'turen har ingen startdato, så der regnes med højsommer';
  return `turens startdato ligger ${pct} % af vejen mod højsommer`;
}

// Dag 1-366, eller null hvis datoen ikke kan læses.
function dagIAaret(dato: string): number | null {
  if (!dato) return null;

  const d = new Date(dato);
  if (Number.isNaN(d.getTime())) return null;

  const nytaar = new Date(d.getFullYear(), 0, 0);
  return Math.round((d.getTime() - nytaar.getTime()) / 86400000);
}

function mellem(vinter: number, sommer: number, faktor: number): number {
  return vinter + (sommer - vinter) * faktor;
}

function afrundet(v: number): number {
  return Math.round(v * 10) / 10;
}

// Tal skrevet på dansk — 3.8 bliver til "3,8".
function tal(v: number, decimaler = 1): string {
  return v.toFixed(decimaler).replace('.', ',');
}

// Sætningsdele sættes sammen af flere stykker, og et af dem kan komme til at
// stå først. Så skal det begynde med stort.
function stort(tekst: string): string {
  return tekst.charAt(0).toUpperCase() + tekst.slice(1);
}

function antal(n: number, ental: string, flertal: string): string {
  return `${n} ${n === 1 ? ental : flertal}`;
}

export interface Advarsel {
  niveau: 'roed' | 'gul';
  besked: string;
  detalje: string;
  // Hvilket item advarslen hænger på, så den kan vises på selve rækken i
  // pakkelisten. Tom når advarslen gælder turen som helhed.
  itemUid: Reference;
  // Det manglende tag — kort nok til en chip ved siden af navnet.
  mangler: string;
  // Reglen der udløste advarslen, skrevet ud. Motoren ved allerede hvorfor —
  // den skal bare sige det, ellers ser den ud som om den gætter.
  begrundelse: string;
}

export function findAdvarsler(pakItems: Item[]): Advarsel[] {
  const advarsler: Advarsel[] = [];

  const alleTagsPaaTur = new Set<string>();
  pakItems.forEach((i) => i.tags.forEach((t) => alleTagsPaaTur.add(t)));

  const tagsTaltOp = `Pakkelisten har ${antal(pakItems.length, 'stykke gear', 'stykker gear')} med ${antal(alleTagsPaaTur.size, 'tag', 'forskellige tags')} tilsammen`;

  pakItems.forEach((item) => {
    item.kraever.forEach((krav) => {
      if (!alleTagsPaaTur.has(krav)) {
        advarsler.push({
          niveau: 'roed',
          besked: `${item.navn} kræver "${krav}"`,
          detalje: 'Ingen items på turen leverer dette. Tilføj et item med tagget.',
          itemUid: item.uid,
          mangler: krav,
          begrundelse: `Reglen: står et tag under "kræver" på et stykke gear, skal noget andet på turen bære det tag. ${tagsTaltOp} — "${krav}" er ikke blandt dem. Rød, fordi et krav er en hård afhængighed: uden den virker ${item.navn} ikke.`
        });
      }
    });

    item.komplementer.forEach((komp) => {
      if (!alleTagsPaaTur.has(komp)) {
        advarsler.push({
          niveau: 'gul',
          besked: `${item.navn} komplementerer "${komp}"`,
          detalje: 'Ingen items på turen leverer dette. Overvej at tilføje.',
          itemUid: item.uid,
          mangler: komp,
          begrundelse: `Reglen: står et tag under "komplementer", er det et blødt forslag. ${tagsTaltOp} — "${komp}" er ikke blandt dem. Gul, fordi ${item.navn} godt kan bruges uden.`
        });
      }
    });
  });

  return advarsler;
}

// Advarsler slået op pr. item, så pakkelisten kan mærke den række der mangler
// noget frem for kun at vise en samlet liste.
export function advarslerPrItem(advarsler: Advarsel[]): Map<Reference, Advarsel[]> {
  const pr = new Map<Reference, Advarsel[]>();
  // Nogle advarsler hænger ikke på et bestemt item — fx at en deltager ikke
  // har noget at sove i. De hører kun til i den samlede liste.
  advarsler.filter((a) => a.itemUid !== '').forEach((a) => pr.set(a.itemUid, [...(pr.get(a.itemUid) ?? []), a]));
  return pr;
}

// Items kommer på en tur ad to veje: via en valgt gruppe, eller som løst valg.
// Bruges både til pakkelisten og til statistikken over hvad der faktisk er brugt.
export function itemUidsPaaTur(tur: Tur, grupper: Gruppe[]): Set<Reference> {
  const uids = new Set<Reference>(tur.loese_item_ids);
  const grupperPrUid = new Map(grupper.map((gruppe) => [gruppe.uid, gruppe]));

  tur.gruppe_ids.forEach((gruppeUid) => {
    const gruppe = grupperPrUid.get(gruppeUid);
    gruppe?.item_ids.forEach((uid) => uids.add(uid));
  });

  return uids;
}

export function itemsPaaTur(tur: Tur, grupper: Gruppe[], items: Item[]): Item[] {
  const uids = itemUidsPaaTur(tur, grupper);
  return items.filter((i) => uids.has(i.uid));
}

export interface GruppeForslag {
  gruppe: Gruppe;
  // Hvor mange af gruppens tags der ramte turen.
  score: number;
  traf: string[];
  begrundelse: string;
}

// Turens kendetegn som tags. De er det gruppernes tags måles imod.
export function turensTags(tur: Tur): Set<string> {
  return new Set<string>([
    tur.overnatning,
    tur.aktivitet,
    tur.terraen,
    tur.personer > 1 ? 'gruppe' : 'solo'
  ]);
}

export function foreslaaGrupper(tur: Tur, grupper: Gruppe[]): GruppeForslag[] {
  const turTags = turensTags(tur);
  const turtekst = [...turTags].map(etiket).join(', ');

  return grupper
    .filter((g) => !tur.gruppe_ids.includes(g.uid))
    .map((g) => {
      const traf = g.tags.filter((t) => turTags.has(t));
      return {
        gruppe: g,
        score: traf.length,
        traf,
        begrundelse: `Turen er markeret ${turtekst}. ${g.navn} matcher på ${traf.length} af sine ${antal(g.tags.length, 'tag', 'tags')}: ${traf.map(etiket).join(', ')}.`
      };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

// ─────────────────────────────────────────────
// Stedsøgning
// DAWA dækker danske adresser og stednavne, open-meteo resten af verden.
// DAWA-resultater vises først, da turene typisk ligger i Danmark.
// ─────────────────────────────────────────────

export interface StedForslag {
  navn: string;
  detalje: string;
  lat: number;
  lng: number;
}

export async function soegSted(soegning: string): Promise<StedForslag[]> {
  const q = soegning.trim();
  if (q.length < 2) return [];

  const [dawaResultater, openMeteoResultater] = await Promise.all([
    soegDawa(q),
    soegOpenMeteo(q)
  ]);

  // Samme sted kan komme fra begge kilder — behold det første pr. koordinat.
  const set = new Set<string>();
  const unikke: StedForslag[] = [];
  for (const forslag of [...dawaResultater, ...openMeteoResultater]) {
    const noegle = `${forslag.lat.toFixed(3)},${forslag.lng.toFixed(3)}`;
    if (set.has(noegle)) continue;
    set.add(noegle);
    unikke.push(forslag);
  }

  return unikke.slice(0, 8);
}

interface GeocodingSvar {
  results?: {
    name?: string;
    admin1?: string;
    admin2?: string;
    country?: string;
    latitude?: number;
    longitude?: number;
  }[];
}

async function soegOpenMeteo(soegning: string): Promise<StedForslag[]> {
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(soegning)}&count=5&language=da&format=json`;
    const svar = await fetch(url);
    if (!svar.ok) return [];

    const data: GeocodingSvar = await svar.json();
    return (data.results ?? []).flatMap((r) => {
      if (typeof r.latitude !== 'number' || typeof r.longitude !== 'number') return [];
      return [{
        navn: r.name ?? 'Ukendt sted',
        detalje: [r.admin2, r.admin1, r.country].filter(Boolean).join(', '),
        lat: r.latitude,
        lng: r.longitude
      }];
    });
  } catch (e) {
    console.error('Open-Meteo sted-søgning fejl:', e);
    return [];
  }
}

async function soegDawa(soegning: string): Promise<StedForslag[]> {
  const [stednavne, adresser] = await Promise.all([
    hentDawaStednavne(soegning),
    hentDawaAdresser(soegning)
  ]);
  return [...stednavne, ...adresser];
}

interface DawaAdresse {
  tekst?: string;
  adresse?: { x?: number; y?: number };
}

async function hentDawaAdresser(soegning: string): Promise<StedForslag[]> {
  const data = await hentDawa<DawaAdresse>(
    `https://api.dataforsyningen.dk/adresser/autocomplete?q=${encodeURIComponent(soegning)}&per_side=5`
  );

  return data.flatMap((r) => {
    // DAWA angiver x som længdegrad og y som breddegrad.
    const lng = r.adresse?.x;
    const lat = r.adresse?.y;
    if (typeof lat !== 'number' || typeof lng !== 'number') return [];
    return [{ navn: r.tekst ?? 'Ukendt adresse', detalje: '', lat, lng }];
  });
}

interface DawaStednavn {
  navn?: string;
  skrivemaade?: string;
  undertype?: string;
  hovedtype?: string;
  visueltcenter?: number[];
}

async function hentDawaStednavne(soegning: string): Promise<StedForslag[]> {
  const data = await hentDawa<DawaStednavn>(
    `https://api.dataforsyningen.dk/stednavne2?q=${encodeURIComponent(soegning)}*&per_side=5`
  );

  return data.flatMap((r) => {
    const [lng, lat] = r.visueltcenter ?? [];
    if (typeof lat !== 'number' || typeof lng !== 'number') return [];
    return [{
      navn: r.navn ?? r.skrivemaade ?? 'Ukendt sted',
      detalje: r.undertype ?? r.hovedtype ?? '',
      lat,
      lng
    }];
  });
}

async function hentDawa<T>(url: string): Promise<T[]> {
  try {
    const svar = await fetch(url);
    if (!svar.ok) return [];
    const data: unknown = await svar.json();
    return Array.isArray(data) ? (data as T[]) : [];
  } catch (e) {
    console.error('DAWA sted-søgning fejl:', e);
    return [];
  }
}

// ─────────────────────────────────────────────
// Systemadvarsler på et enkelt item
// Wireframet viser flere slags; her er kun garanti, som er den eneste der kan
// afgøres af data appen allerede har. Resten hører til badge-motoren.
// ─────────────────────────────────────────────

// Garantidatoen er et fritekstfelt med formatet DD/MM/ÅÅÅÅ.
export function laesDanskDato(tekst: string): Date | null {
  const dele = tekst.trim().split('/');
  if (dele.length !== 3) return null;

  const [dag, maaned, aar] = dele.map(Number);
  if (!Number.isFinite(dag) || !Number.isFinite(maaned) || !Number.isFinite(aar)) return null;

  const dato = new Date(aar, maaned - 1, dag);
  // Fanger fx 31/02, hvor Date ellers ruller videre til marts.
  if (dato.getDate() !== dag || dato.getMonth() !== maaned - 1) return null;
  return dato;
}

export function dageTil(dato: Date, fra: Date = new Date()): number {
  const enDag = 1000 * 60 * 60 * 24;
  const start = new Date(fra.getFullYear(), fra.getMonth(), fra.getDate());
  const slut = new Date(dato.getFullYear(), dato.getMonth(), dato.getDate());
  return Math.round((slut.getTime() - start.getTime()) / enDag);
}

// Returnerer en besked hvis garantien er tæt på at udløbe eller allerede er
// udløbet — ellers null. Påmindelsesvinduet sættes pr. item.
export function garantiAdvarsel(item: Item, nu: Date = new Date()): string | null {
  const udloeber = item.garanti?.udloeber_dato ? laesDanskDato(item.garanti.udloeber_dato) : null;
  if (!udloeber) return null;

  const dage = dageTil(udloeber, nu);
  // Ordlyden følger wireframet: korte statuslinjer, ikke hele sætninger.
  if (dage < 0) return `Garanti udløb for ${Math.abs(dage)} dage siden`;
  if (dage === 0) return 'Garanti udløber i dag';

  const vindue = item.garanti?.paamindelse_dage || 30;
  if (dage > vindue) return null;
  return `Garanti udløber om ${dage} ${dage === 1 ? 'dag' : 'dage'}`;
}

// ─────────────────────────────────────────────
// Pakkelisten grupperet
// Wireframet viser pakkelisten opdelt med overskrifter frem for som én lang
// liste — efter gruppe, efter tag eller efter hvem der bærer hvad.
// ─────────────────────────────────────────────

export interface PakkelisteAfsnit {
  titel: string;
  items: Item[];
}

const efterVaegt = (a: Item, b: Item) => b.vaegt_g - a.vaegt_g;

export function pakkelisteEfterGruppe(tur: Tur, grupper: Gruppe[], pakItems: Item[]): PakkelisteAfsnit[] {
  const afsnit: PakkelisteAfsnit[] = [];
  const brugt = new Set<Reference>();

  tur.gruppe_ids.forEach((gruppeUid) => {
    const gruppe = grupper.find((g) => g.uid === gruppeUid);
    if (!gruppe) return;

    // Ligger et item i to valgte grupper, hører det til under den første. Ellers
    // stod det to steder på listen, og afsnitsvægtene talte det med to gange.
    const items = pakItems.filter((i) => !brugt.has(i.uid) && gruppe.item_ids.includes(i.uid));
    items.forEach((i) => brugt.add(i.uid));
    if (items.length > 0) afsnit.push({ titel: gruppe.navn, items: [...items].sort(efterVaegt) });
  });

  // Alt der ikke kom med via en gruppe står for sig selv.
  const loese = pakItems.filter((i) => !brugt.has(i.uid));
  if (loese.length > 0) afsnit.push({ titel: 'Løse items', items: [...loese].sort(efterVaegt) });

  return afsnit;
}

export function pakkelisteEfterTag(pakItems: Item[]): PakkelisteAfsnit[] {
  const efterTag = new Map<string, Item[]>();
  const utaggede: Item[] = [];

  pakItems.forEach((item) => {
    if (item.tags.length === 0) {
      utaggede.push(item);
      return;
    }
    // Et item med flere tags optræder under hvert af dem — det er sådan man
    // leder efter det.
    item.tags.forEach((tag) => efterTag.set(tag, [...(efterTag.get(tag) ?? []), item]));
  });

  const afsnit = [...efterTag.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], 'da'))
    .map(([titel, items]) => ({ titel, items: [...items].sort(efterVaegt) }));

  if (utaggede.length > 0) afsnit.push({ titel: 'Uden tag', items: [...utaggede].sort(efterVaegt) });
  return afsnit;
}

// ─────────────────────────────────────────────
// Hvem bærer hvad
//
// Et stykke gear har højst én bærer. Delt grej bæres af én selvom flere
// bruger det, og personligt grej er personligt — begge dele bliver forkerte,
// hvis det samme kan ligge to steder, for så tælles vægten med to gange.
//
// Deltagerlisten har to felter, fordi de to slags gear betyder noget
// forskelligt: baerer_delt_ids er "jeg slæber fællesteltet", og
// personligt_gear_ids er "det her er mit".
// ─────────────────────────────────────────────

export const IKKE_FORDELT = 'Ikke fordelt endnu';

// itemUid → deltagerens id.
export function baererAf(tur: Tur): Map<Reference, string> {
  const baerer = new Map<Reference, string>();

  tur.deltagere.forEach((d) => {
    d.personligt_gear_ids.forEach((uid) => baerer.set(uid, d.id));
    d.baerer_delt_ids.forEach((uid) => baerer.set(uid, d.id));
  });

  return baerer;
}

export function pakkelisteEfterPerson(tur: Tur, pakItems: Item[]): PakkelisteAfsnit[] {
  const baerer = baererAf(tur);
  const afsnit: PakkelisteAfsnit[] = [];

  tur.deltagere.forEach((d) => {
    const items = pakItems.filter((i) => baerer.get(i.uid) === d.id);
    if (items.length > 0) {
      afsnit.push({ titel: d.navn || 'Uden navn', items: [...items].sort(efterVaegt) });
    }
  });

  // Resten står til sidst — det er den bunke man skal have fordelt.
  const tilbage = pakItems.filter((i) => !baerer.has(i.uid));
  if (tilbage.length > 0) {
    afsnit.push({ titel: IKKE_FORDELT, items: [...tilbage].sort(efterVaegt) });
  }

  return afsnit;
}

export interface Baerevaegt {
  id: string;
  navn: string;
  vaegt_g: number;
  antal: number;
}

// Hvad hver deltager faktisk kommer til at slæbe. Det er noget andet end
// gennemsnittet: har én taget teltet, bærer den person mere end de andre.
export function vaegtPrDeltager(tur: Tur, pakItems: Item[]): Baerevaegt[] {
  const baerer = baererAf(tur);

  return tur.deltagere.map((d) => {
    const items = pakItems.filter((i) => baerer.get(i.uid) === d.id);
    return {
      id: d.id,
      navn: d.navn || 'Uden navn',
      vaegt_g: items.reduce((s, i) => s + i.vaegt_g, 0),
      antal: items.length
    };
  });
}

// Slår et stykke gear til eller fra hos en deltager. Var det tildelt en
// anden, flytter det med — ellers ville vægten tælle det to gange.
export function tildelGear(deltagere: Deltager[], deltagerId: string, item: Item): Deltager[] {
  const felt = item.delt ? 'baerer_delt_ids' : 'personligt_gear_ids';
  const havdeDet = deltagere.some((d) => d.id === deltagerId && d[felt].includes(item.uid));

  return deltagere.map((d) => ({
    ...d,
    // Fjern fra begge lister overalt: skiftede itemet mellem delt og
    // personligt, kan det ligge i den forkerte.
    personligt_gear_ids: d.personligt_gear_ids.filter((uid) => uid !== item.uid),
    baerer_delt_ids: d.baerer_delt_ids.filter((uid) => uid !== item.uid),
    ...(d.id === deltagerId && !havdeDet ? { [felt]: [...d[felt].filter((uid) => uid !== item.uid), item.uid] } : {})
  }));
}

// ─────────────────────────────────────────────
// Sover alle et sted?
//
// Deltagerne kan hver især have en anden overnatningsform end turens — én
// hænger i hængekøje, en anden ligger i telt. Det er kun værd at advare om,
// når nogen selv har valgt formen: ellers ville enhver tur uden de rigtige
// tags få en advarsel, den ikke har fortjent.
// ─────────────────────────────────────────────

// Et shelter står i skoven, og "blandet" er ikke et krav om noget bestemt.
// Telt og hængekøje skal man selv have med.
const OVERNATNING_KRAEVER_GREJ: Overnatning[] = ['telt', 'haengekoeje'];

// Værdien hedder "haengekoeje" i basen og "hængekøje" på skærmen, og brugeren
// skriver sine tags i hånden — nogle med tegn, nogle uden. Alle tre stavemåder
// skæres ned til den samme, så "hængekøje", "haengekoeje" og "hangekoje" er ét
// og det samme ord. Ellers bad advarslen om et tag, den selv ville afvise.
function udenSaerlige(tekst: string): string {
  return tekst
    .toLowerCase()
    .replace(/æ/g, 'a')
    .replace(/ø/g, 'o')
    .replace(/å/g, 'a')
    .replace(/ae/g, 'a')
    .replace(/oe/g, 'o')
    .replace(/aa/g, 'a');
}

// Har turen noget, der dækker den her måde at sove på?
//
// Både tagget og navnet tæller. Kun at se på tags gjorde et item der hedder
// "TTTM Hængekøje" usynligt, og så stod advarslen og lyste, mens hængekøjen lå
// på listen. Navnet kan i sjældne tilfælde snyde — "teltunderlag" ligner et
// telt — men at overse en advarsel er mildere end en advarsel man ikke kan få
// til at gå væk.
function daekker(item: Item, form: Overnatning): boolean {
  const soegt = udenSaerlige(form);
  return item.tags.some((t) => udenSaerlige(t) === soegt) || udenSaerlige(item.navn).includes(soegt);
}

export function overnatningsAdvarsler(tur: Tur, pakItems: Item[]): Advarsel[] {
  // Grupperet, så tre teltsovere giver én advarsel og ikke tre.
  const navnePrForm = new Map<Overnatning, string[]>();

  tur.deltagere.forEach((d) => {
    if (!d.overnatning || !OVERNATNING_KRAEVER_GREJ.includes(d.overnatning)) return;
    if (pakItems.some((i) => daekker(i, d.overnatning!))) return;
    navnePrForm.set(d.overnatning, [...(navnePrForm.get(d.overnatning) ?? []), d.navn || 'En deltager']);
  });

  return [...navnePrForm.entries()].map(([form, navne]) => ({
    niveau: 'roed' as const,
    besked: `${navne.join(' og ')} sover i ${etiket(form)}`,
    detalje: `Intet gear på turen hedder eller er tagget "${etiket(form)}". Sæt tagget på det gear der dækker, eller tilføj det til listen.`,
    itemUid: '',
    mangler: etiket(form),
    begrundelse: `Reglen: en deltager der sover i telt eller hængekøje skal have gear der dækker — shelter står i skoven, og "blandet" er ikke et krav om noget bestemt. ${antal(pakItems.length, 'stykke gear', 'stykker gear')} på turen blev gennemgået, både på navn og på tags, og intet af dem svarer til "${etiket(form)}".`
  }));
}

// ─────────────────────────────────────────────
// Én fælles pakkeliste
//
// Pakkelisten rummer to slags gear: turens eget, som ejeren har valgt fra sit
// inventar, og det deltagerne selv tager med. De skal stå i den samme liste —
// det er hele pointen med at pakke sammen — men de kommer fra hver sin kilde
// og kan ikke være den samme type. En Pakkelinje er det de har til fælles.
// ─────────────────────────────────────────────

export interface Pakkelinje {
  // Ejerens uid. Tom for en deltagers eget grej, som ikke findes i hendes base.
  uid: Reference;
  navn: string;
  vaegt_g: number;
  delt: boolean;
  // Navnet på den der tager det med. Tom når det ikke er fordelt endnu.
  baerer: string;
  // Turens eget gear, eller noget en deltager selv har meldt ind.
  egen: boolean;
}

export const DELTAGERNES = 'Deltagernes eget grej';

export function linjeAfItem(item: Item, baerer = ''): Pakkelinje {
  return { uid: item.uid, navn: item.navn, vaegt_g: item.vaegt_g, delt: item.delt, baerer, egen: true };
}

// En deltagers eget grej. Det har ingen uid — det ligger i hendes inventar og
// ikke i ejerens, og kun navn og vægt er delt.
export function linjeAfMedbragt(navn: string, vaegt_g: number, baerer: string): Pakkelinje {
  return { uid: '', navn, vaegt_g, delt: false, baerer, egen: false };
}

const tungestFoerst = (a: Pakkelinje, b: Pakkelinje) => b.vaegt_g - a.vaegt_g;

export interface Pakkeafsnit {
  titel: string;
  linjer: Pakkelinje[];
}

// Efter hvem der tager det med. Det er den opdeling man pakker efter: man vil
// se sin egen bunke, ikke alles.
export function linjerEfterPerson(linjer: Pakkelinje[]): Pakkeafsnit[] {
  const pr = new Map<string, Pakkelinje[]>();
  const uden: Pakkelinje[] = [];

  linjer.forEach((l) => {
    if (!l.baerer) { uden.push(l); return; }
    pr.set(l.baerer, [...(pr.get(l.baerer) ?? []), l]);
  });

  const afsnit = [...pr.entries()].map(([titel, egne]) => ({
    titel,
    linjer: [...egne].sort(tungestFoerst)
  }));

  // Den ufordelte bunke står til sidst — det er den der mangler en beslutning.
  if (uden.length > 0) afsnit.push({ titel: IKKE_FORDELT, linjer: [...uden].sort(tungestFoerst) });
  return afsnit;
}

// Alt på én liste, tungest først.
//
// Specens §8 har den som den første chip, og den er der en grund til: de
// andre opdelinger er gode til at pakke efter, men når man leder efter én
// bestemt ting, er en flad liste den korteste vej.
export const ALT_PAA_TUREN = 'Alt på turen';

export function linjerSamlet(linjer: Pakkelinje[]): Pakkeafsnit[] {
  if (linjer.length === 0) return [];
  return [{ titel: ALT_PAA_TUREN, linjer: [...linjer].sort(tungestFoerst) }];
}

// Fælles og personligt hver for sig.
//
// Det er den opdeling, der afgør en samtale inden afgang: fællesgrejet skal
// nogen bære, og det personlige skal hver især selv huske. Deltagernes eget
// grej står for sig — det er personligt, men det er ikke ens eget at pakke.
export const FAELLES = 'Fælles';
export const PERSONLIGT = 'Personligt';

export function linjerEfterDeling(linjer: Pakkelinje[]): Pakkeafsnit[] {
  const afsnit: Pakkeafsnit[] = [];
  const laeg = (titel: string, valgte: Pakkelinje[]) => {
    if (valgte.length > 0) afsnit.push({ titel, linjer: [...valgte].sort(tungestFoerst) });
  };

  laeg(FAELLES, linjer.filter((l) => l.egen && l.delt));
  laeg(PERSONLIGT, linjer.filter((l) => l.egen && !l.delt));
  laeg(DELTAGERNES, linjer.filter((l) => !l.egen));

  return afsnit;
}

// Søgningen.
//
// Den leder i navnet, i den der bærer det, og i afsnittets egen overskrift —
// søger man på et grejsæt eller et tag, er det hele afsnittet, man mener, og
// ikke kun de ting der tilfældigvis hedder det samme.
//
// Afsnit uden træffere falder væk. En liste med tomme overskrifter er sværere
// at læse end en kort liste.
export function filtrerAfsnit(afsnit: Pakkeafsnit[], soegning: string): Pakkeafsnit[] {
  const ord = soegning.trim().toLowerCase();
  if (ord === '') return afsnit;

  return afsnit
    .map((a) => (
      a.titel.toLowerCase().includes(ord)
        ? a
        : { ...a, linjer: a.linjer.filter((l) => rammer(l, ord)) }
    ))
    .filter((a) => a.linjer.length > 0);
}

function rammer(linje: Pakkelinje, ord: string): boolean {
  return linje.navn.toLowerCase().includes(ord) || linje.baerer.toLowerCase().includes(ord);
}

// Deltagernes eget grej hører ikke til i nogen af ejerens grupper eller tags.
// Det får sit eget afsnit til sidst, så de to andre opdelinger stadig kan
// bruges uden at noget falder ud af listen.
export function medDeltagernes(afsnit: Pakkeafsnit[], linjer: Pakkelinje[]): Pakkeafsnit[] {
  const fremmede = linjer.filter((l) => !l.egen);
  if (fremmede.length === 0) return afsnit;
  return [...afsnit, { titel: DELTAGERNES, linjer: [...fremmede].sort(tungestFoerst) }];
}

export function afsnitAfItems(afsnit: PakkelisteAfsnit[], baerernavne: Map<Reference, string>): Pakkeafsnit[] {
  return afsnit.map((a) => ({
    titel: a.titel,
    linjer: a.items.map((i) => linjeAfItem(i, baerernavne.get(i.uid) ?? ''))
  }));
}

export function samletVaegt(linjer: Pakkelinje[]): number {
  return linjer.reduce((s, l) => s + l.vaegt_g, 0);
}
