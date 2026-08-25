// Fejl fra PocketBase, oversat.
//
// Ligger for sig selv og ikke i `pb.ts`, fordi sync-testene erstatter hele
// `./pb` med en attrap. Oversættelsen har ingen server at bruge og skal ikke
// forsvinde sammen med den.

interface PbFejl {
  status?: number;
  url?: string;
  message?: string;
  response?: {
    message?: string;
    data?: Record<string, { code?: string; message?: string }>;
  };
}

// PocketBase-fejl bærer detaljerne i svarets krop: `data` peger på det felt der
// blev afvist, og `message` forklarer de fejl der ikke handler om ét felt.
// Tages kun `data` med, står der `{}` i konsollen når det er den anden slags —
// altså intet at gå efter. Begge dele skal med, sammen med status og URL, så en
// fejl kan diagnosticeres fra en skærmdump af konsollen.
export function fejlDetaljer(e: unknown): unknown {
  if (!e || typeof e !== 'object') return e;

  const fejl = e as PbFejl;
  if (!fejl.response) return e;

  return {
    status: fejl.status,
    url: fejl.url,
    besked: fejl.response.message ?? fejl.message,
    felter: fejl.response.data
  };
}

const FELTNAVNE: Record<string, string> = {
  identity: 'Email',
  email: 'Email',
  password: 'Password',
  passwordConfirm: 'Password'
};

// PocketBase svarer på dansk-fri engelsk og med en feltkode. Koden er det
// stabile — beskederne skifter mellem versioner — så det er den vi oversætter.
function feltBesked(felt: string, kode: string | undefined, engelsk: string | undefined): string {
  const navn = FELTNAVNE[felt] ?? felt;

  switch (kode) {
    case 'validation_required':
      return `Udfyld ${navn.toLowerCase()}`;
    case 'validation_is_email':
    case 'validation_invalid_email':
      return 'Email-adressen ser ikke rigtig ud';
    case 'validation_not_unique':
      return 'Email er allerede registreret';
    case 'validation_length_out_of_range':
      if (felt === 'password' || felt === 'passwordConfirm') {
        return 'Password skal være mindst 8 tegn';
      }
      break;
    case 'validation_values_mismatch':
      return 'De to password er ikke ens';
  }

  // En kode vi ikke har set før. Serverens egen tekst er engelsk, men den siger
  // trods alt hvilket felt der er galt — bedre end "der skete en fejl".
  return engelsk ? `${navn}: ${engelsk}` : `${navn} blev afvist af serveren`;
}

// Oversætter en fejl fra login eller kontooprettelse til noget en bruger kan
// handle på.
//
// Det er værd at skelne skarpt her, fordi PocketBase svarer 400 på tre helt
// forskellige ting: forkerte oplysninger, et felt der ikke validerer, og — via
// klientens indpakning — en server der slet ikke kunne nås. De tre kræver hver
// sin handling af den der står med telefonen, og "Der skete en fejl" fortæller
// ikke hvilken.
export function loginFejlBesked(e: unknown): string {
  const fejl = (e ?? {}) as PbFejl;
  const besked = fejl.response?.message || fejl.message || 'Der skete en fejl';

  // Klienten pakker en fejlet fetch ind som en fejl med status 0. Det er ikke
  // et afvist login — serveren blev aldrig spurgt.
  if (fejl.status === 0) {
    return 'Kunne ikke nå serveren. Tjek din forbindelse og prøv igen.';
  }
  if (fejl.status && fejl.status >= 500) {
    return 'Serveren har problemer lige nu. Prøv igen om lidt.';
  }

  const felter = Object.entries(fejl.response?.data ?? {});
  if (felter.length > 0) {
    const [felt, detalje] = felter[0];
    return feltBesked(felt, detalje?.code, detalje?.message);
  }

  const lav = besked.toLowerCase();

  // Samme svar uanset om kontoen ikke findes, kodeordet er forkert, eller
  // samlingens authRule afviser kontoen (fx `verified = true`). PocketBase
  // skelner med vilje ikke — ellers kunne man afprøve sig frem til hvilke
  // e-mails der er oprettet.
  if (lav.includes('failed to authenticate')) return 'Forkert email eller password';
  if (lav.includes('already in use') || lav.includes('already exists')) {
    return 'Email er allerede registreret';
  }

  return besked;
}
