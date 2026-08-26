import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import type { Item, ItemStatus } from './db';
import { opretTomtItem } from './opret';
import { sidstBrugtPrItem, grupperPrItem } from './statistik';
import { Skal } from './Skal';
import type { Fane } from './Skal';
import { useErDesktop } from './useMedie';
import { Knap, TagChips, ListeRaekke, TomListe } from './ui';

interface Props {
  fane: Fane;
  skift: (f: Fane) => void;
  aabnItem: (id: number, nyOprettet?: boolean) => void;
}

// Ejer og Overvejer er to forskellige lister i hovedet på brugeren, så de er
// faner frem for et filter. Solgt får sin egen fane, så det gear ikke bliver
// usynligt når man har markeret det.
const FANEBLADE: { status: ItemStatus; label: string }[] = [
  { status: 'ejer', label: 'Ejer' },
  { status: 'overvejer', label: 'Overvejer' },
  { status: 'solgt', label: 'Solgt' }
];

const MAKS_TAG_CHIPS = 5;

function InventarSide({ fane, skift, aabnItem }: Props) {
  const erDesktop = useErDesktop();

  const [valgtStatus, setValgtStatus] = useState<ItemStatus>('ejer');
  const [soegning, setSoegning] = useState('');
  const [valgtTag, setValgtTag] = useState<string | null>(null);
  const [alleTagsVist, setAlleTagsVist] = useState(false);

  const items = useLiveQuery(() => db.items.toArray()) ?? [];
  const grupper = useLiveQuery(() => db.grupper.toArray()) ?? [];
  const ture = useLiveQuery(() => db.ture.toArray()) ?? [];

  const iStatus = items.filter((i) => i.status === valgtStatus);

  // Tag-chips bygges af det gear man rent faktisk har i den valgte fane,
  // sorteret efter hvor ofte de bruges.
  const tagOptaelling = new Map<string, number>();
  iStatus.forEach((i) => i.tags.forEach((t) => tagOptaelling.set(t, (tagOptaelling.get(t) ?? 0) + 1)));
  const tags = [...tagOptaelling.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
  const synligeTags = alleTagsVist ? tags : tags.slice(0, MAKS_TAG_CHIPS);

  const q = soegning.trim().toLowerCase();
  const filtreret = iStatus.filter((i) => {
    const matcherSoegning = q === '' ||
      i.navn.toLowerCase().includes(q) ||
      i.tags.some((t) => t.toLowerCase().includes(q));
    const matcherTag = valgtTag === null || i.tags.includes(valgtTag);
    return matcherSoegning && matcherTag;
  });

  const antal = (status: ItemStatus) => items.filter((i) => i.status === status).length;
  const vaerdiIStatus = iStatus.reduce((sum, i) => sum + i.pris_kr * i.antal, 0);

  const grejsaet = useLiveQuery(() => db.grupper.toArray()) ?? [];

  const nulstilFiltre = () => {
    setSoegning('');
    setValgtTag(null);
  };

  // Den nye post lander i den fane man står på, så den ikke forsvinder ud af
  // syne i det øjeblik den bliver oprettet.
  const nytItem = async () => aabnItem(await opretTomtItem(valgtStatus), true);

  return (
    <Skal
      fane={fane}
      skift={skift}
      titel="Grej"
      undertitel={`${iStatus.length} items · ${vaerdiIStatus.toLocaleString('da-DK')} kr`}
      handlinger={<Knap variant="primaer" onClick={nytItem}>+ Nyt item</Knap>}
      fab={nytItem}
    >
      {/* Grejsættene stod før som deres egen fane i bunden. De hører til her:
          et sæt er en måde at samle sit grej på, ikke et sted man arbejder.
          Linjen står øverst, så den er det første man ser — ikke gemt under
          listen hvor man aldrig ville falde over den. */}
      <ListeRaekke
        titel="Grejsæt"
        detalje={
          grejsaet.length === 0
            ? 'Saml grej i sæt, så en hel pakning kan vælges på én gang'
            : `${grejsaet.length} sæt · ${saetnavne(grejsaet)}`
        }
        onClick={() => skift('grupper')}
      />

      <div style={{ display: 'flex', gap: '6px', margin: 'var(--plads-4) 0 var(--plads-3)', flexWrap: 'wrap' }}>
        {FANEBLADE.map(({ status, label }) => (
          <button
            key={status}
            onClick={() => { setValgtStatus(status); nulstilFiltre(); }}
            style={{
              padding: '6px 14px',
              fontSize: '12px',
              borderRadius: '16px',
              cursor: 'pointer',
              fontWeight: 500,
              background: valgtStatus === status ? 'var(--accent)' : 'transparent',
              color: valgtStatus === status ? 'var(--accent-tekst)' : 'var(--tekst-dæmpet)',
              border: `1px solid ${valgtStatus === status ? 'var(--accent)' : 'var(--border)'}`
            }}
          >
            {label} ({antal(status)})
          </button>
        ))}
      </div>

      <input
        placeholder="Søg gear, tag…"
        value={soegning}
        onChange={(e) => setSoegning(e.target.value)}
        style={{ width: '100%', marginBottom: '12px' }}
      />

      {tags.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <FilterChip aktiv={valgtTag === null} vaelg={() => setValgtTag(null)}>Alle</FilterChip>
          {synligeTags.map((tag) => (
            <FilterChip key={tag} aktiv={valgtTag === tag} vaelg={() => setValgtTag(valgtTag === tag ? null : tag)}>
              {tag}
            </FilterChip>
          ))}
          {tags.length > MAKS_TAG_CHIPS && (
            <FilterChip aktiv={false} vaelg={() => setAlleTagsVist(!alleTagsVist)}>
              {alleTagsVist ? '− Færre' : `+ ${tags.length - MAKS_TAG_CHIPS} flere`}
            </FilterChip>
          )}
        </div>
      )}

      {filtreret.length === 0 ? (
        <TomListe>
          {iStatus.length === 0
            ? 'Intet gear her endnu.'
            : 'Ingen matcher. Prøv en anden søgning eller et andet tag.'}
        </TomListe>
      ) : erDesktop ? (
        <ItemTabel
          items={filtreret}
          sidstBrugt={sidstBrugtPrItem(ture, grupper)}
          grupperFor={grupperPrItem(grupper)}
          aabn={aabnItem}
        />
      ) : (
        <div>
          {filtreret.map((item) => (
            <ListeRaekke
              key={item.uid}
              titel={item.navn}
              detalje={
                <>
                  {item.vaegt_g} g · {item.delt ? 'delt' : `${item.pris_kr.toLocaleString('da-DK')} kr`}
                  {item.antal > 1 && ` · ${item.antal} stk`}
                </>
              }
              onClick={() => item.id !== undefined && aabnItem(item.id)}
            >
              <TagChips tags={item.tags} />
            </ListeRaekke>
          ))}
        </div>
      )}
    </Skal>
  );
}

