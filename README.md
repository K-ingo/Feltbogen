# Feltbogen

Dansk friluftsapp der holder styr på gear-inventar, planlægger ture med smarte
forslag, og lærer over tid. Offline-first — nettet bruges kun til vejrudsigt,
sync og deling.

Bygget med React 18, TypeScript og Vite. Dexie (IndexedDB) er den lokale base,
PocketBase er serveren, og Vitest kører testene uden browser.

### Dokumenter

| Fil | Hvad der står i den |
|---|---|
| [`feltbogen_fundament`](./feltbogen_fundament) | Den fulde specifikation: datamodel, skærme, kerne-koncepter og beslutningerne bag |
| [`PLAN.md`](./PLAN.md) | Broen fra 2.0-specifikationen til koden: hvad der findes, hvad der mangler, og i hvilken rækkefølge |
| [`POCKETBASE.md`](./POCKETBASE.md) | Samlinger, felter og API-regler, trin for trin. Skal følges præcist |
| [`IDEER.md`](./IDEER.md) | Ideer til det videre arbejde, nummereret så de kan refereres |
| [`CODE_REVIEW.md`](./CODE_REVIEW.md) | Seneste gennemgang af koden og de rettelser den førte til |

## Kom i gang

```bash
npm install
npm run dev        # udviklingsserver
npm run build      # typecheck + produktionsbuild
npm run preview    # serverer buildet — den eneste måde at teste offline på
npm run lint       # eslint
npm test           # vitest, én kørsel
npm run test:watch # vitest i watch-tilstand
```

Appen kører uden opsætning: uden en konto bliver alt stående lokalt, og det er
en gyldig måde at bruge den på. Skal der synkroniseres, peges den mod en
PocketBase-instans med `VITE_PB_URL` i en `.env` (se [`.env.example`](./.env.example)),
og samlingerne sættes op efter [`POCKETBASE.md`](./POCKETBASE.md).
`scripts/tjek-pocketbase.sh` efterprøver opsætningen udefra.

Lint, test og build kører automatisk på alle pull requests (`.github/workflows/ci.yml`,
Node 22). 48 testfiler dækker domænelogikken.

## Arkitektur

Offline-first: alt skrives til IndexedDB først, og synkroniseres derefter til
PocketBase. Fejler netværket, står dataen stadig lokalt og sendes op næste gang
appen starter.

