// Fanerne på en delt tur.
//
// En gæst skal have den samme mentale model som ejeren: samme faner, samme
// sted, samme udseende. Ikke en gæstenavigation ved siden af — så bliver
// ejer- og gæsteoplevelsen til to produkter, der driver fra hinanden.
//
// Men det er ejerens faner *filtreret*, ikke kopieret. Ejeren har seks; her er
// der fire, og de to, der mangler, mangler af samme grund:
//
// **Pakning** er ejerens arbejde med at vælge og fordele grej, og fremdriften
// måles på `pakkede_item_uids`, som ikke er med i snapshottet. En fane, der
// altid stod tom, ville love noget, appen ikke holder.
//
// **Praktisk** er budget, booking og turkort — ejerens egne papirer. De skal
// ikke deles, og de er heller ikke i snapshottet.
//
// Til gengæld er der en fane, ejeren ikke har på samme måde: **Journal**.
// Ejeren skriver sine feltnoter under "Undervejs"; for dem, der var med, er
// journalen turens historie og fortjener sit eget sted.
export type Gaestefane = 'overblik' | 'pakkeliste' | 'deltagere' | 'journal';

export const GAESTEFANER: readonly { id: Gaestefane; label: string }[] = [
  { id: 'overblik', label: 'Overblik' },
  { id: 'pakkeliste', label: 'Pakkeliste' },
  { id: 'deltagere', label: 'Deltagere' },
  { id: 'journal', label: 'Journal' }
];
