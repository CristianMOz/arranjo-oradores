// Disparador dos avisos já aprovados.
//
// Só toca em congregações com `mode = 'automatico'` e provedor configurado.
// Congregações em modo prévia continuam sendo enviadas manualmente pelo app.
//
// BLOQUEADO PARA PRODUÇÃO (C5). A credencial do provedor ainda é única para
// toda a instalação, então uma congregação poderia disparar usando o número
// de outra. O banco só deixa o administrador da plataforma ligar o modo
// automático, e aqui a Cloud API exige WHATSAPP_META_ENABLED=1 explícito.
// Antes de liberar de verdade: credencial por congregação e validação de que
// o phone_number_id pertence àquela congregação.
//
// Deploy:  supabase functions deploy whatsapp-dispatch
// Segredos: supabase secrets set WHATSAPP_DISPATCH_SECRET=... WHATSAPP_TOKEN=...
//
// Este endpoint nunca é chamado pelo navegador: ele usa a service_role key,
// que só existe no ambiente da função.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const DISPATCH_SECRET = Deno.env.get("WHATSAPP_DISPATCH_SECRET") ?? "";
const META_TOKEN = Deno.env.get("WHATSAPP_TOKEN") ?? "";
const META_ENABLED = Deno.env.get("WHATSAPP_META_ENABLED") === "1";
const META_VERSION = Deno.env.get("WHATSAPP_API_VERSION") ?? "v21.0";
const WEBHOOK_URL = Deno.env.get("WHATSAPP_WEBHOOK_URL") ?? "";
const WEBHOOK_SECRET = Deno.env.get("WHATSAPP_WEBHOOK_SECRET") ?? "";
const MAX_PER_RUN = Number(Deno.env.get("WHATSAPP_MAX_PER_RUN") ?? "50");

type Settings = {
  tenant_id: string;
  provider: "manual" | "meta_cloud" | "webhook";
  provider_phone_id: string;
};

type Message = {
  id: string;
  tenant_id: string;
  recipient_phone: string;
  body: string;
};

const rest = (path: string, init: RequestInit = {}) =>
  fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

async function sendViaMeta(settings: Settings, message: Message) {
  if (!META_ENABLED) {
    throw new Error(
      "Cloud API bloqueada: credenciais ainda não são isoladas por congregação (C5). " +
        "Defina WHATSAPP_META_ENABLED=1 somente em ambiente de teste.",
    );
  }
  if (!META_TOKEN) throw new Error("WHATSAPP_TOKEN não configurado");
  if (!settings.provider_phone_id) throw new Error("Phone Number ID não configurado");

  const response = await fetch(
    `https://graph.facebook.com/${META_VERSION}/${settings.provider_phone_id}/messages`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${META_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: message.recipient_phone,
        type: "text",
        text: { preview_url: false, body: message.body },
      }),
    },
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error?.message ?? `Meta respondeu ${response.status}`);
  }
  return payload?.messages?.[0]?.id ?? "";
}

async function sendViaWebhook(message: Message) {
  if (!WEBHOOK_URL) throw new Error("WHATSAPP_WEBHOOK_URL não configurado");
  const response = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(WEBHOOK_SECRET ? { "X-Webhook-Secret": WEBHOOK_SECRET } : {}),
    },
    body: JSON.stringify({
      tenant_id: message.tenant_id,
      to: message.recipient_phone,
      body: message.body,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error ?? `Webhook respondeu ${response.status}`);
  return payload?.id ?? "";
}

async function markMessage(id: string, patch: Record<string, unknown>) {
  await rest(`whatsapp_messages?id=eq.${id}&status=eq.aprovado`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
  });
}

Deno.serve(async (request) => {
  if (DISPATCH_SECRET && request.headers.get("x-dispatch-secret") !== DISPATCH_SECRET) {
    return new Response(JSON.stringify({ error: "não autorizado" }), { status: 401 });
  }
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return new Response(JSON.stringify({ error: "ambiente incompleto" }), { status: 500 });
  }

  const settingsResponse = await rest(
    "whatsapp_settings?select=tenant_id,provider,provider_phone_id" +
      "&enabled=is.true&mode=eq.automatico&provider=neq.manual",
  );
  const allSettings: Settings[] = await settingsResponse.json();
  if (!Array.isArray(allSettings) || allSettings.length === 0) {
    return Response.json({ tenants: 0, sent: 0, failed: 0 });
  }

  const today = new Date().toISOString().slice(0, 10);
  let sent = 0;
  let failed = 0;

  for (const settings of allSettings) {
    const pendingResponse = await rest(
      "whatsapp_messages?select=id,tenant_id,recipient_phone,body" +
        `&tenant_id=eq.${settings.tenant_id}&status=eq.aprovado` +
        `&recipient_phone=neq.&target_date=gte.${today}` +
        `&order=target_date.asc&limit=${MAX_PER_RUN}`,
    );
    const pending: Message[] = await pendingResponse.json();
    if (!Array.isArray(pending)) continue;

    for (const message of pending) {
      try {
        const providerId = settings.provider === "meta_cloud"
          ? await sendViaMeta(settings, message)
          : await sendViaWebhook(message);
        // O filtro status=eq.aprovado no PATCH garante que uma mensagem
        // marcada como enviada em paralelo não seja sobrescrita.
        await markMessage(message.id, {
          status: "enviado",
          sent_at: new Date().toISOString(),
          provider_message_id: providerId,
          error: "",
        });
        sent += 1;
      } catch (cause) {
        await markMessage(message.id, {
          status: "falhou",
          error: String(cause instanceof Error ? cause.message : cause).slice(0, 400),
        });
        failed += 1;
      }
      await new Promise((resolve) => setTimeout(resolve, 350));
    }
  }

  return Response.json({ tenants: allSettings.length, sent, failed });
});
