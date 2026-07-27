import type { Item, Tur, Gruppe } from './db';

export interface VejrDag {
  dato: string;
  temp_min: number;
  temp_max: number;
  nedboer_mm: number;
  vind_ms: number;
  vejrkode: number;
  sol_op: string;
  sol_ned: string;
} 

export interface VejrData {
  dage: VejrDag[];
  observationer: string[];
  hentet: string;
} 

export async function hentVejr(
  lat: number,
  lng: number,
  startdato: string,
  slutdato: string
): Promise<VejrData | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max,weathercode,sunrise,sunset&timezone=Europe/Copenhagen&start_date=${startdato}&end_date=${slutdato}`;
    const svar = await fetch(url);
    if (!svar.ok) return null;
    const data = await svar.json();
    if (!data.daily) return null;

    const dage: VejrDag[] = data.daily.time.map((dato: string, i: number) => ({
      dato,
      temp_min: Math.round(data.daily.temperature_2m_min[i]),
      temp_max: Math.round(data.daily.temperature_2m_max[i]),
      nedboer_mm: Math.round(data.daily.precipitation_sum[i]),
      vind_ms: Math.round(data.daily.windspeed_10m_max[i] / 3.6),
      vejrkode: data.daily.weathercode[i],
      sol_op: data.daily.sunrise[i]?.slice(11, 16) ?? '',
      sol_ned: data.daily.sunset[i]?.slice(11, 16) ?? ''
    }));

    return {
      dage,
      observationer: lavObservationer(dage),
      hentet: new Date().toISOString()
    };
  } catch (e) {
    console.error('Vejr-fejl:', e);
    return null;
  }
}

function lavObservationer(dage: VejrDag[]): string[] {
  if (dage.length === 0) return [];
  const obs: string[] = [];

  const total_nedboer = dage.reduce((s, d) => s + d.nedboer_mm, 0);
  const gns_temp = dage.reduce((s, d) => s + (d.temp_min + d.temp_max) / 2, 0) / dage.length;

  const vaadeste = [...dage].sort((a, b) => b.nedboer_mm - a.nedboer_mm)[0];
  if (vaadeste.nedboer_mm >= 5) {
    obs.push(`Vådeste dag: ${dagsnavn(vaadeste.dato)} — ${vaadeste.nedboer_mm} mm regn`);
  }

  const vindigste = [...dage].sort((a, b) => b.vind_ms - a.vind_ms)[0];
  if (vindigste.vind_ms >= 8) {
    obs.push(`Vindigste dag: ${dagsnavn(vindigste.dato)} — ${vindigste.vind_ms} m/s`);
  }

  const koldeste = [...dage].sort((a, b) => a.temp_min - b.temp_min)[0];
  if (koldeste.temp_min <= 5) {
    obs.push(`Koldeste nat: ${dagsnavn(koldeste.dato)} — ${koldeste.temp_min}°C`);
  }

  obs.push(`Total nedbør: ${total_nedboer} mm · gennemsnit ${Math.round(gns_temp)}°C`);

  return obs;
}

function dagsnavn(dato: string): string {
  const d = new Date(dato);
  const dage = ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag'];
  return dage[d.getDay()];
}

export function vejrIkonKode(kode: number): string {
  if (kode === 0) return '☀';
  if (kode <= 3) return '⛅';
  if (kode <= 48) return '☁';
  if (kode <= 67) return '🌧';
  if (kode <= 77) return '❄';
  if (kode <= 82) return '🌦';
  if (kode <= 99) return '⛈';
  return '☁';
}

export interface Beregninger {
  vand_liter: number;
  mad_kg: number;
  gas_g: number;
}

export function beregnForbrug(tur: Tur): Beregninger {
  const dage = Math.max(1, tur.naetter + 1);
  const erSommer = erSommermaanederne(tur.startdato);
  const vand_pr_person_pr_dag = erSommer ? 3.5 : 2.5;

  return {
    vand_liter: Math.round(tur.personer * dage * vand_pr_person_pr_dag * 10) / 10,
    mad_kg: Math.round(tur.personer * dage * 0.6 * 10) / 10,
    gas_g: Math.round(tur.personer * dage * 25)
  };
}

function erSommermaanederne(dato: string): boolean {
  if (!dato) return true;
  const m = new Date(dato).getMonth();
  return m >= 3 && m <= 8;
}

export interface Advarsel {
  niveau: 'roed' | 'gul';
  besked: string;
  detalje: string;
}

export function findAdvarsler(pakItems: Item[]): Advarsel[] {
  const advarsler: Advarsel[] = [];

  const alleTagsPaaTur = new Set<string>();
  pakItems.forEach((i) => i.tags.forEach((t) => alleTagsPaaTur.add(t)));

  pakItems.forEach((item) => {
    item.kraever.forEach((krav) => {
      if (!alleTagsPaaTur.has(krav)) {
        advarsler.push({
          niveau: 'roed',
          besked: `${item.navn} kræver "${krav}"`,
          detalje: 'Ingen items på turen leverer dette. Tilføj et item med tagget.'
        });
      }
    });

    item.komplementer.forEach((komp) => {
      if (!alleTagsPaaTur.has(komp)) {
        advarsler.push({
          niveau: 'gul',
          besked: `${item.navn} komplementerer "${komp}"`,
          detalje: 'Ingen items på turen leverer dette. Overvej at tilføje.'
        });
      }
    });
  });

  return advarsler;
}

export function foreslaaGrupper(tur: Tur, grupper: Gruppe[]): Gruppe[] {
  const turTags = new Set<string>();
  turTags.add(tur.overnatning);
  turTags.add(tur.aktivitet);
  turTags.add(tur.terraen);
  if (tur.personer > 1) turTags.add('gruppe');
  else turTags.add('solo');

  return grupper
    .filter((g) => g.id && !tur.gruppe_ids.includes(g.id))
    .map((g) => ({
      gruppe: g,
      score: g.tags.filter((t) => turTags.has(t)).length
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((x) => x.gruppe);
}
export interface StedForslag {
    navn: string;
    detalje: string;
    lat: number;
    lng: number;
  }
  
  export async function soegSted(soegning: string): Promise<StedForslag[]> {
    const q = soegning.trim();
    if (q.length < 2) return [];
  
    const [openMeteoResultater, dawaResultater] = await Promise.all([
      soegOpenMeteo(q),
      soegDawa(q)
    ]);
  
    const alle = [...dawaResultater, ...openMeteoResultater];
  
    const seen = new Set<string>();
    const unikke: StedForslag[] = [];
    alle.forEach((r) => {
      const noegle = `${r.lat.toFixed(3)},${r.lng.toFixed(3)}`;
      if (!seen.has(noegle)) {
        seen.add(noegle);
        unikke.push(r);
      }
    });
  
    return unikke.slice(0, 8);
  }
  
  async function soegOpenMeteo(soegning: string): Promise<StedForslag[]> {
    try {
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(soegning)}&count=5&language=da&format=json`;
      const svar = await fetch(url);
      if (!svar.ok) return [];
      const data = await svar.json();
      if (!data.results) return [];
  
      return data.results.map((r: any) => ({
        navn: r.name,
        detalje: [r.admin2, r.admin1, r.country].filter(Boolean).join(', '),
        lat: r.latitude,
        lng: r.longitude
      }));
    } catch (e) {
      console.error('Open-Meteo sted-søgning fejl:', e);
      return [];
    }
  }
  
  async function soegDawa(soegning: string): Promise<StedForslag[]> {
    try {
      const [adresser, stednavne] = await Promise.all([
        hentDawaAdresser(soegning),
        hentDawaStednavne(soegning)
      ]);
      return [...stednavne, ...adresser];
    } catch (e) {
      console.error('DAWA sted-søgning fejl:', e);
      return [];
    }
  }
  
  async function hentDawaAdresser(soegning: string): Promise<StedForslag[]> {
    try {
      const url = `https://api.dataforsyningen.dk/adresser/autocomplete?q=${encodeURIComponent(soegning)}&per_side=5`;
      const svar = await fetch(url);
      if (!svar.ok) return [];
      const data = await svar.json();
      if (!Array.isArray(data)) return [];
  
      return data
        .filter((r: any) => r.adresse?.x && r.adresse?.y)
        .map((r: any) => ({
          navn: r.tekst,
          detalje: '',
          lat: r.adresse.y,
          lng: r.adresse.x
        }));
    } catch {
      return [];
    }
  }
  
  async function hentDawaStednavne(soegning: string): Promise<StedForslag[]> {
    try {
      const url = `https://api.dataforsyningen.dk/stednavne2?q=${encodeURIComponent(soegning)}*&per_side=5`;
      const svar = await fetch(url);
      if (!svar.ok) return [];
      const data = await svar.json();
      if (!Array.isArray(data)) return [];
  
      return data
        .filter((r: any) => r.visueltcenter && Array.isArray(r.visueltcenter) && r.visueltcenter.length === 2)
        .map((r: any) => ({
          navn: r.navn || r.skrivemaade || 'Ukendt sted',
          detalje: r.undertype || r.hovedtype || '',
          lat: r.visueltcenter[1],
          lng: r.visueltcenter[0]
        }));
    } catch {
      return [];
    }
  }