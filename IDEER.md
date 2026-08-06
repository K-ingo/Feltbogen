# Feltbogen — Ideer og forbedringsforslag

*Samlet dokument, august 2026. Alle forslag diskuteret med Claude.*

Dokumentet er delt op i kategorier efter arten af ændringen — først dem der
lukker huller i det eksisterende fundament, dernæst større arkitektur-forslag,
og til sidst mindre kvalitetsløft. Under hver ide står hvad der skal bygges,
hvorfor, hvilke datamodel-ændringer det kræver, og hvor det bor i koden.

Ideerne er nummereret på tværs af kategorier, så de kan refereres senere.

---

## Prioritetsforslag — top 5

Hvis der kun bygges fem ting til, er det disse:

1. **Pak-af-tjek** (§1.1) — lukker læringssløjfen. Uden det er smart-motoren en lommeregner.
2. **Sted-database** (§2.1) — genbrugsressource som åbner for flere andre features.
3. **Person-tabel og låne-log** (§2.2 + §7.2) — appen bliver socialt vævet.
4. **"På tur"-tilstand** (§3.1) — lukker hullet mellem "planlagt" og "afsluttet".
5. **Motor-transparens ("hvorfor?")** (§4.3) — bygger tillid uforholdsmæssigt meget.

---

## 1. Luk kredsløbet — færdiggørelse af fundament

Ting der allerede er i fundamentet men mangler i koden.

### 1.1 Pak-af-tjek

**Hvad.** Efter en tur markeres hvert item som *brugt*, *ubrugt* eller *gik i stykker*. To niveauer, valgbare i indstillinger: let (kun status per item) eller grundig (også noter per kategori).

**Hvorfor.** Uden pak-af-tjek er der ingen data smart-motoren kan lære af. Det er den ene bloker for at motoren rykker fra "regner" til "lærer". Står som en tydelig manko i fundamentet §8.

**Datamodel.** Nyt objekt på `Tur`:
```ts
pak_af_tjek: {
  udfyldt_dato: string;     // ISO
  niveau: 'let' | 'grundig';
  linjer: {
    item_uid: string;
    status: 'brugt' | 'ubrugt' | 'i_stykker';
    noter?: string;         // kun ved grundig
  }[];
  kategori_noter?: {        // kun ved grundig
    kategori: string;
    vurdering: 'tilstraekkeligt' | 'for_meget' | 'for_lidt';
    noter: string;
  }[];
} | null
```

**UI.** Handlingsknappen i `TurDetalje.tsx` for status *afsluttet* skifter fra "intet" til "Lav pak-af-tjek". Ny skærm `PakAfTjek.tsx` med en liste over items og en trekantsknap for hver. På mobil: én liste. På PC: to kolonner.

**Motor.** Pak-af-tjek-data bruges senere til at genkende personlige mønstre (§4.1). Første udrulning behøver kun at gemme data — brugsstatistikken på itemet kan begynde at vise "brugt 5 af 8 gange".

**Sværhedsgrad.** Mellem. Selve UI'et er lige til, men det er en ny stor sektion. Læringen kan bygges lidt ad gangen bagefter.

**Afhængigheder.** Ingen. Kan bygges i morgen.

---

### 1.2 Flere handlinger på dashboardet

**Hvad.** To ekstra handlinger i `handlinger()`-funktionen i `dashboard.ts`:
- "Turen slut, ingen pak-af-tjek" (kritisk hvis over 3 dage siden slutdato)
- "3 dage til, status stadig Kladde" (advarsel)

**Hvorfor.** Handlinger er allerede en velfungerende del af dashboardet. To meget billige udvidelser der begge står i fundamentets triggerliste (§9).

**Datamodel.** Ingen ændringer.

**UI.** Ingen ændringer — `HandlingsKort` renderer det samme uanset type.

**Motor / logik.** Ny type `'pak_af_tjek_mangler'` og `'kladde_naer_start'` i `HandlingsType`. To nye filtre i `handlinger()`.

**Sværhedsgrad.** Lille. En times arbejde. Første kræver dog at pak-af-tjek er bygget.

**Afhængigheder.** "Turen slut" kræver §1.1. "Kladde nær start" kan bygges i dag.

---

### 1.3 Foto på turen

**Hvad.** Upload af billeder til en tur — hero-billede og galleri. Vises på gæstevisning og på ejerens tur-detalje.

**Hvorfor.** `billeder`-feltet står i datamodellen (§5) men bruges ikke. Selv ét foto gør delelinket varmere og turen mere identificerbar i listen.

**Datamodel.** `Tur.billeder` bruges. Nyt felt `Tur.hero_billede_index` for at pege på det der bruges som cover.

**UI.** Ny sektion "Billeder" i `TurDetalje.tsx` med drag-and-drop upload. På tur-listen: hero-billede som lille thumb til venstre.

**Eksterne afhængigheder.** Billed-komprimering i browseren (fx `browser-image-compression`). PocketBase files-API til upload — kræver konfiguration i samlingen `ture`.

**Sværhedsgrad.** Mellem. Selve upload er ligetil, men billed-komprimering og PocketBase files er første gang det bruges i projektet.

**Afhængigheder.** Ingen.

---

### 1.4 QR-kode ved deling

**Hvad.** QR-kode ved siden af delelinket i `Deling`-komponenten i `TurDetalje.tsx`.

**Hvorfor.** Nævnt i fundamentet §10. Ved bålet uden dækning er QR mærkbart bedre end at læse 32 hex-tegn op.

**Datamodel.** Ingen ændringer.

