import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { Gruppe, Item, Sted, Tur } from './db';
import { etiket } from './db';
import {
  turtal, gennemsnitsvaegt, bedsteGrej, daarligsteGrej, andelVurderet,
  hyldevarer, hyldevarevaegt, skroebeligtGrej, grundlag
} from './laering';
import { mestBesoegte, fordeling } from './aarsopgoerelse';
import { SektionsTitel } from './ui';
import { useErDesktop } from './useMedie';
import { kilo } from './talformat';
import {
  samletInventarvaerdi,
  samletVaegt,
  antalPrStatus,
  vaerditilvaekst,
  mestBrugte,
  ubrugteItems,
  fordelingPrGruppe
} from './statistik';
import {
  aarsvalgMuligheder,
  aldrigBrugt,
  historiktal,
  naetterPrMaaned,
  tureIAarsvalg
} from './friluftshistorik';
import type { Aarsvalg } from './friluftshistorik';
import { gennemsnit, snittekst } from './vurdering';

interface Props {
  ture: Tur[];
  items: Item[];
  grupper: Gruppe[];
  steder: Sted[];
  aabnItem: (id: number) => void;
}

// Statistik-panelet i friluftshistorikken.
//
// Skærmen var et instrumentbræt: en periodevælger og et dusin widgets i to
// kolonner, hvor de fire tal, man faktisk kom efter, lå spredt imellem dem.
// Referencen (docs/design/desktop/09-steder-statistik.html) vender det om —
// fire tal, nætterne pr. måned og det mest brugte grej øverst, i den ro en
// dagbog har. Ingen cirkeldiagrammer.
//
// Resten af tallene er ikke væk. De ligger under folden, hvor de kan slås op
// af den, der leder efter dem, uden at være det første man møder.
const MAANEDER = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];

const MAKS_MEST_BRUGTE = 5;

function StatistikPanel({ ture: alleTure, items, grupper, steder, aabnItem }: Props) {
  const erDesktop = useErDesktop();
  const muligheder = aarsvalgMuligheder(alleTure);
  const [valgtAar, setValgtAar] = useState<Aarsvalg>(muligheder[0]);

  // Har man fået sin første tur i et nyt år, mens skærmen stod åben, kan det
  // valgte år være et, der ikke står i vælgeren længere. Så er det nyeste år
  // det rigtige at vise — en markering, der ikke står nogen steder, er værre
  // end et skift, man kan se.
  const aar = muligheder.includes(valgtAar) ? valgtAar : muligheder[0];
  const ture = tureIAarsvalg(alleTure, aar);

  const tal = historiktal(ture, items);
  const maaneder = naetterPrMaaned(ture);
  const topBrugt = mestBrugte(items, ture, grupper, MAKS_MEST_BRUGTE);
  const rest = aldrigBrugt(items, ture, grupper);

  return (
    <div className="hist-panel">
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div className="hist-aar" role="group" aria-label="Vælg år">
          {muligheder.map((mulighed) => (
            <button
              key={String(mulighed)}
              type="button"
              aria-pressed={mulighed === aar}
              onClick={() => setValgtAar(mulighed)}
            >
              {mulighed === 'alle' ? 'Alle år' : mulighed}
            </button>
          ))}
        </div>
      </div>

      <div className="hist-kpi">
        <Kpi label="Ture" vaerdi={tal.ture} />
        <Kpi label="Nætter" vaerdi={tal.naetter} />
        <Kpi label="Grej i bog" vaerdi={tal.grej} />
        <Kpi label="Kg grej" vaerdi={kilo(tal.vaegt_g, 1)} />
      </div>

      {/* Ærligheden i de fire tal: to af dem følger året, to gør ikke. En
          sovepose, man købte i fjor, ligger der stadig. */}
      <p className="hist-fodnote">
        Ture og nætter er {aarstekst(aar)}. Grej i bog og kg grej er det, du ejer nu — de
        følger ikke året.
      </p>

      <div className="hist-kort">
        <p className="hist-label">Nætter pr. måned</p>
        {maaneder.length === 0 ? (
          <p className="hist-info-tekst">
            Ingen ture med en dato {aarstekst(aar)}. Sæt datoer på en tur, så kommer
            månederne her.
          </p>
        ) : (
          <>
            <Soejler maaneder={maaneder} />
            <p className="hist-fodnote" style={{ marginTop: 'var(--plads-4)' }}>
              {aar === 'alle'
                ? 'Alle år lagt sammen måned for måned — det er, når på året du kommer ud.'
                : 'Kun de måneder, du var ude i. Ingen cirkeldiagrammer.'}
            </p>
          </>
        )}
      </div>

      <div className="hist-kort hist-kort--liste">
        <div className="hist-liste-hoved">
          <p className="hist-label">Mest brugte grej</p>
        </div>
        {topBrugt.length === 0 && rest === 0 ? (
          <div className="hist-liste-raekke hist-liste-raekke--rest">
            Intet grej har været med på en tur {aarstekst(aar)} endnu.
          </div>
        ) : (
          <ul className="hist-liste">
            {topBrugt.map((brugt) => (
              <li key={brugt.item.uid}>
                <button
                  type="button"
                  className="hist-liste-raekke"
                  onClick={() => brugt.item.id !== undefined && aabnItem(brugt.item.id)}
                >
                  <span>{brugt.item.navn || 'Uden navn'}</span>
                  <span className="hist-liste-hoejre">
                    {brugt.antalTure} {brugt.antalTure === 1 ? 'tur' : 'ture'}
                  </span>
                </button>
              </li>
            ))}
            {rest > 0 && (
              <li>
                <div className="hist-liste-raekke hist-liste-raekke--rest">
                  <span>Resten</span>
                  <span className="hist-liste-hoejre">
                    {rest} {rest === 1 ? 'stykke' : 'stykker'} · aldrig brugt endnu
                  </span>
                </div>
              </li>
            )}
          </ul>
        )}
      </div>

      <Underfolden
        aar={aar}
        ture={ture}
        alleTure={alleTure}
        items={items}
        grupper={grupper}
        steder={steder}
        erDesktop={erDesktop}
        aabnItem={aabnItem}
      />
    </div>
  );
}

