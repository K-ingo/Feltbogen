import type { ReactNode, CSSProperties } from 'react';

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
      <label style={{ display: 'block', fontSize: '11px', color: 'var(--tekst-dæmpet)', marginBottom: '5px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {label}
        {hjaelp && <span style={{ color: 'var(--tekst-svag)', marginLeft: '8px', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>· {hjaelp}</span>}
        {fejl && <span style={{ color: 'var(--fejl)', marginLeft: '8px', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>· {fejl}</span>}
      </label>
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

interface DropdownProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}

export function Dropdown({ label, value, onChange, options }: DropdownProps) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '11px', color: 'var(--tekst-dæmpet)', marginBottom: '5px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: '100%', fontSize: '14px', textTransform: 'capitalize' }}
      >
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
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

interface SektionsTitelProps {
  children: ReactNode;
}

export function SektionsTitel({ children }: SektionsTitelProps) {
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

export const layout = {
  container: {
    padding: '20px',
    maxWidth: '640px',
    margin: '0 auto',
    paddingBottom: '90px'
  } as CSSProperties,
  raek: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  } as CSSProperties
};