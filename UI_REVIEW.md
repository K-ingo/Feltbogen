# Feltbogen — visuel UI/UX-review

Dato: 4. september 2026. Udgangspunkt: `b0dcdb263c04f9f606d2fe2cfd4bf82d7090dbe0`.

## Konklusion

Feltbogen har allerede et stærkt udgangspunkt: egne turbilleder, Fraunces-overskrifter, topografiske turflader og sprog, der handler om at komme ud. Problemet var især hierarki og læsbarhed: små tekster, gentagne administrative opgaver, meget kompakte kontroller og mobilskærme med dobbelt indvendig afstand. Denne ændring giver naturidentiteten mere plads uden at ændre backend, datamodel eller turenes indhold.

Dette er en implementeret første designiteration, ikke en erklæring om, at alle betingede dialoger og tilstande er færdigtestet. Ændringerne skal gennemgås før produktionsudrulning.

## Designprincipper

1. **Eventyret først.** Næste tur og egne minder har højere visuel prioritet end manglende kvitteringer og rutineopgaver. Akutte grejopgaver forbliver synlige.
2. **Natur uden staffage.** Skovgrøn, mos og varmt papir; brug egne billeder. Bevar eksisterende topografi. Ingen dekorative vejroplysninger eller nye eksterne billedafhængigheder.
3. **Læsbarhed er premium.** Mere kontrast, 16 px brødtekst/felter, tydelige sekundære tekster og minimum 44 px knaphøjde.
4. **Visning til opgaven.** Billedkort til inspiration, kompakt liste til mange ture, tabel til sammenligning af grej på desktop.
5. **Stille feedback.** Korte 140–180 ms tilstandsændringer, ingen pyntende ventetid; respekter reduceret bevægelse.
6. **Fælles komponenter før særtilfælde.** Tokens, navigation, labels, fokus og tomme tilstande løftes samlet.

## Fund, før/efter og implementering

| Område | Før / fund | Implementeret efter | Begrundelse |
| --- | --- | --- | --- |
| Farver | Mørk brun flade og svage små metadata gav et administrativt præg | Skovgrøn mørk palette og varm lys palette med tydeligere teksttokens | Mere ro og friluftsidentitet; bedre skel mellem tekstniveauer |
| Typografi | Mange lokale størrelser på 10–14 px | Fælles størrelsestokens; 16 px brødtekst/felter, 13–14 px sekundære labels; Fraunces bevaret | Konsistens og læsbarhed, især på mobil |
| Navigation | Små tekstbaserede destinationer | Konsistent SVG-stregfamilie, ikon + tekst, 48 px sidebar-rækker, 64 px bundnavigation | Hurtigere genkendelse og større målflader |
| Forside | Flere næsten ens grejopgaver konkurrerede med næste tur og minder | Fremhævet næste-tur-kort, eksisterende mindebillede, inspirerende tekst, foldbar grejomsorg | Turen er hovedhistorien; akutte opgaver åbner fortsat automatisk |
| Ture | Små billeder, ISO-lignende datoer og ingen søgning | Fotokort, danske datointervaller, status/antal/nætter, søgning på navn og sted, Kort/Liste | Skalerer bedre fra få ture til et langt arkiv |
| Mange ture | Store gentagne kort er langsomme at skimme | Kompakt alternativ og lavere kompasflade på ture uden billeder | Mindre scroll uden at fjerne inspirerende kortvisning |
| Grej | Tæt tabel, meget små labels, sorteringsoverskrifter primært musestyrede | Mere læsbare metadata, hover, native sorteringsknapper med aria-sort, fokuserbar navneknap | Sammenligning og tastaturbrug forbedres |
| Tomme grejlister | Generisk besked uden næste skridt | Konteksttekst for Ejer/Indkøb/Solgt/Lån/Vedligehold; relevante CTA'er eller ryd filtre | En tom liste skal forklare situationen, ikke ligne en fejl |
| Mobil detaljer | Ydre og indre padding blev lagt sammen | Detailpadding nulstilles inden for skallen; selvstændige sider beholder padding | Mere brugbar bredde til lange navne og formularer |
| Pakkeliste | Små blå standardchecks og svage gennemstregede navne | 22 px accentfarvede checks, større rækker, læsbare pakkede navne og kort check-animation | Listen skal kunne aflæses, også når alt er pakket |
| Turfaner | Flere faner optog ekstra højde på mobil | En vandret scrollbar fanerække og tastaturbetjening med pile/Home/End | Mere plads til indhold; bevarer alle destinationer |
| Formularer | Flere fælles labels var ikke programmatisk koblet til felter | useId + htmlFor for fælles felter, dropdowns og tekstområder; loginlabels koblet | Bedre fokusadfærd og tilgængelige navne |
| Klikbare kort | Flere div-rækker var kun klikbare med mus | Knaprolle, tabstop og Enter/Space for fælles klikbare rækker | Tastaturbrug uden at omlægge datalogik |
| Indstillinger | Lang tekst og grid-minimum gav intern vandret scroll på 320 px | Begrænset desktopbredde, minmax(0,1fr), ombrydning af servertekst og smalle felter | Ingen unødvendig sideværts læsning |
| Loading/feedback | Primært statisk ventetekst | Let skeleton/status, hover/tryk og reduced-motion-regler | Hurtig og afdæmpet feedback |

## Gennemgang og dækningsgrad

