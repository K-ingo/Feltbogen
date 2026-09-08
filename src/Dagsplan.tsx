import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, AKTIVITET, OVERNATNING, etiket } from './db';
import type { Tur, TurDag } from './db';
import { opretTurDag, opdaterTurDag, sletTurDag } from './sync';
import { meldFortrydelse } from './fortryd';
import { kortDag } from './datotekst';
import {
  antalDage, datoFor, dageFor, nyDag, omnummerering, flyt, dageUdenForTuren, manglendeDage
} from './turdag';
import { Knap, Dropdown, Felt, Tekstomraade, Badge } from './ui';

// ─────────────────────────────────────────────
// Dagene på turen
//
// Ligger under Overblik og ikke i sin egen fane. Dagene *er* turens
// parametre, dag for dag — og reglen er, at en ny funktion ikke automatisk får
// en fane.
//
// Sektionen vises kun, når turen har mindst én nat. En dagstur har én dag, og
// en dagsplan for den ene dag er en liste med ét punkt, der ikke fortæller
// noget, turen ikke allerede siger.
// ─────────────────────────────────────────────

interface Props {
  tur: Tur;
}

export function Dagsplan({ tur }: Props) {
  const alleDage = useLiveQuery(
    () => db.tur_dage.where('tur_uid').equals(tur.uid).toArray(),
    [tur.uid]
  );

  // Undefined mens basen læses. En tom liste ville et øjeblik se ud som "ingen
  // dage" og lade invitationen blinke forbi.
  if (alleDage === undefined) return null;

  const dage = dageFor(alleDage, tur.uid);
  const udenfor = dageUdenForTuren(tur, dage);
  const mangler = manglendeDage(tur, dage);

  const tilfoej = async () => {
    await opretTurDag(nyDag(tur, dage));
  };

  // Fylder resten af turen op på én gang. Er man i gang med at planlægge en
  // uge, er seks tryk på "Tilføj dag" ikke en planlægning, det er en
  // indtastning.
  //
  // Antallet regnes her og ikke af `manglendeDage`: den svarer med vilje nul
  // for en tur helt uden dage, fordi ingen dage ikke er et hul. Til at fylde
  // op er det netop nul, der er det forkerte svar.
  const fyldOp = async () => {
    const tilAtFylde = Math.max(0, antalDage(tur) - dage.length);

    for (let i = 0; i < tilAtFylde; i++) {
      const eksisterende = await db.tur_dage.where('tur_uid').equals(tur.uid).toArray();
      await opretTurDag(nyDag(tur, eksisterende));
    }
  };

  const fjern = async (dag: TurDag) => {
    if (dag.id === undefined) return;

    const genskab = await sletTurDag(dag.id);

    // Hullet lukkes, så rækken bliver ved med at være 1, 2, 3. Det sker efter
    // sletningen, så numrene kun flytter sig, hvis den faktisk gik igennem.
    const tilbage = await db.tur_dage.where('tur_uid').equals(tur.uid).toArray();
    for (const { dag: d, dag_nr } of omnummerering(tilbage)) {
      if (d.id !== undefined) await opdaterTurDag(d.id, { dag_nr });
    }

    if (genskab) {
      meldFortrydelse({
        slags: 'Dagen',
        navn: `Dag ${dag.dag_nr}`,
        // Omnummereringen fortrydes ikke med. Det er den rigtige afvejning:
        // en genskabt dag lander sidst i rækken frem for at skubbe de andre
        // tilbage igen, og dét kan man rette med pilene.
        detalje: tilbage.length > 0 ? 'de øvrige dage er nummereret om' : undefined,
        genskab
      });
    }
  };

  const flytDag = async (fraNr: number, tilNr: number) => {
    for (const { dag, dag_nr } of flyt(dage, fraNr, tilNr)) {
      if (dag.id !== undefined) await opdaterTurDag(dag.id, { dag_nr });
    }
  };

  if (dage.length === 0) {
    return (
      <div style={{ display: 'grid', gap: 'var(--plads-3)' }}>
        <div style={{ fontSize: 'var(--skrift-knap)', color: 'var(--tekst-dæmpet)', lineHeight: 1.6 }}>
          Turen er {antalDage(tur)} dage. Skal den være den samme hele vejen, er
          der ikke noget at planlægge her — turens egne valg gælder. Skifter den
          slags undervejs, kan du beskrive dagene hver for sig.
        </div>
        <div style={{ display: 'flex', gap: 'var(--plads-2)', flexWrap: 'wrap' }}>
          <Knap variant="primaer" onClick={() => void fyldOp()}>
            Læg {antalDage(tur)} dage ind
          </Knap>
          <Knap onClick={() => void tilfoej()}>Tilføj én dag</Knap>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 'var(--plads-3)' }}>
      {udenfor.length > 0 && (
        <div style={{
          padding: 'var(--plads-2) var(--plads-3)',
          background: 'var(--advarsel-bg)',
          border: '1px solid var(--advarsel-border)',
          borderRadius: 'var(--runding-lille)',
          fontSize: 'var(--skrift-lille)',
          lineHeight: 1.5
        }}>
          Turen er {antalDage(tur)} dage, men der er planlagt {dage.length}.
          Ret nætterne under Turparametre, hvis turen er blevet længere.
        </div>
      )}

      {dage.map((dag, i) => (
        <Dagkort
          key={dag.uid}
          dag={dag}
          dato={datoFor(tur, dag.dag_nr)}
          udenfor={udenfor.includes(dag)}
          opad={i > 0 ? () => void flytDag(dag.dag_nr, dage[i - 1].dag_nr) : undefined}
          nedad={i < dage.length - 1 ? () => void flytDag(dag.dag_nr, dage[i + 1].dag_nr) : undefined}
          fjern={() => void fjern(dag)}
        />
      ))}

      <div style={{ display: 'flex', gap: 'var(--plads-2)', flexWrap: 'wrap' }}>
        <Knap onClick={() => void tilfoej()}>+ Tilføj dag</Knap>
        {mangler > 0 && (
          <Knap onClick={() => void fyldOp()}>
            Fyld de sidste {mangler} op
          </Knap>
        )}
      </div>
    </div>
  );
}

