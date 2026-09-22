import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import type { Item } from './db';
import type { Stedlinje, BrugtOgUroert } from './friluftshistorik';
import {
  turtal, gennemsnitsvaegt, bedsteGrej, daarligsteGrej, andelVurderet,
  hyldevarer, hyldevarevaegt, skroebeligtGrej, grundlag, MINDST_FOR_ET_MOENSTER
} from './laering';
import { fordeling } from './aarsopgoerelse';
import { etiket } from './db';
import { Segment, SektionsTitel } from './ui';
import { useErDesktop } from './useMedie';
import { kilo } from './talformat';
import {
  filtrererTure,
  samletInventarvaerdi,
  samletVaegt,
  antalPrStatus,
  vaerditilvaekst,
  mestBrugte,
  ubrugteItems,
  fordelingPrGruppe
} from './statistik';
import type { Periode } from './statistik';
import { historiktal, saesonen, topSteder, brugtOgUroert, besoegstal } from './friluftshistorik';
import { gennemsnit, snittekst } from './vurdering';

interface Props {
  aabnItem: (id: number, nyOprettet?: boolean) => void;
  // Et gemt sted på top-listen kan åbnes. Et sted, der kun findes som navn på
  // en tur, kan ikke — der er ingen side at åbne.
  aabnSted?: (id: number) => void;
}

// Statistik-fanen på Friluftshistorik.
//
// Den var et instrumentbræt: et periodesegment med tre valg, et fyldt kort
// til årsopgørelsen og fjorten felter i et gitter, hvoraf de fleste handlede
// om inventaret. `docs/design/desktop/09-steder-statistik.html` tegner noget
// andet — fire rolige tal, nætterne fordelt på måneder og det grej, man
// faktisk bruger. Det er dét, der står øverst nu.
//
// Resten er ikke væk. Mønstrene — hyldevarer, det der går i stykker,
// vurderingerne, inventarværdien — er det, appen har lært af turene, og de
// står stadig, men foldet sammen under én linje, man selv slår op. Det er
// forskellen på en journal og et instrumentbræt: journalen svarer på det, man
// kom efter, og har resten liggende.
//
// Årsopgørelsen har flyttet op i skærmens header (FriluftshistorikSide.tsx),
// hvor den er en outline-knap ved siden af overskriften i stedet for et fyldt
// kort, der lå og tog al opmærksomheden på vej ned til tallene.

// Perioden er to valg nu og ikke tre. "Sidste år" var et dashboard-greb —
// året før er ikke et filter, det er en beretning, og den ligger i
// årsopgørelsen, som kan vælge et hvilket som helst år med ture i.
const PERIODER: readonly Periode[] = ['i_aar', 'alt'];

const MAANEDER = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

const MAKS_MEST_BRUGTE = 5;
const MAKS_TOP_STEDER = 3;
const MAKS_UROERTE = 5;

