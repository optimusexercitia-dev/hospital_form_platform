// Main column — banner, header, lifecycle stepper, checklist, activity feed
function AidBanner({ it, role, onBlocker, onEditDue }) {
  if (it.status === "done") {
    return (
      <div className="bnr ok rise">
        <span className="bnr-ic"><AiIcon n="check-circle" s={18} /></span>
        <div><p className="bnr-t">Item concluído</p><p className="bnr-s">Concluído por {it.completedBy} em {it.completedAt}.</p></div>
      </div>
    );
  }
  if (it.status === "cancelled" || !it.dueDate) return null;
  const late = aidDaysLate(it.dueDate);
  if (late <= 0) return null;
  return (
    <div className="bnr rise" role="alert">
      <span className="bnr-ic"><AiIcon n="alert-triangle" s={18} /></span>
      <div style={{ minWidth: 0 }}>
        <p className="bnr-t">Prazo vencido há {late} {late === 1 ? "dia" : "dias"}</p>
        <p className="bnr-s">O prazo era {aidFmt(it.dueDate)}. Registre um impedimento ou ajuste o prazo com a coordenação.</p>
      </div>
      <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexShrink: 0 }}>
        <AiBtn sm icon="alert-circle" onClick={onBlocker}>Registrar impedimento</AiBtn>
        {role === "coord" && <AiBtn sm icon="calendar-clock" onClick={onEditDue}>Alterar prazo</AiBtn>}
      </div>
    </div>
  );
}

function AidHeader({ it, role, onStart, onComplete, onCancel, onReopen }) {
  const st = AID_STATUS[it.status];
  return (
    <header className="rise" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div className="hd-eyebrow">
        <AiBadge tone="bdg-out bdg-mono">{it.code}</AiBadge>
        <AiBadge tone={st.cls} up>{st.label}</AiBadge>
        <AiBadge tone={AID_PRIO[it.priority].cls} icon="flag">{AID_PRIO[it.priority].label}</AiBadge>
        <AiBadge tone="bdg-out" icon="folder-open">Caso</AiBadge>
        {it.visibility === "case_restricted" && <AiBadge tone="bdg-warn" icon="lock" title="Visível apenas a quem pode ver o caso vinculado">Restrito ao caso</AiBadge>}
      </div>
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
        <h1 className="hd-title" style={{ flex: "1 1 360px", minWidth: 0 }}>{it.title}</h1>
        <div style={{ display: "flex", gap: 8, flexShrink: 0, paddingTop: 4 }}>
          {it.status === "open" && <AiBtn v="pri" icon="play" onClick={onStart}>Iniciar item</AiBtn>}
          {it.status === "in_progress" && <AiBtn v="pri" icon="check" onClick={onComplete}>Concluir item</AiBtn>}
          {(it.status === "open" || it.status === "in_progress") && role === "coord" && <AiBtn v="gh" className="dngr" icon="ban" onClick={onCancel}>Cancelar</AiBtn>}
          {(it.status === "done" || it.status === "cancelled") && <AiBtn icon="rotate-ccw" onClick={onReopen}>Reabrir item</AiBtn>}
        </div>
      </div>
      <p className="hd-desc">{it.description}</p>
    </header>
  );
}

function AidStepper({ it }) {
  if (it.status === "cancelled") {
    return (
      <AiCard d={40}><div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--muted-fg)", fontSize: 13.5 }}>
        <span className="tl-c"><AiIcon n="ban" s={15} /></span>Este item foi cancelado em {it.cancelledAt}. Reabra-o para retomar o acompanhamento.
      </div></AiCard>
    );
  }
  const idx = it.status === "open" ? 0 : it.status === "in_progress" ? 1 : 2;
  const steps = [
    { l: "Aberto", d: it.openedAt },
    { l: "Em andamento", d: idx >= 1 ? it.startedAt : "—" },
    { l: "Concluído", d: idx >= 2 ? it.completedAt : "—" },
  ];
  return (
    <AiCard d={40}>
      <div className="stp">
        {steps.map((s, i) => {
          const cls = i < idx ? "done" : i === idx ? (idx === 2 ? "done" : "cur") : "pend";
          return (
            <div key={s.l} className={"stp-s " + cls}>
              <div className="stp-row">
                <span className="stp-c">{(i < idx || (i === 2 && idx === 2)) ? <AiIcon n="check" s={13} /> : <span style={{ width: 8, height: 8, borderRadius: 99, background: "currentColor" }}></span>}</span>
                {i < 2 && <span className="stp-ln"></span>}
              </div>
              <div><p className="stp-l">{s.l}</p><p className="stp-d">{s.d}</p></div>
            </div>
          );
        })}
      </div>
    </AiCard>
  );
}

