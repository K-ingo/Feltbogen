import Personer from './Personer.tsx';
import { Skal } from './Skal';
import type { Fane } from './Skal';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { SektionsTitel } from './ui';
import { Ikon } from './Ikon';

interface Props {
  fane: Fane;
  skift: (f: Fane) => void;
}

// Rejseselskabet.
//
// Personer lå før inde i indstillingerne, fordi de blev regnet for noget man
// vedligeholder sjældent. Det var forkert: en tur med andre er en af de ting
// Feltbogen er til, og de mennesker man tager afsted med, er ikke en
// indstilling. Nu står de i navigationen ved siden af turene og grejet.
//
// Skærmen er tynd med vilje. Selve deltagerne hører til på turene, og
// invitationerne er gæstelinks, der også hører til dér. Her står kartoteket:
// hvem de er, og hvor mange ture man har været på sammen.
function FolkSide({ fane, skift }: Props) {
  const personer = useLiveQuery(() => db.personer.toArray()) ?? [];

  return (
    <Skal
      fane={fane}
      skift={skift}
      titel="Folk"
      undertitel={`${personer.length} ${personer.length === 1 ? 'person' : 'personer'}`}
    >
      <section className="people-intro">
        <div className="people-intro-icon"><Ikon navn="folk" size={28} /></div>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Dit turhold</h2>
          <div style={{ marginTop: '3px', color: 'var(--tekst-dæmpet)', fontSize: 'var(--skrift-detalje)', lineHeight: 1.5 }}>
            Se hvem du oftest tager afsted med, og hvad I plejer at have med.
          </div>
        </div>
      </section>

      <section>
        <SektionsTitel>Personer</SektionsTitel>
        <Personer />
      </section>

      <div style={{
        fontSize: 'var(--skrift-detalje)',
        color: 'var(--tekst-svag)',
        lineHeight: 1.6,
        marginTop: 'var(--plads-4)',
        // Skallen giver 1600 px på en bred skærm. En brødtekst der løber hele
        // vejen ud, er svær at følge tilbage til næste linjes begyndelse.
        maxWidth: '68ch'
      }}>
        Du kan stadig skrive et navn direkte på en tur uden at oprette personen her.
        Kun navn, en valgfri e-mail og dine egne noter gemmes; gæster ser kun navnet.
      </div>
    </Skal>
  );
}

export default FolkSide;
