import type { AfgangsLinje, AfgangsTjek } from './db';

// Afgangs-tjeklisten: alt det man glemmer, som ikke er gear.
//
// Pakkelisten dækker det man kan veje. Det her er resten — nøgler, en besked
// til den derhjemme, om der er bålforbud. Det bor i hovedet i dag, og hovedet
// er et dårligt sted at gemme noget man kun bruger fire gange om året.

// Standardskabelonen. Den er kort med vilje: en liste man ikke gider læse, er
// en liste man krydser af uden at kigge.
export const STANDARD_SKABELON: readonly string[] = [
  'Nøgler',
  'Telefon fuldt opladet',
  'Sagt hvor jeg er, og hvornår jeg er hjemme',
  'Tjekket bålforbud og skovbrandindeks',
  'Vejrudsigten set inden for det sidste døgn',
  'Medicin og førstehjælp med'
];

function nyLinje(tekst: string, fra_skabelon: boolean): AfgangsLinje {
  return { id: crypto.randomUUID(), tekst, afkrydset: false, fra_skabelon };
}

export function nytAfgangsTjek(skabelon: readonly string[] = STANDARD_SKABELON): AfgangsTjek {
  return { linjer: skabelon.map((t) => nyLinje(t, true)) };
}

export function saetAfkrydset(tjek: AfgangsTjek, id: string, afkrydset: boolean): AfgangsTjek {
  return {
    ...tjek,
    linjer: tjek.linjer.map((l) => (l.id === id ? { ...l, afkrydset } : l))
  };
}

export function saetTekst(tjek: AfgangsTjek, id: string, tekst: string): AfgangsTjek {
  return {
    ...tjek,
    linjer: tjek.linjer.map((l) => (l.id === id ? { ...l, tekst } : l))
  };
}

// Tomme linjer lægges ikke til — en tom linje er ikke en huskeliste, den er
// støj man skal krydse af alligevel.
export function tilfoejLinje(tjek: AfgangsTjek, tekst: string): AfgangsTjek {
  if (!tekst.trim()) return tjek;
  return { ...tjek, linjer: [...tjek.linjer, nyLinje(tekst.trim(), false)] };
}

export function fjernLinje(tjek: AfgangsTjek, id: string): AfgangsTjek {
  return { ...tjek, linjer: tjek.linjer.filter((l) => l.id !== id) };
}

// Skabelonen er rettet siden listen blev lavet. Læg det nye til uden at røre
// det man allerede har krydset af, og uden at fjerne egne linjer.
export function fletSkabelonInd(
  tjek: AfgangsTjek,
  skabelon: readonly string[] = STANDARD_SKABELON
): AfgangsTjek {
  const kendte = new Set(tjek.linjer.map((l) => l.tekst.trim().toLowerCase()));
  const nye = skabelon
    .filter((t) => t.trim() && !kendte.has(t.trim().toLowerCase()))
    .map((t) => nyLinje(t.trim(), true));

  return nye.length === 0 ? tjek : { ...tjek, linjer: [...tjek.linjer, ...nye] };
}

export interface Fremdrift {
  afkrydsede: number;
  ialt: number;
  faerdig: boolean;
}

export function fremdrift(tjek: AfgangsTjek | null): Fremdrift {
  const linjer = tjek?.linjer ?? [];
  const afkrydsede = linjer.filter((l) => l.afkrydset).length;

  return {
    afkrydsede,
    ialt: linjer.length,
    // En tom liste er ikke færdig — der er ingenting at være færdig med.
    faerdig: linjer.length > 0 && afkrydsede === linjer.length
  };
}

// "4 af 6" — eller hvad der står på sektionsoverskriften når listen er foldet.
export function fremdriftstekst(tjek: AfgangsTjek | null): string {
  const { afkrydsede, ialt, faerdig } = fremdrift(tjek);

  if (ialt === 0) return 'Ikke taget i brug';
  return faerdig ? 'Alt afkrydset' : `${afkrydsede} af ${ialt}`;
}

// De punkter der mangler. Bruges på på-tur-skærmen, hvor der kun er plads til
// det man ikke har styr på endnu.
export function manglende(tjek: AfgangsTjek | null): AfgangsLinje[] {
  return (tjek?.linjer ?? []).filter((l) => !l.afkrydset);
}

// ─────────────────────────────────────────────
// Skabelonen i indstillingerne
// ─────────────────────────────────────────────

// Skabelonen gemmes som JSON i indstillingstabellen, der kun kan tekst. Kan
// den ikke læses, er standarden bedre end en tom liste.
export function laesSkabelon(raa: string | null | undefined): string[] {
  if (!raa) return [...STANDARD_SKABELON];

  try {
    const v = JSON.parse(raa);
    if (!Array.isArray(v)) return [...STANDARD_SKABELON];
    return v.map(String).map((t) => t.trim()).filter(Boolean);
  } catch {
    return [...STANDARD_SKABELON];
  }
}

export function skrivSkabelon(linjer: string[]): string {
  return JSON.stringify(linjer.map((t) => t.trim()).filter(Boolean));
}
