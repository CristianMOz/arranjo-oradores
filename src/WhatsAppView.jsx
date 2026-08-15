import { useCallback, useEffect, useMemo, useState } from "react";
import { P } from "./lib/theme";
import { FI, FL, FS, FT } from "./ui/forms";
import {
  CAMPOS_SAIDA, CAMPOS_VISITANTE, DIAS_SEMANA, EXEMPLO_SAIDA, EXEMPLO_VISITANTE,
  MENSAGEM_STATUS, MODELOS_PADRAO,
  atualizarMensagem, carregarConfigWhatsapp, carregarExecucoes, carregarMembros,
  carregarMensagens, definirRemetente, definirStatusMensagens, formatPhone, hojeIso,
  janelaLabel, normalizePhone, prepararFila, renderTemplate, salvarConfigWhatsapp, waLink,
} from "./lib/whatsapp";

const card = {background:P.white,borderRadius:18,padding:16,boxShadow:"0 2px 8px rgba(0,0,0,.06)"};
const chip = (bg,color)=>({background:bg,color,fontSize:10,fontWeight:800,padding:"3px 8px",borderRadius:8,whiteSpace:"nowrap"});
const brDate = (iso) => {
  if (!iso) return "";
  const [a,m,d] = String(iso).slice(0,10).split("-");
  return d ? `${d}/${m}/${a}` : iso;
};

export default function WhatsAppView({ tenant, role, userId, isPlatformAdmin = false, demo = false, toast$ }) {
  const [aba, setAba] = useState("fila");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [settings, setSettings] = useState(null);
  const [senders, setSenders] = useState([]);
  const [membros, setMembros] = useState([]);
  const [mensagens, setMensagens] = useState([]);
  const [execucoes, setExecucoes] = useState([]);

  const podeConfigurar = isPlatformAdmin || role === "owner" || role === "admin";
  const podeEnviar = podeConfigurar || senders.some(s => s.user_id === userId);

  const recarregar = useCallback(async () => {
    setErro("");
    try {
      const [config, msgs, runs, members] = await Promise.all([
        carregarConfigWhatsapp(tenant.id),
        carregarMensagens(tenant.id),
        carregarExecucoes(tenant.id),
        carregarMembros(tenant.id),
      ]);
      setSettings(config.settings);
      setSenders(config.senders);
      setMensagens(msgs);
      setExecucoes(runs);
      setMembros(members);
    } catch (e) {
      console.error(e);
      setErro(e.message || "Não foi possível carregar a configuração de WhatsApp.");
    }
    setCarregando(false);
  }, [tenant.id]);

  useEffect(() => {
    const timer = setTimeout(() => { recarregar(); }, 0);
    return () => clearTimeout(timer);
  }, [recarregar]);

  if (demo) {
    return (
      <div style={{padding:"16px 14px",maxWidth:560,margin:"0 auto"}}>
        <div style={{...card,textAlign:"center"}}>
          <div style={{fontSize:40}}>📲</div>
          <div style={{fontWeight:900,fontSize:17,color:P.text,marginTop:8}}>Avisos de WhatsApp</div>
          <div style={{fontSize:13,color:P.sub,marginTop:8,lineHeight:1.6}}>
            Esta área depende dos dados reais da congregação e fica indisponível no modo demonstração.
          </div>
        </div>
      </div>
    );
  }

  if (carregando) {
    return <div style={{padding:"40px 14px",textAlign:"center",color:P.sub,fontSize:14}}>Carregando avisos…</div>;
  }

  if (erro) {
    return (
      <div style={{padding:"16px 14px",maxWidth:560,margin:"0 auto"}}>
        <div style={{...card,background:P.roseL}}>
          <div style={{fontWeight:800,fontSize:14,color:P.rose}}>Não foi possível abrir os avisos</div>
          <div style={{fontSize:12,color:P.rose,marginTop:6}}>{erro}</div>
          <div style={{fontSize:11,color:P.sub,marginTop:10}}>
            Se a migração <code>20260815120000_whatsapp_por_congregacao.sql</code> ainda não foi aplicada, rode-a no Supabase.
          </div>
          <button onClick={recarregar} style={{marginTop:12,width:"100%",background:P.sky,border:"none",color:"#fff",borderRadius:12,padding:12,fontWeight:800,cursor:"pointer"}}>
            Tentar de novo
          </button>
        </div>
      </div>
    );
  }

  const ABAS = [
    ["fila","📤 Fila"],
    ["config","⚙️ Configuração"],
    ["historico","🧾 Execuções"],
  ];

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      <div style={{display:"flex",borderBottom:`1px solid ${P.border}`,background:P.white,flexShrink:0}}>
        {ABAS.map(([k,l])=>(
          <button key={k} onClick={()=>setAba(k)}
            style={{flex:1,border:"none",background:"none",cursor:"pointer",padding:"12px 6px",fontSize:12,fontWeight:aba===k?800:600,color:aba===k?P.sky:P.sub,borderBottom:`3px solid ${aba===k?P.sky:"transparent"}`}}>
            {l}
          </button>
        ))}
      </div>
      <div style={{flex:1,overflowY:"auto"}}>
        {aba==="fila" && (
          <FilaView tenant={tenant} settings={settings} mensagens={mensagens}
            podeEnviar={podeEnviar} toast$={toast$} onChange={recarregar}/>
        )}
        {aba==="config" && (
          <ConfigView tenant={tenant} settings={settings} membros={membros} senders={senders}
            podeConfigurar={podeConfigurar} toast$={toast$} onChange={recarregar}/>
        )}
        {aba==="historico" && <ExecucoesView execucoes={execucoes}/>}
      </div>
    </div>
  );
}

