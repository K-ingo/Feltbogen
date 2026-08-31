# Kode-review og optimeringsrapport for Feltbogen

Dette dokument giver et samlet overblik over koden på `main`-grenen i Feltbogen-projektet. Rapporten dækker arkitektur, fejlsøgning (bugs og edge cases), optimeringsforslag samt en forklaring af de gennemførte rettelser.

---

## 1. Overordnet arkitektur & struktur

Feltbogen er en velstruktureret, offline-first React + TypeScript applikation.
- **Lokal lagring:** Dexie.js (IndexedDB) benyttes som primær datakilde for hurtig, offline adgang.
- **Synkronisering:** PocketBase benyttes som backend for synkronisering og gæstedeling.
- **Reaktivitet:** `dexie-react-hooks` (`useLiveQuery`) bruges til at opdatere UI automatisk ved databasewrites.
- **Test-dækning:** Omfattende testsuite med Vitest (`fake-indexeddb` + PocketBase-mock).

---

## 2. Fejlsøgning: Fundne fejl, bugs og edge cases

Under gennemgangen af koden blev følgende konkrete fejl og uhensigtsmæssigheder identificeret:

### Bug 1: Ufuldstændig optælling i `usendtAntal()` (`src/sync.ts`)
- **Problem:** `usendtAntal()` optalte kun usendte ændringer i `items`, `grupper`, `ture` og `slettede`.
- **Konsekvens:** Ændringer og oprettelser i `steder`, `personer` og `billeder` blev ikke talt med. Brugeren kunne i Indstillinger eller på Dashboardet se "0 usendte ændringer" og tro, det var sikkert at lukke appen eller gå offline, selvom der stadig var usendte steder, personer eller billeder i køen.
- **Løsning:** Opdateret `usendtAntal()` til også at tælle usendte rækker i `steder`, `personer` og `billeder`.

### Bug 2: Manglende `usendt_aendring: true` ved `opret()` (`src/sync.ts`)
- **Problem:** Når nye poster oprettes lokalt via `opret()`, blev posten tilføjet til IndexedDB uden eksplicit at sætte `usendt_aendring: true` (i modsætning til `opdater()` og `genopret()`).
- **Konsekvens:** Hvis enheden var offline under oprettelsen (hvorfor `synkroniser()` fejler), forblev posten i IndexedDB med `usendt_aendring: undefined`. Ved en efterfølgende konflikt/fletning i `fletNed()` kunne posten blive opfattet som værende uændret lokalt (`!lokal.usendt_aendring` var true).
- **Løsning:** Sat `usendt_aendring: true` direkte i `opret()` ved tilføjelse til IndexedDB.

### Bug 3: Risiko for tab af lokal billed-`blob` i `tagServerens()` (`src/sync.ts`)
- **Problem:** For samlingen `billeder` returnerer `fraPb()` et objekt hvor `blob` og `original_blob` er `null`, da billeddata hentes via URL'er frem for at downloade hele galleriet ved sync. Hvis `tagServerens()` blev kaldt for et billede, ville `Object.assign(gemt, fraServer, ...)` overskrive billedets eksisterende lokale `blob` med `null`.
- **Konsekvens:** Hvis et billede endnu ikke var færdiguploadet eller blev opdateret med serverdata, risikerede man at miste den lokale `blob`, før den var nået op på serveren.
- **Løsning:** Tilføjet en sikring i `tagServerens()`, så en eksisterende lokal `blob` og `original_blob` bevares, hvis servermodellen har dem som `null`.

### Bug 4: Edge case ved 0 eller ugyldigt deltagerantal i `beregnForbrug()` (`src/smartMotor.ts`)
- **Problem:** Hvis en tur af en eller anden grund havde `personer: 0` eller et negativt/ugyldigt tal, ville forbrugsberegningerne (vand, mad, gas) returnere 0 uden at advare brugeren.
- **Løsning:** Tilføjet `Math.max(1, tur.personer || 1)` for at garantere et gyldigt, positivt deltagerantal på mindst 1 person i beregningerne.

---

## 3. Optimeringsforslag (Performance & Best Practices)

1. **Undgå unødige tabel-scans ved baggrundssynkronisering (`delesnapshot.ts`):**
   - Ved hver lokal skrivning udskydes en friskning af delte snapshots. Det blev sikret, at der udføres tidlig `return 0`, hvis der ikke findes nogen delte ture, så tunge `toArray()` kald på alle tabeller undgås.
2. **Udvidet testdækning for offline/sync edge cases:**
   - Tilføjet automatisk testdækning i `sync.test.ts` for optælling af usendte ændringer i alle 6 synkroniserbare samlinger samt for oprettelsesflag og billedblob-bevarelse.
3. **Type-sikkerhed & Fejlhåndtering:**
   - Sikret konsistent brug af guard clauses og fallbacks, så potentielt ugyldige brugerinput eller serverdata håndteres skånsomt uden unhandled promise rejections eller hvide skærme.

---

## 4. Konklusion

Med disse rettelser og optimeringer er Feltbogen endnu mere robust som offline-first applikation. Synkroniseringskøen er præcis, lokale mediefiler er beskyttet mod utilsigtet overskrivning, og forbrugsberegningerne håndterer alle kanttilfælde.
