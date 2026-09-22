import { useState, useRef, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, etiket, PAK_AF_NIVEAU, AKTIVITETSNIVEAU } from './db';
import {
  saet,
  useValg,
  useTekst,
  useKropsdata,
  AFGANGS_SKABELON,
  PAK_AF_NIVEAU_VALG,
  KROPSVAEGT,
  AKTIVITETSNIVEAU_VALG,
  DAGLIG_KALORIE
} from './indstillinger';
import { logUd, gemNavn } from './pb';
import { hentNyesteUdgave, byggetekst } from './opdatering';
import { useAuth } from './useAuth';
import { afstemMedServer, fjernDubletter, usendtAntal, uidFeltMangler } from './sync';
import { serveradresse, tjekForbindelse } from './pb';
import { useSyncfejl, fejltekst, laesSeneste, synckvittering } from './syncfejl';
import { useErOnline } from './useMedie';
import { datoTekst } from './datotekst';
import {
  lavSikkerhedskopi,
  tilJson,
  laesSikkerhedskopi,
  fletInd,
  filnavn,
  KopiFejl
} from './dataudveksling';
import type { Baseindhold } from './dataudveksling';
import { Skal } from './Skal';
import type { Indstillingsmaal } from './indstillingsmaal';
import type { Fane } from './Skal';
import { laesSkabelon, skrivSkabelon, STANDARD_SKABELON } from './afgangsTjek';
import {
  Felt,
  FjernKnap,
  Knap,
  Segment,
  SektionsTitel
} from './ui';

interface Props {
  fane: Fane;
  skift: (f: Fane) => void;
  tilLogin: () => void;
  seRundvisning: () => void;
  // Afsnittet man skal lande i, når man kommer fra en række under Mere.
  // Se indstillingsmaal.ts.
  maal?: Indstillingsmaal;
}

type Besked = { slags: 'ok' | 'fejl'; tekst: string } | null;

