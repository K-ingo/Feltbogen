// Hvor en henvisning lander i indstillingerne.
//
// Samme regel som `turmaal.ts`, på den anden af de to skærme der samler flere
// ting: peger appen på noget, skal man lande dér, hvor det kan gøres.
//
// Den blev nødvendig af en anden grund end vægtforslaget. Specens §2.5 og §18
// vil have Skabeloner, Synkronisering, Backup, Import og Hjælp som rækker
// under Mere, og de findes alle sammen — som afsnit inde i Indstillinger. Det
// er præcis det, §2 forbyder: "Hovedfunktioner må ikke gemmes i dropdowns fra
// andre hovedfunktioner."
//
// Man kan løse det på to måder: skære Indstillinger op i fem skærme, eller
// give Mere rækker der fører direkte ned i det rigtige afsnit. Det sidste er
// valgt. Fem skærme med ét afsnit hver er ikke en bedre struktur — det er den
// samme struktur med flere sider imellem, og afsnittene hører sammen: man går
// til indstillingerne for at rette noget, ikke for at læse ét felt.
export type Indstillingsmaal =
  | 'konto'
  | 'synkronisering'
  | 'skabeloner'
  | 'data'
  | 'om';

export const MAALETS_TITEL: Record<Indstillingsmaal, string> = {
  konto: 'Konto',
  synkronisering: 'Synkronisering',
  skabeloner: 'Skabeloner',
  data: 'Backup, eksport og import',
  om: 'Hjælp og om Feltbogen'
};
