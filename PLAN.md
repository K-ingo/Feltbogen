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

## 6. Reglen, der gælder alle fremtidige funktioner

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

## 7. Hvad der står tilbage

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

**Ruter og højdemeter (specens §12).** Kilometer og højdemeter har ingen
datakilde. Det er et nyt datadomæne — GPX eller lignende — ikke en
statistikfunktion.

**Router (specens §20).** Venter stadig på et behov, der betaler for det:
deep links, browserens tilbage-knap, PWA-startpunkt og token-ruterne skal
tænkes igennem samlet.

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