function IndstillingerSide({ fane, skift, tilLogin, seRundvisning, maal }: Props) {
  // Ruller det, man er sendt efter, ind på skærmen — én gang, og først når
  // afsnittet faktisk står der.
  const sigtRef = useRef<HTMLElement | null>(null);
  const harRullet = useRef(false);
  useEffect(() => {
    if (!maal || harRullet.current || !sigtRef.current) return;
    harRullet.current = true;
    sigtRef.current.scrollIntoView({ block: 'start', behavior: 'smooth' });
  });

  const sigte = (m: Indstillingsmaal) => (maal === m ? sigtRef : undefined);

  const { bruger } = useAuth();

  const [arbejder, setArbejder] = useState<string | null>(null);
  const [syncBesked, setSyncBesked] = useState<Besked>(null);
  const [dataBesked, setDataBesked] = useState<Besked>(null);
  const [navnBesked, setNavnBesked] = useState<Besked>(null);
  const filvaelger = useRef<HTMLInputElement>(null);

  const items = useLiveQuery(() => db.items.toArray()) ?? [];
  const grupper = useLiveQuery(() => db.grupper.toArray()) ?? [];
  const ture = useLiveQuery(() => db.ture.toArray()) ?? [];
  const steder = useLiveQuery(() => db.steder.toArray()) ?? [];
  const personerIBasen = useLiveQuery(() => db.personer.toArray()) ?? [];
  // Tælles om når basen ændrer sig, så tallet ikke står og lyver efter en sync.
  const usendt = useLiveQuery(usendtAntal, [], 0);
  const syncfejl = useSyncfejl();
  const online = useErOnline();
  const pakAfNiveau = useValg(PAK_AF_NIVEAU_VALG, PAK_AF_NIVEAU, 'let');
  const krop = useKropsdata();
  const afgangsSkabelon = laesSkabelon(useTekst(AFGANGS_SKABELON));

  const synkroniser = async () => {
    setArbejder('sync');
    setSyncBesked(null);
    try {
      await afstemMedServer();
      // Køen alene kan ikke svare på, hvordan det gik: den tæller kun det, der
      // skal op, og er tom uanset om hentningen ned lykkedes. Fejlen læses
      // derfor efter kørslen og vejer tungest — reglen ligger i syncfejl.ts.
      setSyncBesked(synckvittering(await usendtAntal(), await laesSeneste()));
    } catch {
      setSyncBesked({ slags: 'fejl', tekst: 'Kunne ikke få fat i serveren.' });
    }
    setArbejder(null);
  };

  // Spørger serveren, om den er der.
  //
  // Sync kan kun sige noget, når der er noget at sende: er køen tom, og virker
  // det alligevel ikke, sagde skærmen før ingenting. Det her kan trykkes når
  // som helst og svarer på det ene spørgsmål, alt andet hænger på — om appen
  // og PocketBase overhovedet kan nå hinanden. Se pb.ts.
  const tjekServer = async () => {
    setArbejder('tjek');
    setSyncBesked(null);
    const svar = await tjekForbindelse();
    setSyncBesked({ slags: svar.ok ? 'ok' : 'fejl', tekst: svar.tekst });
    setArbejder(null);
  };

  const rydDubletter = async () => {
    setArbejder('dubletter');
    setSyncBesked(null);
    const antal = await fjernDubletter();
    setSyncBesked({
      slags: 'ok',
      tekst: antal === 0 ? 'Ingen dubletter fundet.' : `${antal} ${antal === 1 ? 'dublet' : 'dubletter'} ryddet op.`
    });
    setArbejder(null);
  };

  // Alt der hører med i en kopi. Ét sted, så eksport og import ikke kan komme
  // til at dække hver sit.
  const base = { items, grupper, ture, steder, personer: personerIBasen };

  const eksporter = () => {
    const json = tilJson(lavSikkerhedskopi(base));
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));

    const link = document.createElement('a');
    link.href = url;
    link.download = filnavn();
    link.click();
    URL.revokeObjectURL(url);

    setDataBesked({ slags: 'ok', tekst: `${poster(antalIBasen(base))} gemt i ${link.download}.` });
  };

  const importer = async (fil: File) => {
    setArbejder('import');
    setDataBesked(null);
    try {
      const kopi = laesSikkerhedskopi(await fil.text());
      const flettet = fletInd(kopi, base);

      await db.transaction('rw', db.items, db.grupper, db.ture, db.steder, db.personer, async () => {
        await db.items.bulkAdd(flettet.items);
        await db.grupper.bulkAdd(flettet.grupper);
        await db.ture.bulkAdd(flettet.ture);
        await db.steder.bulkAdd(flettet.steder);
        await db.personer.bulkAdd(flettet.personer);
      });

      setDataBesked({
        slags: 'ok',
        tekst: flettet.tilfoejet === 0
          ? 'Alt i filen fandtes allerede. Intet blev tilføjet.'
          : `${poster(flettet.tilfoejet)} tilføjet${flettet.fandtes > 0 ? `, ${flettet.fandtes} fandtes i forvejen` : ''}.`
      });
    } catch (e) {
      setDataBesked({
        slags: 'fejl',
        tekst: e instanceof KopiFejl ? e.message : 'Filen kunne ikke læses.'
      });
    }
    setArbejder(null);
  };

  return (
    <Skal
      fane={fane}
      skift={skift}
      titel="Indstillinger"
      // Samme sætning som rækken under Mere fører ind med, så man kan se, at
      // man er landet der, hvor man trykkede hen. Referencen skriver den
      // også ud under titlen.
      undertitel="Konto, din krop og det der gælder hele appen"
    >
      {/* Afsnittene står i én spalte under titlen. Loftet er smallere end
          hovedspalten, fordi en indstillingsrække skal kunne læses fra etiket
          til værdi i ét blik — men den er venstrestillet og ikke centreret:
          centreret lå kortene en tomme inde under deres egen overskrift. */}
      <div className="settings-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '24px', maxWidth: '720px' }}>

        <section ref={sigte('konto')}>
          <SektionsTitel>Konto</SektionsTitel>
          <Kort>
            {bruger ? (
              <>
                <Raekke label="E-mail" vaerdi={bruger.email} maerke="Logget ind" />
                <Navnefelt
                  start={bruger.name ?? ''}
                  // Svaret siger, om navnet nåede op. Feltet skal vide det:
                  // først når serveren har taget imod, er det gemte navn et
                  // andet — og først der må advarslen om det tomme navn gå væk.
                  gem={async (v) => {
                    try {
                      await gemNavn(v);
                      setNavnBesked({ slags: 'ok', tekst: 'Navnet er gemt.' });
                      return true;
                    } catch {
                      setNavnBesked({ slags: 'fejl', tekst: 'Kunne ikke gemme navnet.' });
                      return false;
                    }
                  }}
                />
                {navnBesked && <Kvittering besked={navnBesked} />}
                <div style={{ marginTop: '12px' }}>
                  <Knap variant="fare" onClick={logUd}>Log ud</Knap>
                </div>
                <Hjaelp>
                  Data bliver liggende på denne enhed når du logger ud. Log ind igen for at
                  synkronisere videre.
                </Hjaelp>
              </>
            ) : (
              <>
                <div style={{ fontSize: 'var(--skrift-knap)', color: 'var(--tekst)', lineHeight: 1.5 }}>
                  Ikke logget ind — alt gemmes kun lokalt på denne enhed.
                </div>
                <div style={{ marginTop: '12px' }}>
                  <Knap variant="primaer" onClick={tilLogin}>Log ind eller opret konto</Knap>
                </div>
                <Hjaelp>
                  Med en konto kan du synkronisere mellem enheder, dele ture med gæster og
                  få dine data igen hvis enheden bliver væk. Det du allerede har lavet,
                  bliver sendt op når du logger ind.
                </Hjaelp>
              </>
            )}
          </Kort>
        </section>

        <section ref={sigte('synkronisering')}>
          <SektionsTitel>Synkronisering</SektionsTitel>
          <Kort>
            <Raekke
              label="Venter på at blive sendt"
              vaerdi={usendt === 0 ? 'Intet' : `${usendt} ${usendt === 1 ? 'ændring' : 'ændringer'}`}
              fremhaev={usendt > 0}
            />
            {/* Adressen står her, fordi en forkert værdi ellers er usynlig:
                appen opfører sig ens, den ringer bare til den forkerte server.
                En .env på maskinen eller en variabel i udrulningen kan sætte
                den, og så er det her, det kan ses. */}
            <Raekke label="Server" vaerdi={serveradresse()} />

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
              {/* Outline og ikke fyldt accent. Skærmens ene fyldte knap er
                  "Gem navn", og den tænder kun, når der er et rettet navn at
                  gemme — stod sync'en fyldt, ville der være to i samme
                  skærmbillede i præcis det øjeblik, man havde rettet noget.
                  Knappen er stadig den første af de tre og gør det samme;
                  synkroniseringen kører i forvejen af sig selv. */}
              <Knap onClick={synkroniser} disabled={arbejder !== null}>
                {arbejder === 'sync' ? 'Synkroniserer…' : 'Synkronisér nu'}
              </Knap>
              <Knap onClick={tjekServer} disabled={arbejder !== null}>
                {arbejder === 'tjek' ? 'Tjekker…' : 'Tjek forbindelsen'}
              </Knap>
              <Knap onClick={rydDubletter} disabled={arbejder !== null}>
                {arbejder === 'dubletter' ? 'Rydder op…' : 'Ryd dubletter'}
              </Knap>
            </div>

            <Kvittering besked={syncBesked} />

            {/* Den seneste fejl, hvis der var en. Baggrundssync fangede sine
                fejl og skrev dem i konsollen — hvor ingen kigger. Se
                syncfejl.ts. */}
            {syncfejl && (
              <Advarsel>
                {fejltekst(syncfejl.art, online)}
                {/* Hvilken post og hvilken samling. Uden den her siger
                    advarslen at noget blev afvist, og ikke hvad — og så er der
                    ikke noget at gå efter i PocketBase. Se syncfejl.ts. */}
                {syncfejl.hvor && (
                  <div style={{ marginTop: '6px', opacity: 0.8 }}>
                    Det gik galt under {syncfejl.hvor}.
                  </div>
                )}
                {syncfejl.detalje && (
                  <div style={{ marginTop: '6px', opacity: 0.8 }}>
                    Serveren sagde: {syncfejl.detalje}
                  </div>
                )}
                {/* Feltet serveren pegede på. Det er den ene linje, der siger
                    hvad der mangler i skemaet. */}
                {syncfejl.felter && (
                  <div style={{ marginTop: '6px', opacity: 0.8 }}>
                    Felter: {syncfejl.felter}
                  </div>
                )}
                {syncfejl.hvornaar && (
                  <div style={{ marginTop: '6px', opacity: 0.8 }}>
                    Sidst forsøgt {datoTekst(syncfejl.hvornaar)}
                  </div>
                )}
              </Advarsel>
            )}

            {uidFeltMangler() && (
              <Advarsel>
                PocketBase gemmer ikke feltet <code>uid</code>. Tilføj et tekstfelt ved navn
                <code> uid</code> til samlingerne <code>items</code>, <code>grupper</code> og
                <code> ture</code>. Uden det kan to enheder ikke blive enige om hvilken post
                der er hvilken, og grej bliver hentet ned igen som dubletter.
              </Advarsel>
            )}

            <Hjaelp>
              Alt gemmes først på enheden og sendes derefter op. Er du uden dækning, bliver
              ændringerne liggende og går op af sig selv når forbindelsen er tilbage.
            </Hjaelp>
          </Kort>
        </section>

        <section>
          <SektionsTitel>Din krop</SektionsTitel>
          <Afsnitstekst>
            Bruges til at foreslå vægt og forbrug på turene. Tallene bliver på denne
            enhed og deles aldrig med gæster på dine ture.
          </Afsnitstekst>
          <Kort>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' }}>
              <Felt
                label="Din vægt"
                type="number"
                value={krop.kropsvaegt_kg ?? ''}
                onChange={(v) => void saet(KROPSVAEGT, v)}
                hjaelp="kg"
              />
              <Felt
                label="Kalorier pr. dag"
                type="number"
                value={krop.daglig_kalorie ?? ''}
                onChange={(v) => void saet(DAGLIG_KALORIE, v)}
                hjaelp="valgfrit"
              />
            </div>

            <div style={{ marginTop: '12px' }}>
              <div style={{ fontSize: 'var(--skrift-lille)', color: 'var(--tekst-dæmpet)', marginBottom: '8px' }}>
                Aktivitetsniveau
              </div>
              {/* Stille: det valgte tegnes på accent-fladen og ikke i den
                  fyldte accent. Det er en oplysning om kroppen — den skal
                  kunne ses, men den er ikke det, man er kommet for at trykke
                  på. Samme rettelse som "Sover typisk i" under Folk. */}
              <Segment
                vaerdier={AKTIVITETSNIVEAU}
                valgt={krop.aktivitetsniveau ?? 'middel'}
                vaelg={(n) => void saet(AKTIVITETSNIVEAU_VALG, n)}
                formater={(n) => etiket(n)}
                stille
              />
            </div>

            <Hjaelp>
              Bruges til at regne vand og mad ud på turene. Uden dem regner motoren med
              en person på 75 kg — en 65-kilos vandrer og en 95-kilos bushcrafter med
              bålmad drikker ikke det samme. Skriver du et kaloriebehov ind, bruges det
              i stedet for skønnet over maden.
            </Hjaelp>
          </Kort>
        </section>

        <section ref={sigte('skabeloner')}>
          <SektionsTitel>Afgangs-tjek</SektionsTitel>
          <Kort>
            <Skabelon
              linjer={afgangsSkabelon}
              gem={(l) => void saet(AFGANGS_SKABELON, skrivSkabelon(l))}
              nulstil={() => void saet(AFGANGS_SKABELON, skrivSkabelon([...STANDARD_SKABELON]))}
            />
            <Hjaelp>
              Skabelonen bruges når du laver et afgangs-tjek på en tur. Retter du den
              bagefter, flettes de nye punkter ind på turene uden at røre det du allerede
              har krydset af — og uden at fjerne det du selv har skrevet på turen.
            </Hjaelp>
          </Kort>
        </section>

        <section>
          <SektionsTitel>Pak-af-tjek</SektionsTitel>
          <Kort>
            <div style={{ fontSize: 'var(--skrift-lille)', color: 'var(--tekst-dæmpet)', marginBottom: '8px' }}>
              Niveau på nye tjek
            </div>
            <Segment
              vaerdier={PAK_AF_NIVEAU}
              valgt={pakAfNiveau}
              vaelg={(n) => void saet(PAK_AF_NIVEAU_VALG, n)}
              stille
            />
            <Hjaelp>
              Let er tre knapper pr. stykke grej — brugt, ubrugt, gik i stykker. Grundig
              lægger en note pr. item oveni, plus en vurdering af om der var for meget
              eller for lidt med i hver kategori. Niveauet kan skiftes undervejs på den
              enkelte tur.
            </Hjaelp>
          </Kort>
        </section>

        <section ref={sigte('data')}>
          <SektionsTitel>Data</SektionsTitel>
          <Kort>
            <Raekke label="Grej" vaerdi={`${items.length}`} />
            <Raekke label="Grupper" vaerdi={`${grupper.length}`} />
            <Raekke label="Ture" vaerdi={`${ture.length}`} />
            <Raekke label="Steder" vaerdi={`${steder.length}`} />
            <Raekke label="Personer" vaerdi={`${personerIBasen.length}`} />

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '14px' }}>
              <Knap onClick={eksporter}>Gem en kopi</Knap>
              <Knap onClick={() => filvaelger.current?.click()} disabled={arbejder !== null}>
                {arbejder === 'import' ? 'Læser…' : 'Læs en kopi ind'}
              </Knap>
            </div>

            <input
              ref={filvaelger}
              type="file"
              accept="application/json,.json"
              style={{ display: 'none' }}
              onChange={(e) => {
                const fil = e.target.files?.[0];
                // Nulstilles, så den samme fil kan vælges igen bagefter.
                e.target.value = '';
                if (fil) void importer(fil);
              }}
            />

            <Kvittering besked={dataBesked} />

            <Hjaelp>
              Kopien er en JSON-fil med dit grej, dine grupper, ture, steder og personer.
              Billedfiler er ikke med. Når du læser en kopi ind, bliver der kun lagt til —
              poster du allerede har, bliver ikke rørt.
            </Hjaelp>
          </Kort>
        </section>

        <section ref={sigte('om')}>
          <SektionsTitel>Om</SektionsTitel>
          <Kort>
            <Raekke label="Feltbogen" vaerdi={`version ${__APP_VERSION__} · ${__APP_COMMIT__}`} />
            <Raekke label="Denne udgave er bygget" vaerdi={byggetekst()} />
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
              <Knap onClick={seRundvisning}>Se rundvisningen igen</Knap>
              <Knap onClick={() => void hentNyesteUdgave()}>Hent nyeste udgave</Knap>
            </div>
            <Hjaelp>
              Appen ligger i cache, så den kan startes uden dækning. En ny
              udgave slår derfor først igennem ved en senere indlæsning — her
              kan du hente den med det samme.
            </Hjaelp>
          </Kort>
        </section>

      </div>
    </Skal>
  );
}

