-- Executar depois da migration principal. Todos os dados de teste usam IDs
-- negativos explicitos e a transacao sempre termina com ROLLBACK.
-- No psql, qualquer erro interrompe o arquivo antes que PASS seja emitido.

\set ON_ERROR_STOP on

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create temporary table speaker_schema_baseline on commit drop as
select
  (select count(*) from public.congregacoes) as congregacoes_total,
  (select count(*) from public.oradores) as oradores_total,
  (
    select md5(coalesce(string_agg(tenant_id::text || ':' || id::text || ':' || coalesce(status, '<NULL>'), '|' order by tenant_id, id), ''))
    from public.oradores
  ) as status_fingerprint;

do $test$
declare
  helio_tenant constant uuid := '2b308cf1-460e-4fdc-9823-c0faf0102bae';
  cristian_tenant constant uuid := 'ff33d065-ca65-45d3-8852-95bf8b97037a';
  helio_congregacao_id integer;
  coordinator_id integer;
  speaker_read_id integer;
  coordinator_read_id integer;
  cloned_tenant_id uuid;
  cloned_congregacao_id integer;
  cloned_coordinator_id integer;
  platform_admin_id uuid;
  queue_run_id uuid;
  rejected boolean;
  baseline record;
begin
  if current_setting('server_version_num')::integer < 150000 then
    raise exception 'FAIL: PostgreSQL anterior a 15: %', version();
  end if;

  if not exists (select 1 from public.tenants where id = helio_tenant)
     or not exists (select 1 from public.tenants where id = cristian_tenant) then
    raise exception 'FAIL: os tenants de Hélio e Cristian nao foram encontrados';
  end if;

  if exists (
    select 1 from public.congregacoes
    group by tenant_id, private.normalize_directory_name(nome)
    having count(*) > 1
  ) then
    raise exception 'FAIL: duplicatas preexistentes em congregacoes';
  end if;

  if exists (
    select 1 from public.oradores
    group by tenant_id, congregacao_id, private.normalize_directory_name(nome)
    having count(*) > 1
  ) then
    raise exception 'FAIL: duplicatas preexistentes em oradores';
  end if;

  insert into public.congregacoes (
    id, tenant_id, nome, idioma, cidade, estado, pais, cep
  ) values (
    -2147483000, cristian_tenant, 'Congregacao Externa Teste',
    'Português', 'Pompano Beach', 'FL', 'USA', '33064'
  );

  -- Caminho positivo central: uma linha aparece como orador e coordenador.
  insert into public.oradores (
    id, tenant_id, nome, email, tipo_telefone, privilegio,
    ativo, e_coordenador, congregacao_id, status
  ) values (
    -2147483000, cristian_tenant, 'Coordenador Orador Teste',
    'coordenador@example.invalid', 'celular', 'anciao',
    true, true, -2147483000, 'pendente'
  ) returning id into coordinator_id;

  select id into speaker_read_id
  from public.oradores
  where tenant_id = cristian_tenant and id = coordinator_id and ativo;

  select id into coordinator_read_id
  from public.oradores
  where tenant_id = cristian_tenant
    and congregacao_id = -2147483000
    and e_coordenador;

  if speaker_read_id is distinct from coordinator_read_id then
    raise exception 'FAIL: coordenador e orador nao resolvem para a mesma linha';
  end if;

  -- Um segundo coordenador para a mesma congregacao externa deve falhar.
  rejected := false;
  begin
    insert into public.oradores
      (id, tenant_id, nome, e_coordenador, congregacao_id)
    values
      (-2147482999, cristian_tenant, 'Segundo Coordenador Externo', true, -2147483000);
  exception when unique_violation then
    rejected := true;
  end;
  if not rejected then
    raise exception 'FAIL: segundo coordenador externo foi aceito';
  end if;

  -- NULLS NOT DISTINCT tambem protege o coordenador da propria congregacao.
  insert into public.oradores
    (id, tenant_id, nome, e_coordenador, congregacao_id)
  values
    (-2147482998, cristian_tenant, 'Coordenador Local Um', true, null);

  rejected := false;
  begin
    insert into public.oradores
      (id, tenant_id, nome, e_coordenador, congregacao_id)
    values
      (-2147482997, cristian_tenant, 'Coordenador Local Dois', true, null);
  exception when unique_violation then
    rejected := true;
  end;
  if not rejected then
    raise exception 'FAIL: segundo coordenador local foi aceito';
  end if;

  insert into public.oradores
    (id, tenant_id, nome, congregacao_id)
  values
    (-2147482996, cristian_tenant, '  Nome Normalizado Teste  ', null);

  rejected := false;
  begin
    insert into public.oradores
      (id, tenant_id, nome, congregacao_id)
    values
      (-2147482995, cristian_tenant, 'nome normalizado teste', null);
  exception when unique_violation then
    rejected := true;
  end;
  if not rejected then
    raise exception 'FAIL: nome normalizado duplicado foi aceito';
  end if;

  -- A mesma chave precisa ser gerada com ou sem acentos.
  insert into public.oradores
    (id, tenant_id, nome, congregacao_id)
  values
    (-2147482992, cristian_tenant, 'José Rogério Teste', null);

  rejected := false;
  begin
    insert into public.oradores
      (id, tenant_id, nome, congregacao_id)
    values
      (-2147482991, cristian_tenant, 'Jose   Rogerio Teste', null);
  exception when unique_violation then
    rejected := true;
  end;
  if not rejected then
    raise exception 'FAIL: nome equivalente sem acentos foi aceito';
  end if;

  rejected := false;
  begin
    insert into public.oradores
      (id, tenant_id, nome, privilegio)
    values
      (-2147482994, cristian_tenant, 'Privilegio Invalido', 'qualquer');
  exception when check_violation then
    rejected := true;
  end;
  if not rejected then
    raise exception 'FAIL: privilegio invalido foi aceito';
  end if;

  select id into helio_congregacao_id
  from public.congregacoes
  where tenant_id = helio_tenant
  order by id
  limit 1;

  rejected := false;
  begin
    insert into public.oradores
      (id, tenant_id, nome, congregacao_id)
    values
      (-2147482993, cristian_tenant, 'FK Cruzada Teste', helio_congregacao_id);
  exception when foreign_key_violation then
    rejected := true;
  end;
  if not rejected then
    raise exception 'FAIL: FK entre tenants foi aceita';
  end if;

  -- O clone usa sequencias transacionais exclusivas do teste. Assim o ensaio
  -- nao consome IDs das sequencias reais, mesmo antes do ROLLBACK.
  create sequence public._speaker_test_esbocos_id_seq
    as integer start with -1000000000 increment by -1 minvalue -2147480000 maxvalue -1;
  create sequence public._speaker_test_oradores_id_seq
    as integer start with -1100000000 increment by -1 minvalue -2147480000 maxvalue -1;
  create sequence public._speaker_test_congregacoes_id_seq
    as integer start with -1200000000 increment by -1 minvalue -2147480000 maxvalue -1;

  alter table public.esbocos alter column id
    set default nextval('public._speaker_test_esbocos_id_seq'::regclass);
  alter table public.oradores alter column id
    set default nextval('public._speaker_test_oradores_id_seq'::regclass);
  alter table public.congregacoes alter column id
    set default nextval('public._speaker_test_congregacoes_id_seq'::regclass);

  select user_id into platform_admin_id from public.platform_admins order by created_at limit 1;
  if platform_admin_id is null then
    raise exception 'FAIL: administrador da plataforma nao encontrado para testar o clone';
  end if;
  perform set_config('request.jwt.claim.sub', platform_admin_id::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', platform_admin_id, 'role', 'authenticated')::text,
    true
  );

  select public.admin_clone_tenant(
    cristian_tenant,
    'Clone de Schema Teste',
    'clone-de-schema-teste',
    'clone@example.invalid',
    true,
    true,
    false
  ) into cloned_tenant_id;

  select id into cloned_congregacao_id
  from public.congregacoes
  where tenant_id = cloned_tenant_id and nome = 'Congregacao Externa Teste';

  select id into cloned_coordinator_id
  from public.oradores
  where tenant_id = cloned_tenant_id
    and nome = 'Coordenador Orador Teste'
    and congregacao_id = cloned_congregacao_id
    and e_coordenador
    and ativo
    and email = 'coordenador@example.invalid'
    and tipo_telefone = 'celular'
    and privilegio = 'anciao'
    and status = 'pendente';

  if cloned_congregacao_id is null or cloned_coordinator_id is null then
    raise exception 'FAIL: admin_clone_tenant nao preservou congregacao, campos e papeis';
  end if;

  -- Se o modulo de WhatsApp estiver instalado, a fila deve continuar montando.
  if to_regprocedure('private.whatsapp_build_queue(uuid,date,text,uuid)') is not null then
    select private.whatsapp_build_queue(helio_tenant, current_date, 'manual', null)
    into queue_run_id;
    if queue_run_id is null then
      raise exception 'FAIL: whatsapp_build_queue nao retornou um run id';
    end if;
  end if;

  select * into baseline from speaker_schema_baseline;

  if (
    select md5(coalesce(string_agg(tenant_id::text || ':' || id::text || ':' || coalesce(status, '<NULL>'), '|' order by tenant_id, id), ''))
    from public.oradores
    where tenant_id in (helio_tenant, cristian_tenant) and id >= 0
  ) is distinct from baseline.status_fingerprint then
    raise exception 'FAIL: status dos oradores existentes foi alterado';
  end if;
