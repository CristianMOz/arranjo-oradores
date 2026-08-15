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

// Espelha private.whatsapp_weekday_index: aceita "Sábado", "Sáb", "sabado".
export function weekdayIndexPt(dia) {
  const chave = String(dia ?? "").trim().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").toLowerCase().slice(0, 3);
  const mapa = { dom:0, seg:1, ter:2, qua:3, qui:4, sex:5, sab:6 };
  return mapa[chave] ?? 6;
}

// Espelha private.whatsapp_target_dates: próxima ocorrência de cada dia de
// reunião, dentro do horizonte, a partir da data de referência.
export function proximasDatasReuniao(referenceIso, dias, horizonte = 7) {
  if (!referenceIso) return [];
  const base = new Date(`${String(referenceIso).slice(0,10)}T12:00:00`);
  if (Number.isNaN(base.getTime())) return [];
  const encontradas = new Set();
  for (const dia of dias || []) {
    const salto = (Number(dia) - base.getDay() + 7) % 7;
    if (salto > Number(horizonte)) continue;
    const alvo = new Date(base.getTime() + salto * 86400000);
    encontradas.add(alvo.toISOString().slice(0, 10));
  }
  return [...encontradas].sort();
}

export function diasDeReuniao(meetingDay, extras = []) {
  return [...new Set([weekdayIndexPt(meetingDay), ...(extras || []).map(Number)])].sort((a,b)=>a-b);
}

export const MENSAGEM_STATUS = {
  rascunho:    { label:"Rascunho",    color:"#64748B", bg:"#F1F5F9" },
  aprovado:    { label:"Aprovado",    color:"#0EA5E9", bg:"#E0F2FE" },
  enviado:     { label:"Enviado",     color:"#14B8A6", bg:"#CCFBF1" },
  falhou:      { label:"Falhou",      color:"#F43F5E", bg:"#FFE4E6" },
  cancelado:   { label:"Cancelado",   color:"#64748B", bg:"#E2E8F0" },
  sem_contato: { label:"Sem número",  color:"#F59E0B", bg:"#FEF3C7" },
};

export const PAPEL = {
  orador:      { label:"Orador",      color:"#8B5CF6", bg:"#EDE9FE" },
  responsavel: { label:"Responsável", color:"#F59E0B", bg:"#FEF3C7" },
};

export const DESTINOS = [
  ["orador",      "Só o orador"],
  ["responsavel", "Só o responsável da outra congregação"],
  ["ambos",       "Ambos (duas mensagens)"],
];

// Campos que o preparo entrega para os modelos. Os apelidos existem para
// compatibilidade com modelos escritos antes.
export const CAMPOS = [
  "nome_orador","primeiro_nome","data","dia_semana","horario",
  "congregacao_origem","congregacao_destino","tipo_discurso",
  "tema","tema_numero","endereco","contato","telefone_contato","responsavel",
];

export const CAMPOS_APELIDOS = ["orador","hora","congregacao","congregacao_visitante"];

export const COMBINACOES = [
  ["saida_orador",           "📤 Saída → orador"],
  ["saida_responsavel",      "📤 Saída → responsável"],
  ["visitante_orador",       "📥 Visitante → orador"],
  ["visitante_responsavel",  "📥 Visitante → responsável"],
];

