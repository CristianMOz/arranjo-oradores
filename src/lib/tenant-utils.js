export function tenantSlug(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function normalizeMemberships(rows) {
  return (rows || []).filter((membership) => membership.tenant).map((membership) => ({
    ...membership,
    tenant: {
      ...membership.tenant,
      meeting_time: String(membership.tenant.meeting_time || "19:00").slice(0, 5),
    },
  }));
}

export function selectMembership(memberships, tenantId) {
  return memberships.find((membership) => membership.tenant.id === tenantId) || memberships[0] || null;
}