| Lag | Fil | Ansvar |
|---|---|---|
| Datamodel | `src/db.ts` | Dexie-schema og typerne `Item`, `Gruppe`, `Tur`, `Sted`, `Person` |
| Sync | `src/sync.ts` | CRUD mod IndexedDB + PocketBase, og oprydning af det der ikke nåede op |
| Auth | `src/pb.ts`, `src/useAuth.ts` | PocketBase-klient og login-tilstand |
| Serverens afslag | `src/pbFejl.ts` | PocketBase-fejl skrevet ud så de kan diagnosticeres fra en skærmdump |
| Startskærm | `src/dashboard.ts` | Næste tur, sync-tilstand og det der kalder på en handling |
| Domænelogik | `src/smartMotor.ts` | Vejr, forbrugsberegning, kompatibilitets-advarsler, gruppeforslag, stedsøgning |
| Efterregnskab | `src/pakAfTjek.ts` | Pak-af-tjek: hvad blev brugt, hvad lå urørt, hvad gik i stykker |
| Steder | `src/steder.ts` | Besøgstælling, stedforslag og afstandsmatch mod gemte steder |
| Personer | `src/personer.ts` | Rejseselskabet og koblingen mellem deltagere og personer |
| Låne-log | `src/udlaan.ts` | Hvad der er ude af huset, og hvad man har lånt |
| Afgangs-tjek | `src/afgangsTjek.ts` | Huskelisten der ikke handler om gear, og dens skabelon |
| På tur | `src/paaTur.ts` | Næste vejrskift, dage tilbage — det man skal vide i felten |
| Turkort | `src/turkort.ts` | Ét link til én pårørende: hvor og hvornår hjemme |
| Deling | `src/gaest.ts` | Gæstens frosne øjebliksbillede af turen — hvad der er i det, og hvad der ikke er |
| Gæstens faner | `src/gaestefane.ts` | Ejerens faner filtreret ned til dem en gæst kan få svar på |
| Deltagelse | `src/deltagelse.ts` | Deltagerens egen række: navn, eget grej, hvad hun bærer, journal og billeder |
| Fælles journal | `src/turjournal.ts` | Ejerens noter og deltagernes lagt sammen, dag for dag |
| Gæstens pakkeliste | `src/gaestepakning.ts` | Hendes egen bunke, krydset af lokalt på hendes egen telefon |
| Øjebliksbilleder | `src/delesnapshot.ts` | Ombygningen af gæste- og turkort-snapshot efter hver skrivning |
| Turfase | `src/turfase.ts` | Hvor turen er i sit forløb, og hvad næste skridt er |
| Pakning | `src/pakning.ts` | Hvad der er lagt i tasken, og hvor langt man er |
| Vurdering | `src/vurdering.ts` | Stjerner på grej og ture, og hvad motoren gør ved dem |
| Turlog | `src/feltnoter.ts` | Dagbogen fra turen, samlet pr. dag |
| Vedligehold | `src/vedligehold.ts` | Imprægnering, slibning — intervaller der går i ring |
| Vægt-brydere | `src/vaegtbrydere.ts` | Lettere alternativer i skabet, deres risiko, og tags ingen gruppe har |
| Smart-forslag | `src/forslag.ts` | Motorens forslag i én form: forklaring, virkning, tiltro og to handlinger |
| Første tur | `src/foersteTur.ts` | Kladden bag det guidede flow, og turen den bliver til |
| Bæringen | `src/fordeling.ts` | Hvem der bærer det fælles grej, og et forslag om at dele det jævnt |
| Hvorfor sync ikke virker | `src/syncfejl.ts` | Den seneste fejl fra baggrundssync, oversat til noget man kan handle på |
| Hvor et forslag lander | `src/turmaal.ts`, `src/indstillingsmaal.ts` | Fanen *og* sektionen man skal stå i, når man trykker på noget appen selv har bragt på bane |
| Ligesom sidst | `src/ligesomSidst.ts` | Tidligere ture der lignede, som grej kan kopieres fra |
| Fortryd sletning | `src/fortryd.ts` | Vinduet på 25 sekunder efter en sletning |
| Enhedens valg | `src/indstillinger.ts` | Det der hører til telefonen og ikke til dataene, og derfor ikke synkroniseres |
| Sikkerhedskopi | `src/dataudveksling.ts` | Hele basen ud og ind som én JSON-fil |
| Nye poster | `src/opret.ts` | Tomme poster med de samme standardværdier, uanset hvor man startede dem |
| Datoer | `src/datotekst.ts` | Perioder og dage skrevet ud på dansk |
| Statistik | `src/statistik.ts` | Aggregeringer over inventar og ture |
| Årsopgørelse | `src/aarsopgoerelse.ts` | Året talt op: nætter, vejr, steder, selskab og grej |
| Årets feltbog | `src/feltbog.ts` | Én side pr. tur, sat op til at blive trykt |
| Billeder | `src/billeder.ts` | Skalering, forsidevalg og turens galleri |
| Sol og skumring | `src/soltider.ts` | Hvornår det bliver lyst og mørkt, regnet på enheden |
| Jagtvarsel | `src/jagt.ts` | Om turen ligger i en jagtsæson, og hvad det betyder |
| Tørke og bål | `src/baalforbud.ts` | Om udsigten er tør nok til at tjekke for afbrændingsforbud |
| Ny udgave | `src/opdatering.ts` | Hvornår en ny version slår igennem, og hvordan man beder om den med vilje |
| Omgivelserne | `src/useMedie.ts` | Skærmbredde, sidebar og om der er hul igennem til nettet |
| Detaljeskærme | `src/useRedigerbar.ts` | Hent én post fra Dexie, skriv ændringer igennem felt for felt |
| Design tokens | `src/index.css` | Farver, afstande, runding, skriftstørrelser og rørehøjde |
| UI-primitiver | `src/ui.tsx`, `src/layout.ts` | Knap, Kort, Felt, Chip, Badge, listerækker, detalje-header |
| Skærme | `src/App.tsx` m.fl. | Hjem, Ture, Grej, Folk, Mere — og skærmene derunder |
| Gæstens skærme | `src/GaesteSide.tsx`, `src/DeltTurVisning.tsx`, `src/MitGrej.tsx` | Den delte tur som en gæst ser den, og det hun selv kan røre |

