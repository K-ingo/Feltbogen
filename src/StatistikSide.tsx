import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import type { Item } from './db';
import {
  turtal, gennemsnitsvaegt, bedsteGrej, daarligsteGrej, andelVurderet,
  hyldevarer, hyldevarevaegt, skroebeligtGrej, grundlag
} from './laering';
import { mestBesoegte, fordeling } from './aarsopgoerelse';
import { etiket } from './db';
import { Segment, SektionsTitel } from './ui';
import { Skal } from './Skal';
import type { Fane } from './Skal';
import { useErDesktop } from './useMedie';
import { kilo } from './talformat';
import {
  filtrererTure,
  samletInventarvaerdi,
  samletVaegt,
  antalPrStatus,
  vaerditilvaekst,
  tureFordeltPrMaaned,
  mestBrugte,
  ubrugteItems,
  fordelingPrGruppe
} from './statistik';
import type { Periode } from './statistik';
import { aarMedTure } from './aarsopgoerelse';
import { gennemsnit, snittekst } from './vurdering';

interface Props {
  fane: Fane;
  skift: (f: Fane) => void;
  aabnItem: (id: number, nyOprettet?: boolean) => void;
  aabnAar: (aar: number) => void;
}

const PERIODER: readonly Periode[] = ['i_aar', 'sidste_aar', 'alt'];
const PERIODE_LABEL: Record<Periode, string> = {
  i_aar: 'I år',
  sidste_aar: 'Sidste år',
  alt: 'Alt'
};

const MAANEDER = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
// Kun hver tredje måned får en etiket — tolv navne under en søjlegraf på en
// telefon bliver til grød.
const MAANED_ETIKETTER = [0, 3, 6, 9, 11];

const MAKS_MEST_BRUGTE = 5;

function StatistikSide({ fane, skift, aabnItem, aabnAar }: Props) {
  const erDesktop = useErDesktop();
  const [periode, setPeriode] = useState<Periode>('i_aar');

  const items = useLiveQuery(() => db.items.toArray()) ?? [];
  const alleTure = useLiveQuery(() => db.ture.toArray()) ?? [];
  const grupper = useLiveQuery(() => db.grupper.toArray()) ?? [];
  const aarene = aarMedTure(alleTure);

  const nu = new Date();
  const ture = filtrererTure(alleTure, periode);

  const antal = antalPrStatus(items);
  const topBrugt = mestBrugte(items, ture, grupper, MAKS_MEST_BRUGTE);
  // Ubrugt måles altid mod hele turhistorikken — et snævrere vindue ville
  // udråbe gear som ubrugt bare fordi man kigger på et enkelt år.
  const ubrugt = ubrugteItems(items, alleTure, grupper);
  const gruppeFordeling = fordelingPrGruppe(items, grupper);
  // Kun det man ejer. Solgt grej siger ikke noget om, hvad man er glad for nu.
  const snit = gennemsnit(items.filter((i) => i.status === 'ejer'));

  // "I år" sammenlignes med sidste år, "sidste år" med året før. Under "alt"
  // er der ikke noget at sammenligne med.
  const aar = periode === 'sidste_aar' ? nu.getFullYear() - 1 : nu.getFullYear();
  const tilvaekst = periode === 'alt' ? null : vaerditilvaekst(items, aar);

  // Læringen deler sig i to, og det er ikke vilkårligt.
  //
  // Tallene om *perioden* — nætter, dage, gennemsnitsvægt, hvor man var —
  // beskriver det udsnit, man kigger på, og følger derfor perioden.
  //
  // Mønstrene — hyldevarer, det der går i stykker — måles mod hele
  // turhistorikken. Samme grund som ubrugt gear ovenfor: et snævrere vindue
  // ville udråbe noget som en vane, bare fordi man kigger på et enkelt år.
  const tal = turtal(ture);
  const vaegt = gennemsnitsvaegt(ture, grupper, items);
  const steder = useLiveQuery(() => db.steder.toArray()) ?? [];
  const besoegte = mestBesoegte(ture, steder).slice(0, 5);
  const turtyper = fordeling(ture, (t) => etiket(t.aktivitet));

  const laeringsgrundlag = grundlag(alleTure);
  const hylden = hyldevarer(items, alleTure);
  const skroebelige = skroebeligtGrej(items, alleTure);
  const bedste = bedsteGrej(items, 3);
  const daarligste = daarligsteGrej(items, 3);
  const vurderetAndel = andelVurderet(items);

  if (items.length === 0 && alleTure.length === 0) {
    return (
      <Skal fane={fane} skift={skift} titel="Statistik">
        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--tekst-svag)', fontSize: 'var(--skrift-knap)' }}>
          Ingen tal endnu. Tilføj grej under Grej, så begynder det at fylde her.
        </div>
      </Skal>
    );
  }

  return (
    <Skal
      fane={fane}
      skift={skift}
      titel="Statistik"
      handlinger={
        <Segment vaerdier={PERIODER} valgt={periode} vaelg={(p) => setPeriode(p)} formater={(p) => PERIODE_LABEL[p]} kompakt />
      }
    >
      {!erDesktop && (
        <div style={{ marginBottom: '14px' }}>
          <Segment vaerdier={PERIODER} valgt={periode} vaelg={(p) => setPeriode(p)} formater={(p) => PERIODE_LABEL[p]} kompakt />
        </div>
      )}

      {/* Årsopgørelsen er den samme data læst som en beretning frem for som
          måleinstrumenter. Den ligger her, fordi det er her man i forvejen er
          når man vil vide hvordan det gik. */}
      {aarene.length > 0 && <Aarsknap aar={aarene[0]} aabn={() => aabnAar(aarene[0])} />}

      <div style={{
        display: 'grid',
        gridTemplateColumns: erDesktop ? 'repeat(2, minmax(0, 1fr))' : '1fr',
        gap: '10px',
        alignItems: 'start'
      }}>
        <Widget titel={`Ture ${PERIODE_LABEL[periode].toLowerCase()} — månedligt`} bred={erDesktop}>
          <Maanedsgraf
            maaneder={tureFordeltPrMaaned(ture)}
            // Måneder der ikke er kommet endnu står dæmpet, så en tom søjle
            // ikke ser ud som en måned man ikke kom afsted i.
            fremtidFra={periode === 'i_aar' ? nu.getMonth() + 1 : 12}
            antal={ture.length}
          />
        </Widget>

        <Widget titel="Inventarværdi">
          <Tal vaerdi={kroner(samletInventarvaerdi(items))} enhed="kr" />
          <Undertekst>{tilvaekstTekst(tilvaekst, periode, samletVaegt(items))}</Undertekst>
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

        {topBrugt.length > 0 && (
          <Widget titel="Mest brugte grej">
            <Grejliste
              raekker={topBrugt.map((x) => ({
                item: x.item,
                hoejre: `${x.antalTure} ${x.antalTure === 1 ? 'tur' : 'ture'}`
              }))}
              aabn={aabnItem}
            />
          </Widget>
        )}
      </div>

      <div style={{ marginTop: 'var(--plads-5)' }}>
        <SektionsTitel>Hvad turene har lært os</SektionsTitel>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: erDesktop ? 'repeat(2, minmax(0, 1fr))' : '1fr',
        gap: '10px',
        alignItems: 'start'
      }}>
        <Widget titel={`Nætter ${PERIODE_LABEL[periode].toLowerCase()}`}>
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
    </Skal>
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

