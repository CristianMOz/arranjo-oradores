# Avisos de WhatsApp por congregação

Regra de ouro: **isolamento total por congregação**. Toda configuração, fila e
registro de envio pertence a um `tenant_id`, e o RLS impede que uma congregação
veja ou altere a fila de outra.

## O fluxo

1. Cada congregação abre a aba **📲 WhatsApp** e configura na sub-aba
   *Configuração*: quem pode enviar, qual número aparece como remetente, em que
   dia e hora o preparo roda, o que avisar e os modelos de mensagem.
2. No dia e hora escolhidos (padrão: **segunda-feira, 08:00**, no fuso da
   congregação), o banco monta a fila do próximo fim de semana **de cada
   congregação separadamente**.
3. O preparo confere se o aviso já foi enviado antes. Se foi, não regera e não
   reescreve — apenas conta como "já enviado".
4. Em **modo prévia** (padrão) a fila fica em *rascunho*. Alguém autorizado
   revisa, edita se precisar, aprova, abre no WhatsApp e marca como enviado.
5. Em **modo automático** a fila já sai aprovada e o disparador envia pelo
   provedor configurado.

Tudo fica registrado: cada execução em `whatsapp_runs` e cada aviso em
`whatsapp_messages`, com autor e horário da aprovação e do envio.

## Comece pelo modo prévia

O modo padrão é `previa` com provedor `manual`. Nesse arranjo nenhuma mensagem
sai sozinha: o app monta o texto e abre o WhatsApp para uma pessoa enviar. Só
ligue o modo automático depois de algumas semanas com a prévia redonda.

Uma trava no banco impede a combinação perigosa: `mode = 'automatico'` exige
`provider <> 'manual'`.

## Tabelas

| Tabela | Para quê |
| --- | --- |
| `whatsapp_settings` | Uma linha por congregação: horário, modo, provedor, número e modelos. |
| `whatsapp_senders` | Quem pode aprovar e enviar. Owner e admin já podem. |
| `whatsapp_runs` | Registro de cada preparo: janela olhada e contadores. |
| `whatsapp_messages` | A fila e o log de envio, com `dedupe_key` único por congregação. |

Nenhuma dessas tabelas aceita escrita direta do cliente. Toda alteração passa
por funções `security definer` que checam a permissão antes de gravar.

## As travas

- **Duplicidade:** índice único em `(tenant_id, dedupe_key)`, onde a chave é
  `tipo:id_do_arranjo:data`. O mesmo arranjo nunca vira dois avisos.
- **Reenvio:** o preparo ignora qualquer aviso com situação `enviado`, mesmo que
  o arranjo mude depois. `whatsapp_definir_status` também recusa reescrever um
  aviso enviado.
- **Aprovação vencida:** se o arranjo mudar depois da aprovação, o aviso volta
  para *rascunho* e precisa ser aprovado de novo.
- **Sem número:** um aviso sem celular utilizável fica como *sem número* e não
  pode ser aprovado nem enviado. Ele aparece na fila justamente para mostrar
  qual cadastro está faltando.
- **Permissão:** preparar, editar, aprovar e enviar exigem owner, admin ou estar
  em `whatsapp_senders`. Alterar a configuração exige owner ou admin.
- **Segredos:** tokens do provedor ficam nos *secrets* da Edge Function. O
  cliente nunca recebe `service_role`.

## Modelos de mensagem

Use `{campo}` no texto. **Se o campo estiver vazio no arranjo, a linha inteira
some da mensagem** — por isso cada campo opcional fica na sua própria linha nos
modelos padrão.

Campos da saída: `orador`, `primeiro_nome`, `data`, `dia_semana`, `hora`,
`congregacao_destino`, `endereco`, `contato`, `telefone_contato`, `tema_numero`,
`tema`, `congregacao`, `responsavel`.

Campos do visitante: `orador`, `primeiro_nome`, `contato`, `data`, `dia_semana`,
`hora`, `congregacao`, `congregacao_visitante`, `endereco`, `tema_numero`,
`tema`, `responsavel`.

A tela mostra a prévia com dados de exemplo antes de salvar.

## Implantação

1. Faça backup/snapshot do projeto Supabase.
2. Aplique `supabase/migrations/20260815120000_whatsapp_por_congregacao.sql`.
   Ela cria a configuração padrão de todas as congregações existentes e um
   gatilho que faz o mesmo para as novas.
3. Publique a aplicação. A aba **📲 WhatsApp** aparece para todos os membros;
   a sub-aba *Configuração* só é editável por owner e admin.
4. Confirme o agendamento (abaixo).
5. Valide com a lista do final deste documento.

### Agendamento semanal

A migração agenda, quando `pg_cron` está disponível, um job de hora em hora:

```sql
select cron.schedule('whatsapp-tick', '5 * * * *', 'select private.whatsapp_cron_tick();');
```

O job percorre as congregações com preparo ligado e só monta a fila daquela cujo
**dia e hora locais** bateram, no máximo uma vez por dia. Se `pg_cron` não
estiver habilitado, a migração avisa e nada quebra: dá para habilitar depois
(`create extension pg_cron;` no dashboard) e rodar o `cron.schedule` acima, ou
chamar `private.whatsapp_cron_tick()` por um agendador externo.

Enquanto isso, o botão **Gerar prévia** monta a fila na hora.

### Ligar o envio automático

1. Escolha o provedor na tela de configuração (`meta_cloud` ou `webhook`) e mude
   o modo para *automático*.
2. Publique a função e cadastre os segredos:

```bash
supabase functions deploy whatsapp-dispatch
supabase secrets set WHATSAPP_DISPATCH_SECRET=... WHATSAPP_TOKEN=...
# webhook próprio:
supabase secrets set WHATSAPP_WEBHOOK_URL=... WHATSAPP_WEBHOOK_SECRET=...
```

3. Agende a chamada da função (Scheduled Functions do Supabase ou `pg_net`),
   sempre com o cabeçalho `x-dispatch-secret`.

A função só olha congregações em modo automático com provedor configurado, envia
no máximo `WHATSAPP_MAX_PER_RUN` avisos por execução (padrão 50) e grava o
resultado — inclusive a falha — em `whatsapp_messages`.

**Atenção com a Cloud API da Meta:** mensagens iniciadas pela congregação fora da
janela de 24 horas precisam de *template* aprovado pela Meta. O disparador envia
texto livre, que funciona para conversas já abertas; para o resto, cadastre um
template e ajuste `sendViaMeta`. Enquanto isso não estiver resolvido, o modo
prévia com envio manual continua sendo o caminho seguro.

## Validação obrigatória

- Duas congregações com arranjos no mesmo fim de semana geram filas separadas, e
  nenhuma enxerga a mensagem da outra.
- Rodar o preparo duas vezes seguidas não cria aviso duplicado.
- Um aviso marcado como enviado continua intacto depois de o arranjo mudar.
- Um orador sem celular aparece como *sem número* e não pode ser aprovado.
- `viewer` sem autorização não prepara, não aprova e não configura.
- `viewer` incluído em *Quem pode enviar* passa a preparar e aprovar.
- Modo automático com provedor manual é recusado pelo banco.
- `update` direto em `whatsapp_messages` pelo cliente é negado.