Vurderingen er den eneste ting, appen ved, som ikke er et tal eller en dato.
Den ved, hvad der var med, hvad der blev brugt, og hvad der gik i stykker —
men ikke om man var glad for det. En sovepose kan være brugt hver eneste nat
og stadig være noget, man frøs i.

`null` er en rigtig værdi og ikke en dårlig karakter: de fleste ting bliver
aldrig vurderet, og de tælles hverken med i gennemsnittet eller imod noget.
Motoren bruger vurderingen ét sted — `vaegtbrydere.ts` holder op med at
foreslå, at man skifter noget ud, man har givet fire stjerner eller mere.
Grænsen står som `GODT` i `vurdering.ts`, så den er ét sted, når den skal
justeres.

Turen skelner mellem det grej der er *valgt* til den (`loese_item_ids` og
`gruppe_ids`) og det der er *pakket* (`pakkede_item_uids`). Det første er en
plan, det andet er en status man står med tasken og opdaterer. Fremdriften
gemmes ikke — den regnes ud af de to lister, så tallet og listen ikke kan
komme ud af trit.

Specens §7.1 har fire pakketilstande; her er der to. "Blocked" og "optional"
kan appen ikke selv udfylde, og en tilstand man skal sætte i hånden for at få
noget ud af, er en tilstand de fleste aldrig sætter.

En tur går gennem kladde → klar → på tur → afsluttet → gjort op. De fire
første er `Tur.status` i basen; den femte er udledt af, om pak-af-tjekket er
udfyldt — en tilstand mere ville skulle migreres, synkes og holdes i sync med
et felt, der allerede siger det samme.

`turfase.ts` svarer på "hvad nu?" for en tur: hvilken fase, hvad det næste
skridt er, og hvad der er værd at gøre først. Manglerne blokerer ikke. Man
skal kunne tage afsted på en tur, appen synes er halvfærdig — den skal bare
have sagt det først.

Navigationen har fem faner: **Hjem, Ture, Grej, Folk** og **Mere**. Grejsæt
ligger under Grej, fordi et sæt er en måde at samle sit grej på og ikke et
sted man arbejder; Steder, Statistik og Indstillinger ligger under Mere, fordi
de bruges sjældnere end ture og grej og ellers ville fylde lige så meget.

Skallen kender selv den sammenhæng (`HOERER_TIL` i `Skal.tsx`). Står man inde
på en underskærm, bliver hovedfanen markeret i navigationen, og der kommer en
"‹ Grej"-linje over titlen — begge dele udledt, så en vej tilbage ikke kan
blive glemt ét sted. En ny skærm skal derfor kun skrives ind i den ene tabel.

Reglen bagved: en ny funktion får ikke automatisk sin egen fane. Hører den til
en tur, ligger den under turen; hører den til et stykke grej, under Grej. Kun
det tværgående hører under Mere.

Målene i brugerfladen står som CSS-variabler i `src/index.css` og skal vælges
derfra frem for at blive skrevet ind i den enkelte skærm: `--plads-1` til
`--plads-6` for afstande, `--runding*` for hjørner, `--skrift-*` for
skriftstørrelser. Et spring i skalaen er tilladt; en værdi uden om den skal
have en grund.

`--roerehoejde` er mindstemålet på noget, man skal kunne ramme. Den er 44 px
på en touchskærm og 36 med mus, fordi appen bruges udendørs, hvor sigtet er
dårligere end ved et skrivebord — nogle gange med handske på. Skiftet sker af
sig selv på `pointer: coarse`, så en ny knap får det rigtige mål uden at nogen
skal huske det. To undtagelser er bevidste: `hvorfor?`-linket står midt i en
sætning, og krydset i en tag-chip står i en række, der ombryder — begge ville
stjæle klik fra linjen omkring sig, hvis de fyldte de fulde 44 px.

