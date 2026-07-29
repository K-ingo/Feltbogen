import { useState } from 'react';
import { opretKonto, logInd } from './pb';
import { Knap, layout } from './ui';

interface Props {
  onLoggetInd: () => void;
}

function AuthSide({ onLoggetInd }: Props) {
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
      onLoggetInd();
    } catch (e: any) {
      const besked = e?.data?.message || e?.message || 'Der skete en fejl';
      if (besked.toLowerCase().includes('failed to authenticate')) {
        setFejl('Forkert email eller password');
      } else if (besked.toLowerCase().includes('already in use') || besked.toLowerCase().includes('already exists')) {
        setFejl('Email er allerede registreret');
      } else {
        setFejl(besked);
      }
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
          <label style={{ display: 'block', fontSize: '11px', color: 'var(--tekst-dæmpet)', marginBottom: '5px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Email
          </label>
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
          <label style={{ display: 'block', fontSize: '11px', color: 'var(--tekst-dæmpet)', marginBottom: '5px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Password
          </label>
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