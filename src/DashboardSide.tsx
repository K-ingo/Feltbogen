import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import type { Item, Gruppe, Tur } from './db';
import {
  naesteTur,
  naarBegynder,
  handlinger,
  turforslag,
  syncstatus,
  tureIAar,
  sidstTilfoejede
} from './dashboard';
import { aarsopgoerelseAtSe } from './aarsopgoerelse';
import type { Handling, Turforslag, Syncstatus } from './dashboard';
import { itemsPaaTur, findAdvarsler } from './smartMotor';
import { samletInventarvaerdi, samletVaegt } from './statistik';
import { fremdriftstekst } from './afgangsTjek';
import { usendtAntal } from './sync';
import { useAuth } from './useAuth';
import { Skal } from './Skal';
import type { Fane } from './Skal';
import { useErDesktop, useErOnline } from './useMedie';
import { Knap, Chip, Infokort, SektionsTitel, ListeRaekke, TomListe, Hvorfor } from './ui';

interface Props {
  fane: Fane;
  skift: (f: Fane) => void;
  aabnItem: (id: number, nyOprettet?: boolean) => void;
  aabnTur: (id: number, nyOprettet?: boolean) => void;
  aabnAar: (aar: number) => void;
  nytItem: () => void;
  nyTur: () => void;
}

// Så mange handlinger vises ad gangen. Resten tælles op — en liste på tredive
// er ikke en startskærm, den er en opgaveliste man lukker.
const MAKS_HANDLINGER = 4;
const MAKS_SIDST_TILFOEJET = 5;