function StatistikPanel({ aabnItem, aabnSted }: Props) {
  const erDesktop = useErDesktop();
  const [periode, setPeriode] = useState<Periode>('i_aar');
  const [viserMoenstre, setViserMoenstre] = useState(false);

  const items = useLiveQuery(() => db.items.toArray()) ?? [];
  const alleTure = useLiveQuery(() => db.ture.toArray()) ?? [];
  const grupper = useLiveQuery(() => db.grupper.toArray()) ?? [];
  const steder = useLiveQuery(() => db.steder.toArray()) ?? [];

  const nu = new Date();
  const ture = filtrererTure(alleTure, periode);
  const periodeLabel: Record<Periode, string> = {
    i_aar: `${nu.getFullYear()}`,
    sidste_aar: `${nu.getFullYear() - 1}`,
    alt: 'Alle år'
  };

  const antal = antalPrStatus(items);
  const topBrugt = mestBrugte(items, ture, grupper, MAKS_MEST_BRUGTE);
  // Ubrugt måles altid mod hele turhistorikken — et snævrere vindue ville
  // udråbe gear som ubrugt bare fordi man kigger på et enkelt år.
  const ubrugt = ubrugteItems(items, alleTure, grupper);
  const gruppeFordeling = fordelingPrGruppe(items, grupper);
  // Kun det man ejer. Solgt grej siger ikke noget om, hvad man er glad for nu.
  const snit = gennemsnit(items.filter((i) => i.status === 'ejer'));

  const tilvaekst = periode === 'alt' ? null : vaerditilvaekst(items, nu.getFullYear());

  // Læringen deler sig i to, og det er ikke vilkårligt.
  //
  // Tallene om *perioden* — nætter, dage, gennemsnitsvægt — beskriver det
  // udsnit, man kigger på, og følger derfor perioden.
  //
  // Mønstrene — hyldevarer, det der går i stykker — måles mod hele
  // turhistorikken. Samme grund som ubrugt gear ovenfor: et snævrere vindue
  // ville udråbe noget som en vane, bare fordi man kigger på et enkelt år.
  const tal = turtal(ture);
  const tiltal = historiktal(ture, items);
  const maaneder = saesonen(ture);
  // Statistik v1: tal, man kan forklare i én sætning. Begge følger perioden —
  // de beskriver turene i udsnittet, ikke inventaret.
  const stederTop = topSteder(steder, ture, MAKS_TOP_STEDER);
  const brug = brugtOgUroert(ture, items);
  const vaegt = gennemsnitsvaegt(ture, grupper, items);
  const turtyper = fordeling(ture, (t) => etiket(t.aktivitet));

  const laeringsgrundlag = grundlag(alleTure);
  const hylden = hyldevarer(items, alleTure);
  const skroebelige = skroebeligtGrej(items, alleTure);
  const bedste = bedsteGrej(items, 3);
  const daarligste = daarligsteGrej(items, 3);
  const vurderetAndel = andelVurderet(items);

  if (items.length === 0 && alleTure.length === 0) {
    return (
      <div className="historik-tom">
        Ingen tal endnu. Tilføj grej under Grej, eller skriv en tur ind — så
        begynder det at fylde her.
      </div>
    );
  }

  return (
    <section>
      <div className="historik-periode">
        <Segment
          vaerdier={PERIODER}
          valgt={periode}
          vaelg={(p) => setPeriode(p)}
          formater={(p) => periodeLabel[p]}
          kompakt
          // Stille og ikke fyldt: det valgte faneblad over den her er
          // skærmens ene fyldte accent, og to grønne flader i samme billede
          // er præcis det, designsystemet ikke vil have.
          stille
        />
      </div>

      <div className="historik-tal-felter">
        <Talfelt navn="Ture" vaerdi={`${tiltal.ture}`} />
        <Talfelt navn="Nætter" vaerdi={`${tiltal.naetter}`} />
        <Talfelt navn="Grej i bog" vaerdi={`${tiltal.grej}`} />
        <Talfelt navn="Kg grej" vaerdi={kilo(tiltal.vaegt_g, 1)} />
      </div>

      {/* Uden den her linje ser alle fire tal ud til at handle om perioden,
          og så ville "Kg grej" stå og påstå, at man bar 13 kilo i 2026. */}
      <p className="historik-fodnote">
        Ture og nætter er {periode === 'alt' ? 'alle år' : periodeLabel[periode]}. Grej og kilo er
        det, du ejer nu.
      </p>

      <div className="historik-kort">
        <p className="historik-kort-titel">Nætter pr. måned</p>
        {maaneder.length === 0 ? (
          <p className="historik-kort-tekst">
            {tal.ture === 0
              ? 'Ingen ture i perioden endnu.'
              : 'Ingen nætter ude i perioden — turene var dagsture.'}
          </p>
        ) : (
          <>
            <div className="historik-bjaelker">
              {maaneder.map((m) => (
                <Maanedsbjaelke
                  key={m.maaned}
                  navn={MAANEDER[m.maaned]}
                  naetter={m.naetter}
                  maks={Math.max(...maaneder.map((x) => x.naetter))}
                />
              ))}
            </div>
            <p className="historik-kort-tekst">
              Kun månederne fra den første nat ude til den sidste. Tomme måneder midt i
              sæsonen står med, for det er også en oplysning.
            </p>
          </>
        )}
      </div>

      <div className="historik-kort">
        <p className="historik-kort-titel">Top-steder</p>
        {tal.ture === 0 ? (
          <p className="historik-kort-tekst">Ingen ture i perioden endnu.</p>
        ) : stederTop.length === 0 ? (
          <p className="historik-kort-tekst">
            Ingen af turene i perioden har et sted skrevet på. Skriv stedet på turen, så
            står det her.
          </p>
        ) : (
          <>
            <Stedliste linjer={stederTop} aabn={aabnSted} />
            <p className="historik-kort-tekst">
              Talt fra stedet på hver tur i perioden. Flest ture øverst.
            </p>
          </>
        )}
      </div>

      <BrugtUroertKort brug={brug} ture={tal.ture} aabnItem={aabnItem} />

      {topBrugt.length > 0 && (
        <div className="historik-kort">
          <p className="historik-kort-titel">Mest brugte grej</p>
          <Grejliste
            raekker={topBrugt.map((x) => ({
              item: x.item,
              hoejre: `${x.antalTure} ${x.antalTure === 1 ? 'tur' : 'ture'}`
            }))}
            aabn={aabnItem}
          />
          {ubrugt.antal > 0 && (
            <p className="historik-kort-tekst">
              {ubrugt.antal === 1 ? 'Ét stykke grej' : `${ubrugt.antal} stykker grej`} har ikke
              været med det seneste år. De står under mønstrene nedenfor.
            </p>
          )}
        </div>
      )}

      {/* Mønstrene er stadig her — de er det, appen har lært af turene. De
          ligger bare ikke og fylder skærmen, før man har spurgt om dem. */}
      <div className="historik-fold">
        <button
          type="button"
          className="historik-fold-knap"
          aria-expanded={viserMoenstre}
          onClick={() => setViserMoenstre(!viserMoenstre)}
        >
          {viserMoenstre ? 'Skjul' : 'Vis'} hvad turene har lært os
        </button>
        <p className="historik-fold-tekst">
          Hyldevarer, det der går i stykker, vurderinger og inventarets vægt og værdi
        </p>
      </div>

      {viserMoenstre && (
        <>
          <SektionsTitel>Hvad turene har lært os</SektionsTitel>

          <div style={{
            display: 'grid',
            gridTemplateColumns: erDesktop ? 'repeat(2, minmax(0, 1fr))' : '1fr',
            gap: '10px',
            alignItems: 'start'
          }}>
            <Widget titel={`Nætter ${periodeLabel[periode].toLowerCase()}`}>
              <Tal vaerdi={`${tal.naetter}`} enhed={tal.naetter === 1 ? 'nat' : 'nætter'} />
              <Undertekst>
                {[
                  `${tal.ture} ${tal.ture === 1 ? 'tur' : 'ture'}`,
                  tal.snit_naetter !== null ? `${tal.snit_naetter} pr. tur i snit` : null,
                  tal.dagsture > 0 ? `${tal.dagsture} uden overnatning` : null
                ].filter(Boolean).join(' · ')}
              </Undertekst>
            </Widget>

            <Widget titel="Inventarværdi">
              <Tal vaerdi={kroner(samletInventarvaerdi(items))} enhed="kr" />
              <Undertekst>{tilvaekstTekst(tilvaekst, samletVaegt(items))}</Undertekst>
            </Widget>

            {/* Kun når der faktisk er vurderet noget. Et snit af nul vurderinger
                er ikke nul stjerner — det er ingen oplysning, og et tomt felt her
                ville se ud som en dårlig karakter. */}
            {snit !== null && (
              <Widget titel="Gennemsnitlig vurdering">
                <Tal vaerdi={snittekst(snit)} />
                <Undertekst>
                  {snit.antal === 1
                    ? 'Bygger på ét stykke grej, du har vurderet'
                    : `Bygger på ${snit.antal} stykker grej, du har vurderet`}
                </Undertekst>
              </Widget>
            )}

            <Widget titel="Antal items">
              {/* Solgt gear tælles ikke med — det er ikke længere en del af
                  inventaret, og står for sig selv under Inventar. */}
              <Tal vaerdi={`${antal.ejer + antal.overvejer}`} />
              <Undertekst>{antal.ejer} ejer · {antal.overvejer} overvejer</Undertekst>
            </Widget>

            {ubrugt.antal > 0 && (
              <Widget titel="Ubrugte items" advarsel>
                <Tal vaerdi={`${ubrugt.antal}`} enhed={ubrugt.antal === 1 ? 'item' : 'items'} advarsel />
                <Undertekst>
                  {kilo(ubrugt.vaegt, 1)} kg · {kroner(ubrugt.vaerdi)} kr · ikke med det seneste år
                </Undertekst>
                <Udfoldelig items={ubrugt.items} aabn={aabnItem} />
              </Widget>
            )}

            {gruppeFordeling.length > 0 && (
              <Widget titel="Fordeling pr. gruppe">
                <Fordeling fordeling={gruppeFordeling} />
              </Widget>
            )}

            {/* Kun de ture, der faktisk havde grej valgt. En tom kladde talt som
                nul ville trække snittet ned uden at sige noget. */}
            {vaegt && (
              <Widget titel="Gennemsnitsvægt pr. tur">
                <Tal vaerdi={kilo(vaegt.snit_g, 1)} enhed="kg" />
                <Undertekst>
                  {vaegt.antal === 1
                    ? 'Bygger på én tur med valgt grej'
                    : `Bygger på ${vaegt.antal} ture · letteste ${kilo(vaegt.letteste.vaegt_g, 1)} kg, tungeste ${kilo(vaegt.tungeste.vaegt_g, 1)} kg`}
                </Undertekst>
              </Widget>
            )}

            {turtyper.length > 0 && (
              <Widget titel="Turtyper">
                <Andelsliste
                  raekker={turtyper.map((a) => ({
                    navn: a.vaerdi,
                    hoejre: `${a.antal} ${a.antal === 1 ? 'tur' : 'ture'} · ${Math.round((a.antal / tal.ture) * 100)} %`
                  }))}
                />
              </Widget>
            )}

            {/* Mønstrene kræver noget at bygge på. Uden det her ville siden påstå
                at kende ens vaner efter én tur. */}
            {!laeringsgrundlag.nok ? (
              <Widget titel="Mønstre i grejet" bred={erDesktop}>
                <Undertekst>{laeringsgrundlag.mangler}</Undertekst>
              </Widget>
            ) : (
              <>
                {hylden.length > 0 && (
                  <Widget titel="Med hver gang, aldrig brugt" advarsel bred={erDesktop}>
                    <Tal vaerdi={kilo(hyldevarevaegt(hylden), 1)} enhed="kg" advarsel />
                    <Undertekst>
                      {hylden.length === 1 ? 'Ét stykke grej' : `${hylden.length} stykker grej`} har
                      været med mindst tre gange uden at blive brugt. Det er vægt, du kan lade blive hjemme.
                    </Undertekst>
                    <div style={{ marginTop: 'var(--plads-3)' }}>
                      <Grejliste
                        nummerer={false}
                        raekker={hylden.map((h) => ({
                          item: h.item,
                          hoejre: `${kilo(h.vaegt_g, 1)} kg · med ${h.med} gange`
                        }))}
                        aabn={aabnItem}
                      />
                    </div>
                  </Widget>
                )}

                {skroebelige.length > 0 && (
                  <Widget titel="Går i stykker" advarsel>
                    <Grejliste
                      nummerer={false}
                      raekker={skroebelige.map((s) => ({
                        item: s.item,
                        hoejre: `${s.gange} gange af ${s.med}`
                      }))}
                      aabn={aabnItem}
                    />
                  </Widget>
                )}
              </>
            )}

            {/* Stjernerne er det eneste, appen ved, som ikke er et tal eller en
                dato. De står uden for grundlags-porten: en vurdering er et svar,
                man har givet, og den kræver ikke et mønster for at gælde. */}
            {bedste.length > 0 && (
              <Widget titel="Bedst bedømt">
                <Grejliste
                  nummerer={false}
                  raekker={bedste.map((s) => ({ item: s.item, hoejre: '★'.repeat(s.vurdering) }))}
                  aabn={aabnItem}
                />
                <div style={{ marginTop: 'var(--plads-2)' }}>
                  <Undertekst>
                    {vurderetAndel.vurderet} af {vurderetAndel.i_alt} stykker grej er vurderet
                  </Undertekst>
                </div>
              </Widget>
            )}

            {/* Kun når der er nok til at "dårligst" betyder noget. Med tre
                vurderinger i alt ville den nederste også stå på listen ovenfor. */}
            {daarligste.length > 0 && vurderetAndel.vurderet > bedste.length && (
              <Widget titel="Dårligst bedømt">
                <Grejliste
                  nummerer={false}
                  raekker={daarligste.map((s) => ({ item: s.item, hoejre: '★'.repeat(s.vurdering) }))}
                  aabn={aabnItem}
                />
              </Widget>
            )}
          </div>
        </>
      )}

      {/* Referencens egen linje. Den står der, fordi den er et løfte: tallene
          her skal kunne bruges til noget, og et lagkagediagram over ens
          soveposer kan ikke. */}
      <p className="historik-fodnote">
        Ingen lagkagediagrammer. Bare det, du kan bruge til årsopgørelsen.
      </p>
    </section>
  );
}

