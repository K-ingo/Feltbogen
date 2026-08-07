import { useEffect, useState } from 'react';
import { hentTurkort, kortlink, returtekst, erOverskredet } from './turkort';
import type { Turkortsnapshot } from './turkort';
import { formatterPeriode } from './datotekst';

interface Props {
  token: string;
}

// Det den pårørende ser. Ingen konto, ingen app, ingen navigation videre ind i
// Feltbogen — kun de fire ting hun skal bruge, hvis han ikke er hjemme til
// tiden: hvor han er, hvornår han burde være tilbage, hvad han selv har
// skrevet, og et link til et kort.
function TurkortSide({ token }: Props) {
  const [tilstand, setTilstand] = useState<'henter' | 'ok' | 'ikke_fundet' | 'fejl'>('henter');
  const [kort, setKort] = useState<Turkortsnapshot | null>(null);

  useEffect(() => {
    let aktiv = true;

    void hentTurkort(token).then((svar) => {
      if (!aktiv) return;
      setTilstand(svar.slags);
      if (svar.slags === 'ok') setKort(svar.snapshot);
    });

    return () => { aktiv = false; };
  }, [token]);

  if (tilstand === 'henter') return <Ramme><Besked>Henter turkortet…</Besked></Ramme>;

  if (tilstand === 'fejl') {
    return (
      <Ramme>
        <Besked>
          Kunne ikke få fat i turkortet. Prøv igen om lidt — det kan være forbindelsen.
        </Besked>
      </Ramme>
    );
  }

  if (tilstand === 'ikke_fundet' || !kort) {
    return (
      <Ramme>
        <Besked>
          Turkortet findes ikke længere. Enten er linket forkert, eller også har afsenderen
          trukket det tilbage.
        </Besked>
      </Ramme>
    );
  }

  const overskredet = erOverskredet(kort);

  return (
    <Ramme>
      <div style={{ fontSize: '11px', letterSpacing: '1.4px', textTransform: 'uppercase', color: 'var(--tekst-svag)', marginBottom: '10px' }}>
        Turkort
      </div>

      <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: '26px', margin: '0 0 4px' }}>
        {kort.navn || 'Uden navn'}
      </h1>
      <div style={{ fontSize: '13px', color: 'var(--tekst-dæmpet)', marginBottom: '22px' }}>
        {formatterPeriode(kort.startdato, kort.slutdato) || 'Ingen datoer oplyst'}
      </div>

      {/* Statuslinjen er det første øjet skal falde på: er han hjemme, eller
          er det nu man skal begynde at ringe? */}
      <Status udloebet={kort.udloebet} overskredet={overskredet} />

      <Felt titel="Forventet hjemme">
        {returtekst(kort.forventet_retur)}
      </Felt>

      <Felt titel="Sted">
        <div>{kort.sted || 'Ikke oplyst'}</div>
        {kort.koordinater && (
          <>
            <div style={{ fontSize: '13px', color: 'var(--tekst-dæmpet)', marginTop: '3px' }}>
              {kort.koordinater.lat}, {kort.koordinater.lng}
            </div>
            <a
              href={kortlink(kort.koordinater)}
              target="_blank"
              rel="noreferrer"
              style={{ display: 'inline-block', marginTop: '8px', fontSize: '13px', color: 'var(--accent)' }}
            >
              Åbn på kort →
            </a>
          </>
        )}
      </Felt>

      {kort.besked && <Felt titel="Besked">{kort.besked}</Felt>}

      <div style={{ fontSize: '11px', color: 'var(--tekst-svag)', marginTop: '30px', lineHeight: 1.6 }}>
        Kortet er et øjebliksbillede lavet {returtekst(kort.lavet_den)} og opdaterer sig ikke selv.
        Det er ikke en live-position — det viser hvor turen var planlagt til at gå hen.
      </div>
    </Ramme>
  );
}

function Status({ udloebet, overskredet }: { udloebet: boolean; overskredet: boolean }) {
  if (udloebet) {
    return (
      <Baand farve="var(--succes)" baggrund="var(--accent-bg)" kant="var(--accent-border)">
        Turen er markeret som afsluttet. Han er kommet hjem.
      </Baand>
    );
  }

  if (overskredet) {
    return (
      <Baand farve="var(--advarsel)" baggrund="var(--advarsel-bg)" kant="var(--advarsel-border)">
        Tidspunktet for hjemkomst er passeret, og turen står stadig som i gang.
        Prøv at ringe.
      </Baand>
    );
  }

  return (
    <Baand farve="var(--tekst-dæmpet)" baggrund="var(--bg-forhoejet)" kant="var(--border-svag)">
      Turen er i gang.
    </Baand>
  );
}

function Baand({ farve, baggrund, kant, children }: {
  farve: string;
  baggrund: string;
  kant: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{
      padding: '11px 13px',
      borderRadius: '10px',
      background: baggrund,
      border: `1px solid ${kant}`,
      color: farve,
      fontSize: '13px',
      lineHeight: 1.5,
      marginBottom: '22px'
    }}>
      {children}
    </div>
  );
}

function Felt({ titel, children }: { titel: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: '18px' }}>
      <div style={{
        fontSize: '10px',
        letterSpacing: '1px',
        textTransform: 'uppercase',
        color: 'var(--tekst-dæmpet)',
        fontWeight: 600,
        marginBottom: '4px'
      }}>
        {titel}
      </div>
      <div style={{ fontSize: '15px', lineHeight: 1.55 }}>{children}</div>
    </section>
  );
}

function Ramme({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      maxWidth: '520px',
      margin: '0 auto',
      padding: 'calc(28px + env(safe-area-inset-top)) 20px calc(40px + env(safe-area-inset-bottom))'
    }}>
      {children}
    </div>
  );
}

function Besked({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: '14px', color: 'var(--tekst-dæmpet)', lineHeight: 1.6, paddingTop: '40px' }}>
      {children}
    </div>
  );
}

export default TurkortSide;
