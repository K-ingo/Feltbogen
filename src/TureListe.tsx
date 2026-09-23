import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Ikon } from './Ikon';
import { matcherTur } from './turSoegning';
import { db, etiket } from './db';
import type { Billede, Tur } from './db';
import { formatterPeriode } from './datotekst';
import { Skal } from './Skal';
import type { Fane } from './Skal';
import { Knap, Badge, ListeRaekke, SektionsTitel, TomListe, Segment } from './ui';
import { Billedvisning } from './BilledSektion';
import { KomIGang } from './KomIGang';
import { hero } from './billeder';
import { useErDesktop } from './useMedie';
import { faseAf, FASENAVN, manglerSted } from './turfase';
import type { Fase } from './turfase';

// Farven signalerer hvor turen er i sit livsforløb.
//
// "Gjort op" er den eneste grønne: det er den eneste af faserne, hvor der
// ikke er mere, der skal gøres. En afsluttet tur, der ikke er gjort op,
// mangler stadig det sidste, og skal ikke se færdig ud.
const FASE_NIVEAU: Record<Fase, 'info' | 'accent' | 'advarsel' | 'succes'> = {
  kladde: 'info',
  klar: 'accent',
  aktiv: 'advarsel',
  afsluttet: 'info',
  evalueret: 'succes'
};

interface Props {
  fane: Fane;
  skift: (f: Fane) => void;
  aabnTur: (id: number, nyOprettet?: boolean) => void;
  aabnDeltTur: (id: number) => void;
  nyTur: () => void;
  // Det guidede flow til den første tur. Uden det åbner den tomme tilstand
  // det almindelige opret-ark.
  foersteTur?: () => void;
  nytItem?: () => void;
}

