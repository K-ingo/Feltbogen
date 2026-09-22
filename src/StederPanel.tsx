import type { Sted, Tur } from './db';
import { db } from './db';
import { formatterPeriode } from './datotekst';
import { stederFraTure } from './friluftshistorik';
import type { Turstede } from './friluftshistorik';
import { besoegPrSted, besoegstekst, sorterEfterBesoeg } from './steder';
import { opretTomtSted } from './opret';
import { opdaterTur } from './sync';
import { Knap } from './ui';

interface Props {
  ture: Tur[];
  steder: Sted[];
  aabnSted: (id: number) => void;
  nytSted: () => void;
}

// Steder-panelet i friluftshistorikken.
//
// Skærmen hed før bare «Steder» og viste kun de steder, man havde gemt. Havde
// man tre ture med et stednavn på og ingen gemte steder, stod den tom — og
// Mere-rækken sagde "0 steder". Det var teknisk rigtigt og praktisk forkert:
// stederne var der, de stod bare i turene.
//
// Nu er listen turenes egne steder, og «Gem» er det, der gør et af dem til en
// favorit. Favoritterne er præcis det, Mere-rækken tæller — se MereSide.tsx.
// Referencen: docs/design/desktop/09-steder-statistik.html.
function StederPanel({ ture, steder, aabnSted, nytSted }: Props) {
  const fraTure = stederFraTure(ture, steder);
  const besoeg = besoegPrSted(ture);
  const favoritter = sorterEfterBesoeg(steder, ture);

  return (
    <div className="hist-panel">
      <div className="hist-kort">
        <p className="hist-label">Fra dine ture</p>
        <p className="hist-info-tekst">{fraTureTekst(fraTure.length)}</p>
      </div>

      {fraTure.map((sted) => (
        <Stedkort key={sted.noegle} sted={sted} aabnSted={aabnSted} />
      ))}

      {favoritter.length === 0 ? (
        <div className="hist-tom">
          <p className="hist-tom-titel">Favoritter du kommer tilbage til</p>
          <p className="hist-tom-tekst">
            Ingen gemt endnu. Tryk Gem på et sted — det er dem, Mere-rækken tæller.
          </p>
        </div>
      ) : (
        <div className="hist-kort hist-kort--liste">
          <div className="hist-liste-hoved">
            <p className="hist-label">Favoritter du kommer tilbage til</p>
          </div>
          <ul className="hist-liste">
            {favoritter.map((sted) => (
              <li key={sted.uid}>
                <button
                  type="button"
                  className="hist-liste-raekke"
                  onClick={() => sted.id !== undefined && aabnSted(sted.id)}
                >
                  <span>{sted.navn || 'Uden navn'}</span>
                  <span className="hist-liste-hoejre">{besoegstekst(besoeg.get(sted.uid) ?? 0)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Et sted, man ikke har været endnu — shelteret man har set på kortet.
          Det er ikke skærmens ærinde, så den står som tekst og ikke som en
          knap med flade på: fanebladene er den ene fyldte accent. */}
      <div>
        <Knap variant="tekst" onClick={nytSted}>+ Nyt sted</Knap>
      </div>
    </div>
  );
}

function fraTureTekst(antal: number): string {
  if (antal === 0) return 'Ingen af dine ture har et sted på endnu. Skriv stedet på en tur, så står det her.';
  return `${antal} ${antal === 1 ? 'sted' : 'steder'} · hentet fra turenes eget stedfelt`;
}

// Ét sted, som turene kender det. Er det allerede gemt, kan kortet åbnes; er
// det kun fritekst endnu, er der ingen detalje at gå ind i — og så er «Gem»
// det, kortet kan.
function Stedkort({ sted, aabnSted }: { sted: Turstede; aabnSted: (id: number) => void }) {
  const tekst = (
    <>
      <h2 className="hist-sted-navn">{sted.navn}</h2>
      <p className="hist-sted-meta">{metatekst(sted)}</p>
      <p className="hist-sted-tal">
        {taltekst(sted)}
        {sted.kladder > 0 && (
          <> · <span className="hist-kladde">{kladdetekst(sted.kladder)}</span></>
        )}
      </p>
    </>
  );

  return (
    <div className="hist-kort hist-sted">
      {sted.gemt_id !== null ? (
        <button type="button" className="hist-sted-tekst" onClick={() => aabnSted(sted.gemt_id!)}>
          {tekst}
        </button>
      ) : (
        <div className="hist-sted-tekst">{tekst}</div>
      )}

      {sted.gemt_uid ? (
        <span className="hist-gemt">Gemt</span>
      ) : (
        <button type="button" className="hist-gem" onClick={() => void gemSted(sted)}>
          Gem
        </button>
      )}
    </div>
  );
}

// «Gem» laver stedet og kobler turene til det.
//
// Koblingen er det egentlige arbejde. Uden den ville stedet stå i bogen uden
// sin egen historik — man gemmer Fovslet Skov, åbner det, og får at vide at
// man aldrig har været der. Fritekstfeltet på turen bliver stående: det er
// stadig det, man skrev, og koblingen kan tages af igen inde på turen.
async function gemSted(sted: Turstede): Promise<void> {
  const id = await opretTomtSted({ navn: sted.navn, adresse: sted.adresse });
  const oprettet = await db.steder.get(id);
  if (!oprettet) return;

  for (const turId of sted.tur_ids) {
    await opdaterTur(turId, { sted_uid: oprettet.uid });
  }
}

function metatekst(sted: Turstede): string {
  const sidst = formatterPeriode(sted.sidste_start, sted.sidste_slut);

  return [...sted.tags, sted.adresse, sidst && `sidst ${sidst}`]
    .filter(Boolean)
    .join(' · ');
}

function taltekst(sted: Turstede): string {
  const ture = `${sted.ture} ${sted.ture === 1 ? 'tur' : 'ture'}`;
  const naetter = `${sted.naetter} ${sted.naetter === 1 ? 'nat' : 'nætter'}`;

  return sted.ture === 1 ? `${ture} · ${naetter}` : `${ture} · ${naetter} i alt`;
}

// Kladder tæller med i besøgene — man har været der — men tallene bagved er
// ikke gjort færdige, og det skal kunne ses.
function kladdetekst(antal: number): string {
  return antal === 1 ? 'kladde' : `${antal} kladder`;
}

export default StederPanel;
