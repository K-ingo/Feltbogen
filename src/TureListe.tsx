import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import type { TurStatus } from './db';
import { opretTur } from './sync';
import TurDetalje from './TurDetalje';
import { Knap, Kort, Badge, ListeRaekke, TomListe } from './ui';
import { layout } from './layout';

// Farven signalerer hvor turen er i sit livsforløb.
const STATUS_NIVEAU: Record<TurStatus, 'info' | 'accent' | 'advarsel'> = {
  kladde: 'info',
  klar: 'accent',
  aktiv: 'advarsel',
  afsluttet: 'info'
};

function TureListe() {
  const [nytNavn, setNytNavn] = useState('');
  const [valgtTurId, setValgtTurId] = useState<number | null>(null);

  const ture = useLiveQuery(() => db.ture.orderBy('startdato').reverse().toArray());

  const opret = async () => {
    if (!nytNavn.trim()) return;
    const nu = new Date();
    const idag = nu.toISOString().slice(0, 10);
    await opretTur({
      navn: nytNavn.trim(),
      sted: '',
      koordinater: null,
      startdato: idag,
      slutdato: idag,
      naetter: 0,
      personer: 1,
      overnatning: 'shelter',
      aktivitet: 'bushcraft',
      terraen: 'skov',
      baereafstand_km: 0,
      erfaring: 'oevet',
      status: 'kladde',
      gruppe_ids: [],
      loese_item_ids: [],
      deltagere: [],
      budget_linjer: [],
      besked_fra_ejer: '',
      noter: '',
      vejrsnapshot: '',
      oprettet: nu,
      aendret: nu
    });
    setNytNavn('');
  };

  if (valgtTurId !== null) {
    return <TurDetalje turId={valgtTurId} tilbage={() => setValgtTurId(null)} />;
  }

  return (
    <div style={layout.container}>
      <h1>Feltbogen</h1>
      <div style={{ fontSize: '13px', color: 'var(--tekst-dæmpet)', marginBottom: '20px' }}>
        Ture · {ture?.length ?? 0}
      </div>

      <Kort fremhaevet style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            placeholder="Ny tur (fx Uge 32 — Øghaven)"
            value={nytNavn}
            onChange={(e) => setNytNavn(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && opret()}
            style={{ flex: 1 }}
          />
          <Knap variant="primaer" onClick={opret}>Opret</Knap>
        </div>
      </Kort>

      <div>
        {ture?.length === 0 && <TomListe>Ingen ture endnu. Opret din første ovenfor.</TomListe>}
        {ture?.map((t) => (
          <ListeRaekke
            key={t.id}
            onClick={() => t.id !== undefined && setValgtTurId(t.id)}
            titel={
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {t.navn}
                <Badge niveau={STATUS_NIVEAU[t.status]}>{t.status}</Badge>
              </span>
            }
            detalje={
              <>
                {t.sted || 'Intet sted'} · {t.startdato}
                {t.personer > 1 && ` · ${t.personer} personer`}
              </>
            }
          />
        ))}
      </div>
    </div>
  );
}

export default TureListe;
