import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import type { Gruppe, Item, Reference, Tur } from './db';
import { Skal } from './Skal';
import type { Fane } from './Skal';
import { Ark } from './Ark';
import { Badge, Knap, ListeRaekke, TagChips, TomListe } from './ui';
import { useErDesktop } from './useMedie';
import { opdaterTur, opretGruppe } from './sync';
import { kilo } from './talformat';
import {
  saetindhold, saetlinje, sidstBrugtPrSaet, vaegttekst, delingstekst,
  indlaesning, indlaesningstekst, medSaet, saetFraTur, tureTilValg,
  turlinje, turnavn
} from './grejsaet';
import type { Saetindhold } from './grejsaet';

// ─────────────────────────────────────────────
// Grejsæt · PC
//
// Efter handoff'en "Ejer Grejsæt · desktop" (16. sep 2026) og den visuelle
// reference i `docs/design/desktop/06-grejsaet.html`.
//
// Skærmen var en almindelig liste: navn, antal, vægt. Referencen deler den i
// to — sættene til venstre, det valgte sæts indhold til højre — fordi det er
// dét, man står og gør: sammenligner to pakninger og vælger den, der passer
// til turen. Med en liste alene skulle man ind i hvert sæt for at se, hvad
// der var i det, og ud igen for at se det næste.
//
// Den ene regel, der bar resten: **maks én fyldt accent pr. skærmbillede**
// (`docs/design/TOKENS.md`). Referencen tegner både "Nyt sæt" og "Brug på
// tur" fyldt, og det er to. "Brug på tur" er den, der vinder: et sæt findes
// for at blive brugt, og handoff'en kalder den skærmens primære. "Nyt sæt"
// er outline, "Rediger" er tekst, "Opret fra tur" er et link. Er der intet
// sæt at bruge, er der ingen primær handling i detaljen, og så er "Nyt sæt"
// den fyldte — ellers ville skærmen stå uden en vej frem.
// ─────────────────────────────────────────────

interface Props {
  fane: Fane;
  skift: (f: Fane) => void;
  aabnGruppe: (id: number, nyOprettet?: boolean) => void;
  nyGruppe: () => void;
}

// Hvilket ark der ligger over skærmen. Begge er tur-valg, og begge gør først
// noget, når man trykker på den primære knap — jf. CTA-reglerne.
type ArkSlags = 'brug' | 'fra-tur';

