import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import type { Item, Gruppe } from './db';
import {
  hjemsituation,
  udenDubletAfSituationen,
  handlinger,
  syncstatus,
  tureIAar,
  sidstTilfoejede
} from './dashboard';
import { aarsopgoerelseAtSe } from './aarsopgoerelse';
import type { Handling, Syncstatus, Hjemsituation } from './dashboard';
import { forslagTilTur, udenAfviste, maalFor } from './forslag';
import { afvisForslag, useAfviste } from './afviste';
import type { Forslag } from './forslag';
import type { Turmaal } from './turmaal';
import { kopierGrej } from './ligesomSidst';
import { opdaterTur } from './sync';
import { itemsPaaTur, findAdvarsler } from './smartMotor';
import { forfaldne } from './vedligehold';
import { samletInventarvaerdi, samletVaegt } from './statistik';
import { fremdriftstekst } from './afgangsTjek';
import { fremdrift as pakkefremdrift, fremdriftstekst as pakketekst } from './pakning';
import { usendtAntal } from './sync';
import { useAuth } from './useAuth';
import { Skal } from './Skal';
import type { Fane } from './Skal';
import { useErDesktop, useErOnline } from './useMedie';
import { Knap, Chip, Infokort, SektionsTitel, ListeRaekke, TomListe, Hvorfor, Forslagskort } from './ui';
import { useTekst } from './indstillinger';
import { useSyncfejl } from './syncfejl';
import { laesKladde, KLADDE_NOEGLE } from './foersteTur';

