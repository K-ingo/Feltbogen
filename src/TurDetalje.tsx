import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, etiket, TUR_STATUS, OVERNATNING, AKTIVITET, TERRAEN, ERFARING } from './db';
import type {
  Item,
  Gruppe,
  Tur,
  TurStatus,
  Overnatning,
  Aktivitet,
  Terraen,
  Erfaring,
  Deltager,
  BudgetLinje,
  Reference
} from './db';
import {
  hentVejr,
  vejrIkonKode,
  beregnForbrug,
  findAdvarsler,
  advarslerPrItem,
  foreslaaGrupper,
  itemUidsPaaTur,
  pakkelisteEfterGruppe,
  pakkelisteEfterTag,
  baererAf,
  linjeAfItem,
  linjeAfMedbragt,
  linjerEfterPerson,
  medDeltagernes,
  afsnitAfItems,
  samletVaegt,
  overnatningsAdvarsler,
  vaegtPrDeltager,
  tildelGear,
  soegSted
} from './smartMotor';
import type { VejrData, StedForslag, Advarsel, Pakkelinje, Pakkeafsnit, Beregninger, Baerevaegt } from './smartMotor';
import {
  Knap,
  Felt,
  Label,
  Chip,
  Dropdown,
  Infokort,
  Segment,
  Tekstomraade,
  TitelInput,
  DetaljeHeader,
  Indlaeser,
  SektionsTitel
} from './ui';
import { nytDeletoken, lavSnapshot, deleLink, linkadvarsel, linkvaert } from './gaest';
import { formatterPeriode } from './datotekst';
import { hentDeltagelser, baererePrGear, visningsnavn } from './deltagelse';
import type { Deltagelse } from './deltagelse';
import { layout } from './layout';
import { useErDesktop } from './useMedie';
import { sletTur, opdaterTur } from './sync';
import { useRedigerbar } from './useRedigerbar';

interface Props {
  turId: number;
  tilbage: () => void;
  // Sat når turen netop er oprettet, så en navnløs post kan ryddes væk igen.
  nyOprettet?: boolean;
}

// Turen har fire tilstande, og handlingsknappen fører til den næste.
// "afsluttet" har ingen næste: pak-af-tjekket fra fundamentets §8 findes ikke.
const NAESTE_TILSTAND: Record<TurStatus, { label: string; naeste: TurStatus } | null> = {
  kladde: { label: 'Markér som klar', naeste: 'klar' },
  klar: { label: 'Start tur', naeste: 'aktiv' },
  aktiv: { label: 'Afslut tur', naeste: 'afsluttet' },
  afsluttet: null
};

type Visning = 'gruppe' | 'tag' | 'person';

