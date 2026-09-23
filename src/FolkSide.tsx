import Personer from './Personer.tsx';
import { Skal } from './Skal';
import type { Fane } from './Skal';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { Ikon } from './Ikon';
import { useErDesktop } from './useMedie';

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
//
// PC-udgaven følger `docs/design/desktop/07-folk.html`: titel, et roligt
// introkort, og derunder kartoteket. Referencen tegner ikke én eneste fyldt
// knap — den eneste, skærmen har, er "+ Tilføj", og den tænder først, når der
// står et navn i feltet. Alt andet er outline eller tekst.
function FolkSide({ fane, skift }: Props) {
  const personer = useLiveQuery(() => db.personer.toArray()) ?? [];
  const erDesktop = useErDesktop();
  const antal = `${personer.length} ${personer.length === 1 ? 'person' : 'personer'}`;

  return (
    // Telefonen har sin egen header efter docs/design/mobile/04-folk.html:
    // titel og antal i indholdet, ingen topbar, som på Ture og Grej. Der er
    // ingen knap i den — "+ Tilføj" ved navnefeltet er skærmens eneste, og den
    // er slået fra, til der står et navn.
    <Skal
      fane={fane}
      skift={skift}
      titel={erDesktop ? 'Folk' : undefined}
      undertitel={erDesktop ? antal : undefined}
    >
      {!erDesktop && (
        <header className="folk-mobil-hoved">
          <h1>Folk</h1>
          <p>{antal}</p>
        </header>
      )}
      <section className="people-intro">
        <div className="people-intro-icon" aria-hidden="true"><Ikon navn="folk" size={20} /></div>
        <div>
          <h2>Dit turhold</h2>
          {/* Sætningen om at skrive navne direkte på en tur stod før nederst
              på siden, hvor den forklarede noget, man for længst havde taget
              stilling til. Den hører her: det er det, man skal vide, før man
              begynder at oprette folk. */}
          <p>
            Se hvem du oftest tager afsted med, og hvad I plejer at have med.
            Navne kan også skrives direkte på en tur.
          </p>
        </div>
      </section>

      <Personer />

      <div style={{
        fontSize: 'var(--skrift-mikro)',
        color: 'var(--tekst-svag)',
        lineHeight: 1.6,
        marginTop: 'var(--plads-6)',
        // Skallen giver 1024 px på en bred skærm. En brødtekst der løber hele
        // vejen ud, er svær at følge tilbage til næste linjes begyndelse.
        maxWidth: '68ch'
      }}>
        Kun navn, en valgfri e-mail og dine egne noter gemmes; gæster ser kun navnet.
      </div>
    </Skal>
  );
}

export default FolkSide;