// ─────────────────────────────────────────────
// Widgets
// ─────────────────────────────────────────────

// Et af de fire tal øverst. Etiketten i versaler, tallet i displayskriften —
// referencens form, og den samme, årsopgørelsen bruger.
function Talfelt({ navn, vaerdi }: { navn: string; vaerdi: string }) {
  return (
    <div className="historik-talfelt">
      <p className="historik-talfelt-etiket">{navn}</p>
      <p className="historik-talfelt-tal">{vaerdi}</p>
    </div>
  );
}

// Grej brugt vs urørt — kun fra pak-af-tjekkene.
//
// Kortet siger aldrig mere, end tjekkene kan bære. Uden tjek er der ingen tal,
// kun en forklaring på hvor de kommer fra. Med for få tjek står tallene — de er
// sande — men listen over urørt grej venter: urørt på én tur er ikke en vane,
// og en liste ville opfordre til at lade det blive hjemme.
function BrugtUroertKort({ brug, ture, aabnItem }: {
  brug: BrugtOgUroert;
  ture: number;
  aabnItem: (id: number) => void;
}) {
  const udenTjek = brug.ture_uden_tjek > 0 && (
    <p className="historik-kort-tekst">
      {brug.ture_uden_tjek === 1
        ? '1 afsluttet tur i perioden mangler pak-af-tjekket og tæller ikke med.'
        : `${brug.ture_uden_tjek} afsluttede ture i perioden mangler pak-af-tjekket og tæller ikke med.`}
    </p>
  );

  if (brug.ture_gjort_op === 0) {
    return (
      <div className="historik-kort">
        <p className="historik-kort-titel">Grej brugt vs urørt</p>
        <p className="historik-kort-tekst">
          {ture === 0
            ? 'Ingen ture i perioden endnu.'
            : 'Ingen ture i perioden er gjort op endnu. Når du laver pak-af-tjekket efter en tur, står det her, hvad der blev brugt, og hvad der lå urørt.'}
        </p>
        {udenTjek}
      </div>
    );
  }

  const tilbage = MINDST_FOR_ET_MOENSTER - brug.ture_gjort_op;
  const kilde = brug.ture_gjort_op === 1
    ? 'Fra pak-af-tjekket på 1 tur.'
    : `Fra pak-af-tjekket på ${brug.ture_gjort_op} ture.`;

  return (
    <div className="historik-kort">
      <p className="historik-kort-titel">Grej brugt vs urørt</p>

      {brug.grej === 0 ? (
        <p className="historik-kort-tekst">Pak-af-tjekkene i perioden har intet grej på.</p>
      ) : (
        <>
          <div className="historik-brugt">
            <div>
              <p className="historik-talfelt-etiket">Brugt</p>
              <p className="historik-talfelt-tal">{brug.brugt}</p>
            </div>
            <div>
              <p className="historik-talfelt-etiket">Urørt</p>
              <p className="historik-talfelt-tal">{brug.uroert}</p>
            </div>
          </div>
          <p className="historik-kort-tekst">
            {kilde} Brugt er brugt mindst én gang. Urørt er urørt hver gang, det var med.
          </p>

          {tilbage > 0 ? (
            <p className="historik-kort-tekst">
              Urørt på {brug.ture_gjort_op === 1 ? 'én tur' : `${brug.ture_gjort_op} ture`} er ikke et mønster endnu.
              Listen over urørt grej kommer, når {tilbage === 1 ? '1 tur mere' : `${tilbage} ture mere`} er
              gjort op.
            </p>
          ) : brug.uroerte.length > 0 && (
            <>
              <div style={{ marginTop: 'var(--plads-3)' }}>
                <Grejliste
                  raekker={brug.uroerte.slice(0, MAKS_UROERTE).map((u) => ({
                    item: u.item,
                    hoejre: `${kilo(u.item.vaegt_g * u.item.antal, 1)} kg · urørt ${u.uroert} ${u.uroert === 1 ? 'gang' : 'gange'}`
                  }))}
                  aabn={aabnItem}
                />
              </div>
              {brug.uroerte.length > MAKS_UROERTE && (
                <p className="historik-kort-tekst">
                  + {brug.uroerte.length - MAKS_UROERTE} mere urørt grej.
                </p>
              )}
            </>
          )}
        </>
      )}

      {udenTjek}
    </div>
  );
}

