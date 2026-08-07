import { PAK_AF_STATUS } from './db';
import type {
  Gruppe,
  Item,
  KategoriNote,
  KategoriVurdering,
  PakAfLinje,
  PakAfNiveau,
  PakAfStatus,
  PakAfTjek,
  Reference,
  Tur
} from './db';
import { pakkelisteEfterGruppe, dageTil } from './smartMotor';

// Efterregnskabet på en tur: hvad blev brugt, hvad lå urørt i bunden af
// sækken, og hvad gik i stykker. Det er den ene ting der gør smart-motoren i
// stand til at lære frem for bare at regne — se fundamentets §8.
//
// Alt herinde er rene funktioner. Skærmen holder ingen tilstand af sig selv;
// den sender et tjek ind og får et nyt tilbage.

// Hvor mange dage der må gå efter slutdatoen, før et manglende tjek regnes som
// noget der haster. Hjemme fra en tur er der pakket ud og vasket op først.
export const PAK_AF_FRIST_DAGE = 3;

// Det almindelige udfald er at gearet blev brugt — det er derfor man tog det
// med. Alle linjer starter der, så et let tjek er de få tryk hvor man afviger,
// og ikke ét tryk pr. item.
const STANDARD_STATUS: PakAfStatus = 'brugt';

export function nytPakAfTjek(
  pakItems: Item[],
  niveau: PakAfNiveau = 'let',
  nu: Date = new Date()
): PakAfTjek {
  return {
    udfyldt_dato: nu.toISOString(),
    niveau,
    linjer: pakItems.map((i) => ({ item_uid: i.uid, status: STANDARD_STATUS }))
  };
}

// Pakkelisten kan være rettet efter tjekket blev lavet. Læg linjer til det der
// er kommet med, og smid dem væk der peger på gear der ikke var på turen.
//
// Er der intet at rette, kommer det samme objekt tilbage — så kan kalderen
// nøjes med at gemme når der faktisk skete noget.
export function synkroniserLinjer(tjek: PakAfTjek, pakItems: Item[]): PakAfTjek {
  const paaTuren = pakItems.map((i) => i.uid);
  const kendte = new Map(tjek.linjer.map((l) => [l.item_uid, l]));

  const linjer = paaTuren.map(
    (uid) => kendte.get(uid) ?? { item_uid: uid, status: STANDARD_STATUS }
  );

  const uaendret =
    linjer.length === tjek.linjer.length && linjer.every((l, i) => l === tjek.linjer[i]);

  return uaendret ? tjek : { ...tjek, linjer };
}

export function statusFor(tjek: PakAfTjek, itemUid: Reference): PakAfStatus {
  return tjek.linjer.find((l) => l.item_uid === itemUid)?.status ?? STANDARD_STATUS;
}

export function noterFor(tjek: PakAfTjek, itemUid: Reference): string {
  return tjek.linjer.find((l) => l.item_uid === itemUid)?.noter ?? '';
}

// Skriver én linje. Findes den ikke — fordi gearet kom til efter tjekket blev
// lavet — lægges den til bagest.
function medLinje(tjek: PakAfTjek, itemUid: Reference, aendringer: Partial<PakAfLinje>): PakAfTjek {
  const findes = tjek.linjer.some((l) => l.item_uid === itemUid);

  const linjer = findes
    ? tjek.linjer.map((l) => (l.item_uid === itemUid ? { ...l, ...aendringer } : l))
    : [...tjek.linjer, { item_uid: itemUid, status: STANDARD_STATUS, ...aendringer }];

  return { ...tjek, linjer };
}

export function saetStatus(tjek: PakAfTjek, itemUid: Reference, status: PakAfStatus): PakAfTjek {
  return medLinje(tjek, itemUid, { status });
}

// Tomme noter fjernes frem for at blive gemt som tom streng — så bærer et let
// tjek ikke rundt på felter det aldrig har brugt.
export function saetLinjenoter(tjek: PakAfTjek, itemUid: Reference, noter: string): PakAfTjek {
  const opdateret = medLinje(tjek, itemUid, { noter });
  if (noter.trim() !== '') return opdateret;

  return {
    ...opdateret,
    linjer: opdateret.linjer.map((l) => {
      if (l.item_uid !== itemUid) return l;
      const { noter: _fjernet, ...uden } = l;
      void _fjernet;
      return uden;
    })
  };
}

export function kategoriNoteFor(tjek: PakAfTjek, kategori: string): KategoriNote | null {
  return tjek.kategori_noter?.find((n) => n.kategori === kategori) ?? null;
}

