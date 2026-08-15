# Arranjo de Oradores

Aplicativo React/Vite para programação de discursos, preparado para múltiplas congregações no mesmo projeto Supabase.

## Segurança e isolamento

- Login real pelo Supabase Auth (e-mail e senha).
- Cada registro operacional possui `tenant_id`.
- RLS limita leitura e escrita às congregações do usuário.
- Consultas e mutações do cliente sempre incluem o `tenant_id` selecionado.
- Acesso anônimo às tabelas operacionais é revogado.
- Administradores da plataforma podem criar uma congregação copiando dados selecionados de uma congregação-modelo.

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

A migração está em `supabase/migrations/20260814111500_multi_tenant_foundation.sql`. O procedimento de produção está em [docs/MULTI_TENANT_ROLLOUT.md](docs/MULTI_TENANT_ROLLOUT.md).
