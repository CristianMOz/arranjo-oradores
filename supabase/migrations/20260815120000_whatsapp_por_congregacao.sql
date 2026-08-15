-- Arranjo de Oradores: avisos de WhatsApp isolados por congregação.
-- Cada congregação define quem pode enviar, qual número aparece como remetente,
-- em que dia/hora o preparo roda e quais modelos de mensagem são usados.
-- O preparo é idempotente: um aviso já enviado nunca é regerado nem reescrito.

begin;

-- ── Configuração por congregação ─────────────────────────────────────────
create table public.whatsapp_settings (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  enabled boolean not null default false,
  mode text not null default 'previa' check (mode in ('previa','automatico')),
  provider text not null default 'manual' check (provider in ('manual','meta_cloud','webhook')),
  sender_label text not null default '',
  sender_phone text not null default '' check (sender_phone ~ '^[0-9]{0,15}$'),
  provider_phone_id text not null default '',
  run_weekday smallint not null default 1 check (run_weekday between 0 and 6),
  run_time time not null default '08:00',
  window_days smallint not null default 7 check (window_days between 1 and 31),
  notify_saidas boolean not null default true,
  notify_visitantes boolean not null default true,
  template_saida text not null default '',
  template_visitante text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  -- Trava: envio automático exige um provedor de verdade.
  constraint whatsapp_settings_auto_needs_provider
    check (mode <> 'automatico' or provider <> 'manual')
);

comment on table public.whatsapp_settings is 'Configuração de avisos de WhatsApp de cada congregação.';
comment on column public.whatsapp_settings.mode is 'previa: monta a fila para revisão manual. automatico: a fila já sai aprovada para o disparador.';
comment on column public.whatsapp_settings.window_days is 'Quantos dias à frente o preparo procura discursos (7 = próximo fim de semana).';

-- ── Quem pode enviar ─────────────────────────────────────────────────────
create table public.whatsapp_senders (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  primary key (tenant_id, user_id)
);

comment on table public.whatsapp_senders is 'Usuários autorizados a aprovar e enviar avisos. Owner e admin já são autorizados por padrão.';

-- ── Execuções do preparo ─────────────────────────────────────────────────
create table public.whatsapp_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  trigger_kind text not null default 'manual' check (trigger_kind in ('manual','cron')),
  mode text not null,
  reference_date date not null,
  window_end date not null,
  created_count integer not null default 0,
  updated_count integer not null default 0,
  skipped_count integer not null default 0,
  missing_contact_count integer not null default 0,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  started_by uuid references auth.users(id) on delete set null
);

create index whatsapp_runs_tenant_idx on public.whatsapp_runs (tenant_id, started_at desc);

-- ── Fila de mensagens (também é o log de envio) ──────────────────────────
create table public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  run_id uuid references public.whatsapp_runs(id) on delete set null,
  kind text not null check (kind in ('saida','visitante')),
  source_id integer not null,
  target_date date not null,
  recipient_name text not null default '',
  recipient_phone text not null default '',
  body text not null,
  status text not null default 'rascunho'
    check (status in ('rascunho','aprovado','enviado','falhou','cancelado','sem_contato')),
  dedupe_key text not null,
  provider_message_id text not null default '',
  error text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  sent_at timestamptz,
  sent_by uuid references auth.users(id) on delete set null
);

-- Trava de duplicidade: um aviso por arranjo, por data, por congregação.
create unique index whatsapp_messages_dedupe_idx on public.whatsapp_messages (tenant_id, dedupe_key);
create index whatsapp_messages_tenant_status_idx on public.whatsapp_messages (tenant_id, status, target_date);

comment on column public.whatsapp_messages.dedupe_key is 'tipo:id_do_arranjo:data — impede reenviar o mesmo aviso.';

