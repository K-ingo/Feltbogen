import { useState } from 'react';
import type { ReactNode, CSSProperties } from 'react';

// Fælles stilarter der bruges af flere komponenter herunder.
const labelStil: CSSProperties = {
  display: 'block',
  fontSize: '11px',
  color: 'var(--tekst-dæmpet)',
  marginBottom: '5px',
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.5px'
};

// Hjælpetekst og fejl står i forlængelse af labelen, men uden dens versaler.
const tilfoejelseStil: CSSProperties = {
  marginLeft: '8px',
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
      padding: '6px 8px'
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
        padding: '8px 14px',
        borderRadius: '8px',
        fontSize: '13px',
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
        borderRadius: '12px',
        padding: '14px',
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
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: '100%', fontSize: '14px' }}
      />
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
        style={{ width: '100%', fontSize: '14px', textTransform: 'capitalize' }}
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
    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
      {vaerdier.map((v) => {
        const erAktiv = v === valgt;
        return (
          <button
            key={v}
            onClick={() => vaelg(v)}
            style={{
              padding: kompakt ? '5px 12px' : '6px 14px',
              fontSize: kompakt ? '11px' : '12px',
              background: erAktiv ? 'var(--accent)' : 'transparent',
              color: erAktiv ? 'var(--accent-tekst)' : 'var(--tekst-dæmpet)',
              border: `1px solid ${erAktiv ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: '16px',
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
    lille: { fontSize: '10px', padding: '2px 8px' },
    normal: { fontSize: '11px', padding: '3px 10px' }
  };

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      borderRadius: '10px',
      fontWeight: 500,
      ...farver[farve],
      ...storrelser[storrelse]
    }}>
      {children}
      {onFjern && (
        <button
          onClick={onFjern}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            fontSize: '13px',
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

// Viser de første `maks` tags, og resten som en tæller.
export function TagChips({ tags, maks = 4 }: { tags: string[]; maks?: number }) {
  if (tags.length === 0) return null;
  const resten = tags.length - maks;

  return (
    <div style={{ display: 'flex', gap: '4px', marginTop: '6px', flexWrap: 'wrap' }}>
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
      fontSize: '10px',
      padding: '2px 8px',
      borderRadius: '10px',
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
      fontSize: '11px',
      color: 'var(--tekst-dæmpet)',
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.8px',
      marginBottom: '10px'
    }}>
      {children}
    </div>
  );
}

interface ListeRaekkeProps {
  titel: ReactNode;
  detalje?: ReactNode;
  onClick?: () => void;
  // Ekstra indhold under detaljelinjen, fx tag-chips.
  children?: ReactNode;
}

export function ListeRaekke({ titel, detalje, onClick, children }: ListeRaekkeProps) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: '14px 4px',
        borderBottom: '1px solid var(--border-svag)',
        cursor: onClick ? 'pointer' : 'default',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 500, color: 'var(--tekst)', fontSize: '14px' }}>{titel}</div>
        {detalje && (
          <div style={{ fontSize: '12px', color: 'var(--tekst-dæmpet)', marginTop: '2px' }}>
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
    <div style={{ padding: '30px 20px', textAlign: 'center', color: 'var(--tekst-svag)' }}>
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
      borderRadius: '10px',
      padding: '10px 12px',
      background: 'var(--bg-forhoejet)'
    }}>
      <div style={{ ...feltkortEtiket }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
        <input
          type={type}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          style={{
            border: 'none',
            background: 'transparent',
            padding: 0,
            fontSize: '16px',
            width: '100%',
            minWidth: 0,
            color: 'var(--tekst)'
          }}
        />
        {enhed && <span style={{ fontSize: '13px', color: 'var(--tekst-dæmpet)' }}>{enhed}</span>}
      </div>
    </div>
  );
}

const feltkortEtiket: CSSProperties = {
  fontSize: '10px',
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
      borderRadius: '10px',
      padding: '12px',
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
        fontSize: '26px',
        fontWeight: 400,
        border: 'none',
        background: 'transparent',
        padding: '4px 0',
        width: '100%',
        marginBottom: '14px',
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
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
      <button
        onClick={tilbage}
        style={{ background: 'transparent', border: 'none', fontSize: '14px', cursor: 'pointer', color: 'var(--tekst-dæmpet)', padding: '4px 0' }}
      >
        ‹ Tilbage
      </button>
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setMenuAaben(!menuAaben)}
          style={{ background: 'transparent', border: 'none', fontSize: '18px', cursor: 'pointer', padding: '4px 12px', color: 'var(--tekst-dæmpet)' }}
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
            borderRadius: '8px',
            boxShadow: '0 4px 12px var(--skygge)',
            minWidth: '140px',
            zIndex: 10,
            overflow: 'hidden'
          }}>
            <button
              onClick={() => { setMenuAaben(false); slet(); }}
              style={{
                display: 'block',
                width: '100%',
                padding: '10px 14px',
                background: 'transparent',
                border: 'none',
                textAlign: 'left',
                cursor: 'pointer',
                color: 'var(--fejl)',
                fontSize: '13px'
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

export function Indlaeser() {
  return <div style={{ padding: '20px', color: 'var(--tekst-dæmpet)' }}>Indlæser...</div>;
}
