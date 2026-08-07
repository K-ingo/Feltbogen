import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, ITEM_STATUS } from './db';
import type { Item, Tur, Garanti } from './db';
import TagsInput from './TagsInput';
import { turePrItem } from './statistik';
import { brugPrItem } from './pakAfTjek';
import type { Brug } from './pakAfTjek';
import { garantiAdvarsel } from './smartMotor';
import {
  Felt,
  Feltkort,
  Infokort,
  Kort,
  SektionsTitel,
  Segment,
  Tekstomraade,
  TitelInput,
  DetaljeHeader,
  Indlaeser
} from './ui';
import { layout } from './layout';
import { sletItem, opdaterItem } from './sync';
import { useRedigerbar } from './useRedigerbar';

interface Props {
  itemId: number;
  tilbage: () => void;
  // Sat når posten netop er oprettet fra listen, så den kan ryddes væk igen
  // hvis man fortryder uden at give den navn.
  nyOprettet?: boolean;
}

// Felter tilføjet efter de første items blev oprettet kan mangle på gamle poster.
function medStandardfelter(item: Item): Item {
  return {
    ...item,
    kraever: item.kraever ?? [],
    komplementer: item.komplementer ?? [],
    koebslink: item.koebslink ?? '',
    ordrenummer: item.ordrenummer ?? '',
    garanti: item.garanti ?? null
  };
}

