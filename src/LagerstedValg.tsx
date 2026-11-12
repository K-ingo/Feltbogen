import { Segment } from './ui';
import { LAGERSTED, lagerstedNavn } from './lagersted';
import type { Lagersted } from './lagersted';

// Valget af lagersted: Hjem, Hytte, Bil eller Ikke sat. Det samme valg i
// arket Tilføj grej og inde på grejet, så feltet ser ens ud begge steder.
//
// Stille og kompakt: det er aldrig skærmens primære handling. I arket er
// "Opret grej" den ene fyldte accent, og inde på grejet er det status.
const VALG = [...LAGERSTED, 'ikke_sat'] as const;

export function LagerstedValg({ valgt, vaelg }: {
  valgt: Lagersted | null;
  vaelg: (sted: Lagersted | null) => void;
}) {
  return (
    <Segment
      vaerdier={VALG}
      valgt={valgt ?? 'ikke_sat'}
      vaelg={(v) => vaelg(v === 'ikke_sat' ? null : v)}
      formater={lagerstedNavn}
      kompakt
      stille
    />
  );
}