// ── FILA: prévia, revisão e envio ────────────────────────────────────────
function FilaView({ tenant, settings, mensagens, podeEnviar, toast$, onChange }) {
  const [filtro, setFiltro] = useState("pendentes");
  const [ocupado, setOcupado] = useState(false);
  const [editando, setEditando] = useState(null);

  const hoje = hojeIso(tenant.timezone);
  const janela = janelaLabel(hoje, settings?.window_days);

  const grupos = useMemo(() => {
    const pendentes = mensagens.filter(m => ["rascunho","aprovado","sem_contato","falhou"].includes(m.status));
    const enviados  = mensagens.filter(m => m.status === "enviado");
    const arquivados = mensagens.filter(m => m.status === "cancelado");
    return { pendentes, enviados, arquivados };
  }, [mensagens]);

  const visiveis = filtro==="pendentes" ? grupos.pendentes
    : filtro==="enviados" ? grupos.enviados
    : filtro==="cancelados" ? grupos.arquivados
    : mensagens;

  const preparar = async () => {
    setOcupado(true);
    try {
      await prepararFila(tenant.id, hoje);
      await onChange();
      toast$("Prévia atualizada!");
    } catch (e) { toast$(e.message || "Erro ao preparar a prévia", false); }
    setOcupado(false);
  };

  const mudarStatus = async (ids, status, rotulo) => {
    if (!ids.length) return;
    setOcupado(true);
    try {
      const n = await definirStatusMensagens(ids, status);
      await onChange();
      toast$(n ? `${n} aviso${n>1?"s":""} ${rotulo}` : "Nenhum aviso alterado", Boolean(n));
    } catch (e) { toast$(e.message || "Erro ao atualizar", false); }
    setOcupado(false);
  };

  const abrirWhatsapp = (m) => {
    const link = waLink(m.recipient_phone, m.body);
    if (!link) return toast$("Este aviso está sem número", false);
    window.open(link, "_blank", "noopener,noreferrer");
  };

  const aprovados = grupos.pendentes.filter(m => m.status === "aprovado").map(m => m.id);
  const rascunhos = grupos.pendentes.filter(m => m.status === "rascunho").map(m => m.id);

  return (
    <div style={{padding:"14px",display:"flex",flexDirection:"column",gap:12}}>
      <div style={{...card,background:`linear-gradient(135deg,${P.sky},${P.teal})`,color:"#fff"}}>
        <div style={{fontWeight:900,fontSize:16}}>📲 Avisos de {tenant.name}</div>
        <div style={{fontSize:12,opacity:.9,marginTop:6,lineHeight:1.6}}>
          {settings?.enabled
            ? `Preparo automático toda ${DIAS_SEMANA[settings.run_weekday]} às ${String(settings.run_time).slice(0,5)}.`
            : "Preparo automático desligado — gere a prévia manualmente."}
          <br/>Janela atual: <b>{janela}</b> · Modo: <b>{settings?.mode === "automatico" ? "automático" : "prévia"}</b>
        </div>
        {podeEnviar && (
          <button onClick={preparar} disabled={ocupado}
            style={{width:"100%",marginTop:12,background:"rgba(255,255,255,.22)",border:"1px solid rgba(255,255,255,.5)",color:"#fff",borderRadius:12,padding:12,fontWeight:800,fontSize:13,cursor:"pointer"}}>
            {ocupado ? "Processando…" : "🔄 Gerar prévia do próximo fim de semana"}
          </button>
        )}
      </div>

      {!podeEnviar && (
        <div style={{...card,background:P.amberL,color:"#92400E",fontSize:12,fontWeight:700}}>
          Você pode acompanhar a fila, mas não está autorizado a enviar. Peça ao responsável para incluir sua conta em <b>Configuração → Quem pode enviar</b>.
        </div>
      )}

      <div style={{display:"flex",gap:6,overflowX:"auto"}}>
        {[
          ["pendentes",`A revisar (${grupos.pendentes.length})`],
          ["enviados",`Enviados (${grupos.enviados.length})`],
          ["cancelados",`Cancelados (${grupos.arquivados.length})`],
          ["todos",`Todos (${mensagens.length})`],
        ].map(([k,l])=>(
          <button key={k} onClick={()=>setFiltro(k)}
            style={{background:filtro===k?P.sky:P.slateL,color:filtro===k?"#fff":P.sub,border:"none",borderRadius:20,padding:"6px 12px",fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>
            {l}
          </button>
        ))}
      </div>

      {podeEnviar && rascunhos.length > 0 && (
        <button onClick={()=>mudarStatus(rascunhos,"aprovado","aprovado(s)")} disabled={ocupado}
          style={{background:P.sky,border:"none",color:"#fff",borderRadius:12,padding:12,fontWeight:800,fontSize:13,cursor:"pointer"}}>
          ✓ Aprovar {rascunhos.length} rascunho{rascunhos.length>1?"s":""} para envio
        </button>
      )}

      {aprovados.length > 0 && (
        <div style={{...card,background:P.skyL,fontSize:12,color:P.text,fontWeight:700}}>
          {aprovados.length} aviso{aprovados.length>1?"s":""} aprovado{aprovados.length>1?"s":""} aguardando envio.
          {settings?.mode === "automatico"
            ? " O disparador automático cuida deles na próxima execução."
            : " Abra cada um no WhatsApp e marque como enviado."}
        </div>
      )}

      {visiveis.length === 0 && (
        <div style={{textAlign:"center",padding:"36px 0",color:P.sub,fontSize:13}}>
          <div style={{fontSize:36}}>📭</div>
          <div style={{fontWeight:700,marginTop:8}}>Nenhum aviso nesta lista</div>
        </div>
      )}

      {visiveis.map(m => (
        <MensagemCard key={m.id} m={m} podeEnviar={podeEnviar} ocupado={ocupado}
          onAbrir={()=>abrirWhatsapp(m)}
          onStatus={(status,rotulo)=>mudarStatus([m.id],status,rotulo)}
          onEditar={()=>setEditando(m)}/>
      ))}

      {editando && (
        <EditarMensagem m={editando} toast$={toast$}
          onClose={()=>setEditando(null)}
          onSaved={async()=>{ setEditando(null); await onChange(); }}/>
      )}
    </div>
  );
}

function MensagemCard({ m, podeEnviar, ocupado, onAbrir, onStatus, onEditar }) {
  const [aberto, setAberto] = useState(false);
  const st = MENSAGEM_STATUS[m.status] || MENSAGEM_STATUS.rascunho;
  const tipo = m.kind === "saida"
    ? { label:"Saída", color:P.sky, bg:P.skyL }
    : { label:"Visitante", color:P.violet, bg:P.violetL };

  return (
    <div style={{...card,padding:14,borderLeft:`4px solid ${st.color}`}}>
      <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:800,fontSize:14,color:P.text}}>{m.recipient_name || "—"}</div>
          <div style={{fontSize:11,color:P.sub,marginTop:2}}>
            📅 {brDate(m.target_date)} · 📱 {formatPhone(m.recipient_phone) || "sem número"}
          </div>
          {m.status === "enviado" && m.sent_at && (
            <div style={{fontSize:10,color:P.teal,marginTop:2,fontWeight:700}}>
              Enviado em {new Date(m.sent_at).toLocaleString("pt-BR")}
            </div>
          )}
          {m.error && <div style={{fontSize:10,color:P.rose,marginTop:2}}>{m.error}</div>}
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:5,alignItems:"flex-end"}}>
          <span style={chip(tipo.bg,tipo.color)}>{tipo.label}</span>
          <span style={chip(st.bg,st.color)}>{st.label}</span>
        </div>
      </div>

      <button onClick={()=>setAberto(v=>!v)}
        style={{background:"none",border:"none",color:P.sky,fontSize:11,fontWeight:800,cursor:"pointer",padding:"8px 0 0"}}>
        {aberto ? "▲ Ocultar mensagem" : "▼ Ver mensagem"}
      </button>
      {aberto && (
        <pre style={{background:P.slateL,borderRadius:12,padding:12,fontSize:12,color:P.text,whiteSpace:"pre-wrap",wordBreak:"break-word",fontFamily:"inherit",lineHeight:1.55,marginTop:6}}>
          {m.body}
        </pre>
      )}

      {podeEnviar && m.status !== "enviado" && (
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:10}}>
          <button onClick={onEditar} disabled={ocupado}
            style={{background:P.slateL,border:"none",color:P.sub,borderRadius:10,padding:"8px 12px",fontSize:11,fontWeight:700,cursor:"pointer"}}>✏️ Editar</button>
          {m.status === "rascunho" && (
            <button onClick={()=>onStatus("aprovado","aprovado")} disabled={ocupado}
              style={{background:P.skyL,border:"none",color:P.sky,borderRadius:10,padding:"8px 12px",fontSize:11,fontWeight:700,cursor:"pointer"}}>✓ Aprovar</button>
          )}
          {m.recipient_phone && (
            <button onClick={onAbrir} disabled={ocupado}
              style={{background:"#25D366",border:"none",color:"#fff",borderRadius:10,padding:"8px 12px",fontSize:11,fontWeight:800,cursor:"pointer"}}>📲 Abrir no WhatsApp</button>
          )}
          {m.status === "aprovado" && (
            <button onClick={()=>onStatus("enviado","marcado(s) como enviado")} disabled={ocupado}
              style={{background:P.tealL,border:"none",color:P.teal,borderRadius:10,padding:"8px 12px",fontSize:11,fontWeight:800,cursor:"pointer"}}>✅ Marcar como enviado</button>
          )}
          {m.status !== "cancelado" && (
            <button onClick={()=>onStatus("cancelado","cancelado")} disabled={ocupado}
              style={{background:P.roseL,border:"none",color:P.rose,borderRadius:10,padding:"8px 12px",fontSize:11,fontWeight:700,cursor:"pointer"}}>✕ Cancelar</button>
          )}
        </div>
      )}
    </div>
  );
}

