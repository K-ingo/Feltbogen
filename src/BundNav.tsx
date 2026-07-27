type Fane = 'inventar' | 'grupper' | 'ture';

interface Props {
  aktiv: Fane;
  skift: (fane: Fane) => void;
}

function BundNav({ aktiv, skift }: Props) {
  const stil = (erAktiv: boolean) => ({
    flex: 1,
    padding: '12px',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: '13px',
    color: erAktiv ? '#333' : '#888',
    fontWeight: erAktiv ? 500 : 400,
    borderTop: erAktiv ? '2px solid #333' : '2px solid transparent'
  });

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      display: 'flex',
      background: 'white',
      borderTop: '1px solid #eee',
      boxShadow: '0 -2px 8px rgba(0,0,0,0.04)'
    }}>
      <button style={stil(aktiv === 'inventar')} onClick={() => skift('inventar')}>
        Inventar
      </button>
      <button style={stil(aktiv === 'grupper')} onClick={() => skift('grupper')}>
        Grupper
      </button>
      <button style={stil(aktiv === 'ture')} onClick={() => skift('ture')}>
        Ture
      </button>
    </div>
  );
}

export default BundNav;
export type { Fane };