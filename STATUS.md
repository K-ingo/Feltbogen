# STATUS

*Sidst opdateret: 8. september 2026. Udgangspunkt: `main` @ `c3c214f`.*

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

Serveren er sat helt op, og der er ingen kendt blokering. Det, der står
tilbage, er arbejde vi selv vælger — ikke noget, der spærrer.

---

## Grønt lys

Kørt på grenen `claude/kontoadskillelse` den 8. september 2026:

| Kommando | Resultat |
|---|---|
| `npm run lint` | Bestået, ingen fejl |
| `npm test` | 52 testfiler, 1.158 tests, alle grønne |
| `npm run build` | Bestået. Startchunk 459,79 kB / 145,49 kB gzip |

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

`./scripts/tjek-pocketbase.sh <appens adresse>` er værd at køre efter en
opsætningsændring: den kalder som en helt uindlogget fremmed og siger fra, hvis
en samling er åben for alle. Den skriver ingenting.

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

4. **UI har ingen direkte testdækning.** Datalag og domænelogik er stærkt
   dækket; komponentadfærd er kun dækket indirekte. En UI-regression kan
   slippe forbi CI. En lille browserbaseret suite for navigation, billeder og
   offline-flows ville lukke hullet. (`CODE_REVIEW.md` §6)
5. **Tilgængelighedspas på dialoger.** Modaler, delings-/QR-flow og
   fejltilstande er ikke gennemgået for fokusfælde, retur-fokus, Escape og
   labels. (`UI_REVIEW.md` P1)
6. **Fysisk feltprøve.** Lys/mørk tilstand udendørs, stor systemtekst, 200 %
   zoom, én hånd, handsker. Alt er hidtil afprøvet i en desktopbrowser med
   ændret viewport. (`UI_REVIEW.md` P1)
7. **Eksterne fetch-kald mangler fælles timeout.** En langsom vejr- eller
   adresseudbyder kan holde en UI-handling åben længe. (`CODE_REVIEW.md` §5)

### Funktioner, der venter

8. **Læringssløjfen og de sidste statistikker** — nætter, besøgte steder,
   turtyper, gennemsnitsvægt, bedste og dårligste grej efter egne stjerner.
   Kun det, der kan forklares ud fra data, der findes. (`PLAN.md` §9 trin 5)
9. **Rute som eget domæne, derefter `dage: TurDag[]`.** Datamodel, migration
    og tests før noget UI. Rute først, fordi dagen skal kunne pege på en.
    Åbner for kilometer, højdemeter og kortfanen på delte ture.
    (`PLAN.md` §9 trin 6)
10. **Badges og notifikationer.** I fundamentet §9, ikke bygget.
11. **Tidevand ved kystture.** Kræver en DMI-nøgle. (`IDEER.md` §5.4)
12. **Onboarding og adaptiv hjælpegrad.** Bevidst udskudt — vi bygger til
    ejeren først. Bliver relevant, hvis appen skal ud til andre.
13. **Virtualisering af lange gearlister.** Først værd at bygge, når en liste
    er lang nok til at hakke. Afhænger af et rigtigt inventar.

### Kalibrering

14. **Motorens tærskler er sat efter mavefornemmelse.** Hvornår vægten er
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

**Ingen åbne pull requests.**

15 fjerngrene er ikke merged ind i `main`. De fleste er formodentlig
forældede rester fra tidligere sessioner, men ingen har gennemgået dem.
Den største er `claude/code-review-g3oqnn` med 55 commits. Oprydningen er
ikke foretaget, og ingen gren er slettet — det kræver ejerens accept.

---

## Sådan holdes filen ved lige

Opdatér den, når noget bliver færdigt, blokeret eller besluttet — ikke ved
hver commit. Datoen og commit-hashen øverst skal følge med, ellers ved næste
læser ikke, hvor gammelt billedet er.
