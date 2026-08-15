import test from "node:test";
import assert from "node:assert/strict";
import { normalizeMemberships, selectMembership, tenantSlug } from "../src/lib/tenant-utils.js";

test("tenantSlug cria identificador estável sem acentos", () => {
  assert.equal(tenantSlug("Congregação Jardim América"), "congregacao-jardim-america");
});

test("normalizeMemberships remove relações vazias e normaliza horário", () => {
  const rows = normalizeMemberships([
    { role: "owner", tenant: { id: "a", meeting_time: "19:00:00" } },
    { role: "viewer", tenant: null },
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].tenant.meeting_time, "19:00");
});

test("selectMembership respeita seleção e usa a primeira como fallback", () => {
  const memberships = [
    { tenant: { id: "a" } },
    { tenant: { id: "b" } },
  ];
  assert.equal(selectMembership(memberships, "b").tenant.id, "b");
  assert.equal(selectMembership(memberships, "inexistente").tenant.id, "a");
  assert.equal(selectMembership([], "a"), null);
});