// ─────────────────────────────────────────────
// Byggeklodser
// ─────────────────────────────────────────────

// Navnet er det de andre ser på en delt tur — og det, startskærmen hilser med
// om morgenen. Det gemmes med en knap og ikke pr. tastetryk: hvert gem er et
// kald til serveren.
//
// Knappen er skærmens eneste fyldte accent, og den er det kun, når der er
// noget at gemme: et navn, der både er rettet og ikke er tomt. Resten af
// tiden står den som en slukket outline. Reglen står i docs/design/TOKENS.md
// og i handoff'en "Ejer Indstillinger · desktop" — én fyldt primary pr.
// skærmbillede, og den skal betyde noget.
//
// Tomt er ikke en gyldig værdi. Feltet kunne gemmes tomt: man ryddede det,
// knappen tændte — teksten var jo en anden end den gemte — og bagefter stod
// man som «Uden navn» på sine egne ture, mens gæstesiden ikke kunne skrive,
// hvem turen var fra. Nu slår et tomt felt knappen fra og siger hvorfor.
function Navnefelt({ start, gem }: { start: string; gem: (v: string) => Promise<boolean> }) {
  // Det navn, serveren har. Det er ikke det samme som feltets indhold, og det
  // er det, advarslen og "er der rettet noget?" skal måles imod.
  const [gemt, setGemt] = useState(start.trim());
  const [navn, setNavn] = useState(start);
  const [gemmer, setGemmer] = useState(false);

  const vaerdi = navn.trim();
  const tomt = vaerdi === '';
  const rettet = vaerdi !== gemt;
  const klar = rettet && !tomt && !gemmer;

  const gemNu = async () => {
    setGemmer(true);
    // Først når det nåede op, er det gemte navn et andet. Gik det galt, står
    // feltet som man skrev det, og knappen er der stadig at trykke på igen.
    if (await gem(vaerdi)) setGemt(vaerdi);
    setGemmer(false);
  };

  return (
    <div style={{ marginTop: '14px' }}>
      <Felt
        label="Dit navn"
        value={navn}
        onChange={setNavn}
        placeholder="Fx Emil"
        {...(tomt
          ? { fejl: 'må ikke være tomt' }
          : { hjaelp: 'står på dine ture og hos dem du deler med' })}
      />
      <div style={{ marginTop: '8px' }}>
        <Knap variant={klar ? 'primaer' : 'sekundaer'} onClick={() => void gemNu()} disabled={!klar}>
          {gemmer ? 'Gemmer…' : 'Gem navn'}
        </Knap>
      </div>
      {/* En slukket knap uden en grund ligner en fejl i appen. Linjen her
          siger, hvad der skal til for at tænde den — eller at der ikke er
          noget at gemme lige nu. */}
      <div style={{ fontSize: 'var(--skrift-mikro)', color: 'var(--tekst-svag)', marginTop: '6px' }}>
        {tomt
          ? 'Skriv et navn for at gemme.'
          : rettet
            ? 'Gem for at sende det nye navn op.'
            : 'Navnet er gemt. Ret det for at gemme igen.'}
      </div>
      {gemt === '' && (
        <Advarsel>
          Din konto har ikke noget navn endnu. På en delt tur står du som «Uden navn»,
          og gæstesiden kan ikke skrive, hvem turen er fra.
        </Advarsel>
      )}
    </div>
  );
}