-- ── Modelos padrão e criação da configuração ─────────────────────────────
create or replace function private.whatsapp_default_template(p_kind text)
returns text
language sql
immutable
as $function$
  select case p_kind
    when 'saida' then
      'Olá, {primeiro_nome}! 👋' || E'\n' ||
      'Lembrete do seu discurso deste fim de semana:' || E'\n\n' ||
      '📅 {data} ({dia_semana}) às {hora}' || E'\n' ||
      '🏠 {congregacao_destino}' || E'\n' ||
      '📍 {endereco}' || E'\n' ||
      '📑 Esboço {tema_numero} – {tema}' || E'\n' ||
      '👤 Contato: {contato}' || E'\n' ||
      '📞 {telefone_contato}' || E'\n\n' ||
      'Qualquer imprevisto, avise a {congregacao}. Obrigado!' || E'\n' ||
      '{responsavel}'
    else
      'Olá, {contato}! 👋' || E'\n' ||
      'Confirmando o discurso do irmão {orador} na {congregacao}:' || E'\n\n' ||
      '📅 {data} ({dia_semana}) às {hora}' || E'\n' ||
      '📑 Esboço {tema_numero} – {tema}' || E'\n' ||
      '📍 {endereco}' || E'\n\n' ||
      'Qualquer imprevisto, é só avisar. Obrigado!' || E'\n' ||
      '{responsavel}'
  end;
$function$;

create or replace function private.whatsapp_ensure_settings(p_tenant_id uuid)
returns void
language sql
security definer
set search_path = pg_catalog, public
as $function$
  insert into public.whatsapp_settings (tenant_id, template_saida, template_visitante)
  values (
    p_tenant_id,
    private.whatsapp_default_template('saida'),
    private.whatsapp_default_template('visitante')
  )
  on conflict (tenant_id) do nothing;
$function$;

insert into public.whatsapp_settings (tenant_id, template_saida, template_visitante)
select id, private.whatsapp_default_template('saida'), private.whatsapp_default_template('visitante')
from public.tenants
on conflict (tenant_id) do nothing;

create or replace function private.whatsapp_settings_for_new_tenant()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
begin
  perform private.whatsapp_ensure_settings(new.id);
  return new;
end;
$function$;

create trigger tenants_create_whatsapp_settings
after insert on public.tenants
for each row execute function private.whatsapp_settings_for_new_tenant();

