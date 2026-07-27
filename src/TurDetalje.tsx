import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import type { Tur, TurStatus, Overnatning, Aktivitet, Terraen, Erfaring, Deltager, BudgetLinje } from './db';
import { hentVejr, vejrIkonKode, beregnForbrug, findAdvarsler, foreslaaGrupper, soegSted } from './smartMotor';
import type { StedForslag } from './smartMotor';

interface Props {
  turId: number;
  tilbage: () => void;
}

function TurDetalje({ turId, tilbage }: Props) {
  const [tur, setTur] = useState<Tur | null>(null);
  const [menuAaben, setMenuAaben] = useState(false);
  const [aktivSektion, setAktivSektion] = useState<'oversigt' | 'pakkeliste' | 'deltagere' | 'budget'>('oversigt');
  const [vejrData, setVejrData] = useState<VejrData | null>(null);
  const [vejrHentes, setVejrHentes] = useState(false);
  const [vejrFejl, setVejrFejl] = useState('');
  const [koordinatTekst, setKoordinatTekst] = useState('');
  const [koordinatFejl, setKoordinatFejl] = useState('');
  const [stedForslag, setStedForslag] = useState<StedForslag[]>([]);
  const [stedSoeger, setStedSoeger] = useState(false);

  const items = useLiveQuery(() => db.items.toArray());
  const grupper = useLiveQuery(() => db.grupper.toArray());

  useEffect(() => {
    db.ture.get(turId).then((fundet) => {
      setTur(fundet ?? null);
      if (fundet?.koordinater) {
        setKoordinatTekst(`${fundet.koordinater.lat}, ${fundet.koordinater.lng}`);
      }
      if (fundet?.vejrsnapshot) {
        try {
          setVejrData(JSON.parse(fundet.vejrsnapshot));
        } catch {
          setVejrData(null);
        }
      }
    });
  }, [turId]);

  const opdater = async (aendringer: Partial<Tur>) => {
    if (!tur?.id) return;
    const nyTur = { ...tur, ...aendringer, aendret: new Date() };
    await db.ture.update(tur.id, aendringer);
    setTur(nyTur);
  };

  const beregnNaetter = (start: string, slut: string) => {
    if (!start || !slut) return 0;
    const s = new Date(start);
    const e = new Date(slut);
    const diff = Math.floor((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  };

  const skiftDato = async (aendringer: { startdato?: string; slutdato?: string }) => {
    if (!tur) return;
    const nyStart = aendringer.startdato ?? tur.startdato;
    const nySlut = aendringer.slutdato ?? tur.slutdato;
    await opdater({ ...aendringer, naetter: beregnNaetter(nyStart, nySlut) });
  };

  const opdaterKoordinater = async (v: string) => {
    setKoordinatTekst(v);
    setKoordinatFejl('');

    if (v.trim() === '') {
      await opdater({ koordinater: null });
      return;
    }

    const dele = v.split(',').map((s) => s.trim());
    if (dele.length === 2) {
      const lat = parseFloat(dele[0]);
      const lng = parseFloat(dele[1]);
      if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        await opdater({ koordinater: { lat, lng } });
        return;
      }
    }

    setKoordinatFejl('Format: "55.66, 10.05"');
  };
  const soegPaaSted = async () => {
    if (!tur?.sted.trim()) return;
    setStedSoeger(true);
    setStedForslag([]);
    const resultater = await soegSted(tur.sted);
    setStedSoeger(false);
    if (resultater.length === 1) {
      await vaelgSted(resultater[0]);
    } else if (resultater.length > 1) {
      setStedForslag(resultater);
    } else {
      setKoordinatFejl('Ingen resultater for stedet');
    }
  };

  const vaelgSted = async (forslag: StedForslag) => {
    await opdater({
      koordinater: { lat: forslag.lat, lng: forslag.lng }
    });
    setKoordinatTekst(`${forslag.lat}, ${forslag.lng}`);
    setStedForslag([]);
    setKoordinatFejl('');
  };
  const hentVejrForTur = async () => {
    if (!tur?.koordinater) {
      setVejrFejl('Angiv koordinater først (fx 55.66, 10.05)');
      return;
    }
    if (!tur.startdato || !tur.slutdato) {
      setVejrFejl('Angiv start- og slutdato først');
      return;
    }
    setVejrHentes(true);
    setVejrFejl('');
    const data = await hentVejr(tur.koordinater.lat, tur.koordinater.lng, tur.startdato, tur.slutdato);
    setVejrHentes(false);
    if (data) {
      setVejrData(data);
      await opdater({ vejrsnapshot: JSON.stringify(data) });
    } else {
      setVejrFejl('Kunne ikke hente vejrudsigt. Tjek koordinater og dato.');
    }
  };

  const slet = async () => {
    if (!tur?.id) return;
    if (confirm(`Slet turen "${tur.navn}"?`)) {
      await db.ture.delete(tur.id);
      tilbage();
    }
  };

  const skiftStatus = async (nyStatus: TurStatus) => {
    await opdater({ status: nyStatus });
  };

  const toggleGruppe = async (gruppeId: number) => {
    if (!tur) return;
    const er_med = tur.gruppe_ids.includes(gruppeId);
    const nye = er_med
      ? tur.gruppe_ids.filter((id) => id !== gruppeId)
      : [...tur.gruppe_ids, gruppeId];
    await opdater({ gruppe_ids: nye });
  };

  const toggleLoestItem = async (itemId: number) => {
    if (!tur) return;
    const er_med = tur.loese_item_ids.includes(itemId);
    const nye = er_med
      ? tur.loese_item_ids.filter((id) => id !== itemId)
      : [...tur.loese_item_ids, itemId];
    await opdater({ loese_item_ids: nye });
  };

  const tilfoejDeltager = async () => {
    if (!tur) return;
    const navn = prompt('Navn på deltager:');
    if (!navn?.trim()) return;
    const nyDeltager: Deltager = {
      id: crypto.randomUUID(),
      navn: navn.trim(),
      overnatning: null,
      personligt_gear_ids: [],
      baerer_delt_ids: []
    };
    await opdater({ deltagere: [...tur.deltagere, nyDeltager] });
  };

  const fjernDeltager = async (id: string) => {
    if (!tur) return;
    await opdater({ deltagere: tur.deltagere.filter((d) => d.id !== id) });
  };

  const tilfoejBudgetLinje = async () => {
    if (!tur) return;
    const nyLinje: BudgetLinje = {
      id: crypto.randomUUID(),
      kategori: 'gear',
      beskrivelse: '',
      forventet_kr: 0,
      faktisk_kr: 0
    };
    await opdater({ budget_linjer: [...tur.budget_linjer, nyLinje] });
  };

  const opdaterBudgetLinje = async (id: string, aendringer: Partial<BudgetLinje>) => {
    if (!tur) return;
    const nye = tur.budget_linjer.map((l) => l.id === id ? { ...l, ...aendringer } : l);
    await opdater({ budget_linjer: nye });
  };

  const fjernBudgetLinje = async (id: string) => {
    if (!tur) return;
    await opdater({ budget_linjer: tur.budget_linjer.filter((l) => l.id !== id) });
  };

  if (!tur) {
    return <div style={{ padding: '20px' }}>Indlæser...</div>;
  }

  const valgteGrupper = grupper?.filter((g) => g.id && tur.gruppe_ids.includes(g.id)) ?? [];
  const itemIdsFraGrupper = new Set<number>();
  valgteGrupper.forEach((g) => g.item_ids.forEach((id) => itemIdsFraGrupper.add(id)));
  tur.loese_item_ids.forEach((id) => itemIdsFraGrupper.add(id));
  const pakItems = items?.filter((i) => i.id && itemIdsFraGrupper.has(i.id)) ?? [];

  const totalVaegtDelt = pakItems.filter((i) => i.delt).reduce((s, i) => s + i.vaegt_g, 0);
  const totalVaegtPersonligt = pakItems.filter((i) => !i.delt).reduce((s, i) => s + i.vaegt_g, 0);
  const vaegtPrPerson = tur.personer > 0
    ? totalVaegtPersonligt + (totalVaegtDelt / tur.personer)
    : totalVaegtDelt + totalVaegtPersonligt;

  const totalForventet = tur.budget_linjer.reduce((s, l) => s + l.forventet_kr, 0);
  const totalFaktisk = tur.budget_linjer.reduce((s, l) => s + l.faktisk_kr, 0);

  const advarsler = findAdvarsler(pakItems);
  const beregninger = beregnForbrug(tur);
  const gruppeForslag = grupper ? foreslaaGrupper(tur, grupper) : [];

  const statusFarve = (s: TurStatus) => {
    switch (s) {
      case 'kladde': return { bg: '#f0f0f0', tekst: '#666' };
      case 'klar': return { bg: '#e8f0e8', tekst: '#2a6a2a' };
      case 'aktiv': return { bg: '#fff4e0', tekst: '#a06000' };
      case 'afsluttet': return { bg: '#f0f0f0', tekst: '#888' };
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui, sans-serif', maxWidth: '600px', margin: '0 auto', paddingBottom: '80px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <button onClick={tilbage} style={{ background: 'transparent', border: 'none', fontSize: '16px', cursor: 'pointer' }}>
          ‹ Tilbage
        </button>
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setMenuAaben(!menuAaben)}
            style={{ background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', padding: '4px 12px' }}
          >
            ⋯
          </button>
          {menuAaben && (
            <div style={{
              position: 'absolute',
              right: 0,
              top: '100%',
              background: 'white',
              border: '1px solid #ddd',
              borderRadius: '6px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              minWidth: '120px',
              zIndex: 10
            }}>
              <button
                onClick={() => { setMenuAaben(false); slet(); }}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '10px 14px',
                  background: 'transparent',
                  border: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  color: '#c00'
                }}
              >
                Slet tur
              </button>
            </div>
          )}
        </div>
      </div>

      <input
        value={tur.navn}
        onChange={(e) => opdater({ navn: e.target.value })}
        style={{ fontSize: '22px', fontWeight: 500, border: 'none', outline: 'none', width: '100%', marginBottom: '8px' }}
      />

      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px' }}>
        {(['kladde', 'klar', 'aktiv', 'afsluttet'] as TurStatus[]).map((s) => {
          const f = statusFarve(s);
          const erAktiv = tur.status === s;
          return (
            <button
              key={s}
              onClick={() => skiftStatus(s)}
              style={{
                padding: '5px 10px',
                fontSize: '11px',
                background: erAktiv ? f.bg : 'transparent',
                color: erAktiv ? f.tekst : '#999',
                border: `1px solid ${erAktiv ? f.bg : '#ddd'}`,
                borderRadius: '12px',
                cursor: 'pointer',
                textTransform: 'capitalize'
              }}
            >
              {s}
            </button>
          );
        })}
      </div>

      {advarsler.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          {advarsler.map((a, i) => {
            const bg = a.niveau === 'roed' ? '#fee' : '#fff4e0';
            const tekst = a.niveau === 'roed' ? '#c00' : '#a06000';
            return (
              <div key={i} style={{
                padding: '8px 12px',
                background: bg,
                borderLeft: `3px solid ${tekst}`,
                fontSize: '12px',
                color: tekst,
                marginBottom: '4px'
              }}>
                <div style={{ fontWeight: 500 }}>{a.besked}</div>
                <div style={{ fontSize: '11px', opacity: 0.85, marginTop: '2px' }}>{a.detalje}</div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: 'flex', gap: '2px', marginBottom: '16px', borderBottom: '1px solid #eee' }}>
        {(['oversigt', 'pakkeliste', 'deltagere', 'budget'] as const).map((sek) => (
          <button
            key={sek}
            onClick={() => setAktivSektion(sek)}
            style={{
              flex: 1,
              padding: '8px 4px',
              background: 'transparent',
              border: 'none',
              borderBottom: aktivSektion === sek ? '2px solid #333' : '2px solid transparent',
              cursor: 'pointer',
              fontSize: '12px',
              color: aktivSektion === sek ? '#333' : '#888',
              fontWeight: aktivSektion === sek ? 500 : 400,
              textTransform: 'capitalize'
            }}
          >
            {sek}
          </button>
        ))}
      </div>

      {aktivSektion === 'oversigt' && (
        <div style={{ display: 'grid', gap: '12px' }}>
<div>
            <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px' }}>Sted</label>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                type="text"
                value={tur.sted}
                onChange={(e) => opdater({ sted: e.target.value })}
                placeholder="fx Øghaven Naturskole"
                style={{ flex: 1, padding: '8px', fontSize: '14px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box' }}
              />
              <button
                onClick={soegPaaSted}
                disabled={stedSoeger || !tur.sted.trim()}
                style={{
                  padding: '8px 12px',
                  fontSize: '12px',
                  background: stedSoeger || !tur.sted.trim() ? '#eee' : '#333',
                  color: stedSoeger || !tur.sted.trim() ? '#888' : 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: stedSoeger || !tur.sted.trim() ? 'default' : 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                {stedSoeger ? 'Søger...' : 'Find'}
              </button>
            </div>

            {stedForslag.length > 0 && (
              <div style={{ marginTop: '8px', border: '1px solid #ddd', borderRadius: '4px', overflow: 'hidden' }}>
                {stedForslag.map((f, i) => (
                  <button
                    key={i}
                    onClick={() => vaelgSted(f)}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '8px 12px',
                      background: 'white',
                      border: 'none',
                      borderBottom: i < stedForslag.length - 1 ? '1px solid #eee' : 'none',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    <div style={{ fontSize: '13px', fontWeight: 500 }}>{f.navn}</div>
                    {f.detalje && <div style={{ fontSize: '11px', color: '#888' }}>{f.detalje}</div>}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px' }}>
              Koordinater (til vejr)
              {koordinatFejl && <span style={{ color: '#c00', marginLeft: '8px', fontSize: '11px' }}>· {koordinatFejl}</span>}
            </label>
            <input
              type="text"
              value={koordinatTekst}
              onChange={(e) => opdaterKoordinater(e.target.value)}
              placeholder="fx 55.66, 10.05"
              style={{ width: '100%', padding: '8px', fontSize: '14px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <Felt label="Startdato" type="date" value={tur.startdato} onChange={(v) => skiftDato({ startdato: v })} />
            <Felt label="Slutdato" type="date" value={tur.slutdato} onChange={(v) => skiftDato({ slutdato: v })} />
          </div>

          <div style={{ padding: '8px 12px', background: '#f5f5f5', borderRadius: '6px', fontSize: '13px', color: '#666' }}>
            {tur.naetter} {tur.naetter === 1 ? 'nat' : 'nætter'}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <Felt label="Personer" type="number" value={tur.personer} onChange={(v) => opdater({ personer: Number(v) || 1 })} />
            <Felt label="Bæreafstand (km)" type="number" value={tur.baereafstand_km} onChange={(v) => opdater({ baereafstand_km: Number(v) || 0 })} />
          </div>

          <Dropdown label="Overnatning" value={tur.overnatning} onChange={(v) => opdater({ overnatning: v as Overnatning })} options={['haengekoeje', 'telt', 'shelter', 'blandet']} />
          <Dropdown label="Aktivitet" value={tur.aktivitet} onChange={(v) => opdater({ aktivitet: v as Aktivitet })} options={['bushcraft', 'vandretur', 'kano', 'andet']} />
          <Dropdown label="Terræn" value={tur.terraen} onChange={(v) => opdater({ terraen: v as Terraen })} options={['skov', 'kyst', 'fjeld', 'mix']} />
          <Dropdown label="Erfaringsniveau" value={tur.erfaring} onChange={(v) => opdater({ erfaring: v as Erfaring })} options={['begynder', 'oevet', 'erfaren']} />

          <div style={{ padding: '12px', background: '#f9f9f9', borderRadius: '6px' }}>
            <div style={{ fontSize: '11px', color: '#666', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Beregninger</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', fontSize: '13px' }}>
              <div>
                <div style={{ fontSize: '18px', fontWeight: 500 }}>{beregninger.vand_liter} L</div>
                <div style={{ fontSize: '10px', color: '#888' }}>Vand</div>
              </div>
              <div>
                <div style={{ fontSize: '18px', fontWeight: 500 }}>{beregninger.mad_kg} kg</div>
                <div style={{ fontSize: '10px', color: '#888' }}>Mad (tørkost)</div>
              </div>
              <div>
                <div style={{ fontSize: '18px', fontWeight: 500 }}>{beregninger.gas_g} g</div>
                <div style={{ fontSize: '10px', color: '#888' }}>Gas</div>
              </div>
            </div>
          </div>

          <div style={{ border: '1px solid #ddd', borderRadius: '6px', padding: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ fontSize: '11px', color: '#666', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Vejrudsigt</div>
              <button
                onClick={hentVejrForTur}
                disabled={vejrHentes}
                style={{
                  padding: '4px 10px',
                  fontSize: '11px',
                  background: vejrHentes ? '#eee' : '#333',
                  color: vejrHentes ? '#888' : 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: vejrHentes ? 'default' : 'pointer'
                }}
              >
                {vejrHentes ? 'Henter...' : vejrData ? 'Opdater' : 'Hent vejr'}
              </button>
            </div>

            {vejrFejl && (
              <div style={{ fontSize: '12px', color: '#c00', marginBottom: '8px' }}>{vejrFejl}</div>
            )}

            {vejrData && (
              <>
                <div style={{ display: 'grid', gap: '4px', fontSize: '13px' }}>
                  {vejrData.dage.map((d) => (
                    <div key={d.dato} style={{ display: 'grid', gridTemplateColumns: '60px 24px 1fr 60px 50px', gap: '8px', alignItems: 'center', padding: '4px 0' }}>
                      <span style={{ color: '#666', fontSize: '11px' }}>{formatterDag(d.dato)}</span>
                      <span style={{ fontSize: '16px' }}>{vejrIkonKode(d.vejrkode)}</span>
                      <span>{d.temp_min}–{d.temp_max}°C</span>
                      <span style={{ color: '#888', fontSize: '11px' }}>{d.vind_ms} m/s</span>
                      <span style={{ color: d.nedboer_mm > 0 ? '#a06000' : '#888', fontSize: '11px', textAlign: 'right' }}>
                        {d.nedboer_mm > 0 ? `${d.nedboer_mm} mm` : '—'}
                      </span>
                    </div>
                  ))}
                </div>

                {vejrData.dage[0] && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#888', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #eee' }}>
                    <span>Sol op {vejrData.dage[0].sol_op}</span>
                    <span>Sol ned {vejrData.dage[0].sol_ned}</span>
                  </div>
                )}

                {vejrData.observationer.length > 0 && (
                  <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #eee' }}>
                    {vejrData.observationer.map((obs, i) => (
                      <div key={i} style={{ fontSize: '11px', color: '#666', marginBottom: '3px' }}>· {obs}</div>
                    ))}
                  </div>
                )}
              </>
            )}

            {!vejrData && !vejrFejl && (
              <div style={{ fontSize: '12px', color: '#888' }}>
                Angiv koordinater og datoer, klik "Hent vejr".
              </div>
            )}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px' }}>Besked til gæster</label>
            <textarea
              value={tur.besked_fra_ejer}
              onChange={(e) => opdater({ besked_fra_ejer: e.target.value })}
              rows={2}
              placeholder="fx Vi mødes ved P kl. 15. Husk regntøj."
              style={{ width: '100%', padding: '8px', fontSize: '14px', border: '1px solid #ddd', borderRadius: '4px', fontFamily: 'inherit', resize: 'vertical' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px' }}>Noter</label>
            <textarea
              value={tur.noter}
              onChange={(e) => opdater({ noter: e.target.value })}
              rows={2}
              style={{ width: '100%', padding: '8px', fontSize: '14px', border: '1px solid #ddd', borderRadius: '4px', fontFamily: 'inherit', resize: 'vertical' }}
            />
          </div>
        </div>
      )}

      {aktivSektion === 'pakkeliste' && (
        <div>
          <div style={{ padding: '10px 12px', background: '#f5f5f5', borderRadius: '6px', fontSize: '13px', color: '#666', marginBottom: '16px' }}>
            {pakItems.length} items · {(vaegtPrPerson / 1000).toFixed(2)} kg pr. person
            <div style={{ fontSize: '11px', color: '#999', marginTop: '2px' }}>
              Delt: {(totalVaegtDelt / 1000).toFixed(2)} kg · Personligt: {(totalVaegtPersonligt / 1000).toFixed(2)} kg
            </div>
          </div>

          {gruppeForslag.length > 0 && (
            <div style={{ padding: '10px 12px', background: '#eef5fb', borderRadius: '6px', marginBottom: '16px' }}>
              <div style={{ fontSize: '11px', color: '#2a5a8a', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Foreslåede grupper</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {gruppeForslag.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => g.id && toggleGruppe(g.id)}
                    style={{
                      padding: '4px 10px',
                      fontSize: '12px',
                      background: 'white',
                      color: '#2a5a8a',
                      border: '1px solid #b8d4ea',
                      borderRadius: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    + {g.navn}
                  </button>
                ))}
              </div>
            </div>
          )}

          <h4 style={{ fontSize: '13px', color: '#666', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Grupper</h4>
          {grupper?.length === 0 && (
            <p style={{ fontSize: '13px', color: '#888' }}>Ingen grupper endnu.</p>
          )}
          {grupper?.map((g) => {
            const er_med = g.id ? tur.gruppe_ids.includes(g.id) : false;
            const gItems = items?.filter((i) => i.id && g.item_ids.includes(i.id)) ?? [];
            const gVaegt = gItems.reduce((s, i) => s + i.vaegt_g, 0);
            return (
              <label
                key={g.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px',
                  borderBottom: '1px solid #eee',
                  cursor: 'pointer',
                  background: er_med ? '#f0f7f0' : 'transparent'
                }}
              >
                <input type="checkbox" checked={er_med} onChange={() => g.id && toggleGruppe(g.id)} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px' }}>{g.navn}</div>
                  <div style={{ fontSize: '11px', color: '#666' }}>
                    {gItems.length} items · {(gVaegt / 1000).toFixed(2)} kg
                  </div>
                </div>
              </label>
            );
          })}

          <h4 style={{ fontSize: '13px', color: '#666', marginTop: '20px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Løse items</h4>
          {items?.filter((i) => i.status === 'ejer').map((item) => {
            const er_med = item.id ? tur.loese_item_ids.includes(item.id) : false;
            const via_gruppe = item.id ? itemIdsFraGrupper.has(item.id) && !er_med : false;
            return (
              <label
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 10px',
                  borderBottom: '1px solid #eee',
                  cursor: via_gruppe ? 'default' : 'pointer',
                  opacity: via_gruppe ? 0.5 : 1,
                  background: er_med ? '#f0f7f0' : 'transparent'
                }}
              >
                <input
                  type="checkbox"
                  checked={er_med || via_gruppe}
                  disabled={via_gruppe}
                  onChange={() => item.id && toggleLoestItem(item.id)}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px' }}>{item.navn}</div>
                  <div style={{ fontSize: '10px', color: '#888' }}>
                    {item.vaegt_g} g{item.delt && ' · delt'}
                    {via_gruppe && ' · via gruppe'}
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      )}

      {aktivSektion === 'deltagere' && (
        <div>
          <div style={{ padding: '10px 12px', background: '#f5f5f5', borderRadius: '6px', fontSize: '13px', color: '#666', marginBottom: '16px' }}>
            {tur.deltagere.length} deltagere tilføjet (foruden dig selv)
          </div>

          {tur.deltagere.length === 0 && (
            <p style={{ fontSize: '13px', color: '#888' }}>Ingen deltagere endnu.</p>
          )}
          {tur.deltagere.map((d) => (
            <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', borderBottom: '1px solid #eee' }}>
              <div style={{ flex: 1, fontSize: '14px' }}>{d.navn}</div>
              <button
                onClick={() => fjernDeltager(d.id)}
                style={{ background: 'transparent', border: 'none', color: '#c00', cursor: 'pointer', fontSize: '12px' }}
              >
                Fjern
              </button>
            </div>
          ))}

          <button
            onClick={tilfoejDeltager}
            style={{ marginTop: '16px', padding: '10px 16px', fontSize: '13px', background: '#333', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            + Tilføj deltager
          </button>
        </div>
      )}

      {aktivSektion === 'budget' && (
        <div>
          <div style={{ padding: '10px 12px', background: '#f5f5f5', borderRadius: '6px', fontSize: '13px', color: '#666', marginBottom: '16px' }}>
            Forventet: {totalForventet} kr · Faktisk: {totalFaktisk} kr
          </div>

          {tur.budget_linjer.length === 0 && (
            <p style={{ fontSize: '13px', color: '#888' }}>Ingen budget-linjer endnu.</p>
          )}
          {tur.budget_linjer.map((l) => (
            <div key={l.id} style={{ padding: '10px', borderBottom: '1px solid #eee', display: 'grid', gap: '6px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                <select
                  value={l.kategori}
                  onChange={(e) => opdaterBudgetLinje(l.id, { kategori: e.target.value })}
                  style={{ padding: '6px', fontSize: '12px', border: '1px solid #ddd', borderRadius: '4px' }}
                >
                  <option value="gear">Gear</option>
                  <option value="forplejning">Forplejning</option>
                  <option value="transport">Transport</option>
                  <option value="andet">Andet</option>
                </select>
                <input
                  placeholder="Beskrivelse"
                  value={l.beskrivelse}
                  onChange={(e) => opdaterBudgetLinje(l.id, { beskrivelse: e.target.value })}
                  style={{ padding: '6px', fontSize: '12px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '6px', alignItems: 'center' }}>
                <input
                  type="number"
                  placeholder="Forventet"
                  value={l.forventet_kr}
                  onChange={(e) => opdaterBudgetLinje(l.id, { forventet_kr: Number(e.target.value) || 0 })}
                  style={{ padding: '6px', fontSize: '12px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
                <input
                  type="number"
                  placeholder="Faktisk"
                  value={l.faktisk_kr}
                  onChange={(e) => opdaterBudgetLinje(l.id, { faktisk_kr: Number(e.target.value) || 0 })}
                  style={{ padding: '6px', fontSize: '12px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
                <button
                  onClick={() => fjernBudgetLinje(l.id)}
                  style={{ background: 'transparent', border: 'none', color: '#c00', cursor: 'pointer', fontSize: '12px' }}
                >
                  ×
                </button>
              </div>
            </div>
          ))}

          <button
            onClick={tilfoejBudgetLinje}
            style={{ marginTop: '16px', padding: '10px 16px', fontSize: '13px', background: '#333', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            + Tilføj linje
          </button>
        </div>
      )}
    </div>
  );
}

function formatterDag(dato: string): string {
  const d = new Date(dato);
  const dage = ['søn', 'man', 'tir', 'ons', 'tor', 'fre', 'lør'];
  return `${dage[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
}

interface FeltProps {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}

function Felt({ label, value, onChange, type = 'text', placeholder }: FeltProps) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px' }}>{label}</label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: '100%', padding: '8px', fontSize: '14px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box' }}
      />
    </div>
  );
}

interface DropdownProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}

function Dropdown({ label, value, onChange, options }: DropdownProps) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px' }}>{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: '100%', padding: '8px', fontSize: '14px', border: '1px solid #ddd', borderRadius: '4px', textTransform: 'capitalize' }}
      >
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}

export default TurDetalje;