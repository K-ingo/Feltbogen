import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, TUR_STATUS, OVERNATNING, AKTIVITET, TERRAEN, ERFARING } from './db';
import type { Overnatning, Aktivitet, Terraen, Erfaring, Deltager, BudgetLinje } from './db';
import {
  hentVejr,
  vejrIkonKode,
  beregnForbrug,
  findAdvarsler,
  foreslaaGrupper,
  itemIdsPaaTur,
  soegSted
} from './smartMotor';
import type { VejrData, StedForslag } from './smartMotor';
import {
  Knap,
  Felt,
  Label,
  Dropdown,
  Kort,
  Segment,
  Tekstomraade,
  TitelInput,
  DetaljeHeader,
  Indlaeser,
  SektionsTitel
} from './ui';
import { layout } from './layout';
import { sletTur, opdaterTur } from './sync';
import { useRedigerbar } from './useRedigerbar';

interface Props {
  turId: number;
  tilbage: () => void;
}

type Sektion = 'oversigt' | 'pakkeliste' | 'deltagere' | 'budget';
const SEKTIONER: readonly Sektion[] = ['oversigt', 'pakkeliste', 'deltagere', 'budget'];

function TurDetalje({ turId, tilbage }: Props) {
  const [aktivSektion, setAktivSektion] = useState<Sektion>('oversigt');
  const [vejrData, setVejrData] = useState<VejrData | null>(null);
  const [vejrHentes, setVejrHentes] = useState(false);
  const [vejrFejl, setVejrFejl] = useState('');
  const [koordinatTekst, setKoordinatTekst] = useState('');
  const [koordinatFejl, setKoordinatFejl] = useState('');
  const [stedForslag, setStedForslag] = useState<StedForslag[]>([]);
  const [stedSoeger, setStedSoeger] = useState(false);

  const items = useLiveQuery(() => db.items.toArray());
  const grupper = useLiveQuery(() => db.grupper.toArray());

  const { post: tur, opdater } = useRedigerbar(db.ture, turId, opdaterTur, {
    onIndlaest: (fundet) => {
      if (fundet.koordinater) {
        setKoordinatTekst(`${fundet.koordinater.lat}, ${fundet.koordinater.lng}`);
      }
      if (fundet.vejrsnapshot) {
        try {
          setVejrData(JSON.parse(fundet.vejrsnapshot));
        } catch {
          setVejrData(null);
        }
      }
    }
  });

  const skiftDato = async (aendringer: { startdato?: string; slutdato?: string }) => {
    if (!tur) return;
    const start = aendringer.startdato ?? tur.startdato;
    const slut = aendringer.slutdato ?? tur.slutdato;
    await opdater({ ...aendringer, naetter: beregnNaetter(start, slut) });
  };

  const opdaterKoordinater = async (v: string) => {
    setKoordinatTekst(v);
    setKoordinatFejl('');

    if (v.trim() === '') {
      await opdater({ koordinater: null });
      return;
    }

    const koordinater = laesKoordinater(v);
    if (koordinater) {
      await opdater({ koordinater });
      return;
    }
    setKoordinatFejl('Format: 55.66, 10.05');
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
      setKoordinatFejl('Ingen resultater');
    }
  };

  const vaelgSted = async (forslag: StedForslag) => {
    await opdater({ koordinater: { lat: forslag.lat, lng: forslag.lng } });
    setKoordinatTekst(`${forslag.lat}, ${forslag.lng}`);
    setStedForslag([]);
    setKoordinatFejl('');
  };

  const hentVejrForTur = async () => {
    if (!tur?.koordinater) { setVejrFejl('Angiv koordinater først'); return; }
    if (!tur.startdato || !tur.slutdato) { setVejrFejl('Angiv datoer først'); return; }

    setVejrHentes(true);
    setVejrFejl('');
    const data = await hentVejr(tur.koordinater.lat, tur.koordinater.lng, tur.startdato, tur.slutdato);
    setVejrHentes(false);

    if (data) {
      setVejrData(data);
      await opdater({ vejrsnapshot: JSON.stringify(data) });
    } else {
      setVejrFejl('Kunne ikke hente vejrudsigt');
    }
  };

  const slet = async () => {
    if (tur?.id === undefined) return;
    if (confirm(`Slet turen "${tur.navn}"?`)) {
      await sletTur(tur.id);
      tilbage();
    }
  };

  const toggleGruppe = async (gruppeId: number) => {
    if (!tur) return;
    await opdater({ gruppe_ids: vekslet(tur.gruppe_ids, gruppeId) });
  };

  const toggleLoestItem = async (itemId: number) => {
    if (!tur) return;
    await opdater({ loese_item_ids: vekslet(tur.loese_item_ids, itemId) });
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
    await opdater({
      budget_linjer: tur.budget_linjer.map((l) => (l.id === id ? { ...l, ...aendringer } : l))
    });
  };

  const fjernBudgetLinje = async (id: string) => {
    if (!tur) return;
    await opdater({ budget_linjer: tur.budget_linjer.filter((l) => l.id !== id) });
  };

  if (!tur) return <Indlaeser />;

  const itemIdsPaaDenneTur = itemIdsPaaTur(tur, grupper ?? []);
  const pakItems = items?.filter((i) => i.id !== undefined && itemIdsPaaDenneTur.has(i.id)) ?? [];

  const vaegtDelt = pakItems.filter((i) => i.delt).reduce((s, i) => s + i.vaegt_g, 0);
  const vaegtPersonligt = pakItems.filter((i) => !i.delt).reduce((s, i) => s + i.vaegt_g, 0);
  // Delt gear bæres af én, men vises fair fordelt over deltagerne.
  const vaegtPrPerson = tur.personer > 0
    ? vaegtPersonligt + vaegtDelt / tur.personer
    : vaegtPersonligt + vaegtDelt;

  const totalForventet = tur.budget_linjer.reduce((s, l) => s + l.forventet_kr, 0);
  const totalFaktisk = tur.budget_linjer.reduce((s, l) => s + l.faktisk_kr, 0);

  const advarsler = findAdvarsler(pakItems);
  const beregninger = beregnForbrug(tur);
  const gruppeForslag = grupper ? foreslaaGrupper(tur, grupper) : [];

  return (
    <div style={layout.container}>
      <DetaljeHeader tilbage={tilbage} sletLabel="Slet tur" slet={slet} />

      <TitelInput value={tur.navn} onChange={(v) => opdater({ navn: v })} />

      <div style={{ marginBottom: '20px' }}>
        <Segment vaerdier={TUR_STATUS} valgt={tur.status} vaelg={(s) => opdater({ status: s })} kompakt />
      </div>

      {advarsler.length > 0 && (
        <div style={{ marginBottom: '20px', display: 'grid', gap: '6px' }}>
          {advarsler.map((a, i) => {
            const erRoed = a.niveau === 'roed';
            return (
              <div
                key={i}
                style={{
                  padding: '10px 12px',
                  background: erRoed ? 'var(--fejl-bg)' : 'var(--advarsel-bg)',
                  borderLeft: `3px solid ${erRoed ? 'var(--fejl)' : 'var(--advarsel)'}`,
                  borderRadius: '4px',
                  fontSize: '12px'
                }}
              >
                <div style={{ fontWeight: 500, color: erRoed ? 'var(--fejl)' : 'var(--advarsel)' }}>{a.besked}</div>
                <div style={{ fontSize: '11px', color: 'var(--tekst-dæmpet)', marginTop: '2px' }}>{a.detalje}</div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: 'flex', gap: '2px', marginBottom: '20px', borderBottom: '1px solid var(--border-svag)' }}>
        {SEKTIONER.map((sek) => (
          <button
            key={sek}
            onClick={() => setAktivSektion(sek)}
            style={{
              flex: 1,
              padding: '10px 4px',
              background: 'transparent',
              border: 'none',
              borderBottom: aktivSektion === sek ? '2px solid var(--accent)' : '2px solid transparent',
              cursor: 'pointer',
              fontSize: '11px',
              color: aktivSektion === sek ? 'var(--accent)' : 'var(--tekst-dæmpet)',
              fontWeight: aktivSektion === sek ? 600 : 500,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '-1px'
            }}
          >
            {sek}
          </button>
        ))}
      </div>

      {aktivSektion === 'oversigt' && (
        <div style={{ display: 'grid', gap: '14px' }}>
          <div>
            <Label>Sted</Label>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                value={tur.sted}
                onChange={(e) => opdater({ sted: e.target.value })}
                placeholder="fx Palnatokesvej 22, Odense"
                style={{ flex: 1 }}
              />
              <Knap onClick={soegPaaSted} disabled={stedSoeger || !tur.sted.trim()} variant="primaer">
                {stedSoeger ? 'Søger...' : 'Find'}
              </Knap>
            </div>
            {stedForslag.length > 0 && (
              <div style={{ marginTop: '6px', background: 'var(--bg-forhoejet)', border: '1px solid var(--border-svag)', borderRadius: '8px', overflow: 'hidden' }}>
                {stedForslag.map((f, i) => (
                  <button
                    key={`${f.lat},${f.lng}`}
                    onClick={() => vaelgSted(f)}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '10px 12px',
                      background: 'transparent',
                      border: 'none',
                      borderBottom: i < stedForslag.length - 1 ? '1px solid var(--border-svag)' : 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                      color: 'var(--tekst)'
                    }}
                  >
                    <div style={{ fontSize: '13px', fontWeight: 500 }}>{f.navn}</div>
                    {f.detalje && <div style={{ fontSize: '11px', color: 'var(--tekst-dæmpet)' }}>{f.detalje}</div>}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label fejl={koordinatFejl || undefined}>Koordinater</Label>
            <input
              type="text"
              value={koordinatTekst}
              onChange={(e) => opdaterKoordinater(e.target.value)}
              placeholder="55.66, 10.05"
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <Felt label="Startdato" type="date" value={tur.startdato} onChange={(v) => skiftDato({ startdato: v })} />
            <Felt label="Slutdato" type="date" value={tur.slutdato} onChange={(v) => skiftDato({ slutdato: v })} />
          </div>

          <Kort fremhaevet>
            <div style={{ fontSize: '13px', color: 'var(--tekst)' }}>
              {tur.naetter} {tur.naetter === 1 ? 'nat' : 'nætter'}
            </div>
          </Kort>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <Felt label="Personer" type="number" value={tur.personer} onChange={(v) => opdater({ personer: Number(v) || 1 })} />
            <Felt label="Bæreafstand (km)" type="number" value={tur.baereafstand_km} onChange={(v) => opdater({ baereafstand_km: Number(v) || 0 })} />
          </div>

          <Dropdown label="Overnatning" value={tur.overnatning} onChange={(v) => opdater({ overnatning: v as Overnatning })} options={OVERNATNING} />
          <Dropdown label="Aktivitet" value={tur.aktivitet} onChange={(v) => opdater({ aktivitet: v as Aktivitet })} options={AKTIVITET} />
          <Dropdown label="Terræn" value={tur.terraen} onChange={(v) => opdater({ terraen: v as Terraen })} options={TERRAEN} />
          <Dropdown label="Erfaring" value={tur.erfaring} onChange={(v) => opdater({ erfaring: v as Erfaring })} options={ERFARING} />

          <div style={{ height: '4px' }} />
          <SektionsTitel>Beregninger</SektionsTitel>
          <Kort fremhaevet>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', textAlign: 'center' }}>
              <Noegletal vaerdi={`${beregninger.vand_liter} L`} label="Vand" />
              <Noegletal vaerdi={`${beregninger.mad_kg} kg`} label="Mad" />
              <Noegletal vaerdi={`${beregninger.gas_g} g`} label="Gas" />
            </div>
          </Kort>

          <div style={{ height: '4px' }} />
          <SektionsTitel>Vejrudsigt</SektionsTitel>
          <Kort fremhaevet>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
              <Knap onClick={hentVejrForTur} disabled={vejrHentes} variant="primaer" style={{ padding: '5px 12px', fontSize: '11px' }}>
                {vejrHentes ? 'Henter...' : vejrData ? 'Opdater' : 'Hent vejr'}
              </Knap>
            </div>

            {vejrFejl && <div style={{ fontSize: '12px', color: 'var(--fejl)', marginBottom: '8px' }}>{vejrFejl}</div>}

            {vejrData ? (
              <>
                <div style={{ display: 'grid', gap: '6px', fontSize: '13px' }}>
                  {vejrData.dage.map((d) => (
                    <div key={d.dato} style={{ display: 'grid', gridTemplateColumns: '60px 24px 1fr 60px 50px', gap: '8px', alignItems: 'center', padding: '4px 0' }}>
                      <span style={{ color: 'var(--tekst-dæmpet)', fontSize: '11px' }}>{formatterDag(d.dato)}</span>
                      <span style={{ fontSize: '16px' }}>{vejrIkonKode(d.vejrkode)}</span>
                      <span>{d.temp_min}–{d.temp_max}°C</span>
                      <span style={{ color: 'var(--tekst-svag)', fontSize: '11px' }}>{d.vind_ms} m/s</span>
                      <span style={{ color: d.nedboer_mm > 0 ? 'var(--advarsel)' : 'var(--tekst-svag)', fontSize: '11px', textAlign: 'right' }}>
                        {d.nedboer_mm > 0 ? `${d.nedboer_mm} mm` : '—'}
                      </span>
                    </div>
                  ))}
                </div>
                {vejrData.dage[0] && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--tekst-dæmpet)', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border-svag)' }}>
                    <span>Sol op {vejrData.dage[0].sol_op}</span>
                    <span>Sol ned {vejrData.dage[0].sol_ned}</span>
                  </div>
                )}
                {vejrData.observationer.length > 0 && (
                  <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border-svag)' }}>
                    {vejrData.observationer.map((obs, i) => (
                      <div key={i} style={{ fontSize: '11px', color: 'var(--tekst-dæmpet)', marginBottom: '3px' }}>· {obs}</div>
                    ))}
                  </div>
                )}
              </>
            ) : !vejrFejl && (
              <div style={{ fontSize: '12px', color: 'var(--tekst-svag)' }}>Angiv koordinater og datoer, klik "Hent vejr".</div>
            )}
          </Kort>

          <Tekstomraade
            label="Besked til gæster"
            value={tur.besked_fra_ejer}
            onChange={(v) => opdater({ besked_fra_ejer: v })}
            placeholder="fx Vi mødes ved P kl. 15"
          />
          <Tekstomraade label="Noter" value={tur.noter} onChange={(v) => opdater({ noter: v })} />
        </div>
      )}

      {aktivSektion === 'pakkeliste' && (
        <div>
          <Kort fremhaevet style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '14px', fontWeight: 500 }}>
              {pakItems.length} items · {(vaegtPrPerson / 1000).toFixed(2)} kg pr. person
            </div>
            <div style={{ fontSize: '11px', color: 'var(--tekst-dæmpet)', marginTop: '2px' }}>
              Delt: {(vaegtDelt / 1000).toFixed(2)} kg · Personligt: {(vaegtPersonligt / 1000).toFixed(2)} kg
            </div>
          </Kort>

          {gruppeForslag.length > 0 && (
            <div style={{ padding: '12px', background: 'var(--accent-bg)', borderRadius: '8px', marginBottom: '16px' }}>
              <SektionsTitel>Foreslåede grupper</SektionsTitel>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {gruppeForslag.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => g.id !== undefined && toggleGruppe(g.id)}
                    style={{ padding: '5px 12px', fontSize: '12px', background: 'var(--bg-forhoejet)', color: 'var(--accent)', border: '1px solid var(--accent-border)', borderRadius: '14px', cursor: 'pointer', fontWeight: 500 }}
                  >
                    + {g.navn}
                  </button>
                ))}
              </div>
            </div>
          )}

          <SektionsTitel>Grupper</SektionsTitel>
          {grupper?.length === 0 && (
            <div style={{ fontSize: '13px', color: 'var(--tekst-svag)', padding: '10px 0' }}>Ingen grupper endnu.</div>
          )}
          {grupper?.map((g) => {
            const erMed = g.id !== undefined && tur.gruppe_ids.includes(g.id);
            const gItems = items?.filter((i) => i.id !== undefined && g.item_ids.includes(i.id)) ?? [];
            const gVaegt = gItems.reduce((s, i) => s + i.vaegt_g, 0);
            return (
              <Vaelgerraekke
                key={g.id}
                titel={g.navn}
                detalje={`${gItems.length} items · ${(gVaegt / 1000).toFixed(2)} kg`}
                valgt={erMed}
                toggle={() => g.id !== undefined && toggleGruppe(g.id)}
              />
            );
          })}

          <div style={{ marginTop: '20px' }}>
            <SektionsTitel>Løse items</SektionsTitel>
            {items?.filter((i) => i.status === 'ejer').map((item) => {
              const valgtLoest = item.id !== undefined && tur.loese_item_ids.includes(item.id);
              // Items der allerede kommer via en gruppe kan ikke fravælges her.
              const viaGruppe = item.id !== undefined && itemIdsPaaDenneTur.has(item.id) && !valgtLoest;
              return (
                <Vaelgerraekke
                  key={item.id}
                  titel={item.navn}
                  detalje={`${item.vaegt_g} g${item.delt ? ' · delt' : ''}${viaGruppe ? ' · via gruppe' : ''}`}
                  valgt={valgtLoest || viaGruppe}
                  laast={viaGruppe}
                  toggle={() => item.id !== undefined && toggleLoestItem(item.id)}
                />
              );
            })}
          </div>
        </div>
      )}

      {aktivSektion === 'deltagere' && (
        <div>
          <Kort fremhaevet style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '14px', fontWeight: 500 }}>{tur.deltagere.length} deltagere</div>
            <div style={{ fontSize: '11px', color: 'var(--tekst-dæmpet)', marginTop: '2px' }}>Foruden dig selv</div>
          </Kort>

          {tur.deltagere.length === 0 && (
            <div style={{ fontSize: '13px', color: 'var(--tekst-svag)', padding: '10px 0' }}>Ingen deltagere endnu.</div>
          )}
          {tur.deltagere.map((d) => (
            <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 4px', borderBottom: '1px solid var(--border-svag)' }}>
              <div style={{ flex: 1, fontSize: '14px', color: 'var(--tekst)' }}>{d.navn}</div>
              <button onClick={() => fjernDeltager(d.id)} style={{ background: 'transparent', border: 'none', color: 'var(--fejl)', cursor: 'pointer', fontSize: '12px' }}>
                Fjern
              </button>
            </div>
          ))}

          <div style={{ marginTop: '16px' }}>
            <Knap onClick={tilfoejDeltager} variant="primaer">+ Tilføj deltager</Knap>
          </div>
        </div>
      )}

      {aktivSektion === 'budget' && (
        <div>
          <Kort fremhaevet style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Noegletal vaerdi={`${totalForventet} kr`} label="Forventet" />
              <div style={{ textAlign: 'right' }}>
                <Noegletal vaerdi={`${totalFaktisk} kr`} label="Faktisk" />
              </div>
            </div>
          </Kort>

          {tur.budget_linjer.length === 0 && (
            <div style={{ fontSize: '13px', color: 'var(--tekst-svag)', padding: '10px 0' }}>Ingen budget-linjer endnu.</div>
          )}
          {tur.budget_linjer.map((l) => (
            <div key={l.id} style={{ padding: '10px 4px', borderBottom: '1px solid var(--border-svag)', display: 'grid', gap: '6px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                <select value={l.kategori} onChange={(e) => opdaterBudgetLinje(l.id, { kategori: e.target.value })} style={{ padding: '6px', fontSize: '12px' }}>
                  <option value="gear">Gear</option>
                  <option value="forplejning">Forplejning</option>
                  <option value="transport">Transport</option>
                  <option value="andet">Andet</option>
                </select>
                <input placeholder="Beskrivelse" value={l.beskrivelse} onChange={(e) => opdaterBudgetLinje(l.id, { beskrivelse: e.target.value })} style={{ padding: '6px', fontSize: '12px' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '6px', alignItems: 'center' }}>
                <input type="number" placeholder="Forventet" value={l.forventet_kr} onChange={(e) => opdaterBudgetLinje(l.id, { forventet_kr: Number(e.target.value) || 0 })} style={{ padding: '6px', fontSize: '12px' }} />
                <input type="number" placeholder="Faktisk" value={l.faktisk_kr} onChange={(e) => opdaterBudgetLinje(l.id, { faktisk_kr: Number(e.target.value) || 0 })} style={{ padding: '6px', fontSize: '12px' }} />
                <button onClick={() => fjernBudgetLinje(l.id)} style={{ background: 'transparent', border: 'none', color: 'var(--fejl)', cursor: 'pointer', fontSize: '14px', padding: '0 8px' }}>
                  ×
                </button>
              </div>
            </div>
          ))}

          <div style={{ marginTop: '16px' }}>
            <Knap onClick={tilfoejBudgetLinje} variant="primaer">+ Tilføj linje</Knap>
          </div>
        </div>
      )}
    </div>
  );
}

