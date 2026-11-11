/**
 * Local email/password sign-in (this app's Better Auth DB — not the broker).
 *
 * Off unless `AUTH_EMAIL_PASSWORD=true`. The static campus build never reads
 * this module. The optional Node game service turns it on for players who
 * choose to sign in; federated Grok sign-in stays available either way.
 *
 * Do NOT edit `server.ts` for this — that file is frozen pre-wired config.
 */
const emailPasswordFlag = process.env.AUTH_EMAIL_PASSWORD?.trim().toLowerCase();
export const emailAndPasswordEnabled = emailPasswordFlag === "true" || emailPasswordFlag === "1";
