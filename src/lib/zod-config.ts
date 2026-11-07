import * as z from 'zod/mini';

// MV3 CSP forbids eval; Zod must never compile validators with new Function. Import this module before any schema module.
z.config({ jitless: true });
