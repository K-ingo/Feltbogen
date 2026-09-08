import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { logUd } from './pb';
import { rydEnhed } from './konto';
import { usendtAntal } from './sync';
import { lavSikkerhedskopi, tilJson, filnavn } from './dataudveksling';
import { Knap } from './ui';
import { layout } from './layout';

// ─────────────────────────────────────────────
// Enheden hører til en anden konto
//
// Skærmen står i vejen med vilje. Ét enkelt sync-kald under den forkerte konto
// er nok til at kopiere den forrige ejers grej over i den nye konto, og der er
// ingen vej tilbage fra det. Derfor er der ingen "fortsæt alligevel", og
// rydningen sker aldrig af sig selv.
//
// Den forrige ejers e-mail står der ikke. Står en anden med telefonen, skal
// appen ikke fortælle hende, hvis den er.
// ─────────────────────────────────────────────

interface Props {
  brugerId: string;
}

function KontoskiftSide({ brugerId }: Props) {
  const [arbejder, setArbejder] = useState(false);
  const [kopiTaget, setKopiTaget] = useState(false);

  const items = useLiveQuery(() => db.items.toArray(), []) ?? [];
  const grupper = useLiveQuery(() => db.grupper.toArray(), []) ?? [];
  const ture = useLiveQuery(() => db.ture.toArray(), []) ?? [];
  const steder = useLiveQuery(() => db.steder.toArray(), []) ?? [];
  const personer = useLiveQuery(() => db.personer.toArray(), []) ?? [];
  const billeder = useLiveQuery(() => db.billeder.count(), []) ?? 0;

  // Hvor meget der ikke er nået op. Det er det tal, der afgør, om en rydning
  // koster noget — resten ligger på serveren og kan hentes ned igen.
  const usendt = useLiveQuery(() => usendtAntal(), []);

  const base = { items, grupper, ture, steder, personer };
  const antal = items.length + grupper.length + ture.length + steder.length + personer.length;

  const gemKopi = () => {
    const json = tilJson(lavSikkerhedskopi(base));
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));

    const link = document.createElement('a');
    link.href = url;
    link.download = filnavn();
    link.click();
    URL.revokeObjectURL(url);
    setKopiTaget(true);
  };

  const ryd = async () => {
    setArbejder(true);
    await rydEnhed(brugerId);
    setArbejder(false);
  };

  return (
    <div style={{
      ...layout.container,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      minHeight: '100vh',
      paddingBottom: 'var(--plads-5)'
    }}>
      <div style={{ maxWidth: '440px', margin: '0 auto', width: '100%' }}>
        <h1 style={{ fontSize: 'var(--skrift-titel)', margin: '0 0 var(--plads-3)' }}>
          Enheden hører til en anden konto
        </h1>

        <p style={{ fontSize: 'var(--skrift-brod)', color: 'var(--tekst)', lineHeight: 1.6, margin: '0 0 var(--plads-4)' }}>
          Der ligger data på den her enhed, som blev lavet med en anden konto end
          den, du er logget ind med nu. Synkroniseringen er sat på pause, indtil
          du har taget stilling — ellers ville det andet grej blive lagt op i din
          konto.
        </p>

        <div style={{
          padding: 'var(--plads-3) var(--plads-4)',
          background: 'var(--advarsel-bg)',
          border: '1px solid var(--advarsel-border)',
          borderRadius: 'var(--runding-lille)',
          fontSize: 'var(--skrift-knap)',
          lineHeight: 1.6,
          marginBottom: 'var(--plads-5)'
        }}>
          <strong>{antal}</strong> {antal === 1 ? 'post' : 'poster'} ligger lokalt
          {billeder > 0 && <> · <strong>{billeder}</strong> {billeder === 1 ? 'billede' : 'billeder'}</>}
          {usendt !== undefined && usendt > 0 && (
            <div style={{ color: 'var(--advarsel)', marginTop: 'var(--plads-2)' }}>
              {usendt} {usendt === 1 ? 'ændring er' : 'ændringer er'} ikke nået op på
              serveren endnu. De findes kun her.
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--plads-2)' }}>
          <Knap
            variant="primaer"
            onClick={logUd}
            style={{ padding: 'var(--plads-3)', fontSize: 'var(--skrift-brod)' }}
          >
            Log ud igen
          </Knap>
          <div style={{ fontSize: 'var(--skrift-lille)', color: 'var(--tekst-svag)', lineHeight: 1.5, marginBottom: 'var(--plads-3)' }}>
            Ingenting bliver rørt. Log ind med den konto, dataene hører til, og
            fortsæt som før.
          </div>

          <Knap onClick={gemKopi} style={{ padding: 'var(--plads-3)' }}>
            {kopiTaget ? 'Gem en kopi igen' : 'Gem en kopi først'}
          </Knap>
          <div style={{ fontSize: 'var(--skrift-lille)', color: 'var(--tekst-svag)', lineHeight: 1.5, marginBottom: 'var(--plads-3)' }}>
            Henter grej, grupper, ture, steder og personer ned som én fil.
            <strong> Billeder er ikke med.</strong>
          </div>

          <Knap
            variant="fare"
            onClick={ryd}
            disabled={arbejder}
            style={{ padding: 'var(--plads-3)' }}
          >
            {arbejder ? 'Rydder...' : 'Ryd enheden og fortsæt'}
          </Knap>
          <div style={{ fontSize: 'var(--skrift-lille)', color: 'var(--tekst-svag)', lineHeight: 1.5 }}>
            Alt lokalt slettes — også billeder og enhedens indstillinger — og
            enheden bliver din. Dine egne data hentes ned bagefter.
            <strong> Det kan ikke fortrydes.</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

export default KontoskiftSide;
