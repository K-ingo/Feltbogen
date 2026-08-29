# Feltbogen 2.0 — vejen frem

*August 2026. Oversættelsen af 2.0-specifikationen til arbejde, der passer til
den kode, der faktisk står i repoet.*

Specifikationen (`Feltbogen 2.0 — Teknisk UI/UX- og implementeringsspecifikation`)
beskriver måltilstanden godt, men den er skrevet, som om kodebasen var tommere
end den er, og den modsiger sig selv et par steder. Dette dokument er broen:
hvad der allerede findes, hvad der reelt mangler, hvad vi bevidst lader være
med, og i hvilken rækkefølge det tages.

Rækkefølgen er ikke tilfældig. Den er valgt, så hvert skridt kan afsluttes og
bruges for sig — appen skal aldrig stå halvt ombygget.

---

## 1. Beslutninger, der ligger fast

Specen lod tre spørgsmål stå åbne. De er afgjort nu, og resten af dokumentet
bygger på dem.

### Grupper bliver under Grej

Den nye informationsarkitektur (Hjem / Ture / Grej / Folk / Mere) har ingen
plads til Grupper. Men Grupper er ikke en fane, man kan fjerne: det er en
tabel i `db.ts`, og `Tur.grupper` med `item_ids_slået_fra` er selve mekanikken
bag, hvordan grej kommer på en tur. En gruppe er et kurateret sæt
("Hængekøje-sommer"); en kategori er en klassifikation. De to ting er ikke
hinandens erstatning.

**Afgørelse:** Grupper flytter ind under Grej som en sektion. Datamodellen
røres ikke. Bundnavigationen kan derved gå fra seks faner til fem, som specen
vil have.

En navneforvirring skal holdes for øje: infografikken bruger "Grupper" om
*gruppeture med deltagere*, mens koden bruger det om *grejsamlinger*. I
brugerfladen hedder de fremover **grejsæt** (samlinger) og **deltagere**
(mennesker på en tur). To ord, to ting.

### Turen har seks faner — På tur er et mode

Specen siger seks faner i §6 og ni i §16/§32. Ni går ikke på en telefon, og
"På tur" som fane modsiger specens egen §33.10, der argumenterer for, at På
tur skal være et separat mode med eget layout og egne offline-krav.

**Afgørelse:** Overblik · Pakning · Pakkeliste · Deltagere · Undervejs ·
Praktisk. På tur, pak-af-tjek og feltbogen er skærme, man går ind i og ud af
igen — ikke faner.

Specens sjette fane hedder Kort, men appen har intet kortlag — hverken Mapbox
eller Leaflet, kun links ud til OpenStreetMap. En tom fane er værre end ingen
fane, så pladsen gik til **Undervejs**, som samler afgangs-tjek, turlog,
billeder og pak-af-tjek. Kommer der et rigtigt kort en dag, er der plads til
det på Overblik.

### Vi bygger til ejeren først

Feltbogen skal være rigtig god for én bruger, før den bliver acceptabel for
mange. Det betyder, at onboarding, adaptiv hjælpegrad (specens §5 med fire
niveauer) og skaleringsarbejde venter. Gæstedeling og turkortet bevares, som
de er, fordi de allerede virker og allerede har brugere.

---

## 2. Hvad specen beder om, der allerede findes

Læses §30 ("Første konkrete kodningsopgaver") som en to-do-liste, genskrives
fungerende, testdækket kode. Dette er kortet over, hvad der allerede er der.

| Specen siger byg | Findes som | Status |
|---|---|---|
| §13 Smart-motor i eget domænelag | `smartMotor.ts` (870 linjer, 796 linjer test) | Ren, UI-fri, deterministisk. Kravet er opfyldt. |
| §14 "Brug sidste tur" | `ligesomSidst.ts` | Opretter nye poster, rører ikke historikken. |
| §12 Efter-tur evaluering | `pakAfTjek.ts`, `PakAfTjekSide.tsx` | Brugt/ubrugt/i stykker, to niveauer. |
| §11 Turjournal | `feltnoter.ts` | Samlet pr. dag. |
| §10 På tur / Live Mode | `paaTur.ts`, `PaaTurTilstand.tsx` | Eget layout allerede. |
| §3 Dashboard | `dashboard.ts`, `DashboardSide.tsx` | Skal rettes ind efter §3's viewmodel, ikke bygges om. |
| §22 Offline, sync, uid | `sync.ts` (1.215 linjer) | uid er allerede invariant; sletninger registreres. |
| §23 Snapshot-deling | `delesnapshot.ts`, `gaest.ts`, `turkort.ts` | Snapshot-grænsen er på plads. |
| §19 Design system | `ui.tsx`, `index.css` | Primitiver og tokens på plads. |
| §25 Vedligehold | `vedligehold.ts` | Intervaller der går i ring. |
| §12 Statistik | `statistik.ts`, `aarsopgoerelse.ts`, `feltbog.ts` | Dybere end specen beskriver. |