// Top-stederne. Et gemt sted kan åbnes; et sted, der kun står som navn på en
// tur, er en linje uden noget at trykke på.
function Stedliste({ linjer, aabn }: { linjer: Stedlinje[]; aabn?: (id: number) => void }) {
  return (
    <div className="historik-grejliste">
      {linjer.map((l, i) => {
        const indhold = (
          <>
            <span style={{ display: 'flex', gap: '10px', alignItems: 'baseline', minWidth: 0 }}>
              <span style={{ fontSize: 'var(--skrift-lille)', color: 'var(--tekst-svag)' }}>{i + 1}.</span>
              <span style={{ fontSize: 'var(--skrift-knap)', color: 'var(--tekst)' }}>{l.navn}</span>
            </span>
            <span style={{ fontSize: 'var(--skrift-lille)', color: 'var(--tekst-dæmpet)', whiteSpace: 'nowrap' }}>
              {besoegstal(l)}
            </span>
          </>
        );

        const id = l.id;
        return aabn && id !== undefined ? (
          <button key={l.noegle} type="button" className="historik-grejrække" onClick={() => aabn(id)}>
            {indhold}
          </button>
        ) : (
          <div key={l.noegle} className="historik-grejrække historik-grejrække-stille">{indhold}</div>
        );
      })}
    </div>
  );
}