function antalIBasen(base: Baseindhold): number {
  return base.items.length + base.grupper.length + base.ture.length
    + base.steder.length + base.personer.length;
}

// Skabelonen redigeres som en liste af linjer. Den gemmes som JSON, men det
// skal man ikke kunne se — man skriver punkter, ikke et array.
function Skabelon({ linjer, gem, nulstil }: {
  linjer: string[];
  gem: (linjer: string[]) => void;
  nulstil: () => void;
}) {
  const [ny, setNy] = useState('');

  const tilfoej = () => {
    if (!ny.trim()) return;
    gem([...linjer, ny.trim()]);
    setNy('');
  };

  return (
    <div>
      <div style={{ display: 'grid', gap: '2px', marginBottom: '12px' }}>
        {linjer.length === 0 && (
          <div style={{ fontSize: 'var(--skrift-knap)', color: 'var(--tekst-svag)' }}>
            Skabelonen er tom. Tilføj de punkter du altid skal huske.
          </div>
        )}
        {linjer.map((linje, n) => (
          <div key={`${linje}-${n}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0' }}>
            <input
              value={linje}
              onChange={(e) => gem(linjer.map((l, i) => (i === n ? e.target.value : l)))}
              style={{ flex: 1, minWidth: 0, fontSize: 'var(--skrift-knap)', border: 'none', background: 'transparent', padding: '2px 0' }}
            />
            <FjernKnap onClick={() => gem(linjer.filter((_, i) => i !== n))} label={`Fjern ${linje}`} />
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
        <input
          value={ny}
          onChange={(e) => setNy(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') tilfoej(); }}
          placeholder="Nyt punkt"
          style={{ flex: 1, minWidth: 0, fontSize: 'var(--skrift-knap)' }}
        />
        <Knap onClick={tilfoej} disabled={!ny.trim()}>+ Tilføj</Knap>
      </div>

      <Knap onClick={nulstil}>Nulstil til standard</Knap>
    </div>
  );
}

function poster(n: number): string {
  return `${n} ${n === 1 ? 'post' : 'poster'}`;
}

function Kort({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      border: '1px solid var(--border-svag)',
      borderRadius: '10px',
      padding: '14px',
      background: 'var(--bg-forhoejet)'
    }}>
      {children}
    </div>
  );
}

function Raekke({ label, vaerdi, fremhaev, maerke }: {
  label: string;
  vaerdi: string;
  fremhaev?: boolean;
  // Tilstanden ved siden af værdien, fx "Logget ind" ud for e-mailen.
  maerke?: string;
}) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      gap: '12px',
      padding: '5px 0',
      fontSize: 'var(--skrift-knap)'
    }}>
      <span style={{ flex: '0 0 40%', color: 'var(--tekst-dæmpet)' }}>{label}</span>
      <span style={{ minWidth: 0, overflowWrap: 'anywhere', color: fremhaev ? 'var(--advarsel)' : 'var(--tekst)', fontWeight: fremhaev ? 600 : 400, textAlign: 'right' }}>
        {vaerdi}
        {maerke && <Maerke>{maerke}</Maerke>}
      </span>
    </div>
  );
}

// Mærkaten ved siden af en værdi. Den står på accent-fladen og ikke i den
// fyldte accent: en tilstand, man ikke kan trykke på, må ikke se ud som
// skærmens handling.
function Maerke({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      marginLeft: '8px',
      display: 'inline-flex',
      alignItems: 'center',
      padding: '1px 8px',
      borderRadius: 'var(--runding-pille)',
      background: 'var(--accent-bg)',
      color: 'var(--accent)',
      border: '1px solid var(--accent-border)',
      fontSize: 'var(--skrift-mikro)',
      fontWeight: 600,
      letterSpacing: '0.4px',
      whiteSpace: 'nowrap',
      verticalAlign: 'middle'
    }}>
      {children}
    </span>
  );
}

// Linjen mellem en sektionstitel og dens kort. Den forklarer, hvad afsnittet
// bruges til, før man står i felterne — som referencen gør det over "Din krop".
function Afsnitstekst({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      margin: '-4px 0 12px',
      fontSize: 'var(--skrift-lille)',
      color: 'var(--tekst-dæmpet)',
      lineHeight: 1.5,
      maxWidth: '68ch'
    }}>
      {children}
    </p>
  );
}

function Hjaelp({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 'var(--skrift-lille)',
      color: 'var(--tekst-svag)',
      marginTop: '12px',
      paddingTop: '10px',
      borderTop: '1px solid var(--border-svag)',
      lineHeight: 1.5
    }}>
      {children}
    </div>
  );
}

function Kvittering({ besked }: { besked: Besked }) {
  if (!besked) return null;

  return (
    <div style={{
      fontSize: 'var(--skrift-detalje)',
      marginTop: '10px',
      color: besked.slags === 'ok' ? 'var(--succes)' : 'var(--fejl)'
    }}>
      {besked.tekst}
    </div>
  );
}

function Advarsel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      marginTop: '12px',
      padding: '10px 12px',
      borderRadius: '8px',
      background: 'var(--advarsel-bg)',
      border: '1px solid var(--advarsel-border)',
      fontSize: 'var(--skrift-detalje)',
      color: 'var(--advarsel)',
      lineHeight: 1.5
    }}>
      ⚠ {children}
    </div>
  );
}

export default IndstillingerSide;
