import { useState, useEffect, useCallback } from "react";

// ── PALETTE ──────────────────────────────────────────────
const P = {
  sky:"#0EA5E9",skyL:"#E0F2FE",teal:"#14B8A6",tealL:"#CCFBF1",
  violet:"#8B5CF6",violetL:"#EDE9FE",rose:"#F43F5E",roseL:"#FFE4E6",
  amber:"#F59E0B",amberL:"#FEF3C7",lime:"#84CC16",limeL:"#ECFCCB",
  slate:"#64748B",slateL:"#F1F5F9",bg:"#F8FAFC",white:"#FFFFFF",
  text:"#0F172A",sub:"#64748B",border:"#E2E8F0",
};

const STATUS = {
  confirmado:{label:"Confirmado",color:P.lime,bg:P.limeL},
  pendente:{label:"Pendente",color:P.amber,bg:P.amberL},
  cancelado:{label:"Cancelado",color:P.rose,bg:P.roseL},
  realizado:{label:"Realizado",color:P.teal,bg:P.tealL},
};

const MESES=["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const DIAS=["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

// ── DATA ─────────────────────────────────────────────────
const ESBOCOS_INIT = [
  {id:1,n:1,tema:"Você conhece bem a Deus?",ultimo:""},
  {id:2,n:2,tema:"Você vai sobreviver aos últimos dias?",ultimo:""},
  {id:3,n:3,tema:"Você está avançando com a organização unida de Jeová?",ultimo:""},
  {id:4,n:4,tema:"Que provas temos de que Deus existe?",ultimo:""},
  {id:5,n:5,tema:"Você pode ter uma família feliz!",ultimo:""},
  {id:6,n:6,tema:"O dilúvio dos dias de Noé e você",ultimo:""},
  {id:7,n:7,tema:"Imite a misericórdia de Jeová",ultimo:""},
  {id:8,n:8,tema:"Viva para fazer a vontade de Deus",ultimo:""},
  {id:9,n:9,tema:"Escute e faça o que a Bíblia diz",ultimo:""},
  {id:10,n:10,tema:"Seja honesto em tudo",ultimo:""},
  {id:11,n:11,tema:"Imite a Jesus e não faça parte do mundo",ultimo:""},
  {id:12,n:12,tema:"Deus quer que você respeite quem tem autoridade",ultimo:""},
  {id:13,n:13,tema:"Qual o ponto de vista de Deus sobre o sexo e o casamento?",ultimo:""},
  {id:14,n:14,tema:"Um povo puro e limpo honra a Jeová",ultimo:""},
  {id:15,n:15,tema:"'Faça o bem a todos'",ultimo:""},
  {id:16,n:16,tema:"Seja cada vez mais amigo de Jeová",ultimo:""},
  {id:17,n:17,tema:"Glorifique a Deus com tudo o que você tem",ultimo:""},
  {id:18,n:18,tema:"Faça de Jeová a sua fortaleza",ultimo:""},
  {id:19,n:19,tema:"Como você pode saber seu futuro?",ultimo:""},
  {id:20,n:20,tema:"Chegou o tempo de Deus governar o mundo?",ultimo:""},
  {id:21,n:21,tema:"Dê valor ao seu lugar no Reino de Deus",ultimo:""},
  {id:22,n:22,tema:"Você está usando bem o que Jeová lhe dá?",ultimo:""},
  {id:23,n:23,tema:"A vida tem objetivo",ultimo:""},
  {id:24,n:24,tema:'Você encontrou "uma pérola de grande valor"?',ultimo:""},
  {id:25,n:25,tema:"Lute contra o espírito do mundo",ultimo:""},
  {id:26,n:26,tema:"Você é importante para Deus?",ultimo:""},
  {id:27,n:27,tema:"Como construir um casamento feliz",ultimo:""},
  {id:28,n:28,tema:"Mostre respeito e amor no seu casamento",ultimo:""},
  {id:29,n:29,tema:"As responsabilidades e recompensas de ter filhos",ultimo:""},
  {id:30,n:30,tema:"Como melhorar a comunicação na família",ultimo:""},
  {id:31,n:31,tema:"Você tem consciência da sua necessidade espiritual?",ultimo:""},
  {id:32,n:32,tema:"Como lidar com as ansiedades da vida",ultimo:""},
  {id:33,n:33,tema:"Quando vai existir verdadeira justiça?",ultimo:""},
  {id:34,n:34,tema:"Você vai ser marcado para sobreviver?",ultimo:""},
  {id:35,n:35,tema:"É possível viver para sempre? O que você precisa fazer?",ultimo:""},
  {id:36,n:36,tema:"Será que a vida é só isso?",ultimo:""},
  {id:37,n:37,tema:"Obedecer a Deus é mesmo a melhor coisa a fazer?",ultimo:""},
  {id:38,n:38,tema:"Como você pode sobreviver ao fim do mundo?",ultimo:""},
  {id:39,n:39,tema:"Jesus Cristo vence o mundo — Como e quando?",ultimo:""},
  {id:40,n:40,tema:"O que vai acontecer em breve?",ultimo:""},
  {id:41,n:41,tema:"Fiquem parados e vejam como Jeová os salvará",ultimo:""},
  {id:42,n:42,tema:"O amor pode vencer o ódio?",ultimo:""},
  {id:43,n:43,tema:"Tudo o que Deus nos pede é para o nosso bem",ultimo:""},
  {id:44,n:44,tema:"Como os ensinos de Jesus podem ajudar você?",ultimo:""},
  {id:45,n:45,tema:"Siga o caminho da vida",ultimo:""},
  {id:46,n:46,tema:"Fortaleça sua confiança em Jeová",ultimo:""},
  {id:47,n:48,tema:"Seja leal a Deus mesmo quando for testado",ultimo:""},
  {id:48,n:49,tema:"Será que um dia a Terra vai ser limpa?",ultimo:""},
  {id:49,n:50,tema:"Como sempre tomar as melhores decisões",ultimo:""},
  {id:50,n:51,tema:"Será que a verdade da Bíblia está mudando a sua vida?",ultimo:""},
  {id:51,n:52,tema:"Quem é o seu Deus?",ultimo:""},
  {id:52,n:53,tema:"Você pensa como Deus?",ultimo:""},
  {id:53,n:54,tema:"Fortaleça sua fé em Deus e em suas promessas",ultimo:""},
  {id:54,n:55,tema:"Você está fazendo um bom nome perante Deus?",ultimo:""},
  {id:55,n:56,tema:"Existe um líder em quem você pode confiar?",ultimo:""},
  {id:56,n:57,tema:"Como suportar perseguição",ultimo:""},
  {id:57,n:58,tema:"Quem são os verdadeiros seguidores de Cristo?",ultimo:""},
  {id:58,n:59,tema:"Ceifará o que semear",ultimo:""},
  {id:59,n:60,tema:"Você tem um objetivo na vida?",ultimo:""},
  {id:60,n:61,tema:"Nas promessas de quem você confia?",ultimo:""},
  {id:61,n:62,tema:"Onde encontrar uma esperança real para o futuro?",ultimo:""},
  {id:62,n:63,tema:"Tem você espírito evangelizador?",ultimo:""},
  {id:63,n:64,tema:"Você ama os prazeres ou a Deus?",ultimo:""},
  {id:64,n:65,tema:"Como podemos ser pacíficos num mundo cheio de ódio",ultimo:""},
  {id:65,n:66,tema:"Você também vai participar na colheita?",ultimo:""},
  {id:66,n:67,tema:"Medite na Bíblia e nas criações de Jeová",ultimo:""},
  {id:67,n:68,tema:"'Continue a perdoar uns aos outros liberalmente'",ultimo:""},
  {id:68,n:69,tema:"Por que mostrar amor abnegado?",ultimo:""},
  {id:69,n:70,tema:"Por que Deus merece sua confiança?",ultimo:""},
  {id:70,n:71,tema:"'Mantenha-se desperto' — Por que e como?",ultimo:""},
  {id:71,n:72,tema:"O amor identifica os cristãos verdadeiros",ultimo:""},
  {id:72,n:73,tema:'Você tem "um coração sábio"?',ultimo:""},
  {id:73,n:74,tema:"Os olhos de Jeová estão em todo lugar",ultimo:""},
  {id:74,n:75,tema:"Mostre que você apoia o direito de Jeová governar",ultimo:""},
  {id:75,n:76,tema:"Princípios bíblicos — Podem nos ajudar a lidar com os problemas atuais?",ultimo:""},
  {id:76,n:77,tema:'"Sempre mostrem hospitalidade"',ultimo:""},
  {id:77,n:78,tema:"Sirva a Jeová com um coração alegre",ultimo:""},
  {id:78,n:79,tema:"Você vai escolher ser amigo de Deus?",ultimo:""},
  {id:79,n:80,tema:"Você baseia sua esperança na ciência ou na Bíblia?",ultimo:""},
  {id:80,n:81,tema:"Quem está qualificado para fazer discípulos?",ultimo:""},
  {id:81,n:83,tema:"Tempo de julgamento da religião",ultimo:""},
  {id:82,n:84,tema:"Escapará do destino deste mundo?",ultimo:""},
  {id:83,n:85,tema:"Boas notícias num mundo violento",ultimo:""},
  {id:84,n:86,tema:"Como orar a Deus e ser ouvido por ele?",ultimo:""},
  {id:85,n:87,tema:"Qual é a sua relação com Deus?",ultimo:""},
  {id:86,n:88,tema:"Por que viver de acordo com os padrões da Bíblia?",ultimo:""},
  {id:87,n:89,tema:"Quem tem sede da verdade, venha!",ultimo:""},
  {id:88,n:90,tema:"Faça o máximo para alcançar a verdadeira vida!",ultimo:""},
  {id:89,n:91,tema:"A presença do Messias e seu domínio",ultimo:""},
  {id:90,n:92,tema:"O papel da religião nos assuntos do mundo",ultimo:""},
  {id:91,n:93,tema:"Desastres naturais — Quando vão acabar?",ultimo:""},
  {id:92,n:94,tema:"A religião verdadeira atende às necessidades da sociedade humana",ultimo:""},
  {id:93,n:95,tema:"Não seja enganado pelo ocultismo",ultimo:""},
  {id:94,n:96,tema:"O que vai acontecer com as religiões?",ultimo:""},
  {id:95,n:97,tema:"Permaneçamos inculpes em meio a uma geração pervertida",ultimo:""},
  {id:96,n:98,tema:'"A cena deste mundo está mudando"',ultimo:""},
  {id:97,n:99,tema:"Por que você pode confiar na Bíblia",ultimo:""},
  {id:98,n:100,tema:"Como fazer amizades fortes e verdadeiras",ultimo:""},
  {id:99,n:101,tema:'Jeová é o "Grandioso Criador"',ultimo:""},
  {id:100,n:102,tema:'Preste atenção à "palavra profética"',ultimo:""},
  {id:101,n:103,tema:"Pode-se encontrar alegria em servir a Deus",ultimo:""},
  {id:102,n:104,tema:"Pais, vocês estão construindo com materiais à prova de fogo?",ultimo:""},
  {id:103,n:105,tema:"Somos consolados em todas as nossas tribulações",ultimo:""},
  {id:104,n:106,tema:"Arruinar a Terra provocará retribuição divina",ultimo:""},
  {id:105,n:107,tema:"Você está treinando bem a sua consciência?",ultimo:""},
  {id:106,n:108,tema:"Você pode encarar o futuro com confiança!",ultimo:""},
  {id:107,n:109,tema:"O Reino de Deus está próximo",ultimo:""},
  {id:108,n:110,tema:"Deus vem primeiro na vida familiar bem-sucedida",ultimo:""},
  {id:109,n:111,tema:"É possível que a humanidade seja completamente curada?",ultimo:""},
  {id:110,n:113,tema:"Jovens — Como vocês podem ter uma vida feliz?",ultimo:""},
  {id:111,n:114,tema:"Apreço pelas maravilhas da criação de Deus",ultimo:""},
  {id:112,n:115,tema:"Como proteger-nos contra os laços de Satanás",ultimo:""},
  {id:113,n:116,tema:"Escolha sabiamente com quem irá associar-se!",ultimo:""},
  {id:114,n:117,tema:"Como vencer o mal com o bem",ultimo:""},
  {id:115,n:118,tema:"Olhemos os jovens do ponto de vista de Jeová",ultimo:""},
  {id:116,n:119,tema:"Por que é benéfico que os cristãos vivam separados do mundo",ultimo:""},
  {id:117,n:120,tema:"Por que se submeter à regência de Deus agora",ultimo:""},
  {id:118,n:121,tema:"Uma família mundial que será salva da destruição",ultimo:""},
  {id:119,n:122,tema:"Paz global — De onde virá?",ultimo:""},
  {id:120,n:123,tema:"Por que os cristãos têm de ser diferentes",ultimo:""},
  {id:121,n:124,tema:"Razões para crer que a Bíblia é de autoria divina",ultimo:""},
  {id:122,n:125,tema:"Por que a humanidade precisa de resgate",ultimo:""},
  {id:123,n:126,tema:"Quem se salvará?",ultimo:""},
  {id:124,n:127,tema:"O que acontece quando morremos?",ultimo:""},
  {id:125,n:128,tema:"É o inferno um lugar de tormento ardente?",ultimo:""},
  {id:126,n:129,tema:"O que a Bíblia diz sobre a Trindade?",ultimo:""},
  {id:127,n:130,tema:"A Terra permanecerá para sempre",ultimo:""},
  {id:128,n:133,tema:"Tem importância o que cremos sobre a nossa origem?",ultimo:""},
  {id:129,n:134,tema:"Devem os cristãos guardar o sábado?",ultimo:""},
  {id:130,n:135,tema:"A santidade da vida e do sangue",ultimo:""},
  {id:131,n:136,tema:"Será que Deus aprova o uso de imagens na adoração?",ultimo:""},
  {id:132,n:137,tema:"Ocorreram realmente os milagres da Bíblia?",ultimo:""},
  {id:133,n:138,tema:"Viva com bom juízo num mundo depravado",ultimo:""},
  {id:134,n:139,tema:"Sabedoria divina num mundo científico",ultimo:""},
  {id:135,n:140,tema:"Quem é realmente Jesus Cristo?",ultimo:""},
  {id:136,n:141,tema:"Quando terão fim os gemidos da criação humana?",ultimo:""},
  {id:137,n:142,tema:"Por que refugiar-se em Jeová",ultimo:""},
  {id:138,n:143,tema:"Confie no Deus de todo consolo",ultimo:""},
  {id:139,n:144,tema:"Uma congregação leal sob a liderança de Cristo",ultimo:""},
  {id:140,n:145,tema:"Quem é semelhante a Jeová, nosso Deus?",ultimo:""},
  {id:141,n:146,tema:"Use a educação para louvar a Jeová",ultimo:""},
  {id:142,n:147,tema:"Confie no poder salvador de Jeová",ultimo:""},
  {id:143,n:148,tema:"Você tem o mesmo conceito de Deus sobre a vida?",ultimo:""},
  {id:144,n:149,tema:'O que significa "andar com Deus"?',ultimo:""},
  {id:145,n:150,tema:"Este mundo está condenado à destruição?",ultimo:""},
  {id:146,n:151,tema:'Jeová é "uma altura protetora" para seu povo',ultimo:""},
  {id:147,n:152,tema:"Armagedom — Por que e quando?",ultimo:""},
  {id:148,n:153,tema:'Tenha bem em mente o "atemorizante dia"!',ultimo:""},
  {id:149,n:154,tema:"O governo humano é pesado na balança",ultimo:""},
  {id:150,n:155,tema:"Chegou a hora do julgamento de Babilônia?",ultimo:""},
  {id:151,n:156,tema:"O Dia do Juízo — Tempo de temor ou de esperança?",ultimo:""},
  {id:152,n:157,tema:"Como os verdadeiros cristãos adornam o ensino divino",ultimo:""},
  {id:153,n:158,tema:"Seja corajoso e confie em Jeová",ultimo:""},
  {id:154,n:159,tema:"Como encontrar segurança num mundo perigoso",ultimo:""},
  {id:155,n:160,tema:"Mantenha a identidade cristã!",ultimo:""},
  {id:156,n:161,tema:"Por que Jesus sofreu e morreu?",ultimo:""},
  {id:157,n:162,tema:"Seja liberto deste mundo em escuridão",ultimo:""},
  {id:158,n:163,tema:"Por que temer o Deus verdadeiro?",ultimo:""},
  {id:159,n:164,tema:"Será que Deus ainda está no controle?",ultimo:""},
  {id:160,n:165,tema:"Os valores de quem você preza?",ultimo:""},
  {id:161,n:166,tema:"Como enfrentar o futuro com fé e coragem",ultimo:""},
  {id:162,n:167,tema:"Ajamos sabiamente num mundo insensato",ultimo:""},
  {id:163,n:168,tema:"Você pode sentir-se seguro neste mundo atribulado!",ultimo:""},
  {id:164,n:169,tema:"Por que ser orientado pela Bíblia?",ultimo:""},
  {id:165,n:170,tema:"Quem está qualificado para governar a humanidade?",ultimo:""},
  {id:166,n:171,tema:"Poderá viver em paz agora — E para sempre!",ultimo:""},
  {id:167,n:172,tema:"Que reputação você tem perante Deus?",ultimo:""},
  {id:168,n:173,tema:"Existe uma religião verdadeira do ponto de vista de Deus?",ultimo:""},
  {id:169,n:174,tema:"Quem se qualificará para entrar no novo mundo de Deus?",ultimo:""},
  {id:170,n:175,tema:"O que prova que a Bíblia é autêntica?",ultimo:""},
  {id:171,n:176,tema:"Quando haverá verdadeira paz e segurança?",ultimo:""},
  {id:172,n:177,tema:"Onde encontrar ajuda em tempos de aflição?",ultimo:""},
  {id:173,n:178,tema:"Ande no caminho da integridade",ultimo:""},
  {id:174,n:179,tema:"Rejeite as fantasias do mundo, empenhe-se pelas realidades do Reino",ultimo:""},
  {id:175,n:180,tema:"A ressurreição — Por que essa esperança deve ser real para você",ultimo:""},
  {id:176,n:181,tema:"Já é mais tarde do que você imagina?",ultimo:""},
  {id:177,n:182,tema:"O que o Reino de Deus está fazendo por nós agora?",ultimo:""},
  {id:178,n:183,tema:"Desvie seus olhos do que é fútil",ultimo:""},
  {id:179,n:184,tema:"A morte é o fim de tudo?",ultimo:""},
  {id:180,n:185,tema:"Será que a verdade influencia sua vida?",ultimo:""},
  {id:181,n:186,tema:"Sirva em união com o povo feliz de Deus",ultimo:""},
  {id:182,n:187,tema:"Por que um Deus amoroso permite a maldade?",ultimo:""},
  {id:183,n:188,tema:"Você confia em Jeová?",ultimo:""},
  {id:184,n:189,tema:"Ande com Deus e receba bênçãos para sempre",ultimo:""},
  {id:185,n:190,tema:"Como se cumprirá a promessa de perfeita felicidade familiar",ultimo:""},
  {id:186,n:191,tema:"Como o amor e a fé vencem o mundo",ultimo:""},
  {id:187,n:192,tema:"Você está no caminho para a vida eterna?",ultimo:""},
  {id:188,n:193,tema:"Os problemas de hoje logo serão coisa do passado",ultimo:""},
  {id:189,n:194,tema:"Como a sabedoria de Deus nos ajuda",ultimo:""},
];

const ORADORES_INIT = [
  {id:1,nome:"Aurimar Erasmo de Oliveira",cel:"1999887766",esbocoIds:[10,64],status:"confirmado"},
  {id:2,nome:"Alison Oliveira",cel:"19993553927",esbocoIds:[66,132],status:"confirmado"},
  {id:4,nome:"Crystyano Santos",cel:"19996035529",esbocoIds:[29,167,180],status:"confirmado"},
  {id:5,nome:"Darcy Sousa",cel:"19997980122",esbocoIds:[4,7,35,86],status:"confirmado"},
  {id:6,nome:"Diógenes Lima",cel:"11979562733",esbocoIds:[88,149,155,159,187,188,189],status:"confirmado"},
  {id:7,nome:"Helio Oliveira",cel:"",esbocoIds:[15,155],status:"confirmado"},
  {id:8,nome:"José Rogério",cel:"19988107486",esbocoIds:[14,37,56,81,86,93,97,114,116],status:"confirmado"},
  {id:9,nome:"Marco Munhoz Jr",cel:"",esbocoIds:[20,56,57,119,122,132,187],status:"confirmado"},
  {id:10,nome:"Marcelo Carneiro Munhoz",cel:"19996110071",esbocoIds:[26,84],status:"confirmado"},
  {id:11,nome:"Saul Gonçalvez",cel:"19992147638",esbocoIds:[1,10,18,24,49,52,153,178],status:"confirmado"},
  {id:14,nome:"João Vitor Zacarias dos Santos",cel:"11914780604",esbocoIds:[72,101,106,176],status:"confirmado"},
  {id:15,nome:"Marcelo Milhan",cel:"19998501724",esbocoIds:[2,3,7,10,15,16,17,24,29,51,72,73,102,107,113,116,118,137,145,160,163,164,168,171,187,188],status:"confirmado"},
  {id:16,nome:"Vinicius Urbano",cel:"19992083150",esbocoIds:[32],status:"confirmado"},
  {id:17,nome:"Leonardo Molina",cel:"11984981365",esbocoIds:[9,11,43,78,90,92,106,119,136,153,155,161,164],status:"confirmado"},
];

const CONGS_INIT = [];
const VISITANTES_INIT = [];
const SAIDAS_INIT = [];

// ── SUPABASE CONFIG ───────────────────────────────────────
const SUPA_URL = import.meta.env.VITE_SUPABASE_URL || "https://khmjqdxwhxefaacelcoc.supabase.co";
const SUPA_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_WpxheVx83u-4RjvliUXhpw_m29Sbum3";

const supa = async (method, table, body = null, query = "") => {
  const sess = (typeof auth !== 'undefined') ? auth.getSession() : null;
  const token = (sess && sess.access_token) ? sess.access_token : SUPA_KEY;
  const res = await fetch(`${SUPA_URL}/rest/v1/${table}${query}`, {
    method,
    headers: {
      "apikey": SUPA_KEY,
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "Prefer": method === "POST" ? "return=representation" : "return=minimal",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase ${method} ${table}: ${err}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
};

const dbReal = {
  getAll: (table, order="id") => supa("GET", table, null, `?order=${order}`),
  insert: (table, data) => supa("POST", table, data),
  update: (table, id, data) => supa("PATCH", table, data, `?id=eq.${id}`),
  delete: (table, id) => supa("DELETE", table, null, `?id=eq.${id}`),
};

// ── DEMO MODE ─────────────────────────────────────────────
const DEMO_MODE = typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("demo") === "1";

const DEMO_SEED_ORADORES = [
  {id:1,nome:"João da Silva",cel:"11987654321",esboco_ids:[1,5,8,12],status:"confirmado"},
  {id:2,nome:"Pedro Henrique",cel:"11912345678",esboco_ids:[2,7,15],status:"confirmado"},
  {id:3,nome:"Carlos Eduardo",cel:"11955554444",esboco_ids:[3,10,20],status:"confirmado"},
  {id:4,nome:"Marcos Antonio",cel:"11933332222",esboco_ids:[4,9],status:"confirmado"},
  {id:5,nome:"Lucas Fernando",cel:"11977778888",esboco_ids:[6,11,18],status:"pendente"},
];
const DEMO_SEED_CONGS = [
  {id:1,nome:"Vila Nova",dia:"Sábado",hora:"19:00",contato:"Irmão Antonio",tel:"11911112222",end:"Rua das Flores, 100"},
  {id:2,nome:"Centro",dia:"Domingo",hora:"10:00",contato:"Irmão Roberto",tel:"11933334444",end:"Av. Principal, 500"},
];
const demoSeedFor = (table) => {
  if (table === "esbocos") return ESBOCOS_INIT.map(e => ({id:e.id,n:e.n,tema:e.tema,ultimo:e.ultimo||""}));
  if (table === "oradores") return DEMO_SEED_ORADORES;
  if (table === "congregacoes") return DEMO_SEED_CONGS;
  return [];
};
const demoKey = (t) => `demo_${t}`;
const demoLoad = (table) => {
  try {
    const raw = localStorage.getItem(demoKey(table));
    if (raw === null) {
      const seed = demoSeedFor(table);
      localStorage.setItem(demoKey(table), JSON.stringify(seed));
      return JSON.parse(JSON.stringify(seed));
    }
    return JSON.parse(raw);
  } catch { return []; }
};
const demoSave = (table, data) => {
  try { localStorage.setItem(demoKey(table), JSON.stringify(data)); } catch {}
};
let _demoNextId = 100000;
const demoNewId = () => ++_demoNextId;
const demoResetAll = () => {
  ["esbocos","oradores","congregacoes","visitantes","saidas"].forEach(t => localStorage.removeItem(demoKey(t)));
};
const dbDemo = {
  getAll: async (table) => demoLoad(table),
  insert: async (table, data) => {
    const arr = demoLoad(table);
    const row = { id: demoNewId(), ...data };
    arr.push(row);
    demoSave(table, arr);
    return [row];
  },
  update: async (table, id, data) => {
    const arr = demoLoad(table).map(r => r.id === id ? { ...r, ...data } : r);
    demoSave(table, arr);
    return null;
  },
  delete: async (table, id) => {
    const arr = demoLoad(table).filter(r => r.id !== id);
    demoSave(table, arr);
    return null;
  },
};

const db = DEMO_MODE ? dbDemo : dbReal;

// ── AUTH ─────────────────────────────────────────────────
const auth = {
  signIn: async (email, password) => {
    const res = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { "apikey": SUPA_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error_description || data.msg || "Erro ao entrar");
    return data;
  },
  signUp: async (email, password) => {
    const res = await fetch(`${SUPA_URL}/auth/v1/signup`, {
      method: "POST",
      headers: { "apikey": SUPA_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error_description || data.msg || "Erro ao cadastrar");
    return data;
  },
  signOut: async (token) => {
    await fetch(`${SUPA_URL}/auth/v1/logout`, {
      method: "POST",
      headers: { "apikey": SUPA_KEY, "Authorization": `Bearer ${token}` },
    });
  },
  getSession: () => {
    try { return JSON.parse(localStorage.getItem("arranjo_session") || "null"); }
    catch(_e) { return null; }
  },
  saveSession: (session) => { localStorage.setItem("arranjo_session", JSON.stringify(session)); },
  clearSession: () => localStorage.removeItem("arranjo_session"),
};

const fromDB = {
  esboco: e => ({ id:e.id, n:e.n, tema:e.tema, ultimo:e.ultimo||"" }),
  orador: o => ({ id:o.id, nome:o.nome, cel:o.cel||"", esbocoIds:o.esboco_ids||[], status:o.status }),
  cong: c => ({ id:c.id, nome:c.nome, dia:c.dia, hora:c.hora, contato:c.contato||"", tel:c.tel||"", end:c.end||"" }),
  visit: v => ({ id:v.id, cong:v.cong, dia:v.dia, data:v.data, hora:v.hora, orador:v.orador, esbocoId:v.esboco_id, congregacaoLocal:v.congregacao_local||"", endereco:v.endereco||"", relatorioId:v.relatorio_id||"", status:v.status }),
  saida: s => ({ id:s.id, data:s.data, cong:s.cong, oradorId:s.orador_id, oradorNome:s.orador_nome||"", esbocoId:s.esboco_id, status:s.status }),
};

const toDB = {
  esboco: e => ({ n:e.n, tema:e.tema, ultimo:e.ultimo||"" }),
  orador: o => ({ nome:o.nome, cel:o.cel||"", esboco_ids:o.esbocoIds||[], status:o.status }),
  cong: c => ({ nome:c.nome, dia:c.dia, hora:c.hora, contato:c.contato||"", tel:c.tel||"", end:c.end||"" }),
  visit: v => ({ cong:v.cong, dia:v.dia||"Sábado", data:v.data, hora:v.hora, orador:v.orador, esboco_id:v.esbocoId||null, congregacao_local:v.congregacaoLocal||"Alto da Colina", endereco:v.endereco||"", relatorio_id:v.relatorioId||"", status:v.status }),
  saida: s => ({ data:s.data, cong:s.cong, orador_id:s.oradorId||null, orador_nome:s.oradorNome||"", esboco_id:s.esbocoId||null, status:s.status }),
};

let _id = 5000;
const uid = () => ++_id;
const initials = n => n ? n.split(" ").slice(0,2).map(w=>w[0]).join("").toUpperCase() : "?";
const avatarColor = n => {
  const c=[P.sky,P.teal,P.violet,P.rose,P.amber,P.lime,"#EC4899","#6366F1","#0284C7"];
  let h=0; for(const x of (n||"")) h=(h*31+x.charCodeAt(0))&0xffff;
  return c[h%c.length];
};
const toIso = br => { const p=br.split("/"); return p.length===3?`${p[2]}-${p[1]}-${p[0]}`:br; };
const toBr = iso => { const p=iso.split("-"); return p.length===3?`${p[2]}/${p[1]}/${p[0]}`:iso; };
const sortKey = br => { const p=br.split("/"); return p.length===3?`${p[2]}${p[1]}${p[0]}`:""; };

// ── NEW: daysSince helper ─────────────────────────────────
const daysSince = (iso) => {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  return Math.floor(diff / 86400000);
};

// ── NEW: rotation color helper ────────────────────────────
const corRotacao = (dias) => {
  if (dias === null) return { bg:"#E2E8F0", text:"#64748B", label:"Nunca saiu", tipo:"nunca" };
  if (dias >= 60)   return { bg:"#DCFCE7", text:"#16A34A", label:`${dias}d`,    tipo:"disp"  };
  if (dias >= 30)   return { bg:"#FEF3C7", text:"#D97706", label:`${dias}d`,    tipo:"medio" };
  return               { bg:"#FFE4E6", text:"#E11D48", label:`${dias}d`,    tipo:"rec"   };
};

// ── APP ──────────────────────────────────────────────────
const SENHA_APP = "oradores2026";

export default function App() {
  const [logado, setLogado] = useState(() => DEMO_MODE || localStorage.getItem("arranjo_logado") === "true");
  if (!logado) return <LoginScreen onLogin={() => { localStorage.setItem("arranjo_logado","true"); setLogado(true); }}/>;
  return <MainApp session={{user:{email:""}}} onLogout={() => { localStorage.removeItem("arranjo_logado"); setLogado(false); }}/>;
}

function MainApp({ session, onLogout }) {
  const hoje = new Date();
  const [carregando, setCarregando] = useState(true);
  const [tab, setTab] = useState("home");
  const [esbocos, setEsbocos] = useState(ESBOCOS_INIT);
  const [oradores, setOradores] = useState(DEMO_MODE ? [] : ORADORES_INIT);
  const [congregacoes, setCongregacoes] = useState(CONGS_INIT);
  const [visitantes, setVisitantes] = useState(VISITANTES_INIT);
  const [saidas, setSaidas] = useState(SAIDAS_INIT);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState(null);
  const [search, setSearch] = useState("");
  const [viewMes, setViewMes] = useState(hoje.getMonth());
  const [viewAno, setViewAno] = useState(hoje.getFullYear());
  const [erro, setErro] = useState("");
  const [sincronizando, setSincronizando] = useState(false);

  const toast$ = (msg, ok=true) => { setToast({msg,ok}); setTimeout(()=>setToast(null),2200); };

  useEffect(() => {
    const carregar = async () => {
      try {
        const [eb, or, co, vi, sa] = await Promise.all([
          db.getAll("esbocos"),
          db.getAll("oradores"),
          db.getAll("congregacoes"),
          db.getAll("visitantes","data"),
          db.getAll("saidas","data"),
        ]);
        if (eb && eb.length) setEsbocos(eb.map(fromDB.esboco));
        if (or && or.length) setOradores(or.map(fromDB.orador));
        if (co && co.length) setCongregacoes(co.map(fromDB.cong));
        if (vi && vi.length) setVisitantes(vi.map(fromDB.visit));
        if (sa && sa.length) setSaidas(sa.map(fromDB.saida));
        setErro("");
      } catch(e) {
        setErro("Configure o Supabase: cole a URL e a chave no topo do código.");
        console.error(e);
      }
      setCarregando(false);
    };
    carregar();
  }, []);

  useEffect(() => {
    if (carregando) return;
    const interval = setInterval(async () => {
      try {
        const [vi, sa] = await Promise.all([db.getAll("visitantes","data"), db.getAll("saidas","data")]);
        if (vi && vi.length) setVisitantes(vi.map(fromDB.visit));
        if (sa && sa.length) setSaidas(sa.map(fromDB.saida));
      } catch(e) {}
    }, 30000);
    return () => clearInterval(interval);
  }, [carregando]);

  const sincronizarAgora = async () => {
    setSincronizando(true);
    try {
      const [eb, or, co, vi, sa] = await Promise.all([
        db.getAll("esbocos"), db.getAll("oradores"), db.getAll("congregacoes"),
        db.getAll("visitantes","data"), db.getAll("saidas","data"),
      ]);
      if (eb && eb.length) setEsbocos(eb.map(fromDB.esboco));
      if (or && or.length) setOradores(or.map(fromDB.orador));
      if (co && co.length) setCongregacoes(co.map(fromDB.cong));
      if (vi && vi.length) setVisitantes(vi.map(fromDB.visit));
      if (sa && sa.length) setSaidas(sa.map(fromDB.saida));
      toast$("Sincronizado!");
    } catch(e) { toast$("Erro ao sincronizar", false); }
    setTimeout(() => setSincronizando(false), 800);
  };

  const TABS = [
    {id:"home",     icon:"📋",label:"Programação"},
    {id:"saida",    icon:"📤",label:"Saída"},
    {id:"visitante",icon:"📥",label:"Visitante"},
    {id:"oradores", icon:"🎤",label:"Oradores"},
    {id:"congs",    icon:"🏠",label:"Congs"},
    {id:"esbocos",  icon:"📑",label:"Esboços"},
    {id:"relatorio",icon:"📊",label:"Relatório"},
  ];

  const TAB_MODAL = {home:null,saida:"saida",visitante:"visitante",oradores:"orador",congs:"cong",esbocos:"esboco",relatorio:null};
  const ctx = {esbocos,setEsbocos,oradores,setOradores,congregacoes,setCongregacoes,visitantes,setVisitantes,saidas,setSaidas,search,setModal,toast$};

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100vh",background:P.bg,fontFamily:"'Nunito',sans-serif",width:"100%",position:"relative"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        @media(min-width:601px){html{zoom:1.25}}
        ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:#CBD5E1;border-radius:10px}
        @keyframes slideUp{0%{transform:translateY(16px);opacity:0}100%{transform:translateY(0);opacity:1}}
        @keyframes pop{0%{transform:scale(.88);opacity:0}100%{transform:scale(1);opacity:1}}
        @keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
        .slide{animation:slideUp .22s ease both}
        .pop{animation:pop .18s cubic-bezier(.34,1.56,.64,1) both}
        button:active{transform:scale(.95)}
      `}</style>

      {carregando && (
        <div style={{position:"fixed",inset:0,background:`linear-gradient(135deg,${P.sky},${P.teal})`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12,zIndex:9999}}>
          <div style={{fontSize:48}}>📋</div>
          <div style={{fontWeight:900,fontSize:22,color:"#fff",letterSpacing:-.5}}>Arranjo de Oradores</div>
          <div style={{fontSize:13,color:"rgba(255,255,255,.8)"}}>Congregação Alto da Colina</div>
          <div style={{width:40,height:40,border:"4px solid rgba(255,255,255,.3)",borderTop:"4px solid #fff",borderRadius:"50%",animation:"spin 1s linear infinite"}}/>
        </div>
      )}

      {DEMO_MODE && (
        <div style={{background:"#FEF3C7",borderBottom:"2px solid #F59E0B",padding:"10px 14px",fontSize:12,color:"#92400E",fontWeight:700,display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}>
          <span>🎯 MODO DEMONSTRAÇÃO — os dados ficam apenas no seu navegador.</span>
          <button onClick={()=>{if(confirm("Apagar todos os dados do demo e recomeçar?")){demoResetAll();window.location.reload();}}} style={{background:"#F59E0B",color:"#fff",border:"none",borderRadius:8,padding:"6px 12px",fontSize:11,fontWeight:700,cursor:"pointer"}}>Resetar demo</button>
        </div>
      )}

      {erro && !DEMO_MODE && (
        <div style={{background:"#FEF3C7",borderBottom:"2px solid #F59E0B",padding:"10px 14px",fontSize:12,color:"#92400E",fontWeight:600}}>
          ⚠️ {erro}
        </div>
      )}

      <div style={{background:P.white,borderBottom:`1px solid ${P.border}`,padding:"10px 14px",display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
        {tab==="home" ? (
          <>
            <button onClick={()=>{if(viewMes===0){setViewMes(11);setViewAno(a=>a-1);}else setViewMes(m=>m-1);}} style={{...navBtn}}>◀</button>
            <div style={{flex:1,textAlign:"center"}}>
              <div style={{fontWeight:900,fontSize:16,color:P.text}}>{MESES[viewMes]} {viewAno}</div>
              <div style={{fontSize:11,color:P.sub}}>Congregação Alto da Colina</div>
            </div>
            <button onClick={()=>{if(viewMes===11){setViewMes(0);setViewAno(a=>a+1);}else setViewMes(m=>m+1);}} style={{...navBtn}}>▶</button>
          </>
        ) : (
          <>
            <div style={{flex:1}}>
              <div style={{fontWeight:900,fontSize:16,color:P.text}}>{(TABS.find(t=>t.id===tab)||{}).label}</div>
              <div style={{fontSize:11,color:P.sub}}>👤 {session && session.user ? session.user.email : ""}</div>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar…"
                style={{background:P.slateL,border:"none",borderRadius:20,padding:"6px 12px",fontSize:12,width:"100%",marginTop:6,outline:"none"}}/>
            </div>
          </>
        )}
        {TAB_MODAL[tab] && (
          <button onClick={()=>setModal({type:TAB_MODAL[tab]})}
            style={{background:P.sky,border:"none",color:"#fff",width:34,height:34,borderRadius:12,fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>＋</button>
        )}
        <button onClick={sincronizarAgora}
          style={{background:sincronizando?P.teal:P.slateL,border:"none",color:sincronizando?"#fff":P.sub,width:34,height:34,borderRadius:12,fontSize:16,cursor:"pointer",transition:"all .3s"}}>🔄</button>
        <button onClick={async ()=>{ await auth.signOut(session ? session.access_token : null); onLogout(); }}
          style={{background:P.slateL,border:"none",color:P.sub,width:34,height:34,borderRadius:12,fontSize:16,cursor:"pointer"}} title="Sair">🚪</button>
      </div>

      <div style={{flex:1,overflowY:"auto",overflowX:"hidden"}}>
        {tab==="home"       && <ProgramacaoMes visitantes={visitantes} saidas={saidas} esbocos={esbocos} mes={viewMes} ano={viewAno} setModal={setModal}/>}
        {tab==="saida"      && <SaidaView {...ctx}/>}
        {tab==="visitante"  && <VisitanteView {...ctx}/>}
        {tab==="oradores"   && <OradoresView oradores={oradores} esbocos={esbocos} saidas={saidas} search={search} setModal={setModal}/>}
        {tab==="congs"      && <CongsView {...ctx}/>}
        {tab==="esbocos"    && <EsbocosView esbocos={esbocos} saidas={saidas} visitantes={visitantes} search={search} setModal={setModal}/>}
        {tab==="relatorio"  && <RelatorioView visitantes={visitantes} saidas={saidas} esbocos={esbocos} congregacoes={congregacoes} oradores={oradores}/>}
      </div>

      <div style={{background:P.white,borderTop:`1px solid ${P.border}`,display:"flex",flexShrink:0,overflowX:"auto",position:"relative"}}>
        {TABS.map(t=>{
          const active=tab===t.id;
          return (
            <button key={t.id} onClick={()=>{setTab(t.id);setSearch("");}}
              style={{flex:"0 0 auto",minWidth:52,border:"none",background:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",padding:"8px 6px 6px",color:active?P.sky:P.sub,position:"relative",transition:"color .15s"}}>
              {active&&<div style={{position:"absolute",top:0,left:"10%",right:"10%",height:3,background:P.sky,borderRadius:"0 0 4px 4px"}}/>}
              <span style={{fontSize:17,lineHeight:1}}>{t.icon}</span>
              <span style={{fontSize:8.5,fontWeight:active?800:600}}>{t.label}</span>
            </button>
          );
        })}
      </div>

      {modal && <ModalLayer modal={modal} setModal={setModal} toast$={toast$} {...ctx}/>}

      {toast && (
        <div className="pop" style={{position:"fixed",bottom:76,left:"50%",transform:"translateX(-50%)",
          background:toast.ok?P.teal:P.rose,color:"#fff",padding:"10px 20px",borderRadius:24,
          fontSize:13,fontWeight:700,zIndex:9999,whiteSpace:"nowrap",boxShadow:"0 4px 16px rgba(0,0,0,.15)"}}>
          {toast.ok?"✓":"✕"} {toast.msg}
        </div>
      )}
    </div>
  );
}

const navBtn = {background:P.slateL,border:"none",width:34,height:34,borderRadius:12,fontSize:14,cursor:"pointer",color:P.sub,display:"flex",alignItems:"center",justifyContent:"center"};

// ── LOGIN SCREEN ──────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const entrar = () => {
    if (!senha) return setErro("Digite a senha de acesso");
    if (senha !== SENHA_APP) return setErro("Senha incorreta");
    onLogin();
  };
  return (
    <div style={{display:"flex",flexDirection:"column",height:"100vh",background:`linear-gradient(135deg,${P.sky},${P.teal})`,alignItems:"center",justifyContent:"center",padding:24,fontFamily:"'Nunito',sans-serif"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');*{box-sizing:border-box;margin:0;padding:0}@media(min-width:601px){html{zoom:1.25}}`}</style>
      <div style={{textAlign:"center",marginBottom:32,color:"#fff"}}>
        <div style={{fontSize:56,marginBottom:8}}>📋</div>
        <div style={{fontWeight:900,fontSize:28,letterSpacing:-.5}}>Arranjo de Oradores</div>
        <div style={{fontSize:15,opacity:.8,marginTop:4}}>Congregação Alto da Colina</div>
      </div>
      <div style={{background:"#fff",borderRadius:24,padding:32,width:"100%",maxWidth:400,boxShadow:"0 8px 32px rgba(0,0,0,.12)"}}>
        <div style={{textAlign:"center",marginBottom:20}}>
          <div style={{fontSize:18,fontWeight:800,color:P.text}}>🔒 Acesso Restrito</div>
          <div style={{fontSize:13,color:P.sub,marginTop:4}}>Digite a senha para entrar</div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <div>
            <label style={{fontSize:14,fontWeight:800,color:P.text,marginBottom:6,display:"block"}}>Senha</label>
            <input type="password" value={senha} onChange={e=>{setSenha(e.target.value);setErro("");}}
              placeholder="Digite a senha..." onKeyDown={e=>e.key==="Enter"&&entrar()} autoFocus
              style={{width:"100%",background:"#fff",border:`2px solid ${P.border}`,borderRadius:14,padding:"14px 16px",fontSize:16,outline:"none",color:P.text}}/>
          </div>
          {erro&&<div style={{background:P.roseL,color:P.rose,borderRadius:12,padding:"12px 16px",fontSize:13,fontWeight:700,textAlign:"center"}}>❌ {erro}</div>}
          <button onClick={entrar}
            style={{background:`linear-gradient(135deg,${P.sky},${P.teal})`,border:"none",color:"#fff",borderRadius:14,padding:"16px",fontWeight:800,fontSize:16,cursor:"pointer"}}>
            Entrar →
          </button>
        </div>
      </div>
    </div>
  );
}

function ProgramacaoMes({visitantes,saidas,esbocos,mes,ano,setModal}) {
  const mm=String(mes+1).padStart(2,"0");
  const aa=String(ano);
  const eventos=[];
  visitantes.forEach(v=>{const p=v.data.split("/");if(p.length===3&&p[1]===mm&&p[2]===aa)eventos.push({...v,tipo:"visitante",dia:+p[0]});});
  saidas.forEach(s=>{const p=s.data.split("/");if(p.length===3&&p[1]===mm&&p[2]===aa)eventos.push({...s,tipo:"saida",dia:+p[0]});});
  const porDia={};
  eventos.forEach(e=>{if(!porDia[e.dia])porDia[e.dia]=[];porDia[e.dia].push(e);});
  const diasOrdenados=Object.keys(porDia).map(Number).sort((a,b)=>a-b);
  const diasNoMes=new Date(+aa,mes+1,0).getDate();
  const sabados=[];
  for(let d=1;d<=diasNoMes;d++){if(new Date(+aa,mes,d).getDay()===6)sabados.push(d);}
  const sabadosSemArranjo=sabados.filter(d=>!porDia[d]);
  const totalV=eventos.filter(e=>e.tipo==="visitante").length;
  const totalS=eventos.filter(e=>e.tipo==="saida").length;
  const getDiaSemana=dia=>DIAS[new Date(+aa,mes,dia).getDay()];
  return (
    <div>
      <div style={{display:"flex",gap:8,padding:"12px 14px 6px"}}>
        <div style={{flex:1,background:P.violetL,borderRadius:14,padding:"10px 12px",display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:20}}>📥</span>
          <div><div style={{fontWeight:900,fontSize:20,color:P.violet,lineHeight:1}}>{totalV}</div><div style={{fontSize:9,color:P.sub}}>Visitantes</div></div>
        </div>
        <div style={{flex:1,background:P.skyL,borderRadius:14,padding:"10px 12px",display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:20}}>📤</span>
          <div><div style={{fontWeight:900,fontSize:20,color:P.sky,lineHeight:1}}>{totalS}</div><div style={{fontSize:9,color:P.sub}}>Saídas</div></div>
        </div>
        <div style={{flex:1,background:sabadosSemArranjo.length>0?P.roseL:P.limeL,borderRadius:14,padding:"10px 12px",display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:20}}>{sabadosSemArranjo.length>0?"⚠️":"✅"}</span>
          <div><div style={{fontWeight:900,fontSize:20,color:sabadosSemArranjo.length>0?P.rose:P.lime,lineHeight:1}}>{sabadosSemArranjo.length}</div><div style={{fontSize:9,color:P.sub}}>Vazios</div></div>
        </div>
      </div>
      {sabadosSemArranjo.length>0&&(
        <div style={{margin:"4px 14px 0",background:"#FFF7ED",border:`1.5px solid ${P.amber}44`,borderRadius:14,padding:12}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
            <span style={{fontSize:18}}>⚠️</span>
            <span style={{fontWeight:800,fontSize:13,color:"#92400E"}}>{sabadosSemArranjo.length} sábado{sabadosSemArranjo.length>1?"s":""} sem arranjo</span>
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
            {sabadosSemArranjo.map(d=>(
              <div key={d} style={{background:P.white,border:`1px solid ${P.amber}44`,borderRadius:10,padding:"6px 12px",textAlign:"center",display:"flex",flexDirection:"column",alignItems:"center"}}>
                <span style={{fontSize:11,color:P.sub,fontWeight:600}}>Sáb</span>
                <span style={{fontSize:18,fontWeight:900,color:P.rose,lineHeight:1.1}}>{d}</span>
                <span style={{fontSize:9,color:P.sub}}>19:00</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {diasOrdenados.length===0&&(
        <div style={{textAlign:"center",color:P.sub,padding:"40px 0",fontSize:14}}>
          <div style={{fontSize:40}}>📭</div>
          <div style={{fontWeight:700,marginTop:8}}>Nenhum arranjo neste mês</div>
        </div>
      )}
      <div style={{padding:"10px 14px 20px",display:"flex",flexDirection:"column",gap:14}}>
        {diasOrdenados.map((dia,idx)=>{
          const evs=porDia[dia];
          const isHoje=dia===new Date().getDate()&&mes===new Date().getMonth()&&ano===new Date().getFullYear();
          return (
            <div key={dia} className="slide" style={{animationDelay:`${idx*.05}s`}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                <div style={{width:48,height:48,borderRadius:14,flexShrink:0,background:isHoje?`linear-gradient(135deg,${P.sky},${P.teal})`:P.slateL,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
                  <div style={{fontSize:9,fontWeight:700,color:isHoje?"rgba(255,255,255,.8)":P.sub}}>{getDiaSemana(dia)}</div>
                  <div style={{fontSize:20,fontWeight:900,color:isHoje?"#fff":P.text,lineHeight:1}}>{dia}</div>
                </div>
                <div style={{flex:1,height:1,background:P.border}}/>
                <div style={{fontSize:11,color:P.sub,fontWeight:600}}>{evs.length} arranjo{evs.length>1?"s":""}</div>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:8,paddingLeft:6}}>
                {evs.map((e,i)=><EventCard key={i} evento={e} esbocos={esbocos} setModal={setModal}/>)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EventCard({evento,esbocos,setModal}) {
  const isV=evento.tipo==="visitante";
  const cor=isV?P.violet:P.sky;
  const st=STATUS[evento.status]||STATUS.pendente;
  const eb=esbocos.find(e=>e.id===evento.esbocoId);
  const nome=isV?evento.orador:evento.oradorNome;
  const local=isV?`↙ ${evento.cong}`:`↗ ${evento.cong}`;
  const ac=avatarColor(nome||"?");
  return (
    <div onClick={()=>setModal({type:isV?"visitante":"saida",data:evento})}
      style={{background:P.white,borderRadius:16,padding:"12px 14px",display:"flex",alignItems:"center",gap:12,boxShadow:"0 1px 4px rgba(0,0,0,.06)",cursor:"pointer",borderLeft:`4px solid ${cor}`}}>
      <div style={{width:44,height:44,borderRadius:14,background:ac,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:14,flexShrink:0}}>{initials(nome)}</div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontWeight:800,fontSize:13,color:P.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{nome}</div>
        <div style={{fontSize:11,color:cor,fontWeight:700,marginTop:2}}>{local}</div>
        {eb&&<div style={{fontSize:10,color:P.sub,marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>📑 {eb.n} – {eb.tema}</div>}
        {evento.hora&&<div style={{fontSize:10,color:P.sub,marginTop:1}}>🕐 {evento.hora}</div>}
      </div>
      <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:5,flexShrink:0}}>
        <span style={{background:isV?P.violetL:P.skyL,color:cor,fontSize:10,fontWeight:800,padding:"3px 8px",borderRadius:8}}>{isV?"Visitante":"Saída"}</span>
        <span style={{background:st.bg,color:st.color,fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:8}}>{st.label}</span>
      </div>
    </div>
  );
}

// ── VIEWS ────────────────────────────────────────────────
function VisitanteView({visitantes,esbocos,search,setModal}) {
  const q=search.toLowerCase();
  const rows=[...visitantes].filter(v=>!q||v.cong.toLowerCase().includes(q)||v.orador.toLowerCase().includes(q)).sort((a,b)=>sortKey(b.data).localeCompare(sortKey(a.data)));
  return (
    <div style={{padding:"12px 14px",display:"flex",flexDirection:"column",gap:10}}>
      {rows.length===0&&<Empty/>}
      {rows.map((v,i)=>{
        const st=STATUS[v.status]||STATUS.pendente;
        const eb=esbocos.find(e=>e.id===v.esbocoId);
        return (
          <div key={v.id} className="slide" style={{background:P.white,borderRadius:18,padding:"14px",boxShadow:"0 1px 4px rgba(0,0,0,.06)",cursor:"pointer"}}
            onClick={()=>setModal({type:"visitante",data:v})}>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <div style={{width:46,height:46,borderRadius:14,background:avatarColor(v.orador),display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:15}}>{initials(v.orador)}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:800,fontSize:14,color:P.text}}>{v.cong}</div>
                <div style={{fontSize:12,color:P.sub,marginTop:1}}>🎤 {v.orador}</div>
                {eb&&<div style={{fontSize:11,color:P.sky,marginTop:1}}>📑 {eb.n} – {eb.tema.slice(0,40)}</div>}
              </div>
              <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:5}}>
                <span style={{background:st.bg,color:st.color,fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:8}}>{st.label}</span>
                <span style={{fontSize:11,fontWeight:700,color:P.sub}}>{v.data}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SaidaView({saidas,search,setModal}) {
  const q=search.toLowerCase();
  const rows=[...saidas].filter(s=>!q||s.cong.toLowerCase().includes(q)||s.oradorNome.toLowerCase().includes(q)).sort((a,b)=>sortKey(b.data).localeCompare(sortKey(a.data)));
  return (
    <div style={{padding:"12px 14px",display:"flex",flexDirection:"column",gap:10}}>
      {rows.length===0&&<Empty/>}
      {rows.map((s,i)=>{
        const st=STATUS[s.status]||STATUS.pendente;
        const ac=avatarColor(s.oradorNome);
        return (
          <div key={s.id} className="slide" style={{background:P.white,borderRadius:18,padding:"14px",boxShadow:"0 1px 4px rgba(0,0,0,.06)",cursor:"pointer"}}
            onClick={()=>setModal({type:"saida",data:s})}>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <div style={{width:46,height:46,borderRadius:14,background:ac,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:15}}>{initials(s.oradorNome)}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:800,fontSize:14,color:P.text}}>{s.oradorNome}</div>
                <div style={{fontSize:12,color:P.sub,marginTop:1}}>🏠 {s.cong}</div>
              </div>
              <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:5}}>
                <span style={{background:st.bg,color:st.color,fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:8}}>{st.label}</span>
                <span style={{fontSize:11,fontWeight:700,color:P.sub}}>{s.data}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── ORADORES VIEW — com controle de rotação ───────────────
function OradoresView({oradores, esbocos, saidas, search, setModal}) {
  const [filter, setFilter] = useState("todos");

  const q = search.toLowerCase();

  // Compute last saida for each orador
  const oradorComRotacao = oradores.map(o => {
    const saidasDoOrador = [...saidas]
      .filter(s => s.oradorId === o.id)
      .sort((a, b) => sortKey(b.data).localeCompare(sortKey(a.data)));
    const ultima = saidasDoOrador[0] || null;
    const ultimaData = ultima ? ultima.data : null;
    const ultimaCong = ultima ? ultima.cong : null;
    const dias = ultimaData ? daysSince(toIso(ultimaData)) : null;
    return { ...o, ultimaData, ultimaCong, dias };
  });

  // Sort by most days first (most available at top)
  const sorted = [...oradorComRotacao].sort((a, b) => {
    if (a.dias === null && b.dias === null) return a.nome.localeCompare(b.nome);
    if (a.dias === null) return -1;
    if (b.dias === null) return 1;
    return b.dias - a.dias;
  });

  const rows = sorted.filter(o => {
    const matchQ = !q || o.nome.toLowerCase().includes(q) || o.cel.includes(q);
    const cor = corRotacao(o.dias);
    const matchF = filter === "todos" || filter === cor.tipo;
    return matchQ && matchF;
  });

  const totDisp   = oradorComRotacao.filter(o => o.dias !== null && o.dias >= 60).length;
  const totMedio  = oradorComRotacao.filter(o => o.dias !== null && o.dias >= 30 && o.dias < 60).length;
  const totRec    = oradorComRotacao.filter(o => o.dias !== null && o.dias < 30).length;
  const totNunca  = oradorComRotacao.filter(o => o.dias === null).length;

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      {/* Summary bar */}
      <div style={{display:"flex",gap:6,padding:"10px 14px 6px",flexShrink:0}}>
        {[
          [totDisp,  "Disponível", "#DCFCE7","#16A34A"],
          [totMedio, "Moderado",   "#FEF3C7","#D97706"],
          [totRec,   "Recente",    "#FFE4E6","#E11D48"],
          [totNunca, "Nunca",      "#E2E8F0","#64748B"],
        ].map(([v,l,bg,c])=>(
          <div key={l} style={{flex:1,background:bg,borderRadius:10,padding:"6px 4px",textAlign:"center"}}>
            <div style={{fontSize:16,fontWeight:900,color:c,lineHeight:1}}>{v}</div>
            <div style={{fontSize:8,color:c,fontWeight:700,marginTop:1}}>{l}</div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div style={{display:"flex",gap:10,padding:"2px 14px 8px",flexShrink:0,flexWrap:"wrap"}}>
        <span style={{fontSize:10,color:P.sub}}>
          <span style={{display:"inline-block",width:8,height:8,borderRadius:"50%",background:"#16A34A",marginRight:3}}/>+60d disponível
        </span>
        <span style={{fontSize:10,color:P.sub}}>
          <span style={{display:"inline-block",width:8,height:8,borderRadius:"50%",background:"#D97706",marginRight:3}}/>30–60d moderado
        </span>
        <span style={{fontSize:10,color:P.sub}}>
          <span style={{display:"inline-block",width:8,height:8,borderRadius:"50%",background:"#E11D48",marginRight:3}}/>&lt;30d recente
        </span>
      </div>

      {/* Filter pills */}
      <div style={{display:"flex",gap:6,padding:"0 14px 8px",overflowX:"auto",flexShrink:0}}>
        {[
          ["todos","Todos",    P.slate],
          ["disp", "+60d",     "#16A34A"],
          ["medio","30–60d",   "#D97706"],
          ["rec",  "-30d",     "#E11D48"],
          ["nunca","Nunca",    P.slate],
        ].map(([k,l,c])=>(
          <button key={k} onClick={()=>setFilter(k)}
            style={{background:filter===k?c:P.slateL,color:filter===k?"#fff":P.sub,border:"none",borderRadius:20,padding:"5px 12px",fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>
            {l}
          </button>
        ))}
      </div>

      {/* Cards */}
      <div style={{flex:1,overflowY:"auto",padding:"0 14px 12px",display:"flex",flexDirection:"column",gap:10}}>
        {rows.length===0&&<Empty/>}
        {rows.map((o,i)=>{
          const ac  = avatarColor(o.nome);
          const st  = STATUS[o.status]||STATUS.pendente;
          const ebs = esbocos.filter(e=>(o.esbocoIds||[]).includes(e.id));
          const eb  = ebs[0];
          const cor = corRotacao(o.dias);
          return (
            <div key={o.id} className="slide"
              style={{background:P.white,borderRadius:18,padding:"14px",boxShadow:"0 1px 4px rgba(0,0,0,.06)",cursor:"pointer",borderLeft:`4px solid ${cor.text}`}}
              onClick={()=>setModal({type:"orador",data:o})}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <div style={{width:48,height:48,borderRadius:16,background:ac,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:16,flexShrink:0}}>
                  {initials(o.nome)}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:800,fontSize:14,color:P.text}}>{o.nome}</div>
                  <div style={{fontSize:11,color:P.sub,marginTop:1}}>📱 {o.cel||"–"}</div>
                  {eb&&<div style={{fontSize:11,color:P.sky,marginTop:1}}>📑 {eb.n} – {eb.tema.slice(0,30)}… ({ebs.length})</div>}
                  {/* ── Última saída info ── */}
                  {o.ultimaData ? (
                    <div style={{fontSize:10,color:P.sub,marginTop:3}}>
                      📅 {o.ultimaData} · 🏠 {o.ultimaCong}
                    </div>
                  ) : (
                    <div style={{fontSize:10,color:P.sub,marginTop:3,fontStyle:"italic"}}>Nunca saiu</div>
                  )}
                </div>
                <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:5,flexShrink:0}}>
                  <span style={{background:cor.bg,color:cor.text,fontSize:12,fontWeight:800,padding:"5px 10px",borderRadius:10,minWidth:52,textAlign:"center"}}>
                    {cor.label}
                  </span>
                  <span style={{background:st.bg,color:st.color,fontSize:9,fontWeight:700,padding:"2px 8px",borderRadius:8}}>{st.label}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CongsView({congregacoes,saidas,visitantes,search,setModal}) {
  const q=search.toLowerCase();
  const rows=congregacoes.filter(c=>!q||c.nome.toLowerCase().includes(q));
  const COLS=[P.sky,P.teal,P.violet,P.rose,P.amber,P.lime];
  return (
    <div style={{padding:"12px 14px",display:"flex",flexDirection:"column",gap:10}}>
      {rows.length===0&&<Empty/>}
      {rows.map((c,i)=>{
        const col=COLS[i%COLS.length];
        const nS=saidas.filter(s=>s.cong===c.nome).length;
        const nV=visitantes.filter(v=>v.cong===c.nome).length;
        return (
          <div key={c.id} className="slide" style={{background:P.white,borderRadius:18,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,.06)",cursor:"pointer"}}
            onClick={()=>setModal({type:"cong",data:c})}>
            <div style={{padding:"14px"}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:44,height:44,borderRadius:14,background:col+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>🏠</div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:800,fontSize:14,color:P.text}}>{c.nome}</div>
                  <div style={{fontSize:11,color:P.sub,marginTop:2}}>{c.dia} · {c.hora}{c.contato?` · ${c.contato}`:""}</div>
                </div>
              </div>
              {(nS>0||nV>0)&&<div style={{display:"flex",gap:8,marginTop:10}}>
                {nS>0&&<span style={{background:P.skyL,color:P.sky,fontSize:11,fontWeight:700,padding:"4px 10px",borderRadius:8}}>📤 {nS} saída{nS>1?"s":""}</span>}
                {nV>0&&<span style={{background:P.violetL,color:P.violet,fontSize:11,fontWeight:700,padding:"4px 10px",borderRadius:8}}>📥 {nV} visita{nV>1?"s":""}</span>}
              </div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── ESBOÇOS VIEW — com controle de uso ────────────────────
function EsbocosView({esbocos, saidas, visitantes, search, setModal}) {
  const q = search.toLowerCase();

  // Compute stats for each esboço
  const esbocoStats = esbocos.map(e => {
    const usosS = saidas.filter(s => s.esbocoId === e.id).map(s => ({ data:s.data, quem:s.oradorNome }));
    const usosV = visitantes.filter(v => v.esbocoId === e.id).map(v => ({ data:v.data, quem:v.orador }));
    const todos = [...usosS, ...usosV].sort((a,b) => sortKey(b.data).localeCompare(sortKey(a.data)));
    const ultimo = todos[0] || null;
    const dias = ultimo ? daysSince(toIso(ultimo.data)) : null;
    return { ...e, totalUsos: todos.length, ultimaData: ultimo?.data||null, ultimoQuem: ultimo?.quem||null, dias };
  });

  const rows = esbocoStats.filter(e => !q || e.tema.toLowerCase().includes(q) || String(e.n).includes(q));

  // Color based on days since last use (different thresholds for esboços)
  const corEsboco = (dias) => {
    if (dias === null) return { bg: P.slateL, color: P.sub, label: "Nunca" };
    if (dias >= 180)  return { bg: P.limeL,  color: P.lime,  label: `${dias}d` };
    if (dias >= 90)   return { bg: P.amberL, color: P.amber, label: `${dias}d` };
    return               { bg: P.roseL,  color: P.rose,  label: `${dias}d` };
  };

  return (
    <div style={{padding:"12px 14px",display:"flex",flexDirection:"column",gap:8}}>
      {/* Legend */}
      <div style={{display:"flex",gap:10,marginBottom:4,flexWrap:"wrap"}}>
        <span style={{fontSize:10,color:P.sub}}><span style={{display:"inline-block",width:8,height:8,borderRadius:"50%",background:P.lime,marginRight:3}}/>+180d disponível</span>
        <span style={{fontSize:10,color:P.sub}}><span style={{display:"inline-block",width:8,height:8,borderRadius:"50%",background:P.amber,marginRight:3}}/>90–180d moderado</span>
        <span style={{fontSize:10,color:P.sub}}><span style={{display:"inline-block",width:8,height:8,borderRadius:"50%",background:P.rose,marginRight:3}}/>&lt;90d recente</span>
      </div>
      {rows.map((e,i)=>{
        const cor = corEsboco(e.dias);
        return (
          <div key={e.id} className="slide" onClick={()=>setModal({type:"esboco",data:e})}
            style={{background:P.white,borderRadius:16,padding:"13px 14px",boxShadow:"0 1px 4px rgba(0,0,0,.05)",cursor:"pointer",display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:44,height:44,borderRadius:12,background:cor.bg,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:13,color:cor.color,flexShrink:0,flexDirection:"column",lineHeight:1.1}}>
              <span>{e.n}</span>
              {e.totalUsos > 0 && <span style={{fontSize:9,fontWeight:700,opacity:.8}}>{e.totalUsos}x</span>}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:700,fontSize:13,color:P.text}}>{e.tema}</div>
              {e.ultimaData ? (
                <div style={{fontSize:10,color:P.sub,marginTop:3,display:"flex",gap:8,flexWrap:"wrap"}}>
                  <span>📅 {e.ultimaData}</span>
                  <span>🎤 {e.ultimoQuem}</span>
                  <span style={{color:cor.color,fontWeight:700}}>{cor.label}</span>
                </div>
              ) : (
                <div style={{fontSize:10,color:P.sub,marginTop:3,fontStyle:"italic"}}>Nunca apresentado</div>
              )}
            </div>
            <span style={{color:P.sub,fontSize:18}}>›</span>
          </div>
        );
      })}
    </div>
  );
}

// ── RELATÓRIO VIEW — com sub-abas ─────────────────────────
function RelatorioView({visitantes, saidas, esbocos, congregacoes, oradores}) {
  const [subTab, setSubTab] = useState("programacao");

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      {/* Sub-tab bar */}
      <div style={{display:"flex",borderBottom:`1px solid ${P.border}`,background:P.white,flexShrink:0}}>
        {[
          ["programacao","📋 Programação"],
          ["oradores",   "🎤 Rel. Oradores"],
        ].map(([k,l])=>(
          <button key={k} onClick={()=>setSubTab(k)}
            style={{flex:1,border:"none",background:"none",cursor:"pointer",padding:"12px 8px",fontSize:12,fontWeight:subTab===k?800:600,color:subTab===k?P.sky:P.sub,borderBottom:`3px solid ${subTab===k?P.sky:"transparent"}`,transition:"all .15s"}}>
            {l}
          </button>
        ))}
      </div>

      <div style={{flex:1,overflowY:"auto"}}>
        {subTab==="programacao" && <ProgramacaoRelatorio visitantes={visitantes} saidas={saidas} esbocos={esbocos} congregacoes={congregacoes}/>}
        {subTab==="oradores"    && <RelatorioOradores oradores={oradores} saidas={saidas} esbocos={esbocos}/>}
      </div>
    </div>
  );
}

// ── PROGRAMAÇÃO RELATORIO (existing logic extracted) ───────
function ProgramacaoRelatorio({visitantes, saidas, esbocos, congregacoes}) {
  const hoje=new Date();
  const [mes,setMes]=useState(hoje.getMonth());
  const [ano,setAno]=useState(hoje.getFullYear());
  const [showPrint,setShowPrint]=useState(false);
  const mm=String(mes+1).padStart(2,"0");
  const aa=String(ano);
  const filtV=[...visitantes].filter(v=>{const p=v.data.split("/");return p.length===3&&p[1]===mm&&p[2]===aa;}).sort((a,b)=>sortKey(a.data).localeCompare(sortKey(b.data)));
  const filtS=[...saidas].filter(s=>{const p=s.data.split("/");return p.length===3&&p[1]===mm&&p[2]===aa;}).sort((a,b)=>sortKey(a.data).localeCompare(sortKey(b.data)));
  const getEsboco=id=>esbocos.find(e=>e.id===id);
  const getCong=nome=>congregacoes.find(c=>c.nome===nome);
  const prevMes=()=>{if(mes===0){setMes(11);setAno(a=>a-1);}else setMes(m=>m-1);};
  const nextMes=()=>{if(mes===11){setMes(0);setAno(a=>a+1);}else setMes(m=>m+1);};
  const mesLabel=`${MESES[mes]} ${ano}`;
  if(showPrint) return <PrintView mes={mes} ano={ano} filtV={filtV} filtS={filtS} getEsboco={getEsboco} getCong={getCong} mesLabel={mesLabel} onClose={()=>setShowPrint(false)}/>;
  const rowStyle=(i)=>({display:"grid",gridTemplateColumns:"70px 1fr 1fr",gap:6,padding:"10px 14px",background:i%2===0?"#FAFBFC":"#fff",fontSize:12});
  return (
    <div style={{display:"flex",flexDirection:"column",minHeight:"100%"}}>
      <div style={{background:`linear-gradient(135deg,${P.sky},${P.teal})`,color:"#fff",padding:"16px 14px"}}>
        <div style={{fontWeight:900,fontSize:15,textAlign:"center",marginBottom:4}}>Programação de Discursos</div>
        <div style={{fontSize:11,textAlign:"center",opacity:.85,marginBottom:12}}>Congregação Alto da Colina</div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <button onClick={prevMes} style={{background:"rgba(255,255,255,.2)",border:"none",color:"#fff",borderRadius:10,padding:"8px 12px",cursor:"pointer",fontWeight:700}}>◀</button>
          <div style={{flex:1,textAlign:"center",fontWeight:800,fontSize:16}}>{mesLabel}</div>
          <button onClick={nextMes} style={{background:"rgba(255,255,255,.2)",border:"none",color:"#fff",borderRadius:10,padding:"8px 12px",cursor:"pointer",fontWeight:700}}>▶</button>
        </div>
      </div>
      <div style={{padding:"14px 14px 24px",display:"flex",flexDirection:"column",gap:16}}>
        <button onClick={()=>setShowPrint(true)} style={{width:"100%",background:`linear-gradient(135deg,${P.sky},${P.teal})`,border:"none",color:"#fff",borderRadius:14,padding:"14px",fontWeight:800,fontSize:14,cursor:"pointer"}}>
          📄 Ver e Imprimir Relatório
        </button>
        <div style={{background:P.white,borderRadius:16,overflow:"hidden",boxShadow:"0 2px 8px rgba(0,0,0,.06)"}}>
          <div style={{background:P.violetL,padding:"10px 14px",display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:18}}>📥</span>
            <div style={{flex:1}}><div style={{fontWeight:800,fontSize:13,color:P.violet}}>Oradores Visitantes</div></div>
            <span style={{background:P.violet,color:"#fff",borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:800}}>{filtV.length}</span>
          </div>
          {filtV.length===0?<div style={{padding:"20px",textAlign:"center",color:P.sub,fontSize:12,fontStyle:"italic"}}>Nenhum visitante neste mês</div>:(
            <>
              <div style={{display:"grid",gridTemplateColumns:"70px 1fr 1fr",gap:6,padding:"7px 14px",background:P.slateL}}>
                {["Data","Orador / Tema","Congregação"].map(h=><div key={h} style={{fontSize:10,fontWeight:800,color:P.sub,textTransform:"uppercase"}}>{h}</div>)}
              </div>
              {filtV.map((v,i)=>{const eb=getEsboco(v.esbocoId);return(
                <div key={v.id} style={rowStyle(i)}>
                  <div><div style={{fontWeight:700,fontSize:12,color:P.sky}}>{v.data.slice(0,5)}</div></div>
                  <div><div style={{fontWeight:700,fontSize:12,color:P.text}}>{v.orador}</div>{eb&&<div style={{fontSize:10,color:P.violet}}>📑 {eb.n} – {eb.tema.slice(0,30)}</div>}</div>
                  <div style={{fontSize:11,color:P.text}}>{v.cong}</div>
                </div>
              );})}
            </>
          )}
        </div>
        <div style={{background:P.white,borderRadius:16,overflow:"hidden",boxShadow:"0 2px 8px rgba(0,0,0,.06)"}}>
          <div style={{background:P.skyL,padding:"10px 14px",display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:18}}>📤</span>
            <div style={{flex:1}}><div style={{fontWeight:800,fontSize:13,color:P.sky}}>Saídas de Oradores</div></div>
            <span style={{background:P.sky,color:"#fff",borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:800}}>{filtS.length}</span>
          </div>
          {filtS.length===0?<div style={{padding:"20px",textAlign:"center",color:P.sub,fontSize:12,fontStyle:"italic"}}>Nenhuma saída neste mês</div>:(
            <>
              <div style={{display:"grid",gridTemplateColumns:"70px 1fr 1fr",gap:6,padding:"7px 14px",background:P.slateL}}>
                {["Data","Orador / Tema","Congregação"].map(h=><div key={h} style={{fontSize:10,fontWeight:800,color:P.sub,textTransform:"uppercase"}}>{h}</div>)}
              </div>
              {filtS.map((s,i)=>{const eb=getEsboco(s.esbocoId);const cong=getCong(s.cong);const st=STATUS[s.status];return(
                <div key={s.id} style={rowStyle(i)}>
                  <div style={{fontWeight:700,fontSize:12,color:P.sky}}>{s.data.slice(0,5)}</div>
                  <div><div style={{fontWeight:700,fontSize:12,color:P.text}}>{s.oradorNome}</div>{eb&&<div style={{fontSize:10,color:P.sky}}>📑 {eb.n} – {eb.tema.slice(0,30)}</div>}</div>
                  <div><div style={{fontSize:11,color:P.text}}>{s.cong}</div>{cong&&cong.end&&<div style={{fontSize:10,color:P.sub}}>{cong.end}</div>}{st&&<span style={{background:st.bg,color:st.color,fontSize:9,fontWeight:700,padding:"2px 6px",borderRadius:6}}>{st.label}</span>}</div>
                </div>
              );})}
            </>
          )}
        </div>
        <div style={{display:"flex",gap:10}}>
          {[[filtV.length,"Visitantes",P.violet,P.violetL],[filtS.length,"Saídas",P.sky,P.skyL]].map(([v,l,c,bg])=>(
            <div key={l} style={{flex:1,background:bg,borderRadius:14,padding:"12px 0",textAlign:"center"}}>
              <div style={{fontSize:24,fontWeight:900,color:c}}>{v}</div>
              <div style={{fontSize:10,color:P.sub,fontWeight:600}}>{l}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── NOVO: RELATÓRIO DE ORADORES ───────────────────────────
function RelatorioOradores({oradores, saidas, esbocos}) {
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth());
  const [ano, setAno] = useState(hoje.getFullYear());
  const [selecionados, setSelecionados] = useState([]);
  const [copiado, setCopiado] = useState(false);

  // Compute rotation for all oradores
  const oradorComRotacao = oradores.map(o => {
    const saidasDoOrador = [...saidas]
      .filter(s => s.oradorId === o.id)
      .sort((a, b) => sortKey(b.data).localeCompare(sortKey(a.data)));
    const ultima = saidasDoOrador[0] || null;
    const ultimaData = ultima?.data || null;
    const ultimaCong = ultima?.cong || null;
    const dias = ultimaData ? daysSince(toIso(ultimaData)) : null;
    const ebs = esbocos.filter(e => (o.esbocoIds||[]).includes(e.id));
    return { ...o, ultimaData, ultimaCong, dias, ebs };
  }).sort((a, b) => {
    if (a.dias === null && b.dias === null) return a.nome.localeCompare(b.nome);
    if (a.dias === null) return -1;
    if (b.dias === null) return 1;
    return b.dias - a.dias;
  });

  const toggleSel = (id) => setSelecionados(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id]);
  const toggleAll = () => setSelecionados(selecionados.length === oradorComRotacao.length ? [] : oradorComRotacao.map(o=>o.id));

  const gerarRelatorio = async () => {
    const sels = oradorComRotacao.filter(o => selecionados.includes(o.id));
    const mesLabel = `${MESES[mes]} ${ano}`;
    const linhas = [];
    linhas.push(`📊 *Relatório de Oradores — ${mesLabel}*`);
    linhas.push(`🏛 Congregação Alto da Colina`);
    linhas.push(``);
    linhas.push(`━━━━━━━━━━━━━━━━━━━━━`);
    sels.forEach((o) => {
      linhas.push(`Orador: ${o.nome}`);
      if (o.ebs.length === 0) {
        linhas.push(`Tema: –`);
      } else {
        o.ebs.forEach(eb => {
          linhas.push(`Tema: ${eb.n} – ${eb.tema}`);
        });
      }
      linhas.push(``);
    });
    linhas.push(`━━━━━━━━━━━━━━━━━━━━━`);
    linhas.push(`_${sels.length} orador${sels.length!==1?"es":""} · ${mesLabel}_`);
    const texto = linhas.join("\n");
    try {
      if (navigator.share) { await navigator.share({ title:`Rel. Oradores ${mesLabel}`, text:texto }); return; }
    } catch(_) {}
    try { await navigator.clipboard.writeText(texto); }
    catch(_) {
      const ta = document.createElement("textarea");
      ta.value = texto; document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); document.body.removeChild(ta);
    }
    setCopiado(true); setTimeout(()=>setCopiado(false), 3000);
  };

  return (
    <div style={{padding:"14px"}}>
      {/* Month selector */}
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,background:`linear-gradient(135deg,${P.sky},${P.teal})`,borderRadius:14,padding:"12px 14px"}}>
        <button onClick={()=>{if(mes===0){setMes(11);setAno(a=>a-1);}else setMes(m=>m-1);}}
          style={{background:"rgba(255,255,255,.2)",border:"none",color:"#fff",borderRadius:10,padding:"7px 12px",cursor:"pointer",fontWeight:700}}>◀</button>
        <div style={{flex:1,textAlign:"center",fontWeight:800,fontSize:15,color:"#fff"}}>{MESES[mes]} {ano}</div>
        <button onClick={()=>{if(mes===11){setMes(0);setAno(a=>a+1);}else setMes(m=>m+1);}}
          style={{background:"rgba(255,255,255,.2)",border:"none",color:"#fff",borderRadius:10,padding:"7px 12px",cursor:"pointer",fontWeight:700}}>▶</button>
      </div>

      {/* Header row */}
      <div style={{display:"flex",alignItems:"center",marginBottom:10}}>
        <div style={{flex:1,fontSize:12,fontWeight:700,color:P.sub}}>
          {oradorComRotacao.length} ORADORES · {selecionados.length} SELECIONADO{selecionados.length!==1?"S":""}
        </div>
        <button onClick={toggleAll}
          style={{background:P.slateL,border:"none",color:P.sub,borderRadius:8,padding:"5px 12px",fontSize:11,fontWeight:700,cursor:"pointer"}}>
          {selecionados.length === oradorComRotacao.length ? "Limpar" : "Todos"}
        </button>
      </div>

      {/* Orador cards */}
      <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:14}}>
        {oradorComRotacao.map(o => {
          const cor = corRotacao(o.dias);
          const sel = selecionados.includes(o.id);
          const eb  = o.ebs[0];
          return (
            <div key={o.id} onClick={()=>toggleSel(o.id)}
              style={{background:sel?P.skyL:P.white,borderRadius:14,padding:"12px 14px",boxShadow:"0 1px 4px rgba(0,0,0,.06)",cursor:"pointer",border:`2px solid ${sel?P.sky:P.border}`,display:"flex",alignItems:"center",gap:12,transition:"all .15s"}}>
              {/* Checkbox */}
              <div style={{width:22,height:22,borderRadius:6,border:`2px solid ${sel?P.sky:P.border}`,background:sel?P.sky:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,color:"#fff",fontSize:13,fontWeight:700}}>
                {sel?"✓":""}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:800,fontSize:13,color:P.text}}>{o.nome}</div>
                {eb&&<div style={{fontSize:10,color:P.sky,marginTop:1}}>📑 {eb.n} – {eb.tema.slice(0,35)}</div>}
                <div style={{fontSize:10,color:P.sub,marginTop:2}}>
                  📅 {o.ultimaData||"Nunca"}{o.ultimaCong?` · 🏠 ${o.ultimaCong}`:""}
                </div>
              </div>
              <span style={{background:cor.bg,color:cor.text,fontSize:11,fontWeight:800,padding:"4px 8px",borderRadius:8,flexShrink:0}}>
                {cor.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Generate button */}
      {selecionados.length > 0 && (
        <button onClick={gerarRelatorio}
          style={{width:"100%",background:copiado?"#16a34a":`linear-gradient(135deg,${P.sky},${P.teal})`,border:"none",color:"#fff",borderRadius:14,padding:"14px",fontWeight:800,fontSize:14,cursor:"pointer",transition:"background .3s"}}>
          {copiado ? "✓ Copiado!" : `📲 Copiar Relatório (${selecionados.length})`}
        </button>
      )}
      {selecionados.length === 0 && (
        <div style={{textAlign:"center",color:P.sub,fontSize:13,padding:"12px 0",fontStyle:"italic"}}>
          Selecione os oradores para gerar o relatório
        </div>
      )}
    </div>
  );
}

function PrintView({mes,ano,filtV,filtS,getEsboco,getCong,mesLabel,onClose}) {
  const [copiado, setCopiado] = useState(false);
  const compartilhar = async () => {
    const linhas = [];
    linhas.push(`📋 *Programação Discursos — ${mesLabel}*`);
    linhas.push(``);
    linhas.push(`🏛 *Congregação Alto da Colina*`);
    linhas.push(`📍 José do Patrocínio 249, Cidade Nova, Indaiatuba/SP`);
    linhas.push(`🕐 Sábado às *19:00*`);
    linhas.push(``);
    linhas.push(`━━━━━━━━━━━━━━━━━━━━━━`);
    linhas.push(`📥 *ORADORES VISITANTES*`);
    linhas.push(`━━━━━━━━━━━━━━━━━━━━━━`);
    if (filtV.length === 0) { linhas.push(`_Nenhum visitante neste mês_`); }
    else { filtV.forEach((v,i) => { const e=getEsboco(v.esbocoId); if(i>0)linhas.push(``); linhas.push(`📅 *${v.data}*`); linhas.push(`🎤 Orador: ${v.orador}`); linhas.push(`📑 Tema: ${e?`${e.n} – ${e.tema}`:"–"}`); linhas.push(`🏠 Congregação: ${v.cong}`); }); }
    linhas.push(``);
    linhas.push(`━━━━━━━━━━━━━━━━━━━━━━`);
    linhas.push(`📤 *SAÍDAS DE ORADORES*`);
    linhas.push(`━━━━━━━━━━━━━━━━━━━━━━`);
    if (filtS.length === 0) { linhas.push(`_Nenhuma saída neste mês_`); }
    else { filtS.forEach((s,i) => { const e=getEsboco(s.esbocoId); const cong=getCong(s.cong); if(i>0)linhas.push(``); linhas.push(`📅 *${s.data}*`); linhas.push(`🎤 Orador: ${s.oradorNome}`); linhas.push(`📑 Tema: ${e?`${e.n} – ${e.tema}`:"–"}`); linhas.push(`🏠 Congregação: ${s.cong}`); if(cong&&cong.end)linhas.push(`📍 Endereço: ${cong.end}`); }); }
    linhas.push(``);
    linhas.push(`━━━━━━━━━━━━━━━━━━━━━━`);
    linhas.push(`📊 *Resumo:* ${filtV.length} visitante${filtV.length!==1?"s":""} | ${filtS.length} saída${filtS.length!==1?"s":""}`);
    linhas.push(``);
    linhas.push(`_Gerado em ${new Date().toLocaleDateString("pt-BR")} · Arranjo de Oradores_`);
    const texto = linhas.join("\n");
    try { if(navigator.share){await navigator.share({title:`Programação ${mesLabel}`,text:texto});return;} } catch(_) {}
    try { await navigator.clipboard.writeText(texto); } catch(_) { const ta=document.createElement("textarea");ta.value=texto;document.body.appendChild(ta);ta.select();document.execCommand("copy");document.body.removeChild(ta); }
    setCopiado(true); setTimeout(()=>setCopiado(false),3000);
  };
  return (
    <div style={{position:"fixed",inset:0,background:P.bg,zIndex:999,overflowY:"auto",fontFamily:"'Nunito',sans-serif"}}>
      <div style={{position:"sticky",top:0,background:P.white,borderBottom:`1px solid ${P.border}`,padding:"10px 14px",display:"flex",alignItems:"center",gap:10,zIndex:1}}>
        <button onClick={onClose} style={{background:P.slateL,border:"none",borderRadius:10,padding:"8px 12px",cursor:"pointer",fontWeight:700,fontSize:13}}>← Voltar</button>
        <div style={{flex:1,fontWeight:800,fontSize:15,color:P.text}}>{mesLabel}</div>
        <button onClick={compartilhar} style={{background:copiado?"#16a34a":`linear-gradient(135deg,${P.sky},${P.teal})`,border:"none",color:"#fff",borderRadius:10,padding:"8px 14px",fontWeight:700,fontSize:12,cursor:"pointer"}}>
          {copiado?"✓ Copiado!":"📲 Enviar WhatsApp"}
        </button>
      </div>
      <div style={{padding:"16px",maxWidth:600,margin:"0 auto"}}>
        <div style={{background:`linear-gradient(135deg,${P.sky},${P.teal})`,color:"#fff",borderRadius:14,padding:16,marginBottom:14}}>
          <div style={{fontWeight:900,fontSize:17,marginBottom:4}}>📋 Programação de Discursos</div>
          <div style={{fontSize:10,opacity:.85,lineHeight:1.6}}>Congregação Alto da Colina<br/>José do Patrocínio 249, Cidade Nova, Indaiatuba/SP<br/>Horário: 18:00</div>
          <div style={{fontWeight:900,fontSize:20,marginTop:8}}>{mesLabel}</div>
        </div>
        <div style={{display:"flex",gap:8,marginBottom:14}}>
          {[[filtV.length,"Visitantes","#7c3aed","#ede9fe"],[filtS.length,"Saídas","#0284c7","#e0f2fe"]].map(([v,l,c,bg])=>(
            <div key={l} style={{flex:1,background:bg,borderRadius:10,padding:"10px",textAlign:"center"}}>
              <div style={{fontSize:22,fontWeight:900,color:c}}>{v}</div>
              <div style={{fontSize:10,color:P.sub}}>{l}</div>
            </div>
          ))}
        </div>
        {[
          {items:filtV,tipo:"v",title:"📥 Oradores Visitantes",color:"#7c3aed",bg:"#ede9fe",badge:"#7c3aed"},
          {items:filtS,tipo:"s",title:"📤 Saídas de Oradores",color:"#0284c7",bg:"#e0f2fe",badge:"#0284c7"},
        ].map(sec=>(
          <div key={sec.tipo} style={{border:`1px solid ${P.border}`,borderRadius:10,overflow:"hidden",marginBottom:14}}>
            <div style={{background:sec.bg,padding:"10px 14px",display:"flex",alignItems:"center"}}>
              <span style={{fontWeight:800,fontSize:13,color:sec.color,flex:1}}>{sec.title}</span>
              <span style={{background:sec.badge,color:"#fff",borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:800}}>{sec.items.length}</span>
            </div>
            {sec.items.length===0
              ?<div style={{padding:16,textAlign:"center",color:P.sub,fontStyle:"italic",fontSize:12}}>Nenhum registro</div>
              :sec.items.map((x,i)=>{
                const isV=sec.tipo==="v";
                const eb=getEsboco(x.esbocoId);
                const nome=isV?x.orador:x.oradorNome;
                const st=STATUS[x.status];
                return(
                  <div key={x.id} style={{display:"grid",gridTemplateColumns:"60px 1fr 1fr",gap:8,padding:"10px 14px",borderTop:`1px solid ${P.border}`,background:i%2===0?"#FAFBFC":"#fff",fontSize:12}}>
                    <div style={{color:P.sky,fontWeight:700}}>{x.data.slice(0,5)}</div>
                    <div><b>{nome}</b>{eb&&<div style={{color:sec.color,fontSize:10,marginTop:2}}>📑 {eb.n} – {eb.tema.slice(0,30)}</div>}</div>
                    <div style={{color:P.text}}>{x.cong}{st&&<div><span style={{background:st.bg,color:st.color,fontSize:9,fontWeight:700,padding:"2px 6px",borderRadius:6,marginTop:4,display:"inline-block"}}>{st.label}</span></div>}</div>
                  </div>
                );
              })
            }
          </div>
        ))}
        <div style={{textAlign:"center",fontSize:10,color:P.sub,fontStyle:"italic",paddingBottom:20}}>
          Gerado em {new Date().toLocaleDateString("pt-BR")} · Arranjo de Oradores
        </div>
      </div>
    </div>
  );
}

// ── MODAL LAYER ───────────────────────────────────────────
function ModalLayer({modal,setModal,toast$,oradores,setOradores,visitantes,setVisitantes,saidas,setSaidas,congregacoes,setCongregacoes,esbocos,setEsbocos}) {
  const close=()=>setModal(null);
  const p={close,toast$,oradores,setOradores,visitantes,setVisitantes,saidas,setSaidas,congregacoes,setCongregacoes,esbocos,setEsbocos};
  const map={visitante:VisitanteForm,saida:SaidaForm,orador:OradorForm,cong:CongForm,esboco:EsbocoForm};
  const Comp=map[modal.type];
  if(!Comp)return null;
  return (
    <div style={{position:"fixed",inset:0,zIndex:500,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
      <div style={{position:"absolute",inset:0,background:"rgba(15,23,42,.5)",backdropFilter:"blur(4px)"}} onClick={close}/>
      <div className="slide" style={{position:"relative",background:P.white,borderRadius:"24px 24px 0 0",maxHeight:"90vh",overflowY:"auto",paddingBottom:24}}>
        <div style={{width:40,height:4,background:P.border,borderRadius:4,margin:"12px auto 4px"}}/>
        <Comp modal={modal} {...p}/>
      </div>
    </div>
  );
}

function Shell({title,color=P.sky,onClose,onSave,onDel,children}) {
  return (
    <>
      <div style={{padding:"8px 18px 14px",borderBottom:`1px solid ${P.border}`}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:5,height:22,background:color,borderRadius:4}}/>
          <span style={{fontWeight:900,fontSize:17,color:P.text,flex:1}}>{title}</span>
          {onDel&&<button onClick={onDel} style={{background:P.roseL,border:"none",color:P.rose,borderRadius:10,padding:"6px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}>🗑 Remover</button>}
        </div>
      </div>
      <div style={{padding:"12px 18px 0"}}>{children}</div>
      <div style={{display:"flex",gap:10,padding:"16px 18px 0"}}>
        <button onClick={onClose} style={{flex:1,background:P.slateL,border:"none",color:P.sub,borderRadius:14,padding:"14px",fontWeight:800,fontSize:14,cursor:"pointer"}}>Cancelar</button>
        <button onClick={onSave} style={{flex:2,background:color,border:"none",color:"#fff",borderRadius:14,padding:"14px",fontWeight:800,fontSize:14,cursor:"pointer"}}>Salvar</button>
      </div>
    </>
  );
}

const FL=({children})=><div style={{fontSize:13,fontWeight:800,color:P.text,marginBottom:6,marginTop:12}}>{children}</div>;
const FI=({style,...p})=><input {...p} style={{width:"100%",background:"#fff",border:`2px solid ${P.border}`,borderRadius:12,padding:"12px 14px",fontSize:14,outline:"none",color:P.text,...style}}/>;
const FS=({children,...p})=><select {...p} style={{width:"100%",background:"#fff",border:`2px solid ${P.border}`,borderRadius:12,padding:"12px 14px",fontSize:14,outline:"none",color:P.text}}>{children}</select>;
const StatusPills=({val,onChange})=>(
  <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:4}}>
    {Object.entries(STATUS).map(([k,v])=>(
      <button key={k} onClick={()=>onChange(k)} style={{background:val===k?v.color:v.bg,color:val===k?"#fff":v.color,border:"none",borderRadius:20,padding:"6px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}}>{v.label}</button>
    ))}
  </div>
);

// ── FORMS ─────────────────────────────────────────────────
function EsbocoForm({modal,close,esbocos,setEsbocos,toast$}) {
  const isNew=!modal.data;
  const [f,setF]=useState(modal.data||{n:"",tema:"",ultimo:""});
  const s=(k,v)=>setF(x=>({...x,[k]:v}));
  const save = async () => {
    if(!f.n||!f.tema) return toast$("Número e tema são obrigatórios",false);
    try {
      if(isNew){const [res]=await db.insert("esbocos",toDB.esboco(f));setEsbocos(p=>[...p,fromDB.esboco(res)]);}
      else{await db.update("esbocos",f.id,toDB.esboco(f));setEsbocos(p=>p.map(e=>e.id===f.id?{...f,n:+f.n}:e));}
      toast$(isNew?"Esboço adicionado!":"Esboço atualizado!"); close();
    } catch(e){toast$("Erro ao salvar: "+e.message,false);}
  };
  const del = async () => {
    try{await db.delete("esbocos",f.id);setEsbocos(p=>p.filter(e=>e.id!==f.id));toast$("Esboço removido!");close();}
    catch(e){toast$("Erro ao remover",false);}
  };
  return (
    <Shell title={isNew?"Novo Esboço":"Editar Esboço"} color={P.teal} onClose={close} onSave={save} onDel={!isNew?del:null}>
      <FL>Número *</FL><FI type="number" value={f.n} onChange={e=>s("n",e.target.value)} placeholder="Ex: 42"/>
      <FL>Tema *</FL><FI value={f.tema} onChange={e=>s("tema",e.target.value)} placeholder="Tema do esboço"/>
      <FL>Data do último discurso</FL><FI value={f.ultimo} onChange={e=>s("ultimo",e.target.value)} placeholder="dd/mm/aaaa"/>
    </Shell>
  );
}

function OradorForm({modal,close,oradores,setOradores,esbocos,toast$}) {
  const isNew=!modal.data;
  const [f,setF]=useState(modal.data||{nome:"",cel:"",esbocoIds:[],status:"pendente"});
  const [showPicker,setShowPicker]=useState(false);
  const [pickerQ,setPickerQ]=useState("");
  const s=(k,v)=>setF(x=>({...x,[k]:v}));
  const ac=avatarColor(f.nome||"?");
  const temasDoOrador=esbocos.filter(e=>(f.esbocoIds||[]).includes(e.id)).sort((a,b)=>a.n-b.n);
  const temasDisponiveis=esbocos.filter(e=>!(f.esbocoIds||[]).includes(e.id)).filter(e=>!pickerQ||e.tema.toLowerCase().includes(pickerQ.toLowerCase())||String(e.n).includes(pickerQ));
  const removeEsboco=id=>s("esbocoIds",(f.esbocoIds||[]).filter(x=>x!==id));
  const addEsboco=id=>{s("esbocoIds",[...(f.esbocoIds||[]),id]);setShowPicker(false);setPickerQ("");};
  const save = async () => {
    if(!f.nome||!f.cel) return toast$("Nome e celular são obrigatórios",false);
    try {
      if(isNew){const [res]=await db.insert("oradores",toDB.orador(f));setOradores(p=>[...p,fromDB.orador(res)]);}
      else{await db.update("oradores",f.id,toDB.orador(f));setOradores(p=>p.map(o=>o.id===f.id?f:o));}
      toast$(isNew?"Orador adicionado!":"Orador atualizado!"); close();
    } catch(e){toast$("Erro ao salvar: "+e.message,false);}
  };
  const del = async () => {
    try{await db.delete("oradores",f.id);setOradores(p=>p.filter(o=>o.id!==f.id));toast$("Orador removido!");close();}
    catch(e){toast$("Erro ao remover",false);}
  };
  return (
    <Shell title={isNew?"Novo Orador":"Editar Orador"} color={ac} onClose={close} onSave={save} onDel={!isNew?del:null}>
      {f.nome&&<div style={{textAlign:"center",margin:"4px 0 10px"}}><div style={{width:60,height:60,borderRadius:20,background:ac,display:"inline-flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:900,fontSize:22}}>{initials(f.nome)}</div></div>}
      <FL>Nome *</FL><FI value={f.nome} onChange={e=>s("nome",e.target.value)} placeholder="Nome completo"/>
      <FL>Celular *</FL><FI type="tel" value={f.cel} onChange={e=>s("cel",e.target.value)} placeholder="(19) 99999-9999"/>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:14}}>
        <span style={{fontSize:12,fontWeight:700,color:P.sub}}>TEMAS ({temasDoOrador.length})</span>
        <button onClick={()=>setShowPicker(true)} style={{background:P.sky,border:"none",color:"#fff",borderRadius:8,padding:"4px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>+ Tema</button>
      </div>
      {temasDoOrador.length===0?<div style={{background:P.slateL,borderRadius:12,padding:"12px",textAlign:"center",color:P.sub,fontSize:12,marginTop:6}}>Nenhum tema vinculado</div>:(
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {temasDoOrador.map(e=>(
            <div key={e.id} style={{background:P.skyL,borderRadius:12,padding:"10px 12px",display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:32,height:32,borderRadius:10,background:P.sky,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:12}}>{e.n}</div>
              <span style={{flex:1,fontSize:12,fontWeight:600,color:P.text}}>{e.tema}</span>
              <button onClick={()=>removeEsboco(e.id)} style={{background:"none",border:"none",color:P.rose,cursor:"pointer",fontSize:16}}>✕</button>
            </div>
          ))}
        </div>
      )}
      {showPicker&&(
        <div style={{position:"fixed",inset:0,zIndex:600,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
          <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.4)"}} onClick={()=>setShowPicker(false)}/>
          <div style={{position:"relative",background:"#fff",borderRadius:"20px 20px 0 0",padding:"16px",maxHeight:"60vh",display:"flex",flexDirection:"column"}}>
            <div style={{fontWeight:800,fontSize:15,marginBottom:10}}>Selecionar tema</div>
            <input autoFocus value={pickerQ} onChange={e=>setPickerQ(e.target.value)} placeholder="Buscar…"
              style={{background:P.slateL,border:"none",borderRadius:12,padding:"10px 14px",fontSize:13,marginBottom:10,outline:"none"}}/>
            <div style={{overflowY:"auto",flex:1,display:"flex",flexDirection:"column",gap:4}}>
              {temasDisponiveis.length===0?<div style={{textAlign:"center",color:P.sub,padding:20}}>Nenhum tema disponível</div>:temasDisponiveis.map(e=>(
                <div key={e.id} onClick={()=>addEsboco(e.id)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:12,cursor:"pointer",background:P.slateL}}>
                  <div style={{width:30,height:30,borderRadius:8,background:P.sky+"33",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:11,color:P.sky}}>{e.n}</div>
                  <span style={{fontSize:12,color:P.text}}>{e.tema}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <FL>Status</FL><StatusPills val={f.status} onChange={v=>s("status",v)}/>
    </Shell>
  );
}

function VisitanteForm({modal,close,visitantes,setVisitantes,esbocos,congregacoes,toast$}) {
  const isNew=!modal.data;
  const [f,setF]=useState(modal.data||{cong:"",dia:"Sábado",data:"",hora:"19:00",orador:"",esbocoId:null,congregacaoLocal:"Alto da Colina",endereco:"",relatorioId:"",status:"pendente"});
  const s=(k,v)=>setF(x=>({...x,[k]:v}));
  const save = async () => {
    if(!f.cong||!f.data||!f.orador) return toast$("Congregação, data e orador são obrigatórios",false);
    try {
      if(isNew){const [res]=await db.insert("visitantes",toDB.visit(f));setVisitantes(p=>[...p,fromDB.visit(res)]);}
      else{await db.update("visitantes",f.id,toDB.visit(f));setVisitantes(p=>p.map(v=>v.id===f.id?f:v));}
      toast$(isNew?"Visitante adicionado!":"Visitante atualizado!"); close();
    } catch(e){toast$("Erro ao salvar: "+e.message,false);}
  };
  const del = async () => {
    try{await db.delete("visitantes",f.id);setVisitantes(p=>p.filter(v=>v.id!==f.id));toast$("Removido!");close();}
    catch(e){toast$("Erro ao remover",false);}
  };
  return (
    <Shell title={isNew?"Nova Visita":"Editar Visita"} color={P.violet} onClose={close} onSave={save} onDel={!isNew?del:null}>
      <FL>Congregação Visitante *</FL>
      <FS value={f.cong} onChange={e=>s("cong",e.target.value)}>
        <option value="">Selecionar…</option>
        {congregacoes.map(c=><option key={c.id} value={c.nome}>{c.nome}</option>)}
        <option value="__outro">Outra congregação</option>
      </FS>
      {f.cong==="__outro"&&<FI value="" onChange={e=>s("cong",e.target.value)} placeholder="Nome da congregação"/>}
      <FL>Data *</FL><FI type="date" value={toIso(f.data)} onChange={e=>s("data",toBr(e.target.value))}/>
      <FL>Hora</FL><FI type="time" value={f.hora} onChange={e=>s("hora",e.target.value)}/>
      <FL>Orador *</FL><FI value={f.orador} onChange={e=>s("orador",e.target.value)} placeholder="Nome do orador visitante"/>
      <FL>Tema / Esboço</FL>
      <FS value={f.esbocoId||""} onChange={e=>s("esbocoId",+e.target.value||null)}>
        <option value="">Nenhum</option>
        {[...esbocos].sort((a,b)=>a.n-b.n).map(e=><option key={e.id} value={e.id}>{e.n} – {e.tema}</option>)}
      </FS>
      <FL>Status</FL><StatusPills val={f.status} onChange={v=>s("status",v)}/>
    </Shell>
  );
}

function SaidaForm({modal,close,saidas,setSaidas,oradores,congregacoes,esbocos,toast$}) {
  const isNew=!modal.data;
  const primeiroOrador=oradores[0];
  const [f,setF]=useState(modal.data||{data:"",oradorId:primeiroOrador?primeiroOrador.id:null,oradorNome:primeiroOrador?primeiroOrador.nome:"",cong:"",esbocoId:null,status:"pendente"});
  const s=(k,v)=>setF(x=>({...x,[k]:v}));
  const oradorSel=oradores.find(o=>o.id===f.oradorId);
  const temasDoOrador=oradorSel?esbocos.filter(e=>(oradorSel.esbocoIds||[]).includes(e.id)).sort((a,b)=>a.n-b.n):[];
  const save = async () => {
    if(!f.data||!f.cong) return toast$("Data e congregação são obrigatórios",false);
    try {
      if(isNew){const [res]=await db.insert("saidas",toDB.saida(f));setSaidas(p=>[...p,fromDB.saida(res)]);}
      else{await db.update("saidas",f.id,toDB.saida(f));setSaidas(p=>p.map(x=>x.id===f.id?f:x));}
      toast$(isNew?"Saída adicionada!":"Saída atualizada!"); close();
    } catch(e){toast$("Erro ao salvar: "+e.message,false);}
  };
  const del = async () => {
    try{await db.delete("saidas",f.id);setSaidas(p=>p.filter(x=>x.id!==f.id));toast$("Removido!");close();}
    catch(e){toast$("Erro ao remover",false);}
  };
  return (
    <Shell title={isNew?"Nova Saída":"Editar Saída"} color={P.sky} onClose={close} onSave={save} onDel={!isNew?del:null}>
      <FL>Data</FL><FI type="date" value={toIso(f.data)} onChange={e=>s("data",toBr(e.target.value))}/>
      <FL>Orador *</FL>
      <FS value={f.oradorId||""} onChange={e=>{const o=oradores.find(x=>x.id===+e.target.value);s("oradorId",+e.target.value);s("oradorNome",o?o.nome:"");}}>
        <option value="">Selecionar…</option>
        {oradores.map(o=><option key={o.id} value={o.id}>{o.nome}</option>)}
      </FS>
      <FL>Tema do discurso</FL>
      {temasDoOrador.length===0
        ?<div style={{background:P.slateL,borderRadius:12,padding:"10px 14px",fontSize:12,color:P.sub}}>Selecione um orador com temas vinculados</div>
        :<FS value={f.esbocoId||""} onChange={e=>s("esbocoId",+e.target.value||null)}>
          <option value="">Selecionar tema…</option>
          {temasDoOrador.map(e=><option key={e.id} value={e.id}>{e.n} – {e.tema}</option>)}
        </FS>
      }
      <FL>Congregação de Destino</FL>
      <FS value={f.cong} onChange={e=>s("cong",e.target.value)}>
        <option value="">Selecionar…</option>
        {congregacoes.map(c=><option key={c.id} value={c.nome}>{c.nome}</option>)}
      </FS>
      <FL>Status</FL><StatusPills val={f.status} onChange={v=>s("status",v)}/>
    </Shell>
  );
}

function CongForm({modal,close,congregacoes,setCongregacoes,toast$}) {
  const isNew=!modal.data;
  const [f,setF]=useState(modal.data||{nome:"",dia:"Domingo",hora:"9:00",contato:"",tel:"",end:""});
  const s=(k,v)=>setF(x=>({...x,[k]:v}));
  const save = async () => {
    if(!f.nome) return toast$("Nome é obrigatório",false);
    try {
      if(isNew){const [res]=await db.insert("congregacoes",toDB.cong(f));setCongregacoes(p=>[...p,fromDB.cong(res)]);}
      else{await db.update("congregacoes",f.id,toDB.cong(f));setCongregacoes(p=>p.map(c=>c.id===f.id?f:c));}
      toast$(isNew?"Congregação adicionada!":"Congregação atualizada!"); close();
    } catch(e){toast$("Erro ao salvar: "+e.message,false);}
  };
  const del = async () => {
    try{await db.delete("congregacoes",f.id);setCongregacoes(p=>p.filter(c=>c.id!==f.id));toast$("Removido!");close();}
    catch(e){toast$("Erro ao remover",false);}
  };
  return (
    <Shell title={isNew?"Nova Congregação":"Editar Congregação"} color={P.amber} onClose={close} onSave={save} onDel={!isNew?del:null}>
      <FL>Nome *</FL><FI value={f.nome} onChange={e=>s("nome",e.target.value)} placeholder="Nome da congregação"/>
      <FL>Dia da Reunião *</FL>
      <FS value={f.dia} onChange={e=>s("dia",e.target.value)}>
        {["Domingo","Sábado","Segunda","Terça","Quarta","Quinta","Sexta"].map(d=><option key={d} value={d}>{d}</option>)}
      </FS>
      <FL>Horário *</FL><FI value={f.hora} onChange={e=>s("hora",e.target.value)} placeholder="Ex: 9:00"/>
      <FL>Contato *</FL><FI value={f.contato} onChange={e=>s("contato",e.target.value)}/>
      <FL>Telefone</FL><FI type="tel" value={f.tel} onChange={e=>s("tel",e.target.value)}/>
      <FL>Endereço</FL><FI value={f.end} onChange={e=>s("end",e.target.value)}/>
    </Shell>
  );
}

function Empty() {
  return <div style={{textAlign:"center",padding:"40px 0",color:P.sub,fontSize:14}}>📭 Nenhum registro encontrado</div>;
}