Meget af det, der læses som nye funktioner, er i virkeligheden **omdøbninger**:
Inventar → Grej, feltnoter → Journal, pak-af-tjek → Evaluering. Det er fint at
omdøbe i brugerfladen; det er ikke fint at bygge dem igen.

## 3. Hvad specen glemmer, som allerede er i produktet

Disse dele står ikke i 2.0-dokumentet og skal ikke tabes, når IA'en lægges om:

- **Gæster, der bidrager med eget grej.** Specen behandler gæster som
  read-only snapshot-læsere. Fundamentet og koden lader gæsten lægge sit eget
  gear i den fælles pakkeliste. Taget bogstaveligt ville §23 være et tab af
  funktionalitet.
- **Turkortet til pårørende** — ét frosset felt, én modtager, ingen konto.
  Nævnes ikke ét sted i specen. Det er en sikkerhedsfunktion og bliver.
- **Årsopgørelsen og Årets feltbog** har ingen plads i den nye IA. De hører
  under Mere → Statistik.
- **Sol og skumring, jagtsæson, tørke og afbrændingsforbud.** Den danske
  friluftskontekst er det, der gør Feltbogen til Feltbogen frem for en generisk
  pakkeliste-app. Den skal have plads i turens Overblik.
- **Fortryd-sletning** (vinduet på 25 sekunder). Specen taler om, at
  sletninger skal registreres, men ikke om at de skal kunne fortrydes.
- **Budget.** `budget_linjer` findes i modellen og på infografikken, men ikke i
  specen.

Og én ting specen beder om, som **ikke har en datakilde**: kilometer og
højdemeter (§12). Der er hverken rute, GPX eller distance nogen steder i
`db.ts`. Det er et nyt datadomæne, ikke en statistikfunktion, og det ligger
uden for denne omgang.

## 4. Hvad vi bevidst ikke gør nu

**Router (§20).** Appen skifter skærm med `useState` i `App.tsx`, og
gæstelink/turkort læses fra adresselinjen. De ~30 ruter i §20 er ikke en
oversættelse — det er deep links, browserens tilbage-knap, PWA-startpunkt og
token-ruterne, der skal tænkes igennem samlet. Det venter, til der er et behov,
der betaler for det.

**Engelske mappenavne (§21/§28).** Koden er konsekvent dansk: `smartMotor.ts`,
`pakAfTjek.ts`, `ligesomSidst.ts`, `vaegtbrydere.ts`. En blanding er værre end
begge dele hver for sig. Princippet bag §33.13 — domænelogik uafhængig af UI —
er allerede opfyldt; det er kun mappenavnene, der mangler, og de er ikke prisen
værd.

**Adaptiv hjælpegrad med fire niveauer (§5).** Fire varianter af hvert guidet
flow skal både bygges og testes. Det, der allerede findes — et onboarding-flag
og tips, der kan slås væk — giver det meste af værdien.

**Én ting til at holde øje med:** §33.19 siger, at derived state aldrig må
gemmes som ekstra sandhed. Reglen er rigtig, men `vejrsnapshot` og
`delesnapshot` er *bevidste* undtagelser — gæsteadgangsgrænsen kræver, at det
delte er frosset, fordi en læseregel i PocketBase gælder hele posten. Retter
nogen på `delesnapshot` i regelrytteriets navn, åbnes ejerens data for gæster.

---

## 5. Rækkefølgen

### Skridt 1 — Turdetaljen får faner ✅

`TurDetalje.tsx` er 2.587 linjer og projektets største fil med god margin. Alt
om en tur står i én strimmel af foldbare kort, og på mobil skal man scrolle
forbi femten sektioner for at nå noterne.

Sektionerne er allerede byggede som selvstændige stykker — det er kun
sammensætningen, der skal laves om. Ingen ændringer i datamodellen, ingen
ændringer i sync.

Faner: Overblik · Pakning · Pakkeliste · Deltagere · Undervejs · Praktisk.

Dette er det største enkeltløft i hele planen, og det er derfor det første.

### Skridt 2 — Design tokens ✅

Et fælles sæt CSS-variabler for spacing (4/8/12/16/24/32), radius, touch
targets og typografi, brugt af `ui.tsx`, `Skal.tsx` og `layout.ts`. Se
README for hvad de hedder og hvornår de gælder.

Rørehøjden skifter selv mellem 44 px på touch og 36 med mus, så en ny knap
får det rigtige mål uden at nogen skal huske reglen. De skærme, der endnu
skriver deres egne tal, kan flyttes over efterhånden — tokensne gælder, så
snart en værdi bliver slået op i stedet for skrevet ind.

### Skridt 3 — Dashboardet rettes ind ✅

`DashboardSide.tsx` fandtes allerede med næste tur, handlinger og nøgletal.
Det, der manglede, var to af specens fire spørgsmål: **Feltbogen foreslår** og
**sync-status**.

