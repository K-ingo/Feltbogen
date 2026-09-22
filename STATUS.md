# STATUS

*Sidst opdateret: 22. september 2026. Udgangspunkt: `main` @ `33c7c57`.*

Kort svar på "hvor står vi nu?". Den skal kunne læses på to minutter og
opdateres, hver gang noget bliver færdigt eller blokeret.

`PLAN.md` er historikken — hvad der blev bygget, og hvorfor det blev bygget
sådan. Den her er nutiden.

---

## Kort sagt

V1 er funktionelt langt fremme. Kredsløbet er lukket: man kan planlægge en
tur, pakke den, tage afsted, skrive i felten, komme hjem, gøre den op — og
appen bliver klogere af det. Delingen er blevet til rigtigt samarbejde, hvor
en deltager har sine egne faner, sin egen pakkeliste og kan bidrage til den
fælles journal.

Turene kan nu beskrives dag for dag, og appen siger, hvad de har lært os —
hvad der slæbes med uden at blive brugt, og hvad der ikke holder.

Serveren er sat helt op, og der er ingen kendt blokering. De to risici, der
kunne koste data, er begge lukket: sletninger slår igennem på tværs af enheder
(gravsten), og et login med en anden konto stopper frem for at blande. Det, der
står tilbage, er arbejde vi selv vælger — ikke noget, der spærrer.

Det næste stykke arbejde er ikke funktionalitet, men udseende. Designsystemet
er låst og ligger nu i repoet sammen med en tegning af hver eneste skærm. Alle
tolv PC-tegninger er bygget, og af de otte til telefonen er Pakning bygget;
syv står tilbage.

---

## Grønt lys

Kørt på grenen `claude/nice-cannon-fdvj9u` den 22. september 2026:

| Kommando | Resultat |
|---|---|
| `npm run lint` | Bestået, ingen fejl |
| `npm test` | 74 testfiler, 1.622 tests, alle grønne |
| `npm run build` | Bestået |
| `npm run preview` | Bestået — Indstillinger afprøvet på 1440 og 390 px |

**Brug `npm run build` til typekontrol, ikke `npx tsc --noEmit`.** Roden
`tsconfig.json` har `"files": []` og peger kun videre til `tsconfig.app.json`
og `tsconfig.node.json`. `tsc --noEmit` tjekker derfor ingenting og siger
pænt god dag. Det rigtige kald er `tsc -b`, som er det `npm run build` og CI
kører.

CI kører de samme tre på alle pull requests, plus et tjek for at et privat
Railway-domæne ikke er havnet i bundlen.

---

## Serveren er på plads

PocketBase er sat helt op, og appen er afprøvet i drift. Der er ingen kendt
blokering tilbage.

**Tre felter, oprettet 8. september 2026.** Indtil de fandtes, skrev appen data,
som aldrig kom op på serveren — for journalens vedkommende uden at nogen fik
besked:

| Samling | Felt | Type |
|---|---|---|
| `ture` | `pakkede_item_uids` | JSON |
| `turdeltagelse` | `journal` | JSON |
| `turdeltagelse` | `billeder` | File (multiple) |

**Samlingen `slettede`, oprettet samme dag.** Gravstenene, der får en sletning
til at slå igennem på tværs af enheder — og forhindrer, at en helt almindelig
redigering opretter en slettet post på ny og gør sletningen om for alle. Se
`POCKETBASE.md` trin 7 og afsnittet "Gravsten" i `README.md`.

Begge dele er bekræftet af ejeren i drift, ikke kun mod testmocken.

**Samlingen `tur_dage` mangler.** Den kom til med flerdagesturenes fundament —
se `POCKETBASE.md` trin 8. Springes den over, virker appen, men dagene bliver
på den enhed, de blev lavet på. Ingen fejl på skærmen.

`./scripts/tjek-pocketbase.sh <appens adresse>` er værd at køre efter en
opsætningsændring: den kalder som en helt uindlogget fremmed og siger fra, hvis
en samling er åben for alle. Den skriver ingenting.

## Designsystemet er låst — og ligger nu i repoet

