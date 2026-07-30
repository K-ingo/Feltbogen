import { useState, useEffect } from 'react';
import { pb, nuvaerendeBruger } from './pb';
import type { Bruger } from './pb';

export function useAuth() {
  const [bruger, setBruger] = useState<Bruger | null>(nuvaerendeBruger());

  useEffect(() => {
    // onChange returnerer sin egen afmelder — uden den efterlader hver mount
    // en lytter der skriver til en afmonteret komponent.
    return pb.authStore.onChange(() => setBruger(nuvaerendeBruger()));
  }, []);

  return { bruger, erLoggetInd: bruger !== null };
}
