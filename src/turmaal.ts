// Hvor en henvisning lander på turskærmen.
//
// Reglen bag filen, og den gælder alt hvad motoren siger:
//
//   Når appen foreslår noget eller peger på noget, der mangler, skal man enten
//   kunne gøre det på stedet — eller trykke og lande dér, hvor det kan gøres.
//   Brugeren skal aldrig lede efter det, appen selv har bragt på bane.
//
// Den blev skrevet, fordi vægtforslaget på startskærmen brød den: kortet sagde
// "vægten kan ned", man trykkede, og så stod man på turens overblik uden noget
// at gøre. Forslaget var rigtigt, motoren havde regnet rigtigt, og det var
// alligevel ubrugeligt — det, der manglede, var de sidste to centimeter.
//
// Et mål er derfor ikke en fane. Det er et sted at stå: fanen, og den sektion
// på fanen, der skal være foldet ud, når man kommer. Skærmen ruller derhen, så
// man kan se den uden at lede.

// Fanerne på turskærmen. Pakningen er *én* fane og ikke to: planen og
// tjeklisten var før hver sin fane, og så stod man og krydsede af på den ene
// mens tallet, man pakkede efter, stod på den anden. Designsystemet har ét
// Pakning-blad — se docs/design/desktop/04-pakning.html.
export type Turfane = 'overblik' | 'pakning' | 'deltagere' | 'undervejs' | 'praktisk';

export type Turmaal =
  // Datoer, sted og turens parametre.
  | 'overblik'
  // Valget af grej.
  | 'pakning'
  // Vægtbryderne — de lettere alternativer i skabet.
  | 'vaegt'
  // Listen man krydser af, mens man pakker.
  | 'pakkeliste'
  // Hvem der er med, og hvem der bærer hvad.
  | 'deltagere'
  // Fordelingen af det fælles grej mellem deltagerne.
  | 'fordeling'
  // Dagene på en flerdagestur.
  | 'dage'
  // Det sidste tjek inden afgang.
  | 'afgangstjek';

export const MAALETS_FANE: Record<Turmaal, Turfane> = {
  overblik: 'overblik',
  // Dagene er turens parametre, dag for dag, og ligger derfor under Overblik
  // og ikke i en fane for sig. Reglen: en ny funktion får ikke automatisk en
  // fane.
  dage: 'overblik',
  pakning: 'pakning',
  vaegt: 'pakning',
  // Listen er ikke en fane for sig længere — den er den nederste halvdel af
  // Pakning. Målet bliver stående, fordi det stadig er to forskellige steder
  // at lande: valget af grej øverst, listen man krydser af nedenfor.
  pakkeliste: 'pakning',
  deltagere: 'deltagere',
  fordeling: 'deltagere',
  afgangstjek: 'undervejs'
};