function TurDetalje({ turId, tilbage, nyOprettet }: Props) {
  const erDesktop = useErDesktop();
  const [visning, setVisning] = useState<Visning>('gruppe');
  const [vejrData, setVejrData] = useState<VejrData | null>(null);
  const [vejrHentes, setVejrHentes] = useState(false);
  const [vejrFejl, setVejrFejl] = useState('');
  const [koordinatTekst, setKoordinatTekst] = useState('');
  const [koordinatFejl, setKoordinatFejl] = useState('');
  const [stedForslag, setStedForslag] = useState<StedForslag[]>([]);
  const [stedSoeger, setStedSoeger] = useState(false);
  // Hvad de inviterede har skrevet sig på for. Hentes kun når turen er delt.
  const [deltagelser, setDeltagelser] = useState<Deltagelse[]>([]);

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

  // Bidragene ligger på serveren og ikke i den lokale base — de kommer fra
  // andres enheder. Uden forbindelse vises turen bare uden dem.
  const token = tur?.dele_token ?? '';
  const turPbId = tur?.pb_id ?? '';
  useEffect(() => {
    if (!token || !turPbId) { setDeltagelser([]); return; }

    let aktiv = true;
    void hentDeltagelser(turPbId, token).then((svar) => {
      if (aktiv && svar.slags === 'ok') setDeltagelser(svar.data);
    });
    return () => { aktiv = false; };
  }, [token, turPbId]);

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

  const toggleGruppe = async (gruppeUid: Reference) => {
    if (!tur) return;
    await opdater({ gruppe_ids: vekslet(tur.gruppe_ids, gruppeUid) });
  };

  const toggleLoestItem = async (itemUid: Reference) => {
    if (!tur) return;
    await opdater({ loese_item_ids: vekslet(tur.loese_item_ids, itemUid) });
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

  const toggleGearHos = async (deltagerId: string, item: Item) => {
    if (!tur) return;
    await opdater({ deltagere: tildelGear(tur.deltagere, deltagerId, item) });
  };

  // null betyder "som turen" — så følger deltageren med, hvis man senere
  // skifter turens egen overnatningsform.
  const saetDeltagerOvernatning = async (id: string, form: Overnatning | null) => {
    if (!tur) return;
    await opdater({
      deltagere: tur.deltagere.map((d) => (d.id === id ? { ...d, overnatning: form } : d))
    });
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

  const itemUidsPaaDenneTur = itemUidsPaaTur(tur, grupper ?? []);
  const pakItems = items?.filter((i) => itemUidsPaaDenneTur.has(i.uid)) ?? [];

  const vaegtDelt = pakItems.filter((i) => i.delt).reduce((s, i) => s + i.vaegt_g, 0);
  const vaegtPersonligt = pakItems.filter((i) => !i.delt).reduce((s, i) => s + i.vaegt_g, 0);
  // Delt gear bæres af én, men vises fair fordelt over deltagerne.
  const vaegtPrPerson = tur.personer > 0
    ? vaegtPersonligt + vaegtDelt / tur.personer
    : vaegtPersonligt + vaegtDelt;

  const totalForventet = tur.budget_linjer.reduce((s, l) => s + l.forventet_kr, 0);
  const totalFaktisk = tur.budget_linjer.reduce((s, l) => s + l.faktisk_kr, 0);

  // Deling fryser pakkelisten ned som den ser ud nu. Gæsten læser kun det
  // ene felt — aldrig inventaret. Retter man turen bagefter, står gæstens
  // udgave stille, indtil man deler igen.
  const del = async () => {
    await opdater({
      dele_token: tur.dele_token || nytDeletoken(),
      dele_snapshot: JSON.stringify(lavSnapshot(tur, grupper ?? [], pakItems))
    });
  };

  const stopDeling = async () => {
    if (!confirm('Træk linket tilbage? Gæster kan så ikke længere se turen.')) return;
    await opdater({ dele_token: '', dele_snapshot: '' });
  };

  const advarsler = [...findAdvarsler(pakItems), ...overnatningsAdvarsler(tur, pakItems)];
  const perItem = advarslerPrItem(advarsler);
  const beregninger = beregnForbrug(tur);
  const gruppeForslag = grupper ? foreslaaGrupper(tur, grupper) : [];

  // Deltagernes eget grej hører til i den samme liste som ens eget — det er
  // én tur, og man pakker efter én liste.
  const deltagerlinjer = deltagelser.flatMap((d) =>
    d.medbragt.map((g) => linjeAfMedbragt(g.navn, g.vaegt_g, visningsnavn(d))));

  // Ejerens egen fordeling, plus dem der selv har meldt sig på noget.
  const navne = new Map(baerernavne(tur));
  baererePrGear(deltagelser).forEach((meldte, uid) => {
    navne.set(uid, [navne.get(uid), ...meldte].filter(Boolean).join(' og '));
  });

  const alleLinjer = [...pakItems.map((i) => linjeAfItem(i, navne.get(i.uid) ?? '')), ...deltagerlinjer];

  const afsnit: Pakkeafsnit[] = visning === 'person'
    ? linjerEfterPerson(alleLinjer)
    : medDeltagernes(
        afsnitAfItems(
          visning === 'gruppe'
            ? pakkelisteEfterGruppe(tur, grupper ?? [], pakItems)
            : pakkelisteEfterTag(pakItems),
          navne
        ),
        alleLinjer
      );

  const handling = NAESTE_TILSTAND[tur.status];

  // Sektionerne er de samme på begge layouts — kun rammen om dem er forskellig.
  const parametre = (
    <Turparametre
      tur={tur}
      opdater={opdater}
      skiftDato={skiftDato}
      koordinatTekst={koordinatTekst}
      koordinatFejl={koordinatFejl}
      opdaterKoordinater={opdaterKoordinater}
      soegPaaSted={soegPaaSted}
      stedSoeger={stedSoeger}
      stedForslag={stedForslag}
      vaelgSted={vaelgSted}
      beregninger={beregninger}
    />
  );

  const pakkeliste = (
    <Pakkeliste
      afsnit={afsnit}
      perItem={perItem}
      visning={visning}
      setVisning={setVisning}
      antal={pakItems.length}
    />
  );

  const valgAfIndhold = (
    <Indholdsvalg
      grupper={grupper ?? []}
      items={items ?? []}
      tur={tur}
      paaTuren={itemUidsPaaDenneTur}
      gruppeForslag={gruppeForslag}
      toggleGruppe={toggleGruppe}
      toggleLoestItem={toggleLoestItem}
    />
  );

  const vejr = (
    <Vejrudsigt data={vejrData} hentes={vejrHentes} fejl={vejrFejl} hent={hentVejrForTur} />
  );

  const deltagere = (
    <Deltagere
      deltagere={tur.deltagere}
      turensOvernatning={tur.overnatning}
      tilfoej={tilfoejDeltager}
      fjern={fjernDeltager}
      saetOvernatning={saetDeltagerOvernatning}
    />
  );

  const budget = (
    <Budget
      linjer={tur.budget_linjer}
      tilfoej={tilfoejBudgetLinje}
      opdater={opdaterBudgetLinje}
      fjern={fjernBudgetLinje}
    />
  );

  const vaegt = (
    <Vaegt
      prPerson={vaegtPrPerson}
      delt={vaegtDelt}
      personligt={vaegtPersonligt}
      personer={tur.personer}
      baaret={vaegtPrDeltager(tur, pakItems)}
    />
  );

  const fordeling = (
    <Fordeling
      deltagere={tur.deltagere}
      pakItems={pakItems}
      baerer={baererAf(tur)}
      vaegte={vaegtPrDeltager(tur, pakItems)}
      toggle={toggleGearHos}
    />
  );

  const deling = (
    <Deling
      token={tur.dele_token}
      snapshot={tur.dele_snapshot}
      deltagelser={deltagelser}
      gearnavne={new Map(pakItems.map((i) => [i.uid, i.navn]))}
      del={del}
      stop={stopDeling}
    />
  );

  const noter = (
    <div style={{ display: 'grid', gap: '12px' }}>
      <Tekstomraade
        label="Besked til gæster"
        value={tur.besked_fra_ejer}
        onChange={(v) => opdater({ besked_fra_ejer: v })}
        placeholder="fx Vi mødes ved P kl. 15"
      />
      <Tekstomraade label="Noter" value={tur.noter} onChange={(v) => opdater({ noter: v })} />
    </div>
  );

  // Resuméerne står altid fremme, så en foldet sektion stadig kan aflæses.
  const parametreResume = [
    `${tur.naetter} ${tur.naetter === 1 ? 'nat' : 'nætter'}`,
    `${tur.personer} pers`,
    etiket(tur.overnatning),
    tur.baereafstand_km > 0 ? `${tur.baereafstand_km} km bæreafstand` : null
  ].filter(Boolean).join(' · ');

  const titelblok = (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <TitelInput
          value={tur.navn}
          onChange={(v) => opdater({ navn: v })}
          placeholder="Navn på tur"
          autoFokus={nyOprettet}
        />
        <div style={{ fontSize: '12px', color: 'var(--tekst-dæmpet)', marginTop: '-8px', marginBottom: '10px' }}>
          {[formatterPeriode(tur.startdato, tur.slutdato), tur.sted].filter(Boolean).join(' · ') || 'Ingen datoer valgt'}
        </div>
        <Segment vaerdier={TUR_STATUS} valgt={tur.status} vaelg={(s) => opdater({ status: s })} kompakt />
      </div>
      {erDesktop && handling && (
        <Knap variant="primaer" onClick={() => opdater({ status: handling.naeste })}>
          {handling.label}
        </Knap>
      )}
    </div>
  );

  if (erDesktop) {
    return (
      <div>
        <DetaljeHeader tilbage={tilbage} sletLabel="Slet tur" slet={slet} />
        {titelblok}

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.9fr) minmax(300px, 1fr)',
          gap: '24px',
          alignItems: 'start',
          marginTop: '22px'
        }}>
          <div style={{ display: 'grid', gap: '10px' }}>
            {pakkeliste}
            <Foldbar titel="Vælg gear">{valgAfIndhold}</Foldbar>
          </div>

          <div style={{ display: 'grid', gap: '10px' }}>
            <Foldbar titel="Turparametre" resume={parametreResume}>{parametre}</Foldbar>
            <Foldbar titel="Vejrudsigt" resume={vejrResume(vejrData)}>{vejr}</Foldbar>
            {advarsler.length > 0 && <Advarsler advarsler={advarsler} />}
            {vaegt}
            <Foldbar
              titel={`Deltagere (${tur.deltagere.length})`}
              resume={tur.deltagere.map((d) => d.navn).join(', ')}
            >
              {deltagere}
            </Foldbar>
            {tur.deltagere.length > 0 && pakItems.length > 0 && (
              <Foldbar titel="Fordel gear" resume={fordelingsResume(tur, pakItems)}>{fordeling}</Foldbar>
            )}
            <Foldbar titel="Budget" resume={`${totalFaktisk} / ${totalForventet} kr`}>{budget}</Foldbar>
            <Foldbar titel="Del med gæster" resume={tur.dele_token ? 'Delt' : 'Ikke delt'}>{deling}</Foldbar>
            <Foldbar titel="Noter">{noter}</Foldbar>
          </div>
        </div>
      </div>
    );
  }

  // Foldetilstandene følger fundamentets §13: det man har brug for under
  // planlægningen står åbent, resten er foldet sammen.
  return (
    <div style={layout.container}>
      <DetaljeHeader tilbage={tilbage} sletLabel="Slet tur" slet={slet} />
      {titelblok}

      {handling && (
        <Knap
          variant="primaer"
          onClick={() => opdater({ status: handling.naeste })}
          style={{ width: '100%', marginTop: '14px', padding: '11px' }}
        >
          {handling.label}
        </Knap>
      )}

      <div style={{ display: 'grid', gap: '8px', marginTop: '16px' }}>
        <Foldbar titel="Turparametre" resume={parametreResume}>{parametre}</Foldbar>
        {advarsler.length > 0 && (
          <Foldbar titel={`Advarsler (${advarsler.length})`} advarsel aabenFra>
            <Advarselsliste advarsler={advarsler} />
          </Foldbar>
        )}
        <Foldbar titel={`Pakkeliste (${pakItems.length})`} aabenFra>{pakkeliste}</Foldbar>
        <Foldbar titel="Vægt" resume={`${kg(vaegtPrPerson)} kg${tur.personer > 1 ? ' / pers' : ''}`}>
          {vaegt}
        </Foldbar>
        <Foldbar titel="Vælg gear">{valgAfIndhold}</Foldbar>
        <Foldbar titel="Vejrudsigt" resume={vejrResume(vejrData)}>{vejr}</Foldbar>
        <Foldbar
          titel={`Deltagere (${tur.deltagere.length})`}
          resume={tur.deltagere.map((d) => d.navn).join(', ')}
        >
          {deltagere}
        </Foldbar>
        {tur.deltagere.length > 0 && pakItems.length > 0 && (
          <Foldbar titel="Fordel gear" resume={fordelingsResume(tur, pakItems)}>{fordeling}</Foldbar>
        )}
        <Foldbar titel="Budget" resume={`${totalFaktisk} / ${totalForventet} kr`}>{budget}</Foldbar>
        <Foldbar titel="Del med gæster" resume={tur.dele_token ? 'Delt' : 'Ikke delt'}>{deling}</Foldbar>
        <Foldbar titel="Noter">{noter}</Foldbar>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Rammer
// ─────────────────────────────────────────────

// En sektion man kan folde ud. Resuméet står fremme uanset foldetilstand, så
// man kan aflæse turen uden at åbne alt.
function Foldbar({ titel, resume, children, aabenFra, advarsel }: {
  titel: string;
  resume?: string;
  children: React.ReactNode;
  aabenFra?: boolean;
  advarsel?: boolean;
}) {
  const [aaben, setAaben] = useState(!!aabenFra);

  return (
    <div style={{
      border: `1px solid ${advarsel ? 'var(--advarsel-border)' : 'var(--border-svag)'}`,
      borderRadius: '10px',
      overflow: 'hidden',
      background: advarsel ? 'var(--advarsel-bg)' : 'var(--bg-forhoejet)'
    }}>
      <button
        onClick={() => setAaben(!aaben)}
        style={{
          width: '100%',
          padding: resume ? '11px 14px 4px' : '11px 14px',
          background: 'transparent',
          border: 'none',
          textAlign: 'left',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '8px',
          fontSize: '10px',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.6px',
          color: advarsel ? 'var(--advarsel)' : 'var(--tekst-dæmpet)'
        }}
      >
        <span>{advarsel && '⚠ '}{titel}</span>
        <span style={{ fontSize: '11px' }}>{aaben ? '▾' : '▸'}</span>
      </button>

      {resume && (
        <div style={{ padding: '0 14px 11px', fontSize: '13px', color: 'var(--tekst)', lineHeight: 1.4 }}>
          {resume}
        </div>
      )}

      {aaben && (
        <div style={{ padding: resume ? '0 14px 14px' : '4px 14px 14px' }}>{children}</div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Sektioner
// ─────────────────────────────────────────────

function Turparametre({
  tur, opdater, skiftDato, koordinatTekst, koordinatFejl, opdaterKoordinater,
  soegPaaSted, stedSoeger, stedForslag, vaelgSted, beregninger
}: {
  tur: Tur;
  opdater: (a: Partial<Tur>) => Promise<void>;
  skiftDato: (a: { startdato?: string; slutdato?: string }) => Promise<void>;
  koordinatTekst: string;
  koordinatFejl: string;
  opdaterKoordinater: (v: string) => Promise<void>;
  soegPaaSted: () => Promise<void>;
  stedSoeger: boolean;
  stedForslag: StedForslag[];
  vaelgSted: (f: StedForslag) => Promise<void>;
  beregninger: Beregninger;
}) {
  return (
    <div style={{ display: 'grid', gap: '12px' }}>
      <div>
        <Label>Sted</Label>
        <div style={{ display: 'flex', gap: '6px' }}>
          <input
            value={tur.sted}
            onChange={(e) => opdater({ sted: e.target.value })}
            placeholder="fx Palnatokesvej 22, Odense"
            style={{ flex: 1, minWidth: 0 }}
          />
          <Knap onClick={soegPaaSted} disabled={stedSoeger || !tur.sted.trim()} variant="primaer">
            {stedSoeger ? 'Søger...' : 'Find'}
          </Knap>
        </div>
        {stedForslag.length > 0 && (
          <div style={{ marginTop: '6px', background: 'var(--bg)', border: '1px solid var(--border-svag)', borderRadius: '8px', overflow: 'hidden' }}>
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <Felt label="Personer" type="number" value={tur.personer} onChange={(v) => opdater({ personer: Number(v) || 1 })} />
        <Felt label="Bæreafstand (km)" type="number" value={tur.baereafstand_km} onChange={(v) => opdater({ baereafstand_km: Number(v) || 0 })} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <Dropdown label="Overnatning" value={tur.overnatning} onChange={(v) => opdater({ overnatning: v as Overnatning })} options={OVERNATNING} formater={etiket} />
        <Dropdown label="Aktivitet" value={tur.aktivitet} onChange={(v) => opdater({ aktivitet: v as Aktivitet })} options={AKTIVITET} formater={etiket} />
        <Dropdown label="Terræn" value={tur.terraen} onChange={(v) => opdater({ terraen: v as Terraen })} options={TERRAEN} formater={etiket} />
        <Dropdown label="Erfaring" value={tur.erfaring} onChange={(v) => opdater({ erfaring: v as Erfaring })} options={ERFARING} formater={etiket} />
      </div>

      <Infokort label="Forventet forbrug">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', textAlign: 'center' }}>
          <Noegletal vaerdi={`${beregninger.vand_liter} L`} label="Vand" />
          <Noegletal vaerdi={`${beregninger.mad_kg} kg`} label="Mad" />
          <Noegletal vaerdi={`${beregninger.gas_g} g`} label="Gas" />
        </div>
      </Infokort>
    </div>
  );
}

// itemUid → navnet på den der bærer det.
function baerernavne(tur: Tur): Map<Reference, string> {
  const navnPaa = new Map(tur.deltagere.map((d) => [d.id, d.navn]));
  const pr = new Map<Reference, string>();

  baererAf(tur).forEach((deltagerId, itemUid) => {
    const navn = navnPaa.get(deltagerId);
    if (navn) pr.set(itemUid, navn);
  });

  return pr;
}

function Pakkeliste({ afsnit, perItem, visning, setVisning, antal }: {
  afsnit: Pakkeafsnit[];
  perItem: Map<Reference, Advarsel[]>;
  visning: Visning;
  setVisning: (v: Visning) => void;
  antal: number;
}) {
  if (antal === 0) {
    return (
      <div style={{ fontSize: '13px', color: 'var(--tekst-svag)', padding: '10px 0' }}>
        Ingen gear valgt endnu. Vælg en gruppe eller enkelte items under "Vælg gear".
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '14px' }}>
        <Segment
          vaerdier={VISNINGER}
          valgt={visning}
          vaelg={setVisning}
          formater={(v) => VISNING_LABEL[v]}
          kompakt
        />
      </div>

      {afsnit.map((a) => (
        <div key={a.titel} style={{ marginBottom: '16px' }}>
          <SektionsTitel>{a.titel}</SektionsTitel>
          {a.linjer.map((linje, n) => (
            <Pakkeraekke
              key={`${linje.uid || linje.navn}-${n}`}
              linje={linje}
              // Deltagernes eget grej har ingen advarsler — de bygger på tags
              // fra ejerens inventar, og det kender vi ikke for deres ting.
              advarsler={linje.uid ? perItem.get(linje.uid) ?? [] : []}
              // I "efter person" står navnet allerede som overskrift.
              visBaerer={visning !== 'person'}
            />
          ))}
          <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '11px', color: 'var(--tekst-svag)', paddingTop: '5px' }}>
            {kg(samletVaegt(a.linjer))} kg
          </div>
        </div>
      ))}
    </div>
  );
}

function Pakkeraekke({ linje, advarsler, visBaerer }: {
  linje: Pakkelinje;
  advarsler: Advarsel[];
  visBaerer: boolean;
}) {
  // Er der flere huller på samme item, vejer det røde tungest.
  const vaerst = advarsler.find((a) => a.niveau === 'roed') ?? advarsler[0];

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '7px 0',
      borderBottom: '1px solid var(--border-svag)',
      fontSize: '13px',
      background: vaerst ? 'var(--advarsel-bg)' : 'transparent'
    }}>
      <span style={{ flex: 1, minWidth: 0, color: 'var(--tekst)' }}>{linje.navn || 'Uden navn'}</span>

      {vaerst && (
        <span title={`${vaerst.besked}. ${vaerst.detalje}`}>
          <Chip storrelse="lille" farve={vaerst.niveau === 'roed' ? 'fejl' : 'advarsel'}>
            ⚠ {vaerst.mangler}
          </Chip>
        </span>
      )}

      {visBaerer && linje.baerer && (
        <span style={{ fontSize: '11px', color: 'var(--tekst-dæmpet)' }}>{linje.baerer}</span>
      )}
      {linje.delt && !linje.baerer && <span style={{ fontSize: '10px', color: 'var(--tekst-svag)' }}>delt</span>}
      <span style={{ color: 'var(--tekst-dæmpet)', fontSize: '12px', minWidth: '52px', textAlign: 'right' }}>
        {linje.vaegt_g} g
      </span>
    </div>
  );
}

function Advarsler({ advarsler }: { advarsler: Advarsel[] }) {
  return (
    <Infokort label={`Advarsler (${advarsler.length})`}>
      <Advarselsliste advarsler={advarsler} />
    </Infokort>
  );
}

function Advarselsliste({ advarsler }: { advarsler: Advarsel[] }) {
  return (
    <div style={{ display: 'grid', gap: '8px' }}>
      {advarsler.map((a, i) => (
        <div key={i}>
          <div style={{ fontSize: '12px', fontWeight: 500, color: a.niveau === 'roed' ? 'var(--fejl)' : 'var(--advarsel)' }}>
            {a.besked}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--tekst-dæmpet)', marginTop: '1px' }}>{a.detalje}</div>
        </div>
      ))}
    </div>
  );
}