Forslagene er bygget på motorens egne funktioner — `foreslaaKopi`,
`foreslaaGrupper` og `vaegtbrydere` — og der er ikke lavet nye regler. De
skriver ingenting: kortet fører hen til turen, hvor man selv siger ja. Et
forslag, der ændrer data, når man trykker på det, er ikke et forslag.

Sync-linjen står nederst og ikke øverst, og kun en rigtig fejl får en farve.
At have ændringer liggende uden dækning er den normale tilstand for en app,
man bruger i skoven — den skal ikke blinke rødt, fordi man er kommet ud, hvor
der ikke er signal.

**Et fund undervejs, som har betydning for resten:** specen vil have en
pakkeprogression på turkortet — 36 af 42 pakket — og hele §7 og §8 bygger på
den. Den findes ikke. Der er ingen pakket-tilstand pr. item i datamodellen,
kun hvilket grej der er *valgt* til turen. `Pakkelinje` har hverken `pakket`
eller `status`, og `afkrydset` findes kun på afgangs-tjekkets linjer.

Specens §7.1 (unchecked / packed / blocked / optional) er altså en **ny
funktion med en datamodelændring**, ikke en ny præsentation af noget, appen
allerede ved. Startskærmen viser derfor det, der er sandt: hvor meget grej der
er valgt, og hvor langt afgangs-tjekket er — det er en rigtig liste med
rigtige kryds. Et tal, der lader som om, er værre end intet tal.

Skal pakkeprogressionen bygges, er det sit eget skridt: et felt pr. item pr.
tur, som skal synkroniseres og indgå i konfliktstrategien.

### Skridt 4 — Navigationen fra seks faner til fem ✅

Hjem · Ture · Grej · Folk · Mere. Grejsæt (før "Grupper") ligger under Grej,
Steder og Statistik under Mere.

To ting blev til undervejs, fordi fire skærme gik fra at være faner til at
være underskærme. Skallen kender nu sammenhængen mellem dem (`HOERER_TIL`), og
den bruger den to gange: navigationen markerer hovedfanen, så man kan se hvor
man er, og der kommer en "‹ Grej"-linje over titlen. Begge dele udledes frem
for at blive sendt med som prop — en vej tilbage, man kan glemme at sende med,
er en vej tilbage, der før eller siden mangler ét sted.

**Folk blev en rigtig skærm.** Personer lå inde i indstillingerne, fordi de
blev regnet for noget man vedligeholder sjældent. Det holdt ikke: en tur med
andre er en af de ting, appen er til, og de mennesker man tager afsted med, er
ikke en indstilling.

Tandhjulet i topbaren er væk. Det var den eneste vej til indstillinger, dengang
de ikke stod i navigationen; nu ville det være en anden dør til samme rum.

Internt hedder fanen stadig `inventar`, og filen hedder stadig
`InventarSide.tsx`. Det er kun ordet i brugerfladen, der er blevet til "Grej" —
et inventar er stadig præcis, hvad det er.

### Skridt 5 — Turens livscyklus lukkes ✅

Kladde → klar → på tur → afsluttet → gjort op, med de skærme, der allerede
findes, bundet sammen.

Knappen, der førte turen videre, fandtes i forvejen. Det, den ikke gjorde, var
at sige, hvad turen manglede, før det gav mening at trykke. Man kunne markere
en tur klar uden datoer og uden grej, og appen sagde ingenting.

`turfase.ts` svarer nu på "hvad nu?" som ren logik, med 16 tests. Manglerne
står under knappen — ikke som en lås på den. Fundamentet siger, at Feltbogen
hjælper, men aldrig tvinger, og at manglende data er i orden; man skal kunne
tage afsted på en tur, appen synes er halvfærdig.

**Specens PLANLÆG blev ikke til en tilstand.** Specens §4 har seks faser, hvor
appen har fire i basen. PLANLÆG beskrives som "dato, sted, aktivitet,
deltagere og setup redigeres" — det er præcis, hvad en kladde er, og en
tilstand mere ville skulle migreres og synkroniseres uden at sige noget nyt.
EVALUERET er derimod med, men udledt af, om pak-af-tjekket er udfyldt.

Turlisten viser fasen frem for den rå tilstand, og "Gjort op" er den eneste
grønne: det er den eneste fase, hvor der ikke er mere, der skal gøres.

---

## 6. Reglen om, hvor et forslag lander

Fra brugen af det, der blev bygget ovenfor, og den står nu i `turmaal.ts`:

> Når appen foreslår noget eller peger på noget, der mangler, skal man enten
> kunne gøre det på stedet — eller trykke og lande dér, hvor det kan gøres.
> Brugeren skal aldrig lede efter det, appen selv har bragt på bane.

