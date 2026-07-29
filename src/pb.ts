import PocketBase from 'pocketbase';

const PB_URL = 'https://pocketbase-production-6188.up.railway.app';

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