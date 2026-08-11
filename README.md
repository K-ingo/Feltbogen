# Feltbogen

Dansk friluftsapp der holder styr på gear-inventar, planlægger ture med smarte
forslag, og lærer over tid. Offline-first — nettet bruges kun til vejrudsigt,
sync og deling.

Se [`feltbogen_fundament`](./feltbogen_fundament) for den fulde specifikation:
datamodel, skærme, kerne-koncepter og de beslutninger der ligger bag.

## Kom i gang

```bash
npm install
npm run dev        # udviklingsserver
npm run build      # typecheck + produktionsbuild
npm run lint       # eslint
npm test           # vitest, én kørsel
npm run test:watch # vitest i watch-tilstand
```

Lint, test og build kører automatisk på alle pull requests.

## Arkitektur

Offline-first: alt skrives til IndexedDB først, og synkroniseres derefter til
PocketBase. Fejler netværket, står dataen stadig lokalt og sendes op næste gang
appen starter.

| Lag | Fil | Ansvar |
|---|---|---|
| Datamodel | `src/db.ts` | Dexie-schema og typerne `Item`, `Gruppe`, `Tur`, `Sted`, `Person` |
| Sync | `src/sync.ts` | CRUD mod IndexedDB + PocketBase, og oprydning af det der ikke nåede op |
| Auth | `src/pb.ts`, `src/useAuth.ts` | PocketBase-klient og login-tilstand |
| Domænelogik | `src/smartMotor.ts` | Vejr, forbrugsberegning, kompatibilitets-advarsler, gruppeforslag, stedsøgning |
| Efterregnskab | `src/pakAfTjek.ts` | Pak-af-tjek: hvad blev brugt, hvad lå urørt, hvad gik i stykker |
| Steder | `src/steder.ts` | Besøgstælling, stedforslag og afstandsmatch mod gemte steder |
| Personer | `src/personer.ts` | Rejseselskabet og koblingen mellem deltagere og personer |
| Låne-log | `src/udlaan.ts` | Hvad der er ude af huset, og hvad man har lånt |
| Afgangs-tjek | `src/afgangsTjek.ts` | Huskelisten der ikke handler om gear, og dens skabelon |
| På tur | `src/paaTur.ts` | Næste vejrskift, dage tilbage — det man skal vide i felten |
| Turkort | `src/turkort.ts` | Ét link til én pårørende: hvor og hvornår hjemme |
| Turlog | `src/feltnoter.ts` | Dagbogen fra turen, samlet pr. dag |
| Vedligehold | `src/vedligehold.ts` | Imprægnering, slibning — intervaller der går i ring |
| Statistik | `src/statistik.ts` | Aggregeringer over inventar og ture |
| UI-primitiver | `src/ui.tsx`, `src/layout.ts` | Knap, Kort, Felt, Chip, Badge, listerækker, detalje-header |
| Skærme | `src/App.tsx` m.fl. | Inventar, Grupper, Ture, Steder, Statistik |

Steder og personer er genbrugsressourcer på tværs af ture: et sted husker sine
noter fra sidst, og en person samler sine ture. Begge koblinger er valgfrie —
`Tur.sted_uid` og `Deltager.person_uid` er tomme som standard, og så falder
turen tilbage på den fritekst der altid har været der. Man skal kunne komme
afsted uden først at føre kartotek.

Turkortet til pårørende bruger den samme grænse som gæstelinket: modtageren
læser ét frosset felt (`turkort_snapshot`), aldrig resten af turen. Det er
nødvendigt, fordi en læseregel i PocketBase gælder hele posten — alt hvad
modtageren ikke skal se, må ikke ligge i det hun kan hente. `delesnapshot.ts`
bygger begge øjebliksbilleder om efter hver skrivning, så et afsluttet tur-kort
holder op med at sige at turen er i gang.

Smart-motoren er rådgiver og ikke automat (fundament §15). Derfor bærer hver
advarsel, hvert gruppeforslag og hvert forbrugstal en `begrundelse` — reglen bag
skrevet ud — som vises bag et "hvorfor?" i skærmbilledet. Kropsdata (vægt,
aktivitetsniveau, kaloriebehov) sættes i indstillingerne, bliver på enheden og
lader motoren regne med brugeren frem for en gennemsnitsdansker.