function Vaegt({ prPerson, delt, personligt, personer, baaret }: {
  prPerson: number;
  delt: number;
  personligt: number;
  personer: number;
  baaret: Baerevaegt[];
}) {
  // Gennemsnittet siger ikke noget om, at én har fået teltet. Er gearet
  // fordelt, er det den fordeling der gælder.
  const erFordelt = baaret.some((b) => b.antal > 0);

  return (
    <Infokort label="Vægt" fremhaevet>
      <div style={{ fontSize: '22px', fontWeight: 500, fontFamily: "'Fraunces', Georgia, serif" }}>
        {kg(prPerson)} kg
        {personer > 1 && <span style={{ fontSize: '13px', color: 'var(--tekst-dæmpet)' }}> / pers</span>}
      </div>
      <div style={{ fontSize: '11px', color: 'var(--tekst-dæmpet)', marginTop: '3px' }}>
        {erFordelt ? 'I gennemsnit · ' : ''}Delt: {kg(delt)} kg · Personligt: {kg(personligt)} kg
      </div>

      {erFordelt && (
        <div style={{ marginTop: '10px', paddingTop: '9px', borderTop: '1px solid var(--accent-border)' }}>
          <div style={{ fontSize: '10px', color: 'var(--tekst-dæmpet)', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 600, marginBottom: '5px' }}>
            Sådan er det fordelt
          </div>
          {baaret.map((b) => (
            <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', fontSize: '12px', padding: '2px 0' }}>
              <span>{b.navn}</span>
              <span style={{ color: 'var(--tekst-dæmpet)', whiteSpace: 'nowrap' }}>{kg(b.vaegt_g)} kg</span>
            </div>
          ))}
        </div>
      )}
    </Infokort>
  );
}