function GrupperListe({ fane, skift, aabnGruppe, nyGruppe }: Props) {
  const erDesktop = useErDesktop();
  const grupper = useLiveQuery(() => db.grupper.toArray()) ?? [];
  const items = useLiveQuery(() => db.items.toArray()) ?? [];
  const ture = useLiveQuery(() => db.ture.toArray()) ?? [];

  const [valgtUid, setValgtUid] = useState<Reference | null>(null);
  const [ark, setArk] = useState<ArkSlags | null>(null);
  // Kvitteringen for det, der lige skete. Uden den forsvinder arket bare, og
  // man står tilbage uden at vide, om sættet kom med på turen.
  const [kvittering, setKvittering] = useState('');

  const sidstBrugt = sidstBrugtPrSaet(ture);

  // Det valgte sæt udledes frem for at blive holdt ved lige: forsvinder sættet
  // — slettet på en anden enhed — falder valget tilbage på det første, i
  // stedet for at detaljen står tom uden at nogen har gjort noget.
  const valgt = grupper.find((g) => g.uid === valgtUid) ?? grupper[0];
  const valgtIndhold = valgt ? saetindhold(valgt, items) : null;
  // Et tomt sæt kan ikke bruges på en tur. Så er "Brug på tur" ikke skærmens
  // primære handling, og den fyldte accent tilfalder "Nyt sæt".
  const kanBruges = valgtIndhold !== null && valgtIndhold.antal > 0;

  const vaelg = (gruppe: Gruppe) => {
    setValgtUid(gruppe.uid);
    setKvittering('');
  };

  const rediger = () => {
    if (valgt?.id !== undefined) aabnGruppe(valgt.id);
  };

  const indlaesPaaTur = async (tur: Tur) => {
    if (!valgt || tur.id === undefined) return;
    await opdaterTur(tur.id, { gruppe_ids: medSaet(tur, valgt) });
    setArk(null);
    setKvittering(`«${valgt.navn || 'Sættet'}» er lagt på ${turnavn(tur)}. Det står nu under turens Pakning.`);
  };

  const opretFraTur = async (tur: Tur) => {
    const nu = new Date();
    const id = await opretGruppe({
      // Turens navn er et brugbart sætnavn — det er den pakning, sættet er.
      // Det kan rettes med det samme, fordi sættet åbnes bagefter.
      navn: turnavn(tur),
      tags: [],
      item_ids: saetFraTur(tur, grupper, items),
      noter: '',
      oprettet: nu,
      aendret: nu
    });
    setArk(null);
    // Ikke `ny`: sættet har et navn og skal ikke ryddes op, hvis man fortryder
    // og går tilbage. Se oprydningen i `lukDetalje` i App.tsx.
    aabnGruppe(id);
  };

  // Den stiplede kasse er den anden vej ind: et sæt behøver ikke bygges fra
  // bunden, når man allerede har pakket turen én gang. Den står under listen
  // — også når der er sæt — og er derfor sin egen del, så telefonen kan få
  // den uden at få PC'ens sætkort med.
  const fraTurKort = (
    <div className="sets-tom-kort">
      <p className="sets-tom-titel">{grupper.length === 0 ? 'Ingen sæt endnu?' : 'Tomt sæt?'}</p>
      <p className="sets-tom-tekst">
        Opret et sæt fra en tur, du allerede har pakket — eller start blankt med Nyt sæt.
      </p>
      <Knap
        variant="tekst"
        onClick={() => { setKvittering(''); setArk('fra-tur'); }}
        style={{ padding: 0, color: 'var(--accent)' }}
      >
        Opret fra tur →
      </Knap>
    </div>
  );

  const saetliste = (
    <div className="sets-list">
      {grupper.map((gruppe) => {
        const indhold = saetindhold(gruppe, items);
        const erValgt = valgt?.uid === gruppe.uid;

        return (
          <button
            key={gruppe.uid}
            type="button"
            className="set-card"
            aria-pressed={erValgt}
            onClick={() => vaelg(gruppe)}
          >
            <span className="set-card-tekst">
              <span className="set-card-navn">{gruppe.navn || 'Uden navn'}</span>
              <span className="set-card-detalje">{saetlinje(indhold, sidstBrugt.get(gruppe.uid))}</span>
            </span>
            {erValgt && <Badge niveau="accent">Valgt</Badge>}
          </button>
        );
      })}

      {fraTurKort}
    </div>
  );

  return (
    <Skal
      fane={fane}
      skift={skift}
      titel="Grejsæt"
      undertitel={`${grupper.length} sæt · genbrug hele pakninger`}
      handlinger={<Knap variant={kanBruges ? 'sekundaer' : 'primaer'} onClick={nyGruppe}>+ Nyt sæt</Knap>}
      fab={nyGruppe}
    >
      <p className="sets-intro">
        Et grejsæt er en gemt pakning. Indlæs det på en tur i stedet for at tilføje ting én for én.
      </p>

      {kvittering && <p className="sets-kvittering" role="status">{kvittering}</p>}

      {erDesktop ? (
        <div className="sets-split">
          {saetliste}
          <Saetdetalje
            gruppe={valgt}
            indhold={valgtIndhold}
            kanBruges={kanBruges}
            rediger={rediger}
            brugPaaTur={() => { setKvittering(''); setArk('brug'); }}
          />
        </div>
      ) : (
        <>
          {/* Telefonen har sin egen handoff, og den er ikke bygget. Indtil da
              er det den liste, der var her før — med referencens linje under
              navnet, så de to skærme i det mindste siger det samme om et sæt. */}
          {grupper.length === 0 && (
            <TomListe>Ingen grejsæt endnu. Saml det, du alligevel altid tager med.</TomListe>
          )}
          {grupper.map((gruppe) => (
            <ListeRaekke
              key={gruppe.uid}
              titel={gruppe.navn || 'Uden navn'}
              detalje={saetlinje(saetindhold(gruppe, items), sidstBrugt.get(gruppe.uid))}
              onClick={() => gruppe.id !== undefined && aabnGruppe(gruppe.id)}
            >
              <TagChips tags={gruppe.tags} maks={5} />
            </ListeRaekke>
          ))}
          <div className="sets-list">{fraTurKort}</div>
        </>
      )}

      {ark === 'brug' && valgt && valgtIndhold && (
        <BrugPaaTurArk
          gruppe={valgt}
          indhold={valgtIndhold}
          grupper={grupper}
          items={items}
          ture={ture}
          indlaes={(tur) => void indlaesPaaTur(tur)}
          annuller={() => setArk(null)}
        />
      )}

      {ark === 'fra-tur' && (
        <OpretFraTurArk
          grupper={grupper}
          items={items}
          ture={ture}
          opret={(tur) => void opretFraTur(tur)}
          annuller={() => setArk(null)}
        />
      )}
    </Skal>
  );
}

