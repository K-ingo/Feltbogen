# PocketBase-opsætning

Feltbogen er offline-first: alt virker uden en server. PocketBase bruges kun
til at synkronisere mellem enheder og til at dele ture. Men **PocketBase
dropper lydløst felter der ikke findes i samlingens skema** — der kommer ingen
fejl, dataene forsvinder bare på vej op. Derfor skal skemaet passe.

Feltnavnene herunder er ikke til at vælge frit: de skal stå præcis som her,
fordi `src/sync.ts` sender og læser dem ved navn.

---

## 1. Seks samlinger

Opret dem som **Base collections** (ikke Auth, ikke View).

| Samling | Hvad den er |
|---|---|
| `items` | Gear |
| `grupper` | Gear-grupper |
| `ture` | Ture |
| `steder` | Steder man kommer tilbage til |
| `personer` | Dem man tager afsted med |
| `turdeltagelse` | Hvad gæster skriver sig på for |

`users` er PocketBases egen auth-samling og skal ikke oprettes.

---

## 2. Felter

### Fælles for `items`, `grupper`, `ture`, `steder`, `personer`

Alle fem skal have præcis disse to:

| Felt | Type | Bemærkning |
|---|---|---|
| `user` | Relation → `users` | Single, Cascade delete slået til |
| `uid` | Plain text | Postens identitet på tværs af enheder |

> **`uid` er den vigtigste.** Uden den kan to enheder ikke blive enige om
> hvilken post der er hvilken, og dine egne poster bliver hentet ned igen som
> dubletter ved hver opstart. Appen skriver en advarsel i konsollen og i
> Indstillinger → Synkronisering hvis den opdager at feltet mangler.

`id`, `created` og `updated` laver PocketBase selv — rør dem ikke.

### `items`

| Felt | Type |
|---|---|
| `navn` | Plain text |
| `vaegt_g` | Number |
| `pris_kr` | Number |
| `dimensioner` | Plain text |
| `antal` | Number |
| `delt` | Bool |
| `status` | Plain text |
| `tags` | JSON |
| `kraever` | JSON |
| `komplementer` | JSON |
| `koebt_hos` | Plain text |
| `koebsdato` | Plain text |
| `koebslink` | Plain text |
| `ordrenummer` | Plain text |
| `garanti` | JSON |
| `udlaan` | JSON |
| `laant_af` | JSON |
| `noter` | Plain text |

### `grupper`

| Felt | Type |
|---|---|
| `navn` | Plain text |
| `tags` | JSON |
| `item_ids` | JSON |
| `noter` | Plain text |

### `ture`

| Felt | Type |
|---|---|
| `navn` | Plain text |
| `sted` | Plain text |
| `sted_uid` | Plain text |
| `koordinater` | JSON |
| `startdato` | Plain text |
| `slutdato` | Plain text |
| `naetter` | Number |
| `personer` | Number |
| `overnatning` | Plain text |
| `aktivitet` | Plain text |
| `terraen` | Plain text |
| `baereafstand_km` | Number |
| `erfaring` | Plain text |
| `status` | Plain text |
| `gruppe_ids` | JSON |
| `loese_item_ids` | JSON |
| `deltagere` | JSON |
| `budget_linjer` | JSON |
| `pak_af_tjek` | JSON |
| `afgangs_tjek` | JSON |
| `besked_fra_ejer` | Plain text |
| `noter` | Plain text |
| `vejrsnapshot` | Plain text |
| `dele_token` | Plain text |
| `dele_snapshot` | Plain text |
| `turkort_token` | Plain text |
| `turkort_retur` | Plain text |
| `turkort_besked` | Plain text |
| `turkort_snapshot` | Plain text |

> **To faldgruber her.**
>
> `startdato` og `slutdato` skal være **Plain text**, ikke Date. Appen gemmer
> dem som `"2026-08-02"` og læser dem som tekst; et Date-felt sender et
> tidsstempel tilbage, og så holder datoerne op med at passe.
>
> `vejrsnapshot`, `dele_snapshot` og `turkort_snapshot` skal også være **Plain
> text**, selvom indholdet er JSON. Appen kalder selv `JSON.stringify` og
> forventer en streng retur. Gør du dem til JSON-felter, får appen et objekt
> hvor den venter tekst, og øjebliksbillederne bliver tomme.

### `steder`

| Felt | Type |
|---|---|
| `navn` | Plain text |
| `koordinater` | JSON |
| `adresse` | Plain text |
| `tags` | JSON |
| `noter` | Plain text |

### `personer`