Felterne står på 16 px, og det er ikke en smagssag: Safari på iPhone zoomer
ind på et felt med mindre skrift og zoomer ikke ud igen.

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

### Deling og deltagelse

Et delelink er en invitation og ikke en nøgle: man skal være logget ind for at
åbne det. Til gengæld kan man så skrive sig på turen — hvad man selv tager med,
og hvad man bærer af det fælles grej.

Gæsten ser den samme tur som ejeren og ikke en gæsteudgave ved siden af.
Fanerækken er den samme komponent i `ui.tsx` begge steder, og `gaestefane.ts`
filtrerer ejerens faner ned til fire: Overblik, Pakkeliste, Deltagere og
Journal. Pakning og Praktisk er udeladt, fordi pakkefremdrift, budget og
turkort ikke er i snapshottet — en fane, der altid stod tom, er et løfte appen
ikke holder. Til gengæld har gæsten en fane, ejeren ikke har på samme måde:
journalen er turens historie for dem, der var med, og ikke en note under
"Undervejs".

Det, en deltager skriver, står på hendes egen række i `turdeltagelse` og ikke
på turen. Grænsen er den samme som ved snapshottet: PocketBase giver adgang til
hele poster og aldrig til enkelte felter, så måtte en deltager skrive i turen,
kunne hun også slette den. På sin egen række kan hun kun røre sit eget. Det hun
tager med, står som navn og vægt og ikke som en henvisning til hendes eget
inventar — ingen læser hinandens gearliste, man deler kun det, man selv skriver
på turen.

Journalen er fælles. Ejerens feltnoter kommer med i snapshottet, deltagernes
står på deres egne rækker, og `turjournal.ts` lægger de to lister sammen på
skærmen: nyeste dag først, indgangene inden i dagen i den rækkefølge de skete,
og "Dag 2" talt fra turens startdato, så en indgang har det samme nummer,
uanset hvornår den bliver læst. Ejerens navn følger med i snapshottet — hendes
egne indgange skal ikke stå som "Ejeren" på en tur, man tog sammen. Den anden
vej står deltagernes noter og billeder under ejerens egne i turloggen, adskilt
under "Fra deltagerne": de er ikke hendes at rette, sætte som forside eller
slette, og reglen i PocketBase siger det samme.

En indgang med billeder skrives i to trin — filerne først, filnavnene læst af
svaret, indgangen bagefter. PocketBase bestemmer selv det endelige filnavn, og
uden koblingen ville alle billeder på en række se ud, som om de hørte til den
nyeste note. Går første trin galt, skrives teksten alligevel: en note, man har
skrevet i felten, skal ikke gå tabt, fordi et billede ikke ville op. Og lykkes
uploaden tilsyneladende uden at give navne tilbage, er `billeder`-feltet ikke
oprettet i samlingen — så siger skærmen det, i stedet for at lade dem
forsvinde.

Gæstens pakkeliste er hendes egen bunke og ikke hele turens grej: det hun selv
har skrevet ind, og det hun har fået at bære — enten fordi hun har meldt sig,
eller fordi ejeren har fordelt det til hende. Hele fordelingen står under
Deltagere, hvor man kan se, hvordan byrden ligger. Koblingen sker på navn og
ikke på id, fordi snapshottet bærer navne: en gæst skal ikke kunne se ejerens
deltager-id'er. Navnet tages fra kontoen og ikke fra deltagelsesrækken — den
findes ikke, før man har skrevet sig på, og indtil da kunne man ellers ikke se
det grej, man havde fået tildelt.

Afkrydsningen ligger lokalt, i den samme indstillingstabel som resten af
enhedens valg, med turens delingstoken som nøgle. "Har jeg lagt den i tasken"
er ens eget spørgsmål om ens egen taske, og de andre har ikke brug for at vide,
hvor langt man er — derfor koster den hverken en samling eller et felt i
PocketBase, og to delte ture på den samme telefon har hver sin liste.