// ─────────────────────────────────────────────

function Saetdetalje({ gruppe, indhold, kanBruges, rediger, brugPaaTur }: {
  gruppe: Gruppe | undefined;
  indhold: Saetindhold | null;
  kanBruges: boolean;
  rediger: () => void;
  brugPaaTur: () => void;
}) {
  if (!gruppe || !indhold) {
    return (
      <section className="set-detail set-detail--tom">
        <h2>Intet sæt endnu</h2>
        <p>
          Et sæt er den pakning, du alligevel altid laver. Opret det fra en tur, du har pakket
          — eller start blankt med Nyt sæt.
        </p>
      </section>
    );
  }

  return (
    <section className="set-detail" aria-label={`Sættet ${gruppe.navn || 'uden navn'}`}>
      <header className="set-detail-hoved">
        <div className="set-detail-tekst">
          <h2>{gruppe.navn || 'Uden navn'}</h2>
          <p className="set-detail-maal">{indhold.antal} ting · {kilo(indhold.vaegt_g, 1)} kg</p>
          <TagChips tags={gruppe.tags} maks={5} />
        </div>
        <div className="set-detail-knapper">
          <Knap variant="tekst" onClick={rediger}>Rediger</Knap>
          <Knap
            variant={kanBruges ? 'primaer' : 'sekundaer'}
            disabled={!kanBruges}
            onClick={brugPaaTur}
            ariaLabel={kanBruges ? undefined : 'Brug på tur — sættet er tomt'}
          >
            Brug på tur
          </Knap>
        </div>
      </header>

      {indhold.antal === 0 ? (
        <p className="set-detail-tomt">Der er ikke noget i sættet endnu. Læg grej i det under Rediger.</p>
      ) : (
        <ul className="set-liste">
          {indhold.items.map((item) => (
            <li key={item.uid}>
              <span>{item.navn}</span>
              <span className="set-raekke-detalje">{vaegttekst(item.vaegt_g)} · {delingstekst(item)}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="set-detail-hint">
        <strong>Brug på tur</strong> åbner tur-valget og lægger sættet ind under Pakning — samme
        sted som "Vælg grej" på turen. Grej, turen har i forvejen, lægges ikke til to gange; du
        får et kort overblik, før du bekræfter.
      </p>
    </section>
  );
}

// ─────────────────────────────────────────────
// Arkene
//
// Begge er tur-valg og bruger derfor `Ark` fra opret-arkene: Annuller,
// Escape, et lag over skærmen og en primær knap, der er slået fra, indtil
// valget er gyldigt. Der sker ingenting, før man trykker på den.

function Turvaelger({ ture, valgt, vaelg, linje }: {
  ture: Tur[];
  valgt: Reference | null;
  vaelg: (tur: Tur) => void;
  // Den ekstra oplysning efter turens navn og fase — fx hvor meget grej den
  // har. Forskellig for de to ark.
  linje?: (tur: Tur) => string;
}) {
  if (ture.length === 0) {
    return <p className="turvalg-tom">Du har ingen ture endnu. Opret en tur under Ture først.</p>;
  }

  return (
    <div className="turvalg-liste">
      {tureTilValg(ture).map((tur) => {
        const erValgt = tur.uid === valgt;
        return (
          <button
            key={tur.uid}
            type="button"
            className="turvalg"
            aria-pressed={erValgt}
            onClick={() => vaelg(tur)}
          >
            <span>
              {turlinje(tur)}
              {linje && <span className="turvalg-ekstra"> · {linje(tur)}</span>}
            </span>
            {erValgt && <span aria-hidden="true">✓</span>}
          </button>
        );
      })}
    </div>
  );
}

function BrugPaaTurArk({ gruppe, indhold, grupper, items, ture, indlaes, annuller }: {
  gruppe: Gruppe;
  indhold: Saetindhold;
  grupper: Gruppe[];
  items: Item[];
  ture: Tur[];
  indlaes: (tur: Tur) => void;
  annuller: () => void;
}) {
  const [valgt, setValgt] = useState<Tur | null>(null);
  const overblik = valgt ? indlaesning(valgt, gruppe, grupper, items) : null;
  // Eksplicit valg *og* noget at lægge til. En tur, der allerede har sættet,
  // er ikke et gyldigt valg — så ville knappen sige, at den gjorde noget.
  const kan = valgt !== null && overblik !== null && !overblik.alleredePaaTuren && overblik.iSaettet > 0;

  return (
    <Ark
      titel={`Brug «${gruppe.navn || 'sættet'}» på tur`}
      forklaring="Vælg hvilken tur sættet skal indlæses på. Der ændres ingenting på turen, før du trykker Indlæs."
      opretLabel={`Indlæs ${indhold.antal} ting`}
      kanOprette={kan}
      hvorforSlaaetFra={valgt ? 'sættet ligger allerede på turen' : 'vælg en tur først'}
      opret={() => { if (kan && valgt) indlaes(valgt); }}
      annuller={annuller}
    >
      <Turvaelger ture={ture} valgt={valgt?.uid ?? null} vaelg={setValgt} />

      {/* Overblikket før bekræft. Det er her, dubletterne bliver synlige —
          uden det ville man ikke kunne se forskel på "lægger otte ting til"
          og "lægger to ting til". */}
      {overblik && (
        <p className="turvalg-overblik" role="status">{indlaesningstekst(overblik)}</p>
      )}
    </Ark>
  );
}

function OpretFraTurArk({ grupper, items, ture, opret, annuller }: {
  grupper: Gruppe[];
  items: Item[];
  ture: Tur[];
  opret: (tur: Tur) => void;
  annuller: () => void;
}) {
  const [valgt, setValgt] = useState<Tur | null>(null);
  const antal = valgt ? saetFraTur(valgt, grupper, items).length : 0;
  const kan = valgt !== null && antal > 0;

  return (
    <Ark
      titel="Opret sæt fra tur"
      forklaring="Sættet får det grej, turen har. Der oprettes ingenting, før du trykker Opret."
      opretLabel={antal > 0 ? `Opret sæt af ${antal} ting` : 'Opret sæt'}
      kanOprette={kan}
      hvorforSlaaetFra={valgt ? 'turen har ikke noget grej at gemme' : 'vælg en tur først'}
      opret={() => { if (kan && valgt) opret(valgt); }}
      annuller={annuller}
    >
      <Turvaelger
        ture={ture}
        valgt={valgt?.uid ?? null}
        vaelg={setValgt}
        linje={(tur) => `${saetFraTur(tur, grupper, items).length} ting`}
      />

      {valgt && (
        <p className="turvalg-overblik" role="status">
          {antal === 0
            ? 'Turen har ikke noget grej på sig endnu — der er ikke noget at gemme som sæt.'
            : `Sættet kommer til at hedde «${turnavn(valgt)}» og indeholde ${antal} ting. Du kan rette begge dele bagefter.`}
        </p>
      )}
    </Ark>
  );
}

export default GrupperListe;