-- ── Helpers ──────────────────────────────────────────────────────────────
create or replace function private.can_send_whatsapp(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select private.has_tenant_access(p_tenant_id, array['owner','admin'])
    or (
      private.has_tenant_access(p_tenant_id, null)
      and exists (
        select 1 from public.whatsapp_senders sender
        where sender.tenant_id = p_tenant_id and sender.user_id = auth.uid()
      )
    );
$function$;

-- Normaliza o celular para o formato aceito pelo WhatsApp (só dígitos, com DDI).
-- Devolve string vazia quando o número não é utilizável.
create or replace function private.whatsapp_phone(p_raw text, p_ddi text default '55')
returns text
language plpgsql
immutable
as $function$
declare
  v_digits text := regexp_replace(coalesce(p_raw, ''), '[^0-9]', '', 'g');
begin
  v_digits := regexp_replace(v_digits, '^0+', '');
  if v_digits = '' then return ''; end if;
  if length(v_digits) between 10 and 11 then
    return p_ddi || v_digits;
  end if;
  if length(v_digits) between 12 and 15 then
    return v_digits;
  end if;
  return '';
end;
$function$;

-- Substitui {chave} pelo valor. A linha inteira some quando o campo está
-- vazio, para não sobrar "📍" solto na mensagem.
create or replace function private.whatsapp_render(p_template text, p_vars jsonb)
returns text
language plpgsql
immutable
as $function$
declare
  v_text text := coalesce(p_template, '');
  v_item record;
begin
  for v_item in select key, coalesce(value, '') as value from jsonb_each_text(coalesce(p_vars, '{}'::jsonb)) loop
    if btrim(v_item.value) = '' then
      v_text := regexp_replace(v_text, '(^|\n)[^\n]*\{' || v_item.key || '\}[^\n]*', '', 'g');
    else
      v_text := replace(v_text, '{' || v_item.key || '}', v_item.value);
    end if;
  end loop;
  v_text := regexp_replace(v_text, E'\n{3,}', E'\n\n', 'g');
  return btrim(v_text);
end;
$function$;

create or replace function private.whatsapp_weekday_pt(p_date date)
returns text
language sql
immutable
as $function$
  select (array['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'])[
    extract(dow from p_date)::int + 1
  ];
$function$;

-- ── Preparo da fila ──────────────────────────────────────────────────────
create or replace function private.whatsapp_build_queue(
  p_tenant_id uuid,
  p_reference date,
  p_trigger text,
  p_actor uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_config public.whatsapp_settings%rowtype;
  v_tenant public.tenants%rowtype;
  v_run uuid;
  v_reference date := p_reference;
  v_window_end date;
  v_item record;
  v_vars jsonb;
  v_body text;
  v_phone text;
  v_recipient text;
  v_status text;
  v_target date;
  v_inserted boolean;
  v_result text;
  v_created integer := 0;
  v_updated integer := 0;
  v_skipped integer := 0;
  v_missing integer := 0;
begin
  select * into v_tenant from public.tenants where id = p_tenant_id;
  if not found then raise exception 'Congregação não encontrada'; end if;

  perform private.whatsapp_ensure_settings(p_tenant_id);
  select * into v_config from public.whatsapp_settings where tenant_id = p_tenant_id;

  if v_reference is null then
    v_reference := (now() at time zone v_tenant.timezone)::date;
  end if;
  v_window_end := v_reference + v_config.window_days;

  insert into public.whatsapp_runs (tenant_id, trigger_kind, mode, reference_date, window_end, started_by)
  values (p_tenant_id, p_trigger, v_config.mode, v_reference, v_window_end, p_actor)
  returning id into v_run;

  for v_item in
    select
      'saida'::text as kind,
      s.id as source_id,
      to_date(s.data, 'DD/MM/YYYY') as target_date,
      coalesce(nullif(btrim(orador.nome), ''), s.orador_nome, '') as pessoa,
      orador.cel as telefone,
      s.cong as cong_nome,
      coalesce(destino.hora, '') as hora,
      coalesce(destino."end", '') as endereco,
      coalesce(destino.contato, '') as contato,
      coalesce(destino.tel, '') as telefone_contato,
      esboco.n as tema_numero,
      coalesce(esboco.tema, '') as tema
    from public.saidas s
    left join public.oradores orador on orador.tenant_id = s.tenant_id and orador.id = s.orador_id
    left join public.esbocos esboco on esboco.tenant_id = s.tenant_id and esboco.id = s.esboco_id
    left join public.congregacoes destino on destino.tenant_id = s.tenant_id and destino.nome = s.cong
    where s.tenant_id = p_tenant_id
      and v_config.notify_saidas
      and s.status in ('confirmado','pendente')
      and s.data ~ '^\d{2}/\d{2}/\d{4}$'
      and to_date(s.data, 'DD/MM/YYYY') between v_reference and v_window_end

    union all

    select
      'visitante'::text as kind,
      v.id as source_id,
      to_date(v.data, 'DD/MM/YYYY') as target_date,
      coalesce(nullif(btrim(v.orador), ''), '') as pessoa,
      origem.tel as telefone,
      v.cong as cong_nome,
      coalesce(nullif(v.hora, ''), substring(v_tenant.meeting_time::text from 1 for 5)) as hora,
      v_tenant.address as endereco,
      coalesce(origem.contato, '') as contato,
      coalesce(origem.tel, '') as telefone_contato,
      esboco.n as tema_numero,
      coalesce(esboco.tema, '') as tema
    from public.visitantes v
    left join public.esbocos esboco on esboco.tenant_id = v.tenant_id and esboco.id = v.esboco_id
    left join public.congregacoes origem on origem.tenant_id = v.tenant_id and origem.nome = v.cong
    where v.tenant_id = p_tenant_id
      and v_config.notify_visitantes
      and v.status in ('confirmado','pendente')
      and v.data ~ '^\d{2}/\d{2}/\d{4}$'
      and to_date(v.data, 'DD/MM/YYYY') between v_reference and v_window_end

    order by 3, 1, 2
  loop
    v_target := v_item.target_date;
    v_phone := private.whatsapp_phone(v_item.telefone);

    if v_item.kind = 'saida' then
      v_recipient := v_item.pessoa;
      v_vars := jsonb_build_object(
        'orador', v_item.pessoa,
        'primeiro_nome', split_part(v_item.pessoa, ' ', 1),
        'data', to_char(v_target, 'DD/MM/YYYY'),
        'dia_semana', private.whatsapp_weekday_pt(v_target),
        'hora', v_item.hora,
        'congregacao_destino', v_item.cong_nome,
        'endereco', v_item.endereco,
        'contato', v_item.contato,
        'telefone_contato', v_item.telefone_contato,
        'tema_numero', coalesce(v_item.tema_numero::text, ''),
        'tema', v_item.tema,
        'congregacao', v_tenant.name,
        'responsavel', v_config.sender_label
      );
      v_body := private.whatsapp_render(v_config.template_saida, v_vars);
    else
      v_recipient := coalesce(nullif(v_item.contato, ''), v_item.cong_nome);
      v_vars := jsonb_build_object(
        'orador', v_item.pessoa,
        'primeiro_nome', split_part(v_item.pessoa, ' ', 1),
        'contato', v_item.contato,
        'data', to_char(v_target, 'DD/MM/YYYY'),
        'dia_semana', private.whatsapp_weekday_pt(v_target),
        'hora', v_item.hora,
        'congregacao', v_tenant.name,
        'congregacao_visitante', v_item.cong_nome,
        'endereco', v_item.endereco,
        'tema_numero', coalesce(v_item.tema_numero::text, ''),
        'tema', v_item.tema,
        'responsavel', v_config.sender_label
      );
      v_body := private.whatsapp_render(v_config.template_visitante, v_vars);
    end if;

    if v_phone = '' then
      v_status := 'sem_contato';
    elsif v_config.mode = 'automatico' then
      v_status := 'aprovado';
    else
      v_status := 'rascunho';
    end if;

    insert into public.whatsapp_messages (
      tenant_id, run_id, kind, source_id, target_date,
      recipient_name, recipient_phone, body, status, dedupe_key,
      approved_at, approved_by
    )
    values (
      p_tenant_id, v_run, v_item.kind, v_item.source_id, v_target,
      v_recipient, v_phone, v_body, v_status,
      v_item.kind || ':' || v_item.source_id || ':' || to_char(v_target, 'YYYY-MM-DD'),
      case when v_status = 'aprovado' then now() end,
      case when v_status = 'aprovado' then p_actor end
    )
    on conflict (tenant_id, dedupe_key) do update
      set run_id = excluded.run_id,
          recipient_name = excluded.recipient_name,
          recipient_phone = excluded.recipient_phone,
          body = excluded.body,
          -- Aviso aprovado que mudou de conteúdo volta para revisão.
          status = case
            when whatsapp_messages.status = 'aprovado'
              and whatsapp_messages.body is distinct from excluded.body
              and excluded.status <> 'aprovado'
            then 'rascunho'
            when whatsapp_messages.status in ('rascunho','aprovado','sem_contato','falhou','cancelado')
            then excluded.status
            else whatsapp_messages.status
          end,
          -- A marca de aprovação acompanha a situação resultante.
          approved_at = case
            when whatsapp_messages.status = 'aprovado'
              and whatsapp_messages.body is distinct from excluded.body
              and excluded.status <> 'aprovado'
            then null
            when whatsapp_messages.status = 'aprovado'
              and whatsapp_messages.body is not distinct from excluded.body
            then whatsapp_messages.approved_at
            else excluded.approved_at
          end,
          approved_by = case
            when whatsapp_messages.status = 'aprovado'
              and whatsapp_messages.body is distinct from excluded.body
              and excluded.status <> 'aprovado'
            then null
            when whatsapp_messages.status = 'aprovado'
              and whatsapp_messages.body is not distinct from excluded.body
            then whatsapp_messages.approved_by
            else excluded.approved_by
          end,
          error = '',
          updated_at = now()
      -- Trava principal: aviso já enviado não é tocado.
      where whatsapp_messages.status <> 'enviado'
      returning (xmax = 0), status into v_inserted, v_result;

    if v_inserted is null then
      v_skipped := v_skipped + 1;
    else
      if v_inserted then
        v_created := v_created + 1;
      else
        v_updated := v_updated + 1;
      end if;
      if v_result = 'sem_contato' then v_missing := v_missing + 1; end if;
    end if;
  end loop;

  update public.whatsapp_runs
  set created_count = v_created,
      updated_count = v_updated,
      skipped_count = v_skipped,
      missing_contact_count = v_missing,
      finished_at = now()
  where id = v_run;

  return v_run;
end;
$function$;

-- ── RPCs do aplicativo ───────────────────────────────────────────────────
create or replace function public.whatsapp_preparar(p_tenant_id uuid, p_reference date default null)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  if not private.can_send_whatsapp(p_tenant_id) then
    raise exception 'Sem permissão para preparar avisos desta congregação';
  end if;
  return private.whatsapp_build_queue(p_tenant_id, p_reference, 'manual', auth.uid());
end;
$function$;

create or replace function public.whatsapp_atualizar_mensagem(
  p_message_id uuid,
  p_body text default null,
  p_phone text default null
)
returns public.whatsapp_messages
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_row public.whatsapp_messages%rowtype;
  v_phone text;
begin
  select * into v_row from public.whatsapp_messages where id = p_message_id;
  if not found then raise exception 'Aviso não encontrado'; end if;
  if not private.can_send_whatsapp(v_row.tenant_id) then
    raise exception 'Sem permissão para editar avisos desta congregação';
  end if;
  if v_row.status = 'enviado' then raise exception 'Aviso já enviado não pode ser alterado'; end if;

  if p_phone is null then
    v_phone := v_row.recipient_phone;
  else
    v_phone := private.whatsapp_phone(p_phone);
    if btrim(p_phone) <> '' and v_phone = '' then
      raise exception 'Número de WhatsApp inválido: %', p_phone;
    end if;
  end if;

  update public.whatsapp_messages
  set body = coalesce(nullif(btrim(p_body), ''), body),
      recipient_phone = v_phone,
      status = case
        when v_phone = '' then 'sem_contato'
        when status = 'sem_contato' then 'rascunho'
        when status = 'aprovado' and p_body is not null then 'rascunho'
        else status
      end,
      approved_at = case when status = 'aprovado' and p_body is not null then null else approved_at end,
      updated_at = now()
  where id = p_message_id
  returning * into v_row;

  return v_row;
end;
$function$;

create or replace function public.whatsapp_definir_status(
  p_message_ids uuid[],
  p_status text,
  p_provider_message_id text default '',
  p_error text default ''
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_affected integer := 0;
  v_tenants uuid[];
  v_tenant uuid;
begin
  if p_status not in ('rascunho','aprovado','enviado','falhou','cancelado') then
    raise exception 'Situação inválida: %', p_status;
  end if;

  select array_agg(distinct tenant_id) into v_tenants
  from public.whatsapp_messages where id = any(p_message_ids);

  if v_tenants is null then return 0; end if;
  foreach v_tenant in array v_tenants loop
    if not private.can_send_whatsapp(v_tenant) then
      raise exception 'Sem permissão para alterar avisos desta congregação';
    end if;
  end loop;

  update public.whatsapp_messages
  set status = p_status,
      provider_message_id = case when p_status = 'enviado' and coalesce(p_provider_message_id, '') <> ''
                                 then p_provider_message_id else provider_message_id end,
      error = case when p_status = 'falhou' then coalesce(p_error, '') else '' end,
      approved_at = case when p_status = 'aprovado' then now() else approved_at end,
      approved_by = case when p_status = 'aprovado' then auth.uid() else approved_by end,
      sent_at = case when p_status = 'enviado' then now() else sent_at end,
      sent_by = case when p_status = 'enviado' then auth.uid() else sent_by end,
      updated_at = now()
  where id = any(p_message_ids)
    -- Travas: nada reescreve um aviso enviado, e nada é aprovado/enviado sem número.
    and status <> 'enviado'
    and (p_status not in ('aprovado','enviado') or recipient_phone <> '');
  get diagnostics v_affected = row_count;
  return v_affected;
end;
$function$;

create or replace function public.whatsapp_salvar_config(
  p_tenant_id uuid,
  p_enabled boolean,
  p_mode text,
  p_provider text,
  p_sender_label text,
  p_sender_phone text,
  p_provider_phone_id text,
  p_run_weekday smallint,
  p_run_time time,
  p_window_days smallint,
  p_notify_saidas boolean,
  p_notify_visitantes boolean,
  p_template_saida text,
  p_template_visitante text
)
returns public.whatsapp_settings
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_row public.whatsapp_settings%rowtype;
  v_phone text;
begin
  if not (private.has_tenant_access(p_tenant_id, array['owner','admin']) or private.is_platform_admin()) then
    raise exception 'Somente responsáveis da congregação alteram a configuração';
  end if;
  perform private.whatsapp_ensure_settings(p_tenant_id);

  if p_sender_phone is not null then
    v_phone := private.whatsapp_phone(p_sender_phone);
    if btrim(p_sender_phone) <> '' and v_phone = '' then
      raise exception 'Número do remetente inválido: %', p_sender_phone;
    end if;
  end if;

  update public.whatsapp_settings
  set enabled = coalesce(p_enabled, enabled),
      mode = coalesce(p_mode, mode),
      provider = coalesce(p_provider, provider),
      sender_label = coalesce(btrim(p_sender_label), sender_label),
      sender_phone = coalesce(v_phone, sender_phone),
      provider_phone_id = coalesce(btrim(p_provider_phone_id), provider_phone_id),
      run_weekday = coalesce(p_run_weekday, run_weekday),
      run_time = coalesce(p_run_time, run_time),
      window_days = coalesce(p_window_days, window_days),
      notify_saidas = coalesce(p_notify_saidas, notify_saidas),
      notify_visitantes = coalesce(p_notify_visitantes, notify_visitantes),
      template_saida = coalesce(nullif(btrim(p_template_saida), ''), template_saida),
      template_visitante = coalesce(nullif(btrim(p_template_visitante), ''), template_visitante),
      updated_at = now(),
      updated_by = auth.uid()
  where tenant_id = p_tenant_id
  returning * into v_row;

  return v_row;
end;
$function$;

create or replace function public.whatsapp_definir_remetente(
  p_tenant_id uuid,
  p_user_id uuid,
  p_allowed boolean
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_affected integer := 0;
begin
  if not (private.has_tenant_access(p_tenant_id, array['owner','admin']) or private.is_platform_admin()) then
    raise exception 'Somente responsáveis da congregação definem quem envia';
  end if;
  if not exists (
    select 1 from public.tenant_memberships membership
    where membership.tenant_id = p_tenant_id and membership.user_id = p_user_id and membership.active
  ) then
    raise exception 'Usuário não pertence a esta congregação';
  end if;

  if p_allowed then
    insert into public.whatsapp_senders (tenant_id, user_id, created_by)
    values (p_tenant_id, p_user_id, auth.uid())
    on conflict (tenant_id, user_id) do nothing;
  else
    delete from public.whatsapp_senders where tenant_id = p_tenant_id and user_id = p_user_id;
  end if;
  get diagnostics v_affected = row_count;
  return v_affected;
end;
$function$;

-- Lista os membros da congregação com a marcação de quem pode enviar.
-- Só o responsável enxerga, porque devolve o e-mail de cada conta.
create or replace function public.whatsapp_membros(p_tenant_id uuid)
returns table (user_id uuid, email text, role text, can_send boolean)
language sql
security definer
set search_path = pg_catalog, public
as $function$
  select
    membership.user_id,
    lower(account.email) as email,
    membership.role,
    exists (
      select 1 from public.whatsapp_senders sender
      where sender.tenant_id = membership.tenant_id and sender.user_id = membership.user_id
    ) or membership.role in ('owner','admin') as can_send
  from public.tenant_memberships membership
  join auth.users account on account.id = membership.user_id
  where membership.tenant_id = p_tenant_id
    and membership.active
    and (private.has_tenant_access(p_tenant_id, array['owner','admin']) or private.is_platform_admin())
  order by membership.role, lower(account.email);
$function$;

-- ── Preparo agendado ─────────────────────────────────────────────────────
-- Roda de hora em hora e prepara a fila apenas da congregação cujo dia e
-- hora locais bateram, no máximo uma vez por dia.
create or replace function private.whatsapp_cron_tick()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_item record;
  v_local timestamp;
  v_processed integer := 0;
begin
  for v_item in
    select config.tenant_id, config.run_weekday, config.run_time, tenant.timezone
    from public.whatsapp_settings config
    join public.tenants tenant on tenant.id = config.tenant_id
    where config.enabled
  loop
    v_local := now() at time zone v_item.timezone;
    continue when extract(dow from v_local)::int <> v_item.run_weekday;
    continue when extract(hour from v_local)::int <> extract(hour from v_item.run_time)::int;
    continue when exists (
      select 1 from public.whatsapp_runs previous
      where previous.tenant_id = v_item.tenant_id
        and previous.trigger_kind = 'cron'
        and previous.started_at > now() - interval '20 hours'
    );

    perform private.whatsapp_build_queue(v_item.tenant_id, v_local::date, 'cron', null);
    v_processed := v_processed + 1;
  end loop;
  return v_processed;
end;
$function$;

do $cron$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      if exists (select 1 from cron.job where jobname = 'whatsapp-tick') then
        perform cron.unschedule('whatsapp-tick');
      end if;
      perform cron.schedule('whatsapp-tick', '5 * * * *', 'select private.whatsapp_cron_tick();');
    exception when others then
      raise notice 'pg_cron presente mas não foi possível agendar whatsapp-tick: %', sqlerrm;
    end;
  else
    raise notice 'pg_cron ausente: agende private.whatsapp_cron_tick() manualmente (ver docs/WHATSAPP.md).';
  end if;
end
$cron$;

-- ── RLS e permissões ─────────────────────────────────────────────────────
alter table public.whatsapp_settings enable row level security;
alter table public.whatsapp_senders enable row level security;
alter table public.whatsapp_runs enable row level security;
alter table public.whatsapp_messages enable row level security;

create policy whatsapp_settings_select on public.whatsapp_settings for select to authenticated
using (private.has_tenant_access(tenant_id, null) or private.is_platform_admin());

create policy whatsapp_senders_select on public.whatsapp_senders for select to authenticated
using (private.has_tenant_access(tenant_id, null) or private.is_platform_admin());

create policy whatsapp_runs_select on public.whatsapp_runs for select to authenticated
using (private.has_tenant_access(tenant_id, null) or private.is_platform_admin());

create policy whatsapp_messages_select on public.whatsapp_messages for select to authenticated
using (private.has_tenant_access(tenant_id, null) or private.is_platform_admin());

revoke all on public.whatsapp_settings, public.whatsapp_senders, public.whatsapp_runs, public.whatsapp_messages
  from anon, authenticated;
-- Escrita só pelas funções acima, que checam permissão antes de gravar.
grant select on public.whatsapp_settings, public.whatsapp_senders, public.whatsapp_runs, public.whatsapp_messages
  to authenticated;

revoke all on function private.whatsapp_build_queue(uuid, date, text, uuid) from public, anon, authenticated;
revoke all on function private.whatsapp_cron_tick() from public, anon, authenticated;
revoke all on function private.whatsapp_ensure_settings(uuid) from public, anon, authenticated;
revoke all on function private.can_send_whatsapp(uuid) from public, anon;
grant execute on function private.can_send_whatsapp(uuid) to authenticated;

revoke all on function public.whatsapp_preparar(uuid, date) from public, anon;
revoke all on function public.whatsapp_atualizar_mensagem(uuid, text, text) from public, anon;
revoke all on function public.whatsapp_definir_status(uuid[], text, text, text) from public, anon;
revoke all on function public.whatsapp_salvar_config(uuid, boolean, text, text, text, text, text, smallint, time, smallint, boolean, boolean, text, text) from public, anon;
revoke all on function public.whatsapp_definir_remetente(uuid, uuid, boolean) from public, anon;
revoke all on function public.whatsapp_membros(uuid) from public, anon;

grant execute on function public.whatsapp_preparar(uuid, date) to authenticated;
grant execute on function public.whatsapp_atualizar_mensagem(uuid, text, text) to authenticated;
grant execute on function public.whatsapp_definir_status(uuid[], text, text, text) to authenticated;
grant execute on function public.whatsapp_salvar_config(uuid, boolean, text, text, text, text, text, smallint, time, smallint, boolean, boolean, text, text) to authenticated;
grant execute on function public.whatsapp_definir_remetente(uuid, uuid, boolean) to authenticated;
grant execute on function public.whatsapp_membros(uuid) to authenticated;

commit;
