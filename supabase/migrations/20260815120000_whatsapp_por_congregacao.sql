-- Arranjo de Oradores: avisos de WhatsApp isolados por congregação.
--
-- O módulo apenas LÊ as estruturas que já existem (saidas, visitantes,
-- oradores, congregacoes, esbocos, tenants). Não há cadastro paralelo de
-- discurso, orador ou congregação — só duas colunas novas nas tabelas
-- existentes, para dados de contato que faltavam.
--
-- O preparo é idempotente: um aviso já enviado nunca é regerado nem reescrito.

begin;

-- ── Colunas que faltavam nas tabelas existentes ──────────────────────────
-- O telefone geral da congregação pode ser um fixo do Salão; este é o
-- WhatsApp de quem recebe o lembrete.
alter table public.congregacoes add column whatsapp text not null default '';
comment on column public.congregacoes.whatsapp is 'WhatsApp do responsável pelo recebimento dos lembretes. Vazio = usa o telefone geral (tel) como reserva.';

-- O orador visitante é texto livre no registro do discurso; o telefone dele
-- pertence ao mesmo registro, não a um cadastro novo.
alter table public.visitantes add column orador_tel text not null default '';
comment on column public.visitantes.orador_tel is 'WhatsApp do orador visitante, quando conhecido.';

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
  extra_meeting_days smallint[] not null default '{}',
  notify_saidas boolean not null default true,
  notify_visitantes boolean not null default true,
  destino_saida text not null default 'orador' check (destino_saida in ('orador','responsavel','ambos')),
  destino_visitante text not null default 'responsavel' check (destino_visitante in ('orador','responsavel','ambos')),
  template_saida_orador text not null default '',
  template_saida_responsavel text not null default '',
  template_visitante_orador text not null default '',
  template_visitante_responsavel text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  -- Trava: envio automático exige um provedor de verdade.
  constraint whatsapp_settings_auto_needs_provider
    check (mode <> 'automatico' or provider <> 'manual'),
  constraint whatsapp_settings_extra_days_validos
    check (extra_meeting_days <@ array[0,1,2,3,4,5,6]::smallint[])
);

comment on table public.whatsapp_settings is 'Configuração de avisos de WhatsApp de cada congregação.';
comment on column public.whatsapp_settings.mode is 'previa: monta a fila para revisão manual. automatico: a fila já sai aprovada para o disparador (bloqueado até o C5).';
comment on column public.whatsapp_settings.window_days is 'Horizonte de busca: até quantos dias à frente procurar o próximo dia de reunião.';
comment on column public.whatsapp_settings.extra_meeting_days is 'Dias de reunião adicionais (0=domingo … 6=sábado) além de tenants.meeting_day.';
comment on column public.whatsapp_settings.sender_phone is 'Número de referência da congregação. No modo manual o envio sai pelo WhatsApp do aparelho de quem clica; este número é apenas registro.';

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
  target_dates date[] not null default '{}',
  analyzed_count integer not null default 0,
  created_count integer not null default 0,
  updated_count integer not null default 0,
  skipped_count integer not null default 0,
  missing_contact_count integer not null default 0,
  invalid_date_count integer not null default 0,
  cancelled_count integer not null default 0,
  issues jsonb not null default '[]'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  started_by uuid references auth.users(id) on delete set null
);

create index whatsapp_runs_tenant_idx on public.whatsapp_runs (tenant_id, started_at desc);

comment on column public.whatsapp_runs.issues is 'Pendências localizáveis: registro com data inválida ou destinatário sem telefone.';

-- ── Fila de mensagens (também é o log de envio) ──────────────────────────
create table public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  run_id uuid references public.whatsapp_runs(id) on delete set null,
  kind text not null check (kind in ('saida','visitante')),
  recipient_role text not null check (recipient_role in ('orador','responsavel')),
  source_id integer not null,
  target_date date not null,
  recipient_name text not null default '',
  recipient_phone text not null default '',
  phone_fallback boolean not null default false,
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

-- Trava de duplicidade: um aviso por arranjo, por data, por destinatário.
create unique index whatsapp_messages_dedupe_idx on public.whatsapp_messages (tenant_id, dedupe_key);
create index whatsapp_messages_tenant_status_idx on public.whatsapp_messages (tenant_id, status, target_date);