Hver post har et `uid` — dens identitet på tværs af enheder. Det tildeles ved
oprettelse, så det også findes offline, og alle referencer mellem poster
(`item_ids`, `gruppe_ids`, `loese_item_ids`, deltagernes gear) bruger `uid`.
Dexies `++id` kan ikke bruges til det: den tælles op pr. enhed, så id 1 betyder
noget forskelligt to steder.

> **PocketBase dropper lydløst felter der ikke findes i samlingens skema.** Der
> kommer ingen fejl — dataene forsvinder bare på vej op. Den fulde liste over
> samlinger, felter og API-regler står i [`POCKETBASE.md`](./POCKETBASE.md), og
> den skal følges præcist.
>
> Mangler tekstfeltet `uid`, kan to enheder ikke blive enige om hvilken post
> der er hvilken. Appen skriver en advarsel i konsollen og i Indstillinger hvis
> den opdager det.

Hver post har også et `pb_id`: er det sat, findes posten i PocketBase; er det
tomt, er den kun lokal endnu.

Redigeringer skrives til IndexedDB ved hvert tastetryk, men sync udskydes
800 ms, så en hel indtastning bliver én request i stedet for én pr. tegn.
`usendt_aendring` markerer poster hvor serveren ikke har kvitteret endnu — så
bliver de prøvet igen, hvis appen lukkes inden køen er tømt.
`sendAfventende()` tømmer køen med det samme, og kaldes når appen skjules.

Sletninger bruger tabellen `slettede` som spor. Kan PocketBase ikke nås når man
sletter, bliver postens `pb_id` liggende der, indtil serveren har bekræftet
sletningen. Sporet gør to ting: det holder posten ude af `hentFraPocketBase()`,
så den ikke bliver hentet tilbage, og det får `sendAltUsendt()` til at prøve
sletningen igen.

`afstemMedServer()` samler de to retninger — send det usendte op, hent det vi
mangler ned — og kaldes ved opstart og på browserens `online`-event, så en tur
uden dækning ikke skal afsluttes med en genstart for at data går op. Samtidige
kald lægges sammen til én kørsel, ellers kunne to `online`-events i træk oprette
samme post to gange.

### Tests

`npm test` kører uden browser og uden server. Dexie får et IndexedDB af
`fake-indexeddb`, og `src/test/pbMock.ts` erstatter PocketBase med en
hukommelsesbaseret udgave, der kan sættes `offline` for at teste at data
overlever manglende forbindelse.

## PWA

Appen er installerbar og kan startes uden netværk. `vite-plugin-pwa` genererer
service worker og manifest ved build; skallen precaches, og Google Fonts hentes
`CacheFirst`, så typografien også holder offline.

`registerType: 'autoUpdate'` betyder at en ny version tages i brug ved næste
indlæsning. Det er forsvarligt, fordi redigeringer skrives til IndexedDB med det
samme og markeres `usendt_aendring` — en genindlæsning kan ikke tabe data.

Ikonerne i `public/` er **pladsholdere**: visuel identitet er stadig en åben
beslutning (fundament §17). `icon.svg` og `icon-maskable.svg` er kilderne, og
PNG-varianterne er rasteriseret fra dem.

Der er ingen service worker under `npm run dev`. Test offline med
`npm run build && npm run preview`.

## Eksterne tjenester

- **PocketBase** — sync og konti. URL sættes med `VITE_PB_URL` (se `.env.example`).
- **open-meteo.com** — vejrudsigt og geocoding. Gratis, ingen nøgle.
- **api.dataforsyningen.dk (DAWA)** — danske adresser og stednavne. Gratis, ingen nøgle.

QR-koderne tegnes lokalt af `qrcode` og går ikke over nettet — et delelink skal
kunne vises ved bålet uden dækning.

## Status

V1 under udvikling. Bygget: inventar, grupper, ture med smart-motor, statistik,
PWA, deling og gæsteview, dashboard, indstillinger, pak-af-tjek, steder,
personer, låne-log, afgangs-tjek, på-tur-tilstand, turkort til pårørende,
turlog, vedligeholds-log, QR-koder.
Endnu ikke bygget: badges/notifikationer.

Ideer til det videre arbejde ligger i [`IDEER.md`](./IDEER.md).
