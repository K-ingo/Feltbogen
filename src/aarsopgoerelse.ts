import type { Item, Sted, Tur } from './db';
import { etiket } from './db';
import type { VejrDag, VejrData } from './smartMotor';
import { koebsaar } from './statistik';

// Årsopgørelsen: året talt op og set efter.
//
// Alt herinde er aggregation over data appen allerede har — der kommer ingen
// nye felter af det. Til gengæld skal tallene kunne stoles på, og derfor står
// reglerne skrevet ud hvor de er til at tage fejl af: hvad der tælles med,
// hvad der ikke gør, og hvad der er målt frem for meldt.

// En kladde er en plan man aldrig gjorde færdig. Året handler om det der
// skete, så kladder tælles ikke med — resten gør, også en tur man glemte at
// sætte til afsluttet. At tælle efter status alene ville gøre opgørelsen
// afhængig af oprydning, og så ville den lyve om et helt år.
export function tureIAaret(ture: Tur[], aar: number): Tur[] {
  return ture
    .filter((t) => t.status !== 'kladde' && aarAf(t.startdato) === aar)
    .sort((a, b) => a.startdato.localeCompare(b.startdato));
}

// Året der er værd at vise frem på dashboardet, eller null.
//
// Kun i januar, og kun hvis der var noget sidste år. Et tilbageblik hører til
// når året lige er lukket; et kort der bliver stående til juni er ikke et
// tilbageblik, men møbel. Resten af året står opgørelsen under Statistik,
// hvor man selv kan gå hen efter den.
export function aarsopgoerelseAtSe(ture: Tur[], nu: Date = new Date()): number | null {
  if (nu.getMonth() !== 0) return null;

  const sidsteAar = nu.getFullYear() - 1;
  return tureIAaret(ture, sidsteAar).length > 0 ? sidsteAar : null;
}

// Årene der er noget at fortælle om, nyeste først.
export function aarMedTure(ture: Tur[]): number[] {
  const aar = new Set<number>();
  for (const t of ture) {
    if (t.status === 'kladde') continue;
    const a = aarAf(t.startdato);
    if (a !== null) aar.add(a);
  }
  return [...aar].sort((a, b) => b - a);
}

function aarAf(dato: string): number | null {
  if (!dato) return null;
  const d = new Date(dato);
  return Number.isNaN(d.getTime()) ? null : d.getFullYear();
}

export interface Aarstal {
  aar: number;
  ture: number;
  naetter: number;
  // Døgn ude. En tur med tre nætter er fire dage ude, og en dagstur er én.
  dage: number;
  km: number;
  nytGrej: number;
  nytGrejKr: number;
  feltnoter: number;
  rejsefaeller: number;
}

export function aarstalFor(ture: Tur[], items: Item[], aar: number): Aarstal {
  const aarets = tureIAaret(ture, aar);
  const nyt = items.filter((i) => i.status !== 'solgt' && koebsaar(i.koebsdato) === aar);

  return {
    aar,
    ture: aarets.length,
    naetter: aarets.reduce((s, t) => s + t.naetter, 0),
    dage: aarets.reduce((s, t) => s + t.naetter + 1, 0),
    km: aarets.reduce((s, t) => s + t.baereafstand_km, 0),
    nytGrej: nyt.length,
    nytGrejKr: nyt.reduce((s, i) => s + i.pris_kr * i.antal, 0),
    feltnoter: aarets.reduce((s, t) => s + (t.feltnoter?.length ?? 0), 0),
    rejsefaeller: rejsefaeller(aarets).length
  };
}

// ─────────────────────────────────────────────
// Højdepunkter
// ─────────────────────────────────────────────

export interface Hoejdepunkt {
  tur: Tur;
  tal: number;
}

export function laengsteTur(ture: Tur[]): Hoejdepunkt | null {
  return bedste(ture.filter((t) => t.naetter > 0), (t) => t.naetter);
}

export function laengsteBaering(ture: Tur[]): Hoejdepunkt | null {
  return bedste(ture.filter((t) => t.baereafstand_km > 0), (t) => t.baereafstand_km);
}

function bedste(ture: Tur[], af: (t: Tur) => number): Hoejdepunkt | null {
  let vinder: Hoejdepunkt | null = null;
  for (const tur of ture) {
    const tal = af(tur);
    if (!vinder || tal > vinder.tal) vinder = { tur, tal };
  }
  return vinder;
}

// ─────────────────────────────────────────────
// Vejret
//
// Vigtigt forbehold: `vejrsnapshot` er den udsigt der blev hentet da turen
// blev planlagt — ikke en måling. Den koldeste nat i året er derfor den
// koldeste nat der var *meldt*, og det skal stå på skærmen. Appen har ingen
// termometer-aflæsninger, og at lade som om den har, ville være at opfinde
// data. Feltnoterne er stedet hvor det faktisk oplevede står.
// ─────────────────────────────────────────────

