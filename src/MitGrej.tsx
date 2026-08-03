import { useState, useEffect } from 'react';
import type { Deltagelse, MedbragtGear } from './deltagelse';
import type { GaesteAfsnit } from './gaest';
import { Knap, Felt, SektionsTitel, Chip } from './ui';

interface Props {
  mig: Deltagelse;
  // Ejerens pakkeliste. Det der er markeret som delt, kan man melde sig til
  // at bære.
  faelles: GaesteAfsnit[];
  // Giver den gemte række tilbage, så kladden kan følge med. Null ved fejl.
  gem: (d: Deltagelse) => Promise<Deltagelse | null>;
  meldFra: (pbId: string) => Promise<boolean>;
}

// Det en deltager selv kan røre på en tur hun ikke ejer: sit navn, sit eget
// grej, og hvad hun bærer af det fælles.
//
// Der redigeres på en kopi og gemmes med en knap — i modsætning til resten af
// appen, hvor felter skrives med det samme. Her går hvert gem over nettet til
// en tur der ikke er ens egen, og så er det bedre at sende én gang end at
// sende for hvert tastetryk.
function MitGrej({ mig, faelles, gem, meldFra }: Props) {
  const [kladde, setKladde] = useState<Deltagelse>(mig);
  const [tilstand, setTilstand] = useState<'ren' | 'gemmer' | 'gemt' | 'fejl'>('ren');

  // Kladden sættes ved første render, og dér er ens egen række endnu ikke
  // hentet ned fra serveren. Når den lander, skal felterne fyldes ud med det
  // man skrev sidst — ellers skriver man oven i sig selv.
  //
  // Kun når rækken er en anden end den kladden allerede kender. Efter et gem
  // er de to den samme, og så ville en nulstilling tørre kvitteringen væk.
  useEffect(() => {
    if (mig.pb_id && mig.pb_id !== kladde.pb_id) setKladde(mig);
    // kladde.pb_id læses, men skal ikke selv sætte effekten i gang igen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mig.pb_id]);

  const ret = (aendring: Partial<Deltagelse>) => {
    setKladde((foer) => ({ ...foer, ...aendring }));
    setTilstand('ren');
  };

  const skriv = async () => {
    setTilstand('gemmer');
    const gemt = await gem(rensetFor(kladde));
    if (!gemt) { setTilstand('fejl'); return; }

    setKladde(gemt);
    setTilstand('gemt');
  };

  const forlad = async () => {
    if (!kladde.pb_id) return;
    if (!await meldFra(kladde.pb_id)) { setTilstand('fejl'); return; }
    setKladde({ ...kladde, pb_id: undefined, navn: '', medbragt: [], baerer: [] });
    setTilstand('ren');
  };

  // Kun det ejeren har markeret som delt kan fordeles. Gear uden uid kommer
  // fra et gammelt link og kan ikke peges på.
  const deltGrej = faelles.flatMap((a) => a.items).filter((i) => i.delt && i.uid);

  return (
    <div style={{ marginTop: '26px', paddingTop: '18px', borderTop: '1px solid var(--border-svag)' }}>
      <SektionsTitel>Mit grej</SektionsTitel>
      <div style={{ fontSize: '12px', color: 'var(--tekst-dæmpet)', marginBottom: '14px', lineHeight: 1.55 }}>
        Det du skriver her, kan de andre på turen se. Resten af turen er ejerens.
      </div>

      <div style={{ display: 'grid', gap: '16px' }}>
        <Felt
          label="Dit navn"
          value={kladde.navn}
          onChange={(v) => ret({ navn: v })}
          placeholder="Så de andre ved hvem der tager hvad"
        />

        <Medbragt
          gear={kladde.medbragt}
          saet={(medbragt) => ret({ medbragt })}
        />

        {deltGrej.length > 0 && (
          <Faellesgrej
            grej={deltGrej}
            valgt={kladde.baerer}
            saet={(baerer) => ret({ baerer })}
          />
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '18px', flexWrap: 'wrap' }}>
        <Knap variant="primaer" onClick={() => void skriv()} disabled={tilstand === 'gemmer'}>
          {tilstand === 'gemmer' ? 'Sender…' : 'Gem på turen'}
        </Knap>
        {kladde.pb_id && (
          <Knap variant="tekst" onClick={() => void forlad()}>Fjern mig fra turen</Knap>
        )}
        <span style={{ fontSize: '12px', color: tilstand === 'fejl' ? 'var(--fejl)' : 'var(--tekst-dæmpet)' }}>
          {kvittering(tilstand)}
        </span>
      </div>
    </div>
  );
}

function kvittering(tilstand: 'ren' | 'gemmer' | 'gemt' | 'fejl'): string {
  if (tilstand === 'gemt') return 'Gemt — de andre kan se det nu.';
  if (tilstand === 'fejl') return 'Kunne ikke gemme. Prøv igen når du har forbindelse.';
  return '';
}

// Tomme linjer og linjer uden navn skal ikke stå på de andres pakkeliste.
function rensetFor(d: Deltagelse): Deltagelse {
  return {
    ...d,
    navn: d.navn.trim(),
    medbragt: d.medbragt
      .map((g) => ({ navn: g.navn.trim(), vaegt_g: g.vaegt_g }))
      .filter((g) => g.navn !== '')
  };
}

function Medbragt({ gear, saet }: { gear: MedbragtGear[]; saet: (g: MedbragtGear[]) => void }) {
  const ret = (n: number, aendring: Partial<MedbragtGear>) =>
    saet(gear.map((g, i) => (i === n ? { ...g, ...aendring } : g)));

  return (
    <div>
      <SektionsTitel>Hvad tager du med</SektionsTitel>
      {gear.length === 0 && (
        <div style={{ fontSize: '12px', color: 'var(--tekst-svag)', marginBottom: '8px' }}>
          Ingenting endnu.
        </div>
      )}

      <div style={{ display: 'grid', gap: '8px' }}>
        {gear.map((g, n) => (
          <div key={n} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              value={g.navn}
              placeholder="Fx sovepose"
              onChange={(e) => ret(n, { navn: e.target.value })}
              style={{ flex: 1, fontSize: '14px', minWidth: 0 }}
            />
            <input
              type="number"
              value={g.vaegt_g || ''}
              placeholder="g"
              onChange={(e) => ret(n, { vaegt_g: Math.max(0, Number(e.target.value) || 0) })}
              style={{ width: '80px', fontSize: '14px' }}
            />
            <button
              onClick={() => saet(gear.filter((_, i) => i !== n))}
              aria-label={`Fjern ${g.navn || 'linjen'}`}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--tekst-svag)', fontSize: '18px', padding: '0 4px'
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div style={{ marginTop: '8px' }}>
        <Knap onClick={() => saet([...gear, { navn: '', vaegt_g: 0 }])}>+ Tilføj grej</Knap>
      </div>
    </div>
  );
}

function Faellesgrej({ grej, valgt, saet }: {
  grej: { uid: string; navn: string; vaegt_g: number; baerer: string }[];
  valgt: string[];
  saet: (uids: string[]) => void;
}) {
  const skift = (uid: string) =>
    saet(valgt.includes(uid) ? valgt.filter((u) => u !== uid) : [...valgt, uid]);

  return (
    <div>
      <SektionsTitel>Fælles grej — hvad bærer du?</SektionsTitel>
      <div style={{ display: 'grid', gap: '2px' }}>
        {grej.map((g) => {
          const mit = valgt.includes(g.uid);
          return (
            <label
              key={g.uid}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '8px 4px', borderBottom: '1px solid var(--border-svag)',
                fontSize: '13px', cursor: 'pointer'
              }}
            >
              <input type="checkbox" checked={mit} onChange={() => skift(g.uid)} />
              <span style={{ flex: 1, minWidth: 0 }}>{g.navn || 'Uden navn'}</span>
              {/* Ejeren har måske allerede sat en på det. Det skal man kunne
                  se før man melder sig — ikke først bagefter. */}
              {g.baerer && !mit && <Chip storrelse="lille">{g.baerer}</Chip>}
              <span style={{ color: 'var(--tekst-dæmpet)', fontSize: '12px', whiteSpace: 'nowrap' }}>
                {g.vaegt_g} g
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

export default MitGrej;
