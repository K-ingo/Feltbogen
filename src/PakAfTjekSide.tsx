import { etiket, PAK_AF_STATUS, PAK_AF_NIVEAU, KATEGORI_VURDERING } from './db';
import type { Gruppe, Item, KategoriVurdering, PakAfNiveau, PakAfStatus, PakAfTjek, Tur } from './db';
import {
  kategoriNoteFor,
  kategorierPaaTur,
  noterFor,
  opsummering,
  resumetekst,
  saetKategoriNote,
  saetLinjenoter,
  saetNiveau,
  saetStatus,
  statusFor
} from './pakAfTjek';
import { pakkelisteEfterGruppe } from './smartMotor';
import { useErDesktop } from './useMedie';
import { layout } from './layout';
import { formatterPeriode } from './datotekst';
import {
  DetaljeHeader,
  Infokort,
  Knap,
  Segment,
  SektionsTitel,
  Tekstomraade,
  TomListe
} from './ui';

interface Props {
  tur: Tur;
  // Tjekket er lavet inden man kommer herind, så skærmen aldrig kan komme til
  // at skrive et tomt tjek oven i et udfyldt.
  tjek: PakAfTjek;
  pakItems: Item[];
  grupper: Gruppe[];
  // null sletter opgørelsen igen. Turen deles med turskærmen, så begge steder
  // skriver gennem den samme opdater — ellers ville de to skærme kunne stå med
  // hver sin udgave af det samme tjek.
  gem: (tjek: PakAfTjek | null) => void;
  tilbage: () => void;
}

