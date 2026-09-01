import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, AKTIVITET, OVERNATNING, etiket } from './db';
import type { Aktivitet, Gruppe, Item, Overnatning, Sted, Tur } from './db';
import { opretTur } from './sync';
import { layout } from './layout';
import { Knap, Chip, Talinput, Label, TitelInput, Forslagskort } from './ui';
import { formatterPeriode } from './datotekst';
import { foreslaaSteder, sorterEfterBesoeg } from './steder';
import { itemsPaaTur } from './smartMotor';
import { forslagTilTur, maalFor, udenAfviste } from './forslag';
import { afvisForslag, useAfviste } from './afviste';
import { meldFortrydelse } from './fortryd';
import { FortrydToast } from './FortrydToast';
import type { Forslag } from './forslag';
import { kopierGrej } from './ligesomSidst';
import {
  TOM_KLADDE,
  TRIN,
  TRINTEKST,
  naesteTrin,
  forrigeTrin,
  erBesvaret,
  erPaabegyndt,
  nokTilForslag,
  slutdatoFor,
  genveje,
  turFraKladde,
  hentKladde,
  gemKladde,
  rydKladde,
  KLADDE_UID
} from './foersteTur';
import type { Kladde, Trin } from './foersteTur';

interface Props {
  // Lukker flowet uden at oprette noget. Kladden bliver liggende — det er
  // hele pointen med den.
  fortryd: () => void;
  faerdig: (turId: number) => void;
}

