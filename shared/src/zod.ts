import { z } from "zod";

// Every shared schema imports `z` from here, so this runs before any of them is used.
// In browsers, skip Zod's JIT: it probes `new Function`, which the storefront's CSP (rightly) blocks;
// the blocked probe is caught but still reported as a CSP violation. Servers keep the JIT.
if ("window" in globalThis) z.config({ jitless: true });

export { z };
