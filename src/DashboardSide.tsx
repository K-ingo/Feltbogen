import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import type { Item, Gruppe, Tur } from './db';
import { naesteTur, naarBegynder, handlinger, tureIAar, sidstTilfoejede } from './dashboard';
import type { Handling } from './dashboard';
import { itemsPaaTur, findAdvarsler } from './smartMotor';
import { samletInventarvaerdi, samletVaegt } from './statistik';
import { Skal } from './Skal';
import type { Fane } from './Skal';
import { useErDesktop } from './useMedie';
import { Knap, Chip, Infokort, SektionsTitel, ListeRaekke, TomListe } from './ui';

interface Props {
  fane: Fane;
  skift: (f: Fane) => void;
  aabnItem: (id: number, nyOprettet?: boolean) => void;
  aabnTur: (id: number, nyOprettet?: boolean) => void;
  nytItem: () => void;
  nyTur: () => void;
}

// Så mange handlinger vises ad gangen. Resten tælles op — en liste på tredive
// er ikke en startskærm, den er en opgaveliste man lukker.
const MAKS_HANDLINGER = 4;
const MAKS_SIDST_TILFOEJET = 5;

// Fast rækkefølge: Næste tur → Handlinger → Nøgletal → Sidst tilføjet.
function DashboardSide({ fane, skift, aabnItem, aabnTur, nytItem, nyTur }: Props) {
  const erDesktop = useErDesktop();

  const items = useLiveQuery(() => db.items.toArray()) ?? [];
  const grupper = useLiveQuery(() => db.grupper.toArray()) ?? [];
  const ture = useLiveQuery(() => db.ture.toArray()) ?? [];

  const tur = naesteTur(ture);
  const alleHandlinger = handlinger(items, ture, grupper);
  const aar = tureIAar(ture);
  const nyeste = sidstTilfoejede(items, MAKS_SIDST_TILFOEJET);

  const aabnHandling = (h: Handling) => {
    const item = items.find((i) => i.uid === h.itemUid);
    if (item?.id !== undefined) aabnItem(item.id);
  };

  return (
    <Skal
      fane={fane}
      skift={skift}
      titel={hilsen()}
      handlinger={
        <>
          <Knap onClick={nytItem}>+ Nyt item</Knap>
          <Knap variant="primaer" onClick={nyTur}>+ Ny tur</Knap>
        </>
      }
      fab={nytItem}
    >
      <div style={{ display: 'grid', gap: '22px' }}>
        <NaesteTurKort
          tur={tur}
          items={items}
          grupper={grupper}
          aabn={() => tur?.id !== undefined && aabnTur(tur.id)}
          opret={nyTur}
        />

        {alleHandlinger.length > 0 && (
          <section>
            <SektionsTitel>Handlinger</SektionsTitel>
            <div style={{
              display: 'grid',
              gridTemplateColumns: erDesktop ? 'repeat(auto-fit, minmax(230px, 1fr))' : '1fr',
              gap: '8px'
            }}>
              {alleHandlinger.slice(0, MAKS_HANDLINGER).map((h) => (
                <HandlingsKort key={`${h.type}-${h.itemUid}`} handling={h} aabn={() => aabnHandling(h)} />
              ))}
            </div>
            {alleHandlinger.length > MAKS_HANDLINGER && (
              <div style={{ fontSize: '11px', color: 'var(--tekst-svag)', marginTop: '8px' }}>
                + {alleHandlinger.length - MAKS_HANDLINGER} mere
              </div>
            )}
          </section>
        )}

        <section>
          <SektionsTitel>Nøgletal</SektionsTitel>
          <div style={{
            display: 'grid',
            gridTemplateColumns: erDesktop ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)',
            gap: '8px'
          }}>
            <Noegletal label="Værdi" vaerdi={`${kroner(samletInventarvaerdi(items))} kr`} />
            <Noegletal
              label="Ture i år"
              vaerdi={`${aar.iAar}`}
              tillaeg={aar.aendringPct === null ? undefined : `${aar.aendringPct > 0 ? '+' : ''}${aar.aendringPct}%`}
            />
            <Noegletal label="Vægt" vaerdi={`${(samletVaegt(items) / 1000).toFixed(1)} kg`} />
          </div>
        </section>

        <section>
          <SektionsTitel>Sidst tilføjet</SektionsTitel>
          {nyeste.length === 0 ? (
            <TomListe>Intet gear endnu. Tilføj dit første.</TomListe>
          ) : (
            nyeste.map((item) => (
              <ListeRaekke
                key={item.uid}
                onClick={() => item.id !== undefined && aabnItem(item.id)}
                titel={item.navn || 'Uden navn'}
                detalje={`${item.vaegt_g} g${item.pris_kr > 0 ? ` · ${kroner(item.pris_kr)} kr` : ''}`}
              />
            ))
          )}
        </section>
      </div>
    </Skal>
  );
}

