# Avisos de WhatsApp por congregação

Regra de ouro: **isolamento total por congregação**. Toda configuração, fila e
registro de envio pertence a um `tenant_id`, e o RLS impede que uma congregação
veja ou altere a fila de outra.

O módulo **lê** as estruturas que já existem — `saidas`, `visitantes`,
`oradores`, `congregacoes`, `esbocos`, `tenants`. Não há cadastro paralelo de
discurso, orador ou congregação. Só duas colunas novas nas tabelas existentes,
para contatos que faltavam:

- `congregacoes.whatsapp` — WhatsApp do responsável pelo recebimento.
- `visitantes.orador_tel` — WhatsApp do orador visitante.

## O fluxo

1. A congregação abre a aba **📲 WhatsApp → Configuração**: quando preparar, o
   que avisar, para quem avisar, quem pode enviar e os modelos de mensagem.
2. No dia e hora escolhidos (padrão: **segunda-feira, 08:00**, no fuso da
   congregação), o banco monta a fila **do próximo dia de reunião daquela
   congregação**.
3. O preparo confere se o aviso já foi enviado antes. Se foi, não regera nem
   reescreve.
4. Em **modo prévia** (padrão e único liberado) a fila fica em *rascunho*.
   Alguém autorizado revisa, edita se precisar, aprova, abre no WhatsApp e marca
   como enviado.

Tudo fica registrado: cada execução em `whatsapp_runs` e cada aviso em
`whatsapp_messages`, com congregação, destinatário, texto, situação, autor e
horário da aprovação e do envio.

## Qual fim de semana o preparo procura

A busca não é uma janela solta de dias. O alvo é a **próxima ocorrência de cada
dia de reunião da congregação**, dentro de um horizonte:

- o dia principal vem de `tenants.meeting_day` — o mesmo campo que a tela de
  Programação já usa, sem duplicar configuração;
- congregações que também têm discurso em outro dia acrescentam esse dia em
  `extra_meeting_days` (por exemplo sábado **e** domingo);
- `window_days` é só o teto da procura (padrão 7 dias).

Rodando na segunda 17/08/2026: uma congregação de sábado procura só 22/08; uma
de domingo, só 23/08. Um discurso marcado para quarta 19/08 **não entra**.

## Para quem vai o aviso

Configurável por tipo de discurso, em `destino_saida` e `destino_visitante`:

| Valor | Quem recebe |
| --- | --- |
| `orador` | Saída: o orador da casa (`oradores.cel`). Visitante: o orador visitante (`visitantes.orador_tel`). |
| `responsavel` | O responsável da outra congregação (`congregacoes.whatsapp`, com o telefone geral como reserva). |
| `ambos` | Duas mensagens independentes, uma para cada um. |

O `dedupe_key` inclui o papel (`tipo:id:data:papel`), então "ambos" não colide
consigo mesmo e cada mensagem tem seu próprio ciclo de aprovação e envio.

Quando o WhatsApp do responsável está vazio e o preparo cai no telefone geral,
a mensagem é marcada com `phone_fallback` e a fila mostra o aviso *"usando o
telefone geral — confirme se é WhatsApp"*.

## Modelos de mensagem

São quatro, um por combinação: saída→orador, saída→responsável,
visitante→orador, visitante→responsável. Use `{campo}` no texto. **Se o campo
estiver vazio no arranjo, a linha inteira some da mensagem** — por isso cada
campo opcional fica na sua própria linha nos modelos padrão.

Campos: `nome_orador`, `primeiro_nome`, `data`, `dia_semana`, `horario`,
`congregacao_origem`, `congregacao_destino`, `tipo_discurso`, `tema`,
`tema_numero`, `endereco`, `contato`, `telefone_contato`, `responsavel`.

Apelidos aceitos por compatibilidade: `orador`, `hora`, `congregacao`,
`congregacao_visitante`.

`tipo_discurso` é derivado do próprio registro — "Discurso público — saída" ou
"Discurso público — visitante". Não existe cadastro novo para isso.

Na saída, `congregacao_origem` é a nossa congregação e `congregacao_destino` é
para onde o orador vai; no visitante é o contrário.

## As travas

- **Duplicidade:** índice único em `(tenant_id, dedupe_key)`.
- **Reenvio:** o preparo ignora qualquer aviso com situação `enviado`, mesmo que
  o arranjo mude depois. `whatsapp_definir_status` também recusa reescrever um
  aviso enviado.
- **Aprovação vencida:** se o arranjo mudar depois da aprovação, o aviso volta
  para *rascunho* e precisa ser aprovado de novo.
- **Rascunho obsoleto:** arranjo cancelado ou destinatário reconfigurado faz o
  rascunho sair da fila sozinho. Um aviso **aprovado** que ficou obsoleto nunca
  é cancelado automaticamente — ele aparece nas pendências para decisão humana.