// Afkrydsningsrække brugt til både grupper og løse items i pakkelisten.
function Vaelgerraekke({ titel, detalje, valgt, laast, toggle }: {
  titel: string;
  detalje: string;
  valgt: boolean;
  laast?: boolean;
  toggle: () => void;
}) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '10px 12px',
        borderRadius: '8px',
        cursor: laast ? 'default' : 'pointer',
        opacity: laast ? 0.5 : 1,
        background: valgt && !laast ? 'var(--accent-bg)' : 'transparent',
        marginBottom: '2px'
      }}
    >
      <input type="checkbox" checked={valgt} disabled={laast} onChange={toggle} style={{ width: 'auto' }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '13px', color: 'var(--tekst)' }}>{titel}</div>
        <div style={{ fontSize: '11px', color: 'var(--tekst-dæmpet)' }}>{detalje}</div>
      </div>
    </label>
  );
}

function Noegletal({ vaerdi, label }: { vaerdi: string; label: string }) {
  return (
    <div>
      <div style={{ fontSize: '20px', fontWeight: 500, fontFamily: "'Fraunces', Georgia, serif" }}>{vaerdi}</div>
      <div style={{ fontSize: '10px', color: 'var(--tekst-dæmpet)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
    </div>
  );
}

function beregnNaetter(start: string, slut: string): number {
  if (!start || !slut) return 0;
  const dage = (new Date(slut).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24);
  return Math.max(0, Math.floor(dage));
}

// "55.66, 10.05" → koordinater, eller null hvis det ikke er et gyldigt par.
function laesKoordinater(tekst: string): { lat: number; lng: number } | null {
  const dele = tekst.split(',').map((s) => s.trim());
  if (dele.length !== 2) return null;

  const lat = parseFloat(dele[0]);
  const lng = parseFloat(dele[1]);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  return { lat, lng };
}

// Slår et id til eller fra i en liste.
function vekslet(ids: number[], id: number): number[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

function formatterDag(dato: string): string {
  const d = new Date(dato);
  const dage = ['søn', 'man', 'tir', 'ons', 'tor', 'fre', 'lør'];
  return `${dage[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
}

export default TurDetalje;
