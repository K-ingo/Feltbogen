// Hvornår navnefeltet i Indstillinger har noget at gemme.
//
// Navnet er det de andre ser på en delt tur, og det sendes til serveren — så
// det er det eneste felt på skærmen med en Gem-knap. Knappen er skærmens ene
// fyldte accent, og den skal kun være det, når et tryk faktisk gør noget:
// navnet er ændret, og det er ikke tomt. Et tomt navn gemmes aldrig.
//
// Knappen vises også, når kontoen slet ikke har et navn endnu — slukket, så
// man kan se, hvor det rettes, i stedet for at lede efter en knap der ikke er.
// Er navnet sat og uændret, er der ingen knap: der er ikke noget at gøre.

export interface Navnestatus {
  // Feltet er tomt eller kun mellemrum.
  tomt: boolean;
  // Feltet siger noget andet end det, der er gemt. Mellemrum i enderne tæller
  // ikke — de skæres af, før navnet gemmes.
  aendret: boolean;
  // Et tryk på Gem vil gemme noget gyldigt.
  kanGemmes: boolean;
  // Knappen står på skærmen.
  visKnap: boolean;
}

export function navnestatus(felt: string, gemt: string): Navnestatus {
  const nyt = felt.trim();
  const tomt = nyt === '';
  const aendret = nyt !== gemt.trim();
  const kanGemmes = aendret && !tomt;
  return { tomt, aendret, kanGemmes, visKnap: aendret || gemt.trim() === '' };
}
