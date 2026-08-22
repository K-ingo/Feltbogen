import { FORTRYD_MS, afvisFortrydelse, fortrydBesked, fortrydSletning, useFortrydelse } from './fortryd';

// Striben er udsmykning, ikke information man mister uden den. Beder man om
// mindre bevægelse, står den stille.
function mindreBevaegelse(): boolean {
  return typeof matchMedia === 'function'
    && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

interface Props {
  // Hvor højt beskeden ligger. På telefonen skal den fri af bundnavigationen
  // og af FAB'en — knappen skal kunne bruges mens beskeden står, og 25
  // sekunder er længe at have den primære handling dækket. På en PC er der
  // hverken det ene eller det andet at tage hensyn til.
  bund: string;
}

// Beskeden efter en sletning, med vejen tilbage.
//
// Nedtællingen tegnes som en stribe der løber ud. En CSS-animation frem for
// et sekundur betyder at tiden kan ses uden at appen tegner sig selv om 25
// gange for at vise det.
export function FortrydToast({ bund }: Props) {
  const fortrydelse = useFortrydelse();
  if (!fortrydelse) return null;

  return (
    <div
      // Sletningen er sket, og beskeden er et tilbud — ikke noget der skal
      // afbryde oplæsningen midt i en sætning.
      role="status"
      aria-live="polite"
      // Nøglen giver en ny stribe hver gang, så nedtællingen starter forfra
      // når den næste sletning afløser den forrige.
      key={fortrydelse.navn + fortrydelse.slags}
      style={{
        position: 'fixed',
        left: '16px',
        right: '16px',
        bottom: bund,
        maxWidth: '608px',
        margin: '0 auto',
        borderRadius: '10px',
        background: 'var(--tekst)',
        color: 'var(--bg)',
        boxShadow: '0 4px 16px var(--skygge)',
        zIndex: 30,
        overflow: 'hidden'
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '12px 8px 12px 14px'
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: '13px',
            lineHeight: 1.4,
            // Et langt gearnavn må ikke skubbe knapperne ud af skærmen.
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {fortrydBesked(fortrydelse)}
          </div>
          {fortrydelse.detalje && (
            <div style={{ fontSize: '11px', lineHeight: 1.4, opacity: 0.75, marginTop: '1px' }}>
              {fortrydelse.detalje}
            </div>
          )}
        </div>

        <button
          onClick={() => void fortrydSletning()}
          style={{
            flexShrink: 0,
            background: 'transparent',
            border: 'none',
            padding: '6px 8px',
            cursor: 'pointer',
            color: 'inherit',
            fontSize: '13px',
            fontWeight: 600,
            textDecoration: 'underline'
          }}
        >
          Fortryd
        </button>

        <button
          onClick={afvisFortrydelse}
          aria-label="Luk"
          style={{
            flexShrink: 0,
            background: 'transparent',
            border: 'none',
            padding: '6px 10px',
            cursor: 'pointer',
            color: 'inherit',
            opacity: 0.6,
            fontSize: '16px',
            lineHeight: 1
          }}
        >
          ×
        </button>
      </div>

      <div
        aria-hidden
        style={{
          height: '2px',
          background: 'currentColor',
          opacity: 0.35,
          transformOrigin: 'left',
          animation: mindreBevaegelse()
            ? undefined
            : `fortryd-nedtaelling ${FORTRYD_MS}ms linear forwards`
        }}
      />
    </div>
  );
}
