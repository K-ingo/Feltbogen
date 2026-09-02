// Datoer skrevet ud på dansk. Ligger for sig selv, fordi både turskærmen,
// gæstesiden og en gemt delt tur skriver den samme periode ud — og fordi
// datoregning er nemmere at teste uden en komponent omkring sig.

const MAANEDER = [
  'januar', 'februar', 'marts', 'april', 'maj', 'juni',
  'juli', 'august', 'september', 'oktober', 'november', 'december'
];

const DAGE_KORT = ['søn', 'man', 'tir', 'ons', 'tor', 'fre', 'lør'];

// "2026-07-21" + "2026-07-23" → "21.–23. juli". Går perioden over et
// månedsskifte, skrives måneden ud begge steder.
export function formatterPeriode(start: string, slut: string): string {
  const fra = new Date(start);
  if (!start || Number.isNaN(fra.getTime())) return '';

  const til = slut ? new Date(slut) : fra;
  const fuld = (d: Date) => `${d.getDate()}. ${MAANEDER[d.getMonth()]}`;

  if (!slut || Number.isNaN(til.getTime()) || fra.getTime() === til.getTime()) return fuld(fra);
  if (fra.getMonth() === til.getMonth() && fra.getFullYear() === til.getFullYear()) {
    return `${fra.getDate()}.–${fuld(til)}`;
  }
  return `${fuld(fra)} – ${fuld(til)}`;
}

// "2026-07-21" → "tir 21/7". Til vejrudsigtens rækker, hvor der kun er plads
// til et par tegn.
export function kortDag(dato: string): string {
  const d = new Date(dato);
  if (Number.isNaN(d.getTime())) return '';
  return `${DAGE_KORT[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
}

// En ISO-tid som en dato man kan læse. Er den ikke til at læse, siges det
// frem for at vise "Invalid Date".
export function datoTekst(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? 'et tidligere tidspunkt' : d.toLocaleDateString('da-DK');
}

// "2026-09-14" → "september". Måneden alene, til de steder hvor en tur
// navngives efter hvornår den ligger frem for efter hvilken dag.
export function maanedsnavn(dato: string): string {
  const d = new Date(dato);
  return Number.isNaN(d.getTime()) ? '' : MAANEDER[d.getMonth()];
}

// "2026-06-12" set fra september → "for 3 måneder siden".
//
// Til de steder hvor det ikke er datoen, der er svaret. Et sted, man har
// været, står med "senest 12.–14. juni 2026", og det er præcist — men
// spørgsmålet, man stiller sig foran et shelter, er hvor længe siden det er,
// og dét skal man ikke regne ud selv.
//
// Grovkornet med vilje. Uger op til en måned, derefter måneder, derefter år:
// forskellen på 89 og 91 dage betyder ingenting for den, der spørger, og et
// tal på dagen ville love en præcision, ingen har brug for.
export function siden(dato: string, nu: Date = new Date()): string {
  const d = new Date(dato);
  if (!dato || Number.isNaN(d.getTime())) return '';

  // Regnes i hele døgn og ikke i timer. Ellers er "i går klokken 20" pludselig
  // ikke i går længere, fordi klokken er 14 nu.
  const dage = Math.floor(
    (Date.UTC(nu.getFullYear(), nu.getMonth(), nu.getDate())
      - Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())) / 86_400_000
  );

  // Fremtiden hører ikke til her: det her er noget, der har været.
  if (dage < 0) return '';
  if (dage === 0) return 'i dag';
  if (dage === 1) return 'i går';
  if (dage < 7) return `for ${dage} dage siden`;
  if (dage < 14) return 'for en uge siden';
  if (dage < 31) return `for ${Math.floor(dage / 7)} uger siden`;

  const maaneder = Math.round(dage / 30.4);
  if (maaneder < 2) return 'for en måned siden';
  if (maaneder < 12) return `for ${maaneder} måneder siden`;

  const aar = Math.floor(dage / 365);
  return aar <= 1 ? 'for et år siden' : `for ${aar} år siden`;
}