comment on column public.whatsapp_messages.dedupe_key is 'tipo:id_do_arranjo:data:papel — impede reenviar o mesmo aviso.';
comment on column public.whatsapp_messages.phone_fallback is 'true quando o número veio do telefone geral da congregação, e não do campo de WhatsApp do responsável.';

-- ── Modelos padrão e criação da configuração ─────────────────────────────
create or replace function private.whatsapp_default_template(p_kind text, p_role text)
returns text
language sql
immutable
as $function$
  select case p_kind || ':' || p_role
    when 'saida:orador' then
      'Olá, {primeiro_nome}! 👋' || E'\n' ||
      'Lembrete do seu discurso:' || E'\n\n' ||
      '📅 {data} ({dia_semana}) às {horario}' || E'\n' ||
      '🏠 {congregacao_destino}' || E'\n' ||
      '📍 {endereco}' || E'\n' ||
      '📑 Esboço {tema_numero} – {tema}' || E'\n' ||
      '👤 Contato: {contato}' || E'\n' ||
      '📞 {telefone_contato}' || E'\n\n' ||
      'Qualquer imprevisto, avise a {congregacao_origem}. Obrigado!' || E'\n' ||
      '{responsavel}'
    when 'saida:responsavel' then
      'Olá, {contato}! 👋' || E'\n' ||
      'Confirmando o orador da {congregacao_origem} aí na {congregacao_destino}:' || E'\n\n' ||
      '🎤 {nome_orador}' || E'\n' ||
      '📅 {data} ({dia_semana}) às {horario}' || E'\n' ||
      '📑 Esboço {tema_numero} – {tema}' || E'\n\n' ||
      'Qualquer imprevisto, é só avisar. Obrigado!' || E'\n' ||
      '{responsavel}'
    when 'visitante:orador' then
      'Olá, {primeiro_nome}! 👋' || E'\n' ||
      'Confirmando o seu discurso na {congregacao_destino}:' || E'\n\n' ||
      '📅 {data} ({dia_semana}) às {horario}' || E'\n' ||
      '📍 {endereco}' || E'\n' ||
      '📑 Esboço {tema_numero} – {tema}' || E'\n\n' ||
      'Qualquer imprevisto, é só avisar. Obrigado!' || E'\n' ||
      '{responsavel}'
    else
      'Olá, {contato}! 👋' || E'\n' ||
      'Confirmando o discurso do irmão {nome_orador}, da {congregacao_origem}, na {congregacao_destino}:' || E'\n\n' ||
      '📅 {data} ({dia_semana}) às {horario}' || E'\n' ||
      '📍 {endereco}' || E'\n' ||
      '📑 Esboço {tema_numero} – {tema}' || E'\n\n' ||
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
  insert into public.whatsapp_settings (
    tenant_id, template_saida_orador, template_saida_responsavel,
    template_visitante_orador, template_visitante_responsavel
  )
  values (
    p_tenant_id,
    private.whatsapp_default_template('saida','orador'),
    private.whatsapp_default_template('saida','responsavel'),
    private.whatsapp_default_template('visitante','orador'),
    private.whatsapp_default_template('visitante','responsavel')
  )
  on conflict (tenant_id) do nothing;
$function$;

insert into public.whatsapp_settings (
  tenant_id, template_saida_orador, template_saida_responsavel,
  template_visitante_orador, template_visitante_responsavel
)
select id,
  private.whatsapp_default_template('saida','orador'),
  private.whatsapp_default_template('saida','responsavel'),
  private.whatsapp_default_template('visitante','orador'),
  private.whatsapp_default_template('visitante','responsavel')
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

-- ── C5-lite: envio automático bloqueado até o isolamento de credenciais ──
-- A credencial do provedor ainda é única para toda a instalação, então uma
-- congregação poderia disparar usando o número de outra. Enquanto o C5 não
-- existir, só o administrador da plataforma liga o automático — e a trava
-- fica no banco, não na interface.
create or replace function private.whatsapp_guard_modo_automatico()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  if new.mode = 'automatico' and not private.is_platform_admin() then
    raise exception
      'Envio automático está bloqueado até o isolamento das credenciais do provedor por congregação (C5). Use o modo prévia com envio manual.'
      using errcode = '42501';
  end if;
  return new;
