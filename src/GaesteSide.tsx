import { useEffect, useState } from 'react';
import { hentDeltTur, gemDeltTur, erDeltTurGemt } from './gaest';
import type { Gaestesnapshot } from './gaest';
import DeltTurVisning from './DeltTurVisning';
import { Knap, Indlaeser } from './ui';
import { layout } from './layout';

interface Props {
  token: string;
  // Gæsten kan gå videre til sin egen konto — det er ikke en betingelse for
  // at se turen.
  tilAppen: () => void;
}

// Turen set af en gæst uden konto. Alt kommer fra ét frosset felt på turen;
// der er ingen adgang til ejerens inventar herfra.
function GaesteSide({ token, tilAppen }: Props) {
  const [tilstand, setTilstand] = useState<'henter' | 'ok' | 'ikke_fundet' | 'fejl'>('henter');
  const [snapshot, setSnapshot] = useState<Gaestesnapshot | null>(null);
  const [gemt, setGemt] = useState(false);

  useEffect(() => {
    let aktiv = true;

    hentDeltTur(token).then((svar) => {
      if (!aktiv) return;
      if (svar.slags === 'ok') {
        setSnapshot(svar.snapshot);
        setTilstand('ok');
      } else {
        setTilstand(svar.slags);
      }
    });

    // Har man gemt turen før, skal knappen ikke lokke med det igen.
    erDeltTurGemt(token).then((fundet) => { if (aktiv) setGemt(!!fundet); });

    return () => { aktiv = false; };
  }, [token]);

  const gem = async () => {
    if (!snapshot) return;
    await gemDeltTur(token, snapshot);
    setGemt(true);
  };

  return (
    <div>
      <Topbar tilAppen={tilAppen} />

      <div style={{ ...layout.container, paddingBottom: 'calc(40px + env(safe-area-inset-bottom))' }}>
        {tilstand === 'henter' && <Indlaeser />}
        {tilstand === 'ikke_fundet' && (
          <Besked
            titel="Linket virker ikke"
            tekst="Turen findes ikke, eller delingen er trukket tilbage. Spørg den der sendte dig linket."
          />
        )}
        {tilstand === 'fejl' && (
          <Besked
            titel="Kunne ikke hente turen"
            tekst="Der var ikke forbindelse til serveren. Prøv igen om lidt."
          />
        )}
        {tilstand === 'ok' && snapshot && (
          <>
            <DeltTurVisning snapshot={snapshot} />
            <Gemfelt gemt={gemt} gem={() => void gem()} tilAppen={tilAppen} />
          </>
        )}
      </div>
    </div>
  );
}

// Et link man har fået tilsendt, forsvinder når fanen lukkes. Herfra kan
// gæsten lægge turen over i sin egen app, så den kan findes igen.
function Gemfelt({ gemt, gem, tilAppen }: { gemt: boolean; gem: () => void; tilAppen: () => void }) {
  return (
    <div style={{
      marginTop: '24px',
      paddingTop: '18px',
      borderTop: '1px solid var(--border-svag)',
      textAlign: 'center'
    }}>
      {gemt ? (
        <>
          <div style={{ fontSize: '13px', marginBottom: '10px' }}>
            Turen ligger nu under <strong>Ture</strong> i din Feltbog.
          </div>
          <Knap variant="primaer" onClick={tilAppen}>Åbn den i appen</Knap>
        </>
      ) : (
        <>
          <div style={{ fontSize: '13px', color: 'var(--tekst-dæmpet)', marginBottom: '10px', lineHeight: 1.55 }}>
            Gem turen, så du kan finde den igen uden linket — også uden dækning.
          </div>
          <Knap variant="primaer" onClick={gem}>Gem turen hos mig</Knap>
        </>
      )}
      <div style={{ fontSize: '11px', color: 'var(--tekst-svag)', marginTop: '10px' }}>
        Gemmes kun på denne enhed. Du kan ikke rette i en tur en anden har delt.
      </div>
    </div>
  );
}

function Topbar({ tilAppen }: { tilAppen: () => void }) {
  return (
    <div style={{
      borderBottom: '1px solid var(--border)',
      background: 'var(--bg-topbar)',
      paddingTop: 'env(safe-area-inset-top)'
    }}>
      <div style={{
        maxWidth: '640px',
        margin: '0 auto',
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px'
      }}>
        <div>
          <div style={{ fontSize: '12px', fontWeight: 600, letterSpacing: '1.2px', textTransform: 'uppercase' }}>
            Feltbogen
          </div>
          <div style={{ fontSize: '11px', color: 'var(--tekst-svag)' }}>Delt med dig</div>
        </div>
        <button
          onClick={tilAppen}
          style={{
            padding: '7px 13px',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: 500,
            cursor: 'pointer',
            background: 'transparent',
            color: 'var(--tekst)',
            border: '1px solid var(--border)'
          }}
        >
          Åbn Feltbogen
        </button>
      </div>
    </div>
  );
}

function Besked({ titel, tekst }: { titel: string; tekst: string }) {
  return (
    <div style={{ padding: '50px 10px', textAlign: 'center' }}>
      <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: '20px', marginBottom: '8px' }}>{titel}</div>
      <div style={{ fontSize: '13px', color: 'var(--tekst-dæmpet)', lineHeight: 1.6 }}>{tekst}</div>
    </div>
  );
}

export default GaesteSide;
