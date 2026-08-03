import PocketBase from 'pocketbase';

// Overstyres med VITE_PB_URL i .env — fallback er den nuværende Railway-instans,
// så appen virker uden opsætning indtil vi flytter til egen server.
const PB_URL = import.meta.env.VITE_PB_URL ?? 'https://pocketbase-production-6188.up.railway.app';

export const pb = new PocketBase(PB_URL);

pb.autoCancellation(false);

export interface Bruger {
  id: string;
  email: string;
  name?: string;
  created: string;
  updated: string;
}

export function erLoggetInd(): boolean {
  return pb.authStore.isValid;
}

export function nuvaerendeBruger(): Bruger | null {
  const model = pb.authStore.record;
  if (!model) return null;
  return {
    id: model.id,
    email: model.email,
    name: model.name,
    created: model.created,
    updated: model.updated
  };
}

export async function opretKonto(email: string, password: string): Promise<Bruger> {
  const data = {
    email,
    password,
    passwordConfirm: password,
    emailVisibility: false
  };
  await pb.collection('users').create(data);
  await pb.collection('users').authWithPassword(email, password);
  const bruger = nuvaerendeBruger();
  if (!bruger) throw new Error('Kunne ikke logge ind efter oprettelse');
  return bruger;
}

export async function logInd(email: string, password: string): Promise<Bruger> {
  await pb.collection('users').authWithPassword(email, password);
  const bruger = nuvaerendeBruger();
  if (!bruger) throw new Error('Kunne ikke logge ind');
  return bruger;
}

export function logUd(): void {
  pb.authStore.clear();
}
// Navnet man optræder med for de andre på en delt tur. E-mailen er ikke et
// navn — og den skal heller ikke stå på en fælles pakkeliste.
export async function gemNavn(navn: string): Promise<void> {
  const bruger = nuvaerendeBruger();
  if (!bruger) return;
  await pb.collection('users').update(bruger.id, { name: navn.trim() });
}

// Navnet, eller tom hvis man ikke har sat et. Kalderen bestemmer hvad der
// så skal stå — "En deltager" hører til på turen, ikke her.
export function mitNavn(): string {
  return nuvaerendeBruger()?.name?.trim() ?? '';
}
