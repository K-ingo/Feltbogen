import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { opdaterDeltTur, sletDeltTur } from './gaest';
import type { Opdatering } from './gaest';
import {
  hentDeltagelser, gemDeltagelse, forladTur, minDeltagelse, nyDeltagelse
} from './deltagelse';
import type { Deltagelse } from './deltagelse';
import { useAuth } from './useAuth';
import DeltTurVisning from './DeltTurVisning';
import MitGrej from './MitGrej';
import { datoTekst } from './datotekst';
import { mitNavn } from './pb';
import { skrivBidrag } from './turjournal';
import type { Skriveresultat } from './turjournal';
import { DetaljeHeader, Indlaeser } from './ui';
import { layout } from './layout';

interface Props {
  deltTurId: number;
  tilbage: () => void;
}

// En tur en anden har delt, som man har gemt hos sig selv.
//
// Selve turen er ejerens og kan ikke redigeres — men ens eget bidrag kan.
// Det er den samme redigering som på gæstesiden: man skal ikke skulle finde
// det oprindelige link frem for at rette i hvad man tager med.
function DeltTurDetalje({ deltTurId, tilbage }: Props) {
  const { bruger } = useAuth();
  const deltTur = useLiveQuery(() => db.delte_ture.get(deltTurId), [deltTurId]);
  const [henter, setHenter] = useState(false);
  const [svar, setSvar] = useState<Opdatering | null>(null);
  const [deltagelser, setDeltagelser] = useState<Deltagelse[]>([]);

  const token = deltTur?.token ?? '';
  const turPbId = deltTur?.tur_pb_id ?? '';

  // Bidragene ligger på serveren. Uden forbindelse — eller på en tur gemt før
  // deltagelse fandtes — vises turen bare uden dem.
  useEffect(() => {
    if (!token || !turPbId || !bruger) return;

    let aktiv = true;
    void hentDeltagelser(turPbId, token).then((hentede) => {
      if (aktiv && hentede.slags === 'ok') setDeltagelser(hentede.data);
    });
    return () => { aktiv = false; };
  }, [token, turPbId, bruger]);

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

  const skrivMig = async (naeste: Deltagelse, filer: File[] = []): Promise<Deltagelse | null> => {
    const gemt = await gemDeltagelse(naeste, token, filer);
    if (gemt.slags !== 'ok') return null;

    setDeltagelser((foer) => [...foer.filter((d) => d.user !== gemt.data.user), gemt.data]);
    return gemt.data;
  };

  // Samme skrivning som på gæstesiden: indgangen lægges på ens egen
  // deltagelsesrække. Se turjournal.ts.
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

  return (
    <div style={layout.container}>
      <DetaljeHeader tilbage={tilbage} sletLabel="Fjern turen" slet={() => void fjern()} />

      <DeltTurVisning
        snapshot={deltTur.snapshot}
        deltagelser={deltagelser}
        mig={bruger?.id}
        ejer={deltTur.snapshot.ejer}
        token={token}
        kanMelde={!!bruger && !!turPbId}
        opdater={{
          hent: () => void hentForfra(),
          henter,
          besked: svar
            ? beskedOm(svar)
            : `Et øjebliksbillede, gemt hos dig ${datoTekst(deltTur.opdateret.toISOString())}. Turen kan være ændret siden.`
        }}
        skrivJournal={bruger && turPbId ? skrivJournal : undefined}
        mitGrej={bruger && turPbId ? (
          <MitGrej
            mig={minDeltagelse(deltagelser, bruger.id) ?? nyDeltagelse(turPbId, bruger.id, mitNavn())}
            faelles={deltTur.snapshot.afsnit}
            gem={skrivMig}
            meldFra={meldFra}
          />
        ) : (
          <Kanikkebidrage loggetInd={!!bruger} />
        )}
      />

    </div>
  );
}

// To grunde til at man ikke kan skrive sig på: man er logget ud, eller turen
// blev gemt dengang deltagelse ikke fandtes og kender ikke sin egen record.
function Kanikkebidrage({ loggetInd }: { loggetInd: boolean }) {
  return (
    <div style={{
      marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border-svag)',
      fontSize: '12px', color: 'var(--tekst-dæmpet)', lineHeight: 1.6
    }}>
      {loggetInd
        ? 'Turen blev gemt før man kunne skrive sig på. Tryk "Hent ejerens nyeste", så kommer feltet frem.'
        : 'Log ind for at skrive hvad du selv tager med på turen.'}
    </div>
  );
}

function beskedOm(svar: Opdatering): string {
  if (svar === 'opdateret') return 'Hentet. Du ser nu ejerens nyeste udgave.';
  if (svar === 'ikke_fundet') return 'Delingen er trukket tilbage. Du ser den udgave du gemte.';
  return 'Der var ikke forbindelse. Du ser den udgave du gemte.';
}

export default DeltTurDetalje;