// En måned som en vandret bjælke. Vandret og ikke lodret, fordi tallet skal
// kunne læses ved siden af navnet — en søjlegraf med tre søjler er en graf
// uden en pointe.
function Maanedsbjaelke({ navn, naetter, maks }: { navn: string; naetter: number; maks: number }) {
  return (
    <div className="historik-bjaelke">
      <div className="historik-bjaelke-linje">
        <span>{navn}</span>
        <span className={naetter === 0 ? 'historik-bjaelke-nul' : 'historik-bjaelke-tal'}>
          {naetter === 0 ? '0' : `${naetter} ${naetter === 1 ? 'nat' : 'nætter'}`}
        </span>
      </div>
      <div className="historik-bjaelke-spor">
        {naetter > 0 && (
          <div
            className="historik-bjaelke-fyld"
            style={{ width: `${Math.max((naetter / maks) * 100, 4)}%` }}
          />
        )}
      </div>
    </div>
  );
}

// Et navn og et tal, uden noget at klikke på. Turtyper har samme form — og de
// skal ikke gennem `Fordeling`, som skriver "kg" efter tallet.
function Andelsliste({ raekker }: { raekker: { navn: string; hoejre: string }[] }) {
  return (
    <div style={{ display: 'grid', gap: '7px' }}>
      {raekker.map((r) => (
        <div key={r.navn} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'baseline' }}>
          <span style={{ display: 'flex', gap: '10px', alignItems: 'baseline', minWidth: 0 }}>
            <span style={{ fontSize: 'var(--skrift-knap)' }}>{r.navn}</span>
          </span>
          <span style={{ fontSize: 'var(--skrift-lille)', color: 'var(--tekst-dæmpet)', whiteSpace: 'nowrap' }}>
            {r.hoejre}
          </span>
        </div>
      ))}
    </div>
  );
}

