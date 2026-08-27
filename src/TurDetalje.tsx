import { useState, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, etiket, TUR_STATUS, OVERNATNING, AKTIVITET, TERRAEN, ERFARING, PAK_AF_NIVEAU } from './db';
import type {
  Item,
  Gruppe,
  Tur,
  Overnatning,
  Aktivitet,
  Terraen,
  Erfaring,
  Booking,
  Deltager,
  BudgetLinje,
  PakAfTjek,
  AfgangsTjek,
  Feltnote,
  Person,
  Sted,
  Reference
} from './db';
import {
  hentVejr,
  vejrIkonKode,
  beregnForbrug,
  findAdvarsler,
  advarslerPrItem,
  foreslaaGrupper,
  itemUidsPaaTur,
  pakkelisteEfterGruppe,
  pakkelisteEfterTag,
  baererAf,
  linjeAfItem,
  linjeAfMedbragt,
  linjerEfterPerson,
  medDeltagernes,
  afsnitAfItems,
  samletVaegt,
  overnatningsAdvarsler,
  vaegtPrDeltager,
  tildelGear,
  soegSted
} from './smartMotor';
import type { VejrDag, VejrData, StedForslag, Advarsel, Pakkelinje, Pakkeafsnit, Beregninger, Baerevaegt, GruppeForslag } from './smartMotor';
import {
  Badge,
  Chip,
  DetaljeHeader,
  Dropdown,
  Felt,
  FjernKnap,
  Hvorfor,
  Indlaeser,
  Infokort,
  Knap,
  Label,
  Segment,
  SektionsTitel,
  Talinput,
  Tekstomraade,
  TitelInput
} from './ui';
import PakAfTjekSide from './PakAfTjekSide';
import { Qrkode, Qrfuldskaerm } from './Qrkode';
import PaaTurTilstand from './PaaTurTilstand';
import {
  nytAfgangsTjek,
  fletSkabelonInd,
  fremdriftstekst,
  saetAfkrydset,
  saetTekst,
  tilfoejLinje,
  fjernLinje,
  laesSkabelon
} from './afgangsTjek';
import { nytTurkorttoken, lavTurkort, turkortLink, returtekst } from './turkort';
import {
  tilfoej as tilfoejFeltnote,
  saetTekst as saetFeltnote,
  fjern as fjernFeltnote,
  efterDag,
  tidstekst,
  resumetekst as feltnoteResume
} from './feltnoter';
import {
  foreslaaPersoner,
  antalTurePrPerson,
  deltagerFraPerson,
  deltagerFraNavn
} from './personer';
import { foreslaaSteder, sorterEfterBesoeg, besoegPrSted, besoegstekst, naermesteSted } from './steder';
import { udlaansAdvarsler } from './udlaan';
import { vaegtresultat, bedsteBytter, byt, manglendeTags } from './vaegtbrydere';
import type { Vaegtresultat, Risiko, Bytte } from './vaegtbrydere';
import { foreslaaKopi, kopierGrej, antalNye } from './ligesomSidst';
import type { Kopiforslag } from './ligesomSidst';
import { nytPakAfTjek, synkroniserLinjer, resumetekst } from './pakAfTjek';
import { turfase } from './turfase';
import type { Turfase } from './turfase';
import {
  pakkede,
  veksl as vekslPakket,
  pakAlle,
  ryd as rydPakning,
  fremdrift as pakkefremdrift,
  fremdriftstekst as pakketekst
} from './pakning';
import type { Pakkefremdrift } from './pakning';
import { useValg, useKropsdata, useTekst, PAK_AF_NIVEAU_VALG, AFGANGS_SKABELON } from './indstillinger';
import { nytDeletoken, lavSnapshot, deleLink, linkadvarsel, linkvaert } from './gaest';
import { formatterPeriode } from './datotekst';
import { hentDeltagelser, baererePrGear, visningsnavn } from './deltagelse';
import type { Deltagelse } from './deltagelse';
import { layout } from './layout';
import { useErDesktop, useErBredskaerm } from './useMedie';
import { sletTur, opdaterTur } from './sync';
import { meldSletning } from './fortryd';
import { soltider, skumringstekst } from './soltider';
import { baaltjek, FORBUD_LINK } from './baalforbud';
import { jagtvarsel, JAGTDAGE_LINK, JAGTTIDER_LINK } from './jagt';
import BilledSektion from './BilledSektion';
import { billederPaaTur } from './billeder';
import { opretTomtSted } from './opret';
import { useRedigerbar } from './useRedigerbar';
import { MAALETS_FANE } from './turmaal';
import type { Turfane, Turmaal } from './turmaal';

interface Props {
  turId: number;
  tilbage: () => void;
  // Sat når turen netop er oprettet, så en navnløs post kan ryddes væk igen.
  nyOprettet?: boolean;
  // Hvor man skal lande, når man kommer hertil fra et forslag eller en
  // mangel. Se turmaal.ts — reglen er, at appen aldrig må pege på noget og så
  // lade én lede efter det.
  maal?: Turmaal;
}

type Visning = 'gruppe' | 'tag' | 'person';

// Turens faner. Rækkefølgen er turens egen: først rammerne om den, så
// pakningen og listen man går rundt med, så selskabet, så dagene undervejs —
// og til sidst det praktiske omkring det hele.
//
// Seks faner er loftet. Skal der en syvende til, hører den sandsynligvis
// hjemme inde i en af de seks.
//
// Selve typen bor i turmaal.ts sammen med de steder, en henvisning kan lande.
const FANEBLADE: { id: Turfane; label: string }[] = [
  { id: 'overblik', label: 'Overblik' },
  { id: 'pakning', label: 'Pakning' },
  { id: 'pakkeliste', label: 'Pakkeliste' },
  { id: 'deltagere', label: 'Deltagere' },
  { id: 'undervejs', label: 'Undervejs' },
  { id: 'praktisk', label: 'Praktisk' }
];

