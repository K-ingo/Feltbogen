export function matcherTur(navn: string, sted: string, soegning: string): boolean {
  const tekst = `${navn} ${sted}`.toLocaleLowerCase('da');
  return soegning.trim().toLocaleLowerCase('da').split(/\s+/).every(ord => tekst.includes(ord));
}