// ─────────────────────────────────────────────
// Sektioner
// ─────────────────────────────────────────────

function NaesteTurKort({ tur, items, grupper, aabn, opret }: {
  tur: Tur | null;
  items: Item[];
  grupper: Gruppe[];
  aabn: () => void;
  opret: () => void;
}) {
  if (!tur) {
    return (
      <Infokort label="Næste tur">
        <div style={{ fontSize: '13px', color: 'var(--tekst-dæmpet)', marginBottom: '12px' }}>
          Ingen ture planlagt.
        </div>
        <Knap variant="primaer" onClick={opret}>+ Planlæg en tur</Knap>
      </Infokort>
    );
  }

  const paaTuren = itemsPaaTur(tur, grupper, items);
  const vaegtDelt = paaTuren.filter((i) => i.delt).reduce((s, i) => s + i.vaegt_g, 0);
  const vaegtPersonligt = paaTuren.filter((i) => !i.delt).reduce((s, i) => s + i.vaegt_g, 0);
  const prPerson = tur.personer > 0
    ? vaegtPersonligt + vaegtDelt / tur.personer
    : vaegtPersonligt + vaegtDelt;

  const advarsler = findAdvarsler(paaTuren);

  return (
    <Infokort label={`Næste tur · ${naarBegynder(tur)}`} fremhaevet>
      <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: '20px', marginBottom: '3px' }}>
        {tur.navn || 'Uden navn'}
      </div>
      <div style={{ fontSize: '12px', color: 'var(--tekst-dæmpet)', marginBottom: '10px' }}>
        {[
          `${tur.naetter} ${tur.naetter === 1 ? 'nat' : 'nætter'}`,
          `${tur.personer} ${tur.personer === 1 ? 'person' : 'personer'}`,
          `${(prPerson / 1000).toFixed(2)} kg`
        ].join(' · ')}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        {advarsler.length > 0 && (
          <Chip farve={advarsler.some((a) => a.niveau === 'roed') ? 'fejl' : 'advarsel'} storrelse="lille">
            ⚠ {advarsler.length} {advarsler.length === 1 ? 'advarsel' : 'advarsler'}
          </Chip>
        )}
        <div style={{ marginLeft: 'auto' }}>
          <Knap onClick={aabn}>Åbn tur</Knap>
        </div>
      </div>
    </Infokort>
  );
}

function HandlingsKort({ handling, aabn }: { handling: Handling; aabn: () => void }) {
  // Garantien har en frist; de to andre kan vente. Farven siger hvad der haster.
  const haster = handling.type === 'garanti';

  return (
    <button
      onClick={aabn}
      style={{
        textAlign: 'left',
        padding: '11px 13px',
        borderRadius: '10px',
        cursor: 'pointer',
        border: `1px solid ${haster ? 'var(--advarsel-border)' : 'var(--border-svag)'}`,
        background: haster ? 'var(--advarsel-bg)' : 'var(--bg-forhoejet)'
      }}
    >
      <div style={{
        fontSize: '13px',
        fontWeight: 600,
        color: haster ? 'var(--advarsel)' : 'var(--tekst)'
      }}>
        {handling.titel}
      </div>
      <div style={{ fontSize: '12px', color: 'var(--tekst-dæmpet)', marginTop: '2px' }}>
        {handling.detalje}
      </div>
    </button>
  );
}

function Noegletal({ label, vaerdi, tillaeg }: { label: string; vaerdi: string; tillaeg?: string }) {
  return (
    <div style={{
      border: '1px solid var(--border-svag)',
      borderRadius: '10px',
      padding: '11px 13px',
      background: 'var(--bg-forhoejet)'
    }}>
      <div style={{
        fontSize: '10px',
        color: 'var(--tekst-dæmpet)',
        textTransform: 'uppercase',
        letterSpacing: '0.6px',
        fontWeight: 600,
        marginBottom: '3px'
      }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
        <span style={{ fontSize: '20px', fontFamily: "'Fraunces', Georgia, serif" }}>{vaerdi}</span>
        {tillaeg && <span style={{ fontSize: '11px', color: 'var(--tekst-svag)' }}>{tillaeg}</span>}
      </div>
    </div>
  );
}

// Ingen navn — vi har kun en e-mail, og et gæt derfra rammer forkert.
function hilsen(): string {
  const t = new Date().getHours();
  if (t < 10) return 'Godmorgen';
  if (t < 18) return 'Goddag';
  return 'Godaften';
}

// 21400 → "21.400", som tal skrives på dansk.
function kroner(beloeb: number): string {
  return Math.round(beloeb).toLocaleString('da-DK');
}

export default DashboardSide;
