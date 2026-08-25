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

## Trin 3 — Tilføj tre felter til `items`

Åbn den eksisterende `items`-samling → **Fields** → tilføj:

| Navn | Type |
|---|---|
| `udlaan` | JSON |
| `laant_af` | JSON |
| `vedligehold` | JSON |

Reglerne på `items` skal ikke røres — de skal være `user = @request.auth.id`
på alle fem, som de formentlig allerede er.

---

## Trin 4 — Tilføj ti felter til `ture`

Åbn `ture` → **Fields** → tilføj:

| Navn | Type |
|---|---|
| `sted_uid` | Plain text |
| `pak_af_tjek` | JSON |
| `afgangs_tjek` | JSON |
| `feltnoter` | JSON |
| `turkort_token` | Plain text |
| `turkort_retur` | Plain text |
| `turkort_besked` | Plain text |
| `turkort_snapshot` | Plain text |
| `hero_billede` | Plain text |
| `booking` | JSON |

> `turkort_snapshot` skal være **Plain text**, selvom indholdet er JSON. Se
> faldgruberne nederst.

---

## Trin 5 — Opret samlingen `billeder`

Fotos ligger ikke i `ture`. Et billede er sin egen post, så en tur med tredive
billeder ikke bliver en tredive megabyte stor record der skal sendes frem og
tilbage hver gang nogen retter en dato.

**New collection** → navn `billeder` → type **Base**.

Opret felterne **først**, og reglerne bagefter — en regel der nævner et felt
der ikke findes endnu, bliver afvist.

| Navn | Type | Bemærkning |
|---|---|---|
| `user` | Relation → `users` | Single |
| `uid` | Plain text | — |
| `navn` | Plain text | Filnavnet det kom ind med |
| `tur_uid` | Plain text | Turen billedet hører til |
| `tid` | Plain text | **Ikke** Date — se faldgruberne |
| `bredde` | Number | — |
| `hoejde` | Number | — |
| `byte` | Number | — |
| `beskrivelse` | Plain text | — |
| `fil` | **File** | Max select **1** · Max file size **5242880** |
| `original` | **File** | Max select **1** · Max file size **26214400** |
| `original_byte` | Number | — |

`fil` og `original` er de eneste File-typer i hele skemaet. Sæt **Max select
til 1** på begge — med flere bliver feltet et array, og appen sender ét
billede pr. post.

> **Max file size er i _bytes_, ikke megabyte.** Skriver du `5`, er grænsen
> fem bytes, og så kan intet billede nogensinde komme op — hvert eneste
> forsøg svarer `400 Failed to create record.` med
> `validation_file_size_limit`. Tallene ovenfor er de rigtige:
> `5242880` = 5 MB og `26214400` = 25 MB.

To filer pr. billede, med hver sin opgave:

- **`fil`** er visningskopien. Appen skalerer til 1600 px og komprimerer som
  JPEG, så et galleri kan tegnes uden at hente megabytes.
- **`original`** er filen som den kom ind, urørt. Den vises aldrig — den er
  der for at kunne hentes ned igen i fuld kvalitet, af én selv eller af de
  andre på turen. Grænsen på `26214400` bytes er 25 MB; et telefonfoto ligger
  typisk på 3–8 MB, og 25 MB er også den grænse appen selv afviser ved.

Det betyder at hvert billede fylder originalens størrelse plus et par hundrede
kilobyte på serverens disk. Et turgalleri på tredive billeder bliver altså
omkring 150 MB. Vil du hellere spare pladsen end kunne hente i fuld kvalitet,
kan du undlade `original`-feltet — appen sender det stadig, PocketBase dropper
det lydløst, og "Hent i fuld kvalitet" står bare ikke frem nogen steder.

**Lad hverken `fil` eller `original` være protected.** Et protected filfelt kræver et token for
at hente billedet, og gæsten på et delelink har ingen konto. Adresserne er
uforudsigelige og står kun i det link du selv sender.

Så **API rules** — de samme fem som de andre samlinger:

```
@request.auth.id != "" && user = @request.auth.id
```

i alle fem felter.

---

## Trin 6 — Ret læsereglen på `ture`

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

## Trin 7 — Tjek at det virker

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

