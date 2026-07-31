import { useState, useRef } from 'react';
import { db } from './db';
import { laesSikkerhedskopi, fletInd, KopiFejl } from './dataudveksling';
import { Knap } from './ui';
import { layout } from './layout';

interface Props {
  nytItem: () => void;
  nyTur: () => void;
  tilLogin: () => void;
  spring: () => void;
}

// Første gang appen åbnes. Kontoen tilbydes, men står ikke i vejen: alt virker
// lokalt, og login er noget man kan gøre bagefter fra indstillingerne.
function Velkomst({ nytItem, nyTur, tilLogin, spring }: Props) {
  const [fejl, setFejl] = useState('');
  const [laeser, setLaeser] = useState(false);
  const filvaelger = useRef<HTMLInputElement>(null);

  const importer = async (fil: File) => {
    setLaeser(true);
    setFejl('');
    try {
      const kopi = laesSikkerhedskopi(await fil.text());
      const eksisterende = {
        items: await db.items.toArray(),
        grupper: await db.grupper.toArray(),
        ture: await db.ture.toArray()
      };
      const flettet = fletInd(kopi, eksisterende);

      await db.transaction('rw', db.items, db.grupper, db.ture, async () => {
        await db.items.bulkAdd(flettet.items);
        await db.grupper.bulkAdd(flettet.grupper);
        await db.ture.bulkAdd(flettet.ture);
      });

      spring();
    } catch (e) {
      setFejl(e instanceof KopiFejl ? e.message : 'Filen kunne ikke læses.');
      setLaeser(false);
    }
  };

  return (
    <div style={{
      ...layout.container,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      minHeight: '100vh',
      paddingBottom: '20px'
    }}>
      <div style={{ maxWidth: '360px', margin: '0 auto', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '46px', lineHeight: 1 }} role="img" aria-label="rygsæk">🎒</div>
          <h1 style={{ fontSize: '32px', margin: '14px 0 0' }}>Feltbogen</h1>
          <p style={{ fontSize: '14px', color: 'var(--tekst-dæmpet)', lineHeight: 1.6, margin: '10px 0 0' }}>
            Hold styr på dit friluftsgear, planlæg ture der ikke går galt,
            og del med gruppen.
          </p>
        </div>

        <div style={{ display: 'grid', gap: '10px' }}>
          <Knap variant="primaer" onClick={nytItem} style={{ padding: '12px', fontSize: '14px' }}>
            Tilføj mit første gear
          </Knap>
          <Knap onClick={nyTur} style={{ padding: '12px', fontSize: '14px' }}>
            Opret min første tur
          </Knap>
          <Knap
            onClick={() => filvaelger.current?.click()}
            disabled={laeser}
            style={{ padding: '12px', fontSize: '14px' }}
          >
            {laeser ? 'Læser…' : 'Importér fra fil'}
          </Knap>
        </div>

        <input
          ref={filvaelger}
          type="file"
          accept="application/json,.json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const fil = e.target.files?.[0];
            e.target.value = '';
            if (fil) void importer(fil);
          }}
        />

        {fejl && (
          <div style={{ fontSize: '12px', color: 'var(--fejl)', textAlign: 'center', marginTop: '12px' }}>
            {fejl}
          </div>
        )}

        <div style={{ fontSize: '11px', color: 'var(--tekst-svag)', textAlign: 'center', marginTop: '22px' }}>
          Alt gemmes på denne enhed · ingen konto påkrævet
        </div>

        <div style={{ display: 'grid', gap: '2px', marginTop: '14px', justifyItems: 'center' }}>
          <Tekstknap onClick={tilLogin} understreget>Har du en konto? Log ind</Tekstknap>
          <Tekstknap onClick={spring}>Spring over →</Tekstknap>
        </div>
      </div>
    </div>
  );
}

function Tekstknap({ onClick, understreget, children }: {
  onClick: () => void;
  understreget?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        color: 'var(--tekst-dæmpet)',
        fontSize: '13px',
        padding: '6px',
        textDecoration: understreget ? 'underline' : 'none'
      }}
    >
      {children}
    </button>
  );
}

export default Velkomst;