function TureListe({ fane, skift, aabnTur, aabnDeltTur, nyTur, foersteTur, nytItem }: Props) {
  const erDesktop = useErDesktop();
  const [soegning, setSoegning] = useState('');
  // "Gitter" og ikke "Kort": kort betyder både et kartotekskort og et
  // landkort på dansk, og en app med steder i har brug for at det andet
  // ord er ledigt.
  const [visning, setVisning] = useState<'Gitter' | 'Liste'>('Gitter');
  const ture = useLiveQuery(() => db.ture.orderBy('startdato').reverse().toArray());
  // Ture andre har delt med én. De ligger i deres egen tabel og kan ikke
  // redigeres, men de hører hjemme her — det er stadig ture man skal med på.
  const delte = useLiveQuery(() => db.delte_ture.orderBy('gemt').reverse().toArray());
  const billeder = useLiveQuery(() => db.billeder.toArray()) ?? [];

  const egne = ture?.length ?? 0;
  const antalDelte = delte?.length ?? 0;
  const matcher = (navn: string, sted: string) => matcherTur(navn, sted, soegning);
  const visteTure = ture?.filter(t => matcher(t.navn, t.sted)) ?? [];
  const visteDelte = delte?.filter(d => matcher(d.snapshot.navn, d.snapshot.sted)) ?? [];

  return (
    // Telefonen har sin egen header efter docs/design/mobile/02-ture.html:
    // titel, antal og "+ Ny tur" på samme linje. Knappen er skærmens ene
    // fyldte accent, og derfor ingen FAB — den ville være nummer to.
    <Skal
      fane={fane}
      skift={skift}
      titel={erDesktop ? 'Ture' : undefined}
      undertitel={erDesktop ? undertitel(egne, antalDelte) : undefined}
      handlinger={<Knap variant="primaer" onClick={nyTur}>+ Ny tur</Knap>}
    >
      {!erDesktop && (
        <header className="ture-mobil-hoved">
          <div>
            <h1>Ture</h1>
            <p>{undertitel(egne, antalDelte)}</p>
          </div>
          <Knap variant="primaer" onClick={nyTur}>+ Ny tur</Knap>
        </header>
      )}
      {/* Venter på basen, så den tomme tilstand ikke blinker forbi på vej ind
          til en liste med ture. "+ Ny tur" i headeren er stadig skærmens ene
          fyldte accent. */}
      {ture !== undefined && delte !== undefined && egne === 0 && antalDelte === 0 && (
        <KomIGang
          overskrift="Ingen ture endnu"
          tekst="Din første historie starter her. Opret turen, og skriv det grej ind, du vil pakke med."
          opretTur={foersteTur ?? nyTur}
          tilfoejGrej={nytItem ?? (() => skift('inventar'))}
          fokus="tur"
        />
      )}
      {egne + antalDelte > 0 && <input type="search" aria-label="Søg ture" placeholder={erDesktop ? 'Find en tur eller et sted…' : 'Søg efter tur eller sted…'} value={soegning} onChange={e => setSoegning(e.target.value)} style={{ width: '100%', marginBottom: erDesktop ? '24px' : '12px' }} />}
      {soegning && visteTure.length + visteDelte.length === 0 && <TomListe handling="Ryd søgning" onClick={() => setSoegning('')}>Ingen ture matcher “{soegning}”. Prøv et andet navn eller sted.</TomListe>}

      {egne + antalDelte > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: erDesktop ? '16px' : '12px', flexWrap: 'wrap' }}>
        {/* På telefonen er "Dine ture" en overskrift over kortene, som i
            tegningen; på PC'en er den en stille linje. */}
        <span style={erDesktop
          ? { color: 'var(--tekst-dæmpet)', fontSize: 'var(--skrift-detalje)' }
          : { color: 'var(--tekst)', fontSize: 'var(--skrift-detalje)', fontWeight: 600 }}>{soegning ? `${visteTure.length + visteDelte.length} af ${egne + antalDelte} ture` : 'Dine ture'}</span>
        {/* Stille og ikke fyldt: "+ Ny tur" er skærmens ene fyldte accent.
            Referencen tegner "Gitter" fyldt, men en vælger, der ændrer
            visningen, er ikke skærmens næste skridt. */}
        <Segment vaerdier={['Gitter', 'Liste'] as const} valgt={visning} vaelg={setVisning} stille />
      </div>}
      <div className={`trip-grid${visning === 'Liste' ? ' is-compact' : ''}${erDesktop ? '' : ' trip-grid--mobil'}`}>
      {visteTure.map((t) => (
        <button
          className="trip-card"
          key={t.uid}
          onClick={() => t.id !== undefined && aabnTur(t.id)}
        >
          {/* På telefonen er toppen et smalt accent-bånd med turens
              kategori, som i tegningen — et billede på 160 px gav plads til
              halvandet kort på skærmen. PC'en beholder forsidebilledet. */}
          {erDesktop
            ? <Forsidebillede tur={t} billeder={billeder} />
            : <span className="trip-card-baand"><Ikon navn="kompas" size={14} />{etiket(t.aktivitet)}</span>}
          <span className="trip-card-body">
            <span className="trip-card-maerker">
              <Badge niveau={FASE_NIVEAU[faseAf(t)]}>{FASENAVN[faseAf(t)]}</Badge>
              {/* Står ved siden af fasen og ikke i stedet for den: en tur kan
                  både være en kladde og mangle et sted, og de to ting siger
                  hver sit. Linjen nedenunder siger "Sted ikke valgt" i
                  forvejen — mærket er det, man kan se på afstand. */}
              {manglerSted(t) && <Badge niveau="advarsel">Mangler sted</Badge>}
            </span>
            <span className="trip-card-title">{t.navn || 'Din næste tur'}</span>
            <span className="trip-card-meta">{t.sted || 'Sted ikke valgt'} · {formatterPeriode(t.startdato, t.slutdato) || 'Dato ikke valgt'}</span>
            <span className="trip-card-meta">{t.personer} {t.personer === 1 ? 'person' : 'personer'} · {t.naetter} {t.naetter === 1 ? 'nat' : 'nætter'}</span>
          </span>
        </button>
      ))}
      </div>

      {visteDelte.length > 0 && (
        <div style={{ marginTop: egne > 0 ? '26px' : '4px' }}>
          <SektionsTitel>Delt med dig</SektionsTitel>
          {visteDelte.map((d) => (
            <ListeRaekke
              key={d.token}
              onClick={() => d.id !== undefined && aabnDeltTur(d.id)}
              titel={
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {d.snapshot.navn || 'Uden navn'}
                  <Badge niveau="info">Delt</Badge>
                </span>
              }
              detalje={
                <>
                  {d.snapshot.sted || 'Intet sted'}
                  {formatterPeriode(d.snapshot.startdato, d.snapshot.slutdato) && ` · ${formatterPeriode(d.snapshot.startdato, d.snapshot.slutdato)}`}
                </>
              }
            />
          ))}
        </div>
      )}
    </Skal>
  );
}

function undertitel(egne: number, delte: number): string {
  const mine = `${egne} ${egne === 1 ? 'tur' : 'ture'}`;
  return delte > 0 ? `${mine} · ${delte} delt med dig` : mine;
}

// Turens forsidebillede som en lille firkant. Har turen ingen billeder, står
// der ingenting — en tom pladsholder ville give listen en spalte af huller.
function Forsidebillede({ tur, billeder }: { tur: Tur; billeder: Billede[] }) {
  const forside = hero(billeder, tur);
  if (!forside) return (
    <span className={`trip-card-photo trip-card-fallback trip-card-fallback--${tur.terraen}`}>
      <Ikon navn="kompas" size={38} />
      <small>{etiket(tur.aktivitet)} · {etiket(tur.terraen)}</small>
    </span>
  );

  return (
    <div className="trip-card-photo" style={{
      width: '100%',
      height: '180px',
      flexShrink: 0,
      overflow: 'hidden',
      background: 'var(--bg-forhoejet)',
      border: '1px solid var(--border-svag)'
    }}>
      <Billedvisning billede={forside} />
    </div>
  );
}

export default TureListe;
