# STATUS

*Sidst opdateret: 9. september 2026. Udgangspunkt: `main` @ `284315d`.*

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

Serveren er sat helt op, og der er ingen kendt blokering. De to risici, der
kunne koste data, er begge lukket: sletninger slår igennem på tværs af enheder
(gravsten), og et login med en anden konto stopper frem for at blande. Det, der
står tilbage, er arbejde vi selv vælger — ikke noget, der spærrer.

---

## Grønt lys

Kørt på grenen `claude/flerdagesture-deling` den 9. september 2026:

| Kommando | Resultat |
|---|---|
| `npm run lint` | Bestået, ingen fejl |
| `npm test` | 57 testfiler, 1.264 tests, alle grønne |
| `npm run build` | Bestået. Startchunk 463,30 kB / 146,34 kB gzip |

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

### Funktioner, der venter

9. **Læringssløjfen og de sidste statistikker** — nætter, besøgte steder,
   turtyper, gennemsnitsvægt, bedste og dårligste grej efter egne stjerner.
   Kun det, der kan forklares ud fra data, der findes. (`PLAN.md` §9 trin 5)
10. **Flerdagesture er bygget** — fundament, skærm og deling. Dagene kan
    planlægges under turens Overblik og følger med ud til deltagerne i
    snapshottet. Det, der står tilbage, er en dag med sit eget grej (fravalgt)
    og en rute at pege på (punktet nedenfor).
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
