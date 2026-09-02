import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import type { Billede, Tur } from './db';
import { Knap } from './ui';
import { meldFortrydelse } from './fortryd';
import { opdaterBillede, opretBillede, sletBillede } from './sync';
import {
  MAKS_BYTE,
  billederPaaTur,
  erBillede,
  filstoerrelse,
  hentelink,
  hentenavn,
  optagetid,
  skaler,
  usendte
} from './billeder';

interface Props {
  tur: Tur;
  saetHero: (uid: string) => void;
}

// Billederne fra turen.
//
// Filerne skaleres og komprimeres på enheden og gemmes i IndexedDB, inden der
// bliver spurgt om net. Man tager billeder i en skov uden dækning, og de skal
// ligge der når man kommer hjem — uploaden kan vente.
function BilledSektion({ tur, saetHero }: Props) {
  const alle = useLiveQuery(() => db.billeder.where('tur_uid').equals(tur.uid).toArray(), [tur.uid]) ?? [];
  const billeder = billederPaaTur(alle, tur.uid);

  const [arbejder, setArbejder] = useState(0);
  const [fejl, setFejl] = useState('');
  const [valgt, setValgt] = useState<string | null>(null);
  const filvaelger = useRef<HTMLInputElement>(null);

  const tilfoej = async (filer: FileList | null) => {
    if (!filer || filer.length === 0) return;
    setFejl('');
    setArbejder(filer.length);

    const afviste: string[] = [];
    for (const fil of Array.from(filer)) {
      // En fil valgt fra iCloud Drive på iOS kan komme helt uden type. Den
      // skal ikke afvises på det grundlag — kan afkoderen læse den, er det et
      // billede, og kan den ikke, bliver den afvist et par linjer længere nede
      // med den samme besked.
      if ((fil.type !== '' && !erBillede(fil.type)) || fil.size > MAKS_BYTE) {
        afviste.push(fil.name);
        setArbejder((n) => n - 1);
        continue;
      }

      try {
        const { blob, bredde, hoejde } = await skaler(fil);
        await opretBillede({
          navn: fil.name,
          tur_uid: tur.uid,
          tid: optagetid(fil),
          bredde,
          hoejde,
          byte: blob.size,
          blob,
          url: '',
          // Originalen gemmes urørt, så den kan hentes i fuld kvalitet af de
          // andre på turen. Den lokale kopi ryddes når uploaden er lykkedes.
          original_blob: fil,
          original_url: '',
          original_byte: fil.size,
          beskrivelse: '',
          oprettet: new Date(),
          aendret: new Date()
        });
      } catch {
        // En fil browseren ikke kan afkode, skal ikke stoppe resten.
        afviste.push(fil.name);
      } finally {
        setArbejder((n) => n - 1);
      }
    }

    if (afviste.length > 0) {
      setFejl(`Kunne ikke læse ${afviste.join(', ')}.`);
    }
    // Ellers kan den samme fil ikke vælges igen lige efter.
    if (filvaelger.current) filvaelger.current.value = '';
  };

  const fjern = async (billede: Billede) => {
    if (billede.id === undefined) return;
    setValgt(null);

    const genskab = await sletBillede(billede.id);
    if (genskab) meldFortrydelse({ slags: 'Billedet', navn: billede.navn, genskab });
  };

  const ikkeSendt = usendte(billeder);

  return (
    <div>
      <input
        ref={filvaelger}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => void tilfoej(e.target.files)}
        style={{ display: 'none' }}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
        <Knap variant="primaer" onClick={() => filvaelger.current?.click()} disabled={arbejder > 0}>
          {arbejder > 0 ? `Behandler ${arbejder}...` : 'Tilføj billeder'}
        </Knap>
        {billeder.length > 0 && (
          <span style={{ fontSize: '12px', color: 'var(--tekst-dæmpet)' }}>
            {billeder.length} {billeder.length === 1 ? 'billede' : 'billeder'}
            {ikkeSendt > 0 && ` · ${ikkeSendt} venter på at blive sendt`}
          </span>
        )}
      </div>

      {fejl && (
        <div style={{ fontSize: '12px', color: 'var(--fejl)', marginBottom: '10px' }}>{fejl}</div>
      )}

      {billeder.length === 0 ? (
        <div style={{ fontSize: '13px', color: 'var(--tekst-svag)', lineHeight: 1.6 }}>
          Gem et øjeblik fra turen. Billederne bliver liggende på enheden med det
          samme og sendt op når der er dækning — så du kan tage dem i skoven.
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))',
          gap: '6px'
        }}>
          {billeder.map((b) => (
            <button
              key={b.uid}
              onClick={() => setValgt(valgt === b.uid ? null : b.uid)}
              style={{
                position: 'relative',
                aspectRatio: '1',
                padding: 0,
                border: b.uid === tur.hero_billede
                  ? '2px solid var(--accent)'
                  : '1px solid var(--border-svag)',
                borderRadius: '8px',
                overflow: 'hidden',
                background: 'var(--bg-forhoejet)',
                cursor: 'pointer'
              }}
            >
              <Billedvisning billede={b} />
              {!b.url && (
                <span style={merke} title="Ikke sendt endnu">↑</span>
              )}
            </button>
          ))}
        </div>
      )}

      {valgt && (
        <Billedpanel
          billede={billeder.find((b) => b.uid === valgt) ?? null}
          erHero={valgt === tur.hero_billede}
          saetHero={() => saetHero(valgt)}
          fjern={fjern}
          luk={() => setValgt(null)}
        />
      )}
    </div>
  );
}

