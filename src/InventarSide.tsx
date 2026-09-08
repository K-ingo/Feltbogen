import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import type { Item, ItemStatus, Tur, Gruppe } from './db';
import { opretTomtItem } from './opret';
import { sidstBrugtPrItem, grupperPrItem, turePrItem } from './statistik';
import { Skal } from './Skal';
import type { Fane } from './Skal';
import { useErDesktop } from './useMedie';
import { Knap, TagChips, ListeRaekke, TomListe } from './ui';
import { udlaanteItems, laanteItems } from './udlaan';
import { forfaldne } from './vedligehold';
import { gram } from './talformat';

interface Props {
  fane: Fane;
  skift: (f: Fane) => void;
  aabnItem: (id: number, nyOprettet?: boolean) => void;
}

// Fanerne over listen.
//
// Ejer, Indkøb og Solgt er tre forskellige lister i hovedet på brugeren, så de
// er faner frem for et filter. Solgt får sin egen, så det gear ikke bliver
// usynligt, når man har markeret det.
//
// Lån og Vedligehold er de to sidste, og de er ikke statusser: de er tværgående
// udsnit af det man ejer. Specens §2.3 og §16 vil have dem under Grej, og de
// fandtes kun som felter på det enkelte item og som kort på startskærmen — man
// kunne altså ikke svare på "hvad har jeg lånt ud?" uden at gå igennem hele
// inventaret.
//
// "Indkøb" og ikke "Overvejer": det er dét, listen er. Statussen på selve
// itemet hedder stadig overvejer, og teksten under fanen binder de to ord
// sammen.
type Udsnit = ItemStatus | 'laan' | 'vedligehold';

const FANEBLADE: { udsnit: Udsnit; label: string }[] = [
  { udsnit: 'ejer', label: 'Ejer' },
  { udsnit: 'overvejer', label: 'Indkøb' },
  { udsnit: 'solgt', label: 'Solgt' },
  { udsnit: 'laan', label: 'Lån' },
  { udsnit: 'vedligehold', label: 'Vedligehold' }
];

// Hvad udsnittet er, skrevet ud. Står under fanerne, så en liste aldrig er
// noget man skal gætte sig til hvad er.
const UDSNITSTEKST: Record<Udsnit, string> = {
  ejer: '',
  overvejer: 'Grej du overvejer at købe. De står som "overvejer" og tælles ikke med i din vægt.',
  solgt: 'Grej du ikke har længere. Det bliver stående, så turhistorikken ikke mister det.',
  laan: 'Grej der er ude af huset, og grej du har lånt af andre.',
  vedligehold: 'Grej med noget der forfalder inden længe, eller som skulle have været gjort.'
};

// Udsnittet af inventaret. Statusserne filtrerer på status; de to andre går
// på tværs af dem — men kun på det man ejer, for man vedligeholder ikke noget,
// man har solgt.
function iUdsnit(items: Item[], udsnit: Udsnit): Item[] {
  if (udsnit === 'laan') {
    const ejet = items.filter((i) => i.status === 'ejer');
    return [...new Set([...udlaanteItems(ejet), ...laanteItems(items)])];
  }

  if (udsnit === 'vedligehold') {
    const uids = new Set(forfaldne(items).map((f) => f.item.uid));
    return items.filter((i) => uids.has(i.uid));
  }

  return items.filter((i) => i.status === udsnit);
}

const MAKS_TAG_CHIPS = 5;