// Dagene i udsigten der ligger inden for turen. Snapshottet kan strække sig
// længere end turen — open-meteo leverer en uge ad gangen — og de dage hører
// ikke til her.
export function vejrPaaTuren(tur: Tur): VejrDag[] {
  if (!tur.vejrsnapshot) return [];

  let data: VejrData;
  try {
    data = JSON.parse(tur.vejrsnapshot) as VejrData;
  } catch {
    return [];
  }
  if (!Array.isArray(data?.dage)) return [];

  const slut = tur.slutdato || tur.startdato;
  return data.dage.filter((d) =>
    typeof d?.dato === 'string'
    && (!tur.startdato || d.dato >= tur.startdato)
    && (!slut || d.dato <= slut));
}

export interface KoldNat {
  tur: Tur;
  dato: string;
  grader: number;
}

export function koldesteNat(ture: Tur[]): KoldNat | null {
  let koldest: KoldNat | null = null;

  for (const tur of ture) {
    for (const dag of vejrPaaTuren(tur)) {
      if (typeof dag.temp_min !== 'number') continue;
      if (!koldest || dag.temp_min < koldest.grader) {
        koldest = { tur, dato: dag.dato, grader: dag.temp_min };
      }
    }
  }
  return koldest;
}

export interface VaadTur {
  tur: Tur;
  mm: number;
}

export function vaadesteTur(ture: Tur[]): VaadTur | null {
  let vaadest: VaadTur | null = null;

  for (const tur of ture) {
    const dage = vejrPaaTuren(tur);
    if (dage.length === 0) continue;

    const mm = dage.reduce((s, d) => s + (typeof d.nedboer_mm === 'number' ? d.nedboer_mm : 0), 0);
    if (mm > 0 && (!vaadest || mm > vaadest.mm)) vaadest = { tur, mm };
  }
  return vaadest;
}

// ─────────────────────────────────────────────
// Steder, selskab og grej
// ─────────────────────────────────────────────

export interface Stedbesoeg {
  navn: string;
  ture: number;
  naetter: number;
}

// Steder tælles på uid når turen er koblet til kartoteket, og ellers på den
// fritekst der står på turen. Det er ikke perfekt — "Rold Skov" og "rold skov"
// bliver to — men et sted man har skrevet i hånden er stadig et sted man var.
export function mestBesoegte(ture: Tur[], steder: Sted[]): Stedbesoeg[] {
  const navne = new Map(steder.map((s) => [s.uid, s.navn]));
  const talt = new Map<string, Stedbesoeg>();

  for (const tur of ture) {
    const navn = (tur.sted_uid && navne.get(tur.sted_uid)) || tur.sted.trim();
    if (!navn) continue;

    const noegle = tur.sted_uid || navn.toLowerCase();
    const foer = talt.get(noegle) ?? { navn, ture: 0, naetter: 0 };
    talt.set(noegle, { navn: foer.navn, ture: foer.ture + 1, naetter: foer.naetter + tur.naetter });
  }

  return [...talt.values()]
    .sort((a, b) => (b.ture - a.ture) || (b.naetter - a.naetter));
}

export interface Rejsefaelle {
  navn: string;
  ture: number;
}

// Dem man var afsted med. Samme kobling som steder: person_uid når den findes,
// ellers navnet som det står skrevet.
export function rejsefaeller(ture: Tur[]): Rejsefaelle[] {
  const talt = new Map<string, Rejsefaelle>();

  for (const tur of ture) {
    // Den samme person kan stå to gange på en tur; det gør hende ikke til to.
    const paaTuren = new Set<string>();

    for (const d of tur.deltagere ?? []) {
      const navn = d.navn.trim();
      if (!navn) continue;

      const noegle = d.person_uid || navn.toLowerCase();
      if (paaTuren.has(noegle)) continue;
      paaTuren.add(noegle);

      const foer = talt.get(noegle);
      talt.set(noegle, { navn: foer?.navn ?? navn, ture: (foer?.ture ?? 0) + 1 });
    }
  }

  return [...talt.values()]
    .sort((a, b) => (b.ture - a.ture) || a.navn.localeCompare(b.navn, 'da'));
}

export interface Andel {
  vaerdi: string;
  antal: number;
}

// Fordelingen på et af turens kendetegn — hvad året mest bestod af.
export function fordeling(ture: Tur[], af: (t: Tur) => string): Andel[] {
  const talt = new Map<string, number>();
  for (const t of ture) {
    const v = af(t);
    if (v) talt.set(v, (talt.get(v) ?? 0) + 1);
  }

  return [...talt.entries()]
    .map(([vaerdi, antal]) => ({ vaerdi: etiket(vaerdi), antal }))
    .sort((a, b) => (b.antal - a.antal) || a.vaerdi.localeCompare(b.vaerdi, 'da'));
}

// ─────────────────────────────────────────────
// Sætningen der samler året
// ─────────────────────────────────────────────

// Overskriften. Et år uden ture skal ikke få en jubelsætning, og et år med én
// tur skal ikke stå i flertal.
export function aarsoverskrift(tal: Aarstal): string {
  if (tal.ture === 0) return 'Ingen ture det år.';

  const ture = tal.ture === 1 ? 'Én tur' : `${tal.ture} ture`;
  if (tal.naetter === 0) return `${ture}, alle hjemme igen samme dag.`;

  const naetter = tal.naetter === 1 ? 'én nat' : `${tal.naetter} nætter`;
  return `${ture} og ${naetter} ude.`;
}
