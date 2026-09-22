import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { ItemStatus } from './db';
import { ITEM_STATUS } from './db';
import { Felt, Knap, Label, Segment } from './ui';
import {
  turKanOprettes, grejKanOprettes, tommeTurfelter, tommeGrejfelter
} from './opretark';
import type { NyTurFelter, NytGrejFelter } from './opretark';

// Opret-ark: et lag over skærmen, hvor man skriver det, der skal til, og først
// derefter trykker Opret.
//
// Før lå oprettelsen i selve trykket: "Ny tur" skrev en navnløs tur i basen og
// åbnede den. Gik man tilbage, blev den ryddet op — men lukkede man fanen,
// nåede den op på serveren og blev stående som "Din næste tur" på alle ens
// enheder. Arket findes for at lukke den dør.
//
// Skallen er fælles, så det næste ark ikke skal finde på sin egen måde at
// være et lag over skærmen på.

interface ArkProps {
  titel: string;
  // Teksten under titlen. Den fortæller, at der ikke er oprettet noget endnu —
  // det er hele pointen med arket, og så skal det stå på skærmen.
  forklaring: string;
  opretLabel: string;
  kanOprette: boolean;
  // Hvorfor knappen er slået fra. Står som title på knappen, så den ikke bare
  // er grå uden grund.
  hvorforSlaaetFra: string;
  opret: () => void;
  annuller: () => void;
  // Referencerne tegner arkene i to bredder: Ny tur i 576 px, fordi datoerne
  // står to og to, og Tilføj grej i 512 px, hvor der kun er et navn og tre
  // korte tal.
  smal?: boolean;
  // Skriv grunden under knapperne, når Opret er slået fra. Opret-arkene har
  // brug for den; arkene bag grejsæt siger det allerede i deres overblik, og
  // der ville det stå to gange.
  visGrund?: boolean;
  children: ReactNode;
}

export function Ark({
  titel, forklaring, opretLabel, kanOprette, hvorforSlaaetFra, opret, annuller, smal, visGrund, children
}: ArkProps) {
  const titelId = useId();
  const panel = useRef<HTMLDivElement>(null);

  // Escape lukker uden at oprette. Det er den samme vej ud som Annuller, og
  // den forventer man af et lag, der ligger over noget andet.
  useEffect(() => {
    const paaTast = (e: KeyboardEvent) => {
      if (e.key === 'Escape') annuller();
    };
    document.addEventListener('keydown', paaTast);
    return () => document.removeEventListener('keydown', paaTast);
  }, [annuller]);

  // Fokus ind i arket, når det åbner. Uden det bliver fokus stående bag
  // laget, og den der bruger tastatur skal tabbe sig gennem hele skærmen for
  // at nå frem til et felt, der allerede er synligt.
  //
  // Feltet og ikke en knap: luk-krydset står først i dokumentet, og lander
  // fokus dér, er det første tastetryk tæt på at lukke arket igen.
  useEffect(() => {
    const ark = panel.current;
    if (!ark) return;
    const foerste = ark.querySelector<HTMLElement>('input, textarea, select')
      ?? ark.querySelector<HTMLElement>('button');
    foerste?.focus();
  }, []);

  return (
    <div
      className="ark-baggrund"
      // Et klik ved siden af lukker. Klik inde i selve arket må ikke boble op
      // og lukke det, man er i gang med at skrive i.
      onClick={(e) => { if (e.target === e.currentTarget) annuller(); }}
    >
      <div className={smal ? 'ark ark--smal' : 'ark'} role="dialog" aria-modal="true" aria-labelledby={titelId} ref={panel}>
        <div className="ark-hoved">
          <h2 id={titelId}>{titel}</h2>
          <Knap variant="tekst" onClick={annuller} ariaLabel="Luk">✕</Knap>
        </div>

        <div className="ark-indhold">
          <p className="ark-forklaring">{forklaring}</p>
          {children}
        </div>

        <div className="ark-fod">
          <Knap variant="tekst" onClick={annuller} style={{ padding: '0 var(--plads-4)' }}>Annuller</Knap>
          {/* Arkets ene fyldte accent. Den er 48 px høj og ikke rørehøjdens
              44 — referencen tegner opret-knappen en tak større end Annuller,
              så den ikke kan forveksles med vejen ud. */}
          <Knap
            variant="primaer"
            onClick={opret}
            disabled={!kanOprette}
            ariaLabel={kanOprette ? undefined : `${opretLabel} — ${hvorforSlaaetFra}`}
            style={{ minHeight: '48px', padding: '0 22px' }}
          >
            {opretLabel}
          </Knap>
        </div>

        {/* En slukket knap uden en grund ligner en fejl i appen. Grunden står
            også i knappens navn, men det hjælper kun en skærmlæser. */}
        {visGrund && !kanOprette && (
          <p className="ark-hint">{forTekst(hvorforSlaaetFra)}</p>
        )}
      </div>
    </div>
  );
}

