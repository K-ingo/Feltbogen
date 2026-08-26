import { useState, useEffect } from 'react';
import type { ReactNode, CSSProperties } from 'react';

// ─────────────────────────────────────────────
// Talfelter
//
// Et talfelt skal kunne stå tomt. Skriver man tallet direkte tilbage i
// feltet, kan man ikke slette det sidste ciffer — 0 tegnes igen med det
// samme, og så skal man markere det for at komme videre. På en telefon er
// det næsten ikke til at ramme.
//
// Derfor holder feltet sin egen tekst mens man skriver, og 0 vises som
// ingenting. Modellen får stadig et tal: kalderen laver tomt om til det den
// vil have, typisk 0 eller 1.
// ─────────────────────────────────────────────

function talTekst(v: string | number): string {
  const n = Number(v);
  return v === '' || (Number.isFinite(n) && n === 0) ? '' : String(v);
}

function useTalvisning(vaerdi: string | number): [string, (v: string) => void] {
  const [tekst, setTekst] = useState(() => talTekst(vaerdi));

  // Kommer værdien udefra — fx fra en anden enhed — skal feltet følge med.
  // Men ikke mens man selv står i det: så ville markøren hoppe.
  useEffect(() => {
    setTekst((foer) => (Number(foer || 0) === Number(vaerdi) ? foer : talTekst(vaerdi)));
  }, [vaerdi]);

  return [tekst, setTekst];
}

// Et bart talfelt, til de steder hvor der ikke er plads til en etiket.
export function Talinput({ value, onChange, placeholder, style }: {
  value: number;
  onChange: (v: string) => void;
  placeholder?: string;
  style?: CSSProperties;
}) {
  const [tekst, setTekst] = useTalvisning(value);

  return (
    <input
      type="number"
      inputMode="numeric"
      value={tekst}
      placeholder={placeholder}
      onChange={(e) => { setTekst(e.target.value); onChange(e.target.value); }}
      style={style}
    />
  );
}

// Fælles stilarter der bruges af flere komponenter herunder.
const labelStil: CSSProperties = {
  display: 'block',
  fontSize: 'var(--skrift-lille)',
  color: 'var(--tekst-dæmpet)',
  marginBottom: 'var(--plads-1)',
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.5px'
};

// Hjælpetekst og fejl står i forlængelse af labelen, men uden dens versaler.
const tilfoejelseStil: CSSProperties = {
  marginLeft: 'var(--plads-2)',
  textTransform: 'none',
  letterSpacing: 0,
  fontWeight: 400
};

interface LabelProps {
  children: ReactNode;
  hjaelp?: string;
  fejl?: string;
}

export function Label({ children, hjaelp, fejl }: LabelProps) {
  return (
    <label style={labelStil}>
      {children}
      {hjaelp && <span style={{ ...tilfoejelseStil, color: 'var(--tekst-svag)' }}>· {hjaelp}</span>}
      {fejl && <span style={{ ...tilfoejelseStil, color: 'var(--fejl)' }}>· {fejl}</span>}
    </label>
  );
}

interface KnapProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primaer' | 'sekundaer' | 'tekst' | 'fare';
  disabled?: boolean;
  style?: CSSProperties;
  type?: 'button' | 'submit';
}

export function Knap({ children, onClick, variant = 'sekundaer', disabled, style, type = 'button' }: KnapProps) {
  const varianter: Record<string, CSSProperties> = {
    primaer: {
      background: 'var(--accent)',
      color: 'var(--accent-tekst)',
      border: '1px solid var(--accent)'
    },
    sekundaer: {
      background: 'transparent',
      color: 'var(--tekst)',
      border: '1px solid var(--border)'
    },
    tekst: {
      background: 'transparent',
      color: 'var(--tekst-dæmpet)',
      border: 'none',
      padding: '0 var(--plads-2)'
    },
    fare: {
      background: 'transparent',
      color: 'var(--fejl)',
      border: '1px solid var(--fejl-border)'
    }
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        // Højden kommer fra rørehøjden og ikke fra padding, så knappen kan
        // rammes med en finger uden at blive tyk på en skærm med mus.
        minHeight: 'var(--roerehoejde)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--plads-1)',
        padding: '0 var(--plads-3)',
        borderRadius: 'var(--runding-lille)',
        fontSize: 'var(--skrift-knap)',
        fontWeight: 500,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'transform 0.1s, opacity 0.15s',
        ...varianter[variant],
        ...style
      }}
    >
      {children}
    </button>
  );
}