// En liste af grej med et tal til højre. Formen går igen — mest brugt,
// hyldevarer, bedste og dårligste — og stod før skrevet ud hver gang.
function Grejliste({ raekker, aabn, nummerer = false }: {
  raekker: { item: Item; hoejre: React.ReactNode }[];
  aabn: (id: number) => void;
  nummerer?: boolean;
}) {
  return (
    <div className="historik-grejliste">
      {raekker.map((r, i) => (
        <button
          key={r.item.uid}
          type="button"
          className="historik-grejrække"
          onClick={() => r.item.id !== undefined && aabn(r.item.id)}
        >
          <span style={{ display: 'flex', gap: '10px', alignItems: 'baseline', minWidth: 0 }}>
            {nummerer && (
              <span style={{ fontSize: 'var(--skrift-lille)', color: 'var(--tekst-svag)' }}>{i + 1}.</span>
            )}
            <span style={{ fontSize: 'var(--skrift-knap)', color: 'var(--tekst)' }}>
              {r.item.navn || 'Uden navn'}
            </span>
          </span>
          <span style={{ fontSize: 'var(--skrift-lille)', color: 'var(--tekst-dæmpet)', whiteSpace: 'nowrap' }}>
            {r.hoejre}
          </span>
        </button>
      ))}
    </div>
  );
}

