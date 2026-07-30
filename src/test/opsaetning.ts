// Giver Dexie et IndexedDB i Node. Skal importeres før db.ts indlæses, og
// derfor ligger den i setupFiles frem for i de enkelte testfiler.
import 'fake-indexeddb/auto';