function Vejrudsigt({ data, hentes, fejl, hent }: {
  data: VejrData | null;
  hentes: boolean;
  fejl: string;
  hent: () => Promise<void>;
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
        <Knap onClick={hent} disabled={hentes} variant="primaer" style={{ padding: '5px 12px', fontSize: '11px' }}>
          {hentes ? 'Henter...' : data ? 'Opdater' : 'Hent vejr'}
        </Knap>
      </div>

      {fejl && <div style={{ fontSize: '12px', color: 'var(--fejl)', marginBottom: '8px' }}>{fejl}</div>}

      {data ? (
        <>
          <div style={{ display: 'grid', gap: '4px', fontSize: '13px' }}>
            {data.dage.map((d) => (
              <div key={d.dato} style={{ display: 'grid', gridTemplateColumns: '54px 22px 1fr auto auto', gap: '8px', alignItems: 'center', padding: '3px 0' }}>
                <span style={{ color: 'var(--tekst-dæmpet)', fontSize: '11px' }}>{formatterDag(d.dato)}</span>
                <span style={{ fontSize: '15px' }}>{vejrIkonKode(d.vejrkode)}</span>
                <span>{d.temp_min}–{d.temp_max}°C</span>
                <span style={{ color: 'var(--tekst-svag)', fontSize: '11px' }}>{d.vind_ms} m/s</span>
                <span style={{ color: d.nedboer_mm > 0 ? 'var(--advarsel)' : 'var(--tekst-svag)', fontSize: '11px', minWidth: '38px', textAlign: 'right' }}>
                  {d.nedboer_mm > 0 ? `${d.nedboer_mm} mm` : '—'}
                </span>
              </div>
            ))}
          </div>
          {data.dage[0] && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--tekst-dæmpet)', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border-svag)' }}>
              <span>Sol op {data.dage[0].sol_op}</span>
              <span>Sol ned {data.dage[0].sol_ned}</span>
            </div>
          )}
          {data.observationer.length > 0 && (
            <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border-svag)' }}>
              {data.observationer.map((obs, i) => (
                <div key={i} style={{ fontSize: '11px', color: 'var(--tekst-dæmpet)', marginBottom: '3px' }}>· {obs}</div>
              ))}
            </div>
          )}
        </>
      ) : !fejl && (
        <div style={{ fontSize: '12px', color: 'var(--tekst-svag)' }}>Angiv koordinater og datoer, klik "Hent vejr".</div>
      )}
    </div>
  );
}