Den blev skrevet, fordi vægtforslaget på startskærmen brød den: kortet sagde
"vægten kan ned", man trykkede, og så stod man på turens overblik uden noget
at gøre. Forslaget var rigtigt, motoren havde regnet rigtigt, og det var
alligevel ubrugeligt — det, der manglede, var de sidste to centimeter.

Et mål er derfor ikke en fane. Det er et sted at stå: fanen, og den sektion på
fanen, der skal være foldet ud, når man kommer. Skærmen ruller derhen.

Det gælder også manglerne under "værd at gøre først". De er hver især en knap
nu, og hver af dem ved, hvor den rettes.

---

## 7. Reglen, der gælder alle fremtidige funktioner

Fra specens §31 og §34, og den vigtigste sætning i hele dokumentet:

> En ny funktion må ikke automatisk få sin egen menu.

Find først det brugerflow, funktionen tilhører. Handler den om en tur, hører
den under turen. Handler den om et stykke grej, hører den under Grej. Kun
tværgående administration hører under Mere.

Og ved tvivl, i denne rækkefølge: Hvilken brugeropgave løser det? Hører den til
en eksisterende tur, et grej-item, en person eller et sted? Kan den vises
kontekstuelt frem for som en ny side? Kan brugeren forstå konsekvensen, før
handlingen udføres? Virker den offline? Kan den testes uden at starte hele
appen?


---

## 8. Hvad der står tilbage

Alle fem skridt er taget. Det, der ligger og venter, i den rækkefølge det
sandsynligvis er værd at tage:

**~~Pakkeprogression (specens §7 og §8).~~** ✅ Bygget som
`pakkede_item_uids` på turen — en liste med uid'er, ikke en tabel for sig.
Det følger mønsteret fra `loese_item_ids`, synkroniserer med turen som alt
andet og krævede hverken ny tabel eller ny konfliktstrategi. Fremdriften er
derived og gemmes ikke.

To tilstande og ikke specens fire: "blocked" og "optional" kan appen ikke
selv udfylde, og en tilstand man skal sætte i hånden for at få noget ud af,
er en tilstand de fleste aldrig sætter.

**Feltet skal oprettes i PocketBase** (`pakkede_item_uids`, JSON — se
POCKETBASE.md trin 4). Mangler det, kan man stadig krydse af, men
afkrydsningen bliver på den enhed man står med, og der kommer ingen fejl.

**~~§26 Integrationstest af turflowet.~~** ✅ De 849 unittests dækkede
regnestykkerne, ikke overgangene mellem dem. `turflow.test.ts` kører turen
fra tom kladde til gjort op gennem det rigtige datalag — opret, læg grej på,
pak, fordel mellem to deltagere, gå klar og afsted, skriv i logen, afslut,
gør op, og brug turen igen næste gang — og læser turen frisk fra Dexie efter
hvert skridt.

Og et hul, der var værre end de tests: `sync.test.ts` kræver nu, at hvert
felt på turen, grejet og grejsættet faktisk kommer med op. Det var sådan
`hero_billede` og `booking` kunne blive slettet ved sync i første omgang —
hver funktion for sig var rigtig, og PocketBase siger ikke fra. Testen er
ikke bundet til bestemte felter: den læser felterne på posten, så det næste
felt nogen glemmer i `tilPb`, falder med navns nævnelse.

**~~§7.2 Vægtoptimering med risiko, og et bytte der bytter.~~** ✅ Hvert
alternativ bærer nu en risiko — lav, mellem eller høj — regnet af det, appen
faktisk ved: hvor stor en del af den tunges tags alternativet dækker, og hvad
man selv har givet det i stjerner. Ikke af hvor meget der spares; en stor
gevinst gør ikke et gæt til andet end et gæt.

Rækkefølgen af alternativer er vendt om som følge af det: sikrest først og
derefter mest sparet. Det holdt kun så længe man tog stilling til hvert
forslag for sig, og nu findes der en "byt alle"-knap, der tager det øverste.

Og et bytte bytter. Knappen hed "Tilføj" og lagde kun det lette til — så stod
begge dele på pakkelisten, og vægten var gået op i stedet for ned. Nu ryger
den tunge også ud af det løse grej, ud af tasken og af hos den, der skulle
bære den. Kom den med via et grejsæt, kan den ikke tages af alene, og det
siger appen i stedet for at lade byttet se helt ud.

Specens `targetGrams` er ikke med: der findes ikke en målvægt i
datamodellen, og et felt der altid står tomt, er et løfte appen ikke holder.

**~~§13 Smart-forslag i én typet form.~~** ✅ Motoren havde tre slags forslag
med hver sin form, og de tre skærme, der viste dem, valgte tre forskellige ord
for det samme. `forslag.ts` samler dem: titel, forklaring, virkning, tiltro og
to handlinger.

Id'et er udledt af, hvad forslaget handler om, og ikke et tilfældigt uuid —
specen kræver, at samme input giver samme output, og en skærm skal kunne huske
en afvisning uden at forslaget skifter identitet mellem to renderinger.

