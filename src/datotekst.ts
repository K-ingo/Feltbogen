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
