import { useState, useRef } from 'react';
import type { ReactNode } from 'react';
import { db } from './db';
import { laesSikkerhedskopi, fletInd, KopiFejl } from './dataudveksling';
import { Knap, Chip } from './ui';
import { layout } from './layout';

interface Props {
  nytItem: () => void;
  nyTur: () => void;
  tilLogin: () => void;
  // Kaldes når rundvisningen er set eller sprunget over.
  faerdig: () => void;
  // Ser man den igen fra indstillingerne, er der ingen grund til at bede om
  // en konto eller tilbyde at importere en fil.
  kunOpslag?: boolean;
}

// Rundvisningen første gang appen åbnes.
//
// Feltbogen hænger sammen på en måde man ikke kan gætte: tags driver både
// forslag og advarsler, grupper er bundter man tager med samlet, og en tur
// samler det hele. Uden en forklaring ligner det bare en liste over ting.
//
// Derfor et trin ad gangen med ét begreb hver, og et lille billede af hvordan
// det ser ud i appen — ikke en mur af tekst man scroller forbi.
function Rundvisning({ nytItem, nyTur, tilLogin, faerdig, kunOpslag }: Props) {
  const [trin, setTrin] = useState(0);
  const sidste = trin === TRIN.length - 1;

  return (
    <div style={{
      ...layout.container,
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      paddingBottom: '20px'
    }}>
      <div style={{
        maxWidth: '420px',
        margin: '0 auto',
        width: '100%',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center'
      }}>
        <Prikker antal={TRIN.length} paa={trin} gaaTil={setTrin} />

        <div style={{ minHeight: '340px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontSize: '40px', lineHeight: 1, marginBottom: '14px' }} role="img" aria-hidden>
            {TRIN[trin].ikon}
          </div>
          <h1 style={{ fontSize: '26px', margin: '0 0 12px' }}>{TRIN[trin].titel}</h1>
          <div style={{ fontSize: 'var(--skrift-brod)', color: 'var(--tekst-dæmpet)', lineHeight: 1.65 }}>
            {TRIN[trin].tekst}
          </div>
          {TRIN[trin].figur && <div style={{ marginTop: '18px' }}>{TRIN[trin].figur}</div>}
        </div>

        {sidste ? (
          <Komigang
            nytItem={nytItem}
            nyTur={nyTur}
            tilLogin={tilLogin}
            faerdig={faerdig}
            kunOpslag={kunOpslag}
            tilbage={() => setTrin(trin - 1)}
          />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '24px' }}>
            <Knap
              variant="primaer"
              onClick={() => setTrin(trin + 1)}
              style={{ padding: '12px 22px', fontSize: 'var(--skrift-brod)' }}
            >
              Videre
            </Knap>
            {trin > 0 && <Knap variant="tekst" onClick={() => setTrin(trin - 1)}>Tilbage</Knap>}
            <div style={{ flex: 1 }} />
            <Knap variant="tekst" onClick={faerdig}>
              {kunOpslag ? 'Luk' : 'Spring over'}
            </Knap>
          </div>
        )}
      </div>
    </div>
  );
}