// En nummereret liste af grej med et tal til højre. Formen går igen — mest
// brugt, hyldevarer, bedste og dårligste — og stod før skrevet ud hver gang.
function Grejliste({ raekker, aabn, nummerer = true }: {
  raekker: { item: Item; hoejre: React.ReactNode }[];
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
  children: React.ReactNode;
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

function Undertekst({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 'var(--skrift-lille)', color: 'var(--tekst-dæmpet)', marginTop: '4px' }}>{children}</div>
  );
}

function Maanedsgraf({ maaneder, fremtidFra, antal }: {
  maaneder: number[];
  fremtidFra: number;
  antal: number;
}) {
  const maks = Math.max(...maaneder, 1);

  return (
    <div>
      <div style={{ fontSize: 'var(--skrift-knap)', color: 'var(--tekst-dæmpet)', marginBottom: '10px' }}>
        {antal} {antal === 1 ? 'tur' : 'ture'}
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '72px' }}>
        {maaneder.map((n, i) => (
          <div
            key={i}
            title={`${MAANEDER[i]}: ${n} ${n === 1 ? 'tur' : 'ture'}`}
            style={{
              flex: 1,
              height: n > 0 ? `${Math.max((n / maks) * 100, 6)}%` : '2px',
              borderRadius: '3px 3px 0 0',
              background: n > 0 ? 'var(--accent)' : 'var(--border-svag)',
              opacity: i >= fremtidFra ? 0.35 : 1
            }}
          />
        ))}
      </div>

      <div style={{ display: 'flex', gap: '4px', marginTop: '5px' }}>
        {maaneder.map((_, i) => (
          <div key={i} style={{ flex: 1, fontSize: '9px', color: 'var(--tekst-svag)', textAlign: 'center' }}>
            {MAANED_ETIKETTER.includes(i) ? MAANEDER[i] : ''}
          </div>
        ))}
      </div>
    </div>
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

// Linjen under inventarværdien: hvor meget der kom til i perioden. Under
// "alt" er der ingen periode at måle tilvæksten i, og så siger vægten mere.
function tilvaekstTekst(tilvaekst: number | null, periode: Periode, vaegt: number): string {
  if (tilvaekst === null) return `${kilo(vaegt, 1)} kg i alt`;

  const label = periode === 'sidste_aar' ? 'vs. året før' : 'vs. sidste år';
  // Uden en købsdato kan et stykke gear ikke placeres i et år. Er der ingen
  // daterede køb, er nul ikke det samme som "du købte ikke noget".
  if (tilvaekst === 0) return 'Ingen daterede køb i perioden';

  return `+${kroner(tilvaekst)} kr ${label}`;
}

function kroner(beloeb: number): string {
  return Math.round(beloeb).toLocaleString('da-DK');
}

function Aarsknap({ aar, aabn }: { aar: number; aabn: () => void }) {
  return (
    <button
      onClick={aabn}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        width: '100%',
        padding: '14px 16px',
        marginBottom: '14px',
        borderRadius: '12px',
        background: 'var(--accent-bg)',
        border: '1px solid var(--accent-border)',
        cursor: 'pointer',
        textAlign: 'left',
        color: 'var(--tekst)'
      }}
    >
      <span>
        <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: '17px' }}>
          Årsopgørelse {aar}
        </span>
        <span style={{ display: 'block', fontSize: 'var(--skrift-detalje)', color: 'var(--tekst-dæmpet)', marginTop: '2px' }}>
          Året talt op — nætter, steder, selskab og grej
        </span>
      </span>
      <span style={{ color: 'var(--accent)', fontSize: '18px' }}>›</span>
    </button>
  );
}

export default StatistikSide;
