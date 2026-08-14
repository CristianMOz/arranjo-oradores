import { createClient } from "@supabase/supabase-js";
import { normalizeMemberships } from "./tenant-utils";

const DEFAULT_SUPABASE_URL = "https://khmjqdxwhxefaacelcoc.supabase.co";
const DEFAULT_SUPABASE_KEY = "sb_publishable_WpxheVx83u-4RjvliUXhpw_m29Sbum3";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

const TABLES = new Set(["esbocos", "oradores", "congregacoes", "visitantes", "saidas"]);

const assertTable = (table) => {
  if (!TABLES.has(table)) throw new Error(`Tabela não permitida: ${table}`);
};

const unwrap = ({ data, error }) => {
  if (error) throw error;
  return data;
};

export const createTenantDb = (tenantId) => {
  if (!tenantId) throw new Error("Congregação não selecionada");

  return {
    async getAll(table, order = "id") {
      assertTable(table);
      return unwrap(await supabase
        .from(table)
        .select("*")
        .eq("tenant_id", tenantId)
        .order(order, { ascending: true }));
    },

    async insert(table, data) {
      assertTable(table);
      return unwrap(await supabase
        .from(table)
        .insert({ ...data, tenant_id: tenantId })
        .select());
    },

    async update(table, id, data) {
      assertTable(table);
      return unwrap(await supabase
        .from(table)
        .update(data)
        .eq("tenant_id", tenantId)
        .eq("id", id)
        .select());
    },

    async delete(table, id) {
      assertTable(table);
      return unwrap(await supabase
        .from(table)
        .delete()
        .eq("tenant_id", tenantId)
        .eq("id", id));
    },
  };
};

export async function loadAccessContext() {
  const claim = await supabase.rpc("claim_my_tenant_invites");
  if (claim.error && claim.error.code !== "PGRST202") throw claim.error;

  const [membershipResult, adminResult] = await Promise.all([
    supabase
      .from("tenant_memberships")
      .select("role, tenant:tenants(id,name,slug,meeting_day,meeting_time,address,timezone)")
      .eq("active", true),
    supabase.from("platform_admins").select("user_id").maybeSingle(),
  ]);
  const rows = unwrap(membershipResult);
  if (adminResult.error) throw adminResult.error;

  const memberships = normalizeMemberships(rows);

  return { memberships, isPlatformAdmin: Boolean(adminResult.data) };
}

export async function cloneTenant({ sourceTenantId, name, slug, ownerEmail, copySpeakers, copyContacts, copyHistory }) {
  return unwrap(await supabase.rpc("admin_clone_tenant", {
    p_source_tenant_id: sourceTenantId,
    p_name: name,
    p_slug: slug,
    p_owner_email: ownerEmail,
    p_copy_speakers: copySpeakers,
    p_copy_contacts: copyContacts,
    p_copy_history: copyHistory,
  }));
}