// "skriv en titel for at oprette" → "Skriv en titel for at oprette."
function forTekst(grund: string): string {
  const s = grund.trim();
  return s.charAt(0).toUpperCase() + s.slice(1) + (s.endsWith('.') ? '' : '.');
}

// Et talfelt med enheden inde i rammen, som referencen tegner det: etiketten
// over, "g" og "kr" efter tallet. Feltkort lægger etiketten ind i kortet, og
// det er en anden form end resten af arkets felter.
function Enhedsfelt({ label, enhed, value, onChange, placeholder }: {
  label: string;
  enhed?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="ark-enhedsfelt">
        <input
          id={id}
          inputMode="decimal"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
        {enhed && <span aria-hidden="true">{enhed}</span>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────

export function NyTurArk({ idag, sted, opret, annuller }: {
  idag: string;
  // Kommer man fra et sted, er stedet udfyldt i forvejen. Det er det eneste,
  // der skiller den vej fra en helt almindelig ny tur.
  sted?: string;
  opret: (felter: NyTurFelter) => void;
  annuller: () => void;
}) {
  const [felter, setFelter] = useState<NyTurFelter>({ ...tommeTurfelter(idag), sted: sted ?? '' });
  const skriv = (aendring: Partial<NyTurFelter>) => setFelter((foer) => ({ ...foer, ...aendring }));
  const kan = turKanOprettes(felter);

  return (
    <Ark
      titel="Ny tur"
      forklaring="Der oprettes ingen kladde, før du trykker Opret — så lander der ikke en tom tur på dine andre enheder."
      opretLabel="Opret tur"
      kanOprette={kan}
      hvorforSlaaetFra="skriv en titel for at oprette"
      opret={() => kan && opret(felter)}
      annuller={annuller}
      visGrund
    >
      <Felt
        label="Titel"
        value={felter.titel}
        onChange={(v) => skriv({ titel: v })}
        placeholder="Fx Fovslet Skov"
      />

      <div className="ark-to-felter">
        <Felt label="Fra" type="date" value={felter.fra} onChange={(v) => skriv({ fra: v })} />
        <Felt label="Til" type="date" value={felter.til} onChange={(v) => skriv({ til: v })} />
      </div>

      <Felt
        label="Sted"
        value={felter.sted}
        onChange={(v) => skriv({ sted: v })}
        placeholder="Valgfrit lige nu"
      />

      <Felt
        label="Deltagere"
        value={felter.deltagere}
        onChange={(v) => skriv({ deltagere: v })}
        placeholder="Navne, adskilt af komma"
        hjaelp="Du står på turen i forvejen."
      />
    </Ark>
  );
}

// ─────────────────────────────────────────────

export function NytGrejArk({ status, opret, annuller }: {
  // Står man på en fane i Grej, lander det nye grej i den status, man kigger
  // på — ellers forsvinder det ud af syne i samme øjeblik, det bliver til.
  status?: ItemStatus;
  opret: (felter: NytGrejFelter) => void;
  annuller: () => void;
}) {
  const [felter, setFelter] = useState<NytGrejFelter>(tommeGrejfelter(status));
  const skriv = (aendring: Partial<NytGrejFelter>) => setFelter((foer) => ({ ...foer, ...aendring }));
  const kan = grejKanOprettes(felter);

  return (
    <Ark
      titel="Tilføj grej"
      forklaring="Gemmes først, når du trykker Opret — intet oprettes bare ved at åbne."
      opretLabel="Opret grej"
      kanOprette={kan}
      hvorforSlaaetFra="skriv et navn for at oprette"
      opret={() => kan && opret(felter)}
      annuller={annuller}
      smal
      visGrund
    >
      <Felt
        label="Navn"
        value={felter.navn}
        onChange={(v) => skriv({ navn: v })}
        placeholder="Navn på grej"
      />

      <div>
        <Label>Status</Label>
        <Segment
          vaerdier={ITEM_STATUS}
          valgt={felter.status}
          vaelg={(v) => skriv({ status: v })}
          // Ikke `etiket()`: den kender ikke grejets statusser og gav dem
          // tilbage med småt ("ejer"). Referencen skriver "Ejer".
          formater={(v) => v.charAt(0).toUpperCase() + v.slice(1)}
          kompakt
          // Stille og ikke fyldt: Opret grej er arkets ene fyldte accent.
          // Referencen tegner "Ejer" fyldt, men så stod der to grønne flader
          // i samme ark, så snart navnet var skrevet.
          stille
        />
      </div>

      <div className="ark-tre-felter">
        <Enhedsfelt label="Vægt" enhed="g" value={felter.vaegt} onChange={(v) => skriv({ vaegt: v })} placeholder="0" />
        <Enhedsfelt label="Pris" enhed="kr" value={felter.pris} onChange={(v) => skriv({ pris: v })} placeholder="0" />
        <Enhedsfelt label="Antal" value={felter.antal} onChange={(v) => skriv({ antal: v })} />
      </div>
    </Ark>
  );
}