function Prikker({ antal, paa, gaaTil }: { antal: number; paa: number; gaaTil: (n: number) => void }) {
  return (
    <div style={{ display: 'flex', gap: '6px', marginBottom: '26px' }}>
      {Array.from({ length: antal }, (_, n) => (
        <button
          key={n}
          onClick={() => gaaTil(n)}
          aria-label={`Trin ${n + 1} af ${antal}`}
          aria-current={n === paa}
          style={{
            flex: 1,
            height: '3px',
            padding: 0,
            border: 'none',
            borderRadius: '2px',
            cursor: 'pointer',
            background: n <= paa ? 'var(--accent)' : 'var(--border-svag)',
            transition: 'background 0.2s'
          }}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// Små billeder af hvordan det ser ud i appen. De er tegnet med de samme
// byggeklodser som resten, så det man lærer, også er det man møder.
// ─────────────────────────────────────────────

function Kort({ children }: { children: ReactNode }) {
  return (
    <div style={{
      border: '1px solid var(--border-svag)',
      borderRadius: '10px',
      padding: '12px 14px',
      background: 'var(--bg-forhoejet)',
      fontSize: 'var(--skrift-knap)'
    }}>
      {children}
    </div>
  );
}

function Linje({ navn, hoejre }: { navn: string; hoejre?: ReactNode }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: '10px',
      padding: '5px 0'
    }}>
      <span>{navn}</span>
      <span style={{ color: 'var(--tekst-dæmpet)', fontSize: 'var(--skrift-detalje)', whiteSpace: 'nowrap' }}>{hoejre}</span>
    </div>
  );
}

interface Trin {
  ikon: string;
  titel: string;
  tekst: ReactNode;
  figur?: ReactNode;
}

const TRIN: Trin[] = [
  {
    ikon: '🎒',
    titel: 'Velkommen til Feltbogen',
    tekst: (
      <>
        Feltbogen holder styr på dit friluftsgrej og hjælper dig med at pakke
        til en tur uden at glemme noget. <strong>Alt gemmes på din enhed</strong> og
        virker uden dækning — også midt i skoven.
        <br /><br />
        Det tager et minut at forstå hvordan det hænger sammen. Så er resten nemt.
      </>
    )
  },
  {
    ikon: '🧭',
    titel: 'Alt dit grej ét sted',
    tekst: (
      <>
        Under <strong>Inventar</strong> ligger hver ting du ejer, med vægt og pris.
        Det er grundlaget for alt det andet — vægten på en tur, hvad du har
        brugt penge på, og hvad du mangler.
        <br /><br />
        Grej kan også stå som <em>overvejer</em>, hvis det er noget du kigger på,
        eller <em>solgt</em>, når det er ude af huset.
      </>
    ),
    figur: (
      <Kort>
        <Linje navn="TTTM Pro Hammock" hoejre="900 g · 1.299 kr" />
        <Linje navn="Toaks 1L gryde" hoejre="155 g · 349 kr" />
        <Linje navn="MSR Pocket Rocket" hoejre="73 g · 449 kr" />
      </Kort>
    )
  },
  {
    ikon: '🏷',
    titel: 'Tags er dine egne ord',
    tekst: (
      <>
        Du sætter selv de ord der giver mening for dig — <em>sovegrej</em>,{' '}
        <em>vinter</em>, <em>kano</em>. Der er ingen fast liste.
        <br /><br />
        Tags gør to ting: du kan søge på dem, og appen bruger dem til at
        foreslå hvilke grupper der passer til en tur.
      </>
    ),
    figur: (
      <Kort>
        <div style={{ marginBottom: '8px' }}>Moonquilt PRO 850</div>
        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
          <Chip storrelse="lille">sovegrej</Chip>
          <Chip storrelse="lille">vinter</Chip>
          <Chip storrelse="lille">hængekøje</Chip>
        </div>
      </Kort>
    )
  },
  {
    ikon: '⚠',
    titel: 'Kræver og komplementerer',
    tekst: (
      <>
        Her bliver tags til noget der passer på dig. På et stykke grej kan du
        skrive hvad det <strong>kræver</strong> for at virke — en brænder kræver
        gas — og hvad der <strong>komplementerer</strong> det, altså er rart at
        have med.
        <br /><br />
        Mangler noget på turen, siger appen til: <strong>rødt</strong> når noget
        kræves, <strong>gult</strong> når det bare er værd at overveje.
      </>
    ),
    figur: (
      <Kort>
        <div style={{ marginBottom: '8px' }}>MSR Pocket Rocket kræver <strong>gas</strong></div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <Chip storrelse="lille" farve="fejl">⚠ gas</Chip>
          <span style={{ fontSize: 'var(--skrift-detalje)', color: 'var(--tekst-dæmpet)' }}>
            intet på turen har det tag
          </span>
        </div>
      </Kort>
    )
  },
  {
    ikon: '📦',
    titel: 'Grupper er bundter',
    tekst: (
      <>
        Ting du altid tager med samlet, samler du i en <strong>gruppe</strong> —
        et køkken, et sovesystem. Så vælger du hele gruppen til en tur i stedet
        for at klikke tingene af én ad gangen.
        <br /><br />
        Giver du gruppen tags, foreslår appen den til de ture den passer på.
      </>
    ),
    figur: (
      <Kort>
        <div style={{ fontWeight: 500, marginBottom: '6px' }}>Sovegrej · hængekøje</div>
        <Linje navn="TTTM Pro Hammock" hoejre="900 g" />
        <Linje navn="Moonquilt PRO 850" hoejre="780 g" />
        <Linje navn="TTTM Full Moon Tarp" hoejre="720 g" />
      </Kort>
    )
  },
  {
    ikon: '🗺',
    titel: 'Turen samler det hele',
    tekst: (
      <>
        En <strong>tur</strong> er et sted, nogle datoer og et antal nætter. Du
        vælger de grupper og de enkelte ting der skal med, og så bygger appen
        pakkelisten.
        <br /><br />
        Den regner vægten ud — også pr. person — henter vejrudsigten for stedet,
        og du kan fordele det fælles grej, så alle ved hvad de bærer.
      </>
    ),
    figur: (
      <Kort>
        <div style={{ fontSize: 'var(--skrift-lille)', color: 'var(--tekst-dæmpet)', fontWeight: 600, marginBottom: '4px' }}>
          SOVEGREJ
        </div>
        <Linje navn="TTTM Pro Hammock" hoejre="Mikkel · 900 g" />
        <Linje navn="Moonquilt PRO 850" hoejre="Emil · 780 g" />
        <div style={{ textAlign: 'right', fontSize: 'var(--skrift-lille)', color: 'var(--tekst-svag)', paddingTop: '4px' }}>
          1.68 kg
        </div>
      </Kort>
    )
  },
  {
    ikon: '🔗',
    titel: 'Del turen med de andre',
    tekst: (
      <>
        Du kan lave et link til dem der skal med. De logger ind, ser turen og
        pakkelisten — men aldrig resten af dit inventar, og ingen priser.
        <br /><br />
        De kan skrive <strong>hvad de selv tager med</strong> og sige hvad de
        bærer af det fælles. Det lander i den samme pakkeliste, med navn på hver
        linje, så I ikke kommer med to telte.
      </>
    ),
    figur: (
      <Kort>
        <Linje navn="Telt Hilleberg" hoejre="Mikkel · 2400 g" />
        <Linje navn="Dunjakke" hoejre="Sofie · 450 g" />
        <div style={{ fontSize: 'var(--skrift-lille)', color: 'var(--tekst-svag)', paddingTop: '6px' }}>
          Sofie skrev sig på turen selv
        </div>
      </Kort>
    )
  },
  {
    ikon: '✓',
    titel: 'Så er du klar',
    tekst: (
      <>
        Den hurtigste vej i gang er at lægge et par ting ind i inventaret og så
        oprette en tur. Du behøver ikke have det hele med fra start — appen er
        lige så brugbar med ti ting som med hundrede.
      </>
    )
  }
];

function Komigang({ nytItem, nyTur, tilLogin, faerdig, kunOpslag, tilbage }: {
  nytItem: () => void;
  nyTur: () => void;
  tilLogin: () => void;
  faerdig: () => void;
  kunOpslag?: boolean;
  // Også det sidste trin skal kunne fortrydes. Uden den var man låst fast,
  // hvis man ville læse et af de foregående igen.
  tilbage: () => void;
}) {
  const [fejl, setFejl] = useState('');
  const [laeser, setLaeser] = useState(false);
  const filvaelger = useRef<HTMLInputElement>(null);

  // En kopi fra en anden enhed lægges oveni, så man ikke skal starte forfra.
  const importer = async (fil: File) => {
    setLaeser(true);
    setFejl('');
    try {
      const kopi = laesSikkerhedskopi(await fil.text());
      const flettet = fletInd(kopi, {
        items: await db.items.toArray(),
        grupper: await db.grupper.toArray(),
        ture: await db.ture.toArray(),
        steder: await db.steder.toArray(),
        personer: await db.personer.toArray()
      });

      await db.transaction('rw', db.items, db.grupper, db.ture, db.steder, db.personer, async () => {
        await db.items.bulkAdd(flettet.items);
        await db.grupper.bulkAdd(flettet.grupper);
        await db.ture.bulkAdd(flettet.ture);
        await db.steder.bulkAdd(flettet.steder);
        await db.personer.bulkAdd(flettet.personer);
      });

      faerdig();
    } catch (e) {
      setFejl(e instanceof KopiFejl ? e.message : 'Filen kunne ikke læses.');
      setLaeser(false);
    }
  };

  if (kunOpslag) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '24px' }}>
        <Knap variant="primaer" onClick={faerdig} style={{ padding: '12px 22px', fontSize: 'var(--skrift-brod)' }}>
          Luk
        </Knap>
        <Knap variant="tekst" onClick={tilbage}>Tilbage</Knap>
      </div>
    );
  }

  return (
    <div style={{ marginTop: '24px' }}>
      <div style={{ display: 'grid', gap: '10px' }}>
        <Knap variant="primaer" onClick={nytItem} style={{ padding: '12px', fontSize: 'var(--skrift-brod)' }}>
          Tilføj mit første grej
        </Knap>
        <Knap onClick={nyTur} style={{ padding: '12px', fontSize: 'var(--skrift-brod)' }}>
          Opret min første tur
        </Knap>
        <Knap
          onClick={() => filvaelger.current?.click()}
          disabled={laeser}
          style={{ padding: '12px', fontSize: 'var(--skrift-brod)' }}
        >
          {laeser ? 'Læser…' : 'Importér fra fil'}
        </Knap>
      </div>

      <input
        ref={filvaelger}
        type="file"
        accept="application/json,.json"
        style={{ display: 'none' }}
        onChange={(e) => {
          const fil = e.target.files?.[0];
          e.target.value = '';
          if (fil) void importer(fil);
        }}
      />

      {fejl && (
        <div style={{ fontSize: 'var(--skrift-detalje)', color: 'var(--fejl)', textAlign: 'center', marginTop: '12px' }}>
          {fejl}
        </div>
      )}

      <div style={{ fontSize: 'var(--skrift-lille)', color: 'var(--tekst-svag)', textAlign: 'center', marginTop: '18px', lineHeight: 1.6 }}>
        Alt gemmes på denne enhed og virker uden konto. Med en konto kan du
        synkronisere mellem telefon og PC — og dele ture.
      </div>

      <div style={{ display: 'grid', gap: '2px', marginTop: '10px', justifyItems: 'center' }}>
        <button
          onClick={tilLogin}
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--tekst-dæmpet)', fontSize: 'var(--skrift-knap)', padding: '6px',
            textDecoration: 'underline'
          }}
        >
          Log ind eller opret konto
        </button>
        <button
          onClick={faerdig}
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--tekst-dæmpet)', fontSize: 'var(--skrift-knap)', padding: '6px'
          }}
        >
          Se mig omkring selv →
        </button>
        <button
          onClick={tilbage}
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--tekst-svag)', fontSize: 'var(--skrift-detalje)', padding: '6px'
          }}
        >
          ‹ Tilbage
        </button>
      </div>
    </div>
  );
}

export default Rundvisning;
