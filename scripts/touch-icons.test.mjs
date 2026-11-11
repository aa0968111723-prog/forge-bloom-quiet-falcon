import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(new URL("../src/game/rpg/adventure.css", import.meta.url), "utf8");

function block(header) {
  const start = css.indexOf(header);
  assert.ok(start >= 0, header);
  const next = css.indexOf("@media", start + header.length);
  return css.slice(start, next === -1 ? css.length : next);
}

test("narrow and coarse phone icons stay at least 44px", () => {
  const narrow = block("@media (max-width: 700px)");
  assert.match(narrow, /\.ad-icon\s*\{[^}]*width:\s*44px/);
  assert.match(narrow, /\.ad-icon\s*\{[^}]*height:\s*44px/);
  assert.match(narrow, /\.ad-quickbar svg\s*\{[^}]*width:\s*24px/);
  assert.doesNotMatch(narrow, /\.ad-quickbar svg\s*\{[^}]*width:\s*18px/);
  const coarse = block("@media (pointer: coarse) and (max-width: 700px)");
  assert.match(coarse, /\.ad-quickbar button\s*\{[^}]*width:\s*44px/);
  assert.match(coarse, /\.ad-quickbar button\s*\{[^}]*min-width:\s*44px/);
  assert.doesNotMatch(coarse, /width:\s*38px/);
  assert.match(css, /\.ad-interior-bar button\s*\{[^}]*min-width:\s*44px/);
  assert.match(css, /\.ad-interior-bar button\s*\{[^}]*min-height:\s*44px/);
});