function TurDetalje({ turId, tilbage, nyOprettet, maal }: Props) {
  const erDesktop = useErDesktop();
  const erBred = useErBredskaerm();
  const [visning, setVisning] = useState<Visning>('gruppe');
  // Man lander på overblikket, medmindre man er sendt hertil af et forslag
  // eller en mangel. En fane man stod på sidst ville være et gæt på hvad man
  // kom for, og gættet ville være forkert lige så tit som det var rigtigt —
  // men et mål er ikke et gæt, det er noget nogen har trykket på.
  const [fane, setFane] = useState<Turfane>(maal ? MAALETS_FANE[maal] : 'overblik');
  // Det man er sendt hertil for. Sektionen folder sig ud, og skærmen ruller
  // derhen. Skifter man fane, er man et andet ærinde — så ryddes det, og en
  // gammel markering folder ikke noget ud, næste gang man kommer forbi.
  const [sigtet, setSigtet] = useState<Turmaal | null>(maal ?? null);
  // Pak-af-tjekket lægger sig over turskærmen frem for at være en fane for
  // sig: man kommer dertil fra turen, og man skal tilbage til den bagefter.
  // Ruller det, man er sendt efter, ind på skærmen — én gang. Uden
  // dependency-liste, fordi elementet først findes, når turen er hentet, og
  // effekten derfor skal prøve igen ved hver render indtil den kan.
  const sigtRef = useRef<HTMLDivElement | null>(null);
  const harRullet = useRef(false);
  useEffect(() => {
    if (!sigtet || harRullet.current || !sigtRef.current) return;
    harRullet.current = true;
    sigtRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' });
  });

  const [viserPakAfTjek, setViserPakAfTjek] = useState(false);
  const [viserPaaTur, setViserPaaTur] = useState(false);
  const [vejrData, setVejrData] = useState<VejrData | null>(null);
  const [vejrHentes, setVejrHentes] = useState(false);
  const [vejrFejl, setVejrFejl] = useState('');
  const [koordinatTekst, setKoordinatTekst] = useState('');
  const [koordinatFejl, setKoordinatFejl] = useState('');
  // Beskeden om et bytte, der ikke kunne gennemføres helt.
  //
  // Kun den. Et bytte der gik igennem, siger sig selv: vægten falder, og
  // forslaget forsvinder. Det er dét sidste, der gør beskeden nødvendig her —
  // gik byttet igennem, er der ikke længere en vægtsektion at skrive i, så
  // beskeden står uden for den og ikke inde i den.
  const [byttebesked, setByttebesked] = useState('');
  const [stedForslag, setStedForslag] = useState<StedForslag[]>([]);
  const [stedSoeger, setStedSoeger] = useState(false);
  // Hvad de inviterede har skrevet sig på for. Hentes kun når turen er delt.
  const [deltagelser, setDeltagelser] = useState<Deltagelse[]>([]);

  const items = useLiveQuery(() => db.items.toArray());
  const grupper = useLiveQuery(() => db.grupper.toArray());
  // Steder og personer er genbrugsressourcer på tværs af turene, så de hentes
  // hele vejen ind — forslagene bygger på dem.
  const steder = useLiveQuery(() => db.steder.toArray()) ?? [];
  const personer = useLiveQuery(() => db.personer.toArray()) ?? [];
  const alleTure = useLiveQuery(() => db.ture.toArray()) ?? [];
  // Kun antallet bruges her — selve billederne hentes af BilledSektion, som
  // også er den der viser dem.
  const alleBilleder = useLiveQuery(() => db.billeder.toArray()) ?? [];

  const { post: tur, opdater } = useRedigerbar(db.ture, turId, opdaterTur, {
    onIndlaest: (fundet) => {
      if (fundet.koordinater) {
        setKoordinatTekst(`${fundet.koordinater.lat}, ${fundet.koordinater.lng}`);
      }
      if (fundet.vejrsnapshot) {
        try {
          setVejrData(JSON.parse(fundet.vejrsnapshot));
        } catch {
          setVejrData(null);
        }
      }
    }
  });

  // Niveauet er en vane og ikke en egenskab ved turen, så det står i
  // indstillingerne. Det følger med ind i tjekket, hvor det kan rettes for den
  // enkelte tur.
  const pakAfNiveau = useValg(PAK_AF_NIVEAU_VALG, PAK_AF_NIVEAU, 'let');
  // Motoren regner med brugeren frem for en gennemsnitsdansker, når hun har
  // fortalt den hvem hun er.
  const kropsdata = useKropsdata();
  const afgangsSkabelon = laesSkabelon(useTekst(AFGANGS_SKABELON));

  // Bidragene ligger på serveren og ikke i den lokale base — de kommer fra
  // andres enheder. Uden forbindelse vises turen bare uden dem.
  const token = tur?.dele_token ?? '';
  const turPbId = tur?.pb_id ?? '';
  useEffect(() => {
    if (!token || !turPbId) { setDeltagelser([]); return; }

    let aktiv = true;
    void hentDeltagelser(turPbId, token).then((svar) => {
      if (aktiv && svar.slags === 'ok') setDeltagelser(svar.data);
    });
    return () => { aktiv = false; };
  }, [token, turPbId]);

  const skiftDato = async (aendringer: { startdato?: string; slutdato?: string }) => {
    if (!tur) return;
    const start = aendringer.startdato ?? tur.startdato;
    const slut = aendringer.slutdato ?? tur.slutdato;
    await opdater({ ...aendringer, naetter: beregnNaetter(start, slut) });
  };

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

  const soegPaaSted = async () => {
    if (!tur?.sted.trim()) return;
    setStedSoeger(true);
    setStedForslag([]);
    const resultater = await soegSted(tur.sted);
    setStedSoeger(false);

    if (resultater.length === 1) {
      await vaelgSted(resultater[0]);
    } else if (resultater.length > 1) {
      setStedForslag(resultater);
    } else {
      setKoordinatFejl('Ingen resultater');
    }
  };

  // Et gemt sted er bedre end et opslag: det bærer noterne fra sidst.
  const vaelgGemtSted = async (gemt: Sted) => {
    await opdater({
      sted_uid: gemt.uid,
      sted: gemt.navn,
      ...(gemt.koordinater ? { koordinater: gemt.koordinater } : {})
    });
    if (gemt.koordinater) setKoordinatTekst(`${gemt.koordinater.lat}, ${gemt.koordinater.lng}`);
    setStedForslag([]);
    setKoordinatFejl('');
  };

  // Gemmer turens sted som en post man kan komme tilbage til. Ligger der
  // allerede et sted på samme punkt, knyttes turen til det i stedet for at
  // lave det igen.
  const gemSomSted = async () => {
    if (!tur?.sted.trim()) return;

    const naer = tur.koordinater ? naermesteSted(steder, tur.koordinater) : null;
    if (naer) {
      await vaelgGemtSted(naer);
      return;
    }

    const id = await opretTomtSted({
      navn: tur.sted.trim(),
      koordinater: tur.koordinater,
      adresse: tur.sted.trim()
    });
    const nyt = await db.steder.get(id);
    if (nyt) await opdater({ sted_uid: nyt.uid });
  };

  const frigoerSted = async () => {
    await opdater({ sted_uid: '' });
  };

  const vaelgSted = async (forslag: StedForslag) => {
    await opdater({ koordinater: { lat: forslag.lat, lng: forslag.lng } });
    setKoordinatTekst(`${forslag.lat}, ${forslag.lng}`);
    setStedForslag([]);
    setKoordinatFejl('');
  };

  const hentVejrForTur = async () => {
    if (!tur?.koordinater) { setVejrFejl('Angiv koordinater først'); return; }
    if (!tur.startdato || !tur.slutdato) { setVejrFejl('Angiv datoer først'); return; }

    setVejrHentes(true);
    setVejrFejl('');
    const data = await hentVejr(tur.koordinater.lat, tur.koordinater.lng, tur.startdato, tur.slutdato);
    setVejrHentes(false);

    if (data) {
      setVejrData(data);
      await opdater({ vejrsnapshot: JSON.stringify(data) });
    } else {
      setVejrFejl('Kunne ikke hente vejrudsigt');
    }
  };

  const slet = async () => {
    if (tur?.id === undefined) return;
    const genskab = await sletTur(tur.id);
    if (genskab) meldSletning({ slags: 'Turen', navn: tur.navn, genskab });
    tilbage();
  };

  const toggleGruppe = async (gruppeUid: Reference) => {
    if (!tur) return;
    await opdater({ gruppe_ids: vekslet(tur.gruppe_ids, gruppeUid) });
  };

  const toggleLoestItem = async (itemUid: Reference) => {
    if (!tur) return;
    await opdater({ loese_item_ids: vekslet(tur.loese_item_ids, itemUid) });
  };

  // Et bytte er et bytte. Knappen hed før "Tilføj" og lagde kun det lette
  // til — så stod begge dele på pakkelisten, og vægten var gået op i stedet
  // for ned, indtil man selv huskede at tage det tunge af.
  //
  // Kom det tunge med via et grejsæt, kan det ikke tages af turen alene. Så
  // siger beskeden det, i stedet for at lade byttet se helt ud.
  const tagImodBytte = async (bytter: Bytte[]) => {
    if (!tur) return;

    const { aendringer, uloeste } = byt(tur, bytter);
    await opdater(aendringer);

    setByttebesked(
      uloeste.length === 0
        ? ''
        : `${uloeste.map((i) => i.navn).join(', ')} kom med via et grejsæt og blev stående. Et sæt vælges som et sæt, og enkeltdele kan ikke slås fra på en tur. Det lette er lagt til — skal det tunge helt af, skal sættet af turen.`
    );
  };

  // Fra person-tabellen: navnet og standardovernatningen følger med, og turen
  // kan bagefter tælles med under "ture med Mikkel".
  const tilfoejPerson = async (person: Person) => {
    if (!tur) return;
    await opdater({ deltagere: [...tur.deltagere, deltagerFraPerson(person)] });
  };

  // Skrevet ind i hånden. Det skal blive ved med at være nok — man skal kunne
  // få en med på turen uden først at oprette hende som person.
  const tilfoejNavn = async (navn: string) => {
    if (!tur || !navn.trim()) return;
    await opdater({ deltagere: [...tur.deltagere, deltagerFraNavn(navn)] });
  };

  const toggleGearHos = async (deltagerId: string, item: Item) => {
    if (!tur) return;
    await opdater({ deltagere: tildelGear(tur.deltagere, deltagerId, item) });
  };

  // null betyder "som turen" — så følger deltageren med, hvis man senere
  // skifter turens egen overnatningsform.
  const saetDeltagerOvernatning = async (id: string, form: Overnatning | null) => {
    if (!tur) return;
    await opdater({
      deltagere: tur.deltagere.map((d) => (d.id === id ? { ...d, overnatning: form } : d))
    });
  };

  const fjernDeltager = async (id: string) => {
    if (!tur) return;
    await opdater({ deltagere: tur.deltagere.filter((d) => d.id !== id) });
  };

  const tilfoejBudgetLinje = async () => {
    if (!tur) return;
    const nyLinje: BudgetLinje = {
      id: crypto.randomUUID(),
      kategori: 'gear',
      beskrivelse: '',
      forventet_kr: 0,
      faktisk_kr: 0
    };
    await opdater({ budget_linjer: [...tur.budget_linjer, nyLinje] });
  };

  const opdaterBudgetLinje = async (id: string, aendringer: Partial<BudgetLinje>) => {
    if (!tur) return;
    await opdater({
      budget_linjer: tur.budget_linjer.map((l) => (l.id === id ? { ...l, ...aendringer } : l))
    });
  };

  const fjernBudgetLinje = async (id: string) => {
    if (!tur) return;
    await opdater({ budget_linjer: tur.budget_linjer.filter((l) => l.id !== id) });
  };

  if (!tur) return <Indlaeser />;

  const itemUidsPaaDenneTur = itemUidsPaaTur(tur, grupper ?? []);
  const pakItems = items?.filter((i) => itemUidsPaaDenneTur.has(i.uid)) ?? [];

  const pakAfTjek = tur.pak_af_tjek ?? null;
  const afgangsTjek = tur.afgangs_tjek ?? null;

  // Et gemt sted har et navn en pårørende kan finde på et kort; koordinater er
  // noget man skal taste ind et andet sted.
  const valgtStedNavn = steder.find((s) => s.uid === tur.sted_uid)?.navn ?? '';

  // Listen laves når man første gang folder sektionen ud eller går på tur.
  // Er den lavet, flettes nye punkter fra skabelonen ind uden at røre det man
  // allerede har krydset af.
  const sikrAfgangsTjek = async () => {
    const nyt = afgangsTjek
      ? fletSkabelonInd(afgangsTjek, afgangsSkabelon)
      : nytAfgangsTjek(afgangsSkabelon);

    if (nyt !== afgangsTjek) await opdater({ afgangs_tjek: nyt });
    return nyt;
  };

  const gemAfgang = (nyt: AfgangsTjek) => void opdater({ afgangs_tjek: nyt });
  const gemNoter = (nye: Feltnote[]) => void opdater({ feltnoter: nye });

  const gaaPaaTur = async () => {
    await sikrAfgangsTjek();
    setViserPaaTur(true);
  };

  // Turkortet fryses ned som gæstelinket: modtageren læser ét felt, aldrig
  // resten af turen.
  const lavTurkortLink = async () => {
    const token = tur.turkort_token || nytTurkorttoken();
    await opdater({
      turkort_token: token,
      turkort_snapshot: JSON.stringify(lavTurkort({ ...tur, turkort_token: token }, valgtStedNavn))
    });
  };

  const stopTurkort = async () => {
    if (!confirm('Træk turkortet tilbage? Modtageren kan så ikke længere se det.')) return;
    await opdater({ turkort_token: '', turkort_snapshot: '' });
  };

  // Tjekket laves her og ikke inde på selve skærmen. Så kan den aldrig komme
  // til at skrive et tomt tjek oven i et udfyldt, og linjerne bygges på den
  // samme pakkeliste som resten af turskærmen viser. Er pakkelisten rettet
  // siden sidst, følger linjerne med.
  const aabnPakAfTjek = async () => {
    const opdateret = pakAfTjek
      ? synkroniserLinjer(pakAfTjek, pakItems)
      : nytPakAfTjek(pakItems, pakAfNiveau);

    if (opdateret !== pakAfTjek) await opdater({ pak_af_tjek: opdateret });
    setViserPakAfTjek(true);
  };

  if (viserPaaTur) {
    return (
      <PaaTurTilstand
        tur={tur}
        vejr={vejrData}
        skrivNote={(t) => void opdater({ feltnoter: tilfoejFeltnote(tur.feltnoter ?? [], t) })}
        luk={() => setViserPaaTur(false)}
      />
    );
  }

  if (viserPakAfTjek && pakAfTjek) {
    return (
      <PakAfTjekSide
        tur={tur}
        tjek={pakAfTjek}
        pakItems={pakItems}
        grupper={grupper ?? []}
        gem={(nyt: PakAfTjek | null) => void opdater({ pak_af_tjek: nyt })}
        tilbage={() => setViserPakAfTjek(false)}
      />
    );
  }

  const vaegtDelt = pakItems.filter((i) => i.delt).reduce((s, i) => s + i.vaegt_g, 0);
  const vaegtPersonligt = pakItems.filter((i) => !i.delt).reduce((s, i) => s + i.vaegt_g, 0);
  // Delt gear bæres af én, men vises fair fordelt over deltagerne.
  const vaegtPrPerson = tur.personer > 0
    ? vaegtPersonligt + vaegtDelt / tur.personer
    : vaegtPersonligt + vaegtDelt;

  const totalForventet = tur.budget_linjer.reduce((s, l) => s + l.forventet_kr, 0);
  const totalFaktisk = tur.budget_linjer.reduce((s, l) => s + l.faktisk_kr, 0);

  // Deling fryser pakkelisten ned som den ser ud nu. Gæsten læser kun det
  // ene felt — aldrig inventaret. Retter man turen bagefter, bygges det om af
  // sig selv; se delesnapshot.ts.
  const del = async () => {
    await opdater({
      dele_token: tur.dele_token || nytDeletoken(),
      dele_snapshot: JSON.stringify(lavSnapshot(tur, grupper ?? [], pakItems, new Date(), alleBilleder))
    });
  };

  const stopDeling = async () => {
    if (!confirm('Træk linket tilbage? Gæster kan så ikke længere se turen.')) return;
    await opdater({ dele_token: '', dele_snapshot: '' });
  };

  const advarsler = [
    ...findAdvarsler(pakItems),
    ...overnatningsAdvarsler(tur, pakItems),
    ...udlaansAdvarsler(pakItems)
  ];
  const perItem = advarslerPrItem(advarsler);
  const beregninger = beregnForbrug(tur, kropsdata);
  const gruppeForslag = grupper ? foreslaaGrupper(tur, grupper) : [];
  const savnedeTags = grupper ? manglendeTags(tur, grupper) : [];
  const vaegtsvar = vaegtresultat(tur, grupper ?? [], items ?? [], pakItems);

  // Kun på en tur der ikke er pakket endnu. Har man allerede valgt sit grej,
  // er et forslag om at kopiere en anden tur i vejen.
  const kopiforslag = pakItems.length === 0 && tur.status === 'kladde'
    ? foreslaaKopi(tur, alleTure, grupper ?? [])
    : [];

  const kopierFra = async (fra: Tur) => {
    await opdater(kopierGrej(fra, tur));
  };

  // Deltagernes eget grej hører til i den samme liste som ens eget — det er
  // én tur, og man pakker efter én liste.
  const deltagerlinjer = deltagelser.flatMap((d) =>
    d.medbragt.map((g) => linjeAfMedbragt(g.navn, g.vaegt_g, visningsnavn(d))));

  // Ejerens egen fordeling, plus dem der selv har meldt sig på noget.
  const navne = new Map(baerernavne(tur));
  baererePrGear(deltagelser).forEach((meldte, uid) => {
    navne.set(uid, [navne.get(uid), ...meldte].filter(Boolean).join(' og '));
  });

  const alleLinjer = [...pakItems.map((i) => linjeAfItem(i, navne.get(i.uid) ?? '')), ...deltagerlinjer];

  const afsnit: Pakkeafsnit[] = visning === 'person'
    ? linjerEfterPerson(alleLinjer)
    : medDeltagernes(
        afsnitAfItems(
          visning === 'gruppe'
            ? pakkelisteEfterGruppe(tur, grupper ?? [], pakItems)
            : pakkelisteEfterTag(pakItems),
          navne
        ),
        alleLinjer
      );

  // Hvor turen er, og hvad det næste skridt er. Reglerne ligger i turfase.ts;
  // her oversættes skridtet til den knap, der udfører det.
  const fase = turfase(tur, grupper ?? []);

  // Der er altid et næste skridt — også på en tur der er gjort op, hvor det
  // fører tilbage til regnskabet. Var der en tilstand uden, ville knappen stå
  // uden tekst, og det ville ingen opdage før den stod der.
  const handling = {
    label: fase.naeste.label,
    gaa: () => {
      if (fase.naeste.slags === 'status') void opdater({ status: fase.naeste.til });
      else void aabnPakAfTjek();
    }
  };

  // Sektionerne er de samme på begge layouts — kun rammen om dem er forskellig.
  const parametre = (
    <Turparametre
      tur={tur}
      opdater={opdater}
      skiftDato={skiftDato}
      koordinatTekst={koordinatTekst}
      koordinatFejl={koordinatFejl}
      opdaterKoordinater={opdaterKoordinater}
      soegPaaSted={soegPaaSted}
      stedSoeger={stedSoeger}
      stedForslag={stedForslag}
      vaelgSted={vaelgSted}
      gemteForslag={foreslaaSteder(steder, alleTure, tur.sted_uid ? '' : tur.sted)}
      alleSteder={sorterEfterBesoeg(steder, alleTure)}
      valgtSted={steder.find((s) => s.uid === tur.sted_uid) ?? null}
      besoeg={besoegPrSted(alleTure)}
      vaelgGemtSted={vaelgGemtSted}
      gemSomSted={gemSomSted}
      frigoerSted={frigoerSted}
      beregninger={beregninger}
    />
  );

  // Pakketilstanden. Krydset gemmes med det samme som alt andet på turen —
  // man står med tasken i hånden og skal ikke også trykke gem.
  const pakning = pakkefremdrift(tur, pakItems);
  const afkrydsede = pakkede(tur);

  const pakkeliste = (
    <Pakkeliste
      afsnit={afsnit}
      perItem={perItem}
      visning={visning}
      setVisning={setVisning}
      antal={pakItems.length}
      pakning={pakning}
      pakkede={afkrydsede}
      veksl={(uid) => void opdater({ pakkede_item_uids: vekslPakket(tur, uid) })}
      pakAlle={() => void opdater({ pakkede_item_uids: pakAlle(pakItems) })}
      ryd={() => void opdater({ pakkede_item_uids: rydPakning() })}
    />
  );

  const valgAfIndhold = (
    <Indholdsvalg
      grupper={grupper ?? []}
      items={items ?? []}
      tur={tur}
      paaTuren={itemUidsPaaDenneTur}
      gruppeForslag={gruppeForslag}
      savnedeTags={savnedeTags}
      toggleGruppe={toggleGruppe}
      toggleLoestItem={toggleLoestItem}
    />
  );

  const vejr = (
    <Vejrudsigt tur={tur} data={vejrData} hentes={vejrHentes} fejl={vejrFejl} hent={hentVejrForTur} />
  );

  const deltagere = (
    <Deltagere
      deltagere={tur.deltagere}
      turensOvernatning={tur.overnatning}
      personer={personer}
      ture={alleTure}
      tilfoejPerson={tilfoejPerson}
      tilfoejNavn={tilfoejNavn}
      fjern={fjernDeltager}
      saetOvernatning={saetDeltagerOvernatning}
    />
  );

  const budget = (
    <Budget
      linjer={tur.budget_linjer}
      tilfoej={tilfoejBudgetLinje}
      opdater={opdaterBudgetLinje}
      fjern={fjernBudgetLinje}
    />
  );

  const vaegt = (
    <Vaegt
      prPerson={vaegtPrPerson}
      delt={vaegtDelt}
      personligt={vaegtPersonligt}
      personer={tur.personer}
      baaret={vaegtPrDeltager(tur, pakItems)}
    />
  );

  const vaegtbryderSektion = vaegtsvar.brydere.length > 0 && (
    <Foldbar
      titel="Kan vægten ned?"
      resume={`${kg(vaegtsvar.potentiel_besparelse_g)} kg at hente`}
      aabenFra={sigtet === 'vaegt'}
    >
      <Vaegtbrydere resultat={vaegtsvar} byt={tagImodBytte} />
    </Foldbar>
  );

  const fordeling = (
    <Fordeling
      deltagere={tur.deltagere}
      pakItems={pakItems}
      baerer={baererAf(tur)}
      vaegte={vaegtPrDeltager(tur, pakItems)}
      toggle={toggleGearHos}
    />
  );

  const deling = (
    <Deling
      token={tur.dele_token}
      snapshot={tur.dele_snapshot}
      deltagelser={deltagelser}
      gearnavne={new Map(pakItems.map((i) => [i.uid, i.navn]))}
      del={del}
      stop={stopDeling}
    />
  );

  const noter = (
    <div style={{ display: 'grid', gap: '12px' }}>
      <Tekstomraade
        label="Besked til gæster"
        value={tur.besked_fra_ejer}
        onChange={(v) => opdater({ besked_fra_ejer: v })}
        placeholder="fx Vi mødes ved P kl. 15"
      />
      <Tekstomraade label="Noter" value={tur.noter} onChange={(v) => opdater({ noter: v })} />
    </div>
  );

  // Er turen gjort op, står regnskabet på turen bagefter. Selve redigeringen
  // sker på sin egen skærm — her er det kun til at læse.
  const afgangsSektion = (
    <Foldbar
      titel="Afgangs-tjek"
      resume={fremdriftstekst(afgangsTjek)}
      // Er turen gået i gang, er det ikke længere noget man folder ud når man
      // får lyst — det er det sidste man skulle have gjort. Det samme gælder,
      // når man er sendt hertil af en mangel.
      aabenFra={tur.status === 'aktiv' || sigtet === 'afgangstjek'}
    >
      <Afgangstjekliste
        tjek={afgangsTjek}
        opret={() => void sikrAfgangsTjek()}
        gem={gemAfgang}
      />
    </Foldbar>
  );

  const feltnoteSektion = (
    <Foldbar
      titel="Turlog"
      resume={feltnoteResume(tur.feltnoter ?? [])}
      // På en tur der er i gang er det den man skal have fat i.
      aabenFra={tur.status === 'aktiv'}
    >
      <Turlog
        noter={tur.feltnoter ?? []}
        tilfoej={(t) => gemNoter(tilfoejFeltnote(tur.feltnoter ?? [], t))}
        saet={(id, t) => gemNoter(saetFeltnote(tur.feltnoter ?? [], id, t))}
        fjern={(id) => gemNoter(fjernFeltnote(tur.feltnoter ?? [], id))}
      />
    </Foldbar>
  );

  const antalBilleder = billederPaaTur(alleBilleder, tur.uid).length;
  const bookingSektion = (
    <Foldbar
      titel="Booking"
      resume={tur.booking?.booket ? 'Booket' : tur.booking ? 'Ikke booket endnu' : 'Ingen'}
    >
      <Bookingfelter booking={tur.booking ?? null} gem={(b) => void opdater({ booking: b })} />
    </Foldbar>
  );

  const billedResume = antalBilleder === 0
    ? 'Ingen'
    : `${antalBilleder} ${antalBilleder === 1 ? 'billede' : 'billeder'}`;

  const billedSektion = (
    <Foldbar
      titel="Billeder"
      resume={billedResume}
      // På en tur der er i gang er det den man har fat i telefonen for.
      aabenFra={tur.status === 'aktiv'}
    >
      <BilledSektion tur={tur} saetHero={(uid) => void opdater({ hero_billede: uid })} />
    </Foldbar>
  );

  const turkortSektion = (
    <Foldbar titel="Turkort til pårørende" resume={tur.turkort_token ? 'Sendt' : 'Ikke lavet'}>
      <Turkort
        tur={tur}
        stednavn={valgtStedNavn}
        opdater={opdater}
        lav={lavTurkortLink}
        stop={stopTurkort}
      />
    </Foldbar>
  );

  const pakAfSektion = pakAfTjek && (
    <Foldbar titel="Pak-af-tjek" resume={resumetekst(pakAfTjek)}>
      <div style={{ display: 'grid', gap: '10px' }}>
        <div style={{ fontSize: '12px', color: 'var(--tekst-dæmpet)' }}>
          {`Gjort op ${formatterDag(pakAfTjek.udfyldt_dato)} · niveau: ${pakAfTjek.niveau}`}
        </div>
        <Knap onClick={() => void aabnPakAfTjek()}>Åbn pak-af-tjek</Knap>
      </div>
    </Foldbar>
  );

  // Resuméerne står altid fremme, så en foldet sektion stadig kan aflæses.
  const parametreResume = [
    `${tur.naetter} ${tur.naetter === 1 ? 'nat' : 'nætter'}`,
    `${tur.personer} pers`,
    etiket(tur.overnatning),
    tur.baereafstand_km > 0 ? `${tur.baereafstand_km} km bæreafstand` : null
  ].filter(Boolean).join(' · ');

  const titelblok = (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <TitelInput
          value={tur.navn}
          onChange={(v) => opdater({ navn: v })}
          placeholder="Navn på tur"
          autoFokus={nyOprettet}
        />
        <div style={{ fontSize: '12px', color: 'var(--tekst-dæmpet)', marginTop: '-8px', marginBottom: '10px' }}>
          {[formatterPeriode(tur.startdato, tur.slutdato), tur.sted].filter(Boolean).join(' · ') || 'Ingen datoer valgt'}
        </div>
        <Segment vaerdier={TUR_STATUS} valgt={tur.status} vaelg={(s) => opdater({ status: s })} kompakt />
      </div>
      {erDesktop && (
        <div style={{ display: 'flex', gap: '8px' }}>
          {tur.status === 'aktiv' && <Knap onClick={() => void gaaPaaTur()}>På tur</Knap>}
          <Knap variant="primaer" onClick={handling.gaa}>
            {handling.label}
          </Knap>
        </div>
      )}
    </div>
  );

  // Fanerne bærer turen nu. Før stod alt om en tur i én strimmel af foldbare
  // kort, og på telefonen skulle man forbi femten sektioner for at nå
  // noterne. Nu fylder ét område ad gangen, og fanerækken står fast, så man
  // kan lære hvor tingene er i stedet for at lede efter dem hver gang.
  //
  // Sektionerne selv er uændrede — det er kun sammensætningen der er ny.
  // Derfor kan et kort flyttes til en anden fane uden at røre indholdet.
  const spalter = (venstre: ReactNode, hoejre: ReactNode) => (
    <div style={{
      display: 'grid',
      gridTemplateColumns: erBred
        ? 'minmax(0, 1.3fr) minmax(320px, 1fr)'
        : erDesktop
          ? 'minmax(0, 1.2fr) minmax(300px, 1fr)'
          : '1fr',
      gap: erDesktop ? '20px' : '8px',
      alignItems: 'start'
    }}>
      {/* minWidth: 0 er ikke til pynt. Et grid-barn må som udgangspunkt ikke
          blive smallere end sit indhold, og så skubber et bredt felt inde i et
          kort hele spalten ud over skærmkanten i stedet for at give efter. */}
      <div style={{ display: 'grid', gap: erDesktop ? '10px' : '8px', alignContent: 'start', minWidth: 0 }}>
        {venstre}
      </div>
      <div style={{ display: 'grid', gap: erDesktop ? '10px' : '8px', alignContent: 'start', minWidth: 0 }}>
        {hoejre}
      </div>
    </div>
  );

  // Pakker et sted ind, så skærmen kan rulle derhen. Wrapperen står altid, og
  // kun ref'en flytter sig: forsvandt den, ville sektionen inde i den blive
  // pillet ned og foldet sammen igen på vej.
  const sigte = (m: Turmaal, indhold: ReactNode) => (
    <div ref={sigtet === m ? sigtRef : undefined}>{indhold}</div>
  );

  // Går til et sted på turen. Rullingen skal ske igen, selvom den er sket
  // før — det er en ny henvisning, ikke den man kom ind med.
  const gaaTilMaal = (m: Turmaal) => {
    harRullet.current = false;
    setFane(MAALETS_FANE[m]);
    setSigtet(m);
  };

  const fanensIndhold: Record<Turfane, ReactNode> = {
    // Rammerne om turen: hvor, hvornår, hvem med — og det appen har set, som
    // man skal vide inden man tager afsted.
    overblik: spalter(
      <>
        {kopiforslag.length > 0 && (
          <Ligesomsidst
            forslag={kopiforslag}
            tur={tur}
            grupper={grupper ?? []}
            items={items ?? []}
            kopier={kopierFra}
          />
        )}
        {/* På en kladde er parametrene det første der skal udfyldes, så der
            står den åben. Senere er den et opslag — medmindre man er sendt
            hertil af en mangel om datoer eller sted. */}
        {sigte('overblik',
          <Foldbar
            titel="Turparametre"
            resume={parametreResume}
            aabenFra={tur.status === 'kladde' || sigtet === 'overblik'}
          >
            {parametre}
          </Foldbar>
        )}
        {bookingSektion}
      </>,
      <>
        {advarsler.length > 0 && <Advarsler advarsler={advarsler} />}
        <Foldbar titel="Vejrudsigt" resume={vejrResume(vejrData)}>{vejr}</Foldbar>
      </>
    ),

    // Arbejdsfladen: her vælges grejet, og vægten svarer igen med det samme.
    pakning: spalter(
      sigte('pakning', <Infokort label="Vælg gear">{valgAfIndhold}</Infokort>),
      <>
        <Pakkekort pakning={pakning} tilListen={() => setFane('pakkeliste')} />
        {vaegt}
        {byttebesked !== '' && (
          <Infokort label="Byttet blev ikke helt">
            <div style={{ fontSize: 'var(--skrift-detalje)', color: 'var(--tekst-dæmpet)', lineHeight: 1.55 }}>
              {byttebesked}
            </div>
          </Infokort>
        )}
        {sigte('vaegt', vaegtbryderSektion)}
      </>
    ),

    // Listen man har fremme mens man pakker. Den skal fylde det hele — der er
    // ikke noget andet at kigge på her.
    pakkeliste: sigte('pakkeliste',
      <Infokort label={`Pakkeliste (${pakItems.length})`}>{pakkeliste}</Infokort>
    ),

    deltagere: spalter(
      <>
        {sigte('deltagere',
          <Foldbar
            titel={`Deltagere (${tur.deltagere.length})`}
            resume={tur.deltagere.map((d) => d.navn).join(', ')}
            aabenFra
          >
            {deltagere}
          </Foldbar>
        )}
        {tur.deltagere.length > 0 && pakItems.length > 0 && (
          <Foldbar titel="Fordel gear" resume={fordelingsResume(tur, pakItems)}>{fordeling}</Foldbar>
        )}
      </>,
      <Foldbar titel="Del med gæster" resume={tur.dele_token ? 'Delt' : 'Ikke delt'}>{deling}</Foldbar>
    ),

    // Dagene selv: det sidste tjek inden afgang, og det der bliver skrevet og
    // fotograferet undervejs. Pak-af-tjekket lukker kredsløbet bagefter.
    undervejs: spalter(
      <>
        {sigte('afgangstjek', afgangsSektion)}
        {feltnoteSektion}
      </>,
      <>
        {billedSektion}
        {pakAfSektion}
      </>
    ),

    praktisk: spalter(
      <>
        <Foldbar titel="Noter" aabenFra>{noter}</Foldbar>
        <Foldbar titel="Budget" resume={`${totalFaktisk} / ${totalForventet} kr`}>{budget}</Foldbar>
      </>,
      turkortSektion
    )
  };

  // Tallene står i fanerækken, så man kan aflæse turen uden at åbne hver fane.
  // Nul vises ikke — en tom fane skal ikke råbe op om at være tom.
  const fanetal: Partial<Record<Turfane, number>> = {
    pakkeliste: pakItems.length,
    deltagere: tur.deltagere.length
  };

  return (
    <div style={erDesktop ? undefined : layout.container}>
      <DetaljeHeader tilbage={tilbage} sletLabel="Slet tur" slet={slet} />
      {titelblok}
      <Jagtboks tur={tur} />

      {/* På PC står handlingsknapperne i titelblokken. På telefonen er der
          ikke plads ved siden af titlen, så de står for sig — og på en aktiv
          tur er på-tur-skærmen den man skal have fat i, ikke knappen der
          afslutter turen. */}
      {!erDesktop && (
        <>
          {tur.status === 'aktiv' && (
            <Knap
              variant="primaer"
              onClick={() => void gaaPaaTur()}
              style={{ width: '100%', marginTop: '14px', padding: '11px' }}
            >
              Åbn på-tur-skærmen
            </Knap>
          )}
          <Knap
            variant={tur.status === 'aktiv' ? 'sekundaer' : 'primaer'}
            onClick={handling.gaa}
            style={{ width: '100%', marginTop: tur.status === 'aktiv' ? '8px' : '14px', padding: '11px' }}
          >
            {handling.label}
          </Knap>
        </>
      )}

      {/* Først når grejet og sættene er hentet. Indtil da ville listen sige
          "Intet grej valgt" om en tur, hvis grej ligger i et grejsæt — en
          påstand om brugerens data, der er forkert i et enkelt billede. */}
      {items !== undefined && grupper !== undefined && (
        <Naesteskridt fase={fase} gaaTil={gaaTilMaal} />
      )}

      <Faner
        valgt={fane}
        vaelg={(f) => { setFane(f); setSigtet(null); }}
        tal={fanetal}
      />

      {/* Nøglen er ikke til pynt. Uden den genbruger React kortene på tværs
          af fanerne, fordi de står på samme plads i træet — og så arver
          afgangs-tjekket den foldede-ud-tilstand fra turparametrene, man
          efterlod på overblikket. Nøglen skifter med fanen, så det gamle træ
          bliver pillet ned frem for at blive brugt igen. */}
      <div key={fane}>{fanensIndhold[fane]}</div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Rammer
// ─────────────────────────────────────────────

// Hvor langt pakningen er, og hvad der står tilbage.
//
// Tallet er derived state og gemmes ikke: det regnes ud af hvilket grej der
// er på turen, og hvilket der er krydset af. Gemtes det også som et felt,
// ville de to kunne komme ud af trit — og så er det feltet man tror på, mens
// listen er den der er rigtig.
function Pakkekort({ pakning, tilListen }: { pakning: Pakkefremdrift; tilListen: () => void }) {
  if (pakning.ialt === 0) return null;

  // Højst så mange manglende nævnes ved navn. Resten tælles — en liste over
  // fyrre ting man ikke har pakket, er bare pakkelisten en gang til.
  const NAEVNES = 5;
  const foerste = pakning.mangler.slice(0, NAEVNES);
  const resten = pakning.mangler.length - foerste.length;

  return (
    <Infokort label="Pakning" fremhaevet={pakning.faerdig}>
      <div style={{
        fontSize: 'var(--skrift-tal)',
        fontWeight: 500,
        fontFamily: "'Fraunces', Georgia, serif",
        color: pakning.faerdig ? 'var(--succes)' : 'var(--tekst)'
      }}>
        {pakning.faerdig ? 'Alt er pakket' : `${pakning.pakket} af ${pakning.ialt}`}
      </div>

      {/* En stribe frem for en ring: den kan læses lige så hurtigt og fylder
          ikke en hel spalte i bredden. */}
      <div style={{
        height: '5px',
        borderRadius: 'var(--runding-pille)',
        background: 'var(--border-svag)',
        overflow: 'hidden',
        margin: 'var(--plads-2) 0'
      }}>
        <div style={{
          width: `${pakning.procent}%`,
          height: '100%',
          background: pakning.faerdig ? 'var(--succes)' : 'var(--accent)',
          transition: 'width 0.2s'
        }} />
      </div>

      {!pakning.faerdig && (
        <>
          <div style={{ fontSize: 'var(--skrift-lille)', color: 'var(--tekst-dæmpet)', marginBottom: 'var(--plads-1)' }}>
            Mangler i tasken
          </div>
          <div style={{ display: 'grid', gap: '2px', fontSize: 'var(--skrift-detalje)' }}>
            {foerste.map((i) => <span key={i.uid}>{i.navn || 'Uden navn'}</span>)}
            {resten > 0 && (
              <span style={{ color: 'var(--tekst-svag)' }}>
                + {resten} {resten === 1 ? 'ting mere' : 'ting mere'}
              </span>
            )}
          </div>
          <Knap onClick={tilListen} style={{ marginTop: 'var(--plads-3)' }}>Gå til pakkelisten</Knap>
        </>
      )}
    </Infokort>
  );
}

// Hvad turen mangler, før det næste skridt giver mening.
//
// Den står lige under knappen og ikke inde på en fane: det er dér, man er ved
// at trykke, og en oplysning om at der ikke er valgt grej, hjælper ikke hvis
// den ligger et sted, man skal finde først.
//
// Listen låser ingenting. Man skal kunne tage afsted på en tur, appen synes er
// halvfærdig — den skal bare have sagt det først.
function Naesteskridt({ fase, gaaTil }: { fase: Turfase; gaaTil: (m: Turmaal) => void }) {
  if (fase.mangler.length === 0) return null;

  return (
    <div style={{
      marginTop: 'var(--plads-3)',
      padding: '10px var(--plads-3)',
      borderRadius: 'var(--runding-lille)',
      border: '1px solid var(--border-svag)',
      background: 'var(--bg-forhoejet)',
      fontSize: 'var(--skrift-detalje)',
      color: 'var(--tekst-dæmpet)'
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: 'var(--plads-1)' }}>
        {/* Ikke et tal. Overskriften stod før som "2 ting mangler" lige over
            "Pakning: 4 af 6 mangler i tasken", og de to tal tæller ikke det
            samme — det ene linjer, det andet ting. */}
        <span style={{ flex: 1, fontWeight: 500 }}>Værd at gøre først</span>
        <Hvorfor begrundelse={fase.begrundelse} />
      </div>
      {/* Hver mangel er en knap. Appen ved, hvor "Intet grej valgt" rettes —
          så skal den også tage én derhen. En liste man selv skal finde vej ud
          fra, er lige så besværlig som ingen liste. */}
      <ul style={{ margin: 0, paddingLeft: '18px', display: 'grid', gap: '2px' }}>
        {fase.mangler.map((m) => (
          <li key={m.tekst}>
            <button
              onClick={() => gaaTil(m.maal)}
              style={{
                padding: 0,
                border: 'none',
                background: 'transparent',
                color: 'inherit',
                font: 'inherit',
                textAlign: 'left',
                textDecoration: 'underline',
                textDecorationColor: 'var(--border)',
                textUnderlineOffset: '3px',
                cursor: 'pointer'
              }}
            >
              {m.tekst}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Turens fanerække. Den bryder linjen frem for at scrolle vandret: en fane
// man skal skubbe frem for at få øje på, er lige så skjult som en post i en
// dropdown, og det var netop dét fanerne skulle af med.
//
// Markeringen er en streg under den valgte fane og ikke kun en farve — den
// skal også kunne aflæses af én der ikke skelner farverne.
function Faner({ valgt, vaelg, tal }: {
  valgt: Turfane;
  vaelg: (f: Turfane) => void;
  tal: Partial<Record<Turfane, number>>;
}) {
  return (
    <div
      role="tablist"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '2px',
        marginTop: '18px',
        marginBottom: '16px',
        borderBottom: '1px solid var(--border-svag)'
      }}
    >
      {FANEBLADE.map((f) => {
        const erAktiv = f.id === valgt;
        const antal = tal[f.id];

        return (
          <button
            key={f.id}
            role="tab"
            aria-selected={erAktiv}
            onClick={() => vaelg(f.id)}
            style={{
              // Skal kunne rammes med en handske på. Rørehøjden er 44 px på
              // en touchskærm og 36 med mus — se index.css.
              minHeight: 'var(--roerehoejde)',
              padding: '0 var(--plads-3)',
              background: 'transparent',
              border: 'none',
              // Stregen ligger oven i kassens egen, så fanerækken ikke
              // hopper en pixel når man skifter fane.
              borderBottom: `2px solid ${erAktiv ? 'var(--accent)' : 'transparent'}`,
              marginBottom: '-1px',
              color: erAktiv ? 'var(--tekst)' : 'var(--tekst-dæmpet)',
              fontSize: 'var(--skrift-knap)',
              fontWeight: erAktiv ? 600 : 500,
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            {f.label}
            {antal ? (
              <span style={{ color: 'var(--tekst-dæmpet)', fontWeight: 500 }}> {antal}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}


// En sektion man kan folde ud. Resuméet står fremme uanset foldetilstand, så
// man kan aflæse turen uden at åbne alt.
function Foldbar({ titel, resume, children, aabenFra, advarsel }: {
  titel: string;
  resume?: string;
  children: React.ReactNode;
  aabenFra?: boolean;
  advarsel?: boolean;
}) {
  const [aaben, setAaben] = useState(!!aabenFra);

  return (
    <div style={{
      border: `1px solid ${advarsel ? 'var(--advarsel-border)' : 'var(--border-svag)'}`,
      borderRadius: '10px',
      overflow: 'hidden',
      background: advarsel ? 'var(--advarsel-bg)' : 'var(--bg-forhoejet)'
    }}>
      <button
        onClick={() => setAaben(!aaben)}
        aria-expanded={aaben}
        style={{
          width: '100%',
          // At folde en sektion ud er en af de hyppigste handlinger på
          // turskærmen. Overskriften er lille, men knappen bag den skal
          // stadig kunne rammes.
          minHeight: 'var(--roerehoejde)',
          padding: resume ? '11px var(--plads-4) var(--plads-1)' : '11px var(--plads-4)',
          background: 'transparent',
          border: 'none',
          textAlign: 'left',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '8px',
          fontSize: '10px',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.6px',
          color: advarsel ? 'var(--advarsel)' : 'var(--tekst-dæmpet)'
        }}
      >
        <span>{advarsel && '⚠ '}{titel}</span>
        <span style={{ fontSize: '11px' }}>{aaben ? '▾' : '▸'}</span>
      </button>

      {resume && (
        <div style={{ padding: '0 14px 11px', fontSize: '13px', color: 'var(--tekst)', lineHeight: 1.4 }}>
          {resume}
        </div>
      )}

      {aaben && (
        <div style={{ padding: resume ? '0 14px 14px' : '4px 14px 14px' }}>{children}</div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Sektioner
// ─────────────────────────────────────────────

function Turparametre({
  tur, opdater, skiftDato, koordinatTekst, koordinatFejl, opdaterKoordinater,
  soegPaaSted, stedSoeger, stedForslag, vaelgSted,
  gemteForslag, alleSteder, valgtSted, besoeg, vaelgGemtSted, gemSomSted, frigoerSted,
  beregninger
}: {
  tur: Tur;
  opdater: (a: Partial<Tur>) => Promise<void>;
  skiftDato: (a: { startdato?: string; slutdato?: string }) => Promise<void>;
  koordinatTekst: string;
  koordinatFejl: string;
  opdaterKoordinater: (v: string) => Promise<void>;
  soegPaaSted: () => Promise<void>;
  stedSoeger: boolean;
  stedForslag: StedForslag[];
  vaelgSted: (f: StedForslag) => Promise<void>;
  gemteForslag: Sted[];
  alleSteder: Sted[];
  valgtSted: Sted | null;
  besoeg: Map<Reference, number>;
  vaelgGemtSted: (s: Sted) => Promise<void>;
  gemSomSted: () => Promise<void>;
  frigoerSted: () => Promise<void>;
  beregninger: Beregninger;
}) {
  // Skriver man sig frem, står træfferne; ellers kan hele listen slås op.
  const [viserAlleSteder, setViserAlleSteder] = useState(false);
  const gemteSteder = viserAlleSteder ? alleSteder : gemteForslag;

  return (
    <div style={{ display: 'grid', gap: '12px' }}>
      <div>
        <Label>Sted</Label>
        <div style={{ display: 'flex', gap: '6px' }}>
          <input
            value={tur.sted}
            onChange={(e) => opdater({ sted: e.target.value, sted_uid: '' })}
            placeholder="fx Palnatokesvej 22, Odense"
            style={{ flex: 1, minWidth: 0 }}
          />
          <Knap onClick={soegPaaSted} disabled={stedSoeger || !tur.sted.trim()} variant="primaer">
            {stedSoeger ? 'Søger...' : 'Find'}
          </Knap>
        </div>

        {/* Er turen knyttet til et gemt sted, står det man ved om stedet her —
            det er hele pointen med at gemme det. */}
        {valgtSted ? (
          <div style={{
            marginTop: '6px',
            padding: '8px 10px',
            borderRadius: '8px',
            background: 'var(--accent-bg)',
            border: '1px solid var(--accent-border)'
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 500 }}>
                {valgtSted.navn}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--tekst-dæmpet)' }}>
                {besoegstekst(besoeg.get(valgtSted.uid) ?? 0)}
              </span>
              <button
                onClick={() => void frigoerSted()}
                style={{ marginLeft: 'auto', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '11px', color: 'var(--tekst-svag)', textDecoration: 'underline' }}
              >
                frigør
              </button>
            </div>
            {valgtSted.noter && (
              <div style={{ fontSize: '11px', color: 'var(--tekst-dæmpet)', marginTop: '4px', lineHeight: 1.5 }}>
                {valgtSted.noter}
              </div>
            )}
          </div>
        ) : (
          tur.sted.trim() !== '' && (
            <div style={{ marginTop: '6px' }}>
              <Knap onClick={() => void gemSomSted()} style={{ fontSize: '11px', padding: '4px 10px' }}>
                Gem som sted
              </Knap>
            </div>
          )
        )}

        {/* Gemte steder står før opslaget udefra: de bærer noterne fra sidst.
            To veje ind — skriv navnet, eller slå hele listen op. Man kan ikke
            altid huske hvad man kaldte stedet. */}
        {!valgtSted && alleSteder.length > 0 && (
          <div style={{ marginTop: '6px' }}>
            <button
              onClick={() => setViserAlleSteder(!viserAlleSteder)}
              style={{
                background: 'transparent',
                border: 'none',
                padding: 0,
                fontSize: '11px',
                cursor: 'pointer',
                color: 'var(--accent)',
                textDecoration: 'underline',
                textUnderlineOffset: '2px'
              }}
            >
              {viserAlleSteder
                ? 'Skjul mine steder'
                : `Vælg blandt mine ${alleSteder.length} steder`}
            </button>
          </div>
        )}

        {gemteSteder.length > 0 && (
          <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {gemteSteder.map((g) => (
              <button
                key={g.uid}
                onClick={() => { void vaelgGemtSted(g); setViserAlleSteder(false); }}
                style={{
                  padding: '5px 10px',
                  fontSize: '11px',
                  background: 'var(--bg-forhoejet)',
                  color: 'var(--accent)',
                  border: '1px solid var(--accent-border)',
                  borderRadius: '14px',
                  cursor: 'pointer'
                }}
              >
                {g.navn}
                <span style={{ color: 'var(--tekst-svag)', marginLeft: '5px' }}>
                  {besoegstekst(besoeg.get(g.uid) ?? 0).toLowerCase()}
                </span>
              </button>
            ))}
          </div>
        )}
        {stedForslag.length > 0 && (
          <div style={{ marginTop: '6px', background: 'var(--bg)', border: '1px solid var(--border-svag)', borderRadius: '8px', overflow: 'hidden' }}>
            {stedForslag.map((f, i) => (
              <button
                key={`${f.lat},${f.lng}`}
                onClick={() => vaelgSted(f)}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '10px 12px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: i < stedForslag.length - 1 ? '1px solid var(--border-svag)' : 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  color: 'var(--tekst)'
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: 500 }}>{f.navn}</div>
                {f.detalje && <div style={{ fontSize: '11px', color: 'var(--tekst-dæmpet)' }}>{f.detalje}</div>}
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <Label fejl={koordinatFejl || undefined}>Koordinater</Label>
        <input
          type="text"
          value={koordinatTekst}
          onChange={(e) => opdaterKoordinater(e.target.value)}
          placeholder="55.66, 10.05"
          style={{ width: '100%' }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '10px' }}>
        <Felt label="Startdato" type="date" value={tur.startdato} onChange={(v) => skiftDato({ startdato: v })} />
        <Felt label="Slutdato" type="date" value={tur.slutdato} onChange={(v) => skiftDato({ slutdato: v })} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '10px' }}>
        <Felt label="Personer" type="number" value={tur.personer} onChange={(v) => opdater({ personer: Number(v) || 1 })} />
        <Felt label="Bæreafstand (km)" type="number" value={tur.baereafstand_km} onChange={(v) => opdater({ baereafstand_km: Number(v) || 0 })} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '10px' }}>
        <Dropdown label="Overnatning" value={tur.overnatning} onChange={(v) => opdater({ overnatning: v as Overnatning })} options={OVERNATNING} formater={etiket} />
        <Dropdown label="Aktivitet" value={tur.aktivitet} onChange={(v) => opdater({ aktivitet: v as Aktivitet })} options={AKTIVITET} formater={etiket} />
        <Dropdown label="Terræn" value={tur.terraen} onChange={(v) => opdater({ terraen: v as Terraen })} options={TERRAEN} formater={etiket} />
        <Dropdown label="Erfaring" value={tur.erfaring} onChange={(v) => opdater({ erfaring: v as Erfaring })} options={ERFARING} formater={etiket} />
      </div>

      <Infokort label="Forventet forbrug">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px', textAlign: 'center' }}>
          <Noegletal vaerdi={`${beregninger.vand_liter} L`} label="Vand" />
          <Noegletal vaerdi={`${beregninger.mad_kg} kg`} label="Mad" />
          <Noegletal vaerdi={`${beregninger.gas_g} g`} label="Gas" />
        </div>
        {/* Tallene er råd og ikke facit, så de skal kunne spørges ad. */}
        <div style={{ marginTop: '8px', display: 'grid', gap: '5px' }}>
          <Forbrugsforklaring label="Vand" begrundelse={beregninger.begrundelser.vand} />
          <Forbrugsforklaring label="Mad" begrundelse={beregninger.begrundelser.mad} />
          <Forbrugsforklaring label="Gas" begrundelse={beregninger.begrundelser.gas} />
        </div>
      </Infokort>
    </div>
  );
}

function Forbrugsforklaring({ label, begrundelse }: { label: string; begrundelse: string }) {
  return (
    <div style={{ fontSize: '11px', color: 'var(--tekst-svag)' }}>
      {label}: <Hvorfor begrundelse={begrundelse} />
    </div>
  );
}

// itemUid → navnet på den der bærer det.
function baerernavne(tur: Tur): Map<Reference, string> {
  const navnPaa = new Map(tur.deltagere.map((d) => [d.id, d.navn]));
  const pr = new Map<Reference, string>();

  baererAf(tur).forEach((deltagerId, itemUid) => {
    const navn = navnPaa.get(deltagerId);
    if (navn) pr.set(itemUid, navn);
  });

  return pr;
}

function Pakkeliste({ afsnit, perItem, visning, setVisning, antal, pakning, pakkede, veksl, pakAlle, ryd }: {
  afsnit: Pakkeafsnit[];
  perItem: Map<Reference, Advarsel[]>;
  visning: Visning;
  setVisning: (v: Visning) => void;
  antal: number;
  pakning: Pakkefremdrift;
  pakkede: Set<Reference>;
  veksl: (uid: Reference) => void;
  pakAlle: () => void;
  ryd: () => void;
}) {
  if (antal === 0) {
    return (
      <div style={{ fontSize: '13px', color: 'var(--tekst-svag)', padding: '10px 0' }}>
        Ingen gear valgt endnu. Vælg en gruppe eller enkelte items under "Vælg gear".
      </div>
    );
  }

  return (
    <div>
      <Pakkestatus pakning={pakning} pakAlle={pakAlle} ryd={ryd} />

      <div style={{ marginBottom: '14px' }}>
        <Segment
          vaerdier={VISNINGER}
          valgt={visning}
          vaelg={setVisning}
          formater={(v) => VISNING_LABEL[v]}
          kompakt
        />
      </div>

      {afsnit.map((a) => (
        <div key={a.titel} style={{ marginBottom: '16px' }}>
          <SektionsTitel>{a.titel}</SektionsTitel>
          {a.linjer.map((linje, n) => (
            <Pakkeraekke
              key={`${linje.uid || linje.navn}-${n}`}
              linje={linje}
              pakket={!!linje.uid && pakkede.has(linje.uid)}
              // Kun ens eget grej kan krydses af. En deltagers ting står på
              // listen, men den er hendes at pakke — ikke ens egen.
              veksl={linje.uid && linje.egen ? () => veksl(linje.uid) : null}
              // Deltagernes eget grej har ingen advarsler — de bygger på tags
              // fra ejerens inventar, og det kender vi ikke for deres ting.
              advarsler={linje.uid ? perItem.get(linje.uid) ?? [] : []}
              // I "efter person" står navnet allerede som overskrift.
              visBaerer={visning !== 'person'}
            />
          ))}
          <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '11px', color: 'var(--tekst-svag)', paddingTop: '5px' }}>
            {kg(samletVaegt(a.linjer))} kg
          </div>
        </div>
      ))}
    </div>
  );
}

// Status og de to knapper der gælder hele listen. Specens §8 har dem i en
// fod; her står de i toppen, fordi det er tallet man kommer for, og fordi en
// fod under en lang liste er et sted man skal scrolle hen for at finde.
function Pakkestatus({ pakning, pakAlle, ryd }: {
  pakning: Pakkefremdrift;
  pakAlle: () => void;
  ryd: () => void;
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--plads-2)',
      flexWrap: 'wrap',
      marginBottom: 'var(--plads-3)',
      paddingBottom: 'var(--plads-3)',
      borderBottom: '1px solid var(--border-svag)'
    }}>
      <span style={{
        flex: 1,
        minWidth: '120px',
        fontSize: 'var(--skrift-brod)',
        fontWeight: 500,
        color: pakning.faerdig ? 'var(--succes)' : 'var(--tekst)'
      }}>
        {pakketekst(pakning)}
      </span>

      {pakning.faerdig ? (
        <Knap onClick={ryd}>Ryd afkrydsning</Knap>
      ) : (
        <Knap onClick={pakAlle}>Markér alle som pakket</Knap>
      )}
    </div>
  );
}

function Pakkeraekke({ linje, advarsler, visBaerer, pakket, veksl }: {
  linje: Pakkelinje;
  advarsler: Advarsel[];
  visBaerer: boolean;
  pakket: boolean;
  // null for en deltagers eget grej, som ikke er ens eget at krydse af.
  veksl: (() => void) | null;
}) {
  // Er der flere huller på samme item, vejer det røde tungest.
  const vaerst = advarsler.find((a) => a.niveau === 'roed') ?? advarsler[0];

  const raekke: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '7px 0',
    borderBottom: '1px solid var(--border-svag)',
    fontSize: '13px',
    background: vaerst ? 'var(--advarsel-bg)' : 'transparent'
  };

  // Hele rækken er trykfladen, ikke bare selve firkanten. Et afkrydsningsfelt
  // er 13 px bredt, og man står med tasken i den ene hånd — skal man ramme 13
  // px for at sige "den er pakket", ryger halvdelen af trykkene ved siden af.
  // En label gør navnet, vægten og luften imellem til det samme mål.
  const Ramme = veksl ? 'label' : 'div';

  return (
    <Ramme style={{ ...raekke, cursor: veksl ? 'pointer' : 'default' }}>
      {/* Pladsen holdes også når der ikke er noget at krydse af, så
          navnene står på linje ned gennem listen. */}
      {veksl ? (
        <input
          type="checkbox"
          checked={pakket}
          onChange={veksl}
          style={{ width: 'auto', flexShrink: 0 }}
        />
      ) : (
        <span style={{ width: '13px', flexShrink: 0 }} />
      )}

      <span style={{
        flex: 1,
        minWidth: 0,
        color: pakket ? 'var(--tekst-svag)' : 'var(--tekst)',
        textDecoration: pakket ? 'line-through' : 'none'
      }}>
        {linje.navn || 'Uden navn'}
      </span>

      {vaerst && (
        <span title={`${vaerst.besked}. ${vaerst.detalje}`}>
          <Chip storrelse="lille" farve={vaerst.niveau === 'roed' ? 'fejl' : 'advarsel'}>
            ⚠ {vaerst.mangler}
          </Chip>
        </span>
      )}

      {visBaerer && linje.baerer && (
        <span style={{ fontSize: '11px', color: 'var(--tekst-dæmpet)' }}>{linje.baerer}</span>
      )}
      {linje.delt && !linje.baerer && <span style={{ fontSize: '10px', color: 'var(--tekst-svag)' }}>delt</span>}
      <span style={{ color: 'var(--tekst-dæmpet)', fontSize: '12px', minWidth: '52px', textAlign: 'right' }}>
        {linje.vaegt_g} g
      </span>
    </Ramme>
  );
}

function Advarsler({ advarsler }: { advarsler: Advarsel[] }) {
  return (
    <Infokort label={`Advarsler (${advarsler.length})`}>
      <Advarselsliste advarsler={advarsler} />
    </Infokort>
  );
}

function Advarselsliste({ advarsler }: { advarsler: Advarsel[] }) {
  return (
    <div style={{ display: 'grid', gap: '8px' }}>
      {advarsler.map((a, i) => (
        <div key={i}>
          <div style={{ fontSize: '12px', fontWeight: 500, color: a.niveau === 'roed' ? 'var(--fejl)' : 'var(--advarsel)' }}>
            {a.besked}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--tekst-dæmpet)', marginTop: '1px' }}>
            {a.detalje} <Hvorfor begrundelse={a.begrundelse} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Vaegt({ prPerson, delt, personligt, personer, baaret }: {
  prPerson: number;
  delt: number;
  personligt: number;
  personer: number;
  baaret: Baerevaegt[];
}) {
  // Gennemsnittet siger ikke noget om, at én har fået teltet. Er gearet
  // fordelt, er det den fordeling der gælder.
  const erFordelt = baaret.some((b) => b.antal > 0);

  return (
    <Infokort label="Vægt" fremhaevet>
      <div style={{ fontSize: '22px', fontWeight: 500, fontFamily: "'Fraunces', Georgia, serif" }}>
        {kg(prPerson)} kg
        {personer > 1 && <span style={{ fontSize: '13px', color: 'var(--tekst-dæmpet)' }}> / pers</span>}
      </div>
      <div style={{ fontSize: '11px', color: 'var(--tekst-dæmpet)', marginTop: '3px' }}>
        {erFordelt ? 'I gennemsnit · ' : ''}Delt: {kg(delt)} kg · Personligt: {kg(personligt)} kg
      </div>

      {erFordelt && (
        <div style={{ marginTop: '10px', paddingTop: '9px', borderTop: '1px solid var(--accent-border)' }}>
          <div style={{ fontSize: '10px', color: 'var(--tekst-dæmpet)', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 600, marginBottom: '5px' }}>
            Sådan er det fordelt
          </div>
          {baaret.map((b) => (
            <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', fontSize: '12px', padding: '2px 0' }}>
              <span>{b.navn}</span>
              <span style={{ color: 'var(--tekst-dæmpet)', whiteSpace: 'nowrap' }}>{kg(b.vaegt_g)} kg</span>
            </div>
          ))}
        </div>
      )}
    </Infokort>
  );
}

function Vejrudsigt({ tur, data, hentes, fejl, hent }: {
  tur: Tur;
  data: VejrData | null;
  hentes: boolean;
  fejl: string;
  hent: () => Promise<void>;
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
        <Knap onClick={hent} disabled={hentes} variant="primaer" style={{ padding: '5px 12px', fontSize: '11px' }}>
          {hentes ? 'Henter...' : data ? 'Opdater' : 'Hent vejr'}
        </Knap>
      </div>

      {fejl && <div style={{ fontSize: '12px', color: 'var(--fejl)', marginBottom: '8px' }}>{fejl}</div>}

      {data ? (
        <>
          <div style={{ display: 'grid', gap: '4px', fontSize: '13px' }}>
            {data.dage.map((d) => (
              <div key={d.dato} style={{ display: 'grid', gridTemplateColumns: '54px 22px minmax(0, 1fr) auto auto', gap: '8px', alignItems: 'center', padding: '3px 0' }}>
                <span style={{ color: 'var(--tekst-dæmpet)', fontSize: '11px' }}>{formatterDag(d.dato)}</span>
                <span style={{ fontSize: '15px' }}>{vejrIkonKode(d.vejrkode)}</span>
                <span>{d.temp_min}–{d.temp_max}°C</span>
                <span style={{ color: 'var(--tekst-svag)', fontSize: '11px' }}>{d.vind_ms} m/s</span>
                <span style={{ color: d.nedboer_mm > 0 ? 'var(--advarsel)' : 'var(--tekst-svag)', fontSize: '11px', minWidth: '38px', textAlign: 'right' }}>
                  {d.nedboer_mm > 0 ? `${d.nedboer_mm} mm` : '—'}
                </span>
              </div>
            ))}
          </div>
          {data.dage[0] && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--tekst-dæmpet)', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border-svag)' }}>
              <span>Sol op {data.dage[0].sol_op}</span>
              <span>Sol ned {data.dage[0].sol_ned}</span>
            </div>
          )}

          <Skumring tur={tur} />
          <Baaltjek dage={data.dage} />
          {data.observationer.length > 0 && (
            <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border-svag)' }}>
              {data.observationer.map((obs, i) => (
                <div key={i} style={{ fontSize: '11px', color: 'var(--tekst-dæmpet)', marginBottom: '3px' }}>· {obs}</div>
              ))}
            </div>
          )}
        </>
      ) : !fejl && (
        <div style={{ fontSize: '12px', color: 'var(--tekst-svag)' }}>Angiv koordinater og datoer, klik "Hent vejr".</div>
      )}
    </div>
  );
}

function Deltagere({ deltagere, turensOvernatning, personer, ture, tilfoejPerson, tilfoejNavn, fjern, saetOvernatning }: {
  deltagere: Deltager[];
  turensOvernatning: Overnatning;
  personer: Person[];
  ture: Tur[];
  tilfoejPerson: (p: Person) => Promise<void>;
  tilfoejNavn: (navn: string) => Promise<void>;
  fjern: (id: string) => Promise<void>;
  saetOvernatning: (id: string, form: Overnatning | null) => Promise<void>;
}) {
  return (
    <div>
      {deltagere.length === 0 ? (
        <div style={{ fontSize: '13px', color: 'var(--tekst-svag)', marginBottom: '12px' }}>
          Kun dig selv indtil videre.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '2px', marginBottom: '12px' }}>
          {deltagere.map((d) => (
            <div
              key={d.id}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', borderBottom: '1px solid var(--border-svag)' }}
            >
              <span style={{ flex: 1, minWidth: 0, fontSize: '13px' }}>
                {d.navn}
                {/* Prikken viser at deltageren er den samme person som på de
                    andre ture — ikke bare et navn der ligner. */}
                {d.person_uid && (
                  <span title="Knyttet til en person" style={{ color: 'var(--accent)', marginLeft: '6px', fontSize: '10px' }}>●</span>
                )}
              </span>

              <select
                value={d.overnatning ?? ''}
                onChange={(e) => saetOvernatning(d.id, (e.target.value || null) as Overnatning | null)}
                style={{ padding: '4px 6px', fontSize: '11px', textTransform: 'capitalize', width: 'auto' }}
              >
                <option value="">som turen ({etiket(turensOvernatning)})</option>
                {OVERNATNING.map((o) => <option key={o} value={o}>{etiket(o)}</option>)}
              </select>

              <FjernKnap onClick={() => fjern(d.id)} label={`Fjern ${d.navn}`} />
            </div>
          ))}
        </div>
      )}
      <Deltagervaelger
        personer={personer}
        ture={ture}
        alleredePaaTuren={deltagere.map((d) => d.person_uid)}
        vaelgPerson={tilfoejPerson}
        vaelgNavn={tilfoejNavn}
      />
    </div>
  );
}

// Tilføjelse af en deltager. Man skriver et navn; findes personen i forvejen,
// står hun som forslag, og så bliver turen talt med under hendes navn. Gør hun
// ikke, er navnet i sig selv nok — man skal kunne komme afsted uden først at
// føre kartotek.
function Deltagervaelger({ personer, ture, alleredePaaTuren, vaelgPerson, vaelgNavn }: {
  personer: Person[];
  ture: Tur[];
  alleredePaaTuren: Reference[];
  vaelgPerson: (p: Person) => Promise<void>;
  vaelgNavn: (navn: string) => Promise<void>;
}) {
  const [tekst, setTekst] = useState('');
  const forslag = foreslaaPersoner(personer, ture, tekst, alleredePaaTuren);
  const antal = antalTurePrPerson(ture);

  // Er navnet allerede en kendt person, ville en fri-tekst-deltager lave en
  // dublet der aldrig bliver talt med.
  const kendt = forslag.find((p) => p.navn.toLowerCase() === tekst.trim().toLowerCase());

  const tilfoej = async () => {
    if (!tekst.trim()) return;
    if (kendt) await vaelgPerson(kendt);
    else await vaelgNavn(tekst);
    setTekst('');
  };

  return (
    <div style={{ display: 'grid', gap: '8px' }}>
      <div style={{ display: 'flex', gap: '6px' }}>
        <input
          value={tekst}
          onChange={(e) => setTekst(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void tilfoej(); }}
          placeholder="Navn på deltager"
          style={{ flex: 1, minWidth: 0, fontSize: '13px' }}
        />
        <Knap onClick={() => void tilfoej()} disabled={!tekst.trim()}>+ Tilføj</Knap>
      </div>

      {tekst.trim() !== '' && forslag.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {forslag.map((p) => (
            <button
              key={p.uid}
              onClick={() => { void vaelgPerson(p); setTekst(''); }}
              style={{
                padding: '5px 10px',
                fontSize: '11px',
                background: 'var(--bg-forhoejet)',
                color: 'var(--accent)',
                border: '1px solid var(--accent-border)',
                borderRadius: '14px',
                cursor: 'pointer'
              }}
            >
              {p.navn}
              <span style={{ color: 'var(--tekst-svag)', marginLeft: '5px' }}>
                {turtekst(antal.get(p.uid) ?? 0)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function turtekst(antal: number): string {
  if (antal === 0) return 'ingen ture';
  return `${antal} ${antal === 1 ? 'tur' : 'ture'}`;
}

const BUDGET_KATEGORIER = ['gear', 'forplejning', 'transport', 'andet'] as const;

function Budget({ linjer, tilfoej, opdater, fjern }: {
  linjer: BudgetLinje[];
  tilfoej: () => Promise<void>;
  opdater: (id: string, a: Partial<BudgetLinje>) => Promise<void>;
  fjern: (id: string) => Promise<void>;
}) {
  return (
    <div>
      {linjer.length === 0 && (
        <div style={{ fontSize: '13px', color: 'var(--tekst-svag)', marginBottom: '12px' }}>
          Ingen budget-linjer endnu.
        </div>
      )}
      {linjer.map((l) => (
        <div key={l.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border-svag)', display: 'grid', gap: '6px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '6px' }}>
            <select value={l.kategori} onChange={(e) => opdater(l.id, { kategori: e.target.value })} style={{ padding: '6px', fontSize: '12px', textTransform: 'capitalize' }}>
              {BUDGET_KATEGORIER.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
            <input placeholder="Beskrivelse" value={l.beskrivelse} onChange={(e) => opdater(l.id, { beskrivelse: e.target.value })} style={{ padding: '6px', fontSize: '12px', minWidth: 0 }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) auto', gap: '6px', alignItems: 'center' }}>
            <Talinput placeholder="Forventet" value={l.forventet_kr} onChange={(v) => opdater(l.id, { forventet_kr: Number(v) || 0 })} style={{ padding: '6px', fontSize: '12px', minWidth: 0 }} />
            <Talinput placeholder="Faktisk" value={l.faktisk_kr} onChange={(v) => opdater(l.id, { faktisk_kr: Number(v) || 0 })} style={{ padding: '6px', fontSize: '12px', minWidth: 0 }} />
            <button onClick={() => fjern(l.id)} style={{ background: 'transparent', border: 'none', color: 'var(--fejl)', cursor: 'pointer', fontSize: '14px', padding: '0 6px' }}>
              ×
            </button>
          </div>
        </div>
      ))}
      <div style={{ marginTop: '12px' }}>
        <Knap onClick={tilfoej}>+ Tilføj linje</Knap>
      </div>
    </div>
  );
}

function Indholdsvalg({ grupper, items, tur, paaTuren, gruppeForslag, savnedeTags, toggleGruppe, toggleLoestItem }: {
  grupper: Gruppe[];
  items: Item[];
  tur: Tur;
  paaTuren: Set<Reference>;
  gruppeForslag: GruppeForslag[];
  savnedeTags: string[];
  toggleGruppe: (uid: Reference) => Promise<void>;
  toggleLoestItem: (uid: Reference) => Promise<void>;
}) {
  return (
    <div>
      {gruppeForslag.length > 0 && (
        <div style={{ padding: '10px 12px', background: 'var(--accent-bg)', borderRadius: '8px', marginBottom: '16px' }}>
          <SektionsTitel>Foreslåede grupper</SektionsTitel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {gruppeForslag.map((f) => (
              <button
                key={f.gruppe.uid}
                onClick={() => toggleGruppe(f.gruppe.uid)}
                style={{ padding: '5px 12px', fontSize: '12px', background: 'var(--bg-forhoejet)', color: 'var(--accent)', border: '1px solid var(--accent-border)', borderRadius: '14px', cursor: 'pointer', fontWeight: 500 }}
              >
                + {f.gruppe.navn}
              </button>
            ))}
          </div>
          {/* Én samlet forklaring frem for en pr. chip — ellers fylder
              spørgsmålstegnene mere end forslagene. */}
          <div style={{ marginTop: '6px' }}>
            <Hvorfor begrundelse={gruppeForslag.map((f) => f.begrundelse).join(' ')} />
          </div>
        </div>
      )}

      {savnedeTags.length > 0 && (
        <div style={{
          padding: '9px 11px',
          marginBottom: '16px',
          borderRadius: '8px',
          border: '1px dashed var(--border)',
          fontSize: '11px',
          color: 'var(--tekst-dæmpet)',
          lineHeight: 1.55
        }}>
          {/* Uden det her tier motoren bare, og man tror den ikke har noget at
              sige — i stedet for at den mangler et tag at sige det med. */}
          Turen er markeret <strong style={{ fontWeight: 500 }}>{savnedeTags.map(etiket).join(', ')}</strong>,
          men {savnedeTags.length === 1 ? 'det tag har' : 'de tags har'} ingen af dine grupper.
          Sæt {savnedeTags.length === 1 ? 'det' : 'dem'} på en gruppe, så kan den foreslås
          næste gang.
        </div>
      )}

      <SektionsTitel>Grupper</SektionsTitel>
      {grupper.length === 0 && (
        <div style={{ fontSize: '13px', color: 'var(--tekst-svag)', padding: '4px 0' }}>Ingen grupper endnu.</div>
      )}
      {grupper.map((g) => {
        const gItems = items.filter((i) => g.item_ids.includes(i.uid));
        const gVaegt = gItems.reduce((s, i) => s + i.vaegt_g, 0);
        return (
          <Vaelgerraekke
            key={g.uid}
            titel={g.navn}
            detalje={`${gItems.length} items · ${kg(gVaegt)} kg`}
            valgt={tur.gruppe_ids.includes(g.uid)}
            toggle={() => toggleGruppe(g.uid)}
          />
        );
      })}

      <div style={{ marginTop: '18px' }}>
        <SektionsTitel>Løse items</SektionsTitel>
        {items.filter((i) => i.status === 'ejer').map((item) => {
          const valgtLoest = tur.loese_item_ids.includes(item.uid);
          // Items der allerede kommer via en gruppe kan ikke fravælges her.
          const viaGruppe = paaTuren.has(item.uid) && !valgtLoest;
          return (
            <Vaelgerraekke
              key={item.uid}
              titel={item.navn}
              detalje={`${item.vaegt_g} g${item.delt ? ' · delt' : ''}${viaGruppe ? ' · via gruppe' : ''}`}
              valgt={valgtLoest || viaGruppe}
              laast={viaGruppe}
              toggle={() => toggleLoestItem(item.uid)}
            />
          );
        })}
      </div>
    </div>
  );
}

// Afkrydsningsrække brugt til både grupper og løse items.
// Hvem slæber hvad. Vægten pr. person er ellers et gennemsnit, og det siger
// intet om, at én har fået teltet med.
function Fordeling({ deltagere, pakItems, baerer, vaegte, toggle }: {
  deltagere: Deltager[];
  pakItems: Item[];
  baerer: Map<Reference, string>;
  vaegte: Baerevaegt[];
  toggle: (deltagerId: string, item: Item) => Promise<void>;
}) {
  const [valgt, setValgt] = useState(deltagere[0]?.id ?? '');
  // Fjernes en deltager mens sektionen er åben, falder vi tilbage til den
  // første der er tilbage.
  const aktiv = deltagere.some((d) => d.id === valgt) ? valgt : (deltagere[0]?.id ?? '');

  return (
    <div>
      <div style={{ display: 'grid', gap: '4px', marginBottom: '14px' }}>
        {vaegte.map((v) => (
          <button
            key={v.id}
            onClick={() => setValgt(v.id)}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              gap: '10px',
              padding: '8px 10px',
              borderRadius: '8px',
              cursor: 'pointer',
              textAlign: 'left',
              fontSize: '13px',
              border: `1px solid ${v.id === aktiv ? 'var(--accent-border)' : 'transparent'}`,
              background: v.id === aktiv ? 'var(--accent-bg)' : 'transparent',
              color: 'var(--tekst)'
            }}
          >
            <span style={{ fontWeight: v.id === aktiv ? 600 : 400 }}>{v.navn}</span>
            <span style={{ fontSize: '11px', color: 'var(--tekst-dæmpet)', whiteSpace: 'nowrap' }}>
              {v.antal === 0 ? 'intet endnu' : `${v.antal} ting · ${kg(v.vaegt_g)} kg`}
            </span>
          </button>
        ))}
      </div>

      {aktiv && (
        <div>
          <SektionsTitel>Gear på turen</SektionsTitel>
          {pakItems.map((item) => {
            const hos = baerer.get(item.uid);
            // Gear en anden allerede har taget, kan ikke også være dit — men
            // det skal kunne ses, så man ved hvorfor det ikke er til rådighed.
            const hosAnden = hos !== undefined && hos !== aktiv;
            const hosNavn = deltagere.find((d) => d.id === hos)?.navn;

            return (
              <label
                key={item.uid}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '7px 10px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  marginBottom: '2px',
                  opacity: hosAnden ? 0.55 : 1,
                  background: hos === aktiv ? 'var(--accent-bg)' : 'transparent'
                }}
              >
                <input
                  type="checkbox"
                  checked={hos === aktiv}
                  onChange={() => toggle(aktiv, item)}
                  style={{ width: 'auto' }}
                />
                <span style={{ flex: 1, minWidth: 0, fontSize: '13px' }}>
                  {item.navn || 'Uden navn'}
                  {item.delt && <span style={{ fontSize: '10px', color: 'var(--tekst-svag)', marginLeft: '6px' }}>delt</span>}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--tekst-dæmpet)', whiteSpace: 'nowrap' }}>
                  {hosAnden ? `hos ${hosNavn}` : `${item.vaegt_g} g`}
                </span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

// "3 af 8 fordelt" — nok til at se om der er mere at tage stilling til.
function fordelingsResume(tur: Tur, pakItems: Item[]): string {
  const baerer = baererAf(tur);
  const fordelt = pakItems.filter((i) => baerer.has(i.uid)).length;

  if (fordelt === 0) return `Intet af ${pakItems.length} fordelt`;
  if (fordelt === pakItems.length) return 'Alt er fordelt';
  return `${fordelt} af ${pakItems.length} fordelt`;
}

// Delingen af en tur. Linket er det eneste der giver adgang, så det kan
// trækkes tilbage — og et nyt link får et nyt token.
function Deling({ token, snapshot, deltagelser, gearnavne, del, stop }: {
  token: string;
  snapshot: string;
  deltagelser: Deltagelse[];
  // uid → navn, så en der har meldt sig kan nævnes ved det grej hun tager.
  gearnavne: Map<Reference, string>;
  del: () => Promise<void>;
  stop: () => Promise<void>;
}) {
  const [kopieret, setKopieret] = useState(false);

  if (!token) {
    return (
      <div>
        <div style={{ fontSize: '13px', color: 'var(--tekst-dæmpet)', lineHeight: 1.55, marginBottom: '12px' }}>
          Lav et link til dem der skal med. De skal logge ind for at åbne det,
          og så kan de skrive hvad de selv tager med, og hvad de bærer af det
          fælles. De ser turen, pakkelisten og din besked — ikke dit øvrige
          inventar og ingen priser.
        </div>
        <Knap variant="primaer" onClick={del}>Lav et gæstelink</Knap>
      </div>
    );
  }

  const link = deleLink(token);
  const delt = laesDeltDen(snapshot);
  // Et link lavet et sted gæsten ikke kan nå, virker kun for én selv — og det
  // opdager man først, når gæsten skriver tilbage.
  const advarsel = linkadvarsel();

  const kopier = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setKopieret(true);
      setTimeout(() => setKopieret(false), 2000);
    } catch {
      // Uden adgang til udklipsholderen kan linket stadig markeres i feltet.
    }
  };

  return (
    <div>
      <input
        readOnly
        value={link}
        onFocus={(e) => e.currentTarget.select()}
        style={{ width: '100%', fontSize: '12px', marginBottom: '8px' }}
      />

      <div style={{ fontSize: '11px', color: 'var(--tekst-svag)', marginBottom: '10px' }}>
        Gæsten lander på <strong style={{ fontWeight: 500 }}>{linkvaert()}</strong>
      </div>

      {advarsel && <Linkfejl slags={advarsel} />}

      <Linkdeling link={link} />

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
        <Knap variant="primaer" onClick={kopier}>{kopieret ? 'Kopieret' : 'Kopiér link'}</Knap>
        <Knap variant="fare" onClick={stop}>Stop deling</Knap>
      </div>

      <div style={{ fontSize: '11px', color: 'var(--tekst-svag)', marginTop: '12px', lineHeight: 1.55 }}>
        De andre ser turen som den er nu — den følger med af sig selv, når du
        retter noget. Sidst opdateret {delt}. Alle med linket og en konto kan
        se turen, indtil du stopper delingen.
      </div>

      <Meldtind deltagelser={deltagelser} gearnavne={gearnavne} />
    </div>
  );
}

// Hvor sækken kan blive lettere. Forslagene er kandidater og ikke svar:
// motoren kender kun tags og gram, ikke om de to ting faktisk kan det samme.
// Vægtbryderne, som specens §7.2 vil have dem: vægten som den er, hvad der
// kan hentes, og hvert bytte med sin risiko og sin konsekvens.
//
// Risikoen er ikke pynt. Uden den ser et bytte, der bare er lettere, ud som et
// bytte, der kan det samme — og det er dér, en motor holder op med at blive
// læst. Derfor står konsekvensen som tekst under mærket og ikke bag "hvorfor?".
//
// Automatisk fjernelse er aldrig tilladt. "Byt alle" er derfor en knap, man
// trykker på, og den tager ét bytte pr. tungt stykke gear — det sikreste, ikke
// det mest sparende.
const RISIKOMAERKE: Record<Risiko, { navn: string; niveau: 'succes' | 'advarsel' | 'fejl' }> = {
  lav: { navn: 'lav risiko', niveau: 'succes' },
  mellem: { navn: 'mellem risiko', niveau: 'advarsel' },
  hoej: { navn: 'høj risiko', niveau: 'fejl' }
};

function Vaegtbrydere({ resultat, byt: tagImod }: {
  resultat: Vaegtresultat;
  byt: (bytter: Bytte[]) => Promise<void>;
}) {
  const alle = bedsteBytter(resultat.brydere);

  return (
    <div style={{ display: 'grid', gap: 'var(--plads-3)' }}>
      <div style={{ fontSize: 'var(--skrift-detalje)', color: 'var(--tekst-dæmpet)', lineHeight: 1.55 }}>
        Pakken vejer {kg(resultat.nuvaerende_g)} kg. Der er {kg(resultat.potentiel_besparelse_g)} kg
        at hente på lettere gear, du allerede ejer. Om de kan det samme, er dit valg —
        motoren kender kun tags, gram og dine stjerner.
      </div>

      {alle.length > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--plads-2)', flexWrap: 'wrap' }}>
          <Knap variant="primaer" onClick={() => void tagImod(alle)}>
            Byt alle {alle.length}
          </Knap>
          <span style={{ fontSize: 'var(--skrift-lille)', color: 'var(--tekst-dæmpet)' }}>
            tager det sikreste bytte på hver ting
          </span>
        </div>
      )}

      {resultat.brydere.map(({ tung, alternativer, begrundelse }) => (
        <div
          key={tung.uid}
          style={{
            border: '1px solid var(--border-svag)',
            borderRadius: 'var(--runding-lille)',
            padding: 'var(--plads-3)',
            background: 'var(--bg-forhoejet)'
          }}
        >
          <div style={{ fontSize: 'var(--skrift-knap)', marginBottom: '2px' }}>
            {tung.navn}
            <span style={{ color: 'var(--tekst-dæmpet)', fontSize: 'var(--skrift-lille)', marginLeft: 'var(--plads-2)' }}>
              {tung.vaegt_g} g
            </span>
          </div>

          <div style={{ display: 'grid', gap: 'var(--plads-2)', marginTop: 'var(--plads-2)' }}>
            {alternativer.map((a) => (
              <div key={a.item.uid} style={{ display: 'grid', gap: 'var(--plads-1)' }}>
                {/* Ombryder frem for at mase. På en telefon er der ikke plads
                    til navn, vægt, risiko, besparelse og knap på én linje —
                    og uden ombrydning brækkede "1200 g" midt over, så mærket
                    lagde sig oven i g'et. */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 'var(--plads-2)',
                  fontSize: 'var(--skrift-detalje)'
                }}>
                  <span style={{ flex: '1 1 auto', minWidth: 0 }}>
                    {a.item.navn}
                    <span style={{
                      color: 'var(--tekst-svag)',
                      marginLeft: 'var(--plads-1)',
                      whiteSpace: 'nowrap'
                    }}>
                      {a.item.vaegt_g} g
                    </span>
                  </span>
                  <Badge niveau={RISIKOMAERKE[a.risiko].niveau}>{RISIKOMAERKE[a.risiko].navn}</Badge>
                  <span style={{ color: 'var(--accent)', whiteSpace: 'nowrap' }}>
                    −{a.sparet_g} g
                  </span>
                  <Knap
                    onClick={() => void tagImod([{
                      tung, lette: a.item, sparet_g: a.sparet_g, risiko: a.risiko
                    }])}
                    style={{ fontSize: 'var(--skrift-lille)', padding: '3px 9px' }}
                  >
                    Byt
                  </Knap>
                </div>
                <div style={{
                  fontSize: 'var(--skrift-lille)',
                  color: 'var(--tekst-dæmpet)',
                  lineHeight: 1.5
                }}>
                  {a.konsekvens}
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 'var(--plads-2)' }}>
            <Hvorfor begrundelse={begrundelse} />
          </div>
        </div>
      ))}
    </div>
  );
}

// "Ligesom sidst": kopiér grejet fra en tidligere tur der lignede.
//
// Boksen står kun på en tom kladde og forsvinder så snart der er valgt noget.
// Den kræver et tryk — motoren er rådgiver og ikke automat.
function Ligesomsidst({ forslag, tur, grupper, items, kopier }: {
  forslag: Kopiforslag[];
  tur: Tur;
  grupper: Gruppe[];
  items: Item[];
  kopier: (fra: Tur) => Promise<void>;
}) {
  return (
    <Infokort label="Ligesom sidst" fremhaevet>
      <div style={{ fontSize: '12px', color: 'var(--tekst-dæmpet)', lineHeight: 1.55, marginBottom: '10px' }}>
        Turen ligner nogle du har været på før. Kopiér grejet, og ret bagefter.
      </div>

      <div style={{ display: 'grid', gap: '8px' }}>
        {forslag.map((f) => {
          const nye = antalNye(f.tur, tur, grupper, items);

          return (
            <div key={f.tur.uid}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: '13px' }}>
                  {f.tur.navn || 'Uden navn'}
                  <span style={{ color: 'var(--tekst-svag)', fontSize: '11px', marginLeft: '6px' }}>
                    matcher {f.score} af {f.maks}
                  </span>
                </span>
                <Knap
                  onClick={() => void kopier(f.tur)}
                  disabled={nye === 0}
                  style={{ fontSize: '11px', padding: '4px 10px' }}
                >
                  {nye === 0 ? 'Alt er med' : `Kopiér ${nye} stk.`}
                </Knap>
              </div>
              <div style={{ marginTop: '3px' }}>
                <Hvorfor begrundelse={f.begrundelse} />
              </div>
            </div>
          );
        })}
      </div>
    </Infokort>
  );
}

// Turlogen. Vejret som det faktisk var, hvad man så, hvad der virkede.
//
// Nyeste øverst og samlet pr. dag: en dagbog læses dagvis, og det man skrev i
// aftes er det man har brug for at se først når man åbner turen igen.
function Turlog({ noter, tilfoej, saet, fjern }: {
  noter: Feltnote[];
  tilfoej: (tekst: string) => void;
  saet: (id: string, tekst: string) => void;
  fjern: (id: string) => void;
}) {
  const [udkast, setUdkast] = useState('');

  const skriv = () => {
    if (!udkast.trim()) return;
    tilfoej(udkast);
    setUdkast('');
  };

  return (
    <div>
      <div style={{ display: 'grid', gap: '8px', marginBottom: '16px' }}>
        <Tekstomraade
          label="Ny indgang"
          value={udkast}
          onChange={setUdkast}
          raekker={3}
          placeholder="Hvad skete der i dag?"
        />
        <div>
          <Knap variant="primaer" onClick={skriv} disabled={!udkast.trim()}>
            + Skriv i loggen
          </Knap>
        </div>
      </div>

      {noter.length === 0 ? (
        <div style={{ fontSize: '13px', color: 'var(--tekst-svag)', lineHeight: 1.5 }}>
          Ingen indgange endnu. Det behøver ikke være meget — "regn fra fire, tarp holdt"
          er nok til at kunne huske turen om et år.
        </div>
      ) : (
        efterDag(noter).map((dag) => (
          <section key={dag.dato} style={{ marginBottom: '14px' }}>
            <SektionsTitel>{overskriftFor(dag.dato)}</SektionsTitel>
            <div style={{ display: 'grid', gap: '8px' }}>
              {dag.indgange.map((note) => (
                <div
                  key={note.id}
                  style={{
                    border: '1px solid var(--border-svag)',
                    borderRadius: '10px',
                    padding: '10px 12px',
                    background: 'var(--bg-forhoejet)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '5px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--tekst-svag)' }}>
                      {tidstekst(note.tid)}
                    </span>
                    <button
                      onClick={() => fjern(note.id)}
                      aria-label="Slet indgangen"
                      style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: 'var(--fejl)', cursor: 'pointer', fontSize: '14px', padding: '0 2px' }}
                    >
                      ×
                    </button>
                  </div>
                  {/* Indgangen kan rettes, men tidsstemplet bliver stående —
                      det er stadig den samme aften. */}
                  <textarea
                    value={note.tekst}
                    onChange={(e) => saet(note.id, e.target.value)}
                    rows={Math.min(8, Math.max(2, note.tekst.split('\n').length))}
                    style={{
                      width: '100%',
                      fontSize: '13px',
                      lineHeight: 1.55,
                      border: 'none',
                      background: 'transparent',
                      padding: 0,
                      resize: 'vertical',
                      color: 'var(--tekst)'
                    }}
                  />
                </div>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

// "Tirsdag 4. august" — eller datoen som den står, hvis den ikke kan læses.
function overskriftFor(dato: string): string {
  const d = new Date(dato);
  if (!dato || Number.isNaN(d.getTime())) return 'Uden dato';

  const dage = ['Søndag', 'Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag'];
  const maaneder = [
    'januar', 'februar', 'marts', 'april', 'maj', 'juni',
    'juli', 'august', 'september', 'oktober', 'november', 'december'
  ];

  return `${dage[d.getDay()]} ${d.getDate()}. ${maaneder[d.getMonth()]}`;
}

// QR ved siden af et link. Ved bålet uden dækning er en kode mærkbart bedre
// end at læse 32 hex-tegn op — og den anden har ikke nødvendigvis noget at
// skrive på.
//
// På PC står koden fremme; der er plads, og skærmen er stor nok til at skanne
// fra. På mobil ville den æde sektionen, så den ligger bag en knap og åbner i
// fuld skærm — en lille kode på en telefon er svær at fange med en anden.
function Linkdeling({ link }: { link: string }) {
  const erDesktop = useErDesktop();
  const [viserFuld, setViserFuld] = useState(false);

  if (erDesktop) {
    return (
      <div style={{ marginTop: '10px' }}>
        <Qrkode vaerdi={link} />
      </div>
    );
  }

  return (
    <>
      <div style={{ marginTop: '10px' }}>
        <Knap onClick={() => setViserFuld(true)}>Vis QR-kode</Knap>
      </div>
      {viserFuld && <Qrfuldskaerm vaerdi={link} luk={() => setViserFuld(false)} />}
    </>
  );
}

// Afgangs-tjeklisten. Alt det man glemmer, som ikke er gear.
function Afgangstjekliste({ tjek, opret, gem }: {
  tjek: AfgangsTjek | null;
  opret: () => void;
  gem: (t: AfgangsTjek) => void;
}) {
  const [nyLinje, setNyLinje] = useState('');

  if (!tjek) {
    return (
      <div>
        <div style={{ fontSize: '13px', color: 'var(--tekst-dæmpet)', marginBottom: '12px', lineHeight: 1.5 }}>
          Nøgler, telefon opladet, besked til den derhjemme. Listen bygges på din skabelon
          fra indstillingerne, og du kan tilføje til den her.
        </div>
        <Knap onClick={opret}>Lav afgangs-tjek</Knap>
      </div>
    );
  }

  const tilfoej = () => {
    if (!nyLinje.trim()) return;
    gem(tilfoejLinje(tjek, nyLinje));
    setNyLinje('');
  };

  return (
    <div>
      <div style={{ display: 'grid', gap: '2px', marginBottom: '12px' }}>
        {tjek.linjer.map((linje) => (
          <div
            key={linje.id}
            style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '5px 0' }}
          >
            <input
              type="checkbox"
              checked={linje.afkrydset}
              onChange={(e) => gem(saetAfkrydset(tjek, linje.id, e.target.checked))}
              style={{ width: 'auto', flexShrink: 0 }}
            />
            <input
              value={linje.tekst}
              onChange={(e) => gem(saetTekst(tjek, linje.id, e.target.value))}
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: '13px',
                border: 'none',
                background: 'transparent',
                padding: '2px 0',
                textDecoration: linje.afkrydset ? 'line-through' : 'none',
                color: linje.afkrydset ? 'var(--tekst-svag)' : 'var(--tekst)'
              }}
            />
            <FjernKnap onClick={() => gem(fjernLinje(tjek, linje.id))} label={`Fjern ${linje.tekst}`} />
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '6px' }}>
        <input
          value={nyLinje}
          onChange={(e) => setNyLinje(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') tilfoej(); }}
          placeholder="Tilføj et punkt"
          style={{ flex: 1, minWidth: 0, fontSize: '13px' }}
        />
        <Knap onClick={tilfoej} disabled={!nyLinje.trim()}>+ Tilføj</Knap>
      </div>
    </div>
  );
}

// Turkortet til én pårørende. Samme mønster som gæstelinket, men snævrere:
// modtageren har ingen konto og ser kun fire ting.
function Turkort({ tur, stednavn, opdater, lav, stop }: {
  tur: Tur;
  stednavn: string;
  opdater: (a: Partial<Tur>) => Promise<void>;
  lav: () => Promise<void>;
  stop: () => Promise<void>;
}) {
  const [kopieret, setKopieret] = useState(false);
  const link = tur.turkort_token ? turkortLink(tur.turkort_token) : '';

  const kopier = async () => {
    await navigator.clipboard.writeText(link);
    setKopieret(true);
    setTimeout(() => setKopieret(false), 2000);
  };

  return (
    <div style={{ display: 'grid', gap: '12px' }}>
      <div style={{ fontSize: '12px', color: 'var(--tekst-dæmpet)', lineHeight: 1.55 }}>
        Ét link til én person: hvor du er, hvornår du burde være hjemme, og hvad du selv
        skriver. Ikke live-position — modtageren ser det du delte, og at turen er slut når
        du markerer den afsluttet.
      </div>

      <Felt
        label="Forventet hjemme"
        type="datetime-local"
        value={tur.turkort_retur}
        onChange={(v) => opdater({ turkort_retur: v })}
        hjaelp="det tidspunkt hvor nogen skal begynde at undre sig"
      />

      <Tekstomraade
        label="Besked"
        value={tur.turkort_besked}
        onChange={(v) => opdater({ turkort_besked: v })}
        placeholder="fx Ring til Mikkel på 12 34 56 78 hvis jeg ikke er hjemme"
      />

      {link ? (
        <>
          <div style={{
            padding: '9px 11px',
            background: 'var(--bg-forhoejet)',
            border: '1px solid var(--border-svag)',
            borderRadius: '8px',
            fontSize: '11px',
            wordBreak: 'break-all',
            color: 'var(--tekst-dæmpet)'
          }}>
            {link}
          </div>
          <Linkdeling link={link} />

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <Knap onClick={() => void kopier()}>{kopieret ? 'Kopieret' : 'Kopiér link'}</Knap>
            {/* Retter man tidspunktet eller beskeden, skal kortet bygges om —
                modtageren læser et frosset øjebliksbillede. */}
            <Knap onClick={() => void lav()}>Opdatér kortet</Knap>
            <Knap variant="fare" onClick={() => void stop()}>Træk tilbage</Knap>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--tekst-svag)' }}>
            Viser {stednavn || tur.sted || 'intet sted'} · hjemme {returtekst(tur.turkort_retur)}
          </div>
        </>
      ) : (
        <div>
          <Knap variant="primaer" onClick={() => void lav()} disabled={!tur.turkort_retur}>
            Lav turkort
          </Knap>
          {!tur.turkort_retur && (
            <div style={{ fontSize: '11px', color: 'var(--tekst-svag)', marginTop: '6px' }}>
              Sæt et forventet hjemkomsttidspunkt først — det er den ene oplysning kortet
              er til for.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Hvem der er kommet med, og det man ikke kan aflæse af pakkelisten. Selve
// grejet står dér — det er én tur og én liste.
function Meldtind({ deltagelser, gearnavne }: {
  deltagelser: Deltagelse[];
  gearnavne: Map<Reference, string>;
}) {
  // To der har meldt sig på det samme telt er ikke en fejl appen kan afgøre,
  // men det er noget ejeren skal se frem for at opdage det på P-pladsen.
  const dobbelt = [...baererePrGear(deltagelser).entries()].filter(([, navne]) => navne.length > 1);

  if (deltagelser.length === 0) return null;

  return (
    <div style={{ marginTop: '18px', paddingTop: '14px', borderTop: '1px solid var(--border-svag)' }}>
      <SektionsTitel>Med på turen ({deltagelser.length})</SektionsTitel>

      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {deltagelser.map((d) => <Chip key={d.pb_id ?? d.user}>{visningsnavn(d)}</Chip>)}
      </div>

      <div style={{ fontSize: '11px', color: 'var(--tekst-svag)', marginTop: '8px', lineHeight: 1.55 }}>
        Det de tager med, står i pakkelisten sammen med dit eget.
      </div>

      {dobbelt.map(([uid, navne]) => (
        <div key={uid} style={{ fontSize: '12px', color: 'var(--advarsel)', marginTop: '8px' }}>
          {navne.join(' og ')} har begge meldt sig på {gearnavne.get(uid) ?? 'noget der er taget af listen'}.
        </div>
      ))}
    </div>
  );
}

// De to tilfælde vi kan afgøre med sikkerhed. En preview-adresse vi ikke kan
// genkende, fanges af værtsnavnet ovenover.
function Linkfejl({ slags }: { slags: 'lokal' | 'preview' }) {
  return (
    <div style={{
      padding: '10px 12px',
      marginBottom: '10px',
      borderRadius: '8px',
      background: 'var(--advarsel-bg)',
      border: '1px solid var(--advarsel-border)',
      fontSize: '12px',
      color: 'var(--advarsel)',
      lineHeight: 1.55
    }}>
      {slags === 'lokal'
        ? '⚠ Du kører appen lokalt. Linket virker kun på denne maskine — åbn turen på den rigtige adresse for at få et link du kan sende videre.'
        : '⚠ Det her er en preview-adresse. Den er låst bag login, så linket virker kun for dig. Åbn turen på den rigtige adresse for at få et link du kan sende videre.'}
    </div>
  );
}

function laesDeltDen(snapshot: string): string {
  try {
    const d = new Date((JSON.parse(snapshot) as { delt_den?: string }).delt_den ?? '');
    if (!Number.isNaN(d.getTime())) return `den ${d.toLocaleDateString('da-DK')}`;
  } catch {
    // Ikke noget vi kan læse — sig det vagt frem for at gætte.
  }
  return 'da du delte den';
}

function Vaelgerraekke({ titel, detalje, valgt, laast, toggle }: {
  titel: string;
  detalje: string;
  valgt: boolean;
  laast?: boolean;
  toggle: () => void;
}) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '8px 10px',
        borderRadius: '8px',
        cursor: laast ? 'default' : 'pointer',
        opacity: laast ? 0.5 : 1,
        background: valgt && !laast ? 'var(--accent-bg)' : 'transparent',
        marginBottom: '2px'
      }}
    >
      <input type="checkbox" checked={valgt} disabled={laast} onChange={toggle} style={{ width: 'auto' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', color: 'var(--tekst)' }}>{titel || 'Uden navn'}</div>
        <div style={{ fontSize: '11px', color: 'var(--tekst-dæmpet)' }}>{detalje}</div>
      </div>
    </label>
  );
}

function Noegletal({ vaerdi, label }: { vaerdi: string; label: string }) {
  return (
    <div>
      <div style={{ fontSize: '18px', fontWeight: 500, fontFamily: "'Fraunces', Georgia, serif" }}>{vaerdi}</div>
      <div style={{ fontSize: '10px', color: 'var(--tekst-dæmpet)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Hjælpere
// ─────────────────────────────────────────────

const VISNINGER: readonly Visning[] = ['gruppe', 'tag', 'person'];

const VISNING_LABEL: Record<Visning, string> = {
  gruppe: 'Efter gruppe',
  tag: 'Efter tag',
  person: 'Efter person'
};

function kg(gram: number): string {
  return (gram / 1000).toFixed(2);
}

function beregnNaetter(start: string, slut: string): number {
  if (!start || !slut) return 0;
  const dage = (new Date(slut).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24);
  return Math.max(0, Math.floor(dage));
}

// Kort resumé til den foldede vejrsektion: spændet over hele turen.
function vejrResume(data: VejrData | null): string | undefined {
  if (!data || data.dage.length === 0) return undefined;

  const min = Math.min(...data.dage.map((d) => d.temp_min));
  const maks = Math.max(...data.dage.map((d) => d.temp_max));
  const nedboer = data.dage.reduce((s, d) => s + d.nedboer_mm, 0);

  return `${min}–${maks}°C · ${nedboer > 0 ? `${Math.round(nedboer)} mm nedbør` : 'tørt'}`;
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

// Slår en reference til eller fra i en liste.
function vekslet(uids: Reference[], uid: Reference): Reference[] {
  return uids.includes(uid) ? uids.filter((x) => x !== uid) : [...uids, uid];
}

function formatterDag(dato: string): string {
  const d = new Date(dato);
  const dage = ['søn', 'man', 'tir', 'ons', 'tor', 'fre', 'lør'];
  return `${dage[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
}


// Skumringen. Solnedgang er ikke det samme som mørkt, og forskellen er den
// tid man har til at få tarpen op.
//
// Tiderne regnes på enheden ud fra turens koordinater — de virker uden
// dækning, og de kræver ikke et ekstra felt i vejrkaldet.
function Skumring({ tur }: { tur: Tur }) {
  if (!tur.koordinater || !tur.startdato) return null;

  const tider = soltider(tur.startdato, tur.koordinater.lat, tur.koordinater.lng);
  if (!tider) return null;

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px', fontSize: '11px', color: 'var(--tekst-dæmpet)', marginTop: '4px' }}>
      <span>{tider.daggry && `Lyst fra ${tider.daggry}`}</span>
      <span>{skumringstekst(tider)}</span>
    </div>
  );
}

// Tørke og bål. Ikke DMI's skovbrandindeks — en observation på den udsigt
// appen allerede har hentet, og et link til dem der bestemmer.
function Baaltjek({ dage }: { dage: VejrDag[] }) {
  const tjek = baaltjek(dage);
  if (!tjek) return null;

  const toert = tjek.toerhed === 'toert';

  return (
    <div style={{
      marginTop: '10px',
      paddingTop: '10px',
      borderTop: '1px solid var(--border-svag)',
      fontSize: '11px',
      color: toert ? 'var(--advarsel)' : 'var(--tekst-dæmpet)',
      lineHeight: 1.5
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
        <span style={{ flex: 1 }}>{toert && '⚠ '}{tjek.tekst}</span>
        <Hvorfor begrundelse={tjek.begrundelse} />
      </div>
      <a href={FORBUD_LINK} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>
        Se gældende afbrændingsforbud
      </a>
    </div>
  );
}

// Jagtvarsel. Appen ved ikke om der er jagt netop dér den dag — den kender
// sæsonerne og peger på dem der offentliggør jagtdagene.
function Jagtboks({ tur }: { tur: Tur }) {
  const varsel = jagtvarsel(tur);
  if (!varsel) return null;

  return (
    <div style={{
      padding: '10px 12px',
      marginBottom: '14px',
      background: 'var(--advarsel-bg)',
      border: '1px solid var(--advarsel-border)',
      borderRadius: '10px',
      fontSize: '12px',
      color: 'var(--advarsel)',
      lineHeight: 1.5
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
        <span style={{ flex: 1, fontWeight: 500 }}>
          Turen ligger i {varsel.saesoner.map((s) => s.navn.toLowerCase()).join(' og ')}
        </span>
        <Hvorfor begrundelse={varsel.begrundelse} />
      </div>
      {varsel.saesoner.map((s) => (
        <div key={s.navn} style={{ marginTop: '4px', opacity: 0.9 }}>{s.betydning}</div>
      ))}
      <div style={{ marginTop: '6px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <a href={JAGTDAGE_LINK} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>
          Jagtdage i statsskovene
        </a>
        <a href={JAGTTIDER_LINK} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>
          Jagttider
        </a>
      </div>
    </div>
  );
}

// Booking af shelter eller lejrplads. Det er ikke et opslag i Udinaturen —
// det er de tre felter der fjerner "shit, det havde jeg glemt".
function Bookingfelter({ booking, gem }: {
  booking: Booking | null;
  gem: (b: Booking | null) => void;
}) {
  const nu: Booking = booking ?? { link: '', booket: false, reference: '' };

  // Er alle tre tomme igen, er der ikke taget stilling — og så skal feltet
  // ikke stå som et halvt udfyldt løfte.
  const saet = (aendringer: Partial<Booking>) => {
    const naeste = { ...nu, ...aendringer };
    const tomt = !naeste.link.trim() && !naeste.reference.trim() && !naeste.booket;
    gem(tomt ? null : naeste);
  };

  return (
    <div style={{ display: 'grid', gap: '12px' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={nu.booket}
          onChange={(e) => saet({ booket: e.target.checked })}
          style={{ width: 'auto' }}
        />
        Pladsen er booket
      </label>

      <Felt
        label="Link til booking"
        value={nu.link}
        onChange={(v) => saet({ link: v })}
        placeholder="https://udinaturen.dk/..."
      />
      <Felt
        label="Reference"
        value={nu.reference}
        onChange={(v) => saet({ reference: v })}
        placeholder="Bookingnummer eller lignende"
      />

      {nu.link.trim() && (
        <a href={nu.link} target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: 'var(--accent)' }}>
          Åbn bookingen
        </a>
      )}
    </div>
  );
}

export default TurDetalje;