function FilterChip({ aktiv, vaelg, children }: { aktiv: boolean; vaelg: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={vaelg}
      style={{
        padding: '4px 12px',
        fontSize: '11px',
        borderRadius: '14px',
        cursor: 'pointer',
        fontWeight: 500,
        background: aktiv ? 'var(--accent-bg)' : 'transparent',
        color: aktiv ? 'var(--accent)' : 'var(--tekst-dæmpet)',
        border: `1px solid ${aktiv ? 'var(--accent-border)' : 'var(--border)'}`
      }}
    >
      {children}
    </button>
  );
}

type Kolonne = 'navn' | 'vaegt' | 'pris' | 'sidst';

function ItemTabel({ items, sidstBrugt, grupperFor, aabn }: {
  items: Item[];
  sidstBrugt: Map<string, string>;
  grupperFor: Map<string, string[]>;
  aabn: (id: number) => void;
}) {
  const [sorterEfter, setSorterEfter] = useState<Kolonne>('navn');
  const [faldende, setFaldende] = useState(false);

  const sorteret = [...items].sort((a, b) => {
    const retning = faldende ? -1 : 1;
    switch (sorterEfter) {
      case 'vaegt': return (a.vaegt_g - b.vaegt_g) * retning;
      case 'pris': return (a.pris_kr - b.pris_kr) * retning;
      // Aldrig brugt sorteres nederst uanset retning.
      case 'sidst': return (sidstBrugt.get(a.uid) ?? '').localeCompare(sidstBrugt.get(b.uid) ?? '') * retning;
      default: return a.navn.localeCompare(b.navn, 'da') * retning;
    }
  });

  const skiftSortering = (kolonne: Kolonne) => {
    if (kolonne === sorterEfter) setFaldende(!faldende);
    else { setSorterEfter(kolonne); setFaldende(false); }
  };

  const celle: React.CSSProperties = {
    padding: '10px 12px',
    borderBottom: '1px solid var(--border-svag)',
    fontSize: '13px',
    textAlign: 'left'
  };

  const overskrift = (kolonne: Kolonne, label: string, bredde?: string) => (
    <th
      onClick={() => skiftSortering(kolonne)}
      style={{
        ...celle,
        width: bredde,
        cursor: 'pointer',
        fontSize: '11px',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        color: sorterEfter === kolonne ? 'var(--accent)' : 'var(--tekst-dæmpet)',
        whiteSpace: 'nowrap'
      }}
    >
      {label}{sorterEfter === kolonne && (faldende ? ' ↓' : ' ↑')}
    </th>
  );

  return (
    <div style={{ overflowX: 'auto', border: '1px solid var(--border-svag)', borderRadius: '12px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '620px' }}>
        <thead style={{ background: 'var(--bg-forhoejet)' }}>
          <tr>
            {overskrift('navn', 'Navn')}
            <th style={{ ...celle, fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--tekst-dæmpet)' }}>
              Grupper
            </th>
            {overskrift('vaegt', 'Vægt', '90px')}
            {overskrift('pris', 'Pris', '90px')}
            {overskrift('sidst', 'Sidst brugt', '120px')}
          </tr>
        </thead>
        <tbody>
          {sorteret.map((item) => {
            const brugt = sidstBrugt.get(item.uid);
            return (
              <tr
                key={item.uid}
                onClick={() => item.id !== undefined && aabn(item.id)}
                style={{ cursor: 'pointer' }}
              >
                <td style={{ ...celle, fontWeight: 500 }}>{item.navn}</td>
                <td style={{ ...celle, color: 'var(--tekst-dæmpet)' }}>
                  {(grupperFor.get(item.uid) ?? []).join(', ') || '—'}
                </td>
                <td style={celle}>{item.vaegt_g} g</td>
                <td style={celle}>{item.delt ? 'delt' : `${item.pris_kr.toLocaleString('da-DK')} kr`}</td>
                <td style={{ ...celle, color: brugt ? 'var(--tekst)' : 'var(--tekst-svag)', fontStyle: brugt ? 'normal' : 'italic' }}>
                  {brugt ? formatterDato(brugt) : 'aldrig'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function formatterDato(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });
}

// De første par navne, og resten som en tæller. Linjen ramsede før dem alle
// op, og med tyve sæt blev rækken en mur af tekst der brød om på fem linjer.
function saetnavne(saet: { navn: string }[]): string {
  const VISES = 3;
  const foerste = saet.slice(0, VISES).map((g) => g.navn || 'Uden navn');
  const resten = saet.length - foerste.length;

  return resten > 0 ? `${foerste.join(', ')} + ${resten} mere` : foerste.join(', ');
}

export default InventarSide;