// Turens efterregnskab: hvad blev brugt, hvad lå urørt, hvad gik i stykker.
//
// Der er ingen gem-knap — hvert tryk skrives igennem med det samme, ligesom på
// de andre detaljeskærme. Man kan pakke af med én hånd og gå fra det midtvejs.
function PakAfTjekSide({ tur, tjek, pakItems, grupper, gem, tilbage }: Props) {
  const erDesktop = useErDesktop();

  const grundig = tjek.niveau === 'grundig';
  const tal = opsummering(tjek);
  const afsnit = pakkelisteEfterGruppe(tur, grupper, pakItems);

  // Turen står som ikke gjort op bagefter, og dashboardet begynder at spørge
  // til den igen — det er det rigtige: et tjek man har slettet er ikke et tjek
  // man har lavet.
  const slet = () => {
    if (!confirm('Slet pak-af-tjekket? Turen står så som ikke gjort op.')) return;
    gem(null);
    tilbage();
  };

  const liste = afsnit.map((a) => (
    <section key={a.titel} style={{ marginBottom: '18px' }}>
      <SektionsTitel>{a.titel}</SektionsTitel>
      <div style={{ display: 'grid', gap: '6px' }}>
        {a.items.map((item) => (
          <Itemraekke
            key={item.uid}
            item={item}
            status={statusFor(tjek, item.uid)}
            noter={noterFor(tjek, item.uid)}
            grundig={grundig}
            saetStatus={(s) => gem(saetStatus(tjek, item.uid, s))}
            saetNoter={(n) => gem(saetLinjenoter(tjek, item.uid, n))}
          />
        ))}
      </div>
    </section>
  ));

  // Kun på det grundige niveau. Vurderingen pr. kategori er den motoren senere
  // skal lære mængder af — en enkelt linje siger kun om ét item blev brugt.
  const kategorier = grundig && (
    <section>
      <SektionsTitel>Mængder pr. kategori</SektionsTitel>
      <div style={{ display: 'grid', gap: '8px' }}>
        {kategorierPaaTur(tur, grupper, pakItems).map((kategori) => {
          const note = kategoriNoteFor(tjek, kategori);
          return (
            <Kategorikort
              key={kategori}
              kategori={kategori}
              vurdering={note?.vurdering ?? 'tilstraekkeligt'}
              noter={note?.noter ?? ''}
              saet={(aendringer) => gem(saetKategoriNote(tjek, kategori, aendringer))}
            />
          );
        })}
      </div>
    </section>
  );

  const opsamling = (
    <Infokort label="Status" fremhaevet>
      <div style={{ fontSize: '15px', marginBottom: '10px' }}>{resumetekst(tjek)}</div>
      <div style={{ display: 'grid', gap: '8px' }}>
        <div>
          <div style={{ fontSize: '11px', color: 'var(--tekst-dæmpet)', marginBottom: '5px' }}>
            Niveau
          </div>
          <Segment
            vaerdier={PAK_AF_NIVEAU}
            valgt={tjek.niveau}
            vaelg={(n: PakAfNiveau) => gem(saetNiveau(tjek, n))}
            kompakt
          />
        </div>
        <div style={{ fontSize: '11px', color: 'var(--tekst-svag)', lineHeight: 1.5 }}>
          {grundig
            ? 'Grundigt: en note pr. item og en vurdering af mængden i hver kategori.'
            : 'Let: tre knapper pr. item. Alt står som brugt — ret kun det der ikke blev.'}
        </div>
        {tal.i_stykker > 0 && (
          <div style={{ fontSize: '12px', color: 'var(--advarsel)' }}>
            ⚠ {tal.i_stykker === 1 ? 'Én ting' : `${tal.i_stykker} ting`} gik i stykker — se på
            garantien.
          </div>
        )}
      </div>
    </Infokort>
  );

  const overskrift = (
    <div style={{ marginBottom: '18px' }}>
      <h1 style={{
        fontFamily: "'Fraunces', Georgia, serif",
        fontSize: erDesktop ? '26px' : '22px',
        margin: '0 0 3px'
      }}>
        Pak-af-tjek
      </h1>
      <div style={{ fontSize: '12px', color: 'var(--tekst-dæmpet)' }}>
        {[tur.navn || 'Uden navn', formatterPeriode(tur.startdato, tur.slutdato)]
          .filter(Boolean)
          .join(' · ')}
      </div>
    </div>
  );

  const tomt = pakItems.length === 0 && (
    <TomListe>Der var intet gear på turen at gøre op.</TomListe>
  );

  const header = (
    <DetaljeHeader tilbage={tilbage} sletLabel="Slet pak-af-tjek" slet={slet} />
  );

  const faerdig = (
    <Knap variant="primaer" onClick={tilbage} style={{ width: '100%', padding: '11px' }}>
      Færdig
    </Knap>
  );

  if (erDesktop) {
    return (
      <div>
        {header}
        {overskrift}
        {/* Listen er den man arbejder i, opsamlingen er den man skæver til. */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 2fr) minmax(260px, 1fr)',
          gap: '24px',
          alignItems: 'start'
        }}>
          <div>
            {tomt}
            {liste}
            {kategorier}
          </div>
          <div style={{ display: 'grid', gap: '10px' }}>
            {opsamling}
            {faerdig}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={layout.container}>
      {header}
      {overskrift}
      <div style={{ marginBottom: '18px' }}>{opsamling}</div>
      {tomt}
      {liste}
      {kategorier}
      <div style={{ marginTop: '18px' }}>{faerdig}</div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Byggeklodser
// ─────────────────────────────────────────────

// Statussen aflæses på kanten af rækken, så en liste på tredive kan skimmes
// uden at læse hver knaprække igennem.
const STATUSFARVE: Record<PakAfStatus, string> = {
  brugt: 'var(--accent)',
  ubrugt: 'var(--border)',
  i_stykker: 'var(--advarsel)'
};

function Itemraekke({ item, status, noter, grundig, saetStatus, saetNoter }: {
  item: Item;
  status: PakAfStatus;
  noter: string;
  grundig: boolean;
  saetStatus: (s: PakAfStatus) => void;
  saetNoter: (n: string) => void;
}) {
  return (
    <div style={{
      border: '1px solid var(--border-svag)',
      borderLeft: `3px solid ${STATUSFARVE[status]}`,
      borderRadius: '10px',
      padding: '10px 12px',
      background: 'var(--bg-forhoejet)'
    }}>
      <div style={{ fontSize: '13px', marginBottom: '8px' }}>
        {item.navn || 'Uden navn'}
        <span style={{ color: 'var(--tekst-svag)', fontSize: '11px', marginLeft: '8px' }}>
          {item.vaegt_g} g
        </span>
      </div>
      <Segment
        vaerdier={PAK_AF_STATUS}
        valgt={status}
        vaelg={saetStatus}
        formater={(v) => etiket(v)}
        kompakt
      />
      {grundig && (
        <div style={{ marginTop: '8px' }}>
          <Tekstomraade
            label="Note"
            value={noter}
            onChange={saetNoter}
            raekker={1}
            placeholder="fx dunjakken var for varm"
          />
        </div>
      )}
    </div>
  );
}

function Kategorikort({ kategori, vurdering, noter, saet }: {
  kategori: string;
  vurdering: KategoriVurdering;
  noter: string;
  saet: (aendringer: { vurdering?: KategoriVurdering; noter?: string }) => void;
}) {
  return (
    <div style={{
      border: '1px solid var(--border-svag)',
      borderRadius: '10px',
      padding: '10px 12px',
      background: 'var(--bg-forhoejet)',
      display: 'grid',
      gap: '8px'
    }}>
      <div style={{ fontSize: '13px' }}>{kategori}</div>
      <Segment
        vaerdier={KATEGORI_VURDERING}
        valgt={vurdering}
        vaelg={(v) => saet({ vurdering: v })}
        formater={(v) => etiket(v)}
        kompakt
      />
      <Tekstomraade
        label="Noter"
        value={noter}
        onChange={(v) => saet({ noter: v })}
        raekker={1}
        placeholder="fx to liter vand for lidt"
      />
    </div>
  );
}

export default PakAfTjekSide;
