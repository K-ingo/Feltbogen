import { db } from './db';
import { pb, nuvaerendeBruger } from './pb';
import type { Item, Gruppe, Tur } from './db';

const MIGRATIONS_NOEGLE = 'feltbogen_migreret_v1';

interface MedPbId {
  pb_id?: string;
}

// Uploader alle eksisterende items/grupper/ture til PocketBase
// Kaldes én gang efter første login
export async function migrerHvisNoedvendigt(): Promise<{ migreret: boolean; antal?: number }> {
  const bruger = nuvaerendeBruger();
  if (!bruger) return { migreret: false };

  const noegle = `${MIGRATIONS_NOEGLE}_${bruger.id}`;
  if (localStorage.getItem(noegle)) {
    return { migreret: false };
  }

  const items = await db.items.toArray();
  const grupper = await db.grupper.toArray();
  const ture = await db.ture.toArray();

  const itemsUdenPbId = items.filter((i) => !(i as any).pb_id);
  const grupperUdenPbId = grupper.filter((g) => !(g as any).pb_id);
  const tureUdenPbId = ture.filter((t) => !(t as any).pb_id);

  const total = itemsUdenPbId.length + grupperUdenPbId.length + tureUdenPbId.length;
  if (total === 0) {
    localStorage.setItem(noegle, new Date().toISOString());
    return { migreret: false };
  }

  console.log(`Migrerer ${total} records til PocketBase...`);

  const idMapItem = new Map<number, string>();
  const idMapGruppe = new Map<number, string>();

  for (const item of itemsUdenPbId) {
    try {
      const skabt = await pb.collection('items').create({
        user: bruger.id,
        navn: item.navn,
        vaegt_g: item.vaegt_g,
        pris_kr: item.pris_kr,
        dimensioner: item.dimensioner,
        antal: item.antal,
        delt: item.delt,
        status: item.status,
        tags: item.tags,
        kraever: item.kraever,
        komplementer: item.komplementer,
        koebt_hos: item.koebt_hos,
        koebsdato: item.koebsdato,
        koebslink: item.koebslink,
        ordrenummer: item.ordrenummer,
        garanti: item.garanti,
        noter: item.noter
      });
      if (item.id) {
        await db.items.update(item.id, { pb_id: skabt.id } as any);
        idMapItem.set(item.id, skabt.id);
      }
    } catch (e) {
      console.error('Migration fejlede for item:', item.navn, e);
    }
  }

  for (const gruppe of grupperUdenPbId) {
    try {
      const skabt = await pb.collection('grupper').create({
        user: bruger.id,
        navn: gruppe.navn,
        tags: gruppe.tags,
        item_ids: gruppe.item_ids.map(String),
        noter: gruppe.noter
      });
      if (gruppe.id) {
        await db.grupper.update(gruppe.id, { pb_id: skabt.id } as any);
        idMapGruppe.set(gruppe.id, skabt.id);
      }
    } catch (e) {
      console.error('Migration fejlede for gruppe:', gruppe.navn, e);
    }
  }

  for (const tur of tureUdenPbId) {
    try {
      const skabt = await pb.collection('ture').create({
        user: bruger.id,
        navn: tur.navn,
        sted: tur.sted,
        koordinater: tur.koordinater,
        startdato: tur.startdato,
        slutdato: tur.slutdato,
        naetter: tur.naetter,
        personer: tur.personer,
        overnatning: tur.overnatning,
        aktivitet: tur.aktivitet,
        terraen: tur.terraen,
        baereafstand_km: tur.baereafstand_km,
        erfaring: tur.erfaring,
        status: tur.status,
        gruppe_ids: tur.gruppe_ids.map(String),
        loese_item_ids: tur.loese_item_ids.map(String),
        deltagere: tur.deltagere,
        budget_linjer: tur.budget_linjer,
        besked_fra_ejer: tur.besked_fra_ejer,
        noter: tur.noter,
        vejrsnapshot: tur.vejrsnapshot
      });
      if (tur.id) {
        await db.ture.update(tur.id, { pb_id: skabt.id } as any);
      }
    } catch (e) {
      console.error('Migration fejlede for tur:', tur.navn, e);
    }
  }

  localStorage.setItem(noegle, new Date().toISOString());
  console.log('Migration færdig');
  return { migreret: true, antal: total };
}

