# AGENTS.md — arbejdsregler for Feltbogen

Denne fil er kontrakten for enhver agent eller udvikler, der arbejder i dette
repository. Den står øverst, fordi den gælder alt herunder. Produktets indhold
står andre steder — se **Hvor tingene står** nederst.

## Hvad Feltbogen er

En dansk frilufts-PWA til grejstyring, ture, pakkelister, deltagere, grupper,
budget, steder og intelligente forslag. Offline-first: alt skrives til
IndexedDB først og synkroniseres derefter til PocketBase.

Appen skal være **enkel, intuitiv og overskuelig** — også for en bruger med
meget grej og mange ture. Det er ikke en pynteambition, det er et krav til
enhver ny funktion: bliver en skærm sværere at overskue, er funktionen ikke
færdig.

**Smart Motoren** (`src/smartMotor.ts`, `src/forslag.ts` og deres
nabomoduler) er appens intelligenslag. Den rådgiver, den bestemmer ikke:
motoren skriver aldrig selv i data, den foreslår, og brugeren siger ja.
Fremtidig AI lægges **ovenpå** dette fundament, ikke i stedet for det.

## Faste arbejdsregler

### Branch og aflevering

- Arbejd altid på en separat branch. **Skriv aldrig direkte til `main`.**
- Opret en pull request med en forståelig beskrivelse af ændringer, tests og
  eventuelle risici.
- **Merge aldrig en pull request til `main` uden ejerens udtrykkelige
  tilladelse.**

### Før du ændrer noget

- Undersøg eksisterende kode og dokumentation, før du foreslår eller
  implementerer ændringer. Det meste er allerede besluttet én gang, og
  begrundelsen står som regel i `PLAN.md` eller `feltbogen_fundament`.
- Bevar eksisterende funktionalitet og brugerdata. En migration, der taber
  data, er en fejl — også når den er hurtigere.

### Før du afleverer

Kør alle fire, og skriv i pull requesten, hvad de sagde:

```bash
npm run lint     # eslint
npm test         # vitest, én kørsel
npm run build    # tsc -b + vite build (typecheck sker her)
npm run preview  # den eneste måde at teste offline/PWA på
```

CI kører lint, test og build på alle pull requests (`.github/workflows/ci.yml`,
Node 22) og fejler desuden, hvis et privat Railway-domæne er havnet i bundlen.

Implementér, test **og** dokumentér. En ændring uden test eller uden en note i
dokumentationen er ikke færdig.

### Spørg først om

Disse er svært reversible eller ejerens valg, ikke agentens:

- Større visuelle produktvalg (nyt designsprog, ny navigationsstruktur,
  visuel identitet og ikoner).
- Ændringer af datamodellen (`src/db.ts`, nye felter eller samlinger i
  PocketBase, migrationer).
- Ændringer af arkitekturen (router, nye datadomæner, ny sync-strategi,
  udskiftning af Dexie/PocketBase).
- Sikkerhedsændringer: API-regler i PocketBase, delings- og gæstegrænser,
  auth.
- Betalinger.
- Sletning af data — lokalt eller på serveren.
- Alt andet, der er svært at fortryde.

**Mindre tekniske beslutninger må du selv træffe**, når de følger projektets
eksisterende mønstre.

### Hemmeligheder og persondata

Skriv aldrig hemmeligheder, loginoplysninger, tokens eller persondata i kode,
commits, dokumentation, issues eller pull requests. Skærmbilleder med rigtige
personer, steder eller billeder hører ikke i dette offentlige repository —
brug syntetiske testdata.

`.env` er lokal og må ikke committes. `.env.example` beskriver variablerne
uden værdier.

### Kommunikation

- Kommunikér på **dansk**, og forklar tekniske valg i et sprog, ejeren kan
  følge — også uden at være udvikler.
- Vær ærlig om usikkerhed, fejl og manglende testdækning. Skriv hellere "det
  er ikke testet" end at lade det stå uklart.
- Hold dokumentation og status opdateret, så arbejdet kan fortsættes i en
  senere chat af en anden agent uden kontekst.

## Kodens egne konventioner

Disse er ikke smagssager — de er allerede gennemført i hele kodebasen, og en
afvigelse gør koden inkonsistent:

