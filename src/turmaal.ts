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

export type Turfane = 'overblik' | 'pakning' | 'pakkeliste' | 'deltagere' | 'undervejs' | 'praktisk';

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
  // Det sidste tjek inden afgang.
  | 'afgangstjek';

export const MAALETS_FANE: Record<Turmaal, Turfane> = {
  overblik: 'overblik',
  pakning: 'pakning',
  vaegt: 'pakning',
  pakkeliste: 'pakkeliste',
  deltagere: 'deltagere',
  fordeling: 'deltagere',
  afgangstjek: 'undervejs'
};
