import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import type { Gruppe } from './db';
import { opretGruppe } from './sync';
import GruppeDetalje from './GruppeDetalje';
import { Skal } from './Skal';
import type { Fane } from './Skal';
import { Knap, TagChips, ListeRaekke, TomListe } from './ui';

interface Props {
  fane: Fane;
  skift: (f: Fane) => void;
}

function GrupperListe({ fane, skift }: Props) {
  const [valgtGruppe, setValgtGruppe] = useState<{ id: number; ny: boolean } | null>(null);

  const grupper = useLiveQuery(() => db.grupper.toArray());
  const items = useLiveQuery(() => db.items.toArray());

  if (valgtGruppe !== null) {
    return (
      <Skal fane={fane} skift={skift}>
        <GruppeDetalje
          gruppeId={valgtGruppe.id}
          nyOprettet={valgtGruppe.ny}
          tilbage={() => setValgtGruppe(null)}
        />
      </Skal>
    );
  }

  // Opretter en tom gruppe og går direkte ind i den, så navn, tags og gear
  // vælges ét sted. Forlades den uden navn, ryddes den væk igen.
  const nyGruppe = async () => {
    const nu = new Date();
    const id = await opretGruppe({
      navn: '',
      tags: [],
      item_ids: [],
      noter: '',
      oprettet: nu,
      aendret: nu
    });
    setValgtGruppe({ id, ny: true });
  };

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
            onClick={() => g.id !== undefined && setValgtGruppe({ id: g.id, ny: false })}
          >
            <TagChips tags={g.tags} maks={5} />
          </ListeRaekke>
        );
      })}
    </Skal>
  );
}

export default GrupperListe;