Liveappen blev undersøgt, og den eksisterende testkonto blev brugt i en lokal frontend-preview med samme API. Eksisterende kontoindhold blev ikke bevidst redigeret, slettet eller delt. En separat lokal, ikke-indlogget browserorigin blev brugt til tomme formularer og syntetiske data. Ingen testdata skal synkroniseres til en rigtig konto.

| Område | Gennemgang |
| --- | --- |
| Hjem | Konto med historik og tom lokal profil; mobil og desktop |
| Ture | Kontoens ture samt 60 syntetiske ture; kort, liste, søgning og nul resultater |
| Turdetaljer | Overblik, Pakning, Pakkeliste, Deltagere, Undervejs og Praktisk besøgt |
| Pakkeliste | Fyldt liste med 24 ting; eksisterende afkrydsninger bevaret |
| Grej | Konto med 40 poster samt 160 syntetiske poster; desktoptabel og mobil |
| Grejdetaljer | Eksisterende grej og felternes hierarki undersøgt på mobil |
| Opret grej / tur | Tomme formularer undersøgt på separat lokal profil; unavngivne kladder forladt |
| Lån | Tom låneformular undersøgt på en midlertidig lokal grejkladde |
| Folk | Konto med personer; fælles komponenter og formularer undersøgt |
| Mere / indstillinger | Menu, indstillinger, import, hjælpetekster og mobilbredde undersøgt |
| Steder / statistik | Lister og konkrete sted-/statistikskærme besøgt |
| Deling / QR / gæster | Komponentkode og typografi gennemgået; ingen nye offentlige delinger oprettet. Fuld ende-til-ende gæste-/QR-test udestår |
| Alle dialoger / alle empty states | Ikke udtømmende manuelt dækket. Fælles komponenter forbedret; sjældne fejl-, bekræftelses- og rettighedstilstande kræver en særskilt gennemgang |

## Kvalitetssikring

- TypeScript: `tsc -b --pretty false` bestået.
- ESLint: `eslint src` bestået.
- Vitest: 50 testfiler, 1.117 tests bestået, inklusive fem nye tests for tursøgning.
- Produktionsbuild gennem Vites API med projektets konfiguration bestået. Den lokale Windows-sandbox krævede indlæsning af konfigurationen uden CLI-bundling. Ingen projekt-buildscripts er ændret af den grund.
- Windows-importtvetydigheder mellem Personer/personer og FoersteTur/foersteTur er gjort eksplicitte med `.tsx` på UI-importerne.
- Browserkontrol ved 1280 px desktop, 390 px mobil og 320 px smal mobil. Skærmbilleder og måling af faktisk overflow bruges sammen; dokumentbredden alene opdager ikke indvendig scrolling.
- Søgning med flere ord, fx `kysten 60`, returnerer den forventede ene tur blandt 60.
- Egne fotos og eksisterende data er bevaret. Ingen nye backendfunktioner, datamigrationer eller billedtjenester.

### Begrænsninger

Mobilvisning er en desktopbrowser med ændret viewport, ikke en fysisk iPhone/Android. Sollys, handsker, én-håndsbetjening, VoiceOver/TalkBack, browserzoom, printerlayout og reduced-motion på en rigtig enhed er ikke fuldt afprøvet. Den visuelle browserkontrol er primært i mørkt tema; den lyse palette skal også have separat visuel accept. De automatiske tests er ikke en komplet visuel regressionssuite eller en WCAG-certificering.

## Senere anbefalinger, prioriteret

1. **P1 — Fysisk feltprøve.** Test lys/mørk tilstand ude, stor systemtekst, 200 % zoom og pakning med én hånd. Kontroller kontrast også på badges, fotos og disabled states.
2. **P1 — Dialog- og tilgængelighedspas.** Inventér samtlige modaler, delings-/QR-flow, native bekræftelser og fejltilstande. Kontroller fokusfælde, retur-fokus, Escape, labels og tabpanelrelationer. De fælles rettelser erstatter ikke dette.
3. **P1 — Grejfiltre på små skærme.** Saml sjældent brugte filtre i en tilgængelig filterdialog med aktivt antal, hvis feltprøven bekræfter for meget vertikal plads. Bevar hurtige statusvalg.
4. **P2 — Indstillinger i kortere kapitler.** Del konto, synkronisering og skabeloner visuelt; læg teknisk forklaring bag «Sådan virker det». Bevar adgang til fejlinformation.
5. **P2 — Tomme tilstande med variation.** Behold fælles kompas som grundform; giv tur, sted og grejsæt hver sin diskrete kodebaserede naturillustration. Undgå samme store illustration gentaget gennem et helt arkiv.
6. **P2 — Ensartede ikoner overalt.** Navigation og empty states har nu en fælles stregfamilie. Udvid til sekundære handlinger, og fjern ad hoc-symboler efter en komplet inventering.
7. **P2 — Turarkivets grupper.** Overvej år/sæson og visningspræference, når reel brug af Kort/Liste er observeret. Ingen ny datamodel er nødvendig for første iteration.
8. **P2 — Regressionstest.** Etablér faste billedtests af de centrale skærme ved 320/390/768/1280 px, begge temaer og syntetiske fyldte/tomme data.

## Screenshots og privatliv

Før/efter-billeder er leveret separat sammen med den lokale rapport. Skærmbilleder med kontoens personer, tursteder og billeder offentliggøres ikke i dette offentlige repository. Testlogin, adgangskoder, tokens, lokale databaser og syntetiske importer indgår ikke i ændringen.
