import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import type { Gruppe } from './db';
import { Skal } from './Skal';
import type { Fane } from './Skal';
import { Knap, TagChips, ListeRaekke, TomListe } from './ui';

interface Props {
  fane: Fane;
  skift: (f: Fane) => void;
  aabnGruppe: (id: number, nyOprettet?: boolean) => void;
  nyGruppe: () => void;
}

function GrupperListe({ fane, skift, aabnGruppe, nyGruppe }: Props) {
  const grupper = useLiveQuery(() => db.grupper.toArray());
  const items = useLiveQuery(() => db.items.toArray());

  const beregnInfo = (g: Gruppe) => {
    const gItems = items?.filter((i) => g.item_ids.includes(i.uid)) ?? [];
    return { antal: gItems.length, vaegt: gItems.reduce((s, i) => s + i.vaegt_g, 0) };
  };

  return (
    <Skal
      fane={fane}
      skift={skift}
      titel="Grupper"
      undertitel={`${grupper?.length ?? 0} grupper`}
      handlinger={<Knap variant="primaer" onClick={nyGruppe}>+ Ny gruppe</Knap>}
      fab={nyGruppe}
    >
      {grupper?.length === 0 && <TomListe>Ingen grupper endnu. Opret din første.</TomListe>}
      {grupper?.map((g) => {
        const info = beregnInfo(g);
        return (
          <ListeRaekke
            key={g.uid}
            titel={g.navn}
            detalje={`${info.antal} items · ${(info.vaegt / 1000).toFixed(1)} kg`}
            onClick={() => g.id !== undefined && aabnGruppe(g.id)}
          >
            <TagChips tags={g.tags} maks={5} />
          </ListeRaekke>
        );
      })}
    </Skal>
  );
}

export default GrupperListe;
