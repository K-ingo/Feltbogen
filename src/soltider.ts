// Sol og skumring, regnet på enheden.
//
// Oplægget (§5.3) foreslår at hente `civil_twilight_begin` fra open-meteo i
// det samme kald som vejret. Det gør vi ikke, af to grunde:
//
// 1. Sender man en parameter open-meteo ikke kender, svarer den 400 — og så
//    ryger *hele* vejrudsigten, ikke bare skumringen. Det er en høj pris for
//    to klokkeslæt.
// 2. Skumring afhænger kun af sted og dato. Det er regnestykke, ikke data, og
//    et regnestykke virker uden dækning. Man står i skoven når det bliver
//    mørkt, ikke ved en router.
//
// Algoritmen er den almindelige solopgangsligning. Den regner med en
// kugleformet jord og ser bort fra højde over havet, så den rammer inden for
// et minut eller to. Det er rigeligt til at vide hvornår pandelampen skal
// frem.

const GRAD = Math.PI / 180;

// Solens midtpunkt står 0,833° under horisonten ved op- og nedgang: en halv
// soldiameter plus den brydning atmosfæren giver.
export const SOLRAND = -0.833;

// Civil skumring. Her kan man stadig læse et kort udenfor, og det er her man
// reelt tænder lygten.
export const CIVIL = -6;

// Dagsnummer siden J2000, som ligningen regner i.
function dagstal(dato: Date): number {
  return Math.ceil((dato.getTime() - Date.UTC(2000, 0, 1, 12)) / 86_400_000);
}

export interface Soltider {
  // "05:42" i turens tidszone, eller tom hvis solen ikke krydser den højde
  // det døgn — midnatssol eller mørketid.
  op: string;
  ned: string;
  // Civil skumring: når det begynder at blive lyst, og når det holder op med
  // at være det.
  daggry: string;
  moerkt: string;
}

// Klokkeslættene for ét døgn på ét sted.
//
// `dato` er dagen i lokal tid ("2026-07-10"). Tidszonen er den danske —
// appen er dansk, og en tur til Norge er stadig planlagt hjemmefra.
export function soltider(dato: string, lat: number, lng: number): Soltider | null {
  const dag = new Date(`${dato}T12:00:00Z`);
  if (Number.isNaN(dag.getTime())) return null;

  const n = dagstal(dag);

  // Middelsoltid på stedets længdegrad.
  const middel = n - lng / 360;

  // Solens middelanomali, og korrektionen for at banen er en ellipse.
  const M = (357.5291 + 0.985_600_28 * middel) % 360;
  const C = 1.9148 * Math.sin(M * GRAD)
    + 0.02 * Math.sin(2 * M * GRAD)
    + 0.0003 * Math.sin(3 * M * GRAD);

  // Solens position på ekliptika.
  const lambda = (M + C + 180 + 102.9372) % 360;

  // Middagen — når solen står højest.
  const middag = 2_451_545.0 + middel
    + 0.0053 * Math.sin(M * GRAD)
    - 0.0069 * Math.sin(2 * lambda * GRAD);

  const sinDek = Math.sin(lambda * GRAD) * Math.sin(23.4397 * GRAD);
  const cosDek = Math.cos(Math.asin(sinDek));

  // Timevinklen for en given højde over horisonten. Findes den ikke, står
  // solen enten oppe eller nede hele døgnet.
  const timevinkel = (hoejde: number): number | null => {
    const c = (Math.sin(hoejde * GRAD) - Math.sin(lat * GRAD) * sinDek)
      / (Math.cos(lat * GRAD) * cosDek);
    return c < -1 || c > 1 ? null : Math.acos(c) / GRAD;
  };

  // Kolon og ikke punktum. Dansk retskrivning foretrækker 07.15, men appen
  // viser i forvejen solopgang som "07:52" fra vejrudsigten, og to formater
  // på linjer der står lige over hinanden ser ud som en fejl.
  const klokken = (julian: number): string => {
    const ms = (julian - 2_440_587.5) * 86_400_000;
    return new Date(ms)
      .toLocaleTimeString('da-DK', {
        timeZone: 'Europe/Copenhagen',
        hour: '2-digit',
        minute: '2-digit'
      })
      .replace('.', ':');
  };

  const par = (hoejde: number): [string, string] => {
    const w = timevinkel(hoejde);
    if (w === null) return ['', ''];
    return [klokken(middag - w / 360), klokken(middag + w / 360)];
  };

  const [op, ned] = par(SOLRAND);
  const [daggry, moerkt] = par(CIVIL);

  return { op, ned, daggry, moerkt };
}

// Hvor længe skumringen varer efter solnedgang, i minutter. Det er tallet man
// reelt planlægger efter: hvor lang tid har jeg til at få tarpen op.
export function skumringsminutter(tider: Soltider): number | null {
  return minutterMellem(tider.ned, tider.moerkt);
}

export function minutterMellem(fra: string, til: string): number | null {
  const a = minutter(fra);
  const b = minutter(til);
  if (a === null || b === null) return null;

  // Går skumringen over midnat, ligger den anden tid på næste døgn.
  return b >= a ? b - a : b + 24 * 60 - a;
}

function minutter(klokken: string): number | null {
  const m = /^(\d{1,2})[.:](\d{2})$/.exec(klokken.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

// "Mørkt 22:41 — 43 min efter solnedgang" — linjen som den står på skærmen.
//
// Er solen oppe eller nede hele døgnet, siges det frem for at vise tomme
// felter. Det sker kun nord for polarcirklen, men en tur til Nordnorge er
// ikke utænkelig.
export function skumringstekst(tider: Soltider): string {
  if (!tider.ned || !tider.moerkt) return 'Solen står ikke op eller ned det døgn.';

  const minutter = skumringsminutter(tider);
  const halen = minutter === null ? '' : ` — ${minutter} min efter solnedgang`;
  return `Mørkt ${tider.moerkt}${halen}`;
}