Specens `water`, `food` og `gas` er ikke med som typer. `beregnForbrug` regner
dem ud, og tallene står på turens egen skærm; et forslag, der gentager et tal,
man kan se i forvejen, er ikke et forslag — og en type, som ingenting
producerer, er endnu et løfte, appen ikke holder.

Afvisningen lever i skærmen og ikke i basen. Hvad man ikke gider høre om lige
nu, er ikke data om turen, og et felt til det skulle synkroniseres og gemmes
for evigt for at slippe for et kort i tre dage.

**~~§6 Overblikket manglede halvdelen — og forslagene.~~** ✅ Specen vil have
pakkeprogression, totalvægt, deltagere og "Feltbogen foreslår" på turens
overblik. De tre tal lå hver på sin fane, og forslagene stod kun på
startskærmen — så åbnede man turen direkte, hvilket man gør hele tiden, sagde
motoren ingenting dér, hvor man arbejdede.

Tallene står som tre knapper og ikke som tre kort: kortene bliver på deres
egne faner, hvor der er plads, og hver knap fører hen til sin fane efter
reglen i §6 ovenfor. Forslagskortet er flyttet til `ui.tsx`, så turen og
startskærmen deler ét kort — to kort for den samme slags forslag ville være
præcis det, §13 skulle af med.

Historik-forslaget vises ikke på turen: "Ligesom sidst" er den samme idé med
en bedre flade, og ét forslag om det samme er nok.

**~~§8 Pakkelisten manglede søgning og to visninger.~~** ✅ Chipsene er nu
Alle · Grejsæt · Tag · Person · Fælles — den flade liste og fælles/personligt
manglede. Søgningen leder i navnet, i den der bærer det, og i afsnittets egen
overskrift: søger man på et grejsæt, mener man hele sættet. Den lægger sig
oven på opdelingen frem for at erstatte den, så man stadig kan se, hvilket sæt
en ting kom med i. En søgning uden træffere siger fra — ellers ligner det en
tom pakkeliste, og det er en påstand om turen frem for om søgningen.

**Ruter og højdemeter (specens §12).** Kilometer og højdemeter har ingen
datakilde. Det er et nyt datadomæne — GPX eller lignende — ikke en
statistikfunktion.

**Router (specens §20).** Venter stadig på et behov, der betaler for det:
deep links, browserens tilbage-knap, PWA-startpunkt og token-ruterne skal
tænkes igennem samlet.

**~~Det, en gennemgang af specen mod koden fandt til sidst.~~** ✅ Fem ting,
som ingen af os havde skrevet ned, og som alle er bygget nu:

- **§17 persondetaljen.** Turhistorik, typisk gear og typisk vægt er udledt af
  turene og gemmes ikke — personen ejer ingen af delene, det gør turene.
  Vægten er et snit over de ture, hvor grejet faktisk var fordelt til hende;
  ture uden fordeling tælles ikke med som nul, af samme grund som en
  ubesvaret vurdering ikke tælles som en dårlig. *Aktive invitationer* er
  ikke med: deling er et gæstelink på en tur, ikke en indbydelse til en
  person, og linket kan gives videre. At kalde det "Emils invitation" ville
  være en påstand om, hvem der har det.
- **§15 steddetaljen.** Stedets billede er forsiden fra det seneste besøg —
  et sted har ingen billeder af sig selv, men det ser ud som sidst man var
  der. Udledt og ikke gemt. Og "Opret tur her" opretter turen med sted, navn
  og koordinater udfyldt.
- **§2.5/§18 Mere.** Synkronisering, Skabeloner, Backup/eksport/import og
  Hjælp står nu som rækker. De lå som afsnit inde i Indstillinger, og §2
  siger direkte, at hovedfunktioner ikke må gemmes bag andre. Hver række
  lander i sit eget afsnit — samme regel som `turmaal.ts`, og den er skrevet
  ned i `indstillingsmaal.ts`. Fem skærme med ét afsnit hver ville ikke være
  en bedre struktur, kun den samme med flere sider imellem.
- **§3 "Dit grej".** Antal ting og hvor mange der skal passes. Vedligeholdet
  står også som handlingskort, men det er ikke det samme: dér er det de
  enkelte ting, her er det, hvordan skabet står.
- **§2.3/§16 Lån, Vedligehold og Indkøb.** Tre nye faner under Grej. De to
  første er ikke statusser men tværgående udsnit — de fandtes kun som felter
  på det enkelte item, så man kunne ikke svare på "hvad har jeg lånt ud?"
  uden at gå hele inventaret igennem. "Overvejer" hedder **Indkøb** på fanen,
  fordi det er dét, listen er.

**Onboarding og adaptiv hjælpegrad (specens §5 og §6).** Udskudt bevidst,
fordi vi bygger til ejeren først. Bliver relevant, hvis appen skal ud til
folk, der ikke selv har bygget den.

