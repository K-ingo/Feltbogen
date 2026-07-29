import { useState, useEffect } from 'react';
import { pb, nuvaerendeBruger } from './pb';
import type { Bruger } from './pb';

export function useAuth() {
  const [bruger, setBruger] = useState<Bruger | null>(nuvaerendeBruger());
  const [indlaeser, setIndlaeser] = useState(false);

  useEffect(() => {
    const opdater = () => {
      setBruger(nuvaerendeBruger());
    };

    pb.authStore.onChange(() => {
      opdater();
    });

    opdater();
  }, []);

  return {
    bruger,
    erLoggetInd: bruger !== null,
    indlaeser,
    setIndlaeser
  };
}