`docs/design/` kom ind med PR #63 den 18. september. Den indeholder det, der
før kun lå bag et login: tokens, CTA-regler og **én HTML-reference pr. skærm**
— tolv til PC og otte til telefon.

Det løser et konkret problem. Handoff-siderne i Notion peger på previews på
`superdesign.dev`, og det domæne er blokeret af netværkspolitikken i
agent-miljøer. Hjem på PC blev derfor implementeret uden at nogen kunne se,
hvad den skulle ligne. `docs/design/README.md` siger det nu selv: *hent ikke
Superdesign, brug filerne her*. Reglen står også i `AGENTS.md` under
"Design", så den ikke skal genopdages.

**Notion er token-sandheden, `docs/design/` er den visuelle.** De to skal sige
det samme; gør de ikke, er det Notion der gælder, og så skal filerne rettes.

Alle elleve farver i `docs/design/TOKENS.md` stemmer nu med `:root` i
`src/index.css`. Sidebaggrunden var den sidste, der manglede.

**Der ligger tyve handoffs i kø.** Tolv er bygget — hele PC-køen: Hjem, Ture,
Tur-detalje, Pakning, Grej, Grejsæt, Folk, Mere, Steder & Statistik,
Indstillinger og de to opret-ark, Ny tur og Tilføj grej. Af de otte
mobilskærme er Pakning bygget; de syv andre er ikke rørt. Rækkefølgen er ikke
besluttet.

**Pakning på telefonen** fik det, PC-udgaven ikke havde brug for: en fyldt
knap, der følger pakningen. Tom tur → **Tilføj grej**, delvist pakket → **Pak
de n upakkede** (skærer listen ned til dem og ruller derhen), alt pakket →
turens eget næste skridt. Den, der ikke har den fyldte accent, er outline.
Reglen står i `pakkehandling` i `src/pakning.ts`. Kun før afgang (kladde og
klar); på en aktiv tur er det stadig på-tur-skærmen, der er den fyldte. Dertil
en stille linje øverst på fladen, der siger at krydsene gemmes på telefonen —
og siger "Du er offline", når man er det, uden at love noget om sync. Research
#1 (sep 2026): pakning er mobil-primær, og offline skal kunne ses.

Reeds første test af linjen fejlede: den blev ved med at sige "også uden net"
på en telefon uden net. Den lyttede kun på `navigator.onLine`, og den siger
"online", så længe der er *et* netværk — også et wifi uden internet, eller når
forespørgsler blokeres. Linjen spørger nu også selv (`src/forbindelse.ts`): et
lille HEAD-kald til appens egen oprindelse, uden om cachen, hvert tiende
sekund og ved online/offline/synlighed. Intet svar inden for fem sekunder er
offline, og så står linjen som en advarsel på advarselsfladen.
`useErOnline` i `useMedie.ts` er ikke ændret — Mere bruger den stadig.