interface Props {
  fane: Fane;
  skift: (f: Fane) => void;
  aabnItem: (id: number, nyOprettet?: boolean) => void;
  aabnTur: (id: number, nyOprettet?: boolean, maal?: Turmaal) => void;
  aabnAar: (aar: number) => void;
  nytItem: () => void;
  nyTur: () => void;
  // Sync kan fejle, fordi sessionen er udløbet. Så skal linjen nederst kunne
  // føre hen til login — se syncfejl.ts og turmaal.ts.
  tilLogin: () => void;
  // Det guidede flow til den første tur. Se foersteTur.ts.
  foersteTur: () => void;
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
function DashboardSide({ fane, skift, aabnItem, aabnTur, aabnAar, nytItem, nyTur, foersteTur, tilLogin }: Props) {
  const erDesktop = useErDesktop();

  const { erLoggetInd } = useAuth();
  const online = useErOnline();

  const items = useLiveQuery(() => db.items.toArray()) ?? [];
  const grupper = useLiveQuery(() => db.grupper.toArray()) ?? [];
  const ture = useLiveQuery(() => db.ture.toArray()) ?? [];
  // Tælles om når basen ændrer sig, så tallet ikke står og lyver efter en sync.
  const usendt = useLiveQuery(usendtAntal, [], 0);

  // Hvad startskærmen handler om lige nu. Reglerne ligger i dashboard.ts, så
  // de kan afprøves uden en skærm.
  const situation = hjemsituation(ture);
  // En påbegyndt første tur ligger lokalt og ikke i basen. Den afgør kun, hvad
  // knappen på det tomme kort hedder — se foersteTur.ts.
  const kladde = laesKladde(useTekst(KLADDE_NOEGLE));
  const tur = situation.tur;
  // Turkortet øverst ejer sin tur, så den ikke bliver sagt to gange.
  const alleHandlinger = udenDubletAfSituationen(handlinger(items, ture, grupper), situation);
  // Afvisningen lever på enheden og ikke i skærmen. Den hænger på turen, så
  // et nej her også gælder inde på turen — det er det samme forslag, og det
  // var ikke stedet, man svarede på. Se afviste.ts.
  //
  // Tom liste indtil afvisningerne er læst: et kort, man har vinket af, må
  // ikke nå at blinke forbi på vej ind på startskærmen.
  const afviste = useAfviste(tur?.uid);
  const forslag = afviste ? udenAfviste(forslagTilTur(tur, grupper, items, ture), afviste) : [];
  const syncfejl = useSyncfejl();
  const sync = syncstatus(usendt, online, erLoggetInd, syncfejl);
  const aar = tureIAar(ture);
  const nyeste = sidstTilfoejede(items, MAKS_SIDST_TILFOEJET);
  const opgoerelse = aarsopgoerelseAtSe(ture);

  const ejet = items.filter((i) => i.status === 'ejer');
  // Tælles i ting og ikke i handlinger: en tarp der både skal imprægneres og
  // have lynlåsen smurt, er stadig én ting at tage sig af.
  const skalPasses = new Set(forfaldne(ejet).map((f) => f.item.uid)).size;

  // At tage imod et forslag.
  //
  // Kortet skrev før ingenting og førte kun hen til turen. Det var rigtigt,
  // dengang kortet i sig selv var knappen: et forslag der ændrer data, når man
  // trykker et sted på det, er ikke et forslag. Nu står handlingen som en
  // navngiven knap ved siden af "afvis", og så er det omvendt — en knap der
  // hedder "Tag sættet med" og bare åbner turen, lover noget den ikke gør.
  //
  // De to, der er ét entydigt skriv, skrives derfor her. Vægtforslaget gør
  // ikke: der skal vælges mellem alternativer med hver sin risiko, og det valg
  // hører hjemme på turen.
  const tagImod = async (f: Forslag) => {
    if (!tur || tur.id === undefined) return;

    if (f.type === 'grej') {
      await opdaterTur(tur.id, { gruppe_ids: [...tur.gruppe_ids, maalFor(f)] });
      return;
    }

    if (f.type === 'historik') {
      const gammel = ture.find((t) => t.uid === maalFor(f));
      if (gammel) await opdaterTur(tur.id, kopierGrej(gammel, tur));
      return;
    }

    // De to sidste skal vælges imellem — vægtbytterne har hver sin risiko, og
    // en fordeling flytter andres rygsække. Det valg hører hjemme på turen.
    // Men de skal lande *på* stedet og ikke på turens overblik: et forslag,
    // man selv skal lede efter bagefter, er ikke et forslag. Se turmaal.ts.
    aabnTur(tur.id, false, f.type === 'fordeling' ? 'fordeling' : 'vaegt');
  };

  // Kortet fører hen til den post det handler om — gear eller tur. Findes den
  // ikke længere, sker der ingenting; listen bygges om ved næste render.
  const aabnHandling = (h: Handling) => {
    if (h.maal.slags === 'tur') {
      // Ingen af tur-handlingerne har brug for et mål: både "Markér som klar"
      // og "Lav pak-af-tjek" står øverst på turskærmen, og manglerne under dem
      // er selv knapper videre.
      const fundet = ture.find((t) => t.uid === h.maal.uid);
      if (fundet?.id !== undefined) aabnTur(fundet.id);
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
        <Situationskort
          situation={situation}
          items={items}
          grupper={grupper}
          aabn={(maal) => situation.tur?.id !== undefined && aabnTur(situation.tur.id, false, maal)}
          opret={nyTur}
          foersteTur={foersteTur}
          harKladde={kladde !== null}
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
                <Forslagskort
                  key={f.id}
                  forslag={f}
                  aabn={() => tur?.id !== undefined && aabnTur(tur.id)}
                  tagImod={() => void tagImod(f)}
                  afvis={() => { if (tur) void afvisForslag(tur.uid, f); }}
                />
              ))}
            </div>
          </section>
        )}

        {/* Specens §3 vil have et gearSummary: hvor meget man har, og hvor
            meget der skal passes. Vedligeholdet står også som handlingskort
            ovenfor, men det er ikke det samme — dér er det de enkelte ting,
            her er det hvordan skabet står. */}
        <section>
          <SektionsTitel>Dit grej</SektionsTitel>
          <ListeRaekke
            titel={`${ejet.length} ${ejet.length === 1 ? 'ting' : 'ting'}`}
            detalje={
              // "Alt er passet" om et tomt skab er en påstand om noget, der
              // ikke findes. Har man ikke skrevet noget ind endnu, er dét det,
              // rækken skal sige.
              ejet.length === 0
                ? 'Skriv det ind, du har — så kan appen regne på det'
                : skalPasses === 0
                  ? 'Alt er passet'
                  : `${skalPasses} ${skalPasses === 1 ? 'ting skal passes' : 'ting skal passes'}`
            }
            onClick={() => skift('inventar')}
          />
        </section>

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

        <Synclinje status={sync} tilLogin={tilLogin} />
      </div>
    </Skal>
  );
}

// ─────────────────────────────────────────────
// Sektioner
// ─────────────────────────────────────────────

