-- Arranjo de Oradores: fundação multi-congregação.
-- Preserva todos os registros existentes dentro do tenant legado.

begin;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 2 and 120),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  meeting_day text not null default 'Sábado',
  meeting_time time not null default '19:00',
  address text not null default '',
  timezone text not null default 'America/Sao_Paulo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenants_slug_key unique (slug)
);

create table public.tenant_memberships (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'viewer' check (role in ('owner','admin','editor','viewer')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

create table public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.tenant_invites (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  email text not null check (email = lower(btrim(email))),
  role text not null default 'owner' check (role in ('owner','admin','editor','viewer')),
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index tenant_invites_pending_email_idx
  on public.tenant_invites (tenant_id, email)
  where accepted_at is null;
create index tenant_memberships_user_idx on public.tenant_memberships (user_id, tenant_id) where active;

insert into public.tenants (name, slug, meeting_day, meeting_time, address, timezone)
values (
  'Congregação Alto da Colina',
  'alto-da-colina',
  'Sábado',
  '19:00',
  'José do Patrocínio 249, Cidade Nova, Indaiatuba/SP',
  'America/Sao_Paulo'
);

alter table public.esbocos add column tenant_id uuid;
alter table public.oradores add column tenant_id uuid;
alter table public.congregacoes add column tenant_id uuid;
alter table public.visitantes add column tenant_id uuid;
alter table public.saidas add column tenant_id uuid;

do $migration$
declare
  legacy_tenant_id uuid;
begin
  select id into strict legacy_tenant_id from public.tenants where slug = 'alto-da-colina';
  update public.esbocos set tenant_id = legacy_tenant_id where tenant_id is null;
  update public.oradores set tenant_id = legacy_tenant_id where tenant_id is null;
  update public.congregacoes set tenant_id = legacy_tenant_id where tenant_id is null;
  update public.visitantes set tenant_id = legacy_tenant_id where tenant_id is null;
  update public.saidas set tenant_id = legacy_tenant_id where tenant_id is null;
end
$migration$;

alter table public.esbocos alter column tenant_id set not null;
alter table public.oradores alter column tenant_id set not null;
alter table public.congregacoes alter column tenant_id set not null;
alter table public.visitantes alter column tenant_id set not null;
alter table public.saidas alter column tenant_id set not null;

alter table public.esbocos add constraint esbocos_tenant_fkey foreign key (tenant_id) references public.tenants(id) on delete cascade;
alter table public.oradores add constraint oradores_tenant_fkey foreign key (tenant_id) references public.tenants(id) on delete cascade;
alter table public.congregacoes add constraint congregacoes_tenant_fkey foreign key (tenant_id) references public.tenants(id) on delete cascade;
alter table public.visitantes add constraint visitantes_tenant_fkey foreign key (tenant_id) references public.tenants(id) on delete cascade;
alter table public.saidas add constraint saidas_tenant_fkey foreign key (tenant_id) references public.tenants(id) on delete cascade;

alter table public.esbocos add constraint esbocos_tenant_id_id_key unique (tenant_id, id);
alter table public.oradores add constraint oradores_tenant_id_id_key unique (tenant_id, id);
alter table public.congregacoes add constraint congregacoes_tenant_id_id_key unique (tenant_id, id);
alter table public.esbocos add constraint esbocos_tenant_number_key unique (tenant_id, n);

alter table public.visitantes
  add constraint visitantes_tenant_esboco_fkey
  foreign key (tenant_id, esboco_id) references public.esbocos(tenant_id, id) on delete set null (esboco_id);
alter table public.saidas
  add constraint saidas_tenant_esboco_fkey
  foreign key (tenant_id, esboco_id) references public.esbocos(tenant_id, id) on delete set null (esboco_id);
alter table public.saidas
  add constraint saidas_tenant_orador_fkey
  foreign key (tenant_id, orador_id) references public.oradores(tenant_id, id) on delete set null (orador_id);

create index esbocos_tenant_idx on public.esbocos (tenant_id, id);
create index oradores_tenant_idx on public.oradores (tenant_id, id);
create index congregacoes_tenant_idx on public.congregacoes (tenant_id, id);
create index visitantes_tenant_data_idx on public.visitantes (tenant_id, data);
create index saidas_tenant_data_idx on public.saidas (tenant_id, data);

create or replace function private.has_tenant_access(p_tenant_id uuid, p_roles text[] default null)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select auth.uid() is not null and exists (
    select 1
    from public.tenant_memberships membership
    where membership.tenant_id = p_tenant_id
      and membership.user_id = auth.uid()
      and membership.active
      and (p_roles is null or membership.role = any(p_roles))
  );
$function$;

create or replace function private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select auth.uid() is not null and exists (
    select 1 from public.platform_admins administrator where administrator.user_id = auth.uid()
  );
$function$;

revoke all on function private.has_tenant_access(uuid, text[]) from public;
revoke all on function private.is_platform_admin() from public;
grant execute on function private.has_tenant_access(uuid, text[]) to authenticated;
grant execute on function private.is_platform_admin() to authenticated;

create or replace function private.validate_orador_esbocos()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
begin
  if exists (
    select 1
    from unnest(coalesce(new.esboco_ids, '{}'::integer[])) outline_id
    where not exists (
      select 1 from public.esbocos outline
      where outline.id = outline_id and outline.tenant_id = new.tenant_id
    )
  ) then
    raise exception 'Todos os esboços do orador devem pertencer à mesma congregação';
  end if;
  return new;
end;
$function$;

create trigger oradores_validate_esbocos
before insert or update of tenant_id, esboco_ids on public.oradores
for each row execute function private.validate_orador_esbocos();

drop policy if exists acesso_publico_esbocos on public.esbocos;
drop policy if exists acesso_publico_oradores on public.oradores;
drop policy if exists acesso_publico_congregacoes on public.congregacoes;
drop policy if exists acesso_publico_visitantes on public.visitantes;
drop policy if exists acesso_publico_saidas on public.saidas;

alter table public.tenants enable row level security;
alter table public.tenant_memberships enable row level security;
alter table public.platform_admins enable row level security;
alter table public.tenant_invites enable row level security;
alter table public.esbocos enable row level security;
alter table public.oradores enable row level security;
alter table public.congregacoes enable row level security;
alter table public.visitantes enable row level security;
alter table public.saidas enable row level security;

create policy tenants_select_member on public.tenants for select to authenticated
using (private.has_tenant_access(id, null) or private.is_platform_admin());
create policy tenants_update_admin on public.tenants for update to authenticated
using (private.has_tenant_access(id, array['owner','admin']) or private.is_platform_admin())
with check (private.has_tenant_access(id, array['owner','admin']) or private.is_platform_admin());

create policy memberships_select on public.tenant_memberships for select to authenticated
using (user_id = auth.uid() or private.has_tenant_access(tenant_id, array['owner','admin']) or private.is_platform_admin());
create policy memberships_update_admin on public.tenant_memberships for update to authenticated
using (private.has_tenant_access(tenant_id, array['owner','admin']) or private.is_platform_admin())
with check (private.has_tenant_access(tenant_id, array['owner','admin']) or private.is_platform_admin());
create policy memberships_delete_admin on public.tenant_memberships for delete to authenticated
using (private.has_tenant_access(tenant_id, array['owner','admin']) or private.is_platform_admin());

create policy platform_admins_select_self on public.platform_admins for select to authenticated
using (user_id = auth.uid());
create policy tenant_invites_select_admin on public.tenant_invites for select to authenticated
using (private.has_tenant_access(tenant_id, array['owner','admin']) or private.is_platform_admin());

do $policies$
declare
  table_name text;
begin
  foreach table_name in array array['esbocos','oradores','congregacoes','visitantes','saidas'] loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (private.has_tenant_access(tenant_id, null))',
      table_name || '_tenant_select', table_name
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (private.has_tenant_access(tenant_id, array[''owner'',''admin'',''editor'']))',
      table_name || '_tenant_insert', table_name
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (private.has_tenant_access(tenant_id, array[''owner'',''admin'',''editor''])) with check (private.has_tenant_access(tenant_id, array[''owner'',''admin'',''editor'']))',
      table_name || '_tenant_update', table_name
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (private.has_tenant_access(tenant_id, array[''owner'',''admin'']))',
      table_name || '_tenant_delete', table_name
    );
  end loop;
end
$policies$;

revoke all on public.tenants, public.tenant_memberships, public.platform_admins, public.tenant_invites from anon;
revoke all on public.esbocos, public.oradores, public.congregacoes, public.visitantes, public.saidas from anon;
revoke all on public.tenants, public.tenant_memberships, public.platform_admins, public.tenant_invites from authenticated;
revoke all on public.esbocos, public.oradores, public.congregacoes, public.visitantes, public.saidas from authenticated;

grant select, update on public.tenants to authenticated;
grant select, update, delete on public.tenant_memberships to authenticated;
grant select on public.platform_admins to authenticated;
grant select on public.tenant_invites to authenticated;
grant select, insert, update, delete on public.esbocos, public.oradores, public.congregacoes, public.visitantes, public.saidas to authenticated;
grant usage, select on all sequences in schema public to authenticated;

create or replace function public.claim_my_tenant_invites()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  caller_id uuid := auth.uid();
  caller_email text;
  claimed_count integer := 0;
begin
  if caller_id is null then raise exception 'Autenticação obrigatória'; end if;
  select lower(email) into caller_email from auth.users where id = caller_id;
  if caller_email is null then raise exception 'E-mail da conta não encontrado'; end if;

  insert into public.tenant_memberships (tenant_id, user_id, role, active)
  select invite.tenant_id, caller_id, invite.role, true
  from public.tenant_invites invite
  where invite.email = caller_email and invite.accepted_at is null and invite.expires_at > now()
  on conflict (tenant_id, user_id) do update set role = excluded.role, active = true;
  get diagnostics claimed_count = row_count;

  update public.tenant_invites
  set accepted_at = now()
  where email = caller_email and accepted_at is null and expires_at > now();
  return claimed_count;
end;
$function$;

revoke all on function public.claim_my_tenant_invites() from public, anon;
grant execute on function public.claim_my_tenant_invites() to authenticated;

create or replace function public.admin_clone_tenant(
  p_source_tenant_id uuid,
  p_name text,
  p_slug text,
  p_owner_email text,
  p_copy_speakers boolean default true,
  p_copy_contacts boolean default true,
  p_copy_history boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  new_tenant_id uuid;
  existing_owner_id uuid;
  old_row record;
  new_row_id integer;
  outline_map jsonb := '{}'::jsonb;
  speaker_map jsonb := '{}'::jsonb;
  mapped_outline_ids integer[];
begin
  if not private.is_platform_admin() then raise exception 'Acesso de administrador da plataforma obrigatório'; end if;
  if not exists (select 1 from public.tenants where id = p_source_tenant_id) then raise exception 'Congregação de origem não encontrada'; end if;
  if p_name is null or length(btrim(p_name)) < 2 then raise exception 'Nome inválido'; end if;
  if p_slug is null or p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then raise exception 'Identificador inválido'; end if;
  if p_owner_email is null or position('@' in p_owner_email) < 2 then raise exception 'E-mail do responsável inválido'; end if;

  insert into public.tenants (name, slug, meeting_day, meeting_time, address, timezone)
  select btrim(p_name), p_slug, source.meeting_day, source.meeting_time, '', source.timezone
  from public.tenants source where source.id = p_source_tenant_id
  returning id into new_tenant_id;

  for old_row in select * from public.esbocos where tenant_id = p_source_tenant_id order by id loop
    insert into public.esbocos (tenant_id, n, tema, ultimo)
    values (new_tenant_id, old_row.n, old_row.tema, '') returning id into new_row_id;
    outline_map := outline_map || jsonb_build_object(old_row.id::text, new_row_id);
  end loop;

  if p_copy_speakers then
    for old_row in select * from public.oradores where tenant_id = p_source_tenant_id order by id loop
      select coalesce(array_agg((outline_map ->> outline_id::text)::integer order by position), '{}'::integer[])
      into mapped_outline_ids
      from unnest(coalesce(old_row.esboco_ids, '{}'::integer[])) with ordinality as listed(outline_id, position)
      where outline_map ? outline_id::text;

      insert into public.oradores (tenant_id, nome, cel, esboco_ids, status)
      values (new_tenant_id, old_row.nome, old_row.cel, mapped_outline_ids, old_row.status)
      returning id into new_row_id;
      speaker_map := speaker_map || jsonb_build_object(old_row.id::text, new_row_id);
    end loop;
  end if;

  if p_copy_contacts then
    insert into public.congregacoes (tenant_id, nome, dia, hora, contato, tel, "end")
    select new_tenant_id, nome, dia, hora, contato, tel, "end"
    from public.congregacoes where tenant_id = p_source_tenant_id;
  end if;

  if p_copy_history then
    insert into public.visitantes (tenant_id, cong, data, orador, esboco_id, dia, hora, congregacao_local, endereco, relatorio_id, status)
    select new_tenant_id, visitor.cong, visitor.data, visitor.orador,
      case when visitor.esboco_id is null then null else (outline_map ->> visitor.esboco_id::text)::integer end,
      visitor.dia, visitor.hora, p_name, visitor.endereco, visitor.relatorio_id, visitor.status
    from public.visitantes visitor where visitor.tenant_id = p_source_tenant_id;

    insert into public.saidas (tenant_id, data, cong, orador_id, orador_nome, esboco_id, status)
    select new_tenant_id, outbound.data, outbound.cong,
      case when outbound.orador_id is null then null else (speaker_map ->> outbound.orador_id::text)::integer end,
      outbound.orador_nome,
      case when outbound.esboco_id is null then null else (outline_map ->> outbound.esboco_id::text)::integer end,
      outbound.status
    from public.saidas outbound where outbound.tenant_id = p_source_tenant_id;
  end if;

  select id into existing_owner_id from auth.users where lower(email) = lower(btrim(p_owner_email)) limit 1;
  if existing_owner_id is not null then
    insert into public.tenant_memberships (tenant_id, user_id, role)
    values (new_tenant_id, existing_owner_id, 'owner');
  else
    insert into public.tenant_invites (tenant_id, email, role, created_by)
    values (new_tenant_id, lower(btrim(p_owner_email)), 'owner', auth.uid());
  end if;

  return new_tenant_id;
end;
$function$;

revoke all on function public.admin_clone_tenant(uuid, text, text, text, boolean, boolean, boolean) from public, anon;
grant execute on function public.admin_clone_tenant(uuid, text, text, text, boolean, boolean, boolean) to authenticated;

commit;
