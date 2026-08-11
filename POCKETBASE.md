# PocketBase-opsætning

Feltbogen er offline-first: alt virker uden en server. PocketBase bruges kun
til at synkronisere mellem enheder og til at dele ture.

Men **PocketBase dropper lydløst felter der ikke findes i samlingens skema**.
Der kommer ingen fejl — dataene forsvinder bare på vej op, og appen opfører sig
som om alt er i orden. Derfor skal skemaet passe præcist.

---

## Tre ting at vide først

**1. Feltnavnene er ikke til at vælge frit.** `src/sync.ts` sender og læser dem
ved navn. `vaegt_g` kan ikke hedde `vaegt` eller `weight`.

**2. Opret felterne før reglerne.** PocketBase validerer en regel mod de felter
samlingen har. Skriver du en regel om `user` inden feltet findes, får du
`Invalid rule. Raw error: invalid left operand "user" - unknown field "user"`,
og Create-knappen er død. Udfyld **Fields**-fanen først, så **API rules**.

**3. En tom regel betyder "alle må", ikke "ingen må."** Det er den farligste
faldgrube, fordi den fejler tavst.

| Regelfeltets tilstand | Hvem der må |
|---|---|
| Lukket hængelås | Kun superusers — appen kan ikke bruge samlingen |
| Åben hængelås, tomt felt | **Alle på internettet** |
| Åben hængelås, med en regel | Dem reglen passer på |

---

## Trin 1 — Opret samlingen `steder`

**New collection** → Name: `steder` → Type: **Base**.

### Fields

Tilføj i denne rækkefølge. `id`, `created` og `updated` laver PocketBase selv.

| Navn | Type | Indstillinger |
|---|---|---|
| `user` | Relation | Collection: `users` · Max select: **1** · Cascade delete: **til** |
| `uid` | Plain text | — |
| `navn` | Plain text | — |
| `koordinater` | JSON | — |
| `adresse` | Plain text | — |
| `tags` | JSON | — |
| `noter` | Plain text | — |

Lad alle felter være **ikke-påkrævede**. Appen gemmer tomme strenge og `null`
undervejs, og et påkrævet felt ville afvise en post man er midt i at skrive.

### API rules

Alle fem — List/Search, View, Create, Update, Delete — sættes til det samme:

```
user = @request.auth.id
```

Tryk **Create**.

---

## Trin 2 — Opret samlingen `personer`

**New collection** → Name: `personer` → Type: **Base**.

### Fields

| Navn | Type | Indstillinger |
|---|---|---|
| `user` | Relation | Collection: `users` · Max select: **1** · Cascade delete: **til** |
| `uid` | Plain text | — |
| `navn` | Plain text | — |
| `email` | Plain text | **Ikke** PocketBases Email-type |
| `standard_overnatning` | Plain text | — |
| `noter` | Plain text | — |

`email` skal være Plain text: feltet må gerne stå tomt, og appen validerer
ikke på det.

### API rules

De samme fem:

```
user = @request.auth.id
```

Tryk **Create**.

---

## Trin 3 — Tilføj to felter til `items`

Åbn den eksisterende `items`-samling → **Fields** → tilføj:

| Navn | Type |
|---|---|
| `udlaan` | JSON |
| `laant_af` | JSON |

Reglerne på `items` skal ikke røres — de skal være `user = @request.auth.id`
på alle fem, som de formentlig allerede er.

---

## Trin 4 — Tilføj syv felter til `ture`

Åbn `ture` → **Fields** → tilføj:

| Navn | Type |
|---|---|
| `sted_uid` | Plain text |
| `pak_af_tjek` | JSON |
| `afgangs_tjek` | JSON |
| `turkort_token` | Plain text |
| `turkort_retur` | Plain text |
| `turkort_besked` | Plain text |
| `turkort_snapshot` | Plain text |

> `turkort_snapshot` skal være **Plain text**, selvom indholdet er JSON. Se
> faldgruberne nederst.