// Fast rækkefølge, og den er specens: næste tur, hvad der kræver
// opmærksomhed, hvad Feltbogen foreslår, hvordan man står — og til sidst om
// det er nået op på serveren.
//
// De fire første spørgsmål skal kunne besvares på under fem sekunder. Derfor
// er der loft over både handlinger og forslag: en startskærm der ruller, er
// en opgaveliste, og en opgaveliste lukker man.
function DashboardSide({ fane, skift, aabnItem, aabnTur, aabnAar, nytItem, nyTur }: Props) {
  const erDesktop = useErDesktop();

  const { erLoggetInd } = useAuth();
  const online = useErOnline();

  const items = useLiveQuery(() => db.items.toArray()) ?? [];
  const grupper = useLiveQuery(() => db.grupper.toArray()) ?? [];
  const ture = useLiveQuery(() => db.ture.toArray()) ?? [];
  // Tælles om når basen ændrer sig, så tallet ikke står og lyver efter en sync.
  const usendt = useLiveQuery(usendtAntal, [], 0);

  const tur = naesteTur(ture);
  const alleHandlinger = handlinger(items, ture, grupper);
  const forslag = turforslag(tur, grupper, items, ture);
  const sync = syncstatus(usendt, online, erLoggetInd);
  const aar = tureIAar(ture);
  const nyeste = sidstTilfoejede(items, MAKS_SIDST_TILFOEJET);
  const opgoerelse = aarsopgoerelseAtSe(ture);

  // Kortet fører hen til den post det handler om — gear eller tur. Findes den
  // ikke længere, sker der ingenting; listen bygges om ved næste render.
  const aabnHandling = (h: Handling) => {
    if (h.maal.slags === 'tur') {
      const tur = ture.find((t) => t.uid === h.maal.uid);
      if (tur?.id !== undefined) aabnTur(tur.id);
      return;
    }

    const item = items.find((i) => i.uid === h.maal.uid);
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

        {opgoerelse !== null && (
          <Aarskort aar={opgoerelse} aabn={() => aabnAar(opgoerelse)} />
        )}

        {alleHandlinger.length > 0 && (
          <section>
            <SektionsTitel>Handlinger</SektionsTitel>
            <div style={{
              display: 'grid',
              gridTemplateColumns: erDesktop ? 'repeat(auto-fit, minmax(230px, 1fr))' : '1fr',
              gap: '8px'
            }}>
              {alleHandlinger.slice(0, MAKS_HANDLINGER).map((h) => (
                <HandlingsKort
                  key={`${h.type}-${h.maal.slags}-${h.maal.uid}`}
                  handling={h}
                  aabn={() => aabnHandling(h)}
                />
              ))}
            </div>
            {alleHandlinger.length > MAKS_HANDLINGER && (
              <div style={{ fontSize: '11px', color: 'var(--tekst-svag)', marginTop: '8px' }}>
                + {alleHandlinger.length - MAKS_HANDLINGER} mere
              </div>
            )}
          </section>
        )}

        {forslag.length > 0 && (
          <section>
            <SektionsTitel>Feltbogen foreslår</SektionsTitel>
            <div style={{
              display: 'grid',
              gridTemplateColumns: erDesktop ? 'repeat(auto-fit, minmax(230px, 1fr))' : '1fr',
              gap: 'var(--plads-2)'
            }}>
              {forslag.map((f) => (
                <ForslagsKort
                  key={f.type}
                  forslag={f}
                  aabn={() => tur?.id !== undefined && aabnTur(tur.id)}
                />
              ))}
            </div>
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

        <Synclinje status={sync} />
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

  // Specen vil have en pakkeprogression her — 36 af 42 pakket. Den findes
  // ikke: der er ingen pakket-tilstand pr. item i datamodellen, kun hvilket
  // grej der er valgt til turen. Et tal der lader som om, er værre end intet
  // tal, så her står det appen faktisk ved: hvor meget grej der er valgt, og
  // hvor langt afgangs-tjekket er — det er en rigtig liste med rigtige kryds.
  const afgang = tur.afgangs_tjek;

  return (
    <Infokort label={`Næste tur · ${naarBegynder(tur)}`} fremhaevet>
      <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: '20px', marginBottom: '3px' }}>
        {tur.navn || 'Uden navn'}
      </div>
      <div style={{ fontSize: 'var(--skrift-detalje)', color: 'var(--tekst-dæmpet)', marginBottom: 'var(--plads-2)' }}>
        {[
          `${tur.naetter} ${tur.naetter === 1 ? 'nat' : 'nætter'}`,
          `${tur.personer} ${tur.personer === 1 ? 'person' : 'personer'}`,
          `${(prPerson / 1000).toFixed(2)} kg`
        ].join(' · ')}
      </div>

      <div style={{
        fontSize: 'var(--skrift-detalje)',
        color: 'var(--tekst-dæmpet)',
        marginBottom: 'var(--plads-3)',
        display: 'grid',
        gap: '2px'
      }}>
        <span>
          {paaTuren.length === 0
            ? 'Intet grej valgt endnu'
            : `${paaTuren.length} ${paaTuren.length === 1 ? 'ting' : 'ting'} valgt`}
        </span>
        {afgang && <span>Afgangs-tjek: {fremdriftstekst(afgang).toLowerCase()}</span>}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--plads-2)', flexWrap: 'wrap' }}>
        {advarsler.length > 0 && (
          <Chip farve={advarsler.some((a) => a.niveau === 'roed') ? 'fejl' : 'advarsel'} storrelse="lille">
            ⚠ {advarsler.length} {advarsler.length === 1 ? 'advarsel' : 'advarsler'}
          </Chip>
        )}
        <div style={{ marginLeft: 'auto' }}>
          {/* Knappen siger, hvad man skal, og ikke bare hvor man kommer hen.
              Er der ikke valgt grej endnu, er det dét, turen mangler. */}
          <Knap variant="primaer" onClick={aabn}>
            {paaTuren.length === 0 ? 'Vælg grej' : 'Åbn tur'}
          </Knap>
        </div>
      </div>
    </Infokort>
  );
}

