import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import type { Tur } from './db';
import { opretTur } from './sync';
import TurDetalje from './TurDetalje';
import { Knap, Kort, Badge, layout } from './ui';

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

  const badgeNiveau = (status: string): 'info' | 'accent' | 'advarsel' | 'succes' => {
    switch (status) {
      case 'kladde': return 'info';
      case 'klar': return 'accent';
      case 'aktiv': return 'advarsel';
      case 'afsluttet': return 'info';
      default: return 'info';
    }
  };

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
        {ture?.length === 0 && (
          <div style={{ padding: '30px 20px', textAlign: 'center', color: 'var(--tekst-svag)' }}>
            Ingen ture endnu. Opret din første ovenfor.
          </div>
        )}
        {ture?.map((t: Tur) => (
          <div
            key={t.id}
            onClick={() => t.id && setValgtTurId(t.id)}
            style={{
              padding: '14px 4px',
              borderBottom: '1px solid var(--border-svag)',
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                <span style={{ fontWeight: 500, color: 'var(--tekst)', fontSize: '14px' }}>{t.navn}</span>
                <Badge niveau={badgeNiveau(t.status)}>{t.status}</Badge>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--tekst-dæmpet)' }}>
                {t.sted || 'Intet sted'} · {t.startdato}
                {t.personer > 1 && ` · ${t.personer} personer`}
              </div>
            </div>
            <div style={{ color: 'var(--tekst-svag)', fontSize: '18px' }}>›</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default TureListe;