**Tomme skærme på Hjem, Ture og Grej** viser nu *Kom i gang* i stedet for
én linje og én knap (research #2, sep 2026: en tom app skal give værdi, før
inventaret findes). To konkrete skridt, ingen rundvisning: **Opret første
tur** (det guidede flow) og **Tilføj 5 grej** (opret-arket). Fremdriften
regnes af basen — "2 af 5 skrevet ind" er det grej, der faktisk ligger der,
og intet gemmes om selve listen. Logikken står i `src/komIGang.ts`, skærmen i
`src/KomIGang.tsx`. Skridtene er aldrig fyldte: skærmens egen knap ("+ Ny
tur", "+ Tilføj grej", Hjems "Planlæg en tur") er stadig den ene fyldte
accent; skærmens eget skridt er outline, resten tekst. På Hjem har turskridtet
ingen knap, fordi kortet lige ovenover har den, og FAB'en er væk på en konto
uden ture — på telefonen ville den være fyldt accent nummer to.

Et tredje skridt, **"Åbn gæstelink-demo"**, er bevidst udeladt. Gæstevisningen
findes, men den kræver login og en rigtig delt tur. En demo ville være
opdigtede data, og det viser Feltbogen ikke. Skal den laves, er det en
beslutning om et demo-snapshot på serveren, ikke en UI-opgave.

Pakning kostede mere end en farverettelse: den var **to** faner, "Pakning" og
"Pakkeliste", og designet har én. Det er den samme liste to steder — man stod
med tasken på den ene fane, mens tallet, man pakkede efter, stod på den anden.
De to er nu én flade med fremdriften øverst.

Grej var den femte, og overtrædelsen var den samme som på de andre: de fem
faneblade over listen tegnede den valgte fane som en fyldt accent-pille, og
sammen med "+ Tilføj grej" var det to fyldte accenter i det samme
skærmbillede. Referencen tegner faneblade med en streg under det valgte.
Dertil tre ting, referencen havde og skærmen ikke: Vedligehold-tallet i
advarselsfarven, mærket **Pas på** ude på de rækker, der venter på én, og en
Grejsæt-indgang som et kort med en outline-knap frem for en listerække med en
chevron — den lignede et stykke grej i listen nedenunder. Linjen under
overskriften siger nu antal og vægt ("4 ting · 13,1 kg") og ikke antal og
kroner; det er dét, både desktop- og mobiltegningen skriver, og den samlede
værdi står stadig på Statistik.

Grejsæt var den sjette. Her var overtrædelsen ikke det, skærmen gjorde, men
det, den ikke gjorde: den var en almindelig liste med navn, antal og vægt,
hvor referencen har en master-detail og en **Brug på tur** med bekræftelse.
Sættene står nu til venstre og det valgte sæts indhold til højre, så to
pakninger kan sammenlignes uden at gå ind og ud af dem. Referencen tegner
både "Nyt sæt" og "Brug på tur" fyldt — det er to, og "Brug på tur" vandt:
et sæt findes for at blive brugt. Er der intet sæt at bruge, flytter den
fyldte sig til "Nyt sæt".

"Brug på tur" og "Opret fra tur" er ark af samme slags som opret-arkene:
vælg en tur, se overblikket, og først dét tryk skriver noget. Overblikket er
det, handoff'en beder om — grej, turen har i forvejen, lægges ikke til to
gange, og `indlaesning()` i `src/grejsaet.ts` siger hvor mange det er, og hvad
turen går fra og til, før man bekræfter.

Folk var den syvende, og her var overtrædelsen omvendt af de andres: skærmen
havde ingen fyldt accent overhovedet — "+ Tilføj" var outline, også når der
stod et navn i feltet, og introkortet var et gradient-felt med en 54 px
ikonskive, der vejede tungere end skærmens eneste handling. Referencen vender
om på det: kortet er roligt, og den fyldte accent tændes af navnefeltet.
Er feltet tomt, er knappen slået fra, og der er *ingen* primær handling på
skærmen — det er med vilje, for der er ikke noget at trykke på endnu. En
hjælpetekst under feltet siger "Skriv et navn for at tilføje", så den slukkede
knap ikke ligner en fejl.

Forslagene fra turene hed før "Navne fra dine ture der ikke er personer endnu"
og stod som fyldte småknapper mellem feltet og listen. De er nu et eget afsnit
nederst, **Foreslået fra dine ture**, med outline-chips og en linje om, hvad et
tryk gør — de lignede filtre og er det modsatte: de skriver i basen.

Én ting mere, som ikke var en farve: feltet blev ikke tømt, før personen var
synkroniseret. `opret()` i `sync.ts` venter på serveren, før den vender tilbage,
og navnet blev derfor stående i feltet, til synkroniseringen var ovre. Med en
langsom forbindelse så det ud som om trykket ikke var registreret, og så trykker
man igen og får personen to gange. Feltet tømmes nu først, skrivningen bagefter.

Mere var den ottende, og her var det ikke en knap. Skærmen havde ingen — den er
navigation — men sync-rækken læste kun køens længde og ikke den fejl, appen
havde noteret om det seneste forsøg. Med en tom kø stod der "Alt er sendt op",
også når serveren lige havde sagt nej til det, der blev sendt. Startskærmen har
haft fejlen med hele tiden (`useSyncfejl` i `syncfejl.ts`), så de to linjer om
den samme tilstand sagde hver sit. Rækken får nu den samme kilde, og en fejl
står i advarselsfarven med en prik foran, så den kan ses i en kolonne af ens
grå undertitler.

Resten var form: de ni rækker lå løst under hver sektionstitel, adskilt af hver
sin streg, og referencen samler hver sektion i ét kort — hårfin kant, 12 px
runding, den forhøjede flade. Undertitlerne er skåret ned til referencens
længde, og under kortene står en linje om, hvad sync-rækken lover.
Årsopgørelsen står ikke i tegningen, fordi den kun findes i januar; den er
blevet, som den række i historik-kortet den er.

Steder & Statistik var den niende, og her var overtrædelsen selve opdelingen.
Det var to skærme om det samme — hvor man har været, og hvad det blev til — og
man kom til dem ad hver sin række under Mere.
`docs/design/desktop/09-steder-statistik.html` tegner dem som én skærm,
**Friluftshistorik**, med to faneblade. Det er den, der er bygget:
`FriluftshistorikSide.tsx` er rammen, `StederPanel.tsx` og
`StatistikPanel.tsx` er de to faner. De beholder hver sin fane-id i
navigationen, så Mere-rækkerne kan pege hver sin vej ind, og skallen ved
stadig, at vejen tilbage går til Mere.

Steder var en flad liste over stedbogen med en fyldt "+ Nyt sted" øverst — et
register, man selv skulle vedligeholde. Men man skriver ikke steder ind i et
register; man skriver dem på en tur. Listen kommer nu af turene
(`stederMedBesoeg` i `src/friluftshistorik.ts`), og hvert sted er et kort med
det, turene siger om det: aktivitet og terræn, hvornår man sidst var der, hvor
mange ture og nætter det blev til. En tur, der stadig er kladde, tæller med —
man har skrevet den ned — men den står markeret i advarselsfarven, så tallet
kan læses med det forbehold. Et sted, der kun står som fritekst på en tur, kan
ikke åbnes, og kortet siger det frem for at se ud som en knap, der ikke virker.
"+ Nyt sted" er blevet en tekstknap nederst: den kan stadig det, den kunne,
men den er ikke længere skærmens forslag til, hvad man skal.

Statistik var et instrumentbræt: tre perioder, et fyldt årsopgørelseskort og
fjorten felter i et gitter, hvoraf de fleste handlede om inventaret. Øverst
står nu de fire rolige tal, referencen tegner — ture, nætter, grej i bog, kg
grej — nætterne fordelt på månederne i sæsonen, og det grej, man faktisk
bruger. Mønstrene er ikke væk: hyldevarer, det der går i stykker,
vurderingerne og inventarværdien ligger foldet sammen under én linje, man selv
slår op. Perioden er to valg og ikke tre; året før er ikke et filter, det er
en beretning, og den ligger i årsopgørelsen, som kan vælge et hvilket som
helst år med ture i. Årsopgørelsen selv er flyttet op i headeren som en
outline-knap.

Knappen byggede først på `aarMedTure`, der springer kladder over — og ture
oprettes *som* kladde (`opretTomTur`) og bliver det, til man kommer hjem. En
tester med tre ture i bogen fik derfor ingen knap og ingen forklaring på
hvorfor. Den står nu, så snart en tur har en dato på, kladde eller ej
(`aaretAtGoereOp` i `src/aarsopgoerelse.ts`): er der et år, der kan gøres op,
peger den på det, ellers på det nyeste år, der er skrevet noget ned i.
Opgørelsen for sådan et år er tom, men den er ikke stum — den siger selv
"Kladder tælles ikke med", og det er dét svar, den manglende knap holdt
tilbage.

Den fyldte accent er det valgte faneblad, og kun det. Referencen tegner også
årsvælgeren fyldt, men den tegning viser begge faner på én flade "for
one-canvas review"; i produktet står de aldrig sammen, og den låste regel om
én fyldt accent pr. skærmbillede vejer tungere end udkastets to. Steder havde
en FAB på telefonen — den er væk af samme grund, og fordi listen ikke længere
er noget, man selv fylder.

To rækker under Mere løj om det, de førte hen til. "Steder" talte stedbogen op
og kaldte tallet *steder du kommer tilbage til* — men et sted, man har
oprettet, er ikke et sted, man har været, og ét besøg er ikke et gensyn.
"Statistik" talte grej op (*4 ting talt op*) på en skærm om ture. De siger nu
antallet af steder og gensynene for sig, og ture og nætter.

Favoritterne i referencen — **Gem** på et sted, og *0 favoritter* i
Mere-rækken — er ikke bygget. De kræver et nyt felt på `Sted`, og datamodellen
er ejerens valg (`AGENTS.md`). Gensynene tælles i stedet ud af turene, så
linjen kan være ærlig uden et felt, ingen har sagt ja til.

Indstillinger var den tiende, og her var der tre fyldte accenter på én skærm:
"Synkronisér nu" plus de to segmenter — aktivitetsniveauet og niveauet på nye
pak-af-tjek — som tegnede det valgte i fyldt accent. Var man ikke logget ind,
var "Log ind eller opret konto" den fjerde. Segmenterne er nu den stille
variant: et valg, der beskriver kroppen eller en vane, er en oplysning og ikke
skærmens handling. "Synkronisér nu" er outline, og synkroniseringen kører i
forvejen af sig selv.

Skærmens ene fyldte accent er **Gem navn**, og den tænder kun, når der er et
rettet, gyldigt navn at gemme — resten af tiden er den slået fra, præcis som
"+ Tilføj" under Folk. Uden en konto er det "Log ind eller opret konto", og der
er ikke noget navnefelt at konkurrere med.

Navnet kunne gemmes tomt. Man ryddede feltet, knappen tændte — teksten var jo
en anden end den gemte — og bagefter stod man som «Uden navn» på sine egne
ture, mens gæstesiden ikke kunne skrive, hvem turen var fra. Et tomt felt slår
nu knappen fra, etiketten siger *må ikke være tomt*, og en linje under knappen
siger, hvad der skal til for at tænde den. Har kontoen slet ikke noget navn,
står der en advarsel om, hvad det betyder på de delte ture — den går væk, når
navnet er nået op, og ikke før.

Resten var etiketter og form: en undertitel under titlen, e-mailen mærket
**Logget ind**, en linje over "Din krop" om, hvad tallene bruges til og at de
ikke deles, og spalten venstrestillet under titlen i stedet for centreret.
Versionslinjen under **Om** (0.2.0 · sha) er urørt og har fået en test, så en
senere omlægning af skærmen ikke kan tabe den igen.

Handoff'ens reference tegner også **Højde**, **Vægtenhed (lb)**, **Sprog** og
en **Farezone** med *Ryd denne enhed* og *Slet konto*. De er ikke bygget: de
kræver enten nye felter eller sletning af data, og begge dele er ejerens valg
(`AGENTS.md`). Sync-afsnittet er blevet, hvor det er — referencen henviser til
"Mere → Synkronisering", og det er præcis den række, der fører herind.

De to opret-ark var den sidste blok i PC-køen. Selve arkene fandtes: de blev
bygget, da create-before-confirm blev lukket, og den del af handoff'en var
indfriet — intet oprettes ved åbning, Opret er slået fra uden en titel eller et
navn, og Annuller, Escape og et klik ved siden af lukker uden at skrive noget.
Det, der manglede, var at holde dem op mod `11-sheet-ny-tur.html` og
`12-sheet-tilfoej-grej.html`:

- Statusvælgeren i Tilføj grej tegnede det valgte i fyldt accent. Så snart
  navnet var skrevet, var der to fyldte flader i arket. Den er nu den stille
  variant — referencen tegner "Ejer" fyldt, men reglen vejer tungere, som på
  Grej og Indstillinger. Den skrev desuden statusserne med småt ("ejer"),
  fordi `etiket()` ikke kender dem.
- En slukket Opret uden en grund ligner en fejl. Under knapperne står nu,
  hvad der skal til ("Skriv en titel for at oprette."), som referencens linje
  under foden. Linjen er kun slået til på de to opret-ark; arkene bag
  grejsæt siger det allerede i deres overblik.
- Titlen i Fraunces 24 px, Opret 48 px høj, Tilføj grej i det smalle ark
  (512 px), og vægt og pris med enheden inde i feltet og etiketten over — før
  lå etiketten inde i et kort, i en anden form end arkets øvrige felter.
- Forklaringen under titlen siger nu hvorfor, som referencen gør: *så lander
  der ikke en tom tur på dine andre enheder* og *intet oprettes bare ved at
  åbne*.

**Ikke bygget:** "Flere detaljer" (Ny tur) og "Avanceret" (Tilføj grej).
Referencerne tegner linket, men ikke hvad der ligger bag det, og handoff'en
siger "nye features der ikke er i preview" er uden for scope. Alt, man kunne
skrive der, kan skrives inde på turen eller grejet bagefter.

Tre regler fra `TOKENS.md` gælder bredere end den enkelte skærm og er ikke
efterprøvet på det, der allerede står:

- Maks **én** fyldt accent-knap pr. skærmbillede. **Gennemgået på PC** —
  se pkt. 10.
- ~~Et opret-ark må ikke oprette noget, før man trykker Opret.~~ **Indfriet.**
  Ture og grej oprettes nu gennem et ark (`src/Ark.tsx`), og det gør "Opret
  fra tur" på Grejsæt også. "Nyt sæt" og steder opretter stadig med det samme
  — de har ikke fået et ark tegnet, og oprydningen i `lukDetalje` dækker dem
  indtil da.
- Det hedder **Afsluttet**, ikke "arkiveret". (Tjekket: ordet "arkiveret"
  findes ikke i `src/`. Den er allerede opfyldt.)

---

## Åbne arbejdsområder

I den rækkefølge, de sandsynligvis er værd at tage.

### Arkitektur og data — kræver en beslutning først

1. **En base pr. konto.** Basen bærer nu et ejermærke, og et kontoskift stopper
   og spørger frem for at blande — men to personer kan stadig ikke bruge samme
   browser hver for sig. Det kræver en Dexie-base pr. konto eller en
   ejer-kolonne på hver tabel. Ingen har haft brug for det endnu.
   (`CODE_REVIEW.md` §3)
2. **Konflikter er last-write-wins.** Enkelt og forudsigeligt, men to enheder,
   der offline redigerer hver sit felt på samme post, flettes ikke.
   (`CODE_REVIEW.md` §4)
3. **Billeder er ikke med i JSON-sikkerhedskopien.** En komplet backup kræver
   et arkivformat med binære filer. (`CODE_REVIEW.md` §1)

### Kvalitet

4. **UI-testdækningen er begyndt, ikke færdig.** Der er nu skærmtests i jsdom
   for navigationen og kontoskift-skærmen — de to steder, hvor en regression
   ellers var usynlig. Billeder, delingsflowet, pakkelisten og
   offline-tilstandene har stadig ingen skærmdækning. (`CODE_REVIEW.md` §6)
5. **Kontoskift-skærmen er stadig ikke set af et menneske.** Dens opførsel er
   nu dækket af tests — knapperne, rækkefølgen, at rydningen kun sker ved et
   klik — men en test kan ikke sige, om skærmen er *til at forstå*, når man
   møder den uventet. Prøv den med to konti på localhost; den base er adskilt
   fra produktionens.
6. **Tilgængelighedspas på dialoger.** Modaler, delings-/QR-flow og
   fejltilstande er ikke gennemgået for fokusfælde, retur-fokus, Escape og
   labels. (`UI_REVIEW.md` P1)
7. **Fysisk feltprøve.** Lys/mørk tilstand udendørs, stor systemtekst, 200 %
   zoom, én hånd, handsker. Alt er hidtil afprøvet i en desktopbrowser med
   ændret viewport. (`UI_REVIEW.md` P1)
8. **Eksterne fetch-kald mangler fælles timeout.** En langsom vejr- eller
   adresseudbyder kan holde en UI-handling åben længe. (`CODE_REVIEW.md` §5)
9. **`App.tsx` har ingen tests.** Oprydningen i `lukDetalje` — den der
   sletter en navnløs post igen, når man fortryder — er udækket i begge
   retninger. Den dækker nu kun grejsæt og steder, men den er stadig det
   eneste værn mod at de to efterlader tomme poster. Selve oprettelsen er
   dækket hele vejen fra ark til post af `opretflow.test.ts`; det er
   sammenkoblingen inde i `App.tsx`, der mangler.
10. **Reglen om én fyldt accent er gennemgået på PC — ikke på telefonen.**
    De tolv PC-skærme med en handoff er holdt op mod deres HTML-reference, og
    resten af PC-skærmene har fået et CTA-pas (nedenfor). Telefonens skærme
    kan stadig afvige fra de låste tokens og fra reglen, uden at nogen har set
    efter; de har deres egne handoffs, og kun Pakning er bygget — dens
    Pakning-fane er testet for én fyldt accent i alle tre tilstande
    (`Pakning.test.tsx`).

    Fem af de syv gennemgåede havde en rigtig overtrædelse, ingen havde meldt:
    Hjem havde tre fyldte accent-knapper over folden, Tur-detalje havde to,
    pakkelistens opdelingsvælger var den anden fyldte accent på Pakning, og
    Grejs fanebladsvælger var den anden på Grej. Folk brød reglen den anden
    vej og havde ingen fyldt accent overhovedet. Det er værd at regne med, at
    de øvrige også har.

    **CTA-passet på de øvrige PC-skærme er lavet** (sammen med opret-arkene).
    Fem brød reglen, og ingen havde meldt det — alle med noget, der ikke er
    en knap af den primære slags:

    - **Ture:** Gitter/Liste-vælgeren var fyldt ved siden af "+ Ny tur".
      Referencen tegner den sådan; den er nu stille.
    - **Sted-detalje:** "Find" (koordinat-opslaget) var fyldt ved siden af
      "Opret tur her". Den er nu outline.
    - **Årsopgørelse:** det valgte år var en fyldt knap ved siden af "Årets
      feltbog". Årene er nu en stille segment, som perioderne på Statistik.
    - **Pak-af-tjek:** niveauvælgeren og en vælger *på hver eneste række*
      tegnede det valgte fyldt — med tyve ting på turen var det over tyve
      fyldte flader. De er stille, og "Færdig" er den ene.
    - **Første tur:** hvert svar (sted, dato, nætter, aktivitet …) blev fyldt,
      når man valgte det, ved siden af "Videre". Nu tonet, som den stille
      segment.

    Testene står i `src/ctaPas.test.tsx` og tæller alt, man kan trykke på,
    der er malet i accenten — ikke kun `.ui-button--primaer`. Streger og
    diagramsøjler tæller ikke.

    **Set undervejs, ikke rettet:** Grej-detaljens statusvælger er stadig
    fyldt. Den er den eneste fyldte flade på skærmen, så den bryder ikke
    reglen, men den ser anderledes ud end den samme vælger i Tilføj grej.

    **Set undervejs, ikke rettet:** Grejsæt på telefonen er stadig den liste,
    den altid har været — nu med referencens linje under navnet ("8 ting ·
    6,2 kg · brugt på Fovslet Skov") og med "Opret fra tur", men uden
    master-detail og uden "Brug på tur". Telefonen har ingen Grejsæt-handoff i
    pakken, så der er intet at bygge efter; det er derfor udskudt og ikke
    overset.

    **Set undervejs, ikke rettet:** Overblik-fanen på en tur har to fyldte
    accenter på telefonen — turens primære knap og `Se fordelingen` i
    forslagskortet. Det hører til Tur-detalje · mobil og ikke til denne
    skærm.

    **Set undervejs, ikke rettet (Pakning · mobil):** referencen
    `docs/design/mobile/06-pakning.html` tegner turens titel på en fyldt
    accent-flade og har "Fælles"/"Dig" som filtre. Titlen er Tur-detalje ·
    mobil's (Turhero), og filtrene er de eksisterende opdelinger (Alle,
    Grejsæt, Tag, Person, Fælles) — ingen af dem er ændret her.

    **Set undervejs, ikke rettet:** `docs/design/mobile/03-grej.html` sætter
    også **Pas på** på rækkerne i telefonens grejliste. Mærket er kun lagt i
    PC-tabellen — mobilen har sin egen handoff, og den er ikke bygget endnu.

### Funktioner, der venter

11. **Rute som eget domæne.** Nu efter dagen og ikke før — rækkefølgen er
    byttet om, se `PLAN.md` §9 trin 6. Åbner for kilometer, højdemeter og
    kortfanen på delte ture. Dagen får et `rute_uid`, og det er additivt.
12. **Badges og notifikationer.** I fundamentet §9, ikke bygget.
13. **Tidevand ved kystture.** Kræver en DMI-nøgle. (`IDEER.md` §5.4)
14. **Onboarding og adaptiv hjælpegrad.** Bevidst udskudt — vi bygger til
    ejeren først. Bliver relevant, hvis appen skal ud til andre.
15. **Virtualisering af lange gearlister.** Først værd at bygge, når en liste
    er lang nok til at hakke. Afhænger af et rigtigt inventar.

### Kalibrering

16. **Motorens tærskler er sat efter mavefornemmelse.** Hvornår vægten er
    værd at nævne, hvor godt et grejsæt skal matche, hvor mange ture der skal
    til, før noget regnes som ubrugt. De er nemme at justere — men kun
    meningsfuldt, når de har været brugt på rigtige data over en sæson.

---

## Bevidst fravalgt

Står her, så det ikke bliver foreslået igen uden en ny grund. Begrundelserne
står i `PLAN.md` §4 og §9.

- **Router og deep links.** Venter på et behov, der betaler for det —
  browserens tilbage-knap, PWA-startpunkt og token-ruterne skal tænkes
  igennem samlet.
- **Engelske mappenavne.** Koden er dansk hele vejen igennem.
- **AI og naturligt sprog.** Ligger ovenpå Smart Motoren, ikke i stedet for
  den. Fundamentet skal stå først.
- **Kvitteringsfil på grej.** Kræver et fil-felt i PocketBase, og selv
  gap-analysen er i tvivl om, den hører til 2.0.

---

## Grene

**Én åben pull request:**

| PR | Gren | Hvad den gør |
|---|---|---|
| [#72](https://github.com/K-ingo/Feltbogen/pull/72) | `claude/vigilant-volta-93teld` | Folk på PC: den fyldte accent tændes af navnefeltet |

#62, #63, #64, #65, #66, #67, #68, #69, #70 og #71 er merget.

De tre sidste blev **squash-merget**. Grenene er derfor ikke forfædre til
`main`, og `git branch --merged` melder dem som åbne, selvom indholdet er
inde. Tjek på indholdet, ikke på grenen.

**Ingen beslutninger står åbne.** De tre, der gjorde, blev truffet
19. september:

- **`Seneste minder` bliver stående** over folden på Hjem, selvom designets
  Hjem-skærm ikke har afsnittet. `UI_REVIEW.md`s første princip vejer
  tungere: *"Eventyret først — næste tur og egne minder har højere visuel
  prioritet"*. Minder er ikke statistik.
- **`Afsluttet` beholder sin neutrale farve.** Designet viser den i sage
  grøn, men tinten er reserveret til `Gjort op`. Fulgtes designet, ville de
  to blive næsten umulige at skelne, og påmindelsen om at gøre turen op
  ville forsvinde. Designet kender kun to faser; koden har fem.
- **Hovedspalten sættes til 1024 px** — designets mål på både Hjem og Ture
  (`--hovedspalte` i #67).

16 fjerngrene er ikke merged ind i `main`, heraf `claude/tur-detalje-handoff`
ovenfor og tre, der er squash-merget og bare ikke slettet. De øvrige tolv er
formodentlig forældede rester fra tidligere sessioner, men ingen
har gennemgået dem. Den største er `claude/code-review-g3oqnn` med 55
commits. Oprydningen er ikke foretaget, og ingen gren er slettet — det
kræver ejerens accept.

Sletningen er i øvrigt forsøgt: `git push origin --delete` bliver afvist med
en 403 af den egress-proxy, agent-miljøet kører bag. Grenene skal slettes
fra GitHubs egen brugerflade.

---

## Sådan holdes filen ved lige

Opdatér den, når noget bliver færdigt, blokeret eller besluttet — ikke ved
hver commit. Datoen og commit-hashen øverst skal følge med, ellers ved næste
læser ikke, hvor gammelt billedet er.