function Deltagere({ deltagere, turensOvernatning, tilfoej, fjern, saetOvernatning }: {
  deltagere: Deltager[];
  turensOvernatning: Overnatning;
  tilfoej: () => Promise<void>;
  fjern: (id: string) => Promise<void>;
  saetOvernatning: (id: string, form: Overnatning | null) => Promise<void>;
}) {
  return (
    <div>
      {deltagere.length === 0 ? (
        <div style={{ fontSize: '13px', color: 'var(--tekst-svag)', marginBottom: '12px' }}>
          Kun dig selv indtil videre.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '2px', marginBottom: '12px' }}>
          {deltagere.map((d) => (
            <div
              key={d.id}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', borderBottom: '1px solid var(--border-svag)' }}
            >
              <span style={{ flex: 1, minWidth: 0, fontSize: '13px' }}>{d.navn}</span>

              <select
                value={d.overnatning ?? ''}
                onChange={(e) => saetOvernatning(d.id, (e.target.value || null) as Overnatning | null)}
                style={{ padding: '4px 6px', fontSize: '11px', textTransform: 'capitalize', width: 'auto' }}
              >
                <option value="">som turen ({etiket(turensOvernatning)})</option>
                {OVERNATNING.map((o) => <option key={o} value={o}>{etiket(o)}</option>)}
              </select>

              <button
                onClick={() => fjern(d.id)}
                aria-label={`Fjern ${d.navn}`}
                style={{ background: 'transparent', border: 'none', color: 'var(--fejl)', cursor: 'pointer', fontSize: '14px', padding: '0 4px' }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <Knap onClick={tilfoej}>+ Tilføj deltager</Knap>
    </div>
  );
}

const BUDGET_KATEGORIER = ['gear', 'forplejning', 'transport', 'andet'] as const;

function Budget({ linjer, tilfoej, opdater, fjern }: {
  linjer: BudgetLinje[];
  tilfoej: () => Promise<void>;
  opdater: (id: string, a: Partial<BudgetLinje>) => Promise<void>;
  fjern: (id: string) => Promise<void>;
}) {
  return (
    <div>
      {linjer.length === 0 && (
        <div style={{ fontSize: '13px', color: 'var(--tekst-svag)', marginBottom: '12px' }}>
          Ingen budget-linjer endnu.
        </div>
      )}
      {linjer.map((l) => (
        <div key={l.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border-svag)', display: 'grid', gap: '6px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
            <select value={l.kategori} onChange={(e) => opdater(l.id, { kategori: e.target.value })} style={{ padding: '6px', fontSize: '12px', textTransform: 'capitalize' }}>
              {BUDGET_KATEGORIER.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
            <input placeholder="Beskrivelse" value={l.beskrivelse} onChange={(e) => opdater(l.id, { beskrivelse: e.target.value })} style={{ padding: '6px', fontSize: '12px', minWidth: 0 }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '6px', alignItems: 'center' }}>
            <input type="number" placeholder="Forventet" value={l.forventet_kr} onChange={(e) => opdater(l.id, { forventet_kr: Number(e.target.value) || 0 })} style={{ padding: '6px', fontSize: '12px', minWidth: 0 }} />
            <input type="number" placeholder="Faktisk" value={l.faktisk_kr} onChange={(e) => opdater(l.id, { faktisk_kr: Number(e.target.value) || 0 })} style={{ padding: '6px', fontSize: '12px', minWidth: 0 }} />
            <button onClick={() => fjern(l.id)} style={{ background: 'transparent', border: 'none', color: 'var(--fejl)', cursor: 'pointer', fontSize: '14px', padding: '0 6px' }}>
              ×
            </button>
          </div>
        </div>
      ))}
      <div style={{ marginTop: '12px' }}>
        <Knap onClick={tilfoej}>+ Tilføj linje</Knap>
      </div>
    </div>
  );
}

function Indholdsvalg({ grupper, items, tur, paaTuren, gruppeForslag, toggleGruppe, toggleLoestItem }: {
  grupper: Gruppe[];
  items: Item[];
  tur: Tur;
  paaTuren: Set<Reference>;
  gruppeForslag: Gruppe[];
  toggleGruppe: (uid: Reference) => Promise<void>;
  toggleLoestItem: (uid: Reference) => Promise<void>;
}) {
  return (
    <div>
      {gruppeForslag.length > 0 && (
        <div style={{ padding: '10px 12px', background: 'var(--accent-bg)', borderRadius: '8px', marginBottom: '16px' }}>
          <SektionsTitel>Foreslåede grupper</SektionsTitel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {gruppeForslag.map((g) => (
              <button
                key={g.uid}
                onClick={() => toggleGruppe(g.uid)}
                style={{ padding: '5px 12px', fontSize: '12px', background: 'var(--bg-forhoejet)', color: 'var(--accent)', border: '1px solid var(--accent-border)', borderRadius: '14px', cursor: 'pointer', fontWeight: 500 }}
              >
                + {g.navn}
              </button>
            ))}
          </div>
        </div>
      )}

      <SektionsTitel>Grupper</SektionsTitel>
      {grupper.length === 0 && (
        <div style={{ fontSize: '13px', color: 'var(--tekst-svag)', padding: '4px 0' }}>Ingen grupper endnu.</div>
      )}
      {grupper.map((g) => {
        const gItems = items.filter((i) => g.item_ids.includes(i.uid));
        const gVaegt = gItems.reduce((s, i) => s + i.vaegt_g, 0);
        return (
          <Vaelgerraekke
            key={g.uid}
            titel={g.navn}
            detalje={`${gItems.length} items · ${kg(gVaegt)} kg`}
            valgt={tur.gruppe_ids.includes(g.uid)}
            toggle={() => toggleGruppe(g.uid)}
          />
        );
      })}

      <div style={{ marginTop: '18px' }}>
        <SektionsTitel>Løse items</SektionsTitel>
        {items.filter((i) => i.status === 'ejer').map((item) => {
          const valgtLoest = tur.loese_item_ids.includes(item.uid);
          // Items der allerede kommer via en gruppe kan ikke fravælges her.
          const viaGruppe = paaTuren.has(item.uid) && !valgtLoest;
          return (
            <Vaelgerraekke
              key={item.uid}
              titel={item.navn}
              detalje={`${item.vaegt_g} g${item.delt ? ' · delt' : ''}${viaGruppe ? ' · via gruppe' : ''}`}
              valgt={valgtLoest || viaGruppe}
              laast={viaGruppe}
              toggle={() => toggleLoestItem(item.uid)}
            />
          );
        })}
      </div>
    </div>
  );
}

// Afkrydsningsrække brugt til både grupper og løse items.
// Hvem slæber hvad. Vægten pr. person er ellers et gennemsnit, og det siger
// intet om, at én har fået teltet med.
function Fordeling({ deltagere, pakItems, baerer, vaegte, toggle }: {
  deltagere: Deltager[];
  pakItems: Item[];
  baerer: Map<Reference, string>;
  vaegte: Baerevaegt[];
  toggle: (deltagerId: string, item: Item) => Promise<void>;
}) {
  const [valgt, setValgt] = useState(deltagere[0]?.id ?? '');
  // Fjernes en deltager mens sektionen er åben, falder vi tilbage til den
  // første der er tilbage.
  const aktiv = deltagere.some((d) => d.id === valgt) ? valgt : (deltagere[0]?.id ?? '');

  return (
    <div>
      <div style={{ display: 'grid', gap: '4px', marginBottom: '14px' }}>
        {vaegte.map((v) => (
          <button
            key={v.id}
            onClick={() => setValgt(v.id)}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              gap: '10px',
              padding: '8px 10px',
              borderRadius: '8px',
              cursor: 'pointer',
              textAlign: 'left',
              fontSize: '13px',
              border: `1px solid ${v.id === aktiv ? 'var(--accent-border)' : 'transparent'}`,
              background: v.id === aktiv ? 'var(--accent-bg)' : 'transparent',
              color: 'var(--tekst)'
            }}
          >
            <span style={{ fontWeight: v.id === aktiv ? 600 : 400 }}>{v.navn}</span>
            <span style={{ fontSize: '11px', color: 'var(--tekst-dæmpet)', whiteSpace: 'nowrap' }}>
              {v.antal === 0 ? 'intet endnu' : `${v.antal} ting · ${kg(v.vaegt_g)} kg`}
            </span>
          </button>
        ))}
      </div>

      {aktiv && (
        <div>
          <SektionsTitel>Gear på turen</SektionsTitel>
          {pakItems.map((item) => {
            const hos = baerer.get(item.uid);
            // Gear en anden allerede har taget, kan ikke også være dit — men
            // det skal kunne ses, så man ved hvorfor det ikke er til rådighed.
            const hosAnden = hos !== undefined && hos !== aktiv;
            const hosNavn = deltagere.find((d) => d.id === hos)?.navn;

            return (
              <label
                key={item.uid}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '7px 10px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  marginBottom: '2px',
                  opacity: hosAnden ? 0.55 : 1,
                  background: hos === aktiv ? 'var(--accent-bg)' : 'transparent'
                }}
              >
                <input
                  type="checkbox"
                  checked={hos === aktiv}
                  onChange={() => toggle(aktiv, item)}
                  style={{ width: 'auto' }}
                />
                <span style={{ flex: 1, minWidth: 0, fontSize: '13px' }}>
                  {item.navn || 'Uden navn'}
                  {item.delt && <span style={{ fontSize: '10px', color: 'var(--tekst-svag)', marginLeft: '6px' }}>delt</span>}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--tekst-dæmpet)', whiteSpace: 'nowrap' }}>
                  {hosAnden ? `hos ${hosNavn}` : `${item.vaegt_g} g`}
                </span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

// "3 af 8 fordelt" — nok til at se om der er mere at tage stilling til.
function fordelingsResume(tur: Tur, pakItems: Item[]): string {
  const baerer = baererAf(tur);
  const fordelt = pakItems.filter((i) => baerer.has(i.uid)).length;

  if (fordelt === 0) return `Intet af ${pakItems.length} fordelt`;
  if (fordelt === pakItems.length) return 'Alt er fordelt';
  return `${fordelt} af ${pakItems.length} fordelt`;
}

// Delingen af en tur. Linket er det eneste der giver adgang, så det kan
// trækkes tilbage — og et nyt link får et nyt token.
function Deling({ token, snapshot, deltagelser, gearnavne, del, stop }: {
  token: string;
  snapshot: string;
  deltagelser: Deltagelse[];
  // uid → navn, så en der har meldt sig kan nævnes ved det grej hun tager.
  gearnavne: Map<Reference, string>;
  del: () => Promise<void>;
  stop: () => Promise<void>;
}) {
  const [kopieret, setKopieret] = useState(false);

  if (!token) {
    return (
      <div>
        <div style={{ fontSize: '13px', color: 'var(--tekst-dæmpet)', lineHeight: 1.55, marginBottom: '12px' }}>
          Lav et link til dem der skal med. De skal logge ind for at åbne det,
          og så kan de skrive hvad de selv tager med, og hvad de bærer af det
          fælles. De ser turen, pakkelisten og din besked — ikke dit øvrige
          inventar og ingen priser.
        </div>
        <Knap variant="primaer" onClick={del}>Lav et gæstelink</Knap>
      </div>
    );
  }

  const link = deleLink(token);
  const delt = laesDeltDen(snapshot);
  // Et link lavet et sted gæsten ikke kan nå, virker kun for én selv — og det
  // opdager man først, når gæsten skriver tilbage.
  const advarsel = linkadvarsel();

  const kopier = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setKopieret(true);
      setTimeout(() => setKopieret(false), 2000);
    } catch {
      // Uden adgang til udklipsholderen kan linket stadig markeres i feltet.
    }
  };

  return (
    <div>
      <input
        readOnly
        value={link}
        onFocus={(e) => e.currentTarget.select()}
        style={{ width: '100%', fontSize: '12px', marginBottom: '8px' }}
      />

      <div style={{ fontSize: '11px', color: 'var(--tekst-svag)', marginBottom: '10px' }}>
        Gæsten lander på <strong style={{ fontWeight: 500 }}>{linkvaert()}</strong>
      </div>

      {advarsel && <Linkfejl slags={advarsel} />}

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <Knap variant="primaer" onClick={kopier}>{kopieret ? 'Kopieret' : 'Kopiér link'}</Knap>
        <Knap onClick={del}>Opdatér med det nyeste</Knap>
        <Knap variant="fare" onClick={stop}>Stop deling</Knap>
      </div>

      <div style={{ fontSize: '11px', color: 'var(--tekst-svag)', marginTop: '12px', lineHeight: 1.55 }}>
        De andre ser turen som den så ud {delt}. Har du rettet noget siden, så tryk
        "Opdatér med det nyeste". Alle med linket og en konto kan se turen — indtil
        du stopper delingen.
      </div>

      <Meldtind deltagelser={deltagelser} gearnavne={gearnavne} />
    </div>
  );
}

// Hvem der er kommet med, og det man ikke kan aflæse af pakkelisten. Selve
// grejet står dér — det er én tur og én liste.
function Meldtind({ deltagelser, gearnavne }: {
  deltagelser: Deltagelse[];
  gearnavne: Map<Reference, string>;
}) {
  // To der har meldt sig på det samme telt er ikke en fejl appen kan afgøre,
  // men det er noget ejeren skal se frem for at opdage det på P-pladsen.
  const dobbelt = [...baererePrGear(deltagelser).entries()].filter(([, navne]) => navne.length > 1);

  if (deltagelser.length === 0) return null;

  return (
    <div style={{ marginTop: '18px', paddingTop: '14px', borderTop: '1px solid var(--border-svag)' }}>
      <SektionsTitel>Med på turen ({deltagelser.length})</SektionsTitel>

      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {deltagelser.map((d) => <Chip key={d.pb_id ?? d.user}>{visningsnavn(d)}</Chip>)}
      </div>

      <div style={{ fontSize: '11px', color: 'var(--tekst-svag)', marginTop: '8px', lineHeight: 1.55 }}>
        Det de tager med, står i pakkelisten sammen med dit eget.
      </div>

      {dobbelt.map(([uid, navne]) => (
        <div key={uid} style={{ fontSize: '12px', color: 'var(--advarsel)', marginTop: '8px' }}>
          {navne.join(' og ')} har begge meldt sig på {gearnavne.get(uid) ?? 'noget der er taget af listen'}.
        </div>
      ))}
    </div>
  );
}

// De to tilfælde vi kan afgøre med sikkerhed. En preview-adresse vi ikke kan
// genkende, fanges af værtsnavnet ovenover.
function Linkfejl({ slags }: { slags: 'lokal' | 'preview' }) {
  return (
    <div style={{
      padding: '10px 12px',
      marginBottom: '10px',
      borderRadius: '8px',
      background: 'var(--advarsel-bg)',
      border: '1px solid var(--advarsel-border)',
      fontSize: '12px',
      color: 'var(--advarsel)',
      lineHeight: 1.55
    }}>
      {slags === 'lokal'
        ? '⚠ Du kører appen lokalt. Linket virker kun på denne maskine — åbn turen på den rigtige adresse for at få et link du kan sende videre.'
        : '⚠ Det her er en preview-adresse. Den er låst bag login, så linket virker kun for dig. Åbn turen på den rigtige adresse for at få et link du kan sende videre.'}
    </div>
  );
}

function laesDeltDen(snapshot: string): string {
  try {
    const d = new Date((JSON.parse(snapshot) as { delt_den?: string }).delt_den ?? '');
    if (!Number.isNaN(d.getTime())) return `den ${d.toLocaleDateString('da-DK')}`;
  } catch {
    // Ikke noget vi kan læse — sig det vagt frem for at gætte.
  }
  return 'da du delte den';
}

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
        padding: '8px 10px',
        borderRadius: '8px',
        cursor: laast ? 'default' : 'pointer',
        opacity: laast ? 0.5 : 1,
        background: valgt && !laast ? 'var(--accent-bg)' : 'transparent',
        marginBottom: '2px'
      }}
    >
      <input type="checkbox" checked={valgt} disabled={laast} onChange={toggle} style={{ width: 'auto' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', color: 'var(--tekst)' }}>{titel || 'Uden navn'}</div>
        <div style={{ fontSize: '11px', color: 'var(--tekst-dæmpet)' }}>{detalje}</div>
      </div>
    </label>
  );
}

function Noegletal({ vaerdi, label }: { vaerdi: string; label: string }) {
  return (
    <div>
      <div style={{ fontSize: '18px', fontWeight: 500, fontFamily: "'Fraunces', Georgia, serif" }}>{vaerdi}</div>
      <div style={{ fontSize: '10px', color: 'var(--tekst-dæmpet)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Hjælpere
// ─────────────────────────────────────────────

const VISNINGER: readonly Visning[] = ['gruppe', 'tag', 'person'];

const VISNING_LABEL: Record<Visning, string> = {
  gruppe: 'Efter gruppe',
  tag: 'Efter tag',
  person: 'Efter person'
};

function kg(gram: number): string {
  return (gram / 1000).toFixed(2);
}

function beregnNaetter(start: string, slut: string): number {
  if (!start || !slut) return 0;
  const dage = (new Date(slut).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24);
  return Math.max(0, Math.floor(dage));
}

// Kort resumé til den foldede vejrsektion: spændet over hele turen.
function vejrResume(data: VejrData | null): string | undefined {
  if (!data || data.dage.length === 0) return undefined;

  const min = Math.min(...data.dage.map((d) => d.temp_min));
  const maks = Math.max(...data.dage.map((d) => d.temp_max));
  const nedboer = data.dage.reduce((s, d) => s + d.nedboer_mm, 0);

  return `${min}–${maks}°C · ${nedboer > 0 ? `${Math.round(nedboer)} mm nedbør` : 'tørt'}`;
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

// Slår en reference til eller fra i en liste.
function vekslet(uids: Reference[], uid: Reference): Reference[] {
  return uids.includes(uid) ? uids.filter((x) => x !== uid) : [...uids, uid];
}

function formatterDag(dato: string): string {
  const d = new Date(dato);
  const dage = ['søn', 'man', 'tir', 'ons', 'tor', 'fre', 'lør'];
  return `${dage[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
}

export default TurDetalje;
