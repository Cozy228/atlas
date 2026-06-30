// Types for pw-env.mjs (shared run env). The impl is a .mjs so the plain-node
// doctor can import it; the .ts configs + global-setup type it from here.
export const channel: string;
export const baseURL: string;
export const WARMUP_ROUTES: readonly string[];