export function saetKategoriNote(
  tjek: PakAfTjek,
  kategori: string,
  aendringer: Partial<Omit<KategoriNote, 'kategori'>>
): PakAfTjek {
  const nuvaerende = tjek.kategori_noter ?? [];
  const findes = nuvaerende.some((n) => n.kategori === kategori);

  const kategori_noter = findes
    ? nuvaerende.map((n) => (n.kategori === kategori ? { ...n, ...aendringer } : n))
    : [
        ...nuvaerende,
        { kategori, vurdering: 'tilstraekkeligt' as KategoriVurdering, noter: '', ...aendringer }
      ];

  return { ...tjek, kategori_noter };
}

export function saetNiveau(tjek: PakAfTjek, niveau: PakAfNiveau): PakAfTjek {
  return { ...tjek, niveau };
}

// Kategorierne følger pakkelisten som den er grupperet på turen — det er den
// inddeling man alligevel har foran sig, når man pakker af.
export function kategorierPaaTur(tur: Tur, grupper: Gruppe[], pakItems: Item[]): string[] {
  return pakkelisteEfterGruppe(tur, grupper, pakItems).map((a) => a.titel);
}

export type Opsummering = Record<PakAfStatus, number>;

export function opsummering(tjek: PakAfTjek): Opsummering {
  const tal: Opsummering = { brugt: 0, ubrugt: 0, i_stykker: 0 };
  tjek.linjer.forEach((l) => {
    if (PAK_AF_STATUS.includes(l.status)) tal[l.status] += 1;
  });
  return tal;
}

// "12 brugt · 3 ubrugte · 1 i stykker" — kun det der faktisk er noget af, så
// et tjek uden skader ikke reklamerer med et nul.
export function resumetekst(tjek: PakAfTjek): string {
  const tal = opsummering(tjek);

  return [
    tal.brugt > 0 ? `${tal.brugt} brugt` : null,
    tal.ubrugt > 0 ? `${tal.ubrugt} ${tal.ubrugt === 1 ? 'ubrugt' : 'ubrugte'}` : null,
    tal.i_stykker > 0 ? `${tal.i_stykker} i stykker` : null
  ]
    .filter(Boolean)
    .join(' · ') || 'Intet gear på listen';
}

// ─────────────────────────────────────────────
// Hvad tjekkene siger om ét stykke gear
// ─────────────────────────────────────────────

export interface Brug {
  // Ture hvor gearet stod på et udfyldt pak-af-tjek.
  gjort_op: number;
  brugt: number;
  i_stykker: number;
}

// "brugt 5 af 8 gange". Kun ture der er gjort op tæller med — en tur uden
// pak-af-tjek ved ingenting om gearet, og at tælle den som ubrugt ville gøre
// alt gear til hyldevarer.
export function brugPrItem(ture: Tur[]): Map<Reference, Brug> {
  const brug = new Map<Reference, Brug>();

  ture.forEach((tur) => {
    tur.pak_af_tjek?.linjer.forEach((linje) => {
      const nuvaerende = brug.get(linje.item_uid) ?? { gjort_op: 0, brugt: 0, i_stykker: 0 };
      brug.set(linje.item_uid, {
        gjort_op: nuvaerende.gjort_op + 1,
        brugt: nuvaerende.brugt + (linje.status === 'brugt' ? 1 : 0),
        i_stykker: nuvaerende.i_stykker + (linje.status === 'i_stykker' ? 1 : 0)
      });
    });
  });

  return brug;
}

// ─────────────────────────────────────────────
// Hvornår mangler tjekket
// ─────────────────────────────────────────────

// En afsluttet tur uden efterregnskab. Kladder og ture der ikke er kørt endnu
// er ikke bagud med noget.
export function manglerPakAfTjek(tur: Tur): boolean {
  return tur.status === 'afsluttet' && !tur.pak_af_tjek;
}

// Dage siden turen sluttede. Negativt tal betyder at slutdatoen ligger forude;
// null når turen ingen datoer har.
export function dageSidenSlut(tur: Tur, nu: Date = new Date()): number | null {
  const slut = tur.slutdato || tur.startdato;
  if (!slut) return null;

  const dato = new Date(slut);
  if (Number.isNaN(dato.getTime())) return null;

  // Dage fra slutdatoen frem til i dag — altså den modsatte vej af den
  // sædvanlige. Vendt om som fortegn ville dagen selv give -0.
  return dageTil(nu, dato);
}
