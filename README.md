# Feltbogen

Dansk friluftsapp der holder styr på gear-inventar, planlægger ture med smarte
forslag, og lærer over tid. Offline-first — nettet bruges kun til vejrudsigt,
sync og deling.

Se [`feltbogen_fundament`](./feltbogen_fundament) for den fulde specifikation:
datamodel, skærme, kerne-koncepter og de beslutninger der ligger bag.

## Kom i gang

```bash
npm install
npm run dev        # udviklingsserver
npm run build      # typecheck + produktionsbuild
npm run lint       # eslint
npm test           # vitest, én kørsel
npm run test:watch # vitest i watch-tilstand
```

Lint, test og build kører automatisk på alle pull requests.

## Arkitektur

Offline-first: alt skrives til IndexedDB først, og synkroniseres derefter til
PocketBase. Fejler netværket, står dataen stadig lokalt og sendes op næste gang
appen starter.

| Lag | Fil | Ansvar |
|---|---|---|
| Datamodel | `src/db.ts` | Dexie-schema og typerne `Item`, `Gruppe`, `Tur` |
| Sync | `src/sync.ts` | CRUD mod IndexedDB + PocketBase, og oprydning af det der ikke nåede op |
| Auth | `src/pb.ts`, `src/useAuth.ts` | PocketBase-klient og login-tilstand |
| Domænelogik | `src/smartMotor.ts` | Vejr, forbrugsberegning, kompatibilitets-advarsler, gruppeforslag, stedsøgning |
| Statistik | `src/statistik.ts` | Aggregeringer over inventar og ture |
| UI-primitiver | `src/ui.tsx`, `src/layout.ts` | Knap, Kort, Felt, Chip, Badge, listerækker, detalje-header |
| Skærme | `src/App.tsx` m.fl. | Inventar, Grupper, Ture, Statistik |

Hver post har et `pb_id`: er det sat, findes posten i PocketBase; er det tomt,
er den kun lokal endnu.

Sletninger bruger tabellen `slettede` som spor. Kan PocketBase ikke nås når man
sletter, bliver postens `pb_id` liggende der, indtil serveren har bekræftet
sletningen. Sporet gør to ting: det holder posten ude af `hentFraPocketBase()`,
så den ikke bliver hentet tilbage, og det får `sendAltUsendt()` til at prøve
sletningen igen ved næste opstart.

### Tests

`npm test` kører uden browser og uden server. Dexie får et IndexedDB af
`fake-indexeddb`, og `src/test/pbMock.ts` erstatter PocketBase med en
hukommelsesbaseret udgave, der kan sættes `offline` for at teste at data
overlever manglende forbindelse.

## Eksterne tjenester

- **PocketBase** — sync og konti. URL sættes med `VITE_PB_URL` (se `.env.example`).
- **open-meteo.com** — vejrudsigt og geocoding. Gratis, ingen nøgle.
- **api.dataforsyningen.dk (DAWA)** — danske adresser og stednavne. Gratis, ingen nøgle.

## Status

V1 under udvikling. Bygget: inventar, grupper, ture med smart-motor, statistik.
Endnu ikke bygget: PWA-opsætning (service worker + manifest), deling og
gæsteview, dashboard, badges/notifikationer, pak-af-tjek, indstillinger.
