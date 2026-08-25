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
| Vægt-brydere | `src/vaegtbrydere.ts` | Lettere alternativer i skabet, og tags ingen gruppe har |
| Ligesom sidst | `src/ligesomSidst.ts` | Tidligere ture der lignede, som grej kan kopieres fra |
| Fortryd sletning | `src/fortryd.ts` | Vinduet på 25 sekunder efter en sletning |
| Statistik | `src/statistik.ts` | Aggregeringer over inventar og ture |
| Årsopgørelse | `src/aarsopgoerelse.ts` | Året talt op: nætter, vejr, steder, selskab og grej |
| Årets feltbog | `src/feltbog.ts` | Én side pr. tur, sat op til at blive trykt |
| Billeder | `src/billeder.ts` | Skalering, forsidevalg og turens galleri |
| Sol og skumring | `src/soltider.ts` | Hvornår det bliver lyst og mørkt, regnet på enheden |
| Jagtvarsel | `src/jagt.ts` | Om turen ligger i en jagtsæson, og hvad det betyder |
| Tørke og bål | `src/baalforbud.ts` | Om udsigten er tør nok til at tjekke for afbrændingsforbud |
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

Årsopgørelsen bygger udelukkende på data der allerede står i appen, og den
siger hvad den bygger på. Kladder tælles ikke med — en kladde er en plan man
aldrig gjorde færdig — men en tur man glemte at sætte til afsluttet gør, for
ellers ville opgørelsen afhænge af oprydning frem for af hvad der skete. Vejret
er det eneste sted appen kunne komme til at love mere end den ved:
`vejrsnapshot` er den *udsigt* der blev hentet ved planlægningen, ikke en
måling, og derfor står der "efter udsigten" på den koldeste nat og den vådeste
tur.

