// Helpers puros de formatação e modelos, espelhando as funções
// private.whatsapp_* do banco. Sem dependência de rede, para dar teste.

const SAFE_KEY = /^[a-z0-9_]+$/i;

// Só dígitos, com DDI. Devolve "" quando o número não serve para WhatsApp.
export function normalizePhone(raw, ddi = "55") {
  const digits = String(raw ?? "").replace(/\D/g, "").replace(/^0+/, "");
  if (!digits) return "";
  if (digits.length >= 10 && digits.length <= 11) return `${ddi}${digits}`;
  if (digits.length >= 12 && digits.length <= 15) return digits;
  return "";
}

export function formatPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  const local = digits.startsWith("55") ? digits.slice(2) : digits;
  if (local.length === 11) return `+55 (${local.slice(0,2)}) ${local.slice(2,7)}-${local.slice(7)}`;
  if (local.length === 10) return `+55 (${local.slice(0,2)}) ${local.slice(2,6)}-${local.slice(6)}`;
  return digits ? `+${digits}` : "";
}

// Substitui {chave} pelo valor. Campo vazio apaga a linha inteira, para não
// sobrar rótulo solto na mensagem. Mesma regra aplicada no banco.
export function renderTemplate(template, vars) {
  let text = String(template ?? "");
  for (const [key, value] of Object.entries(vars || {})) {
    if (!SAFE_KEY.test(key)) continue;
    const filled = String(value ?? "").trim();
    if (filled) {
      text = text.split(`{${key}}`).join(String(value));
    } else {
      text = text.replace(new RegExp(`(^|\\n)[^\\n]*\\{${key}\\}[^\\n]*`, "g"), "");
    }
  }
  return text.replace(/\n{3,}/g, "\n\n").trim();
}

export function waLink(phone, body) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  return `https://wa.me/${digits}?text=${encodeURIComponent(body || "")}`;
}

export const DIAS_SEMANA = ["Domingo","Segunda-feira","Terça-feira","Quarta-feira","Quinta-feira","Sexta-feira","Sábado"];

export const MENSAGEM_STATUS = {
  rascunho:    { label:"Rascunho",    color:"#64748B", bg:"#F1F5F9" },
  aprovado:    { label:"Aprovado",    color:"#0EA5E9", bg:"#E0F2FE" },
  enviado:     { label:"Enviado",     color:"#14B8A6", bg:"#CCFBF1" },
  falhou:      { label:"Falhou",      color:"#F43F5E", bg:"#FFE4E6" },
  cancelado:   { label:"Cancelado",   color:"#64748B", bg:"#E2E8F0" },
  sem_contato: { label:"Sem número",  color:"#F59E0B", bg:"#FEF3C7" },
};

export const CAMPOS_SAIDA = [
  "orador","primeiro_nome","data","dia_semana","hora","congregacao_destino",
  "endereco","contato","telefone_contato","tema_numero","tema","congregacao","responsavel",
];

export const CAMPOS_VISITANTE = [
  "orador","primeiro_nome","contato","data","dia_semana","hora","congregacao",
  "congregacao_visitante","endereco","tema_numero","tema","responsavel",
];

export const MODELOS_PADRAO = {
  saida: [
    "Olá, {primeiro_nome}! 👋",
    "Lembrete do seu discurso deste fim de semana:",
    "",
    "📅 {data} ({dia_semana}) às {hora}",
    "🏠 {congregacao_destino}",
    "📍 {endereco}",
    "📑 Esboço {tema_numero} – {tema}",
    "👤 Contato: {contato}",
    "📞 {telefone_contato}",
    "",
    "Qualquer imprevisto, avise a {congregacao}. Obrigado!",
    "{responsavel}",
  ].join("\n"),
  visitante: [
    "Olá, {contato}! 👋",
    "Confirmando o discurso do irmão {orador} na {congregacao}:",
    "",
    "📅 {data} ({dia_semana}) às {hora}",
    "📑 Esboço {tema_numero} – {tema}",
    "📍 {endereco}",
    "",
    "Qualquer imprevisto, é só avisar. Obrigado!",
    "{responsavel}",
  ].join("\n"),
};

export const EXEMPLO_SAIDA = {
  orador: "Marcelo Milhan", primeiro_nome: "Marcelo", data: "16/08/2026",
  dia_semana: "sábado", hora: "19:00", congregacao_destino: "Vila Nova",
  endereco: "Rua das Flores, 100", contato: "Irmão Antonio", telefone_contato: "(19) 91111-2222",
  tema_numero: "24", tema: 'Você encontrou "uma pérola de grande valor"?',
  congregacao: "Congregação Alto da Colina", responsavel: "— Cristiano (Superintendente de Discursos)",
};

export const EXEMPLO_VISITANTE = {
  orador: "João da Silva", primeiro_nome: "João", contato: "Irmão Roberto",
  data: "16/08/2026", dia_semana: "sábado", hora: "19:00",
  congregacao: "Congregação Alto da Colina", congregacao_visitante: "Centro",
  endereco: "José do Patrocínio 249, Indaiatuba/SP", tema_numero: "24",
  tema: 'Você encontrou "uma pérola de grande valor"?',
  responsavel: "— Cristiano (Superintendente de Discursos)",
};

// Janela que o preparo vai olhar, a partir de uma data ISO (aaaa-mm-dd).
export function janelaLabel(referenceIso, windowDays) {
  if (!referenceIso) return "";
  const inicio = new Date(`${referenceIso}T12:00:00`);
  if (Number.isNaN(inicio.getTime())) return "";
  const fim = new Date(inicio.getTime() + Number(windowDays || 7) * 86400000);
  const br = (d) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  return `${br(inicio)} a ${br(fim)}`;
}

export function hojeIso(timezone) {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone || "America/Sao_Paulo",
      year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}
