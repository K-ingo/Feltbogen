import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, etiket, OVERNATNING } from './db';
import type { Overnatning, Person } from './db';
import { antalTurePrPerson, ukendteNavne } from './personer';
import { opretTomPerson } from './opret';
import { opdaterPerson, sletPerson } from './sync';
import { meldSletning } from './fortryd';
import { Knap, Felt, Segment, Tekstomraade } from './ui';

// Rejseselskabet. Personer bor i indstillingerne og ikke i en fane for sig:
// man vedligeholder dem sjældent, og de bruges inde på turene.
//
// Der gemmes kun navn, en valgfri e-mail og et par noter — se kommentaren på
// Person i db.ts om hvad det betyder for hvor dataene ender.
function Personer() {
  const personer = useLiveQuery(() => db.personer.toArray()) ?? [];
  const ture = useLiveQuery(() => db.ture.toArray()) ?? [];
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
    if (genskab) meldSletning({ slags: 'Personen', navn: person.navn, detalje, genskab });
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
        <input
          value={nytNavn}
          onChange={(e) => setNytNavn(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void opret(nytNavn); }}
          placeholder="Navn"
          style={{ flex: 1, minWidth: 0, fontSize: '13px' }}
        />
        <Knap onClick={() => void opret(nytNavn)} disabled={!nytNavn.trim()}>+ Tilføj</Knap>
      </div>

      {foreslaaede.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '11px', color: 'var(--tekst-dæmpet)', marginBottom: '6px' }}>
            Navne fra dine ture der ikke er personer endnu
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {foreslaaede.map((navn) => (
              <button
                key={navn}
                onClick={() => void opret(navn)}
                style={{
                  padding: '5px 10px',
                  fontSize: '11px',
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
        <div style={{ fontSize: '13px', color: 'var(--tekst-svag)' }}>
          Ingen personer endnu. Tilføj dem du tager afsted med.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '2px' }}>
          {sorteret.map((person) => (
            <Personraekke
              key={person.uid}
              person={person}
              ture={antal.get(person.uid) ?? 0}
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

function Personraekke({ person, ture, aaben, skiftAaben, opdater, fjern }: {
  person: Person;
  ture: number;
  aaben: boolean;
  skiftAaben: () => void;
  opdater: (aendringer: Partial<Person>) => void;
  fjern: () => void;
}) {
  return (
    <div style={{ borderBottom: '1px solid var(--border-svag)' }}>
      <button
        onClick={skiftAaben}
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
        <span style={{ flex: 1, minWidth: 0, fontSize: '13px' }}>{person.navn || 'Uden navn'}</span>
        <span style={{ fontSize: '11px', color: 'var(--tekst-dæmpet)' }}>
          {ture === 0 ? 'ingen ture' : `${ture} ${ture === 1 ? 'tur' : 'ture'}`}
        </span>
        <span style={{ color: 'var(--tekst-svag)', fontSize: '13px' }}>{aaben ? '−' : '+'}</span>
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
            <div style={{ fontSize: '11px', color: 'var(--tekst-dæmpet)', marginBottom: '6px' }}>
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

          <div>
            <Knap variant="fare" onClick={fjern}>Slet person</Knap>
          </div>
        </div>
      )}
    </div>
  );
}

export default Personer;