---

## Trin 5 — Ret læsereglen på `ture`

Stadig i `ture` → **API rules**.

**List/Search** og **View** skal lukke to slags fremmede ind: en gæst med et
delelink, og en pårørende med et turkort.

```
user = @request.auth.id ||
(dele_token != "" && dele_token = @request.query.token) ||
(turkort_token != "" && turkort_token = @request.query.token)
```

Første linje har du sandsynligvis allerede sammen med `dele_token`-leddet;
`turkort_token`-leddet er det nye.

**Create, Update og Delete** forbliver:

```
user = @request.auth.id
```

> `!= ""` er ikke pynt. Uden det ville et kald helt uden token matche alle ture
> der ikke er delt.

> **Det er her sikkerheden ligger.** Filtrene i `gaest.ts` og `turkort.ts` er en
> bekvemmelighed — en gæst kan sende hvad som helst. Det der faktisk beskytter
> turene, er den her regel.
>
> Bemærk samtidig at reglen giver adgang til **hele** posten. Det er derfor både
> gæsten og den pårørende læser et frosset øjebliksbillede i ét felt og ikke
> turen selv: alt hvad de ikke skal se, må ikke ligge i det de kan hente.

---

## Trin 6 — Tjek at det virker

### Tag en kopi først

To steder, og det tager et minut:

- **PocketBase → Settings → Backups → New backup.**
- **Appen → Indstillinger → Data → Gem en kopi.** Den henter en JSON-fil med
  alt hvad der ligger på enheden.

Alt herunder er skrivebeskyttet eller til at fortryde, men en kopi koster
ingenting og gør resten roligere at gå til.

### Er nogen af samlingerne åbne for fremmede?

```bash
./scripts/tjek-pocketbase.sh https://din-server.dk
```

Prøven kalder som en uindlogget fremmed og skriver ikke noget.

> **En regel i PocketBase er et filter, ikke en dør.** En uindlogget kalder
> matcher ingen rækker, så det rigtige svar er `200` med en **tom liste** — ikke
> 403. Det er det tomme resultat der er beviset.
>
> | Svar | Betyder |
> |---|---|
> | 200, tom liste | Reglen gør sit arbejde |
> | 200, med rækker | **Regelfeltet står tomt — alle kan læse samlingen** |
> | 403 | Låst til superusers; appen kan heller ikke bruge den |

Prøven dækker kun læsning. Create, Update og Delete skal ses efter i hånden —
de skal alle stå som `user = @request.auth.id`.

### Virker appen stadig?

1. Sæt `VITE_PB_URL` til serverens adresse — se `.env.example`.
2. Log ind.
3. **Indstillinger → Synkronisering → Synkronisér nu.** Der skal stå "Alt er
   synkroniseret". Står der et antal ændringer der ikke kunne sendes, står
   fejlen i browserens konsol.
4. Samme sted vises advarslen om et manglende `uid`-felt, hvis den er udløst.
5. Tjek at gear, grupper og ture stadig står der, og at tallene i
   **Indstillinger → Data** passer med hvad du havde.

### Går de nye felter faktisk op?

Det er den ene ting der fejler tavst, så den er værd at se efter med egne øjne:

1. Ret noget der bruger et nyt felt — lån et stykke gear ud, lav et
   pak-af-tjek, gem et sted.
2. Synkronisér.
3. Find posten i PocketBase-admin og se at feltet har indhold. Står det tomt,
   findes feltet ikke i skemaet, eller det hedder noget andet.

### Virker delingen stadig?

Læsereglen på `ture` er den eneste eksisterende regel der blev rørt, så den er
den mest sandsynlige at have knækket:

1. Åbn en tur → **Del med gæster** → lav et link.
2. Åbn linket i et privat vindue. Turen skal kunne ses.
3. Ret ét tegn i tokenet i adresselinjen. Der skal stå at turen ikke findes.

Og det nye i samme regel:

