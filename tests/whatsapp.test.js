import test from "node:test";
import assert from "node:assert/strict";
import {
  MODELOS_PADRAO, brDate, diasDeReuniao, formatPhone, normalizePhone,
  proximasDatasReuniao, renderTemplate, waLink, weekdayIndexPt,
} from "../src/lib/whatsapp-format.js";

test("normalizePhone acrescenta o DDI em números locais", () => {
  assert.equal(normalizePhone("(19) 99603-5529"), "5519996035529");
  assert.equal(normalizePhone("1999887766"), "551999887766");
});

test("normalizePhone preserva números que já têm DDI", () => {
  assert.equal(normalizePhone("5519996035529"), "5519996035529");
  assert.equal(normalizePhone("+55 19 99603-5529"), "5519996035529");
});

test("normalizePhone rejeita o que não dá para enviar", () => {
  assert.equal(normalizePhone(""), "");
  assert.equal(normalizePhone("99999"), "");
  assert.equal(normalizePhone("abc"), "");
  assert.equal(normalizePhone("1".repeat(16)), "");
});

test("formatPhone devolve o número legível", () => {
  assert.equal(formatPhone("5519996035529"), "+55 (19) 99603-5529");
  assert.equal(formatPhone(""), "");
});

test("renderTemplate substitui os campos preenchidos", () => {
  const texto = renderTemplate("Olá, {nome}! Dia {data}.", { nome: "João", data: "16/08/2026" });
  assert.equal(texto, "Olá, João! Dia 16/08/2026.");
});

test("renderTemplate remove a linha inteira quando o campo está vazio", () => {
  const modelo = ["📅 {data}", "📍 {endereco}", "📑 {tema}"].join("\n");
  const texto = renderTemplate(modelo, { data: "16/08/2026", endereco: "", tema: "Tema 24" });
  assert.equal(texto, "📅 16/08/2026\n📑 Tema 24");
});

test("renderTemplate colapsa as linhas em branco que sobram", () => {
  const modelo = ["Olá", "", "{a}", "", "{b}", "", "Fim"].join("\n");
  assert.equal(renderTemplate(modelo, { a: "", b: "" }), "Olá\n\nFim");
});

test("renderTemplate ignora chaves fora do formato esperado", () => {
  assert.equal(renderTemplate("valor {a.b} fim", { "a.b": "x" }), "valor {a.b} fim");
});

test("renderTemplate distingue {hora} de {horario}", () => {
  const texto = renderTemplate("{horario} e {hora}", { horario: "19:00", hora: "" });
  assert.equal(texto, "");
  const outro = renderTemplate("às {horario}", { horario: "19:00", hora: "" });
  assert.equal(outro, "às 19:00");
});

test("modelo padrão de saída some com as linhas sem dado", () => {
  const texto = renderTemplate(MODELOS_PADRAO.saida_orador, {
    primeiro_nome: "Marcelo", data: "22/08/2026", dia_semana: "sábado", horario: "19:00",
    congregacao_destino: "Vila Nova", endereco: "", tema_numero: "24", tema: "Tema",
    contato: "", telefone_contato: "", congregacao_origem: "Alto da Colina", responsavel: "",
  });
  assert.ok(!texto.includes("{"), "nenhum campo deve sobrar sem substituir");
  assert.ok(!texto.includes("📍"), "linha de endereço vazio deve sumir");
  assert.ok(!texto.includes("Contato:"), "linha de contato vazio deve sumir");
  assert.ok(texto.includes("🏠 Vila Nova"));
  assert.ok(texto.endsWith("Obrigado!"), "assinatura vazia não deixa linha solta");
});

test("os quatro modelos padrão existem e usam os campos novos", () => {
  for (const chave of ["saida_orador","saida_responsavel","visitante_orador","visitante_responsavel"]) {
    assert.ok(MODELOS_PADRAO[chave], `falta o modelo ${chave}`);
    assert.ok(MODELOS_PADRAO[chave].includes("{horario}"), `${chave} deve usar {horario}`);
  }
  assert.ok(MODELOS_PADRAO.saida_responsavel.includes("{nome_orador}"));
  assert.ok(MODELOS_PADRAO.visitante_responsavel.includes("{congregacao_origem}"));
});

test("waLink monta o link do WhatsApp e recusa número vazio", () => {
  assert.equal(waLink("5519996035529", "oi"), "https://wa.me/5519996035529?text=oi");
  assert.equal(waLink("", "oi"), "");
});

test("weekdayIndexPt entende as formas usadas no cadastro", () => {
  assert.equal(weekdayIndexPt("Domingo"), 0);
  assert.equal(weekdayIndexPt("Sábado"), 6);
  assert.equal(weekdayIndexPt("sabado"), 6);
  assert.equal(weekdayIndexPt("Sáb"), 6);
  assert.equal(weekdayIndexPt("Quarta"), 3);
  assert.equal(weekdayIndexPt("Quarta-feira"), 3);
  assert.equal(weekdayIndexPt(""), 6, "sem dia definido, sábado é a reserva histórica");
});

test("diasDeReuniao junta o dia do cadastro com os extras, sem repetir", () => {
  assert.deepEqual(diasDeReuniao("Sábado", []), [6]);
  assert.deepEqual(diasDeReuniao("Sábado", [0]), [0, 6]);
  assert.deepEqual(diasDeReuniao("Sábado", [6]), [6]);
  assert.deepEqual(diasDeReuniao("Domingo", [6]), [0, 6]);
});

test("proximasDatasReuniao acha o próximo sábado a partir da segunda", () => {
  // 17/08/2026 é segunda-feira.
  assert.deepEqual(proximasDatasReuniao("2026-08-17", [6], 7), ["2026-08-22"]);
  assert.deepEqual(proximasDatasReuniao("2026-08-17", [0], 7), ["2026-08-23"]);
  assert.deepEqual(proximasDatasReuniao("2026-08-17", [0, 6], 7), ["2026-08-22", "2026-08-23"]);
});

test("proximasDatasReuniao nunca devolve dia de meio de semana", () => {
  const datas = proximasDatasReuniao("2026-08-17", [6], 7);
  assert.ok(!datas.includes("2026-08-19"), "quarta-feira não pode entrar");
});

test("proximasDatasReuniao respeita o horizonte", () => {
  assert.deepEqual(proximasDatasReuniao("2026-08-17", [1], 0), ["2026-08-17"]);
  assert.deepEqual(proximasDatasReuniao("2026-08-18", [1], 3), []);
  assert.deepEqual(proximasDatasReuniao("", [6], 7), []);
});

test("brDate converte a data ISO do banco", () => {
  assert.equal(brDate("2026-08-22"), "22/08/2026");
  assert.equal(brDate(""), "");
});