## Hvis login fejler med 400

`POST /api/collections/users/auth-with-password` svarer **400 på tre helt
forskellige ting**, og netværksfanen viser kun tallet. Svaret står under
**Network → den fejlede kald → Response**, og appen skriver det samme i
konsollen (`Login fejlede: {status, url, besked, felter}`).

| Svarets krop | Betyder | Hvad der skal gøres |
|---|---|---|
| `"message": "Failed to authenticate."` | Kontoen findes ikke, kodeordet er forkert, **eller** samlingens auth-regel afviser kontoen | Prøv en konto du ved findes. Bliver den også afvist, se de to næste rækker |
| `"data": { "identity": … }` | Feltet manglede eller validerede ikke | Fejlen er i appen, ikke i opsætningen |
| `"message": "Something went wrong."` og status **0** | Serveren blev aldrig nået | Railway-instansen sover eller er væk — tjek `VITE_PB_URL` |

To ting i PocketBase kan give "Failed to authenticate." for en konto der
findes, og begge sidder på `users`-samlingen under **Options**:

- **Identity/Password er slået fra.** Så kan ingen logge ind med kodeord.
- **Auth-reglen kræver noget kontoen ikke opfylder** — typisk
  `verified = true`. Feltbogen sender ikke bekræftelsesmails, så en konto
  oprettet i appen bliver aldrig `verified`, og login vil fejle for alle.
  Feltet skal stå tomt.

PocketBase skelner med vilje ikke mellem "findes ikke" og "forkert kodeord" i
svaret — ellers kunne man afprøve sig frem til hvilke e-mails der er oprettet.
Derfor er admin-panelet det eneste sted forskellen kan ses.

---

## Faldgruber

**Datoer skal være Plain text.** `startdato` og `slutdato` gemmes som
`"2026-08-02"` og læses som tekst. Et Date-felt sender et tidsstempel tilbage,
og så holder datoerne op med at passe.

**Snapshot-felterne skal også være Plain text**, selvom indholdet er JSON.
`vejrsnapshot`, `dele_snapshot` og `turkort_snapshot` bliver `JSON.stringify`'et
af appen selv, og læses tilbage som strenge. Gør du dem til JSON-felter, får
appen et objekt hvor den venter tekst, og øjebliksbillederne bliver tomme.

**`tid` på et billede skal også være Plain text.** Det er den samme fælde som
datoerne: appen skriver en ISO-streng og sammenligner den som tekst, når
galleriet sorteres kronologisk.

**Max file size tælles i bytes.** Det er det felt der oftest bliver sat
forkert: `5` betyder fem bytes og ikke fem megabyte, og så afvises hvert
eneste billede med `validation_file_size_limit`. Skriv `5242880` og
`26214400`.

**`fil` og `original` må ikke være protected.** Så kan gæsten på et delelink
hverken se billedet eller hente det, og galleriet står tomt hos hende — uden
fejl nogen af stederne.

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
`vedligehold` json · `noter` text

### `grupper`

`navn` text · `tags` json · `item_ids` json · `noter` text

### `ture`

`navn` text · `sted` text · `sted_uid` text · `koordinater` json ·
`startdato` text · `slutdato` text · `naetter` number · `personer` number ·
`overnatning` text · `aktivitet` text · `terraen` text ·
`baereafstand_km` number · `erfaring` text · `status` text ·
`gruppe_ids` json · `loese_item_ids` json · `deltagere` json ·
`budget_linjer` json · `pak_af_tjek` json · `afgangs_tjek` json ·
`feltnoter` json ·
`besked_fra_ejer` text · `noter` text · `vejrsnapshot` text ·
`dele_token` text · `dele_snapshot` text · `turkort_token` text ·
`turkort_retur` text · `turkort_besked` text · `turkort_snapshot` text ·
`hero_billede` text · `booking` json

### `billeder`

`navn` text · `tur_uid` text · `tid` text · `bredde` number · `hoejde` number ·
`byte` number · `beskrivelse` text · `fil` **file** (max select 1, max size
5242880 bytes, ikke protected) · `original` **file** (max select 1, max size
26214400 bytes, ikke protected) · `original_byte` number

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