Årets feltbog er den samme data læst den anden vej: opgørelsen er tallene,
bogen er turene — én side pr. tur med periode, sted, selskab, vejr, pakkeliste,
budget og feltnoter. Den ligger uden for `Skal`, fordi faner og sidebar ville
komme med på papiret, og betjeningen bærer klassen `kun-skaerm` så den
forsvinder i printet. PDF'en laves af browserens egen print-dialog; `@media
print` i `index.css` er det eneste sted i appen der bruger klasser, fordi en
printregel skal kunne overskrive, og en inline-style altid vinder.

Fotos følger den samme regel som resten: enheden først. Filen skaleres til
1600 px og komprimeres som JPEG i browseren, og lægges i IndexedDB **inden**
der bliver spurgt om net — man tager billeder i en skov uden dækning, og de
skal ligge der når man kommer hjem. Skaleringen er skrevet i `billeder.ts`
frem for hentet ind som pakke; det er canvas plus en skaleringsregel, og
`imageOrientation: 'from-image'` er det der får telefonfotos til at vende
rigtigt.

Billederne hører til turen gennem `Billede.tur_uid` og ikke gennem en liste på
turen. Med en liste ville der være to steder at holde styr på det samme.
Rækkefølgen er optagetidspunktet, og `Tur.hero_billede` peger på forsiden —
et uid og ikke et indeks, for et indeks ville pege på noget andet så snart et
billede blev slettet på en anden enhed.

Hvert billede gemmes i to udgaver. Visningskopien er skaleret til 1600 px, og
originalen ligger urørt ved siden af — den vises aldrig, men kan hentes ned i
fuld kvalitet, også af gæsterne på et delelink. `?download=1` på adressen får
PocketBase til at sende filen som en download; uden den åbner browseren bare
billedet i en fane, og på en telefon er det forskellen på at have billedet og
at kigge på det. Den lokale kopi af originalen ryddes så snart uploaden er
lykkedes: den der tog billedet, har det i forvejen i sin kamerarulle.

Visningskopien findes to steder: som `blob` på den enhed der tog den, og som
`url` i PocketBase. Sync henter kun url'en ned; selve billedet hentes først når det
skal vises, og lægges så på plads — en enhed skal ikke trække et helt
turgalleri ned for at tegne en liste. Gæsten får kun url'erne, frosset ind i
`dele_snapshot` sammen med resten, og `laesSnapshot` kaster alt der ikke er
http(s) væk: snapshottet krydser en tillidsgrænse og ender i en `src`.

Den danske kontekst (§5 i `IDEER.md`) er bygget der hvor den kan bygges
ærligt, og udeladt hvor den ikke kan.

Skumringen regnes på enheden i `soltider.ts` frem for at hentes fra
open-meteo. To grunde: en ukendt parameter får open-meteo til at svare 400,
og så ryger *hele* vejrudsigten for to klokkeslæts skyld — og skumring er
regnestykke, ikke data, så det virker uden dækning. Testene efterprøver
regnestykket mod almanakværdier ved begge solhverv og mod den egenskab at
dagen er tolv timer ved jævndøgn uanset breddegrad.

Jagtvarslet kender de grove sæsoner og siger hvad de betyder — ikke en
artstabel. Der findes ikke et åbent API over danske jagttider, og
bekendtgørelsen ændres; en tabel skrevet af i dag ville være forkert om et
år uden at sige det. Varslet peger derfor på Naturstyrelsens jagtdage, som er
det der afgør om skoven er lukket den dag man kommer.

Tørketjekket er **ikke** DMI's skovbrandindeks og udgiver sig ikke for at
være det. Det indeks kræver en API-nøgle, og afbrændingsforbud udstedes af de
enkelte beredskaber uden centralt feed. I stedet er det en observation på den
udsigt appen allerede har hentet — tørre dage og højeste temperatur — med et
link til dem der bestemmer. Vurderingen tælles i dage og ikke i millimeter
lagt sammen: en sum kan gøres våd af én skybrudsdag, mens resten er knastørre.

Tidevand (§5.4) er ikke bygget. Det kræver DMI's API med nøgle plus et opslag
af nærmeste havn, og appens øvrige tjenester er gratis og uden nøgle.

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

En sletning kan fortrydes i 25 sekunder, men den bliver udført med det samme.
Den udskydes altså ikke — `slet()` giver i stedet en `Genskab`, der lægger
posten tilbage. Den anden vej rundt ville efterlade noget man troede var væk,
hvis appen blev lukket inden vinduet var ude, og det er den værste af de to
fejl. Genskabelsen beholder postens `uid`, så grejet dukker op igen i præcis de
grupper og ture det lå i; `pb_id` ryddes derimod, for posten på serveren er
slettet og skal oprettes på ny.

Fortrydelsen erstatter bekræftelsesdialogen — at spørge på forhånd *og* tilbyde
en fortrydelse bagefter er friktion to gange for den samme sikkerhed, og
dialogen er den af de to der er i vejen. Sletteknappen ligger allerede bag en
menu eller en foldet række, så et tryk ved et uheld er der ikke. Det dialogen
kunne fortælle — at ture mister koblingen til et slettet sted, men bliver
stående — står nu i beskeden bagefter i stedet.

Dialogen bliver stående de steder hvor der ikke er noget at fortryde: når et
delelink eller et turkort trækkes tilbage, er det sket hos modtageren, og når
et pak-af-tjek slettes, er der ingen post at lægge tilbage.

En udløbet session tæller ikke som at være logget ind. `authStore.record`
bliver liggende i localStorage efter tokenet er udløbet, så `nuvaerendeBruger()`
spørger til `authStore.isValid` og ikke til om der ligger en konto. Ellers
troede appen den var logget ind, mens PocketBase afviste hver skrivning — og
fordi en `createRule` afvises med `400` og en **tom** fejlkrop, stod der intet
i konsollen at gå efter. `fornyLogin()` forlænger sessionen ved opstart og når
forbindelsen kommer tilbage; afviser serveren tokenet, ryddes det, så appen
beder om login. En netværksfejl rører det ikke — man skal ikke logges ud af at
stå uden dækning.

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
turlog, vedligeholds-log, QR-koder, vægt-brydere, "ligesom sidst",
fortryd sletning, årsopgørelse, feltbog til print, fotos på turen,
skumring, jagtvarsel, tørketjek, booking.
Endnu ikke bygget: badges/notifikationer.

Ideer til det videre arbejde ligger i [`IDEER.md`](./IDEER.md).