// Skærmen til den første tur. Reglerne står i foersteTur.ts; her stilles de
// fire spørgsmål ét ad gangen.
//
// Ét spørgsmål pr. skærm, og alle fire kan springes over. Det er ikke en
// formular delt op i fem — forskellen er, at man kan gå videre uden at svare,
// og at sidste trin viser et forslag frem for en tom liste.
function FoersteTur({ fortryd, faerdig }: Props) {
  const [trin, setTrin] = useState<Trin>('hvor');
  // null mens kladden hentes. Uden den mellemtilstand ville de tomme felter
  // nå at blinke forbi, før det gemte kom ind i dem.
  const [kladde, setKladde] = useState<Kladde | null>(null);
  const [opretter, setOpretter] = useState(false);

  // Kladden har sit eget uid, indtil turen bliver til noget, så afvisningerne
  // på de fire trin kan hænge samme sted som turenes. De ryddes med kladden —
  // både når man begynder forfra og når turen er oprettet.
  const afviste = useAfviste(KLADDE_UID);

  const steder = useLiveQuery(() => db.steder.toArray()) ?? [];
  const ture = useLiveQuery(() => db.ture.toArray()) ?? [];
  const grupper = useLiveQuery(() => db.grupper.toArray()) ?? [];
  const items = useLiveQuery(() => db.items.toArray()) ?? [];

  useEffect(() => {
    void hentKladde().then((gemt) => setKladde(gemt ?? TOM_KLADDE));
  }, []);

  if (!kladde) return null;

  // Hver ændring skrives med det samme. En kladde, der kun overlever, hvis man
  // husker at trykke videre, er ikke en kladde man tør begynde på — og rækken
  // er én lille tekst i en lokal tabel.
  const ret = (aendring: Partial<Kladde>) => {
    const ny = { ...kladde, ...aendring };
    setKladde(ny);
    void gemKladde(ny);
  };

  const tur = turFraKladde(kladde);
  // Vægtforslag hører ikke hjemme her. De skal ende på turens bytteliste, og
  // den findes ikke endnu — et forslag, der ikke kan handles på det sted, det
  // står, er præcis dét, landingsreglen findes for. Se turmaal.ts.
  const forslag = afviste
    ? udenAfviste(
        forslagTilTur(tur, grupper, items, ture).filter((f) => f.type !== 'vaegt'),
        afviste
      )
    : [];

  // Afvisningen holder ud over de fem trin — den ryddes først med kladden —
  // så den får en vej tilbage med, ligesom på de andre skærme.
  const afvis = async (f: Forslag) => {
    const genskab = await afvisForslag(KLADDE_UID, f);
    meldFortrydelse({ slags: 'Forslaget', navn: f.titel, gjort: 'afvist', genskab });
  };

  const tagImod = (f: Forslag) => {
    if (f.type === 'grej') {
      ret({ gruppe_ids: [...kladde.gruppe_ids, maalFor(f)] });
      return;
    }
    // Kopiforslaget peger på den gamle tur, der skal kopieres fra.
    const gammel = ture.find((t) => t.uid === maalFor(f));
    if (gammel) ret(kopierGrej(gammel, tur));
  };

  const opret = async () => {
    setOpretter(true);
    const id = await opretTur(tur);
    await rydKladde();
    faerdig(id);
  };

  const sidste = trin === 'forslag';

  return (
    <div style={{
      ...layout.container,
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh'
    }}>
      <div style={{ maxWidth: '420px', margin: '0 auto', width: '100%', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Fremdrift trin={trin} kladde={kladde} gaaTil={setTrin} />

        {/* Spørgsmålet står det samme sted på alle fem trin. Centreret ville
            det hoppe op og ned, alt efter hvor højt svaret fylder — og så
            skulle man finde det igen for hvert trin. */}
        <div style={{ flex: 1, paddingBottom: 'var(--plads-5)' }}>
          <h1 style={{ fontSize: '26px', margin: '0 0 var(--plads-2)' }}>
            {TRINTEKST[trin].spoergsmaal}
          </h1>
          <div style={{
            fontSize: 'var(--skrift-detalje)',
            color: 'var(--tekst-dæmpet)',
            lineHeight: 1.6,
            marginBottom: 'var(--plads-5)'
          }}>
            {TRINTEKST[trin].hvorfor}
          </div>

          {trin === 'hvor' && (
            <Hvor kladde={kladde} ret={ret} steder={steder} ture={ture} />
          )}
          {trin === 'hvornaar' && <Hvornaar kladde={kladde} ret={ret} />}
          {trin === 'hvad' && <Hvad kladde={kladde} ret={ret} />}
          {trin === 'hvem' && <Hvem kladde={kladde} ret={ret} />}
          {trin === 'forslag' && (
            <Forslagstrin
              kladde={kladde}
              tur={tur}
              grupper={grupper}
              items={items}
              forslag={forslag}
              nok={nokTilForslag(kladde)}
              tagImod={tagImod}
              fjernGruppe={(uid) => ret({ gruppe_ids: kladde.gruppe_ids.filter((g) => g !== uid) })}
              afvis={(f) => void afvis(f)}
            />
          )}
        </div>

        <div style={{ display: 'flex', gap: 'var(--plads-2)', alignItems: 'center', flexWrap: 'wrap' }}>
          <Knap onClick={() => (trin === 'hvor' ? fortryd() : setTrin(forrigeTrin(trin)))}>
            {trin === 'hvor' ? 'Luk' : 'Tilbage'}
          </Knap>
          {/* At lukke er ikke det samme som at fortryde: kladden bliver
              liggende, og hjem tilbyder at fortsætte den. Skal den væk, skal
              det siges — og så skal der også være et sted at sige det. */}
          {erPaabegyndt(kladde) && (
            <Knap
              variant="tekst"
              onClick={() => {
                setKladde(TOM_KLADDE);
                setTrin('hvor');
                void rydKladde();
              }}
            >
              Begynd forfra
            </Knap>
          )}
          <div style={{ flex: 1 }} />
          {/* "Spring over" og "Videre" er den samme knap med to navne. Ordet
              skifter, fordi det er forskelligt, hvad man gør — men det ville
              være to knapper til det samme at vise dem begge. */}
          {!sidste && (
            <Knap variant="primaer" onClick={() => setTrin(naesteTrin(trin))}>
              {erBesvaret(trin, kladde) ? 'Videre' : 'Spring over'}
            </Knap>
          )}
          {sidste && (
            <Knap variant="primaer" disabled={opretter} onClick={() => void opret()}>
              {opretter ? 'Opretter …' : 'Opret turen'}
            </Knap>
          )}
        </div>
      </div>

      {/* Flowet tegnes uden for skallen — det har hverken navigation eller
          FAB — så den toast, skallen ellers viser, findes ikke her. Uden den
          ville et afvist forslag på sidste trin være det eneste sted i appen,
          man ikke kunne fortryde. Højden holder den fri af trinknapperne
          nedenunder: knaprækkens højde, containerens bundluft og et mellemrum. */}
      <FortrydToast bund="calc(var(--roerehoejde) + var(--plads-6) + var(--plads-2) + env(safe-area-inset-bottom))" />
    </div>
  );
}

// ─────────────────────────────────────────────

// Streger frem for prikker: der er fem trin, og en streg viser både hvor man
// er, og hvad man allerede har svaret på. De besvarede er fyldte, de tomme er
// stiplede — så er "springet over" til at se, uden at det bliver en løftet
// pegefinger.
function Fremdrift({ trin, kladde, gaaTil }: {
  trin: Trin;
  kladde: Kladde;
  gaaTil: (t: Trin) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: '6px', marginBottom: 'var(--plads-6)' }}>
      {TRIN.map((t) => {
        const nu = t === trin;
        const svaret = erBesvaret(t, kladde);
        return (
          <button
            key={t}
            onClick={() => gaaTil(t)}
            aria-label={TRINTEKST[t].spoergsmaal}
            aria-current={nu}
            style={{
              flex: 1,
              height: '3px',
              padding: 0,
              border: 'none',
              borderRadius: '2px',
              cursor: 'pointer',
              background: nu || svaret ? 'var(--accent)' : 'var(--border-svag)',
              opacity: nu || svaret ? 1 : 0.6,
              transition: 'background 0.2s'
            }}
          />
        );
      })}
    </div>
  );
}

