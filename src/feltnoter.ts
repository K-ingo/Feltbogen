import type { Feltnote, Tur } from './db';

// Turlogen. Vejret som det faktisk var, hvad man så, hvad der virkede.
//
// Feltbogens løfte står i navnet: turen er andet end en pakkeliste. Noterne er
// også det motoren senere skal kunne læse tilbage på — "du skrev koldt om
// natten; samme sovepose igen?".
//
// Indgangene er tidsstemplede og bliver stående. Retter man teksten, er det
// stadig den samme indgang fra den samme aften.

export function nyIndgang(tekst: string, nu: Date = new Date()): Feltnote {
  return { id: crypto.randomUUID(), tid: nu.toISOString(), tekst: tekst.trim() };
}

// Tomme indgange lægges ikke til. En tom linje i en dagbog er ikke en note,
// det er en fejlbetjening.
export function tilfoej(noter: Feltnote[], tekst: string, nu: Date = new Date()): Feltnote[] {
  if (!tekst.trim()) return noter;
  return [...noter, nyIndgang(tekst, nu)];
}

export function saetTekst(noter: Feltnote[], id: string, tekst: string): Feltnote[] {
  return noter.map((n) => (n.id === id ? { ...n, tekst } : n));
}

export function fjern(noter: Feltnote[], id: string): Feltnote[] {
  return noter.filter((n) => n.id !== id);
}

// Nyeste først. Det er den man har brug for at se, når man åbner turen igen —
// og den man skriver videre fra.
export function nyesteFoerst(noter: Feltnote[]): Feltnote[] {
  return [...noter].sort((a, b) => (b.tid || '').localeCompare(a.tid || ''));
}

// Indgangene samlet pr. dag, nyeste dag først. En tur er dage, og en dagbog
// læses dagvis.
export interface Dag {
  dato: string;
  indgange: Feltnote[];
}

export function efterDag(noter: Feltnote[]): Dag[] {
  const pr = new Map<string, Feltnote[]>();

  nyesteFoerst(noter).forEach((note) => {
    const dato = (note.tid || '').slice(0, 10);
    pr.set(dato, [...(pr.get(dato) ?? []), note]);
  });

  return [...pr.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([dato, indgange]) => ({ dato, indgange }));
}

// "3 indgange · senest i går" — resuméet på en foldet sektion.
export function resumetekst(noter: Feltnote[], nu: Date = new Date()): string {
  if (noter.length === 0) return 'Ingen endnu';

  const antal = `${noter.length} ${noter.length === 1 ? 'indgang' : 'indgange'}`;
  const senest = nyesteFoerst(noter)[0]?.tid ?? '';
  const naar = hvornaar(senest, nu);

  return naar ? `${antal} · senest ${naar}` : antal;
}

// "i dag" / "i går" / "for 4 dage siden", eller tom hvis tiden ikke kan læses.
export function hvornaar(iso: string, nu: Date = new Date()): string {
  if (!iso) return '';

  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';

  const dage = Math.round((dagsnoegle(nu) - dagsnoegle(d)) / 86400000);
  if (dage <= 0) return 'i dag';
  if (dage === 1) return 'i går';
  return `for ${dage} dage siden`;
}

// "tir 4/8 kl. 21.15" — tidsstemplet på den enkelte indgang.
export function tidstekst(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';

  const dage = ['søn', 'man', 'tir', 'ons', 'tor', 'fre', 'lør'];
  const klokken = `${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}`;

  return `${dage[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1} kl. ${klokken}`;
}

export function harFeltnoter(tur: Tur): boolean {
  return (tur.feltnoter ?? []).length > 0;
}

function dagsnoegle(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}