**~~§24 Tilgængelighed: fokus-state.~~** ✅ Felterne skiftede kant, når man
klikkede i dem, og det var alt — knapper havde ingen markering overhovedet.
Nu tegner `:focus-visible` en ring, som browseren selv afgør skal vises ved
tastatur og ikke ved mus.

**~~§25 Performance: lazy-load.~~** ✅ Statistik, årsopgørelse, feltbog,
indstillinger (med import/eksport) og rundvisningen hentes først, når de
åbnes. Bundtet gik fra 588 til 543 kB.

Resten af de 543 kB er React, Dexie og PocketBase, som appen ikke kan starte
uden. Det eneste, der kunne udskydes derudover, er `qrcode` — målt til 25 kB
(10 kB gzippet). Det er fravalgt: appen er offline-first og installeres som
PWA, så første hentning sker én gang, og bagefter ligger alt i cachen. En
indlæsningstilstand inde i en skærm, der virker, er ikke 1 % af bundtet værd.

**Virtualisering af lange gearlister** (også §25) er ikke gjort. Den er først
værd at bygge, når en liste er lang nok til at hakke — og det afhænger af et
rigtigt inventar.

**~~§15 Steder: rating.~~** ✅ Var en skævhed: vurderinger kom til grej og
ture, men ikke til steder.

Og én ting, der ikke står i specen: **de tærskler, forslagene bygger på**, er
sat efter mavefornemmelse og testdata. Hvornår vægten er værd at nævne, hvor
godt et grejsæt skal matche, hvor mange ture der skal til, før noget regnes
som ubrugt. De er nemme at justere — men kun når de har været brugt på
rigtige data.

---

## 9. Anden runde: fra fundament til færdig 2.0

*August 2026, efter at det første dokument var arbejdet igennem.*

Der er kommet en ny gap-analyse — `Feltbogen_2_0_AKTUEL_Mangler_og_Implementeringsplan.docx`.
Den findes i to udgaver, og forskellen mellem dem er selv en pointe: den
første beskrev gear-historik, steder og turfase som manglende, hvilket de ikke
er. Den anden er skrevet efter en gennemgang af den faktiske gren og rammer
rigtigt.

Dette afsnit er broen fra den til koden, på samme måde som §1–§8 var broen fra
den oprindelige spec.

### Det dokumentet får rigtigt

**Auditér før du bygger.** Dokumentets §14 er en eksplicit "byg ikke det her
om"-liste — turfase, tur-overblik, pakning, gear-historik, steder,
forslagsarkitekturen, sync og smart-motoren. Den liste er korrekt, og den er
den vigtigste side i dokumentet. Halvdelen af den første udgaves arbejdsliste
var allerede lavet.

**Flerdages ture er ikke en checkbox.** Det står der to gange, og det er sandt:
`flerdagstur = true` ville se færdigt ud og ikke kunne bære en daglig
destination, rute, overnatning eller journal.

**Kortdata er ude af scope.** Den første udgave havde offline-kortfliser
stående som en punkttegn ved siden af "rutelængde". Det er to helt forskellige
størrelser — appen fylder 558 kB i dag. Den nye udgave nævner dem ikke, og det
er rigtigt.

### De to steder, vi gør noget andet

**Dagene bliver et felt på turen, ikke syv tabeller.** Dokumentets §8.2
tegner TurDag, DagDestination, DagRute, DagOvernatning, DagVejr, DagForbrug og
DagNote som selvstændige entiteter. Det ville betyde syv PocketBase-samlinger
og syv konfliktstrategier i en app, der i dag har fem.

Sådan gør appen det ikke. `deltagere`, `budget_linjer`, `feltnoter`,
`pak_af_tjek` og `afgangs_tjek` ligger alle som JSON på turen — netop fordi de
ikke findes uden den, og fordi de så synkroniserer som én post: én kolonne, én
konflikt, ingen dubletter. Dagene hører til samme familie.

**Afgørelse:** ét felt, `dage: TurDag[]`, med et `day_uid` på hver dag —
dokumentets egen identitetsregel, uden syv tabeller. Bliver en dag senere
noget, man skal kunne dele eller slå op alene, kan den flyttes ud; det
omvendte er sværere.

Og tre af de syv findes allerede i en anden form. `feltnoter` er dagsopdelt i
forvejen (`efterDag` i `feltnoter.ts`), `vejrsnapshot` er allerede et frosset
snapshot, og DagForbrug er den vand/mad-registrering, specens §10 beskriver.
De skal genbruges, ikke bygges parallelt — dokumentet siger selv, at den samme
historik ikke må ligge to steder som to uafhængige sandheder.

**Hjem før første tur-flow.** Dokumentets §13 sætter det guidede tur-flow som
trin 2 og situationsbaseret Hjem som trin 3. Vi bytter om.