**UI.** SVG-QR under linket. På mobil kan der laves en knap "Vis QR" der åbner en fullscreen QR-visning.

**Eksterne afhængigheder.** `qrcode` fra npm (ren JS, ingen browser-API'er). Alternativt `qr-code-styling`.

**Sværhedsgrad.** Lille. En kort eftermiddag.

**Afhængigheder.** Ingen.

---

## 2. Nye datastrukturer

Større strukturelle udvidelser der åbner for flere features.

### 2.1 Sted-database

**Hvad.** Steder bliver en selvstændig ting sidestillet med grupper og ture. Hver gang koordinater gemmes på en tur, kan de markeres som et sted med navn, tags, noter og et link til turene der har været der.

**Hvorfor.** Steder er en genbrugsressource — Emil vender tilbage til Rold Skov, Feddet, samme shelter i Klosterheden. Lige nu glemmer appen alt hver gang. Åbner også for turkort til pårørende (§3.4) og "har været her før"-forslag.

**Datamodel.** Ny tabel `steder`:
```ts
{
  uid: string;
  navn: string;                  // fx "Rold Skov — nordre shelter"
  koordinater: { lat: number; lng: number };
  adresse?: string;              // fra DAWA-opslag
  tags: string[];                // 'skov', 'shelter', 'kildevand'
  noter: string;                 // 'myggeplaget om sommeren, kildevand 200 m mod øst'
  billeder?: string[];
  oprettet: string;
  aendret: string;
  pb_id?: string;
}
```
På `Tur`: nyt valgfrit felt `sted_uid?: string`. Fald tilbage til `sted`-teksten hvis feltet er tomt (bagudkompatibilitet).

**UI.** Ny fane "Steder" på niveau med Grupper og Ture. Sted-liste, sted-detalje (hvornår besøgt, tags, noter, kort). I `TurDetalje.tsx` stedsøgning udvides så eksisterende steder foreslås øverst med "Været her 3 gange".

**Motor.** Kan bruges til at foreslå "Sidste gang du var her, havde du disse advarsler — er de rettet?".

**Sværhedsgrad.** Mellem-stor. Ny tabel, ny fane, ny detaljeskærm, sync-support. Men datamodellen er stort set en kopi af `Gruppe`.

**Afhængigheder.** Ingen.

---

### 2.2 Person-tabel

**Hvad.** Faste rejseselskaber som selvstændige poster i stedet for fri-tekst per tur. Navn, kontakt, standard-overnatning.

**Hvorfor.** "Mikkel" på Rold Skov 2025 og "Mikkel" på Feddet 2026 er to fremmede for appen i dag. Med Personer bliver statistik som "Ture med Mikkel: 8" mulig, deltagerudfyldning bliver hurtigere, og delelink kan sendes direkte.

**Datamodel.** Ny tabel `personer`:
```ts
{
  uid: string;
  navn: string;
  email?: string;
  standard_overnatning?: Overnatning;
  noter?: string;
  oprettet: string;
  aendret: string;
  pb_id?: string;
}
```
På `Deltager`: `person_uid?: string` som valgfri kobling. Fri-tekst-flowet bevares.

**UI.** Ny undermenu i Indstillinger: "Personer". Deltager-tilføjelse i `TurDetalje.tsx` med autocomplete på Person-navn.

**GDPR.** Kun navn og evt. e-mail. Bruges kun lokalt (og synces til brugerens egen PocketBase-konto). Ingen deling med tredjepart. Bør nævnes i indstillinger.

**Sværhedsgrad.** Mellem. Ny tabel, ny sync, ny autocomplete. Ikke stor arkitektur, men skal spille sammen med den eksisterende deltager-model.

**Afhængigheder.** Ingen.

---

### 2.3 Gear-sæt (hårde bindinger)

**Hvad.** Et sæt er et lille bundle af items der altid hører sammen: "pandelampe + 2× AAA-batterier + reservepære". Når pandelampen kommer på pakkelisten, kommer sættet med.

**Hvorfor.** Grupper siger "det her hører til den her type tur". Sæt løser noget andet: "det her hører altid til det her item". Løser en meget virkelig irritation.

**Datamodel.** Ny tabel `saet`:
```ts
{
  uid: string;
  navn: string;              // 'Pandelampe komplet'
  ankermedlem_uid: string;   // pandelampen selv
  medlem_uids: string[];     // batterier, reservepære
  oprettet: string;
  aendret: string;
  pb_id?: string;
}
```

**UI.** Ny sektion på `ItemDetalje`: "Del af sæt". Ved oprettelse: knap "Lav et sæt omkring dette item". Ved pakkeliste-beregning: `itemUidsPaaTur` udvides til at trække sætmedlemmer med.

**Motor.** `itemUidsPaaTur` i `smartMotor.ts` skal opdateres. Advarsler dukker op hvis et sætmedlem mangler i inventaret ("Pandelampe er med, men batterier findes ikke som item").

**Sværhedsgrad.** Mellem. Datamodellen er let, men logikken skal ind i motoren.

**Afhængigheder.** Ingen.

---

### 2.4 Måltidsplan

**Hvad.** I stedet for 600 g gennemsnitsmad/person/dag: brugeren definerer måltider med ingredienser og vægt. Turens menu bygges af måltider, og mad + gas beregnes præcist.

**Hvorfor.** 600 g er en gæt-baseline. Med måltidsplan bliver madvægten faktisk korrekt, og gassen kan beregnes efter antal kogte måltider. Det er også dét man pakker efter i virkeligheden.

**Datamodel.** To nye tabeller:
```ts
// Genbrugelige måltider
maaltider: {
  uid: string;
  navn: string;                    // 'Chili sin carne (frysetørret)'
  slags: 'morgen' | 'frokost' | 'aften' | 'snack';
  vaegt_g_pr_person: number;
  koger: boolean;                  // relevant for gasberegning
  ingredienser?: string;           // fri tekst
  noter?: string;
}

// Turens plan
menu: {          // ét objekt på Tur
  dage: {
    dato: string;
    morgen?: string[];             // uid'er
    frokost?: string[];
    aften?: string[];
    snacks?: string[];
  }[];
}
```

**UI.** Ny undermenu i Indstillinger: "Måltider" (bibliotek). På `TurDetalje.tsx`: ny sektion "Menu" med drag-and-drop af måltider ind i dage.

**Motor.** `beregnForbrug` udvides — hvis `tur.menu` er udfyldt, bruger den den; ellers falder tilbage til de nuværende faste satser. Gassen skalerer med antal kogte måltider (fx 12 g gas per kogning).

**Sværhedsgrad.** Stor. Nyt bibliotek, ny UI, motorlogik der skal håndtere begge tilfælde.

**Afhængigheder.** Ingen, men giver mest værdi sammen med §4.1 (personlige baselines).

---

### 2.5 Ture kan tagges med tema

**Hvad.** Ture får en `tema`-strøm-etiket eller tags. "Sommer med Mikkel", "Kanoture", "Familietur", "Bushcraft-solo".

**Hvorfor.** Grupper handler om gear. Tema handler om identitet på selve turen. Bruges til filtrering, statistik, og til at finde tilbage ("hvor mange kanoture har jeg været på?").

**Datamodel.** `Tur.temaer: string[]`.

**UI.** Chip-input i `TurDetalje.tsx`, filter-chips i turlisten.

**Sværhedsgrad.** Lille. En felt-tilføjelse og et TagsInput.

**Afhængigheder.** Ingen.

---

## 3. Under selve turen

Ting der bruges når man er ude — offline, batterisparende, praktisk.

### 3.1 "På tur"-tilstand

**Hvad.** En dedikeret skærm der aktiveres når status er `aktiv`. Kun det man skal vide her og nu: næste vejrskift, solopgang/skumring i dag, dage tilbage, feltnoter-felt. Mørkt tema tvungent, ingen animationer, låst mode.

**Hvorfor.** Passer ind i tur-livscyklen — den har allerede statustransitionerne, men der er tomrum mellem "Klar" og "Afsluttet". Batterisparende design er også ærligt om at appen bruges i felten.

**Datamodel.** Ingen ændringer.

**UI.** Ny komponent `PaaTurTilstand.tsx`. Renderes fra `TurDetalje.tsx` når status er `aktiv` og brugeren trykker på en "På tur"-knap. Fullscreen. Escape-knap i hjørne. `Skal` skjules midlertidigt.

**Sværhedsgrad.** Mellem. Ret enkel skærm i sig selv, men designet skal være strengt (mørkt, ingen distraktioner).

**Afhængigheder.** Ingen.

---

### 3.2 Afgangs-tjekliste

**Hvad.** Alt det andet man glemmer, som ikke er gear: nøgler, telefon fuldt opladet, delt placering med nødkontakten, bål-forbud tjekket. Standard-elementer plus dem brugeren selv tilføjer.

**Hvorfor.** Der er masser af planlægning der ikke handler om pakning. Lige nu bor den i hovedet — den kan lige så godt bo i appen.

**Datamodel.** Nyt objekt på `Tur`:
```ts
afgangs_tjek: {
  linjer: {
    tekst: string;
    afkrydset: boolean;
    fra_skabelon: boolean;   // vs. tilføjet på denne tur
  }[];
} | null
```
Ny bruger-skabelon i Indstillinger: `afgangs_tjek_skabelon: string[]`.

**UI.** Ny sektion i `TurDetalje.tsx` — foldet som standard, men foldes ud automatisk når status skifter fra `klar` til `aktiv`.

**Sværhedsgrad.** Lille. En liste med checkboxes.

**Afhængigheder.** Ingen.

---

### 3.3 GPS-spor under aktiv tur

**Hvad.** Optag et enkelt spor via browserens Geolocation-API mens turen er `aktiv`. Vises bagefter som lille statisk kort på turen.

**Hvorfor.** Fundamentet nævner "GPS senere" ved status *aktiv*. Ikke navigation, bare et minde. Bruges også som input til statistik ("kilometer båret").

**Datamodel.** Nyt objekt på `Tur`:
```ts
spor?: {
  punkter: { lat: number; lng: number; tid: string }[];
  optaget_fra: string;
  optaget_til: string;
}
```

**UI.** Under "På tur"-tilstand: "Start spor" / "Stop spor". På turen efter afslutning: lille kort med sporet tegnet.

**Eksterne afhængigheder.** Geolocation-API (indbygget). Kort-visning kan bruge samme kilde som resten af appen — Mapbox Static eller OpenStreetMap.

**Batteri.** Optag med lav frekvens (fx hvert 2. minut) og lav præcision — sporet skal vise "hvor gik jeg", ikke navigere.

**Sværhedsgrad.** Mellem. Selve optagelsen er enkel, men baggrunds-permission på iOS PWA er drilsk.

**Afhængigheder.** §3.1 er en naturlig hjemmebase for kontrollen.

---

### 3.4 Turkort til pårørende

**Hvad.** Når en tur markeres `aktiv`, kan der genereres ét kort link ("Emil er på tur til [koordinater], forventet retur torsdag kl. 19") som sms'es til én person. Modtageren har ingen konto, ser turnavn, koordinater med kort, forventet retur, og nødkontakt-tekst. Efter turen slutter, går det inaktivt.

**Hvorfor.** Sikkerhed uden ceremoni. Ikke live-tracking, ikke en app til den anden. Bare "hvis jeg ikke er hjemme torsdag, ved du hvor du skal starte med at lede".

**Datamodel.** Nyt objekt på `Tur`:
```ts
paaroerende_link?: {
  token: string;
  forventet_retur: string;   // ISO
  besked: string;
  udloebet: boolean;         // sættes når status skifter til afsluttet
}
```

**UI.** Ny sektion i `TurDetalje.tsx` mellem "Deling" og "Noter": "Turkort". Bruger samme mønster som gæstelink — knap "Lav turkort" → viser link + QR + kopier-knap.

**Modtager-side.** Ny simpel React-route `/turkort/:token` (svarende til `GaesteSide`, men uden login-krav). Kun de fire ting: navn, koordinater med statisk kort, forventet retur, nødkontakt-tekst.

**Sværhedsgrad.** Mellem. Ligner gæstelink-mønstret men med enklere adgangsregler.

**Afhængigheder.** Passer godt sammen med §2.1 (Sted-database) — så viser turkortet stedets navn i stedet for koordinater.

---

## 4. Motor-forbedringer

Ting der gør smart-motoren klogere eller mere gennemsigtig.

### 4.1 Kropsdata og personlige baselines

**Hvad.** I Indstillinger: brugerens vægt og aktivitetsniveau (lav/middel/høj). Motoren skalerer vand og mad efter det i stedet for at bruge en gennemsnitsdansker.

**Hvorfor.** 3,5 L/person/dag og 600 g/person/dag er hardcoded konstanter i `smartMotor.ts`. En 65-kilos ryttertype har ikke samme forbrug som en 95-kilos bushcrafter der laver bålmad. Formlen er velkendt: ca. 30-40 ml vand per kg per dag som base.

**Datamodel.** Ny sektion i bruger-indstillinger (kan bo i localStorage eller på PocketBase-brugeren):
```ts
{
  kropsvaegt_kg?: number;
  aktivitetsniveau?: 'lav' | 'middel' | 'hoej';
  daglig_kalorie?: number;      // valgfri override
}
```

**Motor.** `beregnForbrug` refaktoreres til at kunne tage baselines ind. Fald tilbage til de gamle konstanter hvis intet er sat.

**UI.** Ny undermenu i Indstillinger: "Kroppen". Med forklaring af hvad tallene bruges til.

**Sværhedsgrad.** Lille. En times motor-arbejde plus en indstillingsside.

**Afhængigheder.** Ingen. Kan bygges i dag.

---

### 4.2 Glidende sæsonbaselines

**Hvad.** Vand og mad skalerer glidende fra vinter til sommer i stedet for et binært spring mellem månederne.

**Hvorfor.** I dag er cutoff'en binær (måned 4-9 = sommer). Et spring på 40 % mellem 31. marts og 1. april er kunstigt. En sinusformet skala fra fx 2,5 L (januar) til 3,8 L (juli) med interpolation gør motoren mere troværdig.

**Datamodel.** Ingen ændringer.

**Motor.** Ny funktion `saesonfaktor(dato: string): number` der returnerer en værdi mellem 0 (dybvinter) og 1 (højsommer). `beregnForbrug` bruger den.

**Sværhedsgrad.** Lille. Ren funktion, én times arbejde inklusive tests.

**Afhængigheder.** Ingen.

---

### 4.3 Motor-transparens ("hvorfor?")

**Hvad.** Ved hvert forslag og hver advarsel: klikbar "hvorfor?" der viser resonnementet. "Fordi turen er markeret hængekøje, og gruppen Hængekøje-sommer matcher på 2 af 2 tags." Eller: "Rød advarsel: MSR kræver 'skruegevind-gas' — intet på pakkelisten har det tag."

**Hvorfor.** Åbenhed skaber tillid. Løser præcis den mistillid fundamentet §15 beskriver ("Hvorfor smart-motor som rådgiver, ikke automat?"). Motoren ved allerede hvorfor — den mangler bare at fortælle det.

**Datamodel.** Ingen ændringer.

**Motor.** `Advarsel`, `Handling` og `GruppeForslag` udvides med et `begrundelse: string`-felt. Alle steder der genererer disse tilføjes en menneske-læselig begrundelse.

**UI.** Popover eller lille info-ikon ved advarsler og forslag. På PC: hover. På mobil: klik.

**Sværhedsgrad.** Lille-mellem. Mange steder skal opdateres, men hver ændring er triviel.

**Afhængigheder.** Ingen.

---

### 4.4 Vægt-brydere

**Hvad.** Et klik på vægt-oversigten: top 5 tungeste items med spar-forslag hvis der er noget lettere i inventaret. "Din TTTM vejer 900 g, men din DD SuperLight vejer 480 g — vil du bytte?"

**Hvorfor.** Vægt er ét af det gear er lavet til at løse. Lige nu vises totalen, men appen hjælper ikke med at få den ned.

**Datamodel.** Ingen ændringer.

**Motor.** Ny funktion i `smartMotor.ts` — for hvert item på turen, find items der er ikke-på-turen, har overlappende tags og er mindst 20 % lettere.

**UI.** Ny sektion under vægt-oversigten i `TurDetalje.tsx` (foldet som standard): "Kan vægten ned?".

**Sværhedsgrad.** Mellem. Ren logik, men matchning på tags kræver eftertanke for at ikke foreslå tåbeligheder.

**Afhængigheder.** Ingen.

---

### 4.5 Manglende-tag detektor

**Hvad.** Når motoren ikke kan foreslå noget for et krav, siger den hvorfor: "Denne tur foreslår ikke [regnbeskyttelse] fordi ingen af dine grupper har det tag."

**Hvorfor.** Hjælper med at holde taxonomien ren over tid. Løser den skjulte fejl "min motor foreslår aldrig X, men det er fordi jeg aldrig har tagget X".

**Datamodel.** Ingen ændringer.

**Motor.** `foreslaaGrupper` udvides med "manglende tags"-liste — de tags turen efterspørger som ingen gruppe har.

**UI.** Info-linje under gruppeforslag i `TurDetalje.tsx`.

**Sværhedsgrad.** Lille.

**Afhængigheder.** Ingen.

---

### 4.6 "Ligesom sidst"-knap på ny tur

**Hvad.** Når en ny tur oprettes med overnatning + terræn + personer, tilbyder appen: "Kopiér grej fra Sommerlejr 2025 (matcher på 3 af 3)".

**Hvorfor.** Overskrider ikke rådgiver-rollen (kræver bekræftelse). Turskabelon uden at bygge en fuld skabelonstruktur.

**Datamodel.** Ingen ændringer.

**Motor.** Ny funktion `foreslaaKopi(ny_tur, gamle_ture)`. Finder den bedste match baseret på turparametre. Returnerer en liste af gamle ture med matchscore.

**UI.** I `TurDetalje.tsx` for nye ture: en info-boks øverst med de bedste match og en "Kopiér grej"-knap.

**Sværhedsgrad.** Mellem. Simpel matchning, men UX skal være omhyggelig (ikke skubbes i hovedet på brugeren).

**Afhængigheder.** Ingen.

---

## 5. Dansk friluftsliv-kontekst

Det her er hvor Feltbogen kunne blive noget andet end en international app.

### 5.1 Bål-forbud og skovbrandindeks

**Hvad.** DMI's skovbrandindeks vises for turens dato og område. Lokale bål-forbud fremhæves.

**Hvorfor.** Direkte handlingsrelevant, ikke bare info. Om sommeren er det tit et faktisk spørgsmål.

**Datamodel.** Ingen ændringer. Kan caches på turen ligesom vejrdata.

**Eksterne afhængigheder.** DMI's åbne data API. Endpoints skal undersøges — der er offentlige feeds men API'et er ikke lige så pænt som Open-Meteo.

**UI.** Ny sektion ved siden af vejrudsigten i `TurDetalje.tsx`.

**Sværhedsgrad.** Mellem. Selve API-integrationen er lille arbejde, men DMI-API'er har historisk været mindre stabile end Open-Meteo. Fald tilbage til stille hvis kaldet fejler.

**Afhængigheder.** Ingen.

---

### 5.2 Shelter-database / Udinaturen

**Hvad.** Kort MVP: et "Har du booket?"-felt på turen med link + checkboks. Fuldt: opslag i shelter.dk / Udinaturen's data med koordinater og bookingstatus.

**Hvorfor.** Naturstyrelsens shelter-database har hele Danmark dækket. Fjerner en stor kilde til "shit, det havde jeg glemt".

**Datamodel.** På `Tur`:
```ts
booking?: {
  link: string;
  booket: boolean;
  reference?: string;
}
```

**Eksterne afhængigheder.** Udinaturen har åbne data (via api.dataforsyningen.dk eller lignende). Endpoints skal undersøges. MVP kan starte uden API og bare have felterne.

**UI.** Sektion i `TurDetalje.tsx` "Booking".

**Sværhedsgrad.** MVP: lille. Fuld integration: stor.

**Afhængigheder.** Bruger §2.1 (Sted-database) hvis fuldt integreret.

---

### 5.3 Skumring, ikke kun solopgang/nedgang

**Hvad.** Vis civil skumring (twilight) sammen med solopgang og solnedgang.

**Hvorfor.** Skumring er der man reelt tænder pandelampen og tager tarp op. Solnedgang er 20-40 minutter tidligere.

**Datamodel.** Ingen ændringer.

**Motor.** Open-Meteo har `civil_twilight_begin` og `civil_twilight_end` i samme kald. Bare tilføj til `VejrDag` og hent dem.

**UI.** Ekstra linje under solopgang/nedgang i vejrudsigten. Optional: markér tidsvinduet visuelt.

**Sværhedsgrad.** Lille. En ekstra parameter i vejrkald plus felt i typen.

**Afhængigheder.** Ingen.

---

### 5.4 Tidevand ved kystture

**Hvad.** Tidevands-tabel for turens dato og lokation. Kun ved kyst-terræn.

**Hvorfor.** Kritisk ved kajakture, søkajak, kysten-langs-vandreture, kystfiskeri. Ikke relevant for alle ture — automatisk-aktivering ved `terraen === 'kyst'`.

**Datamodel.** Ingen ændringer.

**Eksterne afhængigheder.** DMI har åbne tidevandsdata for danske havne. Nærmeste havn skal bestemmes fra turens koordinater.

**UI.** Sektion i `TurDetalje.tsx` under vejrudsigten, kun synlig ved kyst-terræn.

**Sværhedsgrad.** Mellem. API-integration plus nærmeste-havn-lookup.

**Afhængigheder.** Ingen.

---

### 5.5 Jagtperiode-varsel

**Hvad.** Miljøstyrelsens jagttider konsulteres på turens dato. Advarsel hvis der er drivjagt eller almindelig jagt i området.

**Hvorfor.** Bushcrafters i skoven under drivjagt er ikke en god kombination. Nogle skove lukkes helt på jagtdage.

**Datamodel.** Ingen ændringer.

**Eksterne afhængigheder.** Miljøstyrelsen har publicerede jagttider. Ikke sikker på om der er et åbent API — måske en statisk tabel der opdateres årligt.

**UI.** Info-boks nær turdato-feltet, kun ved skov-terræn.

**Sværhedsgrad.** Mellem. Ikke svært i sig selv, men data-tilgang skal researches.

**Afhængigheder.** Ingen.

---

## 6. Turen som feltbog — efter turen

Feltbogen betyder notesbog. Det peger på registrering *efter* turen, ikke kun forberedelse.

### 6.1 Turlog / feltnoter

**Hvad.** En enkel dagbog per tur. Vejr som det faktisk var, hvad man så, hvad der virkede.

**Hvorfor.** Feltbogen's løfte er i navnet. Turen som andet end en pakkeliste. Fodrer også smart-motoren senere ("du noterede 'koldt om natten' — samme sovepose næste gang?").

**Datamodel.** På `Tur`:
```ts
feltnoter?: {
  indgange: {
    tid: string;           // ISO
    tekst: string;
    billede_url?: string;
  }[];
}
```

**UI.** Ny sektion i `TurDetalje.tsx`. På `aktiv` status: prominent, med en stor "+ indgang"-knap. På `afsluttet`: læse-visning.

**Sværhedsgrad.** Mellem. Simpel datamodel, men UI skal være behageligt at bruge i felten.

**Afhængigheder.** Passer godt med §3.1 ("På tur"-tilstand).

---

### 6.2 "Hvad ville du gøre om?"-spørgsmål

**Hvad.** Ét frit tekstfelt ved siden af pak-af-tjekket. Én linje: "Hvad ville du gøre om?".

**Hvorfor.** Det er tit her de mest værdifulde læringer ligger. Dem man taber inden næste tur, hvis man ikke skriver dem ned mens de er friske.

**Datamodel.** På `Tur`:
```ts
gjort_om?: string;
```

**UI.** I `PakAfTjek`-skærmen: én tekstboks.

**Sværhedsgrad.** Trivielt.

**Afhængigheder.** §1.1 (pak-af-tjek).

---

### 6.3 Årsopgørelse

**Hvad.** En dedikeret skærm i januar der viser sidste års stats med lidt karakter — 12 ture, 45 nætter, 340 km båret, 8 nye stykker gear, samlet tid udendørs. Koldeste nat, våde ste tur, mest brugte item.

**Hvorfor.** Bygger 100 % på data appen allerede har. Dét er den slags man deler med venner. Får folk til at åbne appen igen.

**Datamodel.** Ingen ændringer.

**UI.** Ny rute `/aar/2026` (og evt. tidligere år). Kan også bo som en dashboard-widget i januar.

**Motor.** Ren aggregation over turer og items i det valgte år.

**Sværhedsgrad.** Mellem. Ren logik, men designet skal have karakter for at føles værdifuldt.

**Afhængigheder.** Ingen. §3.3 (GPS-spor) beriger den med kilometer.

---

### 6.4 PDF-eksport af årets feltbog

**Hvad.** Én PDF per år — én side per tur med billeder, feltnoter, vejr-log, pakkeliste, budget. Sat i Fraunces + Inter, klar til at printes.

**Hvorfor.** Passer perfekt til navnet. Noget der ligger på hylden om ti år. Ikke digital nice-to-have.

**Datamodel.** Ingen ændringer.

**UI.** Knap på Årsopgørelse-skærmen. Første udgave via browserens print-dialog med `@media print`-CSS — næsten ingen ny kode.

**Sværhedsgrad.** Lille (browser-print) til stor (rigtig PDF-generering via `pdf-lib` eller lignende).

**Afhængigheder.** §6.3 (Årsopgørelse) er en naturlig hjemmebase.

---

### 6.5 "For et år siden"

**Hvad.** Når en dato krydser en gammel turdato: et lille kort på dashboardet der siger "Den her dag sidste år: 3 nætter i Rold Skov".

**Hvorfor.** Motiverer at åbne appen, skaber kontinuitet, og bygger over tid præcis den slags erindring en fysisk feltbog er lavet til.

**Datamodel.** Ingen ændringer.

**UI.** Ny sektion på dashboardet (over Handlinger, under Næste tur). Vises kun når der er noget at vise.

**Motor.** Filter over ture: samme dag, tidligere år.

**Sværhedsgrad.** Lille.

**Afhængigheder.** Ingen.

---

### 6.6 Sammenligning mellem to ture

**Hvad.** "Sommerlejr 2025 vs. 2026: 400 g lettere, 200 kr billigere, samme antal advarsler."

**Hvorfor.** Data appen har, drejet så det bliver til viden.

**Datamodel.** Ingen ændringer.

**UI.** Fra turlisten: markér 2 ture, klik "Sammenlign". Ny skærm.

**Motor.** Ren diff-logik over vægt, pris, gear, advarsler.

**Sværhedsgrad.** Mellem. Simpel logik men UI'et skal designes.

**Afhængigheder.** Ingen.

---

## 7. Gear-livscyklus

### 7.1 Vedligeholds-log per item

**Hvad.** Imprægnering af tarp, sliben af økse, olie i lygte. Med simple intervaller: "Sidst imprægneret: aug 2025 · næste: aug 2026".

**Hvorfor.** Passer perfekt til `garanti`-mønstret. Fanger den skjulte grund til at gear går i stykker: det bliver ikke passet.

**Datamodel.** På `Item`:
```ts
vedligehold?: {
  handlinger: {
    navn: string;                  // 'Imprægnering'
    sidst_udfoert: string;         // 'MM/ÅÅÅÅ'
    interval_maaneder: number;
    noter?: string;
  }[];
}
```

**UI.** Ny sektion på `ItemDetalje.tsx` under Garanti. Handlinger på dashboardet når noget skal vedligeholdes (samme mønster som §1.2).

**Motor.** Ny type `'vedligehold_forfalder'` i `HandlingsType`.

**Sværhedsgrad.** Mellem. Genbruger meget af garanti-mønstret.

**Afhængigheder.** Ingen.

---

### 7.2 Låne-log

**Hvad.** To små felter på et item: hvem det er udlånt til, og hvornår. Modsat vej: hvem har lånt mig noget.

**Hvorfor.** Emil har lånt sin sovepose ud til Mikkel. Lige nu forsvinder den fra bevidstheden. Filtrerer også pakkelister: "kan ikke tage med — er hos Mikkel".

**Datamodel.** På `Item`:
```ts
udlaan?: {
  person_uid?: string;             // eller fri tekst hvis §2.2 ikke er bygget
  navn: string;
  udlaant_dato: string;
  forventet_retur?: string;
  noter?: string;
}
laant_af?: {
  person_uid?: string;
  navn: string;
  laant_dato: string;
  skal_retur?: string;
}
```

**UI.** Sektion på `ItemDetalje.tsx`. Handling på dashboardet: "Sovepose har været hos Mikkel i 6 uger".

**Motor.** Item med `udlaan` filtreres fra pakkelister med en advarsel.

**Sværhedsgrad.** Lille-mellem. Ligetil.

**Afhængigheder.** Passer perfekt sammen med §2.2 (Person-tabel), men fungerer også som fri tekst.

---

### 7.3 Pris per tur som statistik

**Hvad.** `kr_pr_tur = pris / antal_ture` som ét lille tal på `ItemDetalje.tsx` og i inventar-listen.

**Hvorfor.** Ret enkel udregning der pludselig giver ret meget karakter. TTTM-hængekøjen falder fra 2400 kr første tur til 89 kr efter tur 27.

**Datamodel.** Ingen ændringer.

**Motor.** Ny funktion `krPrTur(item, ture)` i `statistik.ts`.

**UI.** Én linje i brugsstatistik-sektionen på `ItemDetalje.tsx`. Valgfri kolonne på inventar-tabellen (PC).

**Sværhedsgrad.** Trivielt.

**Afhængigheder.** Ingen.

---

### 7.4 "Tabt/skadet" som fjerde status

**Hvad.** Nye status-værdier: `tabt`, `stjaalet`, `slidt_op`. Bevarer historikken uden at slette.

**Hvorfor.** Gør gear-alder-statistikken ærlig. Giver Emil et sted at putte den økse han mistede i Sverige i 2024.

**Datamodel.** `Item.status` udvides:
```ts
status: 'ejer' | 'overvejer' | 'solgt' | 'tabt' | 'stjaalet' | 'slidt_op'
```

**UI.** Nye valg i status-segment på `ItemDetalje.tsx`. Filter-chips i inventar-listen.

**Motor.** Aggregationer i statistik skal beslutte hvad "ejet gear" tæller som — de nye status'er er ikke ejet.

**Sværhedsgrad.** Lille.

**Afhængigheder.** Ingen.

---

### 7.5 Forsikringsrapport

**Hvad.** Én knap: eksportér inventaret som CSV eller PDF med de kolonner et forsikringsselskab beder om — navn, købsdato, købssted, pris, ordrenummer, foto af kvittering. Kan filtreres til "kun ejet over 500 kr".

**Hvorfor.** Engangsting, men når man bliver stjålet fra eller mister noget, sparer det timer.

**Datamodel.** Ingen ændringer.

**UI.** Knap i Indstillinger under "Data".

**Sværhedsgrad.** Lille. CSV er en simpel string-generering. PDF er lidt sværere.

**Afhængigheder.** Ingen.

---

## 8. Overvejer-flowet

### 8.1 Sammenligning af 2-3 kandidater side om side

**Hvad.** En "sammenlign"-tilstand hvor markerede items vises i kolonner: vægt, pris, dimensioner, tags, link, noter.

**Hvorfor.** Overvejer-listen er i dag flad. Beslutninger er ofte "TTTM vs. DD SuperLight vs. Amazonas Ultralight". Samme datamodel, drejet 90 grader.

**Datamodel.** Ingen ændringer.

**UI.** Ny handling i inventar-listen: multi-select + "Sammenlign". Ny skærm der viser de valgte items i kolonner.

**Sværhedsgrad.** Mellem. Ny skærm, men datamodellen findes.

**Afhængigheder.** Ingen.

---

### 8.2 Prishistorik på Overvejer

**Hvad.** Manuelt "opdater pris"-felt på Overvejer-items. Gemmer historik. Handling på dashboardet ved prisfald.

**Hvorfor.** Fundamentet nævner "prishistorik" og "pris ændret på gemt link". Ikke bygget endnu.

**Datamodel.** På `Item`:
```ts
pris_historik?: {
  dato: string;
  pris_kr: number;
}[]
```

**UI.** På `ItemDetalje.tsx` i Overvejer-tilstand: felt "Opdater pris" og en lille graf. Handling på dashboardet ved prisfald over X %.

**Sværhedsgrad.** Lille-mellem. Grafen kan være så simpel som en SVG-linje.

**Afhængigheder.** Ingen.

---

### 8.3 Købsvindue-varsel

**Hvad.** Købsdato + 14 dage = fortrydelsesretten udløber. Lille handling på dashboardet: "TTTM — 4 dage til returretten udløber. Er du tilfreds?"

**Hvorfor.** Købsdato-feltet findes allerede. Ekstra værdi hvis man lige har flyttet noget fra Overvejer til Ejer.

**Datamodel.** Ingen ændringer.

**Motor.** Ny type `'fortrydelsesret'` i `HandlingsType`. Ny filter i `handlinger()`.

**UI.** Ingen ændringer.

**Sværhedsgrad.** Trivielt.

**Afhængigheder.** Ingen.

---

## 9. UX og små forbedringer

### 9.1 Genvejstaster på PC

**Hvad.** `n` = nyt item, `t` = ny tur, `/` = søg, `Esc` = luk detalje.

**Hvorfor.** Små ting, men de gør appen til noget man ejer.

**Datamodel.** Ingen ændringer.

**UI.** Globale keyboard-listeners i `App.tsx`. En genvejstaste-oversigt i Indstillinger.

**Sværhedsgrad.** Lille. En times arbejde inklusive de skjulte kant-tilfælde (fokus i tekstfelter osv.).

**Afhængigheder.** Ingen.

---

### 9.2 Bulk-redigering

**Hvad.** Vælg flere items → tilføj tag, skift status, slet, tilføj til gruppe.

**Hvorfor.** Sparer meget klikkeri når man kommer i gang, eller efter en sæsonopdatering.

**Datamodel.** Ingen ændringer.

**UI.** Multi-select i inventarlisten. Aktion-bar der viser sig når noget er markeret.

**Sværhedsgrad.** Mellem. Ligetil men skal tænkes igennem for at ikke være farlig (bekræftelse på slet).

**Afhængigheder.** Ingen.

---

### 9.3 Fortryd sletning

**Hvad.** Efter sletning: en toast i 25 sekunder med "Fortryd"-knap.

**Hvorfor.** Svarer omtrent til pak-af-tjekket i risikoprofil — 25 sek at ombestemme sig. Enklere end fuld papirkurv.

**Datamodel.** Ingen ændringer i selve tabellerne — det slettede objekt holdes i memory i 25 sek.

**UI.** Toast-komponent nederst. En eksisterende komponent kan sikkert genbruges.

**Motor.** Sletnings-flowet skal opdateres: gem objektet, planlæg endeligt slet efter 25 sek, tilbyd fortryd i mellemtiden.

**Sværhedsgrad.** Lille-mellem. Fanger et vigtigt sikkerhedsnet.

**Afhængigheder.** Ingen.

---

## 10. Sociale og økonomiske

### 10.1 Cost-split på budget

**Hvad.** Simpelt: hvem betalte, hvem skylder hvem. Splitwise-let.

**Hvorfor.** Nævnt som V2 i fundamentet. Naturligt næste skridt efter budget-modulet.

**Datamodel.** På `BudgetLinje`:
```ts
betalt_af?: string;       // person-uid eller deltager-id
deles_med?: string[];     // eller null = alle deltagere
```
Ny funktion i `smartMotor.ts` eller `budget.ts`: `beregnSaldo(tur)` returnerer hvem der skylder hvem hvad.

**UI.** På `Budget`-sektionen i `TurDetalje.tsx`: "betalt af" og "deles med" per linje. Ny sub-sektion "Saldo".

**Sværhedsgrad.** Mellem. Splitwise-algoritmer er velkendte (minimér antal transaktioner).

**Afhængigheder.** §2.2 (Person-tabel) gør det bedre men er ikke krav.

---

### 10.2 Transportregnskab per tur

**Hvad.** Km i bil / tog / færge. Multiplikation med standardfaktorer. Vises pr. tur og aggregeret i statistik.

**Hvorfor.** Ikke moraliseren. Bare data. Passer ind i det eksisterende widget-katalog.

**Datamodel.** På `Tur`:
```ts
transport?: {
  bil_km: number;
  tog_km: number;
  faerge_km: number;
  fly_km: number;
}
```

**UI.** Sektion i `TurDetalje.tsx` under "Budget". Ny statistik-widget "CO2-aftryk".

**Motor.** Ren udregning med kendte faktorer (fx bil ca. 120 g CO2/km, tog ca. 30, fly ca. 250).

**Sværhedsgrad.** Lille.

**Afhængigheder.** Ingen.

---

## Bilag — implementerings-rækkefølge

Hvis alt skulle bygges, ville en rimelig rækkefølge være:

1. **§1.1 Pak-af-tjek** — læringsloopet
2. **§1.2 Flere dashboard-handlinger** — bygger oven på pak-af-tjek
3. **§4.1 Kropsdata og baselines** — motoren bliver personlig i dag
4. **§4.2 Glidende sæsonbaselines** — ren funktion
5. **§4.3 Motor-transparens** — tillid
6. **§2.1 Sted-database** — genbrugsressource
7. **§2.2 Person-tabel** — social vævning
8. **§7.2 Låne-log** — sammen med §2.2
9. **§3.1 På tur-tilstand** — lukker det store hul
10. **§3.2 Afgangs-tjekliste** — samme kontekst
11. **§3.4 Turkort til pårørende** — sikkerhed
12. **§1.3 Foto på turen** — appen bliver menneskelig
13. **§1.4 QR-kode** — praktisk
14. **§6.1 Turlog / feltnoter** — feltbogen bliver til det navnet siger
15. **§7.1 Vedligeholds-log** — genbruger garanti-mønster
16. **§6.3-6.4 Årsopgørelse + PDF** — belønning
17. Resten efter behag.

*Slut på dokumentet.*