- **Sem número:** aviso sem celular utilizável fica como *sem número* e não pode
  ser aprovado nem enviado. Aparece na fila para mostrar o cadastro que falta.
- **Data ilegível:** o registro não gera aviso, mas entra nas pendências da
  execução com tipo, id, congregação e a data como está gravada.
- **Permissão:** preparar, editar, aprovar e enviar exigem owner, admin ou estar
  em `whatsapp_senders`. Alterar a configuração exige owner ou admin.
- **Segredos:** tokens do provedor ficam nos *secrets* da Edge Function. O
  cliente nunca recebe `service_role`.

## 🔒 Envio automático — bloqueado até o C5

Hoje a credencial do provedor é **única para toda a instalação**. Como o
`provider_phone_id` é editado por cada congregação, uma poderia disparar usando
o número de outra. Enquanto isso não for resolvido:

- `whatsapp_salvar_config` recusa `mode = 'automatico'` para owner e admin de
  congregação, com mensagem explicando o motivo;
- um **gatilho** em `whatsapp_settings` recusa a mesma combinação vinda de
  qualquer caminho, inclusive `update` direto no banco — a trava não está na
  interface;
- só o administrador da plataforma consegue ligar, e apenas para teste;
- a Edge Function ainda exige `WHATSAPP_META_ENABLED=1` para falar com a Meta.

**Requisito obrigatório antes de liberar (C5 completo):** credencial por
congregação e validação de que o `phone_number_id` pertence àquela congregação.

### O que a Meta exige, para quando chegarmos lá

- Conta WhatsApp Business (WABA) com verificação do negócio.
- Número registrado na Cloud API, com o `phone_number_id` correspondente.
- **Template aprovado** para qualquer mensagem iniciada pelo sistema fora da
  janela de 24 horas. Lembrete de discurso é iniciado por nós, então cai nessa
  regra: precisa de template na categoria *utility*, sem linguagem promocional.
  O disparador atual envia texto livre, que só funciona em conversa já aberta —
  `sendViaMeta` terá de ser trocado por envio de template com parâmetros.
- Opt-in dos destinatários e caminho para pedir a parada dos avisos.

## Implantação

1. Faça backup/snapshot do projeto Supabase.
2. Aplique `supabase/migrations/20260815120000_whatsapp_por_congregacao.sql`.
   Ela adiciona as duas colunas, cria as tabelas do módulo, gera a configuração
   padrão de todas as congregações e um gatilho que faz o mesmo para as novas.
3. Publique a aplicação. A aba **📲 WhatsApp** aparece para todos os membros;
   a sub-aba *Configuração* só é editável por owner e admin.
4. Preencha o **WhatsApp do responsável** nas congregações de contato e, quando
   quiser avisar oradores visitantes, o **WhatsApp do orador** na visita.
5. Confirme o agendamento (abaixo) e valide com a lista do final.

### Agendamento semanal

Quando `pg_cron` está disponível, a migração agenda um job de hora em hora:

```sql
select cron.schedule('whatsapp-tick', '5 * * * *', 'select private.whatsapp_cron_tick();');
```

O tick percorre as congregações com preparo ligado e prepara a fila daquela cujo
**dia local** bateu e cujo **horário local já passou**, desde que ainda não tenha
havido preparo agendado hoje. Se o servidor falhar às 09:00, o ciclo das 10:00
recupera — uma vez só. Se `pg_cron` não estiver habilitado, a migração avisa e
nada quebra; o botão **Gerar prévia** monta a fila na hora.

## Validação obrigatória

- Congregação de sábado e congregação de domingo geram filas em datas
  diferentes, e um discurso de quarta-feira não entra em nenhuma delas.
- Destinatário `orador`, `responsavel` e `ambos` — este último gerando duas
  mensagens sem colisão de chave.
- Orador visitante com telefone próprio recebe o aviso.
- Responsável com WhatsApp específico usa esse número; sem ele, cai no telefone
  geral e a fila sinaliza a reserva.
- Rodar o preparo duas vezes seguidas não cria aviso duplicado.
- Aviso marcado como enviado continua intacto depois de o arranjo mudar.
- Owner ou admin de congregação **não** consegue ativar o modo automático, nem
  pela RPC nem por `update` direto.
- `viewer` sem autorização não prepara, não aprova e não configura; incluído em
  *Quem pode enviar*, passa a poder.
- Cron que perde a hora exata recupera no ciclo seguinte, uma única vez.
- Registro com data inválida aparece nas pendências da execução.
- `update` direto em `whatsapp_messages` pelo cliente é negado.
- Nenhuma congregação enxerga mensagem, execução ou configuração de outra, nem
  forçando o `tenant_id` no pedido.