const merke: React.CSSProperties = {
  position: 'absolute',
  top: '3px',
  right: '3px',
  fontSize: '10px',
  lineHeight: 1,
  padding: '3px 4px',
  borderRadius: '4px',
  background: 'var(--advarsel-bg)',
  color: 'var(--advarsel)',
  border: '1px solid var(--advarsel-border)'
};

// Viser billedet fra det der er ved hånden.
//
// Enheden der tog billedet, har det som blob. En anden enhed har kun url'en —
// og henter blobben ned første gang billedet vises, så det også er der næste
// gang uden dækning. Det er derfor billederne ikke hentes ved sync: et helt
// galleri skal ikke trækkes ned for at vise en liste.
export function Billedvisning({ billede, tilpas = 'cover' }: {
  billede: Billede;
  // `cover` fylder firkanten ud og beskærer — rigtigt til en miniature.
  // `contain` viser hele billedet, som når man har slået det op for at se det.
  tilpas?: 'cover' | 'contain';
}) {
  const [kilde, setKilde] = useState('');

  useEffect(() => {
    let gaeldende = true;
    let objektUrl = '';

    const vis = (blob: Blob) => {
      objektUrl = URL.createObjectURL(blob);
      if (gaeldende) setKilde(objektUrl);
    };

    if (billede.blob) {
      vis(billede.blob);
    } else if (billede.url) {
      setKilde(billede.url);

      // Hentes ned i baggrunden, så billedet også er der uden dækning næste
      // gang. Lykkes det ikke, bliver url'en stående — så virker det stadig
      // så længe der er net.
      void (async () => {
        try {
          const svar = await fetch(billede.url);
          if (!svar.ok) return;
          const blob = await svar.blob();
          if (billede.id !== undefined) await db.billeder.update(billede.id, { blob });
        } catch {
          // Ingen dækning. Url'en virker når der er igen.
        }
      })();
    }

    return () => {
      gaeldende = false;
      if (objektUrl) URL.revokeObjectURL(objektUrl);
    };
  }, [billede.blob, billede.url, billede.id]);

  if (!kilde) {
    return (
      <span style={{ fontSize: '11px', color: 'var(--tekst-svag)' }}>Ikke hentet</span>
    );
  }

  return (
    <img
      src={kilde}
      alt={billede.beskrivelse || billede.navn}
      loading="lazy"
      style={{ width: '100%', height: '100%', objectFit: tilpas, display: 'block' }}
    />
  );
}

function Billedpanel({ billede, erHero, saetHero, fjern, luk }: {
  billede: Billede | null;
  erHero: boolean;
  saetHero: () => void;
  fjern: (b: Billede) => void;
  luk: () => void;
}) {
  if (!billede) return null;

  return (
    <div style={{
      marginTop: '12px',
      padding: '12px',
      borderRadius: '10px',
      background: 'var(--bg-forhoejet)',
      border: '1px solid var(--border-svag)'
    }}>
      <div style={{ borderRadius: '8px', overflow: 'hidden', marginBottom: '10px', height: '300px', background: 'var(--bg)' }}>
        <Billedvisning billede={billede} tilpas="contain" />
      </div>

      <input
        value={billede.beskrivelse}
        onChange={(e) => billede.id !== undefined && void opdaterBillede(billede.id, { beskrivelse: e.target.value })}
        placeholder="Hvad ser man?"
        style={{ width: '100%', marginBottom: '8px' }}
      />

      <div style={{ fontSize: '11px', color: 'var(--tekst-svag)', marginBottom: '10px' }}>
        {billede.bredde}×{billede.hoejde} · {filstoerrelse(billede.byte)}
        {!billede.url && ' · ikke sendt endnu'}
      </div>

      <Hentelinje billede={billede} />

      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        <Knap onClick={saetHero} disabled={erHero}>
          {erHero ? 'Er forsidebillede' : 'Brug som forside'}
        </Knap>
        <Knap variant="fare" onClick={() => void fjern(billede)}>Slet billede</Knap>
        <Knap variant="tekst" onClick={luk}>Luk</Knap>
      </div>
    </div>
  );
}

// Vejen til originalen i fuld kvalitet.
//
// Det er et almindeligt link og ikke en knap: en browser henter en fil ned
// ved at følge et link, og på en telefon er det den vej der ender med
// billedet i kamerarullen frem for i en fane.
export function Hentelinje({ billede }: { billede: Billede }) {
  const link = hentelink(billede);

  if (!link) {
    return (
      <div style={{ fontSize: '11px', color: 'var(--tekst-svag)', marginBottom: '10px' }}>
        {billede.original_blob
          ? 'Originalen er ikke sendt op endnu — den kan hentes når den er.'
          : 'Der er ingen original gemt for det her billede.'}
      </div>
    );
  }

  return (
    <a
      href={link}
      download={hentenavn(billede)}
      style={{
        display: 'inline-block',
        marginBottom: '10px',
        fontSize: '12px',
        color: 'var(--accent)'
      }}
    >
      Hent i fuld kvalitet{billede.original_byte > 0 && ` (${filstoerrelse(billede.original_byte)})`}
    </a>
  );
}

export default BilledSektion;