function Widget({ titel, children, bred, advarsel }: {
  titel: string;
  children: React.ReactNode;
  // Spænder over begge kolonner på PC.
  bred?: boolean;
  advarsel?: boolean;
}) {
  return (
    <div style={{
      gridColumn: bred ? '1 / -1' : 'auto',
      border: `1px solid ${advarsel ? 'var(--advarsel-border)' : 'var(--border-svag)'}`,
      borderRadius: 'var(--runding-lille)',
      padding: '13px 14px',
      background: advarsel ? 'var(--advarsel-bg)' : 'var(--bg-forhoejet)'
    }}>
      <div style={{
        fontSize: 'var(--skrift-mikro)',
        color: advarsel ? 'var(--advarsel)' : 'var(--tekst-dæmpet)',
        textTransform: 'uppercase',
        letterSpacing: '0.6px',
        fontWeight: 600,
        marginBottom: '8px'
      }}>
        {advarsel && '⚠ '}{titel}
      </div>
      {children}
    </div>
  );
}

function Tal({ vaerdi, enhed, advarsel }: { vaerdi: string; enhed?: string; advarsel?: boolean }) {
  return (
    <div style={{
      fontSize: '26px',
      fontWeight: 500,
      fontFamily: "'Fraunces', Georgia, serif",
      color: advarsel ? 'var(--advarsel)' : 'var(--tekst)'
    }}>
      {vaerdi}
      {enhed && <span style={{ fontSize: 'var(--skrift-brod)', color: 'var(--tekst-dæmpet)' }}> {enhed}</span>}
    </div>
  );
}

function Undertekst({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 'var(--skrift-lille)', color: 'var(--tekst-dæmpet)', marginTop: '4px' }}>{children}</div>
  );
}