Hjem er næsten kun at lade `turfase` styre startskærmen, og hullet er konkret:
`naesteTur` filtrerer afsluttede ture fra, så når man kommer hjem fra en tur,
siger forsiden "Ingen ture planlagt", mens evalueringen ligger nede under
handlingerne. Dokumentets sjette situation — *afsluttet → gør turen op* —
findes ikke. Det er en dags arbejde mod flere for wizarden, og der er ingen
afhængighed den anden vej.

### Rækkefølgen

1. **~~Situationsbaseret Hjem.~~** ✅ `hjemsituation` i `dashboard.ts` afgør,
   hvad forsiden handler om: ingen tur, kladde, klar, snart afsted, på tur,
   eller hjemme uden at have gjort turen op. Én primær handling, og den lander
   dér, hvor den kan udføres — reglen fra §6.

   Hullet var det sidste af de seks: `naesteTur` filtrerer afsluttede ture fra,
   så når man kom hjem, sagde forsiden "Ingen ture planlagt", mens det eneste,
   der manglede, stod nede under handlingerne. Nu er den hjemkomne tur selv
   kortet, og teksten siger hvorfor det haster: hvad blev brugt, hvad lå urørt,
   hvad gik i stykker.

   Rækkefølgen er en prioritering og ikke en liste: en tur, man er midt i,
   slår alt — man planlægger ikke næste sommer fra en shelter. Derefter det,
   der kommer, og til sidst det, man har efterladt.

   Og kortet øverst ejer sin tur: handlingerne og situationen kigger på de
   samme data, så uden en regel sagde de begge det samme om den samme tur.
2. **~~Gear-historikkens tidslinje.~~** ✅ `brugPrItem` lagde sammen — "brugt
   5 af 8 gange" — og det siger ikke hvornår. En sovepose, der lå urørt på de
   tre seneste ture, er noget andet end en, der lå urørt tre gange for to år
   siden.

   `brugshistorik` læser pak-af-tjekket pr. tur i stedet for lagt sammen, og
   grejsiden viser turene som en tidslinje med udfaldet og turens egen note.
   Historikken gemmes ikke på itemet: turene ved, hvad der var med, og
   tjekket ved, hvad der blev brugt. En kopi ville være den samme sandhed to
   steder — og skulle rettes, hver gang en tur blev slettet eller gjort op på
   ny.

   Statussen læses direkte fra linjen og ikke gennem `statusFor`, som falder
   tilbage på "brugt", når linjen mangler. Det er rigtigt, mens man udfylder
   tjekket, men en påstand appen ikke kan holde, når den kigger tilbage — så
   en tur uden opgør siger "Ikke gjort op" i stedet for at gætte.
3. **Første tur-flow.** ✅ Fravalgt i §4 med begrundelsen "et guidet flow på
   seks trin er stadig en formular". Det var for hurtigt sagt: dokumentets
   udgave spørger ét ad gangen, kan afbrydes, gemmer en lokal draft og slutter
   med et *forslag* frem for en tom tur. Det er en anden ting, og den er bedre.

   `foersteTur.ts` holder kladden og reglerne; `FoersteTur.tsx` stiller de fem
   spørgsmål. Fire ting blev afgjort undervejs:

   Kladden ligger i `db.indstillinger` som JSON. Tabellen er enhedens egen og
   synkroniseres ikke — en halvfærdig tanke skal ikke dukke op hos resten af
   holdet, og den skal overleve, at man lukker appen. `laesKladde` tror ikke på
   noget: hvert felt tages kun med, hvis det har den rigtige form.

   Der er ingen wizard-model ved siden af `Tur`. `turFraKladde` laver en
   ganske almindelig tur med de samme standarder som `opretTomTur`, og fra det
   øjeblik den er oprettet, er det de almindelige skærme, der overtager.

   Vægtforslag vises ikke på sidste trin. De skal ende på turens bytteliste,
   og den findes ikke endnu — et forslag, der ikke kan handles på det sted, det
   står, er præcis dét, landingsreglen i §6 findes for.

   Flowet erstatter ikke "+ Ny tur". Det står som den primære knap på hjem, når
   der ingen ture er; den tomme tur står ved siden af for dem, der hellere selv
   skriver det ind.
4. **Gruppefordeling.** ✅ `fordeling.ts`: en ren funktion, der returnerer et
   forslag med før/efter pr. deltager og de enkelte flytninger, og en
   `anvendFordeling`, som skærmen kalder, hvis nogen siger ja. Motoren skriver
   ingenting — samme mønster som vægtbytterne.

   Kun det fælles grej flyttes. En sovepose er personlig, og et forslag om at
   give sin sovepose væk er ikke et forslag, det er en fejl. Det personlige
   tæller med i, hvad man bærer, men bliver hvor det er.

   Tildelingen er grådig, tungest først til den, der bærer mindst — og står to
   lige, beholder den, der bærer tingen i forvejen, sit grej. Uden den regel
   bytter motoren rundt på alting for ingenting.

   Der er to grunde til at sige noget: fælles grej, ingen har taget, eller en
   spredning der falder mindst `MINDSTE_GEVINST_G`. Ufordelt grej tæller ikke
   med i spredningen før — ingen bar det — så spredningen kan stige af at
   fordele det. Det er ikke en forværring, og forslaget påstår derfor heller
   ikke en besparelse i det tilfælde.

   Forslaget står to steder: øverst i "Fordel gear" på turen, hvor man kan
   sige ja lige dér, og som et kort på hjem med `Turmaal`-målet `'fordeling'`,
   der lander foldet ud samme sted. Se §6.
