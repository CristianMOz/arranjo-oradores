import test from "node:test";
import assert from "node:assert/strict";
import {
  MODELOS_PADRAO, formatPhone, janelaLabel, normalizePhone, renderTemplate, waLink,
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
  const texto = renderTemplate("valor {a.b} fim", { "a.b": "x" });
  assert.equal(texto, "valor {a.b} fim");
});

test("modelo padrão de saída some com as linhas sem dado", () => {
  const texto = renderTemplate(MODELOS_PADRAO.saida, {
    primeiro_nome: "Marcelo", data: "16/08/2026", dia_semana: "sábado", hora: "19:00",
    congregacao_destino: "Vila Nova", endereco: "", tema_numero: "24", tema: "Tema",
    contato: "", telefone_contato: "", congregacao: "Alto da Colina", responsavel: "",
  });
  assert.ok(!texto.includes("{"), "nenhum campo deve sobrar sem substituir");
  assert.ok(!texto.includes("📍"), "linha de endereço vazio deve sumir");
  assert.ok(!texto.includes("Contato:"), "linha de contato vazio deve sumir");
  assert.ok(texto.includes("🏠 Vila Nova"));
  assert.ok(texto.endsWith("Obrigado!"), "assinatura vazia não deixa linha solta");
});

test("waLink monta o link do WhatsApp e recusa número vazio", () => {
  assert.equal(waLink("5519996035529", "oi"), "https://wa.me/5519996035529?text=oi");
  assert.equal(waLink("", "oi"), "");
});

test("janelaLabel descreve o intervalo do preparo", () => {
  assert.equal(janelaLabel("2026-08-10", 7), "10/08 a 17/08");
  assert.equal(janelaLabel("", 7), "");
});