function Dagkort({ dag, dato, udenfor, opad, nedad, fjern }: {
  dag: TurDag;
  dato: string;
  udenfor: boolean;
  opad?: () => void;
  nedad?: () => void;
  fjern: () => void;
}) {
  // Kortet holder sin egen kopi, mens man skriver. Uden den læser hvert
  // tastetryk den værdi, der stod i basen før det forrige — useLiveQuery
  // tegner om, før skrivningen er nået igennem — og bogstaver falder på
  // gulvet. Samme mønster som `useRedigerbar` på detaljeskærmene.
  const [udkast, setUdkast] = useState(dag);

  // Kommer dagen udefra — en omnummerering, en anden enhed — skal kortet følge
  // med. Nummeret og identiteten er nok at lytte på; felterne skal netop ikke
  // overskrive det, man står og skriver.
  useEffect(() => { setUdkast(dag); }, [dag.uid, dag.dag_nr]); // eslint-disable-line react-hooks/exhaustive-deps

  const skriv = (aendringer: Partial<TurDag>) => {
    setUdkast((foer) => ({ ...foer, ...aendringer }));
    if (dag.id !== undefined) void opdaterTurDag(dag.id, aendringer);
  };

  return (
    <div style={{
      border: `1px solid ${udenfor ? 'var(--advarsel-border)' : 'var(--border-svag)'}`,
      borderRadius: 'var(--runding-lille)',
      padding: 'var(--plads-3)',
      background: 'var(--bg-forhoejet)',
      display: 'grid',
      gap: 'var(--plads-3)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--plads-2)', flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 'var(--skrift-brod)' }}>Dag {dag.dag_nr}</strong>
        {/* Datoen udledes af turens start. Har turen ingen, har dagen et
            nummer og ikke en dato — og så står der ikke noget frem for et gæt. */}
        {dato && (
          <span style={{ fontSize: 'var(--skrift-knap)', color: 'var(--tekst-dæmpet)' }}>
            {kortDag(dato)}
          </span>
        )}
        {udenfor && <Badge niveau="advarsel">uden for turen</Badge>}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 'var(--plads-1)' }}>
          <Pilknap retning="op" onClick={opad} nr={dag.dag_nr} />
          <Pilknap retning="ned" onClick={nedad} nr={dag.dag_nr} />
          <Knap variant="fare" onClick={fjern}>Slet</Knap>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 'var(--plads-3)', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
        <Dropdown
          label="Aktivitet"
          value={udkast.aktivitet}
          onChange={(v) => skriv({ aktivitet: v as TurDag['aktivitet'] })}
          options={[...AKTIVITET]}
          formater={etiket}
        />
        <Dropdown
          label="Overnatning"
          value={udkast.overnatning}
          onChange={(v) => skriv({ overnatning: v as TurDag['overnatning'] })}
          options={[...OVERNATNING]}
          formater={etiket}
        />
      </div>

      <Felt
        label="Hvorhen"
        value={udkast.destination}
        onChange={(v) => skriv({ destination: v })}
        placeholder="Shelterplads, sø, top …"
      />

      <Tekstomraade
        label="Noter"
        value={udkast.noter}
        onChange={(v) => skriv({ noter: v })}
        placeholder="Det der er værd at huske om dagen"
      />
    </div>
  );
}

// Pilen er et symbol og siger ingenting til en skærmlæser. Navnet står som
// aria-label frem for som skjult tekst — så er der ét sted at læse det, og
// ingen klasse der skal huskes.
function Pilknap({ retning, onClick, nr }: { retning: 'op' | 'ned'; onClick?: () => void; nr: number }) {
  return (
    <Knap
      onClick={onClick ?? (() => {})}
      disabled={!onClick}
      ariaLabel={`Flyt dag ${nr} ${retning === 'op' ? 'op' : 'ned'}`}
    >
      {retning === 'op' ? '↑' : '↓'}
    </Knap>
  );
}
