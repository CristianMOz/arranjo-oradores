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

drop function if exists private.normalize_directory_name(text);

-- Restaura a versao anterior da funcao, compatível apenas com o schema antigo.
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
