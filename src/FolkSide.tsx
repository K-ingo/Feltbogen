import Personer from './Personer';
import { Skal } from './Skal';
import type { Fane } from './Skal';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { Kort, SektionsTitel } from './ui';

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
      <section>
        <SektionsTitel>Personer</SektionsTitel>
        <Kort fremhaevet>
          <Personer />
        </Kort>
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
        De du tager afsted med. Bliver en deltager knyttet til en person, tælles turene
        sammen på tværs, og standardovernatningen udfyldes af sig selv. Du kan stadig
        skrive et navn direkte på en tur uden at oprette nogen her.
        <br /><br />
        Der gemmes kun navn, en valgfri e-mail og dine egne noter. Det bliver på enheden
        og i din egen konto — intet deles med tredjepart, og gæster på en tur ser kun
        navnet.
      </div>
    </Skal>
  );
}

export default FolkSide;