// Turkortet på startskærmen.
//
// Det viser ikke "næste tur" men *situationen*: hvad der er vigtigt nu. Der er
// forskel på en kladde tre uger ude, en tur der begynder i morgen, en man er
// midt i, og en man lige er kommet hjem fra uden at gøre den op — og knappen
// skal sige noget forskelligt i hvert af de fire tilfælde.
//
// Reglerne ligger i `hjemsituation`; her oversættes de kun til en skærm.
function Situationskort({ situation, items, grupper, aabn, opret, foersteTur, harKladde }: {
  situation: Hjemsituation;
  items: Item[];
  grupper: Gruppe[];
  aabn: (maal?: Turmaal) => void;
  opret: () => void;
  foersteTur: () => void;
  harKladde: boolean;
}) {
  const tur = situation.tur;

  // Uden en tur er der ikke noget at vise fremdrift på — der er kun ét at
  // gøre. Det guidede flow står forrest, fordi en tom turskærm med fjorten
  // felter er svær at begynde på; den tomme tur bliver stående ved siden af
  // for dem, der hellere vil skrive det ind selv.
  if (!tur) {
    return (
      <Infokort label={situation.overskrift}>
        <div style={{ fontSize: '13px', color: 'var(--tekst-dæmpet)', marginBottom: '12px' }}>
          {harKladde
            ? 'Du er begyndt på en tur. Den ligger her på enheden og venter.'
            : 'Ingen ture planlagt. Feltbogen kan spørge dig frem til den første — eller du kan skrive den ind selv.'}
        </div>
        <div style={{ display: 'flex', gap: 'var(--plads-2)', flexWrap: 'wrap' }}>
          <Knap variant="primaer" onClick={foersteTur}>
            {harKladde ? 'Fortsæt hvor du slap' : situation.handling}
          </Knap>
          <Knap onClick={opret}>+ Tom tur</Knap>
        </div>
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
  const pakning = pakkefremdrift(tur, paaTuren);
  const afgang = tur.afgangs_tjek;

  // En hjemkommen tur skal ikke stå og fortælle, hvor langt man er med
  // pakningen. Den er ovre; det eneste, der mangler, er regnskabet.
  const hjemme = situation.situation === 'gjort_op_mangler';

  return (
    <Infokort label={situation.overskrift} fremhaevet>
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
        {hjemme ? (
          <span>
            Ikke gjort op endnu. Hvad blev brugt, hvad lå urørt, og hvad gik i stykker —
            det er dét, motoren lærer af.
          </span>
        ) : (
          <>
            <span>{pakketekst(pakning)}</span>
            {afgang && <span>Afgangs-tjek: {fremdriftstekst(afgang).toLowerCase()}</span>}
          </>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--plads-2)', flexWrap: 'wrap' }}>
        {!hjemme && advarsler.length > 0 && (
          <Chip farve={advarsler.some((a) => a.niveau === 'roed') ? 'fejl' : 'advarsel'} storrelse="lille">
            ⚠ {advarsler.length} {advarsler.length === 1 ? 'advarsel' : 'advarsler'}
          </Chip>
        )}
        <div style={{ marginLeft: 'auto' }}>
          {/* Knappen siger, hvad man skal — og lander dér, hvor det kan gøres.
              Se turmaal.ts. */}
          <Knap variant="primaer" onClick={() => aabn(situation.maal)}>
            {situation.handling}
          </Knap>
        </div>
      </div>
    </Infokort>
  );
}

// Statuslinjen nederst på startskærmen.
//
// Den må ikke ligne en fejl, når den ikke er en: ændringer der ligger og
// venter uden dækning er den normale tilstand for en app, man bruger i skoven.
// Men når det *er* en fejl, skal den både ses og forklares — ellers står
// linjen og siger "på vej op" om noget, der aldrig kommer op. Se syncfejl.ts.
function Synclinje({ status, tilLogin }: { status: Syncstatus; tilLogin: () => void }) {
  const prik = {
    synkroniseret: 'var(--succes)',
    venter: 'var(--accent)',
    offline: 'var(--tekst-svag)',
    kun_lokalt: 'var(--tekst-svag)',
    fejl: 'var(--fejl)'
  }[status.tilstand];

  const erFejl = status.tilstand === 'fejl';

  return (
    <div style={{
      paddingTop: 'var(--plads-3)',
      borderTop: '1px solid var(--border-svag)',
      fontSize: 'var(--skrift-lille)',
      color: erFejl ? 'var(--tekst-dæmpet)' : 'var(--tekst-svag)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--plads-2)' }}>
        <span style={{
          width: '7px',
          height: '7px',
          borderRadius: 'var(--runding-pille)',
          background: prik,
          flexShrink: 0
        }} />
        {status.tekst}
      </div>

      {status.forklaring && (
        <div style={{ marginTop: '6px', marginLeft: '15px', lineHeight: 1.5 }}>
          {status.forklaring}
        </div>
      )}

      {/* Knappen står, hvor der er noget at gøre: uden konto, og når en
          session er udløbet. Resten retter sig af sig selv eller kræver, at
          nogen kigger på serveren — og en knap, der ikke hjælper, er værre
          end ingen knap. */}
      {status.kanLoggeInd && (
        <div style={{ marginTop: 'var(--plads-2)', marginLeft: '15px' }}>
          <Knap onClick={tilLogin}>
            {status.tilstand === 'kun_lokalt' ? 'Log ind for at synkronisere' : 'Log ind igen'}
          </Knap>
        </div>
      )}
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