function Hvor({ kladde, ret, steder, ture }: {
  kladde: Kladde;
  ret: (a: Partial<Kladde>) => void;
  steder: Sted[];
  ture: Tur[];
}) {
  // Skriver man, søges der i de gemte steder. Har man ikke skrevet noget
  // endnu, vises de mest besøgte — første gang er den liste tom, og så står
  // der bare et felt, som der skal.
  const traf = kladde.sted.trim()
    ? foreslaaSteder(steder, ture, kladde.sted)
    : sorterEfterBesoeg(steder, ture).slice(0, 4);

  return (
    <div style={{ display: 'grid', gap: 'var(--plads-5)' }}>
      <TitelInput
        value={kladde.sted}
        onChange={(v) => ret({ sted: v, sted_uid: '' })}
        placeholder="Rold Skov"
        autoFokus
      />
      {traf.length > 0 && (
        <div style={{ display: 'flex', gap: 'var(--plads-2)', flexWrap: 'wrap' }}>
          {traf.map((s) => (
            <button
              key={s.uid}
              onClick={() => ret({ sted: s.navn, sted_uid: s.uid })}
              style={valgknap(kladde.sted_uid === s.uid)}
            >
              {s.navn}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Hvornaar({ kladde, ret }: { kladde: Kladde; ret: (a: Partial<Kladde>) => void }) {
  const periode = kladde.startdato
    ? formatterPeriode(kladde.startdato, slutdatoFor(kladde.startdato, kladde.naetter))
    : '';

  return (
    <div style={{ display: 'grid', gap: 'var(--plads-5)' }}>
      <div>
        <Label>Første dag</Label>
        <input
          type="date"
          value={kladde.startdato}
          onChange={(e) => ret({ startdato: e.target.value })}
          style={{ width: '100%' }}
        />
        <div style={{ display: 'flex', gap: 'var(--plads-2)', flexWrap: 'wrap', marginTop: 'var(--plads-2)' }}>
          {genveje().map((g) => (
            <button key={g.navn} onClick={() => ret({ startdato: g.dato })} style={valgknap(kladde.startdato === g.dato)}>
              {g.navn}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label>Nætter</Label>
        <div style={{ display: 'flex', gap: 'var(--plads-2)', alignItems: 'center', flexWrap: 'wrap' }}>
          {[0, 1, 2, 3].map((n) => (
            <button key={n} onClick={() => ret({ naetter: n })} style={valgknap(kladde.naetter === n)}>
              {n === 0 ? 'Dagstur' : `${n}`}
            </button>
          ))}
          <Talinput value={kladde.naetter} onChange={(v) => ret({ naetter: Number(v) || 0 })} style={{ width: '72px' }} />
        </div>
      </div>

      {periode && (
        <div style={{ fontSize: 'var(--skrift-detalje)', color: 'var(--tekst-dæmpet)' }}>
          {periode}
        </div>
      )}
    </div>
  );
}

function Hvad({ kladde, ret }: { kladde: Kladde; ret: (a: Partial<Kladde>) => void }) {
  return (
    <div style={{ display: 'grid', gap: 'var(--plads-5)' }}>
      <div>
        <Label>Aktivitet</Label>
        <div style={{ display: 'flex', gap: 'var(--plads-2)', flexWrap: 'wrap' }}>
          {AKTIVITET.map((a) => (
            <button
              key={a}
              onClick={() => ret({ aktivitet: kladde.aktivitet === a ? null : (a as Aktivitet) })}
              style={valgknap(kladde.aktivitet === a)}
            >
              {etiket(a)}
            </button>
          ))}
        </div>
      </div>
      <div>
        <Label>Overnatning</Label>
        <div style={{ display: 'flex', gap: 'var(--plads-2)', flexWrap: 'wrap' }}>
          {OVERNATNING.map((o) => (
            <button
              key={o}
              onClick={() => ret({ overnatning: kladde.overnatning === o ? null : (o as Overnatning) })}
              style={valgknap(kladde.overnatning === o)}
            >
              {etiket(o)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Hvem({ kladde, ret }: { kladde: Kladde; ret: (a: Partial<Kladde>) => void }) {
  const [navn, setNavn] = useState('');

  const tilfoej = () => {
    const rent = navn.trim();
    if (!rent) return;
    ret({
      medrejsende: [...kladde.medrejsende, rent],
      // Tallet følger med op, når man skriver et navn mere, end man har sagt
      // personer. Ellers ville skærmen sige fire og vise fem navne.
      personer: Math.max(kladde.personer, 2 + kladde.medrejsende.length)
    });
    setNavn('');
  };

  return (
    <div style={{ display: 'grid', gap: 'var(--plads-5)' }}>
      <div>
        <Label hjaelp="dig selv talt med">I alt</Label>
        <div style={{ display: 'flex', gap: 'var(--plads-2)', flexWrap: 'wrap' }}>
          {[1, 2, 3, 4].map((n) => (
            <button
              key={n}
              onClick={() => ret({ personer: Math.max(n, 1 + kladde.medrejsende.length) })}
              style={valgknap(kladde.personer === n)}
            >
              {n}
            </button>
          ))}
          <Talinput
            value={kladde.personer}
            onChange={(v) => ret({ personer: Math.max(Number(v) || 1, 1 + kladde.medrejsende.length) })}
            style={{ width: '72px' }}
          />
        </div>
      </div>

      <div>
        {/* Navnene er frivillige. Man kan sagtens vide, at man er fire, uden
            at vide hvem den fjerde er — og de, der skrives, bliver til
            deltagere på turen, så det fælles grej kan fordeles. */}
        <Label hjaelp="valgfrit">Hvem er de andre</Label>
        <div style={{ display: 'flex', gap: 'var(--plads-2)' }}>
          <input
            value={navn}
            onChange={(e) => setNavn(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') tilfoej(); }}
            placeholder="Navn"
            style={{ flex: 1 }}
          />
          <Knap onClick={tilfoej} disabled={!navn.trim()}>Tilføj</Knap>
        </div>
        {kladde.medrejsende.length > 0 && (
          <div style={{ display: 'flex', gap: 'var(--plads-2)', flexWrap: 'wrap', marginTop: 'var(--plads-2)' }}>
            {kladde.medrejsende.map((n, i) => (
              <Chip
                key={`${n}-${i}`}
                onFjern={() => ret({ medrejsende: kladde.medrejsende.filter((_, j) => j !== i) })}
              >
                {n}
              </Chip>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Forslagstrin({ kladde, tur, grupper, items, forslag, nok, tagImod, fjernGruppe, afvis }: {
  kladde: Kladde;
  tur: Tur;
  grupper: Gruppe[];
  items: Item[];
  forslag: Forslag[];
  nok: boolean;
  tagImod: (f: Forslag) => void;
  fjernGruppe: (uid: string) => void;
  afvis: (forslag: Forslag) => void;
}) {
  // Det, der rent faktisk er valgt — talt op ad samme vej som på turens egen
  // skærm, så tallet er det samme de to steder.
  const paaTuren = itemsPaaTur(tur, grupper, items.filter((i) => i.status === 'ejer'));
  const vaegt = paaTuren.reduce((s, i) => s + i.vaegt_g, 0);
  const valgte = kladde.gruppe_ids
    .map((uid) => grupper.find((g) => g.uid === uid))
    .filter((g): g is Gruppe => g !== undefined);

  return (
    <div style={{ display: 'grid', gap: 'var(--plads-3)' }}>
      {forslag.map((f) => (
        <Forslagskort
          key={f.id}
          forslag={f}
          // Der er ikke noget at åbne endnu: turen findes først, når man
          // trykker "Opret turen". Kortet gør derfor det samme som knappen.
          aabn={() => tagImod(f)}
          tagImod={() => tagImod(f)}
          afvis={() => afvis(f)}
        />
      ))}

      {/* Hvad man har sagt ja til. Uden det stod der kun, at noget var valgt —
          og et valg, man ikke kan se, kan man heller ikke fortryde. */}
      {paaTuren.length > 0 && (
        <div style={{ display: 'grid', gap: 'var(--plads-2)' }}>
          <Besked>
            {`${paaTuren.length} ${paaTuren.length === 1 ? 'ting' : 'ting'} med · ${(vaegt / 1000).toFixed(1)} kg`}
          </Besked>
          {valgte.length > 0 && (
            <div style={{ display: 'flex', gap: 'var(--plads-2)', flexWrap: 'wrap' }}>
              {valgte.map((g) => (
                <Chip key={g.uid} farve="accent" onFjern={() => fjernGruppe(g.uid)}>{g.navn}</Chip>
              ))}
            </div>
          )}
        </div>
      )}

      {forslag.length === 0 && paaTuren.length === 0 && (
        <Besked>
          {nok
            ? 'Der er ikke noget at foreslå endnu — Feltbogen kender hverken dit grej eller dine tidligere ture. Opret turen, så kan du pakke den derfra.'
            : 'Du har sprunget spørgsmålene over, og så har Feltbogen ikke noget at gå efter. Turen kan sagtens oprettes alligevel — resten kan udfyldes på turens egen side.'}
        </Besked>
      )}
    </div>
  );
}

function Besked({ children }: { children: ReactNode }) {
  return (
    <div style={{
      fontSize: 'var(--skrift-detalje)',
      color: 'var(--tekst-dæmpet)',
      lineHeight: 1.6
    }}>
      {children}
    </div>
  );
}

// Et valg man kan trykke på. Den samme knap bruges til steder, datoer,
// aktiviteter og antal — det er det samme, man gør, og så skal det se ens ud.
function valgknap(aktiv: boolean) {
  return {
    minHeight: 'var(--roerehoejde)',
    padding: '0 var(--plads-3)',
    borderRadius: 'var(--runding-lille)',
    cursor: 'pointer',
    fontSize: 'var(--skrift-detalje)',
    border: `1px solid ${aktiv ? 'var(--accent)' : 'var(--border)'}`,
    background: aktiv ? 'var(--accent)' : 'transparent',
    color: aktiv ? 'var(--accent-tekst)' : 'var(--tekst)'
  };
}

export default FoersteTur;
