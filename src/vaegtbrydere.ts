import type { Gruppe, Item, Reference, Tur } from './db';
import { itemUidsPaaTur, turensTags } from './smartMotor';
import { erGodtVurderet, vurderingAf, GODT, SKIDT } from './vurdering';

// Vægt-brydere: hvor kan sækken blive lettere?
//
// Vægt er noget af det gear overhovedet er lavet til at løse, og appen viser
// allerede totalen. Det her er skridtet videre: for hvert tungt stykke gear på
// turen, findes noget lettere i inventaret der kan det samme.
//
// Faren ved sådan et forslag er tåbeligheder — at foreslå en kniv i stedet for
// en sovepose, fordi de begge er tagget "bushcraft". Derfor er matchningen
// stram, og hvert forslag bærer sin egen begrundelse.

// Så meget lettere skal alternativet være, før det er værd at nævne. Under det
// er byttet ikke besværet værd.
export const MINDSTE_BESPARELSE = 0.2;

// Så mange tunge items kigges der på. Resten er ikke der vægten ligger.
const TOP = 5;

// Så mange alternativer pr. item. Er der flere, er det ikke et forslag
// længere — så er det en liste man skal igennem.
const MAKS_ALTERNATIVER = 3;

// Hvor sikkert byttet er.
//
// Specens §7.2 kræver, at hvert forslag bærer en risiko. Det er ikke en
// dekoration: uden den vejer et bytte, der bare er lettere, lige så tungt som
// et bytte, der kan det samme — og det er dét, der gør en motor til noget man
// holder op med at læse.
//
// Risikoen er regnet af det, appen faktisk ved: hvor stor en del af den tunges
// tags alternativet dækker, og hvad man selv har givet alternativet i
// stjerner. Ikke af hvor meget der spares — en stor besparelse er en gevinst,
// ikke en fare.
export type Risiko = 'lav' | 'mellem' | 'hoej';

export interface Alternativ {
  item: Item;
  sparet_g: number;
  // Hvor stor en del af vægten der spares, 0-1.
  andel: number;
  // Tags de to har til fælles. Det er dem der gør dem sammenlignelige.
  faelles: string[];
  // Hvor stor en del af den tunges tags alternativet dækker, 0-1. Det er den
  // eneste sammenlignelighed appen kan måle.
  daekning: number;
  risiko: Risiko;
  // Hvorfor risikoen er den, den er. Vises sammen med mærket, så det ikke
  // bare er en farve.
  konsekvens: string;
}

export interface Vaegtbryder {
  tung: Item;
  alternativer: Alternativ[];
  begrundelse: string;
}

// Kandidater til at erstatte ét stykke gear.
//
// Kravene er med vilje strenge: samme slags ting (mindst ét fælles tag), ejet,
// ikke allerede med på turen, og mærkbart lettere. Et forslag man må afvise
// hver gang, er værre end intet forslag.
export function alternativerTil(
  tung: Item,
  inventar: Item[],
  paaTuren: Set<Reference>
): Alternativ[] {
  if (tung.tags.length === 0 || tung.vaegt_g <= 0) return [];

  const graense = tung.vaegt_g * (1 - MINDSTE_BESPARELSE);

  return inventar
    .filter((i) => i.uid !== tung.uid)
    .filter((i) => i.status === 'ejer')
    .filter((i) => !paaTuren.has(i.uid))
    .filter((i) => i.vaegt_g > 0 && i.vaegt_g <= graense)
    .map((item) => {
      const faelles = item.tags.filter((t) => tung.tags.includes(t));
      const daekning = faelles.length / tung.tags.length;

      return {
        item,
        sparet_g: tung.vaegt_g - item.vaegt_g,
        andel: (tung.vaegt_g - item.vaegt_g) / tung.vaegt_g,
        faelles,
        daekning,
        ...vurderRisiko(tung, item, daekning)
      };
    })
    .filter((a) => a.faelles.length > 0)
    // Sikrest først, og derefter mest sparet. Rækkefølgen var før den
    // omvendte, og det holdt kun så længe man tog stilling til hvert forslag
    // for sig: det øverste alternativ er dét, "byt alle" tager, og en
    // knap der bytter fem ting på én gang, må ikke vælge det mest vovede
    // bytte, bare fordi det sparer to gram mere.
    .sort((a, b) =>
      (VOVETHED[a.risiko] - VOVETHED[b.risiko]) ||
      (b.sparet_g - a.sparet_g) ||
      (b.faelles.length - a.faelles.length)
    )
    .slice(0, MAKS_ALTERNATIVER);
}

