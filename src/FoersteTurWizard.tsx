import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import type { Tur } from './db';
import { opretTomTur } from './opret';
import { opdaterTur } from './sync';
import { forslagTilTur, udenAfviste, maalFor } from './forslag';
import type { Forslag } from './forslag';
import { Knap, Chip, Infokort, Forslagskort } from './ui';

interface Props {
  luk: () => void;
  aabnTur: (id: number, nyOprettet?: boolean) => void;
}

export function FoersteTurWizard({ luk, aabnTur }: Props) {
  const steder = useLiveQuery(() => db.steder.toArray()) ?? [];
  const items = useLiveQuery(() => db.items.toArray()) ?? [];
  const grupper = useLiveQuery(() => db.grupper.toArray()) ?? [];
  const ture = useLiveQuery(() => db.ture.toArray()) ?? [];

  const [trin, setTrin] = useState<1 | 2>(1);

  // Kladde-data i lokal state
  const [navn, setNavn] = useState('Min første tur');
  const [stedNavn, setStedNavn] = useState('');
  const [startdato, setStartdato] = useState(() => new Date().toISOString().split('T')[0]);
  const [slutdato, setSlutdato] = useState(() => new Date().toISOString().split('T')[0]);
  const [naetter, setNaetter] = useState(1);
  const [personerAntal, setPersonerAntal] = useState(1);
  const [aktivitet, setAktivitet] = useState<'vandretur' | 'kano' | 'bushcraft' | 'andet'>('vandretur');
  const [overnatning, setOvernatning] = useState<'telt' | 'shelter' | 'haengekoeje' | 'blandet'>('telt');

  const [valgteGruppeUids, setValgteGruppeUids] = useState<string[]>([]);
  const [valgteItemUids] = useState<string[]>([]);
  const [afvisteForslag, setAfvisteForslag] = useState<Set<string>>(new Set());

  // Bygger en midlertidig Tur til forslagsmotoren
  const kladdeTur: Tur = {
    uid: 'draft-wizard',
    navn: navn.trim() || 'Min første tur',
    startdato,
    slutdato,
    naetter,
    personer: personerAntal,
    overnatning,
    aktivitet,
    terraen: 'skov',
    baereafstand_km: 0,
    erfaring: 'begynder',
    sted: stedNavn,
    sted_uid: steder.find((s) => s.navn === stedNavn)?.uid ?? '',
    koordinater: null,
    status: 'kladde',
    gruppe_ids: valgteGruppeUids,
    loese_item_ids: valgteItemUids,
    pakkede_item_uids: [],
    afgangs_tjek: null,
    deltagere: [],
    budget_linjer: [],
    feltnoter: [],
    pak_af_tjek: null,
    besked_fra_ejer: '',
    noter: '',
    vejrsnapshot: '',
    dele_token: '',
    dele_snapshot: '',
    turkort_token: '',
    turkort_retur: '',
    turkort_besked: '',
    turkort_snapshot: '',
    hero_billede: '',
    booking: null,
    oprettet: new Date(),
    aendret: new Date()
  };

  const forslag = udenAfviste(forslagTilTur(kladdeTur, grupper, items, ture), afvisteForslag);

  const tagImodForslag = (f: Forslag) => {
    if (f.type === 'grej') {
      const gUid = maalFor(f);
      if (gUid && !valgteGruppeUids.includes(gUid)) {
        setValgteGruppeUids([...valgteGruppeUids, gUid]);
      }
    }
  };

  const oerafvisForslag = (id: string) => {
    setAfvisteForslag(new Set([...afvisteForslag, id]));
  };

  const gemOgOpret = async () => {
    const id = await opretTomTur();

    const valgtStedObj = steder.find((s) => s.navn === stedNavn);

    await opdaterTur(id, {
      navn: navn.trim() || 'Min første tur',
      sted: stedNavn,
      sted_uid: valgtStedObj?.uid ?? '',
      koordinater: valgtStedObj?.koordinater ?? null,
      startdato,
      slutdato,
      naetter,
      personer: personerAntal,
      overnatning,
      aktivitet,
      gruppe_ids: valgteGruppeUids,
      loese_item_ids: valgteItemUids
    });

    luk();
    aabnTur(id, true);
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '16px'
    }}>
      <div style={{
        background: 'var(--bg)',
        borderRadius: '16px',
        maxWidth: '500px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        padding: '24px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '20px', margin: 0 }}>
            {trin === 1 ? 'Planlæg din første tur' : 'Smart-forslag til turen'}
          </h2>
          <Knap variant="tekst" onClick={luk}>LUK ×</Knap>
        </div>

        {trin === 1 ? (
          <div style={{ display: 'grid', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                Hvad skal turen hedde?
              </label>
              <input
                type="text"
                value={navn}
                onChange={(e) => setNavn(e.target.value)}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: '8px',
                  border: '1px solid var(--border-svag)', background: 'var(--bg-forhoejet)', color: 'var(--tekst)'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                Hvor hen? (Sted)
              </label>
              <input
                type="text"
                value={stedNavn}
                onChange={(e) => setStedNavn(e.target.value)}
                placeholder="f.eks. Mols Bjerge"
                list="steder-liste"
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: '8px',
                  border: '1px solid var(--border-svag)', background: 'var(--bg-forhoejet)', color: 'var(--tekst)'
                }}
              />
              <datalist id="steder-liste">
                {steder.map((s) => <option key={s.uid} value={s.navn} />)}
              </datalist>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  Aktivitet
                </label>
                <select
                  value={aktivitet}
                  onChange={(e) => setAktivitet(e.target.value as 'vandretur' | 'kano' | 'bushcraft' | 'andet')}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: '8px',
                    border: '1px solid var(--border-svag)', background: 'var(--bg-forhoejet)', color: 'var(--tekst)'
                  }}
                >
                  <option value="vandretur">Vandretur</option>
                  <option value="kano">Kanotur</option>
                  <option value="bushcraft">Bushcraft</option>
                  <option value="andet">Andet</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  Overnatning
                </label>
                <select
                  value={overnatning}
                  onChange={(e) => setOvernatning(e.target.value as 'telt' | 'shelter' | 'haengekoeje' | 'blandet')}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: '8px',
                    border: '1px solid var(--border-svag)', background: 'var(--bg-forhoejet)', color: 'var(--tekst)'
                  }}
                >
                  <option value="telt">Telt</option>
                  <option value="shelter">Shelter</option>
                  <option value="haengekoeje">Hængekøje</option>
                  <option value="blandet">Blandet</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  Startdato
                </label>
                <input
                  type="date"
                  value={startdato}
                  onChange={(e) => setStartdato(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: '8px',
                    border: '1px solid var(--border-svag)', background: 'var(--bg-forhoejet)', color: 'var(--tekst)'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  Slutdato
                </label>
                <input
                  type="date"
                  value={slutdato}
                  onChange={(e) => setSlutdato(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: '8px',
                    border: '1px solid var(--border-svag)', background: 'var(--bg-forhoejet)', color: 'var(--tekst)'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  Antal nætter
                </label>
                <input
                  type="number"
                  min="0"
                  value={naetter}
                  onChange={(e) => setNaetter(parseInt(e.target.value) || 0)}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: '8px',
                    border: '1px solid var(--border-svag)', background: 'var(--bg-forhoejet)', color: 'var(--tekst)'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  Deltagere (antal)
                </label>
                <input
                  type="number"
                  min="1"
                  value={personerAntal}
                  onChange={(e) => setPersonerAntal(parseInt(e.target.value) || 1)}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: '8px',
                    border: '1px solid var(--border-svag)', background: 'var(--bg-forhoejet)', color: 'var(--tekst)'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
              <Knap variant="primaer" onClick={() => setTrin(2)} style={{ flex: 1, padding: '12px' }}>
                Se forslag til pakkeliste →
              </Knap>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '16px' }}>
            {forslag.length === 0 ? (
              <Infokort label="Forslag">
                <div style={{ fontSize: '13px', color: 'var(--tekst-dæmpet)' }}>
                  Ingen særlige forslag fra Smart Motoren endnu. Du kan tilføje grej manuelt bagefter.
                </div>
              </Infokort>
            ) : (
              forslag.map((f) => (
                <Forslagskort
                  key={f.id}
                  forslag={f}
                  aabn={() => {}}
                  tagImod={() => tagImodForslag(f)}
                  afvis={() => oerafvisForslag(f.id)}
                />
              ))
            )}

            {valgteGruppeUids.length > 0 && (
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                  Valgte grupper indtil videre:
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {valgteGruppeUids.map((uid) => {
                    const g = grupper.find((x) => x.uid === uid);
                    return <Chip key={uid} storrelse="lille">{g?.navn || uid}</Chip>;
                  })}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
              <Knap onClick={() => setTrin(1)}>← Tilbage</Knap>
              <Knap variant="primaer" onClick={gemOgOpret} style={{ flex: 1, padding: '12px' }}>
                Opret turen nu
              </Knap>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