end;
$function$;

create trigger whatsapp_settings_guard_automatico
before insert or update on public.whatsapp_settings
for each row execute function private.whatsapp_guard_modo_automatico();

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

-- Converte o dia de reunião gravado em texto ('Sábado', 'Segunda-feira', 'Sáb')
-- no índice usado por extract(dow). Sábado é a reserva histórica do sistema.
create or replace function private.whatsapp_weekday_index(p_dia text)
returns smallint
language sql
immutable
as $function$
  select case left(lower(translate(coalesce(btrim(p_dia), ''),
      'áàâãéêíóôõúüçÁÀÂÃÉÊÍÓÔÕÚÜÇ', 'aaaaeeiooouucAAAAEEIOOOUUC')), 3)
    when 'dom' then 0
    when 'seg' then 1
    when 'ter' then 2
    when 'qua' then 3
    when 'qui' then 4
    when 'sex' then 5
    when 'sab' then 6
    else 6
  end::smallint;
$function$;

-- Data válida no formato dd/mm/aaaa. Rejeita '32/13/2026', que o to_date
-- aceitaria rolando para o mês seguinte.
create or replace function private.whatsapp_parse_date(p_text text)
returns date
language plpgsql
immutable
as $function$
declare
  v_date date;
begin
  if coalesce(p_text, '') !~ '^\d{2}/\d{2}/\d{4}$' then return null; end if;
  begin
    v_date := to_date(p_text, 'DD/MM/YYYY');
  exception when others then
    return null;
  end;
  if to_char(v_date, 'DD/MM/YYYY') <> p_text then return null; end if;
  return v_date;
end;
$function$;

-- Próxima ocorrência de cada dia de reunião, dentro do horizonte.
create or replace function private.whatsapp_target_dates(
  p_reference date,
  p_days smallint[],
  p_horizon smallint
)
returns date[]
language sql
immutable
as $function$
  select coalesce(array_agg(distinct alvo order by alvo), '{}'::date[])
  from (
    select p_reference + ((dia::int - extract(dow from p_reference)::int + 7) % 7) as alvo
    from unnest(coalesce(p_days, '{}'::smallint[])) as dia
  ) candidatos
  where alvo <= p_reference + p_horizon;
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
  v_days smallint[];
  v_targets date[];
  v_item record;
  v_bad record;
  v_role text;
  v_roles text[];
  v_destino text;
  v_vars jsonb;
  v_body text;
  v_template text;
  v_phone text;
  v_phone_raw text;
  v_fallback boolean;
  v_recipient text;
  v_status text;
  v_inserted boolean;
  v_result text;
  v_origem text;
  v_destino_nome text;
  v_analyzed integer := 0;
  v_created integer := 0;
  v_updated integer := 0;
  v_skipped integer := 0;
  v_missing integer := 0;
  v_invalid integer := 0;
  v_cancelled integer := 0;
  v_issues jsonb := '[]'::jsonb;
