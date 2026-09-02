import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import type { Tur } from './db';
import { etiket } from './db';
import { hero } from './billeder';
import { Billedvisning } from './BilledSektion';
import { TitelInput } from './ui';
import { useErDesktop } from './useMedie';
import { formatterPeriode } from './datotekst';

// Toppen af en tur.
//
// Turen begyndte som en formular: et navnefelt, en datolinje og femten
// foldbare sektioner under den. Alt hvad man havde brug for stod der, men
// skærmen sagde det samme om en tur man kom hjem fra i går som om en, der
// ikke er andet end en dato endnu.
//
// Båndet her er turens billede — det, der allerede er valgt som forside, og
// som turlisten, gæstevisningen og den trykte feltbog har vist hele tiden.
// Turskærmen var det eneste sted, det ikke stod.
//
// Navnet kan stadig rettes, og det rettes samme sted som det læses. Et felt
// under båndet ville betyde, at turens navn stod to gange på skærmen — én
// gang til at læse og én gang til at skrive i — og så er det ikke længere
// tydeligt, hvad man kigger på.
function Turhero({ tur, opdaterNavn, autoFokus }: {
  tur: Tur;
  opdaterNavn: (navn: string) => void;
  autoFokus?: boolean;
}) {
  const erDesktop = useErDesktop();
  const billeder = useLiveQuery(() => db.billeder.toArray()) ?? [];
  const forside = hero(billeder, tur);

  const detaljer = [
    formatterPeriode(tur.startdato, tur.slutdato),
    tur.sted,
    tur.deltagere.length > 0
      ? `${tur.deltagere.length} ${tur.deltagere.length === 1 ? 'deltager' : 'deltagere'}`
      : `${tur.personer} ${tur.personer === 1 ? 'person' : 'personer'}`,
    etiket(tur.aktivitet)
  ].filter(Boolean);

  return (
    <div style={{
      position: 'relative',
      // Ikke et fast forhold. Et billede taget på højkant ville ellers
      // beskære sig selv til en strimmel, og båndet skal kunne læses på en
      // telefon uden at æde den halve skærm.
      //
      // Lavere uden et billede. Båndet skal give plads til et fotografi når
      // der er et, men uden et er der ikke noget at give plads til — og et
      // højt felt grøn farve lover et billede, der ikke kommer.
      minHeight: forside
        ? (erDesktop ? '230px' : '190px')
        : (erDesktop ? '170px' : '150px'),
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end',
      borderRadius: 'var(--runding)',
      overflow: 'hidden',
      marginBottom: 'var(--plads-4)',
      background: `linear-gradient(160deg, var(--hero-bund), var(--hero-top))`
    }}>
      {forside ? (
        <>
          <div style={{ position: 'absolute', inset: 0 }}>
            <Billedvisning billede={forside} />
          </div>
          {/* Uden skyggen kan titlen forsvinde i en lys himmel eller en
              sandstrand. Den ligger nederst, hvor teksten står, og lader
              resten af billedet være. */}
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to top, rgba(20, 26, 16, 0.82) 0%, rgba(20, 26, 16, 0.35) 45%, rgba(20, 26, 16, 0) 78%)'
          }} />
        </>
      ) : (
        <Hoejdekurver />
      )}

      <div style={{ position: 'relative', padding: 'var(--plads-4)' }}>
        <TitelInput
          value={tur.navn}
          onChange={opdaterNavn}
          placeholder="Navn på tur"
          autoFokus={autoFokus}
          lys
        />
        <div style={{
          fontSize: 'var(--skrift-detalje)',
          color: 'var(--paa-billede-dæmpet)',
          textShadow: '0 1px 10px rgba(0, 0, 0, 0.5)',
          marginTop: '2px'
        }}>
          {detaljer.length > 0 ? detaljer.join(' · ') : 'Ingen datoer valgt'}
        </div>
      </div>
    </div>
  );
}

// Båndet når turen ingen billeder har.
//
// Alternativet var en grå pladsholder med et kameraikon, og den siger kun én
// ting: her mangler noget. En tur, der ikke er taget endnu, mangler ikke et
// billede — den har bare ikke været nogen steder endnu.
//
// Kurverne er tegnet og ikke hentet: det er otte streger, og en fil til dem
// ville skulle hentes over et net, appen er bygget til at undvære.
function Hoejdekurver() {
  return (
    <svg
      viewBox="0 0 1200 400"
      preserveAspectRatio="none"
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
    >
      {/* Hver kurve er den samme form skubbet ned og strakt en anelse, som
          højdekurver på et kort ligger uden om den samme top. */}
      {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => (
        <path
          key={n}
          d={kurve(30 + n * 48, 1 + n * 0.12)}
          fill="none"
          stroke="var(--hero-streg)"
          strokeWidth={1.5}
        />
      ))}
    </svg>
  );
}

// En blød bakke tværs over båndet. `y` er hvor den ligger, `bredde` hvor
// meget den bugter sig — de yderste kurver er fladere end de inderste, som de
// er det på et kort.
function kurve(y: number, bredde: number): string {
  const h = 34 * bredde;
  return [
    `M -20 ${y + h * 0.6}`,
    `C 180 ${y - h * 0.5}, 300 ${y + h}, 500 ${y + h * 0.2}`,
    `C 700 ${y - h * 0.7}, 830 ${y + h * 0.9}, 1020 ${y + h * 0.1}`,
    `C 1120 ${y - h * 0.3}, 1180 ${y + h * 0.4}, 1220 ${y}`
  ].join(' ');
}

export default Turhero;
