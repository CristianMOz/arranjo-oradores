-- Executar somente depois de reverter o frontend que usa as novas colunas.
-- Este rollback remove apenas objetos criados pela migration correspondente.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

drop index if exists public.oradores_um_coordenador_por_congregacao_key;

alter table public.oradores
  drop constraint if exists oradores_tenant_congregacao_nome_key,
  drop constraint if exists oradores_tenant_congregacao_fkey,
  drop constraint if exists oradores_privilegio_check,
  drop constraint if exists oradores_tipo_telefone_check;

alter table public.oradores
  drop column if exists nome_normalizado,
  drop column if exists congregacao_id,
  drop column if exists e_coordenador,
  drop column if exists ativo,
  drop column if exists privilegio,
  drop column if exists tipo_telefone,
  drop column if exists email;

alter table public.congregacoes
  drop constraint if exists congregacoes_tenant_nome_normalizado_key;

alter table public.congregacoes
  drop column if exists nome_normalizado,
  drop column if exists cep,
  drop column if exists pais,
  drop column if exists estado,
  drop column if exists cidade,
  drop column if exists idioma;

alter table public.tenants
  drop column if exists telefone,
  drop column if exists cep,
  drop column if exists pais,
  drop column if exists estado,
  drop column if exists cidade,
  drop column if exists idioma;

commit;