| Felt | Type |
|---|---|
| `navn` | Plain text |
| `email` | Plain text |
| `standard_overnatning` | Plain text |
| `noter` | Plain text |

`email` skal være Plain text og ikke PocketBases Email-type — feltet må gerne
stå tomt, og der valideres ikke på det.

### `turdeltagelse`

Denne har **ikke** et `uid`-felt; den synkroniseres ikke som de andre.

| Felt | Type |
|---|---|
| `tur` | Relation → `ture` (single) |
| `user` | Relation → `users` (single) |
| `navn` | Plain text |
| `medbragt` | JSON |
| `baerer` | JSON |

---

## 3. API-regler

> **En tom regel betyder "alle må", ikke "ingen må".** Det er den farligste
> faldgrube i hele opsætningen, fordi den fejler tavst: lader du et regelfelt
> stå blankt, kan hvem som helst på internettet både læse og skrive i
> samlingen, og appen opfører sig præcis som om alt er i orden.
>
> Hvert regelfelt har tre tilstande:
>
> | Tilstand | Hvem der må |
> |---|---|
> | Lukket hængelås | Kun superusers — appen kan ikke bruge samlingen |
> | Åben hængelås, tomt felt | **Alle på internettet** |
> | Åben hængelås, med en regel | Dem reglen passer på |
>
> Der skal altså stå noget i felterne. Gå dem igennem én gang mere når du tror
> du er færdig.

### `items`, `grupper`, `steder`, `personer`

Alle fem regler (List, View, Create, Update, Delete) sættes til det samme:

```
user = @request.auth.id
```

Ingen andre end ejeren skal nogensinde kunne se sit gear, sine steder eller
sine personer. De fire samlinger har ingen delefunktion — kun `ture` har det.

### `ture`

**Create, Update, Delete:**

```
user = @request.auth.id
```

**List og View** skal desuden lukke to slags fremmede ind — en gæst med et
delelink, og en pårørende med et turkort:

```
user = @request.auth.id ||
(dele_token != "" && dele_token = @request.query.token) ||
(turkort_token != "" && turkort_token = @request.query.token)
```

`!= ""` er ikke pynt: uden det ville et kald helt uden token matche alle ture
der ikke er delt.

> **Det er her sikkerheden ligger.** Filtrene i `gaest.ts` og `turkort.ts` er
> en bekvemmelighed — en gæst kan sende hvad som helst. Det der faktisk
> beskytter turene, er den her regel.
>
> Bemærk samtidig at reglen giver adgang til **hele** posten. Det er derfor
> både gæsten og den pårørende læser et frosset øjebliksbillede i ét felt og
> ikke turen selv: alt hvad de ikke skal se, må ikke ligge i det de kan hente.

### `turdeltagelse`

**List og View** — gæster skal kunne se hinandens bidrag på den samme tur:

```
@request.auth.id != "" && tur.dele_token != "" && tur.dele_token = @request.query.token ||
tur.user = @request.auth.id
```

**Create:**

```
@request.auth.id != "" && user = @request.auth.id &&
tur.dele_token != "" && tur.dele_token = @request.query.token
```

**Update og Delete:**

```
user = @request.auth.id
```

Man kan altså kun røre sin egen række. Det er hele grunden til at
deltagelserne ligger i deres egen samling og ikke som et felt på turen:
PocketBase giver adgang til hele poster, ikke til enkelte felter, så måtte en
deltager skrive på turen, kunne hun også slette den.

---

## 4. Peg appen på serveren

Sæt `VITE_PB_URL` til serverens adresse — se `.env.example`. Uden den kører
appen videre, men kun lokalt på enheden.

---

## 5. Tjek at det virker

1. Log ind i appen.
2. Gå til **Indstillinger → Synkronisering** og tryk **Synkronisér nu**.
3. Der skal stå "Alt er synkroniseret". Står der et antal ændringer der ikke
   kunne sendes, står fejlen i browserens konsol.
4. Advarslen om et manglende `uid`-felt vises samme sted, hvis den er udløst.
5. Åbn en tur, lav et delelink, og åbn det i et privat vindue. Virker det, er
   læsereglen på `ture` rigtig.

Har du kørt appen før felterne fandtes, ligger dataene stadig på enheden. De
går op af sig selv ved næste synkronisering — der er ikke noget at hente
tilbage.

---

## Hvis du tilføjer felter senere

Rækkefølgen er: felt i `src/db.ts` → læs og skriv det i `src/sync.ts` → felt i
PocketBase. Springer man det sidste over, virker alt lokalt, og dataene
forsvinder først når man åbner appen på en anden enhed.
