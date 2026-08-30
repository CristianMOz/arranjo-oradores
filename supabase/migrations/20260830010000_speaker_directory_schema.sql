-- Completa o cadastro de congregacoes e oradores sem alterar a semantica de status.
-- congregacao_id NULL representa um orador da propria congregacao do tenant.
-- congregacao_id preenchido representa um orador de uma congregacao externa.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Evita depender da extensao unaccent (nao instalada no projeto) e mantem a
-- expressao apta a colunas STORED. A chave remove acentos latinos comuns,
-- pontuacao e diferencas de espaco/caixa, como tenantSlug() faz no frontend.
create or replace function private.normalize_directory_name(p_value text)
returns text
language sql
immutable
strict
parallel safe
set search_path = pg_catalog
as $function$
  select btrim(
    regexp_replace(
      translate(
        lower(btrim(p_value)),
        'áàâãäåéèêëíìîïóòôõöúùûüçñýÿ',
        'aaaaaaeeeeiiiiooooouuuucnyy'
      ),
      '[^a-z0-9]+',
      ' ',
      'g'
    )
  );
$function$;

revoke all on function private.normalize_directory_name(text) from public, anon;
grant execute on function private.normalize_directory_name(text) to authenticated;

-- NULLS NOT DISTINCT foi introduzido no PostgreSQL 15.
do $preflight$
begin
  if current_setting('server_version_num')::integer < 150000 then
    raise exception 'PostgreSQL 15 ou superior e obrigatorio; versao atual: %', version();
  end if;

  if exists (
    select 1
    from public.congregacoes
    group by tenant_id, private.normalize_directory_name(nome)
    having count(*) > 1
  ) then
    raise exception 'Existem congregacoes duplicadas por tenant apos normalizacao do nome';
  end if;

  if exists (
    select 1
    from public.oradores
    group by tenant_id, private.normalize_directory_name(nome)
    having count(*) > 1
  ) then
    raise exception 'Existem oradores duplicados por tenant apos normalizacao do nome';
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
    generated always as (private.normalize_directory_name(nome)) stored;

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
    generated always as (private.normalize_directory_name(nome)) stored;

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

-- A funcao de clone original conhece apenas as colunas antigas. Substitui-la
-- aqui evita perder endereco, disponibilidade, privilegio, coordenador e o
-- vinculo com congregacoes externas ao criar um novo tenant.
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
  mapped_congregacao_id integer;
  outline_map jsonb := '{}'::jsonb;
  speaker_map jsonb := '{}'::jsonb;
  congregation_map jsonb := '{}'::jsonb;
  mapped_outline_ids integer[];
begin
  if not private.is_platform_admin() then raise exception 'Acesso de administrador da plataforma obrigatório'; end if;
  if not exists (select 1 from public.tenants where id = p_source_tenant_id) then raise exception 'Congregação de origem não encontrada'; end if;
  if p_name is null or length(btrim(p_name)) < 2 then raise exception 'Nome inválido'; end if;
  if p_slug is null or p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then raise exception 'Identificador inválido'; end if;
  if p_owner_email is null or position('@' in p_owner_email) < 2 then raise exception 'E-mail do responsável inválido'; end if;

  if p_copy_speakers and not p_copy_contacts and exists (
    select 1 from public.oradores
    where tenant_id = p_source_tenant_id and congregacao_id is not null
  ) then
    raise exception 'Copiar oradores externos exige copiar também as congregações vinculadas';
  end if;

  insert into public.tenants (
    name, slug, meeting_day, meeting_time, address, timezone,
    idioma, cidade, estado, pais, cep, telefone
  )
  select
    btrim(p_name), p_slug, source.meeting_day, source.meeting_time, '', source.timezone,
    source.idioma, '', '', source.pais, '', ''
  from public.tenants source where source.id = p_source_tenant_id
  returning id into new_tenant_id;

  for old_row in select * from public.esbocos where tenant_id = p_source_tenant_id order by id loop
    insert into public.esbocos (tenant_id, n, tema, ultimo)
    values (new_tenant_id, old_row.n, old_row.tema, '') returning id into new_row_id;
    outline_map := outline_map || jsonb_build_object(old_row.id::text, new_row_id);
  end loop;

  -- Congregacoes precisam ser mapeadas antes dos oradores por causa da FK.
  if p_copy_contacts then
    for old_row in select * from public.congregacoes where tenant_id = p_source_tenant_id order by id loop
      insert into public.congregacoes (
        tenant_id, nome, dia, hora, contato, tel, whatsapp, "end",
        idioma, cidade, estado, pais, cep
      )
      values (
        new_tenant_id, old_row.nome, old_row.dia, old_row.hora,
        old_row.contato, old_row.tel, old_row.whatsapp, old_row."end",
        old_row.idioma, old_row.cidade, old_row.estado, old_row.pais, old_row.cep
      )
      returning id into new_row_id;
      congregation_map := congregation_map || jsonb_build_object(old_row.id::text, new_row_id);
    end loop;
  end if;

  if p_copy_speakers then
    for old_row in select * from public.oradores where tenant_id = p_source_tenant_id order by id loop
      select coalesce(array_agg((outline_map ->> outline_id::text)::integer order by position), '{}'::integer[])
      into mapped_outline_ids
      from unnest(coalesce(old_row.esboco_ids, '{}'::integer[])) with ordinality as listed(outline_id, position)
      where outline_map ? outline_id::text;

      mapped_congregacao_id := case
        when old_row.congregacao_id is null then null
        else (congregation_map ->> old_row.congregacao_id::text)::integer
      end;

      if old_row.congregacao_id is not null and mapped_congregacao_id is null then
        raise exception 'Congregação vinculada ao orador % não foi copiada', old_row.nome;
      end if;

      insert into public.oradores (
        tenant_id, nome, cel, esboco_ids, status,
        email, tipo_telefone, privilegio, ativo, e_coordenador, congregacao_id
      )
      values (
        new_tenant_id, old_row.nome, old_row.cel, mapped_outline_ids, old_row.status,
        old_row.email, old_row.tipo_telefone, old_row.privilegio,
        old_row.ativo, old_row.e_coordenador, mapped_congregacao_id
      )
      returning id into new_row_id;
      speaker_map := speaker_map || jsonb_build_object(old_row.id::text, new_row_id);
    end loop;
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
