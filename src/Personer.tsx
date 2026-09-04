import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, etiket, OVERNATNING } from './db';
import type { Overnatning, Person } from './db';
import { antalTurePrPerson, personprofil, ukendteNavne } from './personer';
import type { Personprofil } from './personer';
import { opretTomPerson } from './opret';
import { opdaterPerson, sletPerson } from './sync';
import { meldFortrydelse } from './fortryd';
import { Knap, Felt, Segment, Tekstomraade } from './ui';
import { kilo } from './talformat';

// Rejseselskabet. Selve listen — skærmen omkring den er FolkSide.
//
// Den lå før inde i indstillingerne, fordi personer blev regnet for noget man
// vedligeholder sjældent. Det holdt ikke: en tur med andre er en af de ting
// appen er til, og de mennesker man tager afsted med, er ikke en indstilling.
//
// Der gemmes kun navn, en valgfri e-mail og et par noter — se kommentaren på
// Person i db.ts om hvad det betyder for hvor dataene ender.
function Personer() {
  const personer = useLiveQuery(() => db.personer.toArray()) ?? [];
  const ture = useLiveQuery(() => db.ture.toArray()) ?? [];
  // Til den typiske vægt og det typiske gear. Vægten skal slås op pr. uid, og
  // det kan kun gøres mod inventaret.
  const items = useLiveQuery(() => db.items.toArray()) ?? [];
  const [aabenUid, setAabenUid] = useState<string | null>(null);
  const [nytNavn, setNytNavn] = useState('');

  const antal = antalTurePrPerson(ture);

  const sorteret = [...personer].sort((a, b) => {
    const forskel = (antal.get(b.uid) ?? 0) - (antal.get(a.uid) ?? 0);
    return forskel !== 0 ? forskel : a.navn.localeCompare(b.navn, 'da');
  });

  // Navne der er skrevet i hånden på turene, og som ingen person svarer til.
  // Det er dem der er værd at oprette — resten er gæt.
  const foreslaaede = ukendteNavne(ture, personer);

  const opret = async (navn: string) => {
    const rent = navn.trim();
    if (!rent) return;

    const id = await opretTomPerson({ navn: rent });
    const oprettet = await db.personer.get(id);
    setNytNavn('');
    if (oprettet) setAabenUid(oprettet.uid);
  };

  const fjern = async (person: Person) => {
    if (person.id === undefined) return;

    // Navnet står skrevet på turene som fritekst og bliver stående; det er
    // kun koblingen til kartoteket der forsvinder.
    const paaTure = antal.get(person.uid) ?? 0;
    const detalje = paaTure > 0
      ? `Navnet blev stående på ${paaTure} ${paaTure === 1 ? 'tur' : 'ture'}.`
      : undefined;

    const genskab = await sletPerson(person.id);
    if (genskab) meldFortrydelse({ slags: 'Personen', navn: person.navn, detalje, genskab });
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
        <input
          value={nytNavn}
          onChange={(e) => setNytNavn(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void opret(nytNavn); }}
          placeholder="Navn"
          style={{ flex: 1, minWidth: 0, fontSize: 'var(--skrift-knap)' }}
        />
        <Knap onClick={() => void opret(nytNavn)} disabled={!nytNavn.trim()}>+ Tilføj</Knap>
      </div>

      {foreslaaede.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: 'var(--skrift-lille)', color: 'var(--tekst-dæmpet)', marginBottom: '6px' }}>
            Navne fra dine ture der ikke er personer endnu
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {foreslaaede.map((navn) => (
              <button
                key={navn}
                onClick={() => void opret(navn)}
                style={{
                  padding: '5px 10px',
                  fontSize: 'var(--skrift-lille)',
                  background: 'var(--bg-forhoejet)',
                  color: 'var(--accent)',
                  border: '1px solid var(--accent-border)',
                  borderRadius: '14px',
                  cursor: 'pointer'
                }}
              >
                + {navn}
              </button>
            ))}
          </div>
        </div>
      )}

      {sorteret.length === 0 ? (
        <div style={{ fontSize: 'var(--skrift-knap)', color: 'var(--tekst-svag)' }}>
          Ingen endnu. Skriv dem ind, du tager afsted med — så husker Feltbogen,
          hvem der plejer at være med, og hvad de plejer at bære.
        </div>
      ) : (
        <div className="person-list">
          {sorteret.map((person) => (
            <Personraekke
              key={person.uid}
              person={person}
              ture={antal.get(person.uid) ?? 0}
              profil={personprofil(person, ture, items)}
              aaben={aabenUid === person.uid}
              skiftAaben={() => setAabenUid(aabenUid === person.uid ? null : person.uid)}
              opdater={(a) => person.id !== undefined && void opdaterPerson(person.id, a)}
              fjern={() => void fjern(person)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Personraekke({ person, ture, profil, aaben, skiftAaben, opdater, fjern }: {
  person: Person;
  ture: number;
  profil: Personprofil;
  aaben: boolean;
  skiftAaben: () => void;
  opdater: (aendringer: Partial<Person>) => void;
  fjern: () => void;
}) {
  return (
    <div className="person-card">
      <button
        onClick={skiftAaben}
        aria-expanded={aaben}
        style={{
          display: 'flex',
          width: '100%',
          alignItems: 'baseline',
          gap: '10px',
          padding: '9px 0',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          color: 'var(--tekst)'
        }}
      >
        <span className="person-avatar" aria-hidden="true">
          {(person.navn.trim()[0] ?? '?').toLocaleUpperCase('da-DK')}
        </span>
        <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--skrift-knap)' }}>{person.navn || 'Uden navn'}</span>
        <span style={{ fontSize: 'var(--skrift-lille)', color: 'var(--tekst-dæmpet)' }}>
          {/* "sammen" og ikke bare tallet: rækken står under et menneskes navn,
              og det er ikke personens ture, det er dem I har været på. */}
          {ture === 0 ? 'ingen ture endnu' : `${ture} ${ture === 1 ? 'tur' : 'ture'} sammen`}
        </span>
        <span style={{ color: 'var(--tekst-svag)', fontSize: 'var(--skrift-knap)' }}>{aaben ? '−' : '›'}</span>
      </button>

      {aaben && (
        <div style={{ display: 'grid', gap: '10px', padding: '2px 0 14px' }}>
          <Felt label="Navn" value={person.navn} onChange={(v) => opdater({ navn: v })} />
          <Felt
            label="E-mail"
            type="email"
            value={person.email}
            onChange={(v) => opdater({ email: v })}
            hjaelp="valgfri — til at sende delelinket"
          />

          <div>
            <div style={{ fontSize: 'var(--skrift-lille)', color: 'var(--tekst-dæmpet)', marginBottom: '6px' }}>
              Sover typisk i
            </div>
            <Segment
              vaerdier={OVERNATNING}
              valgt={person.standard_overnatning ?? ('' as Overnatning)}
              vaelg={(o) => opdater({
                // Et tryk på den der allerede er valgt slår den fra igen —
                // ellers kunne man ikke komme tilbage til "ved ikke".
                standard_overnatning: person.standard_overnatning === o ? null : o
              })}
              formater={(o) => etiket(o)}
              kompakt
            />
          </div>

          <Tekstomraade
            label="Noter"
            value={person.noter}
            onChange={(v) => opdater({ noter: v })}
            raekker={2}
          />

          <Profil profil={profil} />

          <div>
            <Knap variant="fare" onClick={fjern}>Slet person</Knap>
          </div>
        </div>
      )}
    </div>
  );
}

// Hvad turene siger om en person.
//
// Specens §17 vil have turhistorik, typisk gear og typisk vægt på
// persondetaljen. Alle tre er udledt af turene og gemmes ikke: personen ejer
// ingen af delene, det er turene der gør.
//
// Aktive invitationer er ikke med. Specen nævner dem, men appen har ingen:
// deling er et gæstelink på en tur, ikke en indbydelse til en person, og
// linket kan gives videre til hvem som helst. At kalde et turlink for "Emils
// invitation" ville være en påstand om, hvem der har det.
function Profil({ profil }: { profil: Personprofil }) {
  if (profil.ture.length === 0) {
    return (
      <div style={{ fontSize: 'var(--skrift-lille)', color: 'var(--tekst-svag)' }}>
        Ingen ture sammen endnu. Skriv personen på en tur, så samles historikken her.
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 'var(--plads-3)' }}>
      {profil.baerer && (
        <div style={{ fontSize: 'var(--skrift-detalje)', color: 'var(--tekst-dæmpet)' }}>
          Bærer typisk{' '}
          <span style={{ color: 'var(--tekst)' }}>
            {kilo(profil.baerer.snit_g, 1)} kg
          </span>
          {' '}— snit over {profil.baerer.ture}{' '}
          {profil.baerer.ture === 1 ? 'tur hvor grejet var fordelt' : 'ture hvor grejet var fordelt'}
        </div>
      )}

      {profil.typiskGear.length > 0 && (
        <div>
          <div style={{ fontSize: 'var(--skrift-lille)', color: 'var(--tekst-dæmpet)', marginBottom: 'var(--plads-1)' }}>
            Har typisk med
          </div>
          <div style={{ display: 'grid', gap: '2px' }}>
            {profil.typiskGear.map(({ item, ture }) => (
              <div
                key={item.uid}
                style={{
                  display: 'flex',
                  gap: 'var(--plads-2)',
                  fontSize: 'var(--skrift-detalje)',
                  color: 'var(--tekst)'
                }}
              >
                <span style={{ flex: 1, minWidth: 0 }}>{item.navn}</span>
                <span style={{ color: 'var(--tekst-dæmpet)', whiteSpace: 'nowrap' }}>
                  {ture} af {profil.ture.length}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div style={{ fontSize: 'var(--skrift-lille)', color: 'var(--tekst-dæmpet)', marginBottom: 'var(--plads-1)' }}>
          Ture sammen
        </div>
        <div style={{ display: 'grid', gap: '2px' }}>
          {profil.ture.map((tur) => (
            <div
              key={tur.uid}
              style={{ display: 'flex', gap: 'var(--plads-2)', fontSize: 'var(--skrift-detalje)' }}
            >
              <span style={{ flex: 1, minWidth: 0 }}>{tur.navn || 'Uden navn'}</span>
              <span style={{ color: 'var(--tekst-dæmpet)', whiteSpace: 'nowrap' }}>
                {tur.startdato || '—'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Personer;