// "i 2026" / "i alt". Står i de sætninger, der skal kunne læses uden at man
// kigger op på vælgeren for at se, hvad de handler om.
function aarstekst(aar: Aarsvalg): string {
  return aar === 'alle' ? 'i alt' : `i ${aar}`;
}

function Kpi({ label, vaerdi }: { label: string; vaerdi: string | number }) {
  return (
    <div className="hist-kort">
      <p className="hist-label">{label}</p>
      <p className="hist-kpi-tal">{vaerdi}</p>
    </div>
  );
}

// Liggende søjler. Tallet står ved siden af navnet, så grafen ikke er det
// eneste, der siger det — en søjle på 17 % er ikke til at aflæse som 2 nætter.
function Soejler({ maaneder }: { maaneder: { maaned: number; naetter: number; ture: number }[] }) {
  const maks = Math.max(...maaneder.map((m) => m.naetter), 1);

  return (
    <div className="hist-soejler">
      {maaneder.map((m) => (
        <div key={m.maaned} className={m.naetter === 0 ? 'hist-soejle--tom' : undefined}>
          <div className="hist-soejle-hoved">
            <span>{MAANEDER[m.maaned]}</span>
            <span className="hist-soejle-tal">
              {m.naetter === 0
                ? `0 nætter · ${m.ture} ${m.ture === 1 ? 'dagstur' : 'dagsture'}`
                : `${m.naetter} ${m.naetter === 1 ? 'nat' : 'nætter'}`}
            </span>
          </div>
          <div className="hist-soejle-bane">
            {m.naetter > 0 && (
              <div
                className="hist-soejle-fyld"
                style={{ width: `${Math.max((m.naetter / maks) * 100, 4)}%` }}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// Under folden
//
// Det, referencen ikke tegner, men som stadig er sandt: inventarets værdi,
// det ubrugte grej og hvad turene har lært os. Det lå før øverst og gjorde
// skærmen til et instrumentbræt. Her kan det slås op af den, der leder efter
// det — og ingen af kortene har en fyldt accent.
// ─────────────────────────────────────────────

function Underfolden({ aar, ture, alleTure, items, grupper, steder, erDesktop, aabnItem }: {
  aar: Aarsvalg;
  ture: Tur[];
  alleTure: Tur[];
  items: Item[];
  grupper: Gruppe[];
  steder: Sted[];
  erDesktop: boolean;
  aabnItem: (id: number) => void;
}) {
  const antal = antalPrStatus(items);
  // Ubrugt måles altid mod hele turhistorikken — et snævrere vindue ville
  // udråbe gear som ubrugt bare fordi man kigger på et enkelt år.
  const ubrugt = ubrugteItems(items, alleTure, grupper);
  const gruppeFordeling = fordelingPrGruppe(items, grupper);
  // Kun det man ejer. Solgt grej siger ikke noget om, hvad man er glad for nu.
  const snit = gennemsnit(items.filter((i) => i.status === 'ejer'));
  // Under "Alle år" er der ikke noget enkelt år at måle tilvæksten i.
  const tilvaekst = aar === 'alle' ? null : vaerditilvaekst(items, aar);

  // Læringen deler sig i to, og det er ikke vilkårligt.
  //
  // Tallene om *året* — nætter, gennemsnitsvægt, hvor man var — beskriver det
  // udsnit, man kigger på, og følger derfor vælgeren.
  //
  // Mønstrene — hyldevarer, det der går i stykker — måles mod hele
  // turhistorikken. Samme grund som ubrugt gear ovenfor: et snævrere vindue
  // ville udråbe noget som en vane, bare fordi man kigger på et enkelt år.
  const tal = turtal(ture);
  const vaegt = gennemsnitsvaegt(ture, grupper, items);
  const besoegte = mestBesoegte(ture, steder).slice(0, 5);
  const turtyper = fordeling(ture, (t) => etiket(t.aktivitet));

  const laeringsgrundlag = grundlag(alleTure);
  const hylden = hyldevarer(items, alleTure);
  const skroebelige = skroebeligtGrej(items, alleTure);
  const bedste = bedsteGrej(items, 3);
  const daarligste = daarligsteGrej(items, 3);
  const vurderetAndel = andelVurderet(items);

  const gitter: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: erDesktop ? 'repeat(2, minmax(0, 1fr))' : '1fr',
    gap: '10px',
    alignItems: 'start'
  };

  return (
    <details className="hist-mere">
      <summary>Mere fra tallene</summary>

      <div style={{ marginTop: 'var(--plads-4)', ...gitter }}>
        <Widget titel="Inventarværdi">
          <Tal vaerdi={kroner(samletInventarvaerdi(items))} enhed="kr" />
          <Undertekst>{tilvaekstTekst(tilvaekst, aar, samletVaegt(items))}</Undertekst>
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
      </div>

      <div style={{ marginTop: 'var(--plads-5)' }}>
        <SektionsTitel>Hvad turene har lært os</SektionsTitel>
      </div>

      <div style={gitter}>
        <Widget titel={`Nætter ${aarstekst(aar)}`}>
          <Tal vaerdi={`${tal.naetter}`} enhed={tal.naetter === 1 ? 'nat' : 'nætter'} />
          <Undertekst>
            {[
              `${tal.ture} ${tal.ture === 1 ? 'tur' : 'ture'}`,
              tal.snit_naetter !== null ? `${tal.snit_naetter} pr. tur i snit` : null,
              tal.dagsture > 0 ? `${tal.dagsture} uden overnatning` : null
            ].filter(Boolean).join(' · ')}
          </Undertekst>
        </Widget>

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

        {besoegte.length > 0 && (
          <Widget titel="Mest besøgte steder">
            <Andelsliste
              nummerer
              raekker={besoegte.map((b) => ({
                navn: b.navn,
                hoejre: `${b.ture} ${b.ture === 1 ? 'tur' : 'ture'}`
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
    </details>
  );
}

// ─────────────────────────────────────────────
// Widgets
// ─────────────────────────────────────────────

// Et navn og et tal, uden noget at klikke på. Turtyper og steder har samme
// form — og de skal ikke gennem `Fordeling`, som skriver "kg" efter tallet.
function Andelsliste({ raekker, nummerer = false }: {
  raekker: { navn: string; hoejre: string }[];
  nummerer?: boolean;
}) {
  return (
    <div style={{ display: 'grid', gap: '7px' }}>
      {raekker.map((r, i) => (
        <div key={r.navn} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'baseline' }}>
          <span style={{ display: 'flex', gap: '10px', alignItems: 'baseline', minWidth: 0 }}>
            {nummerer && (
              <span style={{ fontSize: 'var(--skrift-lille)', color: 'var(--tekst-svag)' }}>{i + 1}.</span>
            )}
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

// En nummereret liste af grej med et tal til højre. Formen går igen —
// hyldevarer, bedste og dårligste — og stod før skrevet ud hver gang.
function Grejliste({ raekker, aabn, nummerer = true }: {
  raekker: { item: Item; hoejre: ReactNode }[];
  aabn: (id: number) => void;
  nummerer?: boolean;
}) {
  return (
    <div style={{ display: 'grid', gap: '7px' }}>
      {raekker.map((r, i) => (
        <button
          key={r.item.uid}
          onClick={() => r.item.id !== undefined && aabn(r.item.id)}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: '10px',
            background: 'transparent',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            textAlign: 'left'
          }}
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
  children: ReactNode;
  // Spænder over begge kolonner på PC.
  bred?: boolean;
  advarsel?: boolean;
}) {
  return (
    <div style={{
      gridColumn: bred ? '1 / -1' : 'auto',
      border: `1px solid ${advarsel ? 'var(--advarsel-border)' : 'var(--border-svag)'}`,
      borderRadius: '10px',
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

function Undertekst({ children }: { children: ReactNode }) {
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

// Linjen under inventarværdien: hvor meget der kom til i året. Under "Alle
// år" er der ingen periode at måle tilvæksten i, og så siger vægten mere.
function tilvaekstTekst(tilvaekst: number | null, aar: Aarsvalg, vaegt: number): string {
  if (tilvaekst === null) return `${kilo(vaegt, 1)} kg i alt`;

  // Uden en købsdato kan et stykke gear ikke placeres i et år. Er der ingen
  // daterede køb, er nul ikke det samme som "du købte ikke noget".
  if (tilvaekst === 0) return `Ingen daterede køb i ${aar}`;

  return `+${kroner(tilvaekst)} kr købt i ${aar}`;
}

function kroner(beloeb: number): string {
  return Math.round(beloeb).toLocaleString('da-DK');
}

export default StatistikPanel;
