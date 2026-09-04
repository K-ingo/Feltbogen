import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import type { Item } from './db';
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
      <div style={{ fontSize: 'var(--skrift-detalje)', color: 'var(--tekst-dæmpet)', marginBottom: '14px', lineHeight: 1.55 }}>
        Det du skriver her, kan de andre på turen se. Resten af turen er ejerens.
      </div>

      <div style={{ display: 'grid', gap: '16px' }}>
        <Felt
          label="Dit navn"
          value={kladde.navn}
          onChange={(v) => ret({ navn: v })}
          placeholder="Så de andre ved hvem der tager hvad"
        />

        <VaelgMitGrej
          valgt={kladde.medbragt}
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
        <span style={{ fontSize: 'var(--skrift-detalje)', color: tilstand === 'fejl' ? 'var(--fejl)' : 'var(--tekst-dæmpet)' }}>
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

// Man vælger sit grej på samme måde som når man selv laver en tur: fra sine
// egne grupper og sit eget inventar. Det er det flow der i forvejen virker —
// at skrive navn og vægt af i hånden var både besværligt og forvirrende.
//
// Der kopieres navn og vægt over, ikke en henvisning. Ejeren af turen kan
// ikke læse ens inventar, og det skal hun heller ikke kunne.
function VaelgMitGrej({ valgt, saet }: {
  valgt: MedbragtGear[];
  saet: (gear: MedbragtGear[]) => void;
}) {
  const [soeg, setSoeg] = useState('');

  const mine = useLiveQuery(() => db.items.where('status').equals('ejer').toArray());
  const grupper = useLiveQuery(() => db.grupper.toArray());

  const paaListen = new Set(valgt.map((g) => g.navn.toLowerCase()));
  const somGear = (i: Item): MedbragtGear => ({ navn: i.navn, vaegt_g: i.vaegt_g });

  const skift = (item: Item) => {
    const erMed = paaListen.has(item.navn.toLowerCase());
    saet(erMed
      ? valgt.filter((g) => g.navn.toLowerCase() !== item.navn.toLowerCase())
      : [...valgt, somGear(item)]);
  };

  // En hel gruppe ad gangen — det er den genvej der gør turopsætningen hurtig.
  const tagGruppe = (uids: string[]) => {
    const nye = (mine ?? [])
      .filter((i) => uids.includes(i.uid) && i.navn.trim() !== '' && !paaListen.has(i.navn.toLowerCase()))
      .map(somGear);
    if (nye.length > 0) saet([...valgt, ...nye]);
  };

  if (!mine || mine.length === 0) {
    return (
      <div style={{ fontSize: 'var(--skrift-detalje)', color: 'var(--tekst-svag)', lineHeight: 1.6 }}>
        Du har ikke noget gear i din Feltbog endnu. Læg det ind under Inventar,
        så kan du vælge det her.
      </div>
    );
  }

  const synlige = mine.filter((i) =>
    i.navn.trim() !== '' && i.navn.toLowerCase().includes(soeg.toLowerCase()));

  return (
    <div>
      <SektionsTitel>Hvad tager du med</SektionsTitel>

      {(grupper ?? []).length > 0 && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
          {(grupper ?? []).filter((g) => g.item_ids.length > 0).map((g) => (
            <Knap key={g.uid} onClick={() => tagGruppe(g.item_ids)}>
              + {g.navn || 'Uden navn'}
            </Knap>
          ))}
        </div>
      )}

      <input
        value={soeg}
        onChange={(e) => setSoeg(e.target.value)}
        placeholder="Søg i dit gear"
        style={{ width: '100%', fontSize: 'var(--skrift-brod)', marginBottom: '8px' }}
      />

      <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'grid', gap: '2px' }}>
        {synlige.length === 0 && (
          <div style={{ fontSize: 'var(--skrift-detalje)', color: 'var(--tekst-svag)' }}>
            Intet gear passer på søgningen.
          </div>
        )}
        {synlige.map((i) => (
          <label
            key={i.uid}
            style={{
              display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 2px',
              borderBottom: '1px solid var(--border-svag)', fontSize: 'var(--skrift-knap)', cursor: 'pointer'
            }}
          >
            <input
              type="checkbox"
              checked={paaListen.has(i.navn.toLowerCase())}
              onChange={() => skift(i)}
            />
            <span style={{ flex: 1, minWidth: 0 }}>{i.navn}</span>
            <span style={{ color: 'var(--tekst-dæmpet)', fontSize: 'var(--skrift-detalje)' }}>{i.vaegt_g} g</span>
          </label>
        ))}
      </div>

      <div style={{ fontSize: 'var(--skrift-lille)', color: 'var(--tekst-svag)', marginTop: '8px' }}>
        {valgt.length === 0
          ? 'Ingenting valgt endnu.'
          : `${valgt.length} ${valgt.length === 1 ? 'ting' : 'ting'} · ${(valgt.reduce((s, g) => s + g.vaegt_g, 0) / 1000).toFixed(2)} kg`}
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
                fontSize: 'var(--skrift-knap)', cursor: 'pointer'
              }}
            >
              <input type="checkbox" checked={mit} onChange={() => skift(g.uid)} />
              <span style={{ flex: 1, minWidth: 0 }}>{g.navn || 'Uden navn'}</span>
              {/* Ejeren har måske allerede sat en på det. Det skal man kunne
                  se før man melder sig — ikke først bagefter. */}
              {g.baerer && !mit && <Chip storrelse="lille">{g.baerer}</Chip>}
              <span style={{ color: 'var(--tekst-dæmpet)', fontSize: 'var(--skrift-detalje)', whiteSpace: 'nowrap' }}>
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
