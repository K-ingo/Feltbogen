import { useEffect, useRef, useState } from 'react';
import type { Table } from 'dexie';

interface Muligheder<T> {
  // Udfylder felter der mangler på ældre poster, inden de vises.
  normaliser?: (post: T) => T;
  // Kaldes én gang når posten er hentet, til afledt tilstand i skærmen.
  onIndlaest?: (post: T) => void;
}

type Redigerbar = { id?: number; aendret: Date };

// Fælles mønster for de tre detaljeskærme: hent én post fra Dexie, og skriv
// ændringer igennem felt for felt. Visningen opdateres med det samme, så
// felterne ikke halter efter mens sync kører i baggrunden.
export function useRedigerbar<T extends Redigerbar>(
  tabel: Table<T, number>,
  id: number,
  gem: (id: number, aendringer: Partial<T>) => Promise<void>,
  muligheder: Muligheder<T> = {}
) {
  const [post, setPost] = useState<T | null>(null);

  // Callbacks læses gennem en ref, så de ikke behøver være stabile hos
  // kalderen for at holde effekten fra at køre igen ved hver render.
  const callbacks = useRef(muligheder);
  callbacks.current = muligheder;

  useEffect(() => {
    // Skifter man post inden hentningen er færdig, må det gamle svar ikke
    // overskrive det nye.
    let aktiv = true;

    tabel.get(id).then((fundet) => {
      if (!aktiv) return;
      if (!fundet) {
        setPost(null);
        return;
      }
      const klar = callbacks.current.normaliser?.(fundet) ?? fundet;
      setPost(klar);
      callbacks.current.onIndlaest?.(klar);
    });

    return () => {
      aktiv = false;
    };
  }, [tabel, id]);

  const opdater = async (aendringer: Partial<T>) => {
    if (!post || post.id === undefined) return;
    setPost({ ...post, ...aendringer, aendret: new Date() });
    await gem(post.id, aendringer);
  };

  return { post, setPost, opdater };
}
