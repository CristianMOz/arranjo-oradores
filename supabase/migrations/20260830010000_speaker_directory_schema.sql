-- Completa o cadastro de congregacoes e oradores sem alterar a semantica de status.
-- congregacao_id NULL representa um orador da propria congregacao do tenant.
-- congregacao_id preenchido representa um orador de uma congregacao externa.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- NULLS NOT DISTINCT foi introduzido no PostgreSQL 15.
do $preflight$
begin
  if current_setting('server_version_num')::integer < 150000 then
    raise exception 'PostgreSQL 15 ou superior e obrigatorio; versao atual: %', version();
  end if;

  if exists (
    select 1
    from public.congregacoes
    group by tenant_id, lower(btrim(nome))
    having count(*) > 1
  ) then
    raise exception 'Existem congregacoes duplicadas por tenant apos lower(btrim(nome))';
  end if;

  if exists (
    select 1
    from public.oradores
    group by tenant_id, lower(btrim(nome))
    having count(*) > 1
  ) then
    raise exception 'Existem oradores duplicados por tenant apos lower(btrim(nome))';
  end if;
end
$preflight$;

-- Dados da congregacao que usa o sistema.
alter table public.tenants
  add column idioma text not null default '',
  add column cidade text not null default '',
  add column estado text not null default '',
  add column pais text not null default '',
  add column cep text not null default '',
  add column telefone text not null default '';

-- Congregacoes externas cadastradas pelo tenant.
alter table public.congregacoes
  add column idioma text not null default '',
  add column cidade text not null default '',
  add column estado text not null default '',
  add column pais text not null default '',
  add column cep text not null default '',
  add column nome_normalizado text
    generated always as (lower(btrim(nome))) stored;

alter table public.congregacoes
  add constraint congregacoes_tenant_nome_normalizado_key
  unique (tenant_id, nome_normalizado);

-- Dados pessoais, disponibilidade e papeis do orador.
-- status permanece intocado porque representa o estado do arranjo.
alter table public.oradores
  add column email text not null default '',
  add column tipo_telefone text not null default '',
  add column privilegio text not null default '',
  add column ativo boolean not null default true,
  add column e_coordenador boolean not null default false,
  add column congregacao_id integer null,
  add column nome_normalizado text
    generated always as (lower(btrim(nome))) stored;

alter table public.oradores
  add constraint oradores_tipo_telefone_check
    check (tipo_telefone in ('', 'celular', 'residencial', 'comercial')) not valid,
  add constraint oradores_privilegio_check
    check (privilegio in ('', 'anciao', 'servo_ministerial')) not valid,
  add constraint oradores_tenant_congregacao_fkey
    foreign key (tenant_id, congregacao_id)
    references public.congregacoes (tenant_id, id)
    on delete restrict
    not valid,
  add constraint oradores_tenant_congregacao_nome_key
    unique nulls not distinct (tenant_id, congregacao_id, nome_normalizado);

alter table public.oradores validate constraint oradores_tipo_telefone_check;
alter table public.oradores validate constraint oradores_privilegio_check;
alter table public.oradores validate constraint oradores_tenant_congregacao_fkey;

-- Garante um coordenador para a propria congregacao (NULL) ou para cada externa.
create unique index oradores_um_coordenador_por_congregacao_key
  on public.oradores (tenant_id, congregacao_id)
  nulls not distinct
  where e_coordenador = true;

commit;
