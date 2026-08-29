import { useEffect, useState } from 'react';
import { hentDeltTur, gemDeltTur, erDeltTurGemt } from './gaest';
import type { Gaestesnapshot } from './gaest';
import {
  hentDeltagelser, gemDeltagelse, forladTur, minDeltagelse, nyDeltagelse
} from './deltagelse';
import type { Deltagelse } from './deltagelse';
import { useAuth } from './useAuth';
import { mitNavn } from './pb';
import { skrivBidrag } from './turjournal';
import type { Skriveresultat } from './turjournal';
import AuthSide from './AuthSide';
import DeltTurVisning from './DeltTurVisning';
import MitGrej from './MitGrej';
import { Knap, Indlaeser } from './ui';
import { layout } from './layout';

interface Props {
  token: string;
  // Gæsten kan gå videre til sin egen Feltbog — turen bliver liggende.
  tilAppen: () => void;
}

// Turen set af en der er inviteret med.
//
// Man skal være logget ind: linket giver adgang til at skrive sig på turen,
// og så skal det kunne ses hvem der skriver. Selve turen kommer stadig fra ét
// frosset felt — der er ingen adgang til ejerens inventar herfra.
function GaesteSide({ token, tilAppen }: Props) {
  const { bruger } = useAuth();
  const [viserLogin, setViserLogin] = useState(false);

  const [tilstand, setTilstand] = useState<'henter' | 'ok' | 'ikke_fundet' | 'fejl'>('henter');
  const [snapshot, setSnapshot] = useState<Gaestesnapshot | null>(null);
  const [turPbId, setTurPbId] = useState('');
  const [deltagelser, setDeltagelser] = useState<Deltagelse[]>([]);
  const [gemt, setGemt] = useState(false);

  // Turen hentes først når man er logget ind. Læsereglen i PocketBase kræver
  // det, så et kald uden konto ville alligevel kun give "findes ikke".
  useEffect(() => {
    if (!bruger) return;
    let aktiv = true;

    void (async () => {
      const svar = await hentDeltTur(token);
      if (!aktiv) return;

      if (svar.slags !== 'ok') {
        setTilstand(svar.slags);
        return;
      }

      setSnapshot(svar.snapshot);
      setTurPbId(svar.turPbId);
      setTilstand('ok');

      const hentede = await hentDeltagelser(svar.turPbId, token);
      if (aktiv && hentede.slags === 'ok') setDeltagelser(hentede.data);
    })();

    erDeltTurGemt(token).then((fundet) => { if (aktiv) setGemt(!!fundet); });

    return () => { aktiv = false; };
  }, [token, bruger]);

  // At gemme turen er en tilmelding: man tager den med hjem, fordi man skal
  // med. Så skal de andre også kunne se at man er med — uden at man først
  // skal ned og udfylde "Mit grej".
  const gem = async () => {
    if (!snapshot || !bruger) return;
    await gemDeltTur(token, snapshot, window.location.origin, new Date(), turPbId);
    setGemt(true);

    if (turPbId && !minDeltagelse(deltagelser, bruger.id)) {
      await skrivMig(nyDeltagelse(turPbId, bruger.id, mitNavn()));
    }
  };

  // Ens egen række skrives til serveren og lægges så ind i den liste alle
  // ser — så står ens eget grej på pakkelisten med det samme.
  const skrivMig = async (naeste: Deltagelse, filer: File[] = []): Promise<Deltagelse | null> => {
    const svar = await gemDeltagelse(naeste, token, filer);
    if (svar.slags !== 'ok') return null;

    setDeltagelser((foer) => [
      ...foer.filter((d) => d.user !== svar.data.user),
      svar.data
    ]);
    return svar.data;
  };

  // En journalindgang skrives på ens egen deltagelsesrække — den eneste post
  // på turen, en gæst har adgang til. Se turjournal.ts.
  const skrivJournal = async (tekst: string, filer: File[]): Promise<Skriveresultat> => {
    if (!bruger || !turPbId) return 'fejl';

    const min = minDeltagelse(deltagelser, bruger.id) ?? nyDeltagelse(turPbId, bruger.id, mitNavn());
    return skrivBidrag(min, tekst, filer, (d, f) => skrivMig(d, f));
  };

  const meldFra = async (pbId: string): Promise<boolean> => {
    if (!await forladTur(pbId)) return false;
    setDeltagelser((foer) => foer.filter((d) => d.pb_id !== pbId));
    return true;
  };

  // Login-skærmen lukker sig selv når der er kvitteret. Uden det blev man
  // stående på den og skulle selv trykke tilbage for at se turen.
  if (viserLogin && !bruger) return <AuthSide fortryd={() => setViserLogin(false)} />;
  if (!bruger) return <Login token={token} tilLogin={() => setViserLogin(true)} />;

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
          <DeltTurVisning
            snapshot={snapshot}
            deltagelser={deltagelser}
            mig={bruger.id}
            ejer={snapshot.ejer}
            mitNavn={mitNavn()}
            token={token}
            kanMelde
            skrivJournal={skrivJournal}
            mitGrej={
              <MitGrej
                mig={minDeltagelse(deltagelser, bruger.id) ?? nyDeltagelse(turPbId, bruger.id, mitNavn())}
                faelles={snapshot.afsnit}
                gem={skrivMig}
                meldFra={meldFra}
              />
            }
            foed={<Gemfelt gemt={gemt} gem={() => void gem()} tilAppen={tilAppen} />}
          />
        )}
      </div>
    </div>
  );
}

// Uden konto er der ingen tur at vise. Man skal kunne se hvem der skriver sig
// på en fælles pakkeliste — ellers er den ikke til at stole på.
function Login({ token, tilLogin }: { token: string; tilLogin: () => void }) {
  return (
    <div>
      <Topbar />
      <div style={{ ...layout.container, padding: '50px 20px', textAlign: 'center' }}>
        <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: '22px', marginBottom: '10px' }}>
          Du er inviteret med på en tur
        </div>
        <div style={{ fontSize: '13px', color: 'var(--tekst-dæmpet)', lineHeight: 1.65, marginBottom: '20px' }}>
          Log ind eller opret en konto for at se turen. Så kan du også skrive
          hvad du selv tager med, og sige hvad du bærer af det fælles grej.
        </div>
        <Knap variant="primaer" onClick={tilLogin}>Log ind eller opret konto</Knap>
        <div style={{ fontSize: '11px', color: 'var(--tekst-svag)', marginTop: '14px' }}>
          Linket bliver liggende — du lander på turen igen bagefter.
        </div>
        {/* Tokenet bliver stående i adresselinjen, så turen findes igen efter
            login. Det vises ikke; det er ikke noget man skal skrive af. */}
        <span hidden>{token}</span>
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
        Du kan rette i dit eget grej, men ikke i resten af turen.
      </div>
    </div>
  );
}

function Topbar({ tilAppen }: { tilAppen?: () => void }) {
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
        {tilAppen && (
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
        )}
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