function ItemDetalje({ itemId, tilbage, nyOprettet }: Props) {
  const [garantiAaben, setGarantiAaben] = useState(false);

  const { post: item, opdater } = useRedigerbar(db.items, itemId, opdaterItem, {
    normaliser: medStandardfelter
  });

  const ture = useLiveQuery(() => db.ture.toArray()) ?? [];
  const grupper = useLiveQuery(() => db.grupper.toArray()) ?? [];

  const opdaterGaranti = async (aendringer: Partial<Garanti>) => {
    if (!item) return;
    await opdater({
      garanti: {
        laengde_aar: item.garanti?.laengde_aar ?? 0,
        udloeber_dato: item.garanti?.udloeber_dato ?? '',
        paamindelse_dage: item.garanti?.paamindelse_dage ?? 30,
        ...aendringer
      }
    });
  };

  const slet = async () => {
    if (item?.id === undefined) return;
    if (confirm(`Slet "${item.navn}"?`)) {
      await sletItem(item.id);
      tilbage();
    }
  };

  if (!item) return <Indlaeser />;

  const turePaaItem = turePrItem(ture, grupper).get(item.uid) ?? [];
  const brug = brugPrItem(ture).get(item.uid) ?? null;
  const advarsel = garantiAdvarsel(item);

  return (
    <div style={layout.container}>
      <DetaljeHeader tilbage={tilbage} sletLabel="Slet" slet={slet} />

      <TitelInput
        value={item.navn}
        onChange={(v) => opdater({ navn: v })}
        placeholder="Navn på gear"
        autoFokus={nyOprettet}
      />

      <div style={{ marginBottom: '24px' }}>
        <Segment vaerdier={ITEM_STATUS} valgt={item.status} vaelg={(s) => opdater({ status: s })} />
      </div>

      {advarsel && (
        <div style={{
          padding: '10px 12px',
          marginBottom: '14px',
          background: 'var(--advarsel-bg)',
          border: '1px solid var(--advarsel-border)',
          borderRadius: '10px',
          fontSize: '12px',
          color: 'var(--advarsel)',
          fontWeight: 500
        }}>
          ⚠ {advarsel}
        </div>
      )}

      <div style={{ display: 'grid', gap: '14px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
          <Feltkort label="Vægt" type="number" enhed="g" value={item.vaegt_g} onChange={(v) => opdater({ vaegt_g: Number(v) || 0 })} />
          <Feltkort label="Pris" type="number" enhed="kr" value={item.pris_kr} onChange={(v) => opdater({ pris_kr: Number(v) || 0 })} />
          <Feltkort label="Antal" type="number" value={item.antal} onChange={(v) => opdater({ antal: Number(v) || 1 })} />
          <DeltKort delt={item.delt} skift={(v) => opdater({ delt: v })} />
        </div>

        <Feltkort label="Dimensioner" value={item.dimensioner} onChange={(v) => opdater({ dimensioner: v })} placeholder="ø 33 × 15 cm" />

        <Brugsstatistik ture={turePaaItem} brug={brug} />

        <div style={{ height: '4px' }} />
        <SektionsTitel>Kompatibilitet</SektionsTitel>

        <TagsInput tags={item.tags} onChange={(nye) => opdater({ tags: nye })} />
        <TagsInput
          tags={item.kraever}
          onChange={(nye) => opdater({ kraever: nye })}
          label="Kræver"
          hjaelpetekst="Hårde afhængigheder"
          farve="fejl"
        />
        <TagsInput
          tags={item.komplementer}
          onChange={(nye) => opdater({ komplementer: nye })}
          label="Komplementer"
          hjaelpetekst="Bløde forslag"
          farve="advarsel"
        />

        <div style={{ height: '4px' }} />
        <SektionsTitel>Købsinfo</SektionsTitel>

        <Felt label="Købt hos" value={item.koebt_hos} onChange={(v) => opdater({ koebt_hos: v })} placeholder="fx Friluftslageret.dk" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <Felt label="Købsdato" value={item.koebsdato} onChange={(v) => opdater({ koebsdato: v })} placeholder="MM/ÅÅÅÅ" />
          <Felt label="Ordrenummer" value={item.ordrenummer} onChange={(v) => opdater({ ordrenummer: v })} />
        </div>
        <Felt label="Købslink" value={item.koebslink} onChange={(v) => opdater({ koebslink: v })} placeholder="https://..." />

        <Kort fremhaevet style={{ padding: 0, overflow: 'hidden' }}>
          <button
            onClick={() => setGarantiAaben(!garantiAaben)}
            style={{
              width: '100%',
              padding: '12px 14px',
              background: 'transparent',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: '13px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              color: 'var(--tekst)'
            }}
          >
            <span>
              Garanti
              {item.garanti && item.garanti.laengde_aar > 0 && (
                <span style={{ color: 'var(--tekst-dæmpet)', fontSize: '11px', marginLeft: '8px' }}>
                  · {item.garanti.laengde_aar} år
                </span>
              )}
            </span>
            <span style={{ color: 'var(--tekst-svag)', fontSize: '14px' }}>{garantiAaben ? '−' : '+'}</span>
          </button>
          {garantiAaben && (
            <div style={{ padding: '4px 14px 14px', display: 'grid', gap: '10px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <Felt
                  label="Længde (år)"
                  type="number"
                  value={item.garanti?.laengde_aar ?? 0}
                  onChange={(v) => opdaterGaranti({ laengde_aar: Number(v) || 0 })}
                />
                <Felt
                  label="Påmindelse (dage)"
                  type="number"
                  value={item.garanti?.paamindelse_dage ?? 30}
                  onChange={(v) => opdaterGaranti({ paamindelse_dage: Number(v) || 30 })}
                />
              </div>
              <Felt
                label="Udløber dato"
                value={item.garanti?.udloeber_dato ?? ''}
                onChange={(v) => opdaterGaranti({ udloeber_dato: v })}
                placeholder="DD/MM/ÅÅÅÅ"
              />
            </div>
          )}
        </Kort>

        <Tekstomraade label="Noter" value={item.noter} onChange={(v) => opdater({ noter: v })} raekker={3} />
      </div>

      <div style={{ marginTop: '30px', fontSize: '11px', color: 'var(--tekst-svag)', textAlign: 'center' }}>
        Oprettet {new Date(item.oprettet).toLocaleDateString('da-DK')} · Ændret {new Date(item.aendret).toLocaleDateString('da-DK')}
      </div>
    </div>
  );
}

// Delt gear er et ja/nej, ikke et tal — men det hører hjemme i samme række
// kort som vægt og pris, så det får samme form.
function DeltKort({ delt, skift }: { delt: boolean; skift: (v: boolean) => void }) {
  return (
    <div style={{
      border: '1px solid var(--border-svag)',
      borderRadius: '10px',
      padding: '10px 12px',
      background: 'var(--bg-forhoejet)'
    }}>
      <div style={{ fontSize: '10px', color: 'var(--tekst-dæmpet)', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 600, marginBottom: '3px' }}>
        Delt?
      </div>
      <button
        onClick={() => skift(!delt)}
        title="Delt gear bæres af én, men bruges af flere"
        style={{
          border: 'none',
          background: 'transparent',
          padding: 0,
          fontSize: '16px',
          cursor: 'pointer',
          color: delt ? 'var(--accent)' : 'var(--tekst)',
          fontWeight: delt ? 600 : 400
        }}
      >
        {delt ? 'Ja' : 'Nej'}
      </button>
    </div>
  );
}

// Hvor meget gearet reelt bliver brugt. Uden turhistorik står der ingenting at
// bygge på, så kortet siger det ligeud frem for at vise nuller.
//
// "Med på 8 ture" og "brugt 5 af 8 gange" er to forskellige tal: det første
// tæller pakkelister, det andet kun de ture der er gjort op bagefter.
function Brugsstatistik({ ture, brug }: { ture: Tur[]; brug: Brug | null }) {
  const seneste = ture.find((t) => t.startdato);

  return (
    <Infokort label="Brugsstatistik" fremhaevet={ture.length > 0}>
      {ture.length === 0 ? (
        <div style={{ fontSize: '13px', color: 'var(--tekst-dæmpet)' }}>
          Har ikke været med på en tur endnu.
        </div>
      ) : (
        <>
          <div style={{ fontSize: '15px', color: 'var(--tekst)' }}>
            <strong>{ture.length} {ture.length === 1 ? 'tur' : 'ture'}</strong>
            {seneste && ` · senest ${formatterDato(seneste.startdato)}`}
          </div>
          {brug && brug.gjort_op > 0 && (
            <div style={{ fontSize: '12px', color: 'var(--tekst-dæmpet)', marginTop: '3px' }}>
              Brugt {brug.brugt} af {brug.gjort_op} gange
              {brug.i_stykker > 0 && ` · gik i stykker ${brug.i_stykker} ${brug.i_stykker === 1 ? 'gang' : 'gange'}`}
            </div>
          )}
          <div style={{ marginTop: '8px', display: 'grid', gap: '4px' }}>
            {ture.slice(0, 3).map((t) => (
              <div key={t.uid} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--tekst-dæmpet)' }}>
                <span>{t.navn || 'Uden navn'}</span>
                <span>{t.startdato ? formatterDato(t.startdato) : '—'}</span>
              </div>
            ))}
            {ture.length > 3 && (
              <div style={{ fontSize: '11px', color: 'var(--tekst-svag)' }}>
                + {ture.length - 3} tidligere
              </div>
            )}
          </div>
        </>
      )}
    </Infokort>
  );
}

function formatterDato(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default ItemDetalje;