// Hent alle data fra PocketBase og synkroniser til lokal db
// Kaldes ved opstart hvis brugeren er logget ind
export async function hentFraPocketBase(): Promise<void> {
  const bruger = nuvaerendeBruger();
  if (!bruger) return;

  try {
    const [pbItems, pbGrupper, pbTure] = await Promise.all([
      pb.collection('items').getFullList({ filter: `user = "${bruger.id}"` }),
      pb.collection('grupper').getFullList({ filter: `user = "${bruger.id}"` }),
      pb.collection('ture').getFullList({ filter: `user = "${bruger.id}"` })
    ]);

    const lokaleItems = await db.items.toArray();
    const lokaleGrupper = await db.grupper.toArray();
    const lokaleTure = await db.ture.toArray();

    const lokalItemPbIds = new Set(lokaleItems.map((i) => (i as any).pb_id).filter(Boolean));
    const lokalGruppePbIds = new Set(lokaleGrupper.map((g) => (g as any).pb_id).filter(Boolean));
    const lokalTurPbIds = new Set(lokaleTure.map((t) => (t as any).pb_id).filter(Boolean));

    for (const pbItem of pbItems) {
      if (lokalItemPbIds.has(pbItem.id)) continue;
      const nytItem = {
        pb_id: pbItem.id,
        navn: pbItem.navn,
        vaegt_g: pbItem.vaegt_g || 0,
        pris_kr: pbItem.pris_kr || 0,
        dimensioner: pbItem.dimensioner || '',
        antal: pbItem.antal || 1,
        delt: pbItem.delt || false,
        status: pbItem.status || 'ejer',
        tags: pbItem.tags || [],
        kraever: pbItem.kraever || [],
        komplementer: pbItem.komplementer || [],
        koebt_hos: pbItem.koebt_hos || '',
        koebsdato: pbItem.koebsdato || '',
        koebslink: pbItem.koebslink || '',
        ordrenummer: pbItem.ordrenummer || '',
        garanti: pbItem.garanti || null,
        noter: pbItem.noter || '',
        oprettet: new Date(pbItem.created),
        aendret: new Date(pbItem.updated)
      } as Item & MedPbId;
      await db.items.add(nytItem as any);
    }

    for (const pbGruppe of pbGrupper) {
      if (lokalGruppePbIds.has(pbGruppe.id)) continue;
      const nyGruppe = {
        pb_id: pbGruppe.id,
        navn: pbGruppe.navn,
        tags: pbGruppe.tags || [],
        item_ids: (pbGruppe.item_ids || []).map(Number).filter((n: number) => !isNaN(n)),
        noter: pbGruppe.noter || '',
        oprettet: new Date(pbGruppe.created),
        aendret: new Date(pbGruppe.updated)
      } as Gruppe & MedPbId;
      await db.grupper.add(nyGruppe as any);
    }

    for (const pbTur of pbTure) {
      if (lokalTurPbIds.has(pbTur.id)) continue;
      const nyTur = {
        pb_id: pbTur.id,
        navn: pbTur.navn,
        sted: pbTur.sted || '',
        koordinater: pbTur.koordinater || null,
        startdato: pbTur.startdato || '',
        slutdato: pbTur.slutdato || '',
        naetter: pbTur.naetter || 0,
        personer: pbTur.personer || 1,
        overnatning: pbTur.overnatning || 'shelter',
        aktivitet: pbTur.aktivitet || 'bushcraft',
        terraen: pbTur.terraen || 'skov',
        baereafstand_km: pbTur.baereafstand_km || 0,
        erfaring: pbTur.erfaring || 'oevet',
        status: pbTur.status || 'kladde',
        gruppe_ids: (pbTur.gruppe_ids || []).map(Number).filter((n: number) => !isNaN(n)),
        loese_item_ids: (pbTur.loese_item_ids || []).map(Number).filter((n: number) => !isNaN(n)),
        deltagere: pbTur.deltagere || [],
        budget_linjer: pbTur.budget_linjer || [],
        besked_fra_ejer: pbTur.besked_fra_ejer || '',
        noter: pbTur.noter || '',
        vejrsnapshot: pbTur.vejrsnapshot || '',
        oprettet: new Date(pbTur.created),
        aendret: new Date(pbTur.updated)
      } as Tur & MedPbId;
      await db.ture.add(nyTur as any);
    }
  } catch (e) {
    console.error('Sync fejlede:', e);
  }
}