function EditarMensagem({ m, onClose, onSaved, toast$ }) {
  const [body, setBody] = useState(m.body);
  const [phone, setPhone] = useState(m.recipient_phone);
  const [salvando, setSalvando] = useState(false);

  const salvar = async () => {
    if (!body.trim()) return toast$("A mensagem não pode ficar vazia", false);
    if (phone.trim() && !normalizePhone(phone)) return toast$("Número inválido", false);
    setSalvando(true);
    try {
      await atualizarMensagem(m.id, { body, phone });
      toast$("Aviso atualizado!");
      await onSaved();
    } catch (e) { toast$(e.message || "Erro ao salvar", false); }
    setSalvando(false);
  };

  return (
    <div style={{position:"fixed",inset:0,zIndex:600,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
      <div style={{position:"absolute",inset:0,background:"rgba(15,23,42,.5)"}} onClick={onClose}/>
      <div className="slide" style={{position:"relative",background:P.white,borderRadius:"24px 24px 0 0",maxHeight:"90vh",overflowY:"auto",padding:"18px 18px 24px"}}>
        <div style={{fontWeight:900,fontSize:17,color:P.text}}>Editar aviso</div>
        <div style={{fontSize:12,color:P.sub,marginTop:4}}>
          Alterar o texto de um aviso já aprovado devolve ele para revisão.
        </div>
        <FL>Número (WhatsApp)</FL>
        <FI value={phone} onChange={e=>setPhone(e.target.value)} placeholder="(19) 99999-9999"/>
        <div style={{fontSize:11,color:P.sub,marginTop:4}}>
          Será enviado para <b>{formatPhone(normalizePhone(phone)) || "—"}</b>
        </div>
        <FL>Mensagem</FL>
        <FT value={body} onChange={e=>setBody(e.target.value)} rows={12}/>
        <div style={{display:"flex",gap:10,marginTop:16}}>
          <button onClick={onClose} style={{flex:1,background:P.slateL,border:"none",color:P.sub,borderRadius:14,padding:14,fontWeight:800,cursor:"pointer"}}>Cancelar</button>
          <button onClick={salvar} disabled={salvando} style={{flex:2,background:P.sky,border:"none",color:"#fff",borderRadius:14,padding:14,fontWeight:800,cursor:"pointer"}}>
            {salvando ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── CONFIGURAÇÃO ─────────────────────────────────────────────────────────
function ConfigView({ tenant, settings, membros, senders, podeConfigurar, toast$, onChange }) {
  const [f, setF] = useState(() => ({
    enabled: settings.enabled,
    mode: settings.mode,
    provider: settings.provider,
    sender_label: settings.sender_label,
    sender_phone: settings.sender_phone,
    provider_phone_id: settings.provider_phone_id,
    run_weekday: settings.run_weekday,
    run_time: String(settings.run_time).slice(0,5),
    window_days: settings.window_days,
    notify_saidas: settings.notify_saidas,
    notify_visitantes: settings.notify_visitantes,
    template_saida: settings.template_saida,
    template_visitante: settings.template_visitante,
  }));
  const [salvando, setSalvando] = useState(false);
  const [previewKind, setPreviewKind] = useState("saida");

  const s = (k,v) => setF(x => ({...x, [k]: v}));

  const preview = useMemo(() => renderTemplate(
    previewKind === "saida" ? f.template_saida : f.template_visitante,
    previewKind === "saida" ? EXEMPLO_SAIDA : EXEMPLO_VISITANTE,
  ), [f.template_saida, f.template_visitante, previewKind]);

  const automaticoSemProvedor = f.mode === "automatico" && f.provider === "manual";

  const salvar = async () => {
    if (f.sender_phone.trim() && !normalizePhone(f.sender_phone)) return toast$("Número do remetente inválido", false);
    if (automaticoSemProvedor) return toast$("Modo automático exige um provedor configurado", false);
    setSalvando(true);
    try {
      await salvarConfigWhatsapp(tenant.id, { ...f, run_time: `${f.run_time}:00` });
      await onChange();
      toast$("Configuração salva!");
    } catch (e) { toast$(e.message || "Erro ao salvar", false); }
    setSalvando(false);
  };

  const alternarRemetente = async (userId, allowed) => {
    try {
      await definirRemetente(tenant.id, userId, allowed);
      await onChange();
      toast$(allowed ? "Autorizado a enviar" : "Autorização removida");
    } catch (e) { toast$(e.message || "Erro ao alterar", false); }
  };

  if (!podeConfigurar) {
    return (
      <div style={{padding:"14px"}}>
        <div style={{...card}}>
          <div style={{fontWeight:800,fontSize:14,color:P.text}}>Configuração de {tenant.name}</div>
          <div style={{fontSize:12,color:P.sub,marginTop:8,lineHeight:1.6}}>
            Somente o responsável (owner ou admin) altera estes ajustes.<br/>
            Situação: <b>{settings.enabled ? "preparo automático ligado" : "preparo automático desligado"}</b> ·
            modo <b>{settings.mode === "automatico" ? "automático" : "prévia"}</b> ·
            {" "}toda {DIAS_SEMANA[settings.run_weekday]} às {String(settings.run_time).slice(0,5)}.
          </div>
        </div>
      </div>
    );
  }

  const senderIds = new Set(senders.map(x => x.user_id));

  return (
    <div style={{padding:"14px",display:"flex",flexDirection:"column",gap:12}}>
      <div style={card}>
        <div style={{fontWeight:900,fontSize:16,color:P.text}}>Quando preparar</div>
        <div style={{fontSize:12,color:P.sub,marginTop:4}}>
          Cada congregação tem seu próprio horário. O preparo só olha os arranjos desta congregação.
        </div>

        <label style={{display:"flex",gap:10,alignItems:"flex-start",background:P.slateL,borderRadius:12,padding:12,cursor:"pointer",marginTop:12}}>
          <input type="checkbox" checked={f.enabled} onChange={e=>s("enabled",e.target.checked)} style={{marginTop:3}}/>
          <span>
            <span style={{display:"block",fontWeight:800,fontSize:13,color:P.text}}>Preparar automaticamente toda semana</span>
            <span style={{fontSize:11,color:P.sub}}>Desligado, a fila só é montada quando alguém clica em “Gerar prévia”.</span>
          </span>
        </label>

        <FL>Dia da semana</FL>
        <FS value={f.run_weekday} onChange={e=>s("run_weekday",Number(e.target.value))}>
          {DIAS_SEMANA.map((d,i)=><option key={d} value={i}>{d}</option>)}
        </FS>
        <FL>Horário ({tenant.timezone})</FL>
        <FI type="time" value={f.run_time} onChange={e=>s("run_time",e.target.value)}/>
        <div style={{fontSize:11,color:P.sub,marginTop:4}}>O preparo roda na hora cheia mais próxima.</div>

        <FL>Olhar quantos dias à frente</FL>
        <FS value={f.window_days} onChange={e=>s("window_days",Number(e.target.value))}>
          {[3,5,7,10,14].map(d=><option key={d} value={d}>{d} dias</option>)}
        </FS>
        <div style={{fontSize:11,color:P.sub,marginTop:4}}>7 dias a partir de segunda cobre o próximo fim de semana.</div>
      </div>

      <div style={card}>
        <div style={{fontWeight:900,fontSize:16,color:P.text}}>O que avisar</div>
        {[
          ["notify_saidas","Saídas dos nossos oradores","Avisa o orador da congregação sobre o discurso fora."],
          ["notify_visitantes","Oradores visitantes","Confirma com o contato da congregação de origem."],
        ].map(([k,label,detail])=>(
          <label key={k} style={{display:"flex",gap:10,alignItems:"flex-start",background:P.slateL,borderRadius:12,padding:12,cursor:"pointer",marginTop:10}}>
            <input type="checkbox" checked={f[k]} onChange={e=>s(k,e.target.checked)} style={{marginTop:3}}/>
            <span>
              <span style={{display:"block",fontWeight:800,fontSize:13,color:P.text}}>{label}</span>
              <span style={{fontSize:11,color:P.sub}}>{detail}</span>
            </span>
          </label>
        ))}
      </div>

      <div style={card}>
        <div style={{fontWeight:900,fontSize:16,color:P.text}}>Como enviar</div>
        <FL>Modo</FL>
        <FS value={f.mode} onChange={e=>s("mode",e.target.value)}>
          <option value="previa">Prévia — revisão manual antes de enviar (recomendado)</option>
          <option value="automatico">Automático — dispara sem revisão</option>
        </FS>
        <FL>Provedor</FL>
        <FS value={f.provider} onChange={e=>s("provider",e.target.value)}>
          <option value="manual">Manual (abre o WhatsApp no celular)</option>
          <option value="meta_cloud">WhatsApp Cloud API (Meta)</option>
          <option value="webhook">Webhook próprio</option>
        </FS>
        {automaticoSemProvedor && (
          <div style={{background:P.roseL,color:P.rose,borderRadius:12,padding:12,fontSize:12,fontWeight:700,marginTop:10}}>
            O modo automático precisa de um provedor. Com “Manual” o envio é sempre feito por uma pessoa.
          </div>
        )}
        <FL>Número usado no envio</FL>
        <FI value={f.sender_phone} onChange={e=>s("sender_phone",e.target.value)} placeholder="(19) 99999-9999"/>
        <div style={{fontSize:11,color:P.sub,marginTop:4}}>
          Guardado como <b>{normalizePhone(f.sender_phone) || "—"}</b>. Segredos e tokens do provedor ficam no Supabase, nunca aqui.
        </div>
        {f.provider === "meta_cloud" && (
          <>
            <FL>Phone Number ID (Meta)</FL>
            <FI value={f.provider_phone_id} onChange={e=>s("provider_phone_id",e.target.value)} placeholder="123456789012345"/>
          </>
        )}
        <FL>Assinatura das mensagens</FL>
        <FI value={f.sender_label} onChange={e=>s("sender_label",e.target.value)} placeholder="— Cristiano (Superintendente de Discursos)"/>
      </div>

      <div style={card}>
        <div style={{fontWeight:900,fontSize:16,color:P.text}}>Quem pode enviar</div>
        <div style={{fontSize:12,color:P.sub,marginTop:4}}>
          Owner e admin sempre podem. Marque abaixo os demais membros autorizados.
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:8,marginTop:12}}>
          {membros.length === 0 && (
            <div style={{fontSize:12,color:P.sub,fontStyle:"italic"}}>Nenhum membro vinculado ainda.</div>
          )}
          {membros.map(m => {
            const fixo = m.role === "owner" || m.role === "admin";
            const marcado = fixo || senderIds.has(m.user_id);
            return (
              <label key={m.user_id} style={{display:"flex",gap:10,alignItems:"center",background:P.slateL,borderRadius:12,padding:12,cursor:fixo?"default":"pointer",opacity:fixo?.75:1}}>
                <input type="checkbox" checked={marcado} disabled={fixo}
                  onChange={e=>alternarRemetente(m.user_id, e.target.checked)}/>
                <span style={{flex:1,minWidth:0}}>
                  <span style={{display:"block",fontWeight:700,fontSize:12,color:P.text,overflow:"hidden",textOverflow:"ellipsis"}}>{m.email}</span>
                  <span style={{fontSize:10,color:P.sub}}>{m.role}{fixo?" · sempre autorizado":""}</span>
                </span>
              </label>
            );
          })}
        </div>
      </div>

      <div style={card}>
        <div style={{fontWeight:900,fontSize:16,color:P.text}}>Modelos de mensagem</div>
        <div style={{fontSize:11,color:P.sub,marginTop:4,lineHeight:1.6}}>
          Use <code>{"{campo}"}</code> para inserir dados. Se o campo estiver vazio no arranjo, a linha inteira some da mensagem.
        </div>

        <div style={{display:"flex",gap:6,marginTop:12}}>
          {[["saida","📤 Saída"],["visitante","📥 Visitante"]].map(([k,l])=>(
            <button key={k} onClick={()=>setPreviewKind(k)}
              style={{flex:1,background:previewKind===k?P.sky:P.slateL,color:previewKind===k?"#fff":P.sub,border:"none",borderRadius:10,padding:"8px 10px",fontSize:12,fontWeight:700,cursor:"pointer"}}>{l}</button>
          ))}
        </div>

        <div style={{display:"flex",flexWrap:"wrap",gap:5,marginTop:10}}>
          {(previewKind==="saida"?CAMPOS_SAIDA:CAMPOS_VISITANTE).map(c=>(
            <span key={c} style={{background:P.skyL,color:P.sky,fontSize:10,fontWeight:700,padding:"3px 7px",borderRadius:7}}>{`{${c}}`}</span>
          ))}
        </div>

        <FT rows={12}
          value={previewKind==="saida" ? f.template_saida : f.template_visitante}
          onChange={e=>s(previewKind==="saida"?"template_saida":"template_visitante", e.target.value)}/>
        <button
          onClick={()=>s(previewKind==="saida"?"template_saida":"template_visitante", MODELOS_PADRAO[previewKind])}
          style={{background:"none",border:"none",color:P.sky,fontSize:11,fontWeight:800,cursor:"pointer",padding:"8px 0 0"}}>
          ↺ Restaurar modelo padrão
        </button>

        <div style={{fontSize:12,fontWeight:800,color:P.sub,marginTop:12}}>PRÉVIA COM DADOS DE EXEMPLO</div>
        <pre style={{background:"#E7FFDB",borderRadius:12,padding:12,fontSize:12,color:P.text,whiteSpace:"pre-wrap",wordBreak:"break-word",fontFamily:"inherit",lineHeight:1.55,marginTop:6}}>
          {preview}
        </pre>
      </div>

      <button onClick={salvar} disabled={salvando}
        style={{background:`linear-gradient(135deg,${P.sky},${P.teal})`,border:"none",color:"#fff",borderRadius:14,padding:15,fontWeight:800,fontSize:14,cursor:"pointer"}}>
        {salvando ? "Salvando…" : "Salvar configuração"}
      </button>
    </div>
  );
}

// ── HISTÓRICO DE EXECUÇÕES ───────────────────────────────────────────────
function ExecucoesView({ execucoes }) {
  if (execucoes.length === 0) {
    return (
      <div style={{textAlign:"center",padding:"40px 14px",color:P.sub,fontSize:13}}>
        <div style={{fontSize:36}}>🧾</div>
        <div style={{fontWeight:700,marginTop:8}}>Nenhum preparo executado ainda</div>
      </div>
    );
  }
  return (
    <div style={{padding:"14px",display:"flex",flexDirection:"column",gap:10}}>
      {execucoes.map(r => (
        <div key={r.id} style={{...card,padding:14}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontWeight:800,fontSize:13,color:P.text,flex:1}}>
              {new Date(r.started_at).toLocaleString("pt-BR")}
            </span>
            <span style={chip(r.trigger_kind==="cron"?P.violetL:P.skyL, r.trigger_kind==="cron"?P.violet:P.sky)}>
              {r.trigger_kind==="cron"?"agendado":"manual"}
            </span>
            <span style={chip(P.slateL,P.sub)}>{r.mode}</span>
          </div>
          <div style={{fontSize:11,color:P.sub,marginTop:6}}>
            Janela {brDate(r.reference_date)} → {brDate(r.window_end)}
          </div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:8}}>
            <span style={chip(P.limeL,"#4D7C0F")}>{r.created_count} novo(s)</span>
            <span style={chip(P.skyL,P.sky)}>{r.updated_count} atualizado(s)</span>
            <span style={chip(P.slateL,P.sub)}>{r.skipped_count} já enviado(s)</span>
            {r.missing_contact_count > 0 && (
              <span style={chip(P.amberL,"#B45309")}>{r.missing_contact_count} sem número</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
