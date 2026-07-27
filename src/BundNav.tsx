type Fane = 'inventar' | 'grupper' | 'ture';

interface Props {
  aktiv: Fane;
  skift: (fane: Fane) => void;
}

function BundNav({ aktiv, skift }: Props) {
  const knap = (id: Fane, label: string) => {
    const erAktiv = aktiv === id;
    return (
      <button
        onClick={() => skift(id)}
        style={{
          flex: 1,
          padding: '14px 4px 12px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontSize: '11px',
          color: erAktiv ? 'var(--accent)' : 'var(--tekst-dæmpet)',
          fontWeight: erAktiv ? 600 : 500,
          textTransform: 'uppercase',
          letterSpacing: '0.8px',
          borderTop: erAktiv ? '2px solid var(--accent)' : '2px solid transparent',
          transition: 'color 0.15s'
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      display: 'flex',
      background: 'var(--bg-topbar)',
      borderTop: '1px solid var(--border)',
      boxShadow: '0 -4px 12px var(--skygge)',
      backdropFilter: 'blur(8px)',
      zIndex: 20
    }}>
      {knap('inventar', 'Inventar')}
      {knap('grupper', 'Grupper')}
      {knap('ture', 'Ture')}
    </div>
  );
}

export default BundNav;
export type { Fane };