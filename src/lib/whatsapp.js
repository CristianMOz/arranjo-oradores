import { supabase } from "./supabase";

export * from "./whatsapp-format";

// ── Acesso ao Supabase (sempre filtrado pelo tenant selecionado) ─────────

const unwrap = ({ data, error }) => {
  if (error) throw error;
  return data;
};

export async function carregarConfigWhatsapp(tenantId) {
  if (!tenantId) throw new Error("Congregação não selecionada");
  const [settings, senders] = await Promise.all([
    supabase.from("whatsapp_settings").select("*").eq("tenant_id", tenantId).maybeSingle(),
    supabase.from("whatsapp_senders").select("user_id").eq("tenant_id", tenantId),
  ]);
  return { settings: unwrap(settings), senders: unwrap(senders) || [] };
}

// Só o responsável enxerga a lista; para os demais devolvemos vazio.
export async function carregarMembros(tenantId) {
  const { data, error } = await supabase.rpc("whatsapp_membros", { p_tenant_id: tenantId });
  if (error) return [];
  return data || [];
}

export async function salvarConfigWhatsapp(tenantId, values) {
  return unwrap(await supabase.rpc("whatsapp_salvar_config", {
    p_tenant_id: tenantId,
    p_enabled: values.enabled,
    p_mode: values.mode,
    p_provider: values.provider,
    p_sender_label: values.sender_label,
    p_sender_phone: values.sender_phone,
    p_provider_phone_id: values.provider_phone_id,
    p_run_weekday: values.run_weekday,
    p_run_time: values.run_time,
    p_window_days: values.window_days,
    p_extra_meeting_days: values.extra_meeting_days,
    p_notify_saidas: values.notify_saidas,
    p_notify_visitantes: values.notify_visitantes,
    p_destino_saida: values.destino_saida,
    p_destino_visitante: values.destino_visitante,
    p_template_saida_orador: values.template_saida_orador,
    p_template_saida_responsavel: values.template_saida_responsavel,
    p_template_visitante_orador: values.template_visitante_orador,
    p_template_visitante_responsavel: values.template_visitante_responsavel,
  }));
}

export async function definirRemetente(tenantId, userId, allowed) {
  return unwrap(await supabase.rpc("whatsapp_definir_remetente", {
    p_tenant_id: tenantId, p_user_id: userId, p_allowed: allowed,
  }));
}

export async function prepararFila(tenantId, referenceIso = null) {
  return unwrap(await supabase.rpc("whatsapp_preparar", {
    p_tenant_id: tenantId, p_reference: referenceIso,
  }));
}

export async function carregarMensagens(tenantId, limit = 200) {
  return unwrap(await supabase
    .from("whatsapp_messages")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("target_date", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(limit)) || [];
}

export async function carregarExecucoes(tenantId, limit = 10) {
  return unwrap(await supabase
    .from("whatsapp_runs")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("started_at", { ascending: false })
    .limit(limit)) || [];
}

export async function atualizarMensagem(messageId, { body = null, phone = null } = {}) {
  return unwrap(await supabase.rpc("whatsapp_atualizar_mensagem", {
    p_message_id: messageId, p_body: body, p_phone: phone,
  }));
}

export async function definirStatusMensagens(ids, status, { providerMessageId = "", error = "" } = {}) {
  return unwrap(await supabase.rpc("whatsapp_definir_status", {
    p_message_ids: ids, p_status: status,
    p_provider_message_id: providerMessageId, p_error: error,
  }));
}