// Et forslag ser med vilje anderledes ud end en handling: handlingen er noget
// der er gået skævt, forslaget er noget appen ville gøre, hvis den måtte.
// Derfor accentfarven og ikke advarselsfarven.
//
// Kortet skriver ingenting. Det fører hen til turen, hvor man selv siger ja —
// et forslag der ændrer data, når man trykker på det, er ikke et forslag.
function ForslagsKort({ forslag, aabn }: { forslag: Turforslag; aabn: () => void }) {
  return (
    <div style={{
      padding: '11px 13px',
      borderRadius: 'var(--runding-lille)',
      border: '1px solid var(--accent-border)',
      background: 'var(--accent-bg)'
    }}>
      <button
        onClick={aabn}
        style={{
          display: 'block',
          width: '100%',
          textAlign: 'left',
          padding: 0,
          border: 'none',
          background: 'transparent',
          cursor: 'pointer'
        }}
      >
        <div style={{ fontSize: 'var(--skrift-knap)', fontWeight: 600, color: 'var(--accent)' }}>
          {forslag.titel}
        </div>
        <div style={{ fontSize: 'var(--skrift-detalje)', color: 'var(--tekst-dæmpet)', marginTop: '2px' }}>
          {forslag.detalje}
        </div>
      </button>
      <div style={{ marginTop: 'var(--plads-1)' }}>
        <Hvorfor begrundelse={forslag.begrundelse} />
      </div>
    </div>
  );
}

// Sync-status. Fundamentet siger, den skal være synlig uden at være
// dominerende, og derfor er den en linje nederst og ikke et kort øverst.
//
// Kun en rigtig fejl får en farve. At have ændringer liggende uden dækning er
// den normale tilstand for en app, man bruger i skoven — den skal ikke stå og
// blinke rødt, fordi man er kommet ud, hvor der ikke er signal.
function Synclinje({ status }: { status: Syncstatus }) {
  const prik = {
    synkroniseret: 'var(--succes)',
    venter: 'var(--accent)',
    offline: 'var(--tekst-svag)',
    kun_lokalt: 'var(--tekst-svag)'
  }[status.tilstand];

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--plads-2)',
      paddingTop: 'var(--plads-3)',
      borderTop: '1px solid var(--border-svag)',
      fontSize: 'var(--skrift-lille)',
      color: 'var(--tekst-svag)'
    }}>
      <span style={{
        width: '7px',
        height: '7px',
        borderRadius: 'var(--runding-pille)',
        background: prik,
        flexShrink: 0
      }} />
      {status.tekst}
    </div>
  );
}

function HandlingsKort({ handling, aabn }: { handling: Handling; aabn: () => void }) {
  // Hvad der haster afgøres af reglen der fandt handlingen, ikke af kortet —
  // en frist er ikke det samme for en garanti som for en tur.
  const haster = handling.haster;

  // Kortet er én stor knap, så "hvorfor?" kan ikke ligge inden i det — en
  // knap i en knap er ikke gyldigt, og et klik ville ramme begge dele.
  return (
    <div style={{
      padding: '11px 13px',
      borderRadius: '10px',
      border: `1px solid ${haster ? 'var(--advarsel-border)' : 'var(--border-svag)'}`,
      background: haster ? 'var(--advarsel-bg)' : 'var(--bg-forhoejet)'
    }}>
      <button
        onClick={aabn}
        style={{
          display: 'block',
          width: '100%',
          textAlign: 'left',
          padding: 0,
          border: 'none',
          background: 'transparent',
          cursor: 'pointer'
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
      <div style={{ marginTop: '4px' }}>
        <Hvorfor begrundelse={handling.begrundelse} />
      </div>
    </div>
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

// Tilbageblikket i januar. Det er ikke en handling og hører derfor ikke til
// blandt dem — det er en invitation til at kigge tilbage, og den skal se ud
// som noget andet end en huskeseddel.
function Aarskort({ aar, aabn }: { aar: number; aabn: () => void }) {
  return (
    <button
      onClick={aabn}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        width: '100%',
        padding: '16px',
        borderRadius: '12px',
        background: 'var(--accent-bg)',
        border: '1px solid var(--accent-border)',
        cursor: 'pointer',
        textAlign: 'left',
        color: 'var(--tekst)'
      }}
    >
      <span>
        <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: '18px' }}>
          Sådan gik {aar}
        </span>
        <span style={{ display: 'block', fontSize: '12px', color: 'var(--tekst-dæmpet)', marginTop: '2px' }}>
          Årsopgørelsen er klar
        </span>
      </span>
      <span style={{ color: 'var(--accent)', fontSize: '18px' }}>›</span>
    </button>
  );
}

export default DashboardSide;