const VOVETHED: Record<Risiko, number> = { lav: 0, mellem: 1, hoej: 2 };

// Risikoen ved ét bytte, og sætningen der forklarer den.
//
// Grænserne er sat, så "lav" faktisk betyder noget: alternativet skal dække
// alle den tunges tags, og man skal selv have sagt god for det. Alt det, appen
// ikke kan se — om teltet holder til blæsten, om posen er varm nok — bliver
// aldrig til "lav" af sig selv.
function vurderRisiko(tung: Item, let_: Item, daekning: number): { risiko: Risiko; konsekvens: string } {
  const stjerner = vurderingAf(let_);
  const mangler = tung.tags.filter((t) => !let_.tags.includes(t));

  if (stjerner !== null && stjerner <= SKIDT) {
    return {
      risiko: 'hoej',
      konsekvens: `Du har selv givet ${let_.navn} ${stjerner} ${stjerner === 1 ? 'stjerne' : 'stjerner'}. Lettere er ikke bedre, hvis det er noget du har været utilfreds med.`
    };
  }

  if (daekning < HALVDELEN) {
    return {
      risiko: 'hoej',
      konsekvens: `${let_.navn} mangler ${mangler.map(etikettekst).join(', ')} af det, ${tung.navn} er tagget med. De deler et tag, men de bruges ikke til det samme.`
    };
  }

  if (daekning === 1 && erGodtVurderet(let_)) {
    return {
      risiko: 'lav',
      konsekvens: `${let_.navn} dækker alt det, ${tung.navn} er tagget med, og du har selv givet den ${vurderingAf(let_)} stjerner.`
    };
  }

  if (daekning === 1) {
    return {
      risiko: 'mellem',
      konsekvens: `${let_.navn} dækker alt det, ${tung.navn} er tagget med, men du har ikke vurderet den endnu. Om den også kan det i praksis, ved kun du.`
    };
  }

  return {
    risiko: 'mellem',
    konsekvens: `${let_.navn} mangler ${mangler.map(etikettekst).join(', ')} i forhold til ${tung.navn}. Det kan være ligegyldigt på den her tur — det er det ikke altid.`
  };
}

// Halvdelen af tagsene. Under den er de to ting ikke i familie nok til at
// byttet kan kaldes andet end vovet.
const HALVDELEN = 0.5;

// Tags står som de er skrevet; kun turens egne kendetegn har pæne etiketter,
// og dem oversætter smartMotor. Her er det brugerens egne ord.
function etikettekst(tag: string): string {
  return `"${tag}"`;
}

// De tungeste stykker gear på turen der har et lettere alternativ i skabet.
export function vaegtbrydere(
  tur: Tur,
  grupper: Gruppe[],
  inventar: Item[],
  pakItems: Item[]
): Vaegtbryder[] {
  const paaTuren = itemUidsPaaTur(tur, grupper);

  return [...pakItems]
    // Grej man har sagt god for, foreslås ikke skiftet ud. Det er det ene
    // sted, hvor vurderingen betyder noget for et forslag: appen kender
    // ellers kun tags og gram, og på de to alene ligner en sovepose man
    // fryser i og en man sover godt i hinanden.
    .filter((i) => !erGodtVurderet(i))
    .sort((a, b) => b.vaegt_g - a.vaegt_g)
    .slice(0, TOP)
    .map((tung) => ({ tung, alternativer: alternativerTil(tung, inventar, paaTuren) }))
    .filter((v) => v.alternativer.length > 0)
    .map(({ tung, alternativer }) => ({
      tung,
      alternativer,
      begrundelse: `${tung.navn} er blandt de tungeste på turen. ${alternativer.length === 1 ? 'Et andet stykke gear' : `${alternativer.length} andre stykker gear`} i dit inventar deler mindst ét tag med den og vejer mindst ${Math.round(MINDSTE_BESPARELSE * 100)} % mindre. Om de faktisk kan det samme, er dit valg — motoren kender kun tags, gram og din egen vurdering: har du givet noget ${GODT} stjerner eller mere, holder den op med at foreslå at skifte det ud.`
    }));
}

