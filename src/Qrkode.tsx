import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface Props {
  vaerdi: string;
  // Kantlængde i px. Skal være stor nok til at et kamera kan fange den på en
  // skærm i skumringen.
  storrelse?: number;
}

// En QR-kode til et delelink.
//
// Ved bålet uden dækning er en QR mærkbart bedre end at læse 32 hex-tegn op —
// og den anden har ikke nødvendigvis noget at skrive på.
//
// Koden tegnes som SVG og ikke som canvas: den skalerer, den kan læses af en
// skærmlæser gennem sin title, og den koster ingen billeddata.
export function Qrkode({ vaerdi, storrelse = 180 }: Props) {
  const [svg, setSvg] = useState('');
  const [fejl, setFejl] = useState(false);

  useEffect(() => {
    if (!vaerdi) { setSvg(''); return; }

    let aktiv = true;
    setFejl(false);

    QRCode.toString(vaerdi, {
      type: 'svg',
      margin: 1,
      // Fast sort på hvid. En QR-kode aflæses på kontrast, og appens farver
      // følger temaet — en lys kode på lys baggrund kan ikke skannes.
      color: { dark: '#000000', light: '#ffffff' },
      // Middel retter op på en del snavs og skygge uden at gøre mønstret
      // væsentligt tættere.
      errorCorrectionLevel: 'M'
    })
      .then((ud) => { if (aktiv) setSvg(ud); })
      .catch(() => { if (aktiv) setFejl(true); });

    return () => { aktiv = false; };
  }, [vaerdi]);

  if (fejl) {
    return (
      <div style={{ fontSize: 'var(--skrift-lille)', color: 'var(--tekst-svag)' }}>
        Kunne ikke tegne QR-koden. Linket virker stadig.
      </div>
    );
  }

  if (!svg) return null;

  return (
    <div
      role="img"
      aria-label="QR-kode til linket"
      style={{
        width: `${storrelse}px`,
        height: `${storrelse}px`,
        background: '#ffffff',
        padding: '8px',
        borderRadius: '8px',
        // Hvid firkant på mørkt tema har brug for en kant for ikke at svæve.
        border: '1px solid var(--border-svag)'
      }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

// QR i fuld skærm. På mobil er kortet for lille til at en anden telefon kan
// fange det på tværs af et bål — her fylder den hele skærmen.
export function Qrfuldskaerm({ vaerdi, luk }: { vaerdi: string; luk: () => void }) {
  useEffect(() => {
    const paaTast = (e: KeyboardEvent) => { if (e.key === 'Escape') luk(); };
    window.addEventListener('keydown', paaTast);
    return () => window.removeEventListener('keydown', paaTast);
  }, [luk]);

  return (
    <div
      onClick={luk}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 45,
        // Hvid baggrund hele vejen ud: telefonen skruer op for lyset, og
        // kontrasten bliver bedre end en kode i et mørkt hjørne.
        background: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '20px',
        padding: '24px',
        cursor: 'pointer'
      }}
    >
      <Qrkode vaerdi={vaerdi} storrelse={280} />
      <div style={{ fontSize: 'var(--skrift-knap)', color: '#555' }}>Tryk for at lukke</div>
    </div>
  );
}