end
$test$;

rollback;

with metrics as (
  select
    (select count(*) from public.oradores where id between -2147483000 and -2147482991)
      + (select count(*) from public.congregacoes where id = -2147483000) as test_rows,
    (select count(*) from public.tenants where slug = 'clone-de-schema-teste') as clone_rows,
    (select count(*) from public.congregacoes where tenant_id = '2b308cf1-460e-4fdc-9823-c0faf0102bae') as helio_congregacoes,
    (select count(*) from public.oradores where tenant_id = '2b308cf1-460e-4fdc-9823-c0faf0102bae') as helio_oradores,
    (select count(*) from public.congregacoes where tenant_id = 'ff33d065-ca65-45d3-8852-95bf8b97037a') as cristian_congregacoes,
    (select count(*) from public.oradores where tenant_id = 'ff33d065-ca65-45d3-8852-95bf8b97037a') as cristian_oradores
)
select jsonb_build_object(
  'resultado', case
    when test_rows = 0 and clone_rows = 0
      and helio_congregacoes = 33 and helio_oradores = 21
      and cristian_congregacoes = 0 and cristian_oradores = 5
    then 'PASS' else 'FAIL' end,
  'transacao', 'ROLLBACK concluido',
  'ids_de_teste_persistidos', test_rows,
  'clone_persistido', clone_rows,
  'helio', jsonb_build_object('congregacoes', helio_congregacoes, 'oradores', helio_oradores),
  'cristian', jsonb_build_object('congregacoes', cristian_congregacoes, 'oradores', cristian_oradores)
) as validation_result
from metrics;
