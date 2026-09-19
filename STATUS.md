# STATUS

*Sidst opdateret: 19. september 2026. Udgangspunkt: `main` @ `bc40465`.*

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
er låst og ligger nu i repoet sammen med en tegning af hver eneste skærm. Én
af tyve er bygget.

---

## Grønt lys

Kørt på grenen `claude/opret-ark` den 19. september 2026:

| Kommando | Resultat |
|---|---|
| `npm run lint` | Bestået, ingen fejl |
| `npm test` | 63 testfiler, 1.382 tests, alle grønne |
| `npm run build` | Bestået |

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

**Der ligger tyve handoffs i kø.** Hjem på PC er den eneste, der er bygget,
og den var udtrykkeligt tænkt som en prøve på formatet. Resten — Ture,
Tur-detalje, Pakning, Grej, Grejsæt, Folk, Mere, Steder & Statistik,
Indstillinger og de to opret-ark, plus otte mobilskærme — er ikke rørt.
Rækkefølgen er ikke besluttet.

Tre regler fra `TOKENS.md` gælder bredere end den enkelte skærm og er ikke
efterprøvet på det, der allerede står:

- Maks **én** fyldt accent-knap pr. skærmbillede.
- ~~Et opret-ark må ikke oprette noget, før man trykker Opret.~~ **Indfriet.**
  Ture og grej oprettes nu gennem et ark (`src/Ark.tsx`). Grejsæt og steder
  opretter stadig med det samme — de har ikke fået et ark tegnet, og
  oprydningen i `lukDetalje` dækker dem indtil da.
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
10. **De atten resterende skærme er ikke holdt op mod designet.** Hjem og
    Ture på PC er gennemgået mod deres HTML-reference. De øvrige kan afvige
    fra de låste tokens og fra reglen om én fyldt knap, uden at nogen har set
    efter. Det er ikke en fejl, der er meldt — det er en gennemgang, der ikke
    er foretaget.

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

**Én åben pull request** (merges lige nu sammen med #65 og #67):

| PR | Gren | Hvad den gør |
|---|---|---|
| [#66](https://github.com/K-ingo/Feltbogen/pull/66) | `claude/opret-ark` | Opret-ark for tur og grej — lukker create-before-confirm |

#62, #64, #65 og #67 er merget.

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

16 fjerngrene er ikke merged ind i `main` (plus denne). De øvrige
er formodentlig forældede rester fra tidligere sessioner, men ingen
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
