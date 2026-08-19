/**
 * Resolve the Chromium executable for Playwright in this environment.
 *
 * The remote container pre-installs Chromium at /opt/pw-browsers/chromium (a
 * plain executable symlink) for whatever Playwright version it shipped with.
 * When the project's pinned Playwright expects a different browser revision,
 * launching with an explicit executablePath avoids re-downloading ~150 MB.
 * Locally, where the default install exists, this returns undefined and
 * Playwright uses its own browser.
 */
import { existsSync } from "node:fs";

export function chromiumExecutablePath() {
  for (const candidate of [
    process.env.PW_CHROMIUM_PATH,
    "/opt/pw-browsers/chromium",
  ]) {
    if (candidate && existsSync(candidate)) return candidate;
  }
  return undefined;
}