// Hvor meget der kunne spares, hvis man tog det bedste bytte hver gang.
export function samletBesparelse(brydere: Vaegtbryder[]): number {
  return bedsteBytter(brydere).reduce((sum, b) => sum + b.sparet_g, 0);
}

// ─────────────────────────────────────────────
// Resultatet, som specens §7.2 beder om det
//
// Vægten som den er, vægten som den kunne blive, og hvad der skal til. Målet
// er ikke med: der findes ikke en målvægt i datamodellen, og et felt der
// altid står tomt, er et løfte appen ikke holder. Kommer der en målvægt på
// turen en dag, er det her, den hører hjemme.
//
// Automatisk fjernelse er aldrig tilladt, siger specen. Der er derfor ikke en
// funktion herinde der skriver noget: `byt` og `bytAlle` regner de nye
// felter ud, og skærmen gemmer dem, når nogen har trykket.
// ─────────────────────────────────────────────

export interface Vaegtresultat {
  nuvaerende_g: number;
  brydere: Vaegtbryder[];
  potentiel_besparelse_g: number;
}

export function vaegtresultat(
  tur: Tur,
  grupper: Gruppe[],
  inventar: Item[],
  pakItems: Item[]
): Vaegtresultat {
  const brydere = vaegtbrydere(tur, grupper, inventar, pakItems);

  return {
    nuvaerende_g: pakItems.reduce((sum, i) => sum + i.vaegt_g * Math.max(1, i.antal), 0),
    brydere,
    potentiel_besparelse_g: samletBesparelse(brydere)
  };
}

// ─────────────────────────────────────────────
// At tage imod et forslag
// ─────────────────────────────────────────────

export interface Bytte {
  tung: Item;
  lette: Item;
  sparet_g: number;
  risiko: Risiko;
}

// Det bedste bud pr. tungt stykke gear — ét bytte ad gangen, som "byt alle"
// ville tage dem.
//
// Det samme lette stykke gear kan sagtens være det bedste bud på to
// forskellige tunge ting. Det må det være hver for sig, men ikke på én gang:
// så ville to ting ryge ud af tasken og kun én komme ind, og man ville stå i
// skoven uden den ene. Første bytte vinder; det andet falder væk.
export function bedsteBytter(brydere: Vaegtbryder[]): Bytte[] {
  const brugte = new Set<Reference>();
  const bytter: Bytte[] = [];

  for (const { tung, alternativer } of brydere) {
    const bedste = alternativer.find((a) => !brugte.has(a.item.uid));
    if (!bedste) continue;

    brugte.add(bedste.item.uid);
    bytter.push({ tung, lette: bedste.item, sparet_g: bedste.sparet_g, risiko: bedste.risiko });
  }

  return bytter;
}

// Turen som den ser ud efter et eller flere bytter.
//
// Byttet er ikke bare "tilføj det lette". Det var det, appen kunne før, og så
// stod man med begge dele på pakkelisten og en vægt der var gået op i stedet
// for ned — resten skulle man selv huske. Her ryger den tunge ud af det løse
// grej, ud af tasken, og af hos den der skulle bære den.
//
// Kommer den tunge med via et grejsæt, kan den ikke fjernes fra turen alene:
// et sæt er valgt som et sæt. Så lægges den lette til, og den tunge bliver —
// og det er dét, `uloeste` fortæller skærmen, så den kan sige det højt frem
// for at lade som om byttet var helt.
export interface Bytteresultat {
  aendringer: Partial<Tur>;
  uloeste: Item[];
}

