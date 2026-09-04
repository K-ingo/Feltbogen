import { useState } from 'react';
import { opretKonto, logInd } from './pb';
import { loginFejlBesked, fejlDetaljer } from './pbFejl';
import { Knap, Label } from './ui';
import { layout } from './layout';

interface Props {
  // Appen kan bruges uden konto, så login kan fortrydes. Udelades den, er der
  // ingen vej tilbage — fx hvis skærmen en dag bruges som startpunkt igen.
  fortryd?: () => void;
  startTilstand?: 'login' | 'opret';
}

function AuthSide({ fortryd, startTilstand = 'login' }: Props) {
  const [tilstand, setTilstand] = useState<'login' | 'opret'>(startTilstand);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fejl, setFejl] = useState('');
  const [indlaeser, setIndlaeser] = useState(false);

  const handleSubmit = async () => {
    setFejl('');
    if (!email.trim() || !password) {
      setFejl('Udfyld email og password');
      return;
    }
    if (tilstand === 'opret' && password.length < 8) {
      setFejl('Password skal være mindst 8 tegn');
      return;
    }

    setIndlaeser(true);
    try {
      if (tilstand === 'opret') {
        await opretKonto(email.trim(), password);
      } else {
        await logInd(email.trim(), password);
      }
    } catch (e) {
      // Skærmen viser den korte udgave; konsollen får hele svaret. Uden det
      // står der kun "400 Bad Request" i netværksfanen, og så kan et login der
      // bliver ved med at fejle ikke fejlsøges bagefter.
      console.error(tilstand === 'opret' ? 'Kontooprettelse fejlede:' : 'Login fejlede:', fejlDetaljer(e));
      setFejl(loginFejlBesked(e));
    }
    setIndlaeser(false);
  };

  return (
    <div style={{
      ...layout.container,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      minHeight: '100vh',
      paddingBottom: '20px'
    }}>
      {fortryd && (
        <button
          onClick={fortryd}
          style={{ position: 'absolute', top: 'calc(16px + env(safe-area-inset-top))', left: '20px', background: 'transparent', border: 'none', fontSize: 'var(--skrift-brod)', cursor: 'pointer', color: 'var(--tekst-dæmpet)', padding: '4px' }}
        >
          ‹ Tilbage
        </button>
      )}

      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h1 style={{ fontSize: '36px', margin: 0 }}>Feltbogen</h1>
        <div style={{ fontSize: 'var(--skrift-knap)', color: 'var(--tekst-dæmpet)', marginTop: '4px' }}>
          {tilstand === 'login' ? 'Log ind for at synkronisere' : 'Opret din konto'}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '360px', margin: '0 auto', width: '100%' }}>
        <div>
          <Label htmlFor="login-email">Email</Label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="din@email.dk"
            autoComplete="email"
            style={{ width: '100%' }}
          />
        </div>

        <div>
          <Label htmlFor="login-password">Adgangskode</Label>
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder={tilstand === 'opret' ? 'Mindst 8 tegn' : ''}
            autoComplete={tilstand === 'opret' ? 'new-password' : 'current-password'}
            style={{ width: '100%' }}
          />
        </div>

        {fejl && (
          <div style={{
            padding: '10px 12px',
            background: 'var(--fejl-bg)',
            border: '1px solid var(--fejl-border)',
            color: 'var(--fejl)',
            borderRadius: '8px',
            fontSize: 'var(--skrift-knap)'
          }}>
            {fejl}
          </div>
        )}

        <Knap variant="primaer" onClick={handleSubmit} disabled={indlaeser} style={{ padding: '12px', fontSize: 'var(--skrift-brod)' }}>
          {indlaeser ? 'Vent...' : tilstand === 'login' ? 'Log ind' : 'Opret konto'}
        </Knap>

        <div style={{ fontSize: 'var(--skrift-lille)', color: 'var(--tekst-svag)', textAlign: 'center', lineHeight: 1.5 }}>
          Med en konto kan du synkronisere mellem enheder og gendanne dine data
          hvis din telefon bliver væk. Uden konto bliver alt liggende her.
        </div>

        <div style={{ textAlign: 'center', marginTop: '8px' }}>
          <button
            onClick={() => { setTilstand(tilstand === 'login' ? 'opret' : 'login'); setFejl(''); }}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--tekst-dæmpet)',
              fontSize: 'var(--skrift-knap)',
              textDecoration: 'underline',
              padding: '4px'
            }}
          >
            {tilstand === 'login' ? 'Har du ikke en konto? Opret én' : 'Har du allerede en konto? Log ind'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AuthSide;