interface KortProps {
  children: ReactNode;
  onClick?: () => void;
  style?: CSSProperties;
  fremhaevet?: boolean;
}

export function Kort({ children, onClick, style, fremhaevet }: KortProps) {
  return (
    <div
      onClick={onClick}
      style={{
        background: fremhaevet ? 'var(--bg-forhoejet)' : 'transparent',
        borderRadius: 'var(--runding)',
        padding: 'var(--plads-4)',
        cursor: onClick ? 'pointer' : 'default',
        border: fremhaevet ? '1px solid var(--border-svag)' : 'none',
        ...style
      }}
    >
      {children}
    </div>
  );
}

interface FeltProps {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  hjaelp?: string;
  fejl?: string;
}

export function Felt({ label, value, onChange, type = 'text', placeholder, hjaelp, fejl }: FeltProps) {
  return (
    <div>
      <Label hjaelp={hjaelp} fejl={fejl}>{label}</Label>
      {type === 'number' ? (
        <Talinput
          value={Number(value)}
          onChange={onChange}
          placeholder={placeholder}
          style={{ width: '100%' }}
        />
      ) : (
        <input
          type={type}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          style={{ width: '100%' }}
        />
      )}
    </div>
  );
}

interface TekstomraadeProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  raekker?: number;
  placeholder?: string;
}

export function Tekstomraade({ label, value, onChange, raekker = 2, placeholder }: TekstomraadeProps) {
  return (
    <div>
      <Label>{label}</Label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={raekker}
        placeholder={placeholder}
        style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
      />
    </div>
  );
}

interface DropdownProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
  // Uden formater vises værdien som den er gemt.
  formater?: (v: string) => string;
}

export function Dropdown({ label, value, onChange, options, formater }: DropdownProps) {
  return (
    <div>
      <Label>{label}</Label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: '100%', textTransform: 'capitalize' }}
      >
        {options.map((o) => (
          <option key={o} value={o}>{formater ? formater(o) : o}</option>
        ))}
      </select>
    </div>
  );
}

interface SegmentProps<T extends string> {
  vaerdier: readonly T[];
  valgt: T;
  vaelg: (v: T) => void;
  // Uden formater vises værdien direkte med stort begyndelsesbogstav.
  formater?: (v: T) => string;
  kompakt?: boolean;
}

