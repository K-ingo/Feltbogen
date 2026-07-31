import { useState, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { logUd } from './pb';
import { useAuth } from './useAuth';
import { afstemMedServer, fjernDubletter, usendtAntal, uidFeltMangler } from './sync';
import {
  lavSikkerhedskopi,
  tilJson,
  laesSikkerhedskopi,
  fletInd,
  filnavn,
  KopiFejl
} from './dataudveksling';
import { Skal } from './Skal';
import type { Fane } from './Skal';
import { Knap, SektionsTitel } from './ui';

interface Props {
  fane: Fane;
  skift: (f: Fane) => void;
  tilLogin: () => void;
}

type Besked = { slags: 'ok' | 'fejl'; tekst: string } | null;

function IndstillingerSide({ fane, skift, tilLogin }: Props) {
  const { bruger } = useAuth();

  const [arbejder, setArbejder] = useState<string | null>(null);
  const [syncBesked, setSyncBesked] = useState<Besked>(null);
  const [dataBesked, setDataBesked] = useState<Besked>(null);
  const filvaelger = useRef<HTMLInputElement>(null);

  const items = useLiveQuery(() => db.items.toArray()) ?? [];
  const grupper = useLiveQuery(() => db.grupper.toArray()) ?? [];
  const ture = useLiveQuery(() => db.ture.toArray()) ?? [];
  // Tælles om når basen ændrer sig, så tallet ikke står og lyver efter en sync.
  const usendt = useLiveQuery(usendtAntal, [], 0);

  const synkroniser = async () => {
    setArbejder('sync');
    setSyncBesked(null);
    try {
      await afstemMedServer();
      const tilbage = await usendtAntal();
      setSyncBesked(tilbage === 0
        ? { slags: 'ok', tekst: 'Alt er synkroniseret.' }
        : { slags: 'fejl', tekst: `${tilbage} ${tilbage === 1 ? 'ændring' : 'ændringer'} kunne ikke sendes. Prøv igen når du har forbindelse.` });
    } catch {
      setSyncBesked({ slags: 'fejl', tekst: 'Kunne ikke få fat i serveren.' });
    }
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

  const eksporter = () => {
    const json = tilJson(lavSikkerhedskopi(items, grupper, ture));
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));

    const link = document.createElement('a');
    link.href = url;
    link.download = filnavn();
    link.click();
    URL.revokeObjectURL(url);

    setDataBesked({ slags: 'ok', tekst: `${poster(items.length + grupper.length + ture.length)} gemt i ${link.download}.` });
  };

  const importer = async (fil: File) => {
    setArbejder('import');
    setDataBesked(null);
    try {
      const kopi = laesSikkerhedskopi(await fil.text());
      const flettet = fletInd(kopi, { items, grupper, ture });

      await db.transaction('rw', db.items, db.grupper, db.ture, async () => {
        await db.items.bulkAdd(flettet.items);
        await db.grupper.bulkAdd(flettet.grupper);
        await db.ture.bulkAdd(flettet.ture);
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
    <Skal fane={fane} skift={skift} titel="Indstillinger">
      <div style={{ display: 'grid', gap: '22px' }}>

        <section>
          <SektionsTitel>Konto</SektionsTitel>
          <Kort>
            {bruger ? (
              <>
                <Raekke label="Logget ind som" vaerdi={bruger.email} />
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
                <div style={{ fontSize: '13px', color: 'var(--tekst)', lineHeight: 1.5 }}>
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

        <section>
          <SektionsTitel>Synkronisering</SektionsTitel>
          <Kort>
            <Raekke
              label="Venter på at blive sendt"
              vaerdi={usendt === 0 ? 'Intet' : `${usendt} ${usendt === 1 ? 'ændring' : 'ændringer'}`}
              fremhaev={usendt > 0}
            />

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
              <Knap variant="primaer" onClick={synkroniser} disabled={arbejder !== null}>
                {arbejder === 'sync' ? 'Synkroniserer…' : 'Synkronisér nu'}
              </Knap>
              <Knap onClick={rydDubletter} disabled={arbejder !== null}>
                {arbejder === 'dubletter' ? 'Rydder op…' : 'Ryd dubletter'}
              </Knap>
            </div>

            <Kvittering besked={syncBesked} />

            {uidFeltMangler() && (
              <Advarsel>
                PocketBase gemmer ikke feltet <code>uid</code>. Tilføj et tekstfelt ved navn
                <code> uid</code> til samlingerne <code>items</code>, <code>grupper</code> og
                <code> ture</code>. Uden det kan to enheder ikke blive enige om hvilken post
                der er hvilken, og gear bliver hentet ned igen som dubletter.
              </Advarsel>
            )}

            <Hjaelp>
              Alt gemmes først på enheden og sendes derefter op. Er du uden dækning, bliver
              ændringerne liggende og går op af sig selv når forbindelsen er tilbage.
            </Hjaelp>
          </Kort>
        </section>

        <section>
          <SektionsTitel>Data</SektionsTitel>
          <Kort>
            <Raekke label="Gear" vaerdi={`${items.length}`} />
            <Raekke label="Grupper" vaerdi={`${grupper.length}`} />
            <Raekke label="Ture" vaerdi={`${ture.length}`} />

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
              Kopien er en JSON-fil med alt dit gear, dine grupper og dine ture. Når du læser
              en ind, bliver der kun lagt til — poster du allerede har, bliver ikke rørt.
            </Hjaelp>
          </Kort>
        </section>

        <section>
          <SektionsTitel>Om</SektionsTitel>
          <Kort>
            <Raekke label="Feltbogen" vaerdi={`version ${__APP_VERSION__}`} />
          </Kort>
        </section>

      </div>
    </Skal>
  );
}

// ─────────────────────────────────────────────
// Byggeklodser
// ─────────────────────────────────────────────

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

function Raekke({ label, vaerdi, fremhaev }: { label: string; vaerdi: string; fremhaev?: boolean }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      gap: '12px',
      padding: '5px 0',
      fontSize: '13px'
    }}>
      <span style={{ color: 'var(--tekst-dæmpet)' }}>{label}</span>
      <span style={{ color: fremhaev ? 'var(--advarsel)' : 'var(--tekst)', fontWeight: fremhaev ? 600 : 400, textAlign: 'right' }}>
        {vaerdi}
      </span>
    </div>
  );
}

function Hjaelp({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: '11px',
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
      fontSize: '12px',
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
      fontSize: '12px',
      color: 'var(--advarsel)',
      lineHeight: 1.5
    }}>
      ⚠ {children}
    </div>
  );
}

export default IndstillingerSide;