function Fordeling({ fordeling }: { fordeling: { navn: string; vaegt: number; procent: number }[] }) {
  // Resten af søjlen er gear uden for de viste grupper. Uden den linje står en
  // fjerdedel af grafen grå og uforklaret. Et item kan ligge i flere grupper,
  // så summen kan overstige 100 — og så er der ingen rest at vise.
  const daekket = fordeling.reduce((s, g) => s + g.procent, 0);
  const rest = 100 - daekket;

  return (
    <div>
      <div style={{ display: 'flex', height: '8px', borderRadius: '4px', overflow: 'hidden', marginBottom: '11px', background: 'var(--border-svag)' }}>
        {fordeling.map((g, i) => (
          <div
            key={g.navn}
            title={`${g.navn}: ${g.procent.toFixed(0)}%`}
            style={{
              width: `${g.procent}%`,
              background: 'var(--accent)',
              opacity: 1 - i * 0.15,
              borderRight: i < fordeling.length - 1 ? '1px solid var(--bg-forhoejet)' : 'none'
            }}
          />
        ))}
      </div>

      <div style={{ display: 'grid', gap: '6px' }}>
        {fordeling.map((g, i) => (
          <div key={g.navn} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '10px' }}>
            <span style={{ display: 'flex', gap: '8px', alignItems: 'center', minWidth: 0 }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'var(--accent)', opacity: 1 - i * 0.15, flexShrink: 0 }} />
              <span style={{ fontSize: 'var(--skrift-knap)', color: 'var(--tekst)' }}>{g.navn}</span>
            </span>
            <span style={{ fontSize: 'var(--skrift-lille)', color: 'var(--tekst-dæmpet)', whiteSpace: 'nowrap' }}>
              {kilo(g.vaegt, 1)} kg · {g.procent.toFixed(0)}%
            </span>
          </div>
        ))}

        {rest >= 0.5 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '10px' }}>
            <span style={{ display: 'flex', gap: '8px', alignItems: 'center', minWidth: 0 }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'var(--border-svag)', flexShrink: 0 }} />
              <span style={{ fontSize: 'var(--skrift-knap)', color: 'var(--tekst-dæmpet)' }}>Uden for grupperne</span>
            </span>
            <span style={{ fontSize: 'var(--skrift-lille)', color: 'var(--tekst-dæmpet)', whiteSpace: 'nowrap' }}>
              {rest.toFixed(0)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// "Vis liste" folder de ubrugte items ud i stedet for at sende brugeren
// videre — der er ingen skærm der viser præcis dette udvalg.
function Udfoldelig({ items, aabn }: { items: Item[]; aabn: (id: number) => void }) {
  const [aaben, setAaben] = useState(false);

  return (
    <div style={{ marginTop: '10px' }}>
      <button
        onClick={() => setAaben(!aaben)}
        aria-expanded={aaben}
        style={{
          background: 'transparent',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          fontSize: 'var(--skrift-detalje)',
          fontWeight: 500,
          color: 'var(--advarsel)'
        }}
      >
        {aaben ? 'Skjul liste' : 'Vis liste →'}
      </button>

      {aaben && (
        <div style={{ display: 'grid', gap: '5px', marginTop: '9px' }}>
          {items.map((item) => (
            <button
              key={item.uid}
              onClick={() => item.id !== undefined && aabn(item.id)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: '10px',
                background: 'transparent',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: 'var(--skrift-detalje)',
                color: 'var(--tekst)'
              }}
            >
              <span>{item.navn || 'Uden navn'}</span>
              <span style={{ color: 'var(--tekst-dæmpet)', whiteSpace: 'nowrap' }}>
                {item.vaegt_g} g
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Hjælpere
// ─────────────────────────────────────────────

// Linjen under inventarværdien: hvor meget der kom til i perioden. Under
// "alle år" er der ingen periode at måle tilvæksten i, og så siger vægten mere.
function tilvaekstTekst(tilvaekst: number | null, vaegt: number): string {
  if (tilvaekst === null) return `${kilo(vaegt, 1)} kg i alt`;

  // Uden en købsdato kan et stykke gear ikke placeres i et år. Er der ingen
  // daterede køb, er nul ikke det samme som "du købte ikke noget".
  if (tilvaekst === 0) return 'Ingen daterede køb i perioden';

  return `+${kroner(tilvaekst)} kr vs. sidste år`;
}

function kroner(beloeb: number): string {
  return Math.round(beloeb).toLocaleString('da-DK');
}

export default StatistikPanel;