function AidChecklist({ list, canContribute, onToggle, onAdd }) {
  const [draft, setDraft] = React.useState("");
  const done = list.filter((c) => c.done).length;
  const submit = () => { if (draft.trim()) { onAdd(draft.trim()); setDraft(""); } };
  return (
    <AiCard d={80} title="Checklist" sub="Divida esta ação em passos verificáveis." right={<span className="crd-sub" style={{ fontVariantNumeric: "tabular-nums" }}>{done} de {list.length} concluídas</span>}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <div className="ckbar"><i style={{ width: (list.length ? (done / list.length) * 100 : 0) + "%" }}></i></div>
        <span className="crd-sub" style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{list.length ? Math.round((done / list.length) * 100) : 0}%</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {list.map((c) => (
          <div key={c.id} className={"ckrow" + (c.done ? " on" : "")}>
            <button type="button" className={"ck" + (c.done ? " on" : "")} aria-label={c.done ? "Desmarcar" : "Concluir"} disabled={!canContribute} onClick={() => onToggle(c.id)}><AiIcon n="check" s={12} /></button>
            <span className="ckl">{c.title}</span>
            {c.done && c.by && <span className="ckm">{c.by} · {c.at}</span>}
          </div>
        ))}
      </div>
      {canContribute && (
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <input className="inp" placeholder="Nova subtarefa…" aria-label="Título da nova subtarefa" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
          <AiBtn icon="plus" disabled={!draft.trim()} onClick={submit}>Adicionar</AiBtn>
        </div>
      )}
    </AiCard>
  );
}

function AidActivity({ items, canContribute, composerType, setComposerType, onSubmit, composerRef }) {
  const [text, setText] = React.useState("");
  const [filter, setFilter] = React.useState("all");
  const shown = items.filter((a) => filter === "all" ? true : filter === "upd" ? a.kind === "update" : a.kind === "system");
  const submit = () => { if (text.trim()) { onSubmit(composerType, text.trim()); setText(""); } };
  return (
    <AiCard d={120} title="Atividade" sub="Atualizações da equipe e eventos do ciclo de vida, em ordem cronológica." right={
      <div className="fchips">
        {[["all", "Tudo"], ["upd", "Atualizações"], ["sys", "Sistema"]].map(([k, l]) => (
          <button key={k} type="button" className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>{l}</button>
        ))}
      </div>
    }>
      {canContribute && (
        <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 12, marginBottom: 18, background: "color-mix(in oklab, var(--muted) 35%, transparent)" }}>
          <div className="seg" role="tablist" aria-label="Tipo de atualização" style={{ marginBottom: 8 }}>
            {Object.entries(AID_UPD).map(([k, m]) => (
              <button key={k} type="button" className={composerType === k ? "on" : ""} onClick={() => setComposerType(k)}>{m.label}</button>
            ))}
          </div>
          <textarea ref={composerRef} className="txa" rows={2} placeholder={composerType === "blocker" ? "Descreva o impedimento e o que é necessário para destravá-lo…" : "Descreva o andamento, uma nota ou uma mudança de prazo…"} value={text} onChange={(e) => setText(e.target.value)} />
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
            <AiBtn v="pri" sm icon="send" disabled={!text.trim()} onClick={submit}>Registrar atualização</AiBtn>
          </div>
        </div>
      )}
      <div className="tl">
        {shown.map((a) => a.kind === "update" ? (
          <div key={a.id} className="tl-i">
            <span className={"tl-c " + AID_UPD[a.type].cls}><AiIcon n={AID_UPD_ICON[a.type]} s={15} /></span>
            <div style={{ minWidth: 0 }}>
              <div className="tl-top">
                <span className="tl-a">{a.author}</span>
                <span className={"chip " + AID_UPD[a.type].cls}>{AID_UPD[a.type].label}</span>
                <span className="tl-when">{a.at}</span>
              </div>
              <p className="tl-x">{a.text}</p>
            </div>
          </div>
        ) : (
          <div key={a.id} className="tl-i">
            <span className="tl-c" style={{ width: 32 }}><AiIcon n={a.icon} s={14} /></span>
            <div className="tl-top">
              <span className="tl-sys">{a.html.map((p, i) => typeof p === "string" ? p : <b key={i}>{p.b}</b>)}</span>
              <span className="tl-when">{a.at}</span>
            </div>
          </div>
        ))}
        {shown.length === 0 && <p className="empty">Nada por aqui com este filtro.</p>}
      </div>
    </AiCard>
  );
}
Object.assign(window, { AidBanner, AidHeader, AidStepper, AidChecklist, AidActivity });