function InventarSide({ fane, skift, aabnItem }: Props) {
  const erDesktop = useErDesktop();

  const [valgtStatus, setValgtStatus] = useState<Udsnit>('ejer');
  const [soegning, setSoegning] = useState('');
  const [valgtTag, setValgtTag] = useState<string | null>(null);
  const [alleTagsVist, setAlleTagsVist] = useState(false);
  const [mobileFiltreAabne, setMobileFiltreAabne] = useState(false);

  const items = useLiveQuery(() => db.items.toArray()) ?? [];
  const grupper = useLiveQuery(() => db.grupper.toArray()) ?? [];
  const ture = useLiveQuery(() => db.ture.toArray()) ?? [];

  const iStatus = iUdsnit(items, valgtStatus);

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

  const antal = (udsnit: Udsnit) => iUdsnit(items, udsnit).length;
  const vaerdiIStatus = iStatus.reduce((sum, i) => sum + i.pris_kr * i.antal, 0);

  const grejsaet = useLiveQuery(() => db.grupper.toArray()) ?? [];

  const nulstilFiltre = () => {
    setSoegning('');
    setValgtTag(null);
    setAlleTagsVist(false);
  };

  // Den nye post lander i den fane man står på, så den ikke forsvinder ud af
  // syne i det øjeblik den bliver oprettet. Lån og Vedligehold er ikke
  // statusser, man kan oprette noget i — der bliver det til noget man ejer.
  const nytItem = async () => aabnItem(
    await opretTomtItem(valgtStatus === 'laan' || valgtStatus === 'vedligehold' ? 'ejer' : valgtStatus),
    true
  );

  return (
    <Skal
      fane={fane}
      skift={skift}
      titel="Grej"
      undertitel={`${iStatus.length} stykker grej · ${vaerdiIStatus.toLocaleString('da-DK')} kr`}
      handlinger={<Knap variant="primaer" onClick={nytItem}>+ Tilføj grej</Knap>}
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

      <div className="gear-status-tabs" style={{ display: 'flex', gap: '6px', margin: 'var(--plads-4) 0 var(--plads-3)', flexWrap: 'wrap' }}>
        {FANEBLADE.map(({ udsnit, label }) => (
          <button
            key={udsnit}
            aria-pressed={valgtStatus === udsnit}
            onClick={() => { setValgtStatus(udsnit); nulstilFiltre(); }}
            style={{
              padding: '6px 14px',
              fontSize: 'var(--skrift-detalje)',
              borderRadius: '16px',
              cursor: 'pointer',
              fontWeight: 500,
              background: valgtStatus === udsnit ? 'var(--accent)' : 'transparent',
              color: valgtStatus === udsnit ? 'var(--accent-tekst)' : 'var(--tekst-dæmpet)',
              border: `1px solid ${valgtStatus === udsnit ? 'var(--accent)' : 'var(--border)'}`
            }}
          >
            {label} ({antal(udsnit)})
          </button>
        ))}
      </div>

      <input
        type="search"
        aria-label="Søg grej eller tags"
        placeholder="Søg grej eller tags…"
        value={soegning}
        onChange={(e) => setSoegning(e.target.value)}
        style={{ width: '100%', marginBottom: '12px' }}
      />

      {!erDesktop && tags.length > 0 && (
        <div className="gear-filter-toggle">
          <Knap
            onClick={() => setMobileFiltreAabne(!mobileFiltreAabne)}
            ariaExpanded={mobileFiltreAabne}
          >
            {mobileFiltreAabne ? 'Skjul filtre' : `Filtre${valgtTag ? ' (1)' : ''}`}
          </Knap>
        </div>
      )}

      {tags.length > 0 && (erDesktop || mobileFiltreAabne) && (
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

      {UDSNITSTEKST[valgtStatus] !== '' && (
        <div style={{
          fontSize: 'var(--skrift-detalje)',
          color: 'var(--tekst-dæmpet)',
          marginBottom: 'var(--plads-3)',
          maxWidth: '68ch'
        }}>
          {UDSNITSTEKST[valgtStatus]}
        </div>
      )}

      {filtreret.length === 0 ? (
        <TomListe
          handling={iStatus.length > 0 ? 'Ryd filtre' : valgtStatus === 'ejer' || valgtStatus === 'overvejer' ? 'Tilføj grej' : 'Se dit grej'}
          onClick={iStatus.length > 0 ? nulstilFiltre : valgtStatus === 'ejer' || valgtStatus === 'overvejer' ? nytItem : () => { setValgtStatus('ejer'); nulstilFiltre(); }}
        >
          {iStatus.length === 0
            ? ({ ejer: 'Dit næste eventyr begynder med det grej, du allerede har. Tilføj den første ting.', overvejer: 'Plads til det grej, du drømmer om at tage med.', solgt: 'Intet solgt grej endnu. Din turhistorik bliver bevaret, når noget får en ny ejer.', laan: 'Ingen aktive lån. Dit grej er klar til næste tur.', vedligehold: 'Ingen vedligeholdelse på listen lige nu. Klar til mere tid ude.' })[valgtStatus]
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
        <Mobilliste items={filtreret} ture={ture} grupper={grupper} aabn={aabnItem} />
      )}
    </Skal>
  );
}

// Grejlisten på telefonen.
//
// Tabellen på PC har haft en kolonne der hedder "Sidst brugt" hele tiden, men
// på telefonen stod der kun vægt og pris — altså hvad tingen er værd og hvad
// den koster at bære, og ingenting om hvad man har brugt den til. Det er den
// samme historie som findes inde på gearet selv (`turePrItem`), sagt kort nok
// til at stå i en liste.
//
// Har gearet aldrig været med på en tur, står der ingenting. "Aldrig brugt" er
// en dom over noget, man måske lige har købt — og de ubrugte ting har deres
// eget udsnit under Statistik, hvor det er sagt med vilje.
function Mobilliste({ items, ture, grupper, aabn }: {
  items: Item[];
  ture: Tur[];
  grupper: Gruppe[];
  aabn: (id: number) => void;
}) {
  const brugt = turePrItem(ture, grupper);

  return (
    <div>
      {items.map((item) => (
        <ListeRaekke
          key={item.uid}
          titel={item.navn}
          detalje={
            <>
              <div>
                {gram(item.vaegt_g)} g · {item.delt ? 'delt' : `${item.pris_kr.toLocaleString('da-DK')} kr`}
                {item.antal > 1 && ` · ${item.antal} stk`}
              </div>
              <Brugslinje ture={brugt.get(item.uid) ?? []} />
            </>
          }
          onClick={() => item.id !== undefined && aabn(item.id)}
        >
          <TagChips tags={item.tags} />
        </ListeRaekke>
      ))}
    </div>
  );
}

// "Brugt på 14 ture · sidst Øhavsstien".
//
// Turens navn og ikke dens dato: man husker turen, ikke den fjerde weekend i
// juni. Har turen intet navn, falder linjen tilbage på antallet alene — "sidst
// Uden navn" siger mindre end ingenting.
function Brugslinje({ ture }: { ture: Tur[] }) {
  if (ture.length === 0) return null;

  const sidste = ture[0]?.navn.trim() ?? '';
  const antal = `Brugt på ${ture.length} ${ture.length === 1 ? 'tur' : 'ture'}`;

  return (
    <div style={{ color: 'var(--tekst-svag)', marginTop: '1px' }}>
      {sidste ? `${antal} · sidst ${sidste}` : antal}
    </div>
  );
}

function FilterChip({ aktiv, vaelg, children }: { aktiv: boolean; vaelg: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={vaelg}
      aria-pressed={aktiv}
      style={{
        padding: '4px 12px',
        fontSize: 'var(--skrift-lille)',
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
    fontSize: 'var(--skrift-knap)',
    textAlign: 'left'
  };

  const overskrift = (kolonne: Kolonne, label: string, bredde?: string) => (
    <th
      scope="col"
      aria-sort={sorterEfter === kolonne ? (faldende ? 'descending' : 'ascending') : 'none'}
      style={{
        ...celle,
        width: bredde,
        cursor: 'pointer',
        fontSize: 'var(--skrift-lille)',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        color: sorterEfter === kolonne ? 'var(--accent)' : 'var(--tekst-dæmpet)',
        whiteSpace: 'nowrap'
      }}
    >
      <button onClick={() => skiftSortering(kolonne)} style={{ color: 'inherit', font: 'inherit', padding: 0 }}>{label}{sorterEfter === kolonne && (faldende ? ' ↓' : ' ↑')}</button>
    </th>
  );

  return (
    <div style={{ overflowX: 'auto', border: '1px solid var(--border-svag)', borderRadius: '12px' }}>
      <table className="gear-table" style={{ width: '100%', borderCollapse: 'collapse', minWidth: '620px' }}>
        <thead style={{ background: 'var(--bg-forhoejet)' }}>
          <tr>
            {overskrift('navn', 'Navn')}
            <th style={{ ...celle, fontSize: 'var(--skrift-lille)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--tekst-dæmpet)' }}>
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
                <td style={{ ...celle, fontWeight: 500 }}><button className="gear-name" onClick={(e) => { e.stopPropagation(); if (item.id !== undefined) aabn(item.id); }}>{item.navn}</button></td>
                <td style={{ ...celle, color: 'var(--tekst-dæmpet)' }}>
                  {(grupperFor.get(item.uid) ?? []).join(', ') || '—'}
                </td>
                <td style={celle}>{gram(item.vaegt_g)} g</td>
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