export function Segment<T extends string>({ vaerdier, valgt, vaelg, formater, kompakt }: SegmentProps<T>) {
  return (
    <div style={{ display: 'flex', gap: 'var(--plads-1)', flexWrap: 'wrap' }}>
      {vaerdier.map((v) => {
        const erAktiv = v === valgt;
        return (
          <button
            key={v}
            onClick={() => vaelg(v)}
            style={{
              // Den kompakte er stadig et valg man skal kunne ramme — den
              // bliver smallere, ikke lavere.
              minHeight: 'var(--roerehoejde)',
              display: 'inline-flex',
              alignItems: 'center',
              padding: kompakt ? '0 var(--plads-3)' : '0 var(--plads-4)',
              fontSize: kompakt ? 'var(--skrift-lille)' : 'var(--skrift-detalje)',
              background: erAktiv ? 'var(--accent)' : 'transparent',
              color: erAktiv ? 'var(--accent-tekst)' : 'var(--tekst-dæmpet)',
              border: `1px solid ${erAktiv ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 'var(--runding-pille)',
              cursor: 'pointer',
              textTransform: formater ? 'none' : 'capitalize',
              fontWeight: 500
            }}
          >
            {formater ? formater(v) : v}
          </button>
        );
      })}
    </div>
  );
}

interface ChipProps {
  children: ReactNode;
  onFjern?: () => void;
  farve?: 'default' | 'accent' | 'advarsel' | 'fejl';
  storrelse?: 'lille' | 'normal';
}

export function Chip({ children, onFjern, farve = 'default', storrelse = 'normal' }: ChipProps) {
  const farver: Record<string, CSSProperties> = {
    default: { background: 'var(--border-svag)', color: 'var(--tekst)' },
    accent: { background: 'var(--accent)', color: 'var(--accent-tekst)' },
    advarsel: { background: 'var(--advarsel-bg)', color: 'var(--advarsel)' },
    fejl: { background: 'var(--fejl-bg)', color: 'var(--fejl)' }
  };

  const storrelser: Record<string, CSSProperties> = {
    lille: { fontSize: 'var(--skrift-mikro)', padding: '2px var(--plads-2)' },
    normal: { fontSize: 'var(--skrift-lille)', padding: '3px 10px' }
  };

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 'var(--plads-1)',
      borderRadius: 'var(--runding-lille)',
      fontWeight: 500,
      ...farver[farve],
      ...storrelser[storrelse],
      // En chip man kan slette noget med, er en knap og ikke en etiket, og
      // den skal derfor være højere end de chips der bare står og viser et
      // tag. Ikke hele rørehøjden: chips ombryder i rækker med få pixels
      // imellem, så en trykflade på 44 px ville nå ned i rækken under og
      // slette et andet tag end det man sigtede på. Den fejl er værre end en
      // lidt lille knap.
      ...(onFjern ? { minHeight: '32px', paddingRight: 'var(--plads-1)' } : {})
    }}>
      {children}
      {onFjern && (
        <button
          onClick={onFjern}
          aria-label="Fjern"
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            // Krydset fylder chippens højde og bliver kvadratisk, så der er
            // noget at ramme. Se kommentaren på chippen ovenfor for hvorfor
            // det ikke er de fulde 44 px.
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '28px',
            height: '28px',
            padding: 0,
            marginRight: '-2px',
            fontSize: 'var(--skrift-brod)',
            lineHeight: 1,
            color: 'inherit',
            opacity: 0.7
          }}
        >
          ×
        </button>
      )}
    </span>
  );
}

// Krydset der fjerner en linje i en liste man kan redigere — et punkt på
// afgangs-tjekket, en deltager, en vedligeholdelseshandling. Lå fire steder i
// koden som hver sin lille knap på 20×16 px, hvilket er småt at ramme for
// noget der sletter.
//
// Rækken den står i, er allerede mindst en rørehøjde høj, fordi der er et
// input ved siden af. Derfor kan krydset få hele højden uden at nå ned i
// rækken under.
export function FjernKnap({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      style={{
        minWidth: 'var(--roerehoejde)',
        minHeight: 'var(--roerehoejde)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        background: 'transparent',
        border: 'none',
        color: 'var(--fejl)',
        cursor: 'pointer',
        fontSize: 'var(--skrift-brod)',
        padding: 0
      }}
    >
      ×
    </button>
  );
}

// Viser de første `maks` tags, og resten som en tæller.
export function TagChips({ tags, maks = 4 }: { tags: string[]; maks?: number }) {
  if (tags.length === 0) return null;
  const resten = tags.length - maks;

  return (
    <div style={{ display: 'flex', gap: 'var(--plads-1)', marginTop: '6px', flexWrap: 'wrap' }}>
      {tags.slice(0, maks).map((tag) => (
        <Chip key={tag} storrelse="lille">{tag}</Chip>
      ))}
      {resten > 0 && <Chip storrelse="lille">+{resten}</Chip>}
    </div>
  );
}

interface BadgeProps {
  children: ReactNode;
  niveau: 'info' | 'accent' | 'advarsel' | 'fejl' | 'succes';
}

export function Badge({ children, niveau }: BadgeProps) {
  const farver: Record<string, CSSProperties> = {
    info: { background: 'var(--border-svag)', color: 'var(--tekst-dæmpet)' },
    accent: { background: 'var(--accent-bg)', color: 'var(--accent)' },
    advarsel: { background: 'var(--advarsel-bg)', color: 'var(--advarsel)' },
    fejl: { background: 'var(--fejl-bg)', color: 'var(--fejl)' },
    succes: { background: 'var(--accent-bg)', color: 'var(--succes)' }
  };

  return (
    <span style={{
      fontSize: 'var(--skrift-mikro)',
      padding: '2px var(--plads-2)',
      borderRadius: 'var(--runding-lille)',
      fontWeight: 500,
      textTransform: 'capitalize',
      ...farver[niveau]
    }}>
      {children}
    </span>
  );
}

export function SektionsTitel({ children }: { children: ReactNode }) {
  return (
    <div style={{
      fontSize: 'var(--skrift-lille)',
      color: 'var(--tekst-dæmpet)',
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.8px',
      marginBottom: 'var(--plads-3)'
    }}>
      {children}
    </div>
  );
}

interface ListeRaekkeProps {
  titel: ReactNode;
  detalje?: ReactNode;
  onClick?: () => void;
  // Til venstre for teksten, fx en turs forsidebillede.
  foran?: ReactNode;
  // Ekstra indhold under detaljelinjen, fx tag-chips.
  children?: ReactNode;
}

export function ListeRaekke({ titel, detalje, onClick, foran, children }: ListeRaekkeProps) {
  return (
    <div
      onClick={onClick}
      style={{
        // En række i en liste er det man rammer allermest. Rørehøjden er
        // gulvet; teksten gør den gerne højere.
        minHeight: 'var(--roerehoejde)',
        padding: 'var(--plads-4) var(--plads-1)',
        borderBottom: '1px solid var(--border-svag)',
        cursor: onClick ? 'pointer' : 'default',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 'var(--plads-3)'
      }}
    >
      {foran}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 500, color: 'var(--tekst)', fontSize: 'var(--skrift-brod)' }}>{titel}</div>
        {detalje && (
          <div style={{ fontSize: 'var(--skrift-detalje)', color: 'var(--tekst-dæmpet)', marginTop: '2px' }}>
            {detalje}
          </div>
        )}
        {children}
      </div>
      <div style={{ color: 'var(--tekst-svag)', fontSize: '18px' }}>›</div>
    </div>
  );
}

// Vises når en liste er tom — enten fordi der ikke er data, eller fordi
// søgningen ikke gav noget.
export function TomListe({ children }: { children: ReactNode }) {
  return (
    <div style={{ padding: 'var(--plads-6) var(--plads-5)', textAlign: 'center', color: 'var(--tekst-svag)' }}>
      {children}
    </div>
  );
}

interface FeltkortProps {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  // Vises efter værdien, fx "g" eller "kr".
  enhed?: string;
  placeholder?: string;
}

// Et felt vist som kort med etiketten over værdien. Værdien er stadig et
// input — hverdagsfelter redigeres inline, jf. fundamentets §13.
export function Feltkort({ label, value, onChange, type = 'text', enhed, placeholder }: FeltkortProps) {
  return (
    <div style={{
      border: '1px solid var(--border-svag)',
      borderRadius: 'var(--runding-lille)',
      padding: '10px var(--plads-3)',
      background: 'var(--bg-forhoejet)'
    }}>
      <div style={{ ...feltkortEtiket }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
        {type === 'number' ? (
          <Talinput
            value={Number(value)}
            onChange={onChange}
            placeholder={placeholder}
            style={{ ...feltkortInput }}
          />
        ) : (
          <input
            type={type}
            value={value}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
            style={{ ...feltkortInput }}
          />
        )}
        {enhed && <span style={{ fontSize: 'var(--skrift-knap)', color: 'var(--tekst-dæmpet)' }}>{enhed}</span>}
      </div>
    </div>
  );
}

const feltkortInput: CSSProperties = {
  border: 'none',
  background: 'transparent',
  padding: 0,
  // Kortet er selv rammen om feltet, så inputtet skal hverken have sin egen
  // kant eller sin egen mindstehøjde oven i den.
  minHeight: 0,
  fontSize: 'var(--skrift-felt)',
  width: '100%',
  minWidth: 0,
  color: 'var(--tekst)'
};

const feltkortEtiket: CSSProperties = {
  fontSize: 'var(--skrift-mikro)',
  color: 'var(--tekst-dæmpet)',
  textTransform: 'uppercase',
  letterSpacing: '0.6px',
  fontWeight: 600,
  marginBottom: '3px'
};

// Kort med en overskrift og frit indhold — købsinfo, brugsstatistik osv.
export function Infokort({ label, fremhaevet, children }: {
  label: string;
  fremhaevet?: boolean;
  children: ReactNode;
}) {
  return (
    <div style={{
      border: `1px solid ${fremhaevet ? 'var(--accent-border)' : 'var(--border-svag)'}`,
      borderRadius: 'var(--runding-lille)',
      padding: 'var(--plads-3)',
      background: fremhaevet ? 'var(--accent-bg)' : 'var(--bg-forhoejet)'
    }}>
      <div style={feltkortEtiket}>{label}</div>
      {children}
    </div>
  );
}

interface TitelInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  // Sættes når posten lige er oprettet, så man kan skrive med det samme.
  autoFokus?: boolean;
}

// Navnet på en post, redigerbart direkte i overskriften.
export function TitelInput({ value, onChange, placeholder, autoFokus }: TitelInputProps) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoFocus={autoFokus}
      style={{
        fontFamily: "'Fraunces', Georgia, serif",
        fontSize: 'var(--skrift-titel)',
        fontWeight: 400,
        border: 'none',
        background: 'transparent',
        padding: 'var(--plads-1) 0',
        width: '100%',
        marginBottom: 'var(--plads-4)',
        color: 'var(--tekst)'
      }}
    />
  );
}

interface DetaljeHeaderProps {
  tilbage: () => void;
  sletLabel: string;
  slet: () => void;
}

// Toppen af de tre detaljeskærme. Slet ligger i tre-prikker menuen, så et
// fejlklik tæt på bundnavigationen ikke kan slette noget.
export function DetaljeHeader({ tilbage, sletLabel, slet }: DetaljeHeaderProps) {
  const [menuAaben, setMenuAaben] = useState(false);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--plads-4)' }}>
      {/* Tilbage og tre-prikker er de to knapper man rammer med tommelen
          øverst på skærmen. De skal have hele rørehøjden, også selvom
          teksten i dem er lille. */}
      <button
        onClick={tilbage}
        style={{
          minHeight: 'var(--roerehoejde)',
          display: 'inline-flex',
          alignItems: 'center',
          background: 'transparent',
          border: 'none',
          fontSize: 'var(--skrift-brod)',
          cursor: 'pointer',
          color: 'var(--tekst-dæmpet)',
          padding: '0 var(--plads-2) 0 0'
        }}
      >
        ‹ Tilbage
      </button>
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setMenuAaben(!menuAaben)}
          aria-label="Flere handlinger"
          style={{
            minHeight: 'var(--roerehoejde)',
            minWidth: 'var(--roerehoejde)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            fontSize: '18px',
            cursor: 'pointer',
            padding: 0,
            color: 'var(--tekst-dæmpet)'
          }}
        >
          ⋯
        </button>
        {menuAaben && (
          <div style={{
            position: 'absolute',
            right: 0,
            top: '100%',
            background: 'var(--bg-forhoejet)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--runding-lille)',
            boxShadow: '0 4px 12px var(--skygge)',
            minWidth: '140px',
            zIndex: 10,
            overflow: 'hidden'
          }}>
            <button
              onClick={() => { setMenuAaben(false); slet(); }}
              style={{
                minHeight: 'var(--roerehoejde)',
                width: '100%',
                padding: '0 var(--plads-4)',
                background: 'transparent',
                border: 'none',
                textAlign: 'left',
                cursor: 'pointer',
                color: 'var(--fejl)',
                fontSize: 'var(--skrift-knap)'
              }}
            >
              {sletLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Motorens resonnement, gemt bag et lille spørgsmålstegn.
//
// Åbenhed er det der gør forskellen mellem en rådgiver og en automat
// (fundamentet §15). Motoren ved allerede hvorfor den siger som den gør — den
// skal bare kunne spørges. Teksten ligger også i title, så den kan læses ved
// at holde musen over på PC uden at folde noget ud.
export function Hvorfor({ begrundelse }: { begrundelse: string }) {
  const [aaben, setAaben] = useState(false);

  if (!begrundelse) return null;

  return (
    <>
      <button
        onClick={() => setAaben(!aaben)}
        title={begrundelse}
        aria-expanded={aaben}
        style={{
          background: 'transparent',
          border: 'none',
          // "hvorfor?" står midt i en sætning og kan ikke fylde 44 px uden at
          // skubbe linjen fra hinanden. I stedet vokser trykfladen ud over
          // teksten, mens den negative margin holder linjen præcis hvor den
          // var. Man rammer altså et større felt end det man kan se.
          display: 'inline-block',
          padding: 'var(--plads-2) var(--plads-1)',
          margin: 'calc(var(--plads-2) * -1) calc(var(--plads-1) * -1)',
          fontSize: 'var(--skrift-lille)',
          cursor: 'pointer',
          color: aaben ? 'var(--accent)' : 'var(--tekst-svag)',
          textDecoration: 'underline',
          textUnderlineOffset: '2px'
        }}
      >
        hvorfor?
      </button>
      {aaben && (
        <div style={{
          marginTop: 'var(--plads-1)',
          padding: 'var(--plads-2) 10px',
          borderRadius: 'var(--runding-lille)',
          border: '1px solid var(--border-svag)',
          background: 'var(--bg-forhoejet)',
          fontSize: 'var(--skrift-lille)',
          lineHeight: 1.55,
          color: 'var(--tekst-dæmpet)'
        }}>
          {begrundelse}
        </div>
      )}
    </>
  );
}

export function Indlaeser() {
  return <div style={{ padding: 'var(--plads-5)', color: 'var(--tekst-dæmpet)' }}>Indlæser...</div>;
}
