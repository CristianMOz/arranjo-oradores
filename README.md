# Arranjo de Oradores

Aplicativo React/Vite para programação de discursos, preparado para múltiplas congregações no mesmo projeto Supabase.

## Segurança e isolamento

- Login real pelo Supabase Auth (e-mail e senha).
- Cada registro operacional possui `tenant_id`.
- RLS limita leitura e escrita às congregações do usuário.
- Consultas e mutações do cliente sempre incluem o `tenant_id` selecionado.
- Acesso anônimo às tabelas operacionais é revogado.
- Administradores da plataforma podem criar uma congregação copiando dados selecionados de uma congregação-modelo.

## Avisos de WhatsApp

Cada congregação configura os próprios avisos na aba **📲 WhatsApp**: quem pode enviar, qual número é usado, em que dia e hora o preparo roda e os modelos de mensagem. Toda semana o banco monta a fila do próximo fim de semana de cada congregação separadamente, confere se o aviso já não foi enviado e registra tudo. O padrão é **modo prévia com revisão manual**; o envio automático só liga depois, com um provedor configurado. Detalhes em [docs/WHATSAPP.md](docs/WHATSAPP.md).

## Desenvolvimento

```bash
npm install
npm run dev
npm run lint
npm test
npm run build
```

Configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` na Vercel. Somente a chave pública pode ser usada no cliente; nunca exponha `service_role` ou uma secret key.

## Migração

As migrações ficam em `supabase/migrations/`, aplicadas em ordem:

1. `20260814111500_multi_tenant_foundation.sql` — isolamento multi-congregação. Procedimento em [docs/MULTI_TENANT_ROLLOUT.md](docs/MULTI_TENANT_ROLLOUT.md).
2. `20260815120000_whatsapp_por_congregacao.sql` — avisos de WhatsApp. Procedimento em [docs/WHATSAPP.md](docs/WHATSAPP.md).