- **Dansk i navngivning.** Filer, funktioner, typer og felter hedder noget på
  dansk (`turfase.ts`, `beregnForbrug`, `pakkede_item_uids`). Værdier gemmes
  uden æ/ø/å (`haengekoeje`, `oevet`), fordi de er nøgler; visningsteksten
  oversættes med `etiket()` i `src/db.ts`.
- **Domænelogik i rene `.ts`-moduler, skærme i `.tsx`.** Regnestykker og
  regler skal kunne testes uden browser. Det er derfor testdækningen er så
  høj, som den er.
- **Udled frem for at gemme.** Fremdrift, historik og faser regnes ud af de
  data, der allerede findes. En kopi er den samme sandhed to steder og skal
  vedligeholdes to steder.
- **Design tokens frem for tal.** Afstande, runding og skriftstørrelser tages
  fra CSS-variablerne i `src/index.css` (`--plads-*`, `--runding*`,
  `--skrift-*`). `--roerehoejde` er mindstemålet på noget, der skal kunne
  rammes — appen bruges udendørs, nogle gange med handske på.
- **En ny funktion får ikke sin egen fane.** Hører den til en tur, ligger den
  under turen; hører den til grej, under Grej. Kun det tværgående hører under
  Mere. Skallen kender selv sammenhængen (`HOERER_TIL` i `src/Skal.tsx`).
- **Et forslag skal lande dér, hvor det kan udføres.** `src/turmaal.ts` og
  `src/indstillingsmaal.ts` holder reglen om, hvilken fane *og* hvilket
  afsnit man havner i, når man trykker på noget, appen selv har bragt på bane.
- **Advarsler blokerer aldrig.** Man skal kunne tage afsted på en tur, appen
  synes er halvfærdig — den skal bare have sagt det først.
- **Nye PocketBase-felter er ikke gratis.** Et felt, der mangler på serveren,
  gør at data forsvinder lydløst på vej op. Tilføjes et felt, skal
  `POCKETBASE.md` opdateres i samme ombæring, og `src/sync.ts` (`tilPb`) skal
  have det med — `sync.test.ts` falder, hvis et felt bliver glemt.

## Tests

`npm test` kører uden browser og uden server: Dexie får et IndexedDB af
`fake-indexeddb`, og `src/test/pbMock.ts` erstatter PocketBase med en
hukommelsesbaseret udgave, der kan sættes `offline`.

Ny domænelogik skal have tests. Ændrer du noget i sync, datamodellen eller
turflowet, så kør `sync.test.ts`, `migration.test.ts` og `turflow.test.ts`
bevidst igennem — de er der for at fange præcis de fejl.

Komponentadfærd er kun dækket indirekte. Er du i tvivl om en UI-ændring, så
skriv det i pull requesten frem for at lade det stå uprøvet.

## Hvor tingene står

| Fil | Hvad der står i den |
|---|---|
| [`README.md`](./README.md) | Kom i gang, arkitektur modul for modul, PWA, udrulning og status |
| [`STATUS.md`](./STATUS.md) | Hvor projektet står nu: hvad der virker, hvad der blokerer, og hvad der er åbent. **Start her** |
| [`feltbogen_fundament`](./feltbogen_fundament) | Den fulde specifikation: datamodel, skærme, kerne-koncepter og beslutningerne bag |
| [`PLAN.md`](./PLAN.md) | Broen fra 2.0-specifikationen til koden: hvad der findes, hvad der mangler, og i hvilken rækkefølge |
| [`POCKETBASE.md`](./POCKETBASE.md) | Samlinger, felter og API-regler, trin for trin. Skal følges præcist |
| [`IDEER.md`](./IDEER.md) | Ideer til det videre arbejde, nummereret så de kan refereres |
| [`CODE_REVIEW.md`](./CODE_REVIEW.md) | Seneste kodegennemgang, rettelserne og de kendte risici |
| [`UI_REVIEW.md`](./UI_REVIEW.md) | Seneste visuelle review, designprincipper og anbefalinger |

Læs `PLAN.md` §8 og §9 før du foreslår ny funktionalitet — mange oplagte
ideer er allerede bygget eller bevidst fravalgt, og begrundelsen står der.
