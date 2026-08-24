// Right rail — details meta, reminders, watchers, linked items
function AidDetails({ it, role, dueEditOpen, setDueEditOpen, onReassign, onDue, onPrio }) {
  const [assignOpen, setAssignOpen] = React.useState(false);
  const [dueDraft, setDueDraft] = React.useState(it.dueDate || "");
  React.useEffect(() => { setDueDraft(it.dueDate || ""); }, [it.dueDate]);
  const late = it.dueDate ? aidDaysLate(it.dueDate) : 0;
  const overdue = late > 0 && (it.status === "open" || it.status === "in_progress");
  const coord = role === "coord";
  return (
    <AiCard d={40} title="Detalhes">
      <div className="mrow">
        <dt className="mlbl">Responsável {coord && <AiBtn v="gh" sm icon="pencil" onClick={() => setAssignOpen(!assignOpen)}>Alterar</AiBtn>}</dt>
        <dd className="mval"><AiAvatar name={it.assignee} size={24} />{it.assignee}</dd>
        {assignOpen && (
          <select className="sel" style={{ marginTop: 6 }} value={it.assignee} aria-label="Novo responsável" onChange={(e) => { onReassign(e.target.value); setAssignOpen(false); }}>
            {window.AID.members.map((m) => <option key={m}>{m}</option>)}
          </select>
        )}
      </div>
      <div className="mrow">
        <dt className="mlbl">Prazo {coord && <AiBtn v="gh" sm icon="pencil" onClick={() => setDueEditOpen(!dueEditOpen)}>Alterar</AiBtn>}</dt>
        <dd className="mval">
          {it.dueDate ? (
            overdue
              ? <span className="due-over"><AiIcon n="calendar-clock" s={14} />{aidFmt(it.dueDate)} · Atrasado</span>
              : <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontVariantNumeric: "tabular-nums" }}><AiIcon n="calendar-clock" s={14} className="mut" />{aidFmt(it.dueDate)}</span>
          ) : <span style={{ color: "var(--muted-fg)" }}>Sem prazo</span>}
        </dd>
        {dueEditOpen && (
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            <input type="date" className="inp" value={dueDraft} aria-label="Novo prazo" onChange={(e) => setDueDraft(e.target.value)} />
            <AiBtn sm disabled={!dueDraft || dueDraft === it.dueDate} onClick={() => { onDue(dueDraft); setDueEditOpen(false); }}>Salvar</AiBtn>
          </div>
        )}
      </div>
      <div className="mrow">
        <dt className="mlbl">Prioridade</dt>
        <dd className="mval">
          {coord ? (
            <select className="sel" value={it.priority} aria-label="Prioridade" onChange={(e) => onPrio(e.target.value)}>
              {Object.entries(AID_PRIO).map(([k, m]) => <option key={k} value={k}>{m.label.replace("Prioridade ", "").replace(/^./, (c) => c.toUpperCase())}</option>)}
            </select>
          ) : <AiBadge tone={AID_PRIO[it.priority].cls} icon="flag">{AID_PRIO[it.priority].label.replace("Prioridade ", "")}</AiBadge>}
        </dd>
      </div>
      <div className="mrow">
        <dt className="mlbl">Origem</dt>
        <dd className="mval"><a href="#" onClick={(e) => e.preventDefault()} style={{ display: "inline-flex", gap: 4, alignItems: "flex-start", fontWeight: 500, fontSize: 13 }}>{it.source.label}<AiIcon n="arrow-up-right" s={13} style={{ flexShrink: 0, marginTop: 3 }} /></a></dd>
      </div>
      <div className="mrow">
        <dt className="mlbl">Visibilidade</dt>
        <dd className="mval"><AiBadge tone="bdg-warn" icon="lock" title="Visível apenas a quem pode ver o caso vinculado">Restrito ao caso</AiBadge></dd>
      </div>
      <div className="mrow">
        <dt className="mlbl">Criado por</dt>
        <dd className="mval" style={{ fontSize: 13 }}>{it.createdBy}<span style={{ color: "var(--muted-fg)" }}>· {it.createdAt}</span></dd>
      </div>
    </AiCard>
  );
}

function AidReminders({ list, canManage, onRemove, onAdd }) {
  const [type, setType] = React.useState("before_due");
  const [days, setDays] = React.useState(3);
  const label = () => type === "on_due" ? "No dia do prazo" : `${days} ${days === 1 ? "dia" : "dias"} ${type === "before_due" ? "antes" : "após"} do prazo`;
  return (
    <AiCard d={80} title="Lembretes" sub={canManage ? "Notificações automáticas ao responsável." : "Definidos pela coordenação."}>
      <div className="rlist">
        {list.map((r) => (
          <div key={r.id} className="rrow"><AiIcon n="bell" s={14} />{r.text}
            {canManage && <AiBtn v="gh" sm icon="x" className="x btn-ic" aria-label={"Remover lembrete: " + r.text} onClick={() => onRemove(r.id)}></AiBtn>}
          </div>
        ))}
        {list.length === 0 && <p className="empty">Nenhum lembrete configurado.</p>}
      </div>
      {canManage && (
        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
          <select className="sel" style={{ flex: 2 }} value={type} aria-label="Tipo de lembrete" onChange={(e) => setType(e.target.value)}>
            <option value="before_due">Antes do prazo</option><option value="on_due">No dia do prazo</option><option value="after_due">Após o prazo</option>
          </select>
          {type !== "on_due" && <input type="number" min="1" max="30" className="inp" style={{ flex: 1, minWidth: 54 }} value={days} aria-label="Dias" onChange={(e) => setDays(Math.max(1, +e.target.value || 1))} />}
          <AiBtn sm icon="plus" onClick={() => onAdd(label())}>Adicionar</AiBtn>
        </div>
      )}
    </AiCard>
  );
}

function AidWatchers({ list, following, onToggle }) {
  return (
    <AiCard d={120} title="Observadores" sub="Recebem notificações das atualizações.">
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div className="wstack">{list.map((w) => <AiAvatar key={w} name={w} size={28} />)}</div>
        <span className="crd-sub" style={{ flex: 1 }}>{list.length} {list.length === 1 ? "pessoa" : "pessoas"}</span>
        <AiBtn sm icon={following ? "check" : "eye"} v={following ? "out" : "out"} onClick={onToggle}>{following ? "Seguindo" : "Seguir"}</AiBtn>
      </div>
    </AiCard>
  );
}

function AidLinked({ list }) {
  const dot = { open: "var(--muted-fg)", in_progress: "var(--primary)", done: "var(--success)" };
  return (
    <AiCard d={160} title="Itens vinculados" sub="Ações relacionadas nesta comissão.">
      <div style={{ display: "flex", flexDirection: "column" }}>
        {list.map((l) => (
          <div key={l.id} className="lrow">
            <span className="ldot" style={{ background: dot[l.status] }}></span>
            <div style={{ minWidth: 0 }}><p className="lt">{l.title}</p><p className="lm">{AID_STATUS[l.status].label} · {l.meta}</p></div>
          </div>
        ))}
      </div>
    </AiCard>
  );
}
Object.assign(window, { AidDetails, AidReminders, AidWatchers, AidLinked });