export const MODELOS_PADRAO = {
  saida_orador: [
    "Olá, {primeiro_nome}! 👋",
    "Lembrete do seu discurso:",
    "",
    "📅 {data} ({dia_semana}) às {horario}",
    "🏠 {congregacao_destino}",
    "📍 {endereco}",
    "📑 Esboço {tema_numero} – {tema}",
    "👤 Contato: {contato}",
    "📞 {telefone_contato}",
    "",
    "Qualquer imprevisto, avise a {congregacao_origem}. Obrigado!",
    "{responsavel}",
  ].join("\n"),
  saida_responsavel: [
    "Olá, {contato}! 👋",
    "Confirmando o orador da {congregacao_origem} aí na {congregacao_destino}:",
    "",
    "🎤 {nome_orador}",
    "📅 {data} ({dia_semana}) às {horario}",
    "📑 Esboço {tema_numero} – {tema}",
    "",
    "Qualquer imprevisto, é só avisar. Obrigado!",
    "{responsavel}",
  ].join("\n"),
  visitante_orador: [
    "Olá, {primeiro_nome}! 👋",
    "Confirmando o seu discurso na {congregacao_destino}:",
    "",
    "📅 {data} ({dia_semana}) às {horario}",
    "📍 {endereco}",
    "📑 Esboço {tema_numero} – {tema}",
    "",
    "Qualquer imprevisto, é só avisar. Obrigado!",
    "{responsavel}",
  ].join("\n"),
  visitante_responsavel: [
    "Olá, {contato}! 👋",
    "Confirmando o discurso do irmão {nome_orador}, da {congregacao_origem}, na {congregacao_destino}:",
    "",
    "📅 {data} ({dia_semana}) às {horario}",
    "📍 {endereco}",
    "📑 Esboço {tema_numero} – {tema}",
    "",
    "Qualquer imprevisto, é só avisar. Obrigado!",
    "{responsavel}",
  ].join("\n"),
};

export const CAMPOS_TEMPLATE = {
  saida_orador: "template_saida_orador",
  saida_responsavel: "template_saida_responsavel",
  visitante_orador: "template_visitante_orador",
  visitante_responsavel: "template_visitante_responsavel",
};

const BASE_EXEMPLO = {
  data: "22/08/2026", dia_semana: "sábado", horario: "19:00", hora: "19:00",
  tema_numero: "24", tema: 'Você encontrou "uma pérola de grande valor"?',
  responsavel: "— Cristiano (Superintendente de Discursos)",
};

export const EXEMPLOS = {
  saida_orador: {
    ...BASE_EXEMPLO, nome_orador: "Saul Gonçalvez", orador: "Saul Gonçalvez", primeiro_nome: "Saul",
    congregacao_origem: "Congregação Alto da Colina", congregacao_destino: "Vila Nova",
    tipo_discurso: "Discurso público — saída", endereco: "Rua das Flores, 100",
    contato: "Irmão Antonio", telefone_contato: "(19) 91111-2222",
  },
  saida_responsavel: {
    ...BASE_EXEMPLO, nome_orador: "Saul Gonçalvez", orador: "Saul Gonçalvez", primeiro_nome: "Saul",
    congregacao_origem: "Congregação Alto da Colina", congregacao_destino: "Vila Nova",
    tipo_discurso: "Discurso público — saída", endereco: "Rua das Flores, 100",
    contato: "Irmão Antonio", telefone_contato: "",
  },
  visitante_orador: {
    ...BASE_EXEMPLO, nome_orador: "João da Silva", orador: "João da Silva", primeiro_nome: "João",
    congregacao_origem: "Centro", congregacao_destino: "Congregação Alto da Colina",
    tipo_discurso: "Discurso público — visitante", endereco: "José do Patrocínio 249, Indaiatuba/SP",
    contato: "Irmão Roberto", telefone_contato: "",
  },
  visitante_responsavel: {
    ...BASE_EXEMPLO, nome_orador: "João da Silva", orador: "João da Silva", primeiro_nome: "João",
    congregacao_origem: "Centro", congregacao_destino: "Congregação Alto da Colina",
    tipo_discurso: "Discurso público — visitante", endereco: "José do Patrocínio 249, Indaiatuba/SP",
    contato: "Irmão Roberto", telefone_contato: "",
  },
};

export function brDate(iso) {
  if (!iso) return "";
  const [a, m, d] = String(iso).slice(0, 10).split("-");
  return d ? `${d}/${m}/${a}` : String(iso);
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