begin
  select * into v_tenant from public.tenants where id = p_tenant_id;
  if not found then raise exception 'Congregação não encontrada'; end if;

  perform private.whatsapp_ensure_settings(p_tenant_id);
  select * into v_config from public.whatsapp_settings where tenant_id = p_tenant_id;

  if v_reference is null then
    v_reference := (now() at time zone v_tenant.timezone)::date;
  end if;

  -- C1: o alvo são os dias de reunião desta congregação, não uma janela cega.
  select array_agg(distinct dia) into v_days
  from unnest(
    array[private.whatsapp_weekday_index(v_tenant.meeting_day)] || v_config.extra_meeting_days
  ) as dia;
  v_targets := private.whatsapp_target_dates(v_reference, v_days, v_config.window_days);

  insert into public.whatsapp_runs (tenant_id, trigger_kind, mode, reference_date, target_dates, started_by)
  values (p_tenant_id, p_trigger, v_config.mode, v_reference, v_targets, p_actor)
  returning id into v_run;

  -- C9: arranjos com data ilegível não geram aviso, mas ficam localizáveis.
  for v_bad in
    select 'saida'::text as kind, s.id, s.data, s.cong, s.orador_nome as quem
    from public.saidas s
    where s.tenant_id = p_tenant_id and v_config.notify_saidas
      and s.status in ('confirmado','pendente')
      and private.whatsapp_parse_date(s.data) is null
    union all
    select 'visitante'::text, v.id, v.data, v.cong, v.orador
    from public.visitantes v
    where v.tenant_id = p_tenant_id and v_config.notify_visitantes
      and v.status in ('confirmado','pendente')
      and private.whatsapp_parse_date(v.data) is null
    order by 1, 2
  loop
    v_invalid := v_invalid + 1;
    v_analyzed := v_analyzed + 1;
    v_issues := v_issues || jsonb_build_object(
      'motivo', 'data_invalida',
      'tipo', v_bad.kind,
      'registro_id', v_bad.id,
      'data', v_bad.data,
      'congregacao', v_bad.cong,
      'quem', v_bad.quem
    );
  end loop;

  for v_item in
    select
      'saida'::text as kind,
      s.id as source_id,
      private.whatsapp_parse_date(s.data) as target_date,
      coalesce(nullif(btrim(orador.nome), ''), s.orador_nome, '') as orador_nome,
      coalesce(orador.cel, '') as orador_tel,
      s.cong as cong_nome,
      coalesce(destino.contato, '') as cong_contato,
      coalesce(destino.whatsapp, '') as cong_whatsapp,
      coalesce(destino.tel, '') as cong_tel,
      coalesce(destino.hora, '') as hora,
      coalesce(destino."end", '') as endereco,
      esboco.n as tema_numero,
      coalesce(esboco.tema, '') as tema
    from public.saidas s
    left join public.oradores orador on orador.tenant_id = s.tenant_id and orador.id = s.orador_id
    left join public.esbocos esboco on esboco.tenant_id = s.tenant_id and esboco.id = s.esboco_id
    left join public.congregacoes destino on destino.tenant_id = s.tenant_id and destino.nome = s.cong
    where s.tenant_id = p_tenant_id
      and v_config.notify_saidas
      and s.status in ('confirmado','pendente')
      and private.whatsapp_parse_date(s.data) = any(v_targets)

    union all

    select
      'visitante'::text as kind,
      v.id as source_id,
      private.whatsapp_parse_date(v.data) as target_date,
      coalesce(nullif(btrim(v.orador), ''), '') as orador_nome,
      coalesce(v.orador_tel, '') as orador_tel,
      v.cong as cong_nome,
      coalesce(origem.contato, '') as cong_contato,
      coalesce(origem.whatsapp, '') as cong_whatsapp,
      coalesce(origem.tel, '') as cong_tel,
      coalesce(nullif(v.hora, ''), substring(v_tenant.meeting_time::text from 1 for 5)) as hora,
      v_tenant.address as endereco,
      esboco.n as tema_numero,
      coalesce(esboco.tema, '') as tema
    from public.visitantes v
    left join public.esbocos esboco on esboco.tenant_id = v.tenant_id and esboco.id = v.esboco_id
    left join public.congregacoes origem on origem.tenant_id = v.tenant_id and origem.nome = v.cong
    where v.tenant_id = p_tenant_id
      and v_config.notify_visitantes
      and v.status in ('confirmado','pendente')
      and private.whatsapp_parse_date(v.data) = any(v_targets)

    order by 3, 1, 2
  loop
    v_analyzed := v_analyzed + 1;

    if v_item.kind = 'saida' then
      v_destino := v_config.destino_saida;
      v_origem := v_tenant.name;
      v_destino_nome := v_item.cong_nome;
    else
      v_destino := v_config.destino_visitante;
      v_origem := v_item.cong_nome;
      v_destino_nome := v_tenant.name;
    end if;

    v_roles := case v_destino when 'ambos' then array['orador','responsavel'] else array[v_destino] end;

    foreach v_role in array v_roles loop
      if v_role = 'orador' then
        v_recipient := v_item.orador_nome;
        v_phone_raw := v_item.orador_tel;
        v_fallback := false;
      else
        v_recipient := coalesce(nullif(v_item.cong_contato, ''), v_item.cong_nome);
        -- C3: o WhatsApp do responsável vem primeiro; o telefone geral é reserva.
        if btrim(v_item.cong_whatsapp) <> '' then
          v_phone_raw := v_item.cong_whatsapp;
          v_fallback := false;
        else
          v_phone_raw := v_item.cong_tel;
          v_fallback := btrim(v_item.cong_tel) <> '';
        end if;
      end if;

      v_phone := private.whatsapp_phone(v_phone_raw);

      v_vars := jsonb_build_object(
        'nome_orador', v_item.orador_nome,
        'orador', v_item.orador_nome,
        'primeiro_nome', split_part(v_item.orador_nome, ' ', 1),
        'data', to_char(v_item.target_date, 'DD/MM/YYYY'),
        'dia_semana', private.whatsapp_weekday_pt(v_item.target_date),
        'horario', v_item.hora,
        'hora', v_item.hora,
        'congregacao_origem', v_origem,
        'congregacao_destino', v_destino_nome,
        'congregacao', v_tenant.name,
        'congregacao_visitante', v_item.cong_nome,
        'tipo_discurso', case when v_item.kind = 'saida'
          then 'Discurso público — saída' else 'Discurso público — visitante' end,
        'tema', v_item.tema,
        'tema_numero', coalesce(v_item.tema_numero::text, ''),
        'endereco', v_item.endereco,
        'contato', v_item.cong_contato,
        'telefone_contato', case when v_role = 'orador' then v_item.cong_tel else '' end,
        'responsavel', v_config.sender_label
      );

      v_template := case v_item.kind || ':' || v_role
        when 'saida:orador' then v_config.template_saida_orador
        when 'saida:responsavel' then v_config.template_saida_responsavel
        when 'visitante:orador' then v_config.template_visitante_orador
        else v_config.template_visitante_responsavel
      end;
      v_body := private.whatsapp_render(v_template, v_vars);

      if v_phone = '' then
        v_status := 'sem_contato';
      elsif v_config.mode = 'automatico' then
        v_status := 'aprovado';
      else
        v_status := 'rascunho';
      end if;

      insert into public.whatsapp_messages (
        tenant_id, run_id, kind, recipient_role, source_id, target_date,
        recipient_name, recipient_phone, phone_fallback, body, status, dedupe_key,
        approved_at, approved_by
      )
      values (
        p_tenant_id, v_run, v_item.kind, v_role, v_item.source_id, v_item.target_date,
        v_recipient, v_phone, v_fallback, v_body, v_status,
        -- C2: o papel entra na chave, senão "ambos" colidiria consigo mesmo.
        v_item.kind || ':' || v_item.source_id || ':' ||
          to_char(v_item.target_date, 'YYYY-MM-DD') || ':' || v_role,
        case when v_status = 'aprovado' then now() end,
        case when v_status = 'aprovado' then p_actor end
      )
      on conflict (tenant_id, dedupe_key) do update
        set run_id = excluded.run_id,
            recipient_name = excluded.recipient_name,
            recipient_phone = excluded.recipient_phone,
            phone_fallback = excluded.phone_fallback,
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
        if v_result = 'sem_contato' then
          v_missing := v_missing + 1;
          v_issues := v_issues || jsonb_build_object(
            'motivo', 'sem_telefone',
            'tipo', v_item.kind,
            'registro_id', v_item.source_id,
            'papel', v_role,
            'data', to_char(v_item.target_date, 'DD/MM/YYYY'),
            'congregacao', v_item.cong_nome,
            'quem', v_recipient
          );
        end if;
      end if;
    end loop;
  end loop;

  -- Rascunho que este preparo não reencontrou ficou obsoleto: o arranjo foi
  -- cancelado, ou a congregação mudou o destinatário. Sai da fila sozinho.
  -- Nada aprovado ou enviado é tocado aqui.
  update public.whatsapp_messages
  set status = 'cancelado', updated_at = now()
  where tenant_id = p_tenant_id
    and target_date = any(v_targets)
    and status in ('rascunho','sem_contato')
    and run_id is distinct from v_run;
  get diagnostics v_cancelled = row_count;

  -- Um aviso já aprovado que ficou obsoleto exige decisão humana: só avisamos.
  for v_bad in
    select m.kind, m.source_id as id, m.recipient_name as quem, m.recipient_role as papel,
           to_char(m.target_date, 'DD/MM/YYYY') as data, '' as cong
    from public.whatsapp_messages m
    where m.tenant_id = p_tenant_id
      and m.target_date = any(v_targets)
      and m.status = 'aprovado'
      and m.run_id is distinct from v_run
  loop
    v_issues := v_issues || jsonb_build_object(
      'motivo', 'aprovado_obsoleto',
      'tipo', v_bad.kind,
      'registro_id', v_bad.id,
      'papel', v_bad.papel,
      'data', v_bad.data,
      'quem', v_bad.quem
    );
  end loop;

  update public.whatsapp_runs
  set analyzed_count = v_analyzed,
      created_count = v_created,
      updated_count = v_updated,
      skipped_count = v_skipped,
      missing_contact_count = v_missing,
      invalid_date_count = v_invalid,
      cancelled_count = v_cancelled,
      issues = v_issues,
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
      phone_fallback = case when p_phone is null then phone_fallback else false end,
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
  p_extra_meeting_days smallint[],
  p_notify_saidas boolean,
  p_notify_visitantes boolean,
  p_destino_saida text,
  p_destino_visitante text,
  p_template_saida_orador text,
  p_template_saida_responsavel text,
  p_template_visitante_orador text,
  p_template_visitante_responsavel text
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
  -- C5-lite: mensagem clara antes mesmo de o gatilho recusar.
  if p_mode = 'automatico' and not private.is_platform_admin() then
    raise exception
      'Envio automático está bloqueado até o isolamento das credenciais do provedor por congregação (C5). Use o modo prévia com envio manual.'
      using errcode = '42501';
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
      extra_meeting_days = coalesce(p_extra_meeting_days, extra_meeting_days),
      notify_saidas = coalesce(p_notify_saidas, notify_saidas),
      notify_visitantes = coalesce(p_notify_visitantes, notify_visitantes),
      destino_saida = coalesce(p_destino_saida, destino_saida),
      destino_visitante = coalesce(p_destino_visitante, destino_visitante),
      template_saida_orador = coalesce(nullif(btrim(p_template_saida_orador), ''), template_saida_orador),
      template_saida_responsavel = coalesce(nullif(btrim(p_template_saida_responsavel), ''), template_saida_responsavel),
      template_visitante_orador = coalesce(nullif(btrim(p_template_visitante_orador), ''), template_visitante_orador),
      template_visitante_responsavel = coalesce(nullif(btrim(p_template_visitante_responsavel), ''), template_visitante_responsavel),
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
-- C8: roda de hora em hora e recupera o dia se o horário configurado já
-- passou e ainda não houve preparo agendado hoje (fuso da congregação).
create or replace function private.whatsapp_cron_tick()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_item record;
  v_local timestamp;
  v_today date;
  v_processed integer := 0;
