# Kode-review af Feltbogen

Gennemført 4. september 2026 på `main` ved commit
`c89252a33bee2eabf2ef7dd054c64d3495e32219`. Reviewet omfatter projektets
produktionskode, tests, byggeopsætning, PWA-konfiguration og dokumentation.

## Overblik

Feltbogen er en React 18/TypeScript-PWA med Dexie/IndexedDB som lokal primær
database og PocketBase som synkroniserings- og delingsbackend. Koden er opdelt
efter domæner (inventar, grupper, ture, steder, personer, billeder og deling),
mens `sync.ts` samler den generiske tovejssynkronisering. Arkitekturen passer
godt til offline-first-brug: skrivninger rammer først den lokale database, og
netværksfejl kan derfor forsøges igen senere.

Baseline på `main` var ren: 49 testfiler med 1.106 beståede tests, lint uden
fejl og et bestået produktionsbuild. Det oprindelige startbundle var 595,66 kB
(185,30 kB gzip) og udløste Vites advarsel om chunks over 500 kB.

## Implementerede rettelser

### 1. Overlappende sync kunne sende en ældre udgave sidst — høj alvor

To sync-kørsler for samme post kunne være i luften samtidig. Hvis den første
request var langsomst, kunne dens gamle svar overskrive den nyere udgave på
serveren. Samtidig brugte koden sync-køens tilstand til at afgøre, om posten
var redigeret under requesten; en anden kørsel kunne allerede have tømt køen.

`src/sync.ts` serialiserer nu requests pr. post, men lader forskellige poster
synkronisere parallelt. Svarets gyldighed afgøres desuden ud fra postens lokale
revisionsdato, og lokale revisionsdatoer gøres monotone, også når flere
redigeringer sker i samme millisekund. En regressionstest holder den første
request tilbage, foretager en ny redigering og bekræfter, at den nyeste værdi
ender både lokalt og i PocketBase.

**Hvorfor bedre:** Last-write-wins-reglen følger nu den faktiske rækkefølge af
lokale ændringer og ikke tilfældig netværkstiming.

### 2. Billedvisningen kunne vise det forrige billede — middel alvor

`Billedvisning` bevarede sin gamle `kilde`, hvis komponenten skiftede til en
billedpost uden hverken lokal blob eller server-URL. Det kunne få det forrige
billede til at ligne det nye.

Effekten nulstiller nu kilden ved hvert billedskift, før en ny blob eller URL
indlæses.

**Hvorfor bedre:** UI'et viser ikke længere forældet indhold, mens et billede
mangler eller indlæses.

### 3. Ugyldige kopiversioner blev accepteret — middel alvor

Importen af sikkerhedskopier afviste kun ikke-numeriske og for nye versioner.
Version `0`, negative tal og decimaler blev accepteret som kendte formater.

`laesSikkerhedskopi` kræver nu et positivt heltal og har tests for `0`, `-1`
og `1.5`.

**Hvorfor bedre:** Ukendte filformater bliver afvist tidligt med en tydelig
fejl i stedet for at blive fortolket som gyldige data.

### 4. Ugyldige datoer og antal kunne give skjulte eller ikke-endelige tal

En ikke-tom, ugyldig startdato skrev til array-egenskaben `NaN` i
månedsstatistikken. Importerede `NaN`-værdier for antal personer eller nætter
kunne desuden brede `NaN` videre til vand-, mad- og gasberegningerne.

Statistikken ignorerer nu ugyldige datoer. Forbrugsberegningen normaliserer
nætter og personer til endelige, afrundede værdier med sikre minimummer. Begge
edge cases er dækket af tests.

**Hvorfor bedre:** Beskadigede eller ældre importerede data kan ikke forgifte
diagrammer og beregningsresultater.

## Implementerede optimeringer

- Detalje-, gæste- og kortskærme indlæses nu dynamisk. Startbundtet faldt fra
  595,66 kB til 443,23 kB (ca. 26 %) og fra 185,30 kB til 140,81 kB gzip (ca.
  24 %). Den største detaljeskærm hentes først, når brugeren åbner den.
- Gentagne `Array.find`-opslag i brugsstatistik, gruppesamling og
  personprofiler er erstattet af `Map`-opslag. Det reducerer gentaget lineært
  arbejde, når inventar, ture og grupper vokser.
- README og indstillingsskærmen siger nu udtrykkeligt, at JSON-kopien omfatter
  gear, grupper, ture, steder og personer, men ikke selve billedfilerne. Det
  fjerner en risikabel forventning om, at en tekstbaseret kopi indeholder alt.

## Kendte risici og anbefalet videre arbejde

Disse punkter er ikke rettet automatisk, fordi de kræver produktbeslutninger
eller ændringer i datamodellen:

1. **Billeder indgår ikke i JSON-sikkerhedskopien.** En komplet eksport kræver
   et nyt, sandsynligvis komprimeret arkivformat med binære filer, fremdrift og
   pladsfejlshåndtering.
2. ~~**Sletninger fra en anden enhed har ingen sikker tombstone-protokol.**~~
   ✅ Løst. Serveren har nu en samling `slettede` med gravsten — `uid` og
   `samling` for hver post, der er slettet med vilje. Kun en gravsten kan
   udløse en lokal sletning; et fravær kan ikke, uanset hvor meget det ligner.
   Findes samlingen ikke, opfører appen sig som før. Se `POCKETBASE.md` trin 7.
3. ~~**Den lokale database er ikke opdelt pr. PocketBase-konto.**~~ ✅ Delvist
   løst. Basen bærer nu et ejermærke, og et login med en anden konto stopper
   synkroniseringen og spørger frem for at blande — se `src/konto.ts`. Det, der
   står tilbage, er en base *pr. konto*, så to personer kan bruge samme browser
   hver for sig. Det kræver en Dexie-base pr. konto eller en ejer-kolonne på
   hver tabel, og ingen har haft brug for det endnu.
4. **Konflikter bruger last-write-wins.** Det er enkelt og deterministisk, men
   samtidige offline-redigeringer af forskellige felter flettes ikke. Hvis
   kollaborativ redigering bliver et krav, bør revisioner eller feltvis
   konfliktløsning designes centralt.
5. **Eksterne fetch-kald mangler fælles timeout/annullering.** En langsom
   vejr- eller adresseudbyder kan derfor holde en UI-handling åben længe.
6. **Komponentadfærd testes primært indirekte.** Datalag og domænelogik har
   stærk dækning, men en lille browserbaseret suite for navigation, billeder
   og offline-flows vil fange UI-regressioner, som Node-testene ikke kan se.

## Verifikation efter ændringer

- `npm test`: 49 testfiler, 1.112 tests bestået
- `npm run lint`: bestået uden fejl
- `npm run build`: TypeScript og Vite-build bestået
- Største startchunk: 443,23 kB / 140,81 kB gzip; ingen 500 kB-advarsel

Afhængighedsaudit kunne ikke gennemføres i reviewmiljøet, fordi npm-registry
ikke var tilgængeligt. CI bør fortsat køre en låsefilbaseret audit i et miljø
med registry-adgang.