Fælles grej, ingen har taget, står som sit eget kort højt oppe på gæstens
overblik. Det er det eneste sted på siden, hvor en gæst kan gøre noget, og et
stykke fælles grej uden en bærer er den fejl, man opdager på fjeldet og ikke
før. På linjerne står der "ingen bærer" og ikke "delt": forskellen på "det
tager Emil" og "det tager ingen" skal kunne ses. "Uden tag" er tilsvarende
oversat ved visningen og ikke i snapshottet — en gæst ved ikke, hvad et tag er,
og oversættelsen skal også gælde de links, der allerede er sendt ud.

Snapshottet er versioneret (`SNAPSHOT_VERSION`, nu 5). Ældre udgaver læses
stadig — de mangler bare det, de aldrig havde, og så kan deres grej for
eksempel ikke fordeles. Et snapshot fra en *nyere* udgave end appens afvises i
stedet for at blive gættet på.

### Årsopgørelse, feltbog og billeder

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

### Dansk kontekst

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

### Smart-motoren

Smart-motoren er rådgiver og ikke automat (fundament §15). Derfor bærer hver
advarsel, hvert gruppeforslag og hvert forbrugstal en `begrundelse` — reglen bag
skrevet ud — som vises bag et "hvorfor?" i skærmbilledet. Kropsdata (vægt,
aktivitetsniveau, kaloriebehov) sættes i indstillingerne, bliver på enheden og
lader motoren regne med brugeren frem for en gennemsnitsdansker.

### Data, sync og fortrydelse

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
>
> Samlingen `turdeltagelse` skal have `journal` (JSON) og `billeder` (File,
> multiple) for at den fælles journal virker. Mangler `billeder`, gemmes noten,
> og skærmen siger, at billederne ikke kom op; mangler `journal`, forsvinder
> hele indgangen uden et ord.

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

Baggrundssync fangede sine fejl og skrev dem i konsollen. Det er nok for den,
der har udviklerværktøjet åbent, og ingenting for alle andre: statuslinjen
kunne stå og sige "3 ændringer på vej op" i ugevis, uden at nogen af dem
nogensinde kom op. En fejl, appen tier om, er værre end en fejl — man opdager
den først, når man står og mangler dataene. Derfor huskes den seneste i
`syncfejl.ts`, og den bliver vist.

Der gemmes én fejl og ikke en log: en liste skulle vedligeholdes og ryddes, og
ingen læser den. Den ryddes af, at det lykkes, og ikke af, at der er gået tid.
Og den ligger på enheden — om *denne* telefon kunne nå serveren, er ikke data
om turene, og det ville i øvrigt være synkroniseringen selv, der skulle sende
det. Arterne følger, hvad man skal gøre ved dem, og ikke HTTP-koderne: ingen
forbindelse, ikke logget ind, afvist, server, ukendt.

Kun `response.message` citeres. PocketBase-klienten sætter selv "Something went
wrong." på en fejl, der aldrig fik et svar, og skærmen skrev den ud som
"Serveren sagde: …" om en server, der ikke havde sagt noget. Har serveren ikke
sagt noget, er der ikke noget at citere. Og "kunne ikke nå serveren" dækkede to
situationer med hver sin udvej — man er selv uden dækning, eller serveren er
nede eller afviser kald fra appens adresse. Browseren ved hvilken, så det står
der nu.

"Gemt på denne enhed" er sandt uden en konto, men det er ikke til at høre, at
det også betyder "og kommer ingen steder": den, der tror hun synkroniserer,
læser det som en betryggelse og opdager først, at intet blev sendt, den dag hun
står med en ny telefon. Nu står forklaringen og vejen videre samme sted, og
prikken er grå — at vælge at blive lokal er ikke en fejl. En udløbet session
rydder derimod sig selv og ser bagefter ud som "ingen konto"; den siges som det,
den er, for man *var* logget ind, og der er noget, der ikke kommer op.

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

## Udrulning

Appen og PocketBase ligger på **samme domæne**. Caddy serverer de statiske
filer og sender `/api/` videre til PocketBase over Railways private netværk,
så PocketBase ikke behøver en offentlig adresse: admin-fladen på `/_/` kan
ikke nås udefra, og der er ingen offentlig adresse at scanne eller banke på.

```
browser ──https──> Caddy ──http──> pocketbase.railway.internal:8090
                     │
                     └── dist/  (appen selv)
```

`Dockerfile` bygger appen og lægger den ind i et Caddy-image. Railway samler
selv de to op.

