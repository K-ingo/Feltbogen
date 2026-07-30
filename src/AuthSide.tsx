import { useState } from 'react';
import { opretKonto, logInd } from './pb';
import { Knap, Label } from './ui';
import { layout } from './layout';

// Oversætter PocketBase-fejl til noget en bruger kan handle på.
function fejlBesked(e: unknown): string {
  const raa = e as { data?: { message?: string }; message?: string } | null;
  const besked = raa?.data?.message || raa?.message || 'Der skete en fejl';
  const lav = besked.toLowerCase();

  if (lav.includes('failed to authenticate')) return 'Forkert email eller password';
  if (lav.includes('already in use') || lav.includes('already exists')) {
    return 'Email er allerede registreret';
  }
  return besked;
}

function AuthSide() {
  const [tilstand, setTilstand] = useState<'login' | 'opret'>('login');
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
      setFejl(fejlBesked(e));
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
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h1 style={{ fontSize: '36px', margin: 0 }}>Feltbogen</h1>
        <div style={{ fontSize: '13px', color: 'var(--tekst-dæmpet)', marginTop: '4px' }}>
          {tilstand === 'login' ? 'Log ind for at fortsætte' : 'Opret din konto'}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '360px', margin: '0 auto', width: '100%' }}>
        <div>
          <Label>Email</Label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="din@email.dk"
            autoComplete="email"
            style={{ width: '100%' }}
          />
        </div>

        <div>
          <Label>Password</Label>
          <input
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
            fontSize: '13px'
          }}>
            {fejl}
          </div>
        )}

        <Knap variant="primaer" onClick={handleSubmit} disabled={indlaeser} style={{ padding: '12px', fontSize: '14px' }}>
          {indlaeser ? 'Vent...' : tilstand === 'login' ? 'Log ind' : 'Opret konto'}
        </Knap>

        <div style={{ textAlign: 'center', marginTop: '8px' }}>
          <button
            onClick={() => { setTilstand(tilstand === 'login' ? 'opret' : 'login'); setFejl(''); }}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--tekst-dæmpet)',
              fontSize: '13px',
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