begin
  for v_item in
    select config.tenant_id, config.run_weekday, config.run_time, tenant.timezone
    from public.whatsapp_settings config
    join public.tenants tenant on tenant.id = config.tenant_id
    where config.enabled
  loop
    v_local := now() at time zone v_item.timezone;
    v_today := v_local::date;
    continue when extract(dow from v_local)::int <> v_item.run_weekday;
    continue when v_local::time < v_item.run_time;
    continue when exists (
      select 1 from public.whatsapp_runs previous
      where previous.tenant_id = v_item.tenant_id
        and previous.trigger_kind = 'cron'
        and previous.reference_date = v_today
    );

    perform private.whatsapp_build_queue(v_item.tenant_id, v_today, 'cron', null);
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
revoke all on function public.whatsapp_salvar_config(uuid, boolean, text, text, text, text, text, smallint, time, smallint, smallint[], boolean, boolean, text, text, text, text, text, text) from public, anon;
revoke all on function public.whatsapp_definir_remetente(uuid, uuid, boolean) from public, anon;
revoke all on function public.whatsapp_membros(uuid) from public, anon;

grant execute on function public.whatsapp_preparar(uuid, date) to authenticated;
grant execute on function public.whatsapp_atualizar_mensagem(uuid, text, text) to authenticated;
grant execute on function public.whatsapp_definir_status(uuid[], text, text, text) to authenticated;
grant execute on function public.whatsapp_salvar_config(uuid, boolean, text, text, text, text, text, smallint, time, smallint, smallint[], boolean, boolean, text, text, text, text, text, text) to authenticated;
grant execute on function public.whatsapp_definir_remetente(uuid, uuid, boolean) to authenticated;
grant execute on function public.whatsapp_membros(uuid) to authenticated;

commit;