### Opsætning i Railway

På web-servicen sættes én variabel, som en reference til PocketBase-servicen:

```
POCKETBASE_ORIGIN=http://${{ pocketbase.RAILWAY_PRIVATE_DOMAIN }}:8090
```

Hedder servicen noget andet end `pocketbase`, er det det navn der skal stå.
Er variablen tom, nægter Caddy at starte — det er med vilje: en forkert
opsætning skal vise sig som en fejlet udrulning frem for en app, der er oppe
og svarer 502 på alting.

`PORT` sætter Railway selv.

### Den fælde, der slår appen ihjel

**Det private domæne må aldrig havne i `VITE_PB_URL`.**

Private adresser slås kun op inde i Railway, og kun mens noget kører — aldrig
under et build. `VITE_PB_URL` bages ind i JS-bundlen af Vite ved build, og
bundlen kører i en browser ude i skoven. Sætter man
`VITE_PB_URL=${{ pocketbase.RAILWAY_PRIVATE_DOMAIN }}`, beder hver eneste
telefon om et domæne, der ikke findes: login, sync og deling holder op med at
virke på én gang, og der er intet i et build, der afslører det.

Derfor er `VITE_PB_URL` slet ikke sat i udrulningen — appen bruger sit eget
domæne — og CI fejler, hvis `railway.internal` dukker op i `dist/`.

### Rækkefølge, når PocketBases offentlige domæne fjernes

Billed-url'er gemmes som de er i IndexedDB (`sync.ts`), og delte ture har dem
liggende i deres `dele_snapshot` på serveren. De url'er peger på den adresse,
der var gældende, da de blev lavet — de opdaterer sig ikke af sig selv.

1. Rul proxyen ud og bekræft, at appen virker med PocketBase stadig
   offentligt tilgængelig.
2. Lad brugerne synkronisere. Deres billed-url'er skrives om til det nye
   domæne, efterhånden som posterne kommer ned igen.
3. Del de ture igen, der har et aktivt delelink — et snapshot laves om ved
   deling, ikke ved sync.
4. Fjern først derefter PocketBases offentlige domæne.

Springes 2 og 3 over, står billederne tomme for dem, der ikke har nået at
synkronisere, og delte ture mister deres billeder helt.

### Administration bagefter

Når det offentlige domæne er væk, er `/_/` heller ikke til at nå for dig.
Skal reglerne rettes, slås PocketBases offentlige domæne til igen midlertidigt
i Railway — og fra igen bagefter.

## Eksterne tjenester

- **PocketBase** — sync og konti. Ligger bag `/api/` på appens eget domæne; se **Udrulning** og `.env.example`.
- **open-meteo.com** — vejrudsigt og geocoding. Gratis, ingen nøgle.
- **api.dataforsyningen.dk (DAWA)** — danske adresser og stednavne. Gratis, ingen nøgle.

QR-koderne tegnes lokalt af `qrcode` og går ikke over nettet — et delelink skal
kunne vises ved bålet uden dækning.

## Status

V1 under udvikling.

**Bygget:** inventar, grupper og grejsæt, ture med smart-motor, femfanet
navigation, turfaser, pakning med fremdrift, statistik, PWA, dashboard,
indstillinger, pak-af-tjek, steder, personer, låne-log, afgangs-tjek,
på-tur-tilstand, turkort til pårørende, turlog, vedligeholds-log, QR-koder,
vægt-brydere, vurderinger, "ligesom sidst", guidet første tur, fordeling af
fælles grej, fortryd sletning, årsopgørelse, feltbog til print, fotos på turen,
sikkerhedskopi, skumring, jagtvarsel, tørketjek og booking.

**Deling er senest blevet til samarbejde:** gæsten får turens egne faner, en
fælles journal med billeder begge veje, sin egen pakkeliste at krydse af, og
kan melde sig til at bære af det fælles grej.

**Endnu ikke bygget:** badges/notifikationer, ruter på kort og tidevand
(§5.4 — kræver DMI-nøgle).

Ideer til det videre arbejde ligger i [`IDEER.md`](./IDEER.md), og
rækkefølgen de tages i står i [`PLAN.md`](./PLAN.md).