5. **Læringssløjfen og de sidste statistikker.** Nætter, besøgte steder,
   turtyper, gennemsnitsvægt, bedste og dårligste grej efter egne stjerner.
   Kun det, der kan forklares ud fra data, der findes.
6. **Rute som eget domæne, og så `dage: TurDag[]`.** Datamodel, migration og
   tests før noget UI, som dokumentets §8.4 siger. Rute først, fordi dagen
   skal kunne pege på en.

Adaptiv hjælp og Smart Motor 1.0 til sidst — dokumentet siger det selv, og det
har ikke ændret sig siden første runde.

### Stadig fravalgt

Router, engelske mappenavne og AI/naturligt sprog står som de gjorde i §4.
Kvitteringsfil er den ene nye: den kræver et fil-felt i PocketBase, og
dokumentet er selv i tvivl om, hvorvidt den hører til 2.0.

## 10. Deltageroplevelsen — hvad jeg fulgte og hvad jeg ikke gjorde

Dokumentet *Deltageroplevelse & fælles tur* beder om, at en delt tur føles som
den samme tur for ejer og deltager, bare med forskellige rettigheder. Det er
rigtigt, og gæstesiden var en lang strøm. Det er nu ejerens faner.

Fire steder gjorde jeg noget andet end dokumentet, og her er hvorfor.

**Ikke seks faner, men fire.** Dokumentet vil have Overblik, Pakning,
Pakkeliste, Deltagere, Kort og Journal. *Pakning* måles på
`pakkede_item_uids`, som ikke er i snapshottet, og *Kort* forudsætter en rute,
der ikke findes endnu (den er §9 trin 6). En fane, der altid stod tom, er et
løfte, appen ikke holder. De to kommer, når der er noget at vise.

**Ikke `GuestContribution` som ny samling.** `turdeltagelse` findes allerede og
løser præcis den opgave: én række pr. deltager pr. tur, hvor PocketBase-reglen
er grænsen, og hvor man kun kan røre sin egen. Journalbidrag er lagt som et
felt på den række. Det giver den samme sikkerhedsmodel uden en samling mere,
og det er ét felt at oprette i stedet for en samling med fire regler.

**Ikke den samme `TurDetalje`-komponent.** Dokumentet foreslår én komponent med
rollebaseret adfærd. `TurDetalje` læser `db.items`, `db.grupper` og hele
inventaret og skriver gennem `opdaterTur`; en gæst har et frosset snapshot og
skal aldrig kunne nå inventaret — det er dokumentets eget §7. Delt er derfor
*fanerækken* (`Fanerakke` i `ui.tsx`) og det visuelle sprog, ikke skærmen.
Samme mentale model, uden at gæstekoden får en vej ind i ejerens data.

**Billeder fra deltagere** kom med i anden omgang. De hører til journalen, som
dokumentets §6 siger, og ikke i en menu for sig: så får de kontekst — hvem,
hvornår, hvilken dag — uden at nogen skal skrive den.

Filerne ligger på deltagelsesrækken, samme sted som teksten, så de deler
sikkerhedsgrænse. Filnavnene bestemmer PocketBase selv, og indgangen skal pege
på dem; derfor skrives en indgang med billeder i to trin — filerne først,
navnene læst af svaret, indgangen bagefter. Går første trin galt, skrives
teksten alligevel: en note, man har skrevet i felten, skal ikke gå tabt, fordi
et billede ikke ville op.

**Gæsten fik ejerens pakkeliste.** Afkrydsning, fremdrift og "markér alle" som
på turskærmen. Afkrydsningen ligger lokalt på telefonen og ikke på turen: "har
jeg lagt den i tasken" er ens eget spørgsmål om ens egen taske, og de andre har
ikke brug for at vide, hvor langt man er. Det er også derfor, den ikke koster
et felt i PocketBase.

Og to ting jeg ikke kan gøre herfra: `turdeltagelse` skal have et
**`journal`**-felt (json) og et **`billeder`**-felt (file, multiple), ellers
forsvinder deltagernes bidrag lydløst på vej op. Se POCKETBASE.md. Appen siger
selv til om det manglende billedfelt; det manglende journalfelt kan den ikke se
forskel på fra "der var ingen indgange".
