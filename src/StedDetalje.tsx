import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import type { Sted } from './db';
import TagsInput from './TagsInput';
import { besoegstekst, turePaaSted } from './steder';
import { heroForSted } from './billeder';
import { Billedvisning } from './BilledSektion';
import { soegSted } from './smartMotor';
import type { StedForslag } from './smartMotor';
import { formatterPeriode, siden } from './datotekst';
import { sletSted, opdaterSted } from './sync';
import { meldFortrydelse } from './fortryd';
import { useRedigerbar } from './useRedigerbar';
import { layout } from './layout';
import {
  DetaljeHeader,
  Felt,
  Indlaeser,
  Knap,
  Kort,
  Label,
  ListeRaekke,
  SektionsTitel,
  Stjerner,
  Tekstomraade,
  TitelInput
} from './ui';

interface Props {
  stedId: number;
  tilbage: () => void;
  aabnTur: (id: number) => void;
  // Opretter en tur med stedet udfyldt og åbner den. Specens §15 har knappen,
  // og den er den korteste vej fra "her vil jeg tilbage" til en tur.
  opretTurHer: (sted: Sted) => void;
  nyOprettet?: boolean;
}

// Et sted man kommer tilbage til. Noterne er det egentlige — "kildevand 200 m
// mod øst" er en oplysning man kun samler op ved at have været der, og som
// ellers går tabt mellem to ture.
function StedDetalje({ stedId, tilbage, aabnTur, opretTurHer, nyOprettet }: Props) {
  const { post: sted, opdater } = useRedigerbar(db.steder, stedId, opdaterSted, {
    onIndlaest: (fundet) => {
      if (fundet.koordinater) {
        setKoordinatTekst(`${fundet.koordinater.lat}, ${fundet.koordinater.lng}`);
      }
    }
  });

  const [koordinatTekst, setKoordinatTekst] = useState('');
  const [koordinatFejl, setKoordinatFejl] = useState('');
  const [forslag, setForslag] = useState<StedForslag[]>([]);
  const [soeger, setSoeger] = useState(false);

  const ture = useLiveQuery(() => db.ture.toArray()) ?? [];
  const billeder = useLiveQuery(() => db.billeder.toArray()) ?? [];

  const opdaterKoordinater = async (v: string) => {
    setKoordinatTekst(v);
    setKoordinatFejl('');

    if (v.trim() === '') {
      await opdater({ koordinater: null });
      return;
    }

    const koordinater = laesKoordinater(v);
    if (koordinater) {
      await opdater({ koordinater });
      return;
    }
    setKoordinatFejl('Format: 55.66, 10.05');
  };

  // Slår adressen op og henter koordinaterne, så man ikke skal finde dem selv.
  // Der søges på adressen når der står noget i den, ellers på navnet — "Rold
  // Skov" er lige så godt et opslag som en vejadresse.
  const soegning = () => (sted?.adresse.trim() || sted?.navn.trim() || '');

  const findKoordinater = async () => {
    const q = soegning();
    if (!q) return;

    setSoeger(true);
    setForslag([]);
    setKoordinatFejl('');

    const resultater = await soegSted(q);
    setSoeger(false);

    // Ét resultat er et svar, ikke et valg.
    if (resultater.length === 1) {
      await vaelgForslag(resultater[0]);
    } else if (resultater.length > 1) {
      setForslag(resultater);
    } else {
      setKoordinatFejl('Ingen resultater');
    }
  };

  const vaelgForslag = async (f: StedForslag) => {
    await opdater({
      koordinater: { lat: f.lat, lng: f.lng },
      // Har stedet ingen adresse endnu, er den fundne den bedste vi har.
      ...(sted?.adresse.trim() ? {} : { adresse: f.detalje || f.navn })
    });
    setKoordinatTekst(`${f.lat}, ${f.lng}`);
    setForslag([]);
    setKoordinatFejl('');
  };

  const slet = async () => {
    if (sted?.id === undefined) return;

    // Turene bliver stående; de mister bare koblingen og falder tilbage på
    // deres egen fritekst. Et sted man sletter er ikke en tur man aflyser.
    const besoeg = turePaaSted(ture, sted.uid).length;
    const detalje = besoeg > 0
      ? `${besoeg} ${besoeg === 1 ? 'tur' : 'ture'} mistede koblingen, men blev stående.`
      : undefined;

    const genskab = await sletSted(sted.id);
    if (genskab) meldFortrydelse({ slags: 'Stedet', navn: sted.navn, detalje, genskab });
    tilbage();
  };

  if (!sted) return <Indlaeser />;

  const besoegte = turePaaSted(ture, sted.uid);
  const stedbillede = heroForSted(billeder, ture, sted.uid);

  return (
    <div style={layout.container}>
      <DetaljeHeader tilbage={tilbage} sletLabel="Slet sted" slet={() => void slet()} />

      <TitelInput
        value={sted.navn}
        onChange={(v) => opdater({ navn: v })}
        placeholder="Navn på sted"
        autoFokus={nyOprettet}
      />

      {/* Stedets billede er forsiden fra det seneste besøg. Et sted har ingen
          billeder af sig selv — men det ser ud, som det gjorde sidst man var
          der, og dét billede findes allerede. */}
      {stedbillede && (
        <div style={{
          height: '180px',
          borderRadius: 'var(--runding)',
          overflow: 'hidden',
          marginBottom: 'var(--plads-4)',
          background: 'var(--border-svag)'
        }}>
          <Billedvisning billede={stedbillede} />
        </div>
      )}

      <div style={{ display: 'grid', gap: '14px', marginBottom: '24px' }}>
        <Kort fremhaevet>
          <div style={{ fontSize: 'var(--skrift-brod)', fontWeight: 500 }}>{besoegstekst(besoegte.length)}</div>
          {besoegte[0]?.startdato && (
            <div style={{ fontSize: 'var(--skrift-detalje)', color: 'var(--tekst-dæmpet)', marginTop: '2px' }}>
              {/* Datoen er svaret på hvornår; "for tre måneder siden" er
                  svaret på det man faktisk spørger om, når man står og
                  overvejer at tage tilbage. Begge dele står der — den ene er
                  præcis, den anden er til at mærke. */}
              {['Senest ' + formatterPeriode(besoegte[0].startdato, besoegte[0].slutdato),
                siden(besoegte[0].slutdato || besoegte[0].startdato)]
                .filter(Boolean).join(' · ')}
            </div>
          )}
        </Kort>

        <Felt
          label="Adresse"
          value={sted.adresse}
          onChange={(v) => opdater({ adresse: v })}
          placeholder="fx Rebild Skovhusevej, Skørping"
        />

        <div>
          <Label fejl={koordinatFejl || undefined}>Koordinater</Label>
          <div style={{ display: 'flex', gap: '6px' }}>
            <input
              value={koordinatTekst}
              onChange={(e) => void opdaterKoordinater(e.target.value)}
              placeholder="55.66, 10.05"
              style={{ flex: 1, minWidth: 0 }}
            />
            <Knap
              variant="primaer"
              onClick={() => void findKoordinater()}
              disabled={soeger || !soegning()}
            >
              {soeger ? 'Søger...' : 'Find'}
            </Knap>
          </div>
          <div style={{ fontSize: 'var(--skrift-lille)', color: 'var(--tekst-svag)', marginTop: '4px' }}>
            Find slår adressen op — eller navnet, hvis der ikke står en adresse.
          </div>

          {forslag.length > 0 && (
            <div style={{ marginTop: '6px', background: 'var(--bg)', border: '1px solid var(--border-svag)', borderRadius: '8px', overflow: 'hidden' }}>
              {forslag.map((f, i) => (
                <button
                  key={`${f.lat},${f.lng}`}
                  onClick={() => void vaelgForslag(f)}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '10px 12px',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: i < forslag.length - 1 ? '1px solid var(--border-svag)' : 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    color: 'var(--tekst)'
                  }}
                >
                  <div style={{ fontSize: 'var(--skrift-knap)', fontWeight: 500 }}>{f.navn}</div>
                  {f.detalje && <div style={{ fontSize: 'var(--skrift-lille)', color: 'var(--tekst-dæmpet)' }}>{f.detalje}</div>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Et sted bliver bedre at vurdere, jo flere gange man har været
            der. Derfor står den her og ikke i turens efterregnskab: den
            handler om stedet over tid, ikke om den ene tur. */}
        <div>
          <div style={{ fontSize: 'var(--skrift-lille)', color: 'var(--tekst-dæmpet)', marginBottom: '2px' }}>
            Din vurdering
          </div>
          <Stjerner
            vaerdi={sted.vurdering ?? null}
            saet={(v) => void opdater({ vurdering: v })}
            label={sted.navn || 'stedet'}
          />
        </div>

        <TagsInput
          tags={sted.tags}
          onChange={(nye) => opdater({ tags: nye })}
          hjaelpetekst="fx shelter, kildevand, bålplads"
        />

        <Tekstomraade
          label="Noter"
          value={sted.noter}
          onChange={(v) => opdater({ noter: v })}
          raekker={3}
          placeholder="fx myggeplaget i juli, kildevand 200 m mod øst"
        />
      </div>

      <div style={{ marginBottom: 'var(--plads-5)' }}>
        <Knap variant="primaer" onClick={() => opretTurHer(sted)}>Opret tur her</Knap>
      </div>

      <SektionsTitel>Ture hertil</SektionsTitel>
      {besoegte.length === 0 ? (
        <div style={{ fontSize: 'var(--skrift-knap)', color: 'var(--tekst-svag)', padding: '4px 0' }}>
          Ingen ture er knyttet til stedet endnu. Vælg det under "Sted" på en tur.
        </div>
      ) : (
        besoegte.map((tur) => (
          <ListeRaekke
            key={tur.uid}
            titel={tur.navn || 'Uden navn'}
            detalje={formatterPeriode(tur.startdato, tur.slutdato) || 'Ingen datoer'}
            onClick={() => tur.id !== undefined && aabnTur(tur.id)}
          />
        ))
      )}
    </div>
  );
}

// "55.66, 10.05" → koordinater, eller null hvis det ikke er et gyldigt par.
function laesKoordinater(tekst: string): { lat: number; lng: number } | null {
  const dele = tekst.split(',').map((s) => s.trim());
  if (dele.length !== 2) return null;

  const lat = parseFloat(dele[0]);
  const lng = parseFloat(dele[1]);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  return { lat, lng };
}

export default StedDetalje;
