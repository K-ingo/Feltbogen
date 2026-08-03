import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { opdaterDeltTur, sletDeltTur } from './gaest';
import type { Opdatering } from './gaest';
import DeltTurVisning from './DeltTurVisning';
import { datoTekst } from './datotekst';
import { DetaljeHeader, Knap, Indlaeser } from './ui';
import { layout } from './layout';

interface Props {
  deltTurId: number;
  tilbage: () => void;
}

// En tur en anden har delt, som man har gemt hos sig selv. Den kan læses og
// hentes forfra, men ikke redigeres — det er ejerens tur, ikke ens egen.
function DeltTurDetalje({ deltTurId, tilbage }: Props) {
  const deltTur = useLiveQuery(() => db.delte_ture.get(deltTurId), [deltTurId]);
  const [henter, setHenter] = useState(false);
  const [svar, setSvar] = useState<Opdatering | null>(null);

  if (deltTur === undefined) return <Indlaeser />;
  if (deltTur === null) {
    tilbage();
    return null;
  }

  const hentForfra = async () => {
    setHenter(true);
    setSvar(await opdaterDeltTur(deltTur));
    setHenter(false);
  };

  const fjern = async () => {
    await sletDeltTur(deltTurId);
    tilbage();
  };

  return (
    <div style={layout.container}>
      <DetaljeHeader tilbage={tilbage} sletLabel="Fjern turen" slet={() => void fjern()} />

      <DeltTurVisning snapshot={deltTur.snapshot} />

      <div style={{
        marginTop: '22px',
        paddingTop: '16px',
        borderTop: '1px solid var(--border-svag)',
        textAlign: 'center'
      }}>
        <Knap onClick={() => void hentForfra()} disabled={henter}>
          {henter ? 'Henter…' : 'Hent ejerens nyeste'}
        </Knap>
        <div style={{ fontSize: '11px', color: 'var(--tekst-svag)', marginTop: '10px', lineHeight: 1.6 }}>
          {svar ? beskedOm(svar) : `Gemt hos dig ${datoTekst(deltTur.opdateret.toISOString())}.`}
        </div>
      </div>
    </div>
  );
}

function beskedOm(svar: Opdatering): string {
  if (svar === 'opdateret') return 'Hentet. Du ser nu ejerens nyeste udgave.';
  if (svar === 'ikke_fundet') return 'Delingen er trukket tilbage. Du ser den udgave du gemte.';
  return 'Der var ikke forbindelse. Du ser den udgave du gemte.';
}

export default DeltTurDetalje;