4. Sæt et hjemkomsttidspunkt på en tur → **Turkort til pårørende** → lav kortet.
5. Åbn linket i et privat vindue. Der skal stå navn, sted og hjemkomst — og
   intet andet fra turen.

Har du kørt appen før felterne fandtes, ligger dataene stadig på enheden. De går
op af sig selv ved næste synkronisering.

---

## Faldgruber

**Datoer skal være Plain text.** `startdato` og `slutdato` gemmes som
`"2026-08-02"` og læses som tekst. Et Date-felt sender et tidsstempel tilbage,
og så holder datoerne op med at passe.

**Snapshot-felterne skal også være Plain text**, selvom indholdet er JSON.
`vejrsnapshot`, `dele_snapshot` og `turkort_snapshot` bliver `JSON.stringify`'et
af appen selv, og læses tilbage som strenge. Gør du dem til JSON-felter, får
appen et objekt hvor den venter tekst, og øjebliksbillederne bliver tomme.

**`uid` er den vigtigste enkeltstående ting.** Uden den kan to enheder ikke
blive enige om hvilken post der er hvilken, og dine egne poster bliver hentet
ned igen som dubletter ved hver opstart.

---

## Bilag — det fulde skema

Til at tjekke de eksisterende samlinger efter. Alle fem synkroniserede
samlinger har `user` (Relation → `users`) og `uid` (Plain text) ud over det der
står herunder.

### `items`

`navn` text · `vaegt_g` number · `pris_kr` number · `dimensioner` text ·
`antal` number · `delt` bool · `status` text · `tags` json · `kraever` json ·
`komplementer` json · `koebt_hos` text · `koebsdato` text · `koebslink` text ·
`ordrenummer` text · `garanti` json · `udlaan` json · `laant_af` json ·
`noter` text

### `grupper`

`navn` text · `tags` json · `item_ids` json · `noter` text

### `ture`

`navn` text · `sted` text · `sted_uid` text · `koordinater` json ·
`startdato` text · `slutdato` text · `naetter` number · `personer` number ·
`overnatning` text · `aktivitet` text · `terraen` text ·
`baereafstand_km` number · `erfaring` text · `status` text ·
`gruppe_ids` json · `loese_item_ids` json · `deltagere` json ·
`budget_linjer` json · `pak_af_tjek` json · `afgangs_tjek` json ·
`besked_fra_ejer` text · `noter` text · `vejrsnapshot` text ·
`dele_token` text · `dele_snapshot` text · `turkort_token` text ·
`turkort_retur` text · `turkort_besked` text · `turkort_snapshot` text

### `steder`

`navn` text · `koordinater` json · `adresse` text · `tags` json · `noter` text

### `personer`

`navn` text · `email` text · `standard_overnatning` text · `noter` text

### `turdeltagelse`

Denne har **ikke** `uid` — den synkroniseres ikke som de andre.

`tur` Relation → `ture` (single) · `user` Relation → `users` (single) ·
`navn` text · `medbragt` json · `baerer` json

**API-regler.** List og View — gæster skal kunne se hinandens bidrag på den
samme tur:

```
@request.auth.id != "" && tur.dele_token != "" && tur.dele_token = @request.query.token ||
tur.user = @request.auth.id
```

Create:

```
@request.auth.id != "" && user = @request.auth.id &&
tur.dele_token != "" && tur.dele_token = @request.query.token
```

Update og Delete:

```
user = @request.auth.id
```

Man kan altså kun røre sin egen række. Det er grunden til at deltagelserne
ligger i deres egen samling og ikke som et felt på turen: PocketBase giver
adgang til hele poster, ikke til enkelte felter, så måtte en deltager skrive på
turen, kunne hun også slette den.

---

## Hvis du tilføjer felter senere

Rækkefølgen er: felt i `src/db.ts` → læs og skriv det i `src/sync.ts` → felt i
PocketBase. Springer man det sidste over, virker alt lokalt, og dataene
forsvinder først når man åbner appen på en anden enhed.
