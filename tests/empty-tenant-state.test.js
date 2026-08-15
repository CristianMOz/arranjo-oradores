import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appSource = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");

test("production state does not start with another tenant's seed data", () => {
  for (const collection of ["ESBOCOS_INIT", "ORADORES_INIT", "CONGS_INIT", "VISITANTES_INIT", "SAIDAS_INIT"]) {
    assert.match(appSource, new RegExp(`DEMO_MODE \\? ${collection} : \\[\\]`));
  }
});

test("empty database responses clear every tenant collection", () => {
  for (const setter of ["setEsbocos", "setOradores", "setCongregacoes", "setVisitantes", "setSaidas"]) {
    assert.match(appSource, new RegExp(`${setter}\\(\\([a-z]+ \\|\\| \\[\\]\\)\\.map`));
  }

  assert.doesNotMatch(appSource, /if \([^\n]*&& [^\n]*\.length\) set(?:Esbocos|Oradores|Congregacoes|Visitantes|Saidas)/);
});
