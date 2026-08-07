import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import TagsInput from './TagsInput';
import { besoegstekst, turePaaSted } from './steder';
import { formatterPeriode } from './datotekst';
import { sletSted, opdaterSted } from './sync';
import { useRedigerbar } from './useRedigerbar';
import { layout } from './layout';
import {
  DetaljeHeader,
  Felt,
  Indlaeser,
  Kort,
  Label,
  ListeRaekke,
  SektionsTitel,
  Tekstomraade,
  TitelInput
} from './ui';

interface Props {
  stedId: number;
  tilbage: () => void;
  aabnTur: (id: number) => void;
  nyOprettet?: boolean;
}

// Et sted man kommer tilbage til. Noterne er det egentlige — "kildevand 200 m
// mod øst" er en oplysning man kun samler op ved at have været der, og som
// ellers går tabt mellem to ture.
function StedDetalje({ stedId, tilbage, aabnTur, nyOprettet }: Props) {
  const { post: sted, opdater } = useRedigerbar(db.steder, stedId, opdaterSted, {
    onIndlaest: (fundet) => {
      if (fundet.koordinater) {
        setKoordinatTekst(`${fundet.koordinater.lat}, ${fundet.koordinater.lng}`);
      }
    }
  });

  const [koordinatTekst, setKoordinatTekst] = useState('');
  const [koordinatFejl, setKoordinatFejl] = useState('');

  const ture = useLiveQuery(() => db.ture.toArray()) ?? [];

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

  const slet = async () => {
    if (sted?.id === undefined) return;

    // Turene bliver stående; de mister bare koblingen og falder tilbage på
    // deres egen fritekst. Et sted man sletter er ikke en tur man aflyser.
    const besoeg = turePaaSted(ture, sted.uid).length;
    const advarsel = besoeg > 0
      ? `Slet stedet "${sted.navn}"? ${besoeg} ${besoeg === 1 ? 'tur' : 'ture'} mister koblingen, men bliver stående.`
      : `Slet stedet "${sted.navn}"?`;

    if (!confirm(advarsel)) return;
    await sletSted(sted.id);
    tilbage();
  };

  if (!sted) return <Indlaeser />;

  const besoegte = turePaaSted(ture, sted.uid);

  return (
    <div style={layout.container}>
      <DetaljeHeader tilbage={tilbage} sletLabel="Slet sted" slet={() => void slet()} />

      <TitelInput
        value={sted.navn}
        onChange={(v) => opdater({ navn: v })}
        placeholder="Navn på sted"
        autoFokus={nyOprettet}
      />

      <div style={{ display: 'grid', gap: '14px', marginBottom: '24px' }}>
        <Kort fremhaevet>
          <div style={{ fontSize: '14px', fontWeight: 500 }}>{besoegstekst(besoegte.length)}</div>
          {besoegte[0]?.startdato && (
            <div style={{ fontSize: '12px', color: 'var(--tekst-dæmpet)', marginTop: '2px' }}>
              Senest {formatterPeriode(besoegte[0].startdato, besoegte[0].slutdato)}
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
          <input
            value={koordinatTekst}
            onChange={(e) => void opdaterKoordinater(e.target.value)}
            placeholder="55.66, 10.05"
            style={{ width: '100%' }}
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

      <SektionsTitel>Ture hertil</SektionsTitel>
      {besoegte.length === 0 ? (
        <div style={{ fontSize: '13px', color: 'var(--tekst-svag)', padding: '4px 0' }}>
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
