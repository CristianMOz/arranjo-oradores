-- Executar depois da migration principal. Todos os dados de teste usam IDs
-- negativos explicitos e a transacao sempre termina com ROLLBACK.

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
    group by tenant_id, lower(btrim(nome))
    having count(*) > 1
  ) then
    raise exception 'FAIL: duplicatas preexistentes em congregacoes';
  end if;

  if exists (
    select 1 from public.oradores
    group by tenant_id, congregacao_id, lower(btrim(nome))
    having count(*) > 1
  ) then
    raise exception 'FAIL: duplicatas preexistentes em oradores';
  end if;

  insert into public.congregacoes (id, tenant_id, nome)
  values (-2147483000, cristian_tenant, 'Congregacao Externa Teste');

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
    where id >= 0
  ) is distinct from baseline.status_fingerprint then
    raise exception 'FAIL: status dos oradores existentes foi alterado';
  end if;
end
$test$;

rollback;

select jsonb_build_object(
  'resultado', 'PASS',
  'transacao', 'ROLLBACK concluido',
  'ids_de_teste_persistidos',
    (select count(*) from public.oradores where id between -2147483000 and -2147482993)
    + (select count(*) from public.congregacoes where id = -2147483000),
  'helio', jsonb_build_object(
    'congregacoes', (select count(*) from public.congregacoes where tenant_id = '2b308cf1-460e-4fdc-9823-c0faf0102bae'),
    'oradores', (select count(*) from public.oradores where tenant_id = '2b308cf1-460e-4fdc-9823-c0faf0102bae')
  ),
  'cristian', jsonb_build_object(
    'congregacoes', (select count(*) from public.congregacoes where tenant_id = 'ff33d065-ca65-45d3-8852-95bf8b97037a'),
    'oradores', (select count(*) from public.oradores where tenant_id = 'ff33d065-ca65-45d3-8852-95bf8b97037a')
  )
) as validation_result;