export function byt(tur: Tur, bytter: Bytte[]): Bytteresultat {
  const loese = new Set(tur.loese_item_ids);
  const pakkede = new Set(tur.pakkede_item_uids ?? []);
  const uloeste: Item[] = [];
  const fjernede = new Set<Reference>();

  for (const { tung, lette } of bytter) {
    loese.add(lette.uid);

    if (loese.has(tung.uid)) {
      loese.delete(tung.uid);
      pakkede.delete(tung.uid);
      fjernede.add(tung.uid);
    } else {
      // Den tunge kom fra et grejsæt og bliver stående.
      uloeste.push(tung);
    }
  }

  const deltagere = fjernede.size === 0
    ? tur.deltagere
    : tur.deltagere.map((d) => ({
        ...d,
        personligt_gear_ids: d.personligt_gear_ids.filter((uid) => !fjernede.has(uid)),
        baerer_delt_ids: d.baerer_delt_ids.filter((uid) => !fjernede.has(uid))
      }));

  return {
    aendringer: {
      loese_item_ids: [...loese],
      pakkede_item_uids: [...pakkede],
      ...(fjernede.size > 0 ? { deltagere } : {})
    },
    uloeste
  };
}

// ─────────────────────────────────────────────
// Manglende tags
// ─────────────────────────────────────────────

// De af turens kendetegn som ingen gruppe er tagget med.
//
// Det løser en fejl man ellers aldrig opdager: "motoren foreslår aldrig noget
// til kanoture" — fordi ingen gruppe har tagget "kano". Motoren tier, og man
// tror den ikke har noget at sige.
export function manglendeTags(tur: Tur, grupper: Gruppe[]): string[] {
  const iBrug = new Set(grupper.flatMap((g) => g.tags));
  return [...turensTags(tur)].filter((t) => !iBrug.has(t));
}

// ─────────────────────────────────────────────
// Balanceret Gruppefordeling
// ─────────────────────────────────────────────

export interface GruppefordelingsForslag {
  deltager_id: string;
  navn: string;
  nuvaerende_vaegt_g: number;
  foreslaaet_vaegt_g: number;
  baerer_delt_ids: Reference[];
}

// Beregner en balanceret fordeling af fælles/delte items på deltagere.
// Returnerer forslag uden direkte at overskrive turens tilstand.
export function beregnBalanceretGruppefordeling(
  tur: Tur,
  pakItems: Item[]
): GruppefordelingsForslag[] {
  if (tur.deltagere.length === 0) return [];

  const delteItems = pakItems.filter((i) => i.delt);
  const deltagere = tur.deltagere.map((d) => ({
    id: d.id,
    navn: d.navn,
    personligt_vaegt_g: pakItems
      .filter((i) => d.personligt_gear_ids.includes(i.uid))
      .reduce((s, i) => s + i.vaegt_g, 0),
    baerer_delt_ids: [...d.baerer_delt_ids]
  }));

  // Nulstil fælles bæreansvar for forslaget
  const forslagMap = new Map<string, { vaegt: number; delt_ids: Reference[] }>();
  deltagere.forEach((d) => {
    forslagMap.set(d.id, { vaegt: d.personligt_vaegt_g, delt_ids: [] });
  });

  // Sorter delte items efter vægt (tungest først)
  const sorteredeDelte = [...delteItems].sort((a, b) => b.vaegt_g - a.vaegt_g);

  // Greedy tildeling til den deltager der pt har mindst vægt
  for (const item of sorteredeDelte) {
    let letteDeltagerId = deltagere[0].id;
    let minVaegt = Infinity;

    for (const d of deltagere) {
      const nuv = forslagMap.get(d.id)!.vaegt;
      if (nuv < minVaegt) {
        minVaegt = nuv;
        letteDeltagerId = d.id;
      }
    }

    const nuvObj = forslagMap.get(letteDeltagerId)!;
    nuvObj.vaegt += item.vaegt_g;
    nuvObj.delt_ids.push(item.uid);
  }

  return tur.deltagere.map((d) => {
    const personligtV = pakItems
      .filter((i) => d.personligt_gear_ids.includes(i.uid))
      .reduce((s, i) => s + i.vaegt_g, 0);

    const eksisterendeDeltV = pakItems
      .filter((i) => d.baerer_delt_ids.includes(i.uid))
      .reduce((s, i) => s + i.vaegt_g, 0);

    const f = forslagMap.get(d.id)!;

    return {
      deltager_id: d.id,
      navn: d.navn,
      nuvaerende_vaegt_g: personligtV + eksisterendeDeltV,
      foreslaaet_vaegt_g: f.vaegt,
      baerer_delt_ids: f.delt_ids
    };
  });
}
