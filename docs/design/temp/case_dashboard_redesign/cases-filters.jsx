// filter model + saved views + chip bar + advanced panel + active summary
const DEFAULT_F = { status: "todos", outcome: null, period: "all", overdue: false, resp: [], types: [], tags: [], depts: [], semResp: false, adverseOnly: false, progress: "any", q: "" };
const PERIODS = [["7d", "Últimos 7 dias"], ["30d", "Últimos 30 dias"], ["90d", "Últimos 90 dias"], ["month", "Este mês"]];
const PROGRESS_OPTS = [["any", "Qualquer"], ["none", "Nenhuma concluída"], ["partial", "Em andamento"], ["all", "Todas concluídas"]];

function periodLabel(p) { if (p === "all") return null; if (typeof p === "object") return (p.from ? fmtDate(p.from) : "…") + " – " + (p.to ? fmtDate(p.to) : "…"); return PERIODS.find(([k]) => k === p)[1]; }
function inPeriod(iso, p) {
  if (p === "all") return true;
  const d = new Date(iso + "T12:00");
  if (typeof p === "object") return (!p.from || d >= new Date(p.from + "T00:00")) && (!p.to || d <= new Date(p.to + "T23:59"));
  if (p === "month") return d.getFullYear() === TODAY.getFullYear() && d.getMonth() === TODAY.getMonth();
  const days = { "7d": 7, "30d": 30, "90d": 90 }[p];
  return (TODAY - d) / 864e5 <= days;
}
function matchRow(r, f) {
  if (f.status !== "todos") { if (f.status === "abertos") { if (isTerminal(r.status)) return false; } else if (r.status !== f.status) return false; }
  const o = outcomeOf(r);
  if (f.outcome === "sem" && o) return false;
  if (f.outcome && f.outcome !== "sem" && (!o || o.id !== f.outcome)) return false;
  if (f.adverseOnly && !(o && o.isAdverse)) return false;
  if (!inPeriod(r.createdAt, f.period)) return false;
  if (f.overdue && !hasOverdueWork(r)) return false;
  if (f.semResp && !hasUnassignedWork(r)) return false;
  if (f.resp.length && !r.phases.some((p) => p.assigneeName && f.resp.includes(p.assigneeName))) return false;
  if (f.types.length && !f.types.includes(r.type)) return false;
  if (f.depts.length && !f.depts.includes(r.dept)) return false;
  if (f.tags.length && !f.tags.some((t) => r.tags.includes(t))) return false;
  if (f.progress !== "any") {
    const { done, total } = phaseProgress(r);
    if (f.progress === "none" && done !== 0) return false;
    if (f.progress === "partial" && !(done > 0 && done < total)) return false;
    if (f.progress === "all" && !(total > 0 && done === total)) return false;
  }
  if (f.q) {
    const n = f.q.trim().toLowerCase();
    if (n && !(fmtCaseNumber(r.n).toLowerCase().includes(n) || String(r.n).includes(n) || (r.label || "").toLowerCase().includes(n) || r.tags.some((t) => t.toLowerCase().includes(n)))) return false;
  }
  return true;
}
const normF = (f) => JSON.stringify({ ...f, q: "" });
function panelCount(f) { return f.resp.length + f.types.length + f.tags.length + f.depts.length + (f.semResp ? 1 : 0) + (f.adverseOnly ? 1 : 0) + (f.progress !== "any" ? 1 : 0); }

const BUILTIN_VIEWS = [
  { id: "all", name: "Todos os casos", f: { ...DEFAULT_F } },
  { id: "fila", name: "Fila de revisão", f: { ...DEFAULT_F, status: "in_review" } },
  { id: "atras", name: "Atrasados", f: { ...DEFAULT_F, overdue: true } },
  { id: "adv", name: "Adversos em aberto", f: { ...DEFAULT_F, status: "abertos", adverseOnly: true } },
];

function SavedViews({ f, setF, onSave }) {
  const [custom, setCustom] = React.useState(() => { try { return JSON.parse(localStorage.getItem("mc_views") || "[]"); } catch { return []; } });
  const views = [...BUILTIN_VIEWS, ...custom];
  const cur = normF(f);
  const activeId = (views.find((v) => normF({ ...DEFAULT_F, ...v.f }) === cur) || {}).id;
  const removeView = (id) => { const next = custom.filter((v) => v.id !== id); setCustom(next); localStorage.setItem("mc_views", JSON.stringify(next)); };
  const saveView = (name) => {
    const next = [...custom, { id: "u" + Date.now(), name, f: { ...f, q: "" } }];
    setCustom(next); localStorage.setItem("mc_views", JSON.stringify(next));
  };
  return (
    <div className="vtabs" role="tablist" aria-label="Visões salvas">
      {views.map((v) => (
        <button key={v.id} role="tab" aria-selected={activeId === v.id} className={"vtab" + (activeId === v.id ? " on" : "")} onClick={() => setF({ ...DEFAULT_F, ...v.f, q: f.q })}>
          {v.name}
          {v.id.startsWith("u") && <span className="vx" onClick={(e) => { e.stopPropagation(); removeView(v.id); }} title="Excluir visão"><I n="x" s={11} w={2} /></span>}
        </button>
      ))}
      {activeId === undefined && <button className="vtab" style={{ color: "var(--primary)", fontWeight: 600 }} onClick={() => onSave(saveView)}><I n="bookmark" s={13} /> Salvar visão</button>}
    </div>
  );
}

function DropChip({ label, value, children, width }) {
  const [open, setOpen] = React.useState(false);
  const ref = usePop(() => setOpen(false));
  return (
    <div className="popwrap" ref={ref}>
      <button className={"chip dd" + (value ? " set" : "")} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {label}{value ? ": " + value : ""} <I n="chevD" s={13} />
      </button>
      {open && <div className="pop" style={width ? { minWidth: width } : null}>{children(() => setOpen(false))}</div>}
    </div>
  );
}

function ChipBar({ f, setF, rows, onOpenPanel }) {
  const countBy = (st) => rows.filter((r) => st === "todos" ? true : r.status === st).length;
  const nPanel = panelCount(f);
  const oc = f.outcome === "sem" ? "Sem desfecho" : f.outcome ? OUTCOMES.find((o) => o.id === f.outcome).label : null;
  return (
    <div className="chiprow" role="group" aria-label="Filtros rápidos">
      {window.STATUS_AS_DROPDOWN ? (
        <DropChip label="Status" value={f.status !== "todos" ? STATUS_META[f.status].label : null}>
          {(close) => (<>
            <button className={"pop-it" + (f.status === "todos" ? " on" : "")} onClick={() => { setF({ ...f, status: "todos" }); close(); }}>
              Todos os status <span className="ct" style={{ marginLeft: "auto", font: "400 11.5px var(--font-sans)", color: "var(--muted-fg)" }}>{countBy("todos")}</span>
              {f.status === "todos" && <span className="tick"><I n="check" s={14} /></span>}
            </button>
            <div className="pop-div"></div>
            {CASE_STATUSES.map((st) => (
              <button key={st} className={"pop-it" + (f.status === st ? " on" : "")} onClick={() => { setF({ ...f, status: st }); close(); }}>
                <span className="cdot" style={{ width: 7, height: 7, borderRadius: 99, background: STATUS_META[st].color, flexShrink: 0 }}></span>
                {STATUS_META[st].label}
                <span className="ct" style={{ marginLeft: "auto", font: "400 11.5px var(--font-sans)", color: "var(--muted-fg)", fontVariantNumeric: "tabular-nums" }}>{countBy(st)}</span>
                {f.status === st && <span className="tick"><I n="check" s={14} /></span>}
              </button>
            ))}
          </>)}
        </DropChip>
      ) : (<>
        {["todos", ...CASE_STATUSES].map((st) => (
          <button key={st} className={"chip" + (f.status === st ? " on" : "")} aria-pressed={f.status === st} onClick={() => setF({ ...f, status: st })}>
            {st !== "todos" && <span className="cdot" style={{ background: STATUS_META[st].color }}></span>}
            {st === "todos" ? "Todos" : STATUS_META[st].label}
            <span className="cn">{countBy(st)}</span>
          </button>
        ))}
        <span className="chipdiv" aria-hidden="true"></span>
      </>)}
      <DropChip label="Desfecho" value={oc}>
        {(close) => (<>
          <button className={"pop-it" + (!f.outcome ? " on" : "")} onClick={() => { setF({ ...f, outcome: null }); close(); }}>Todos os desfechos {!f.outcome && <span className="tick"><I n="check" s={14} /></span>}</button>
          <button className={"pop-it" + (f.outcome === "sem" ? " on" : "")} onClick={() => { setF({ ...f, outcome: "sem" }); close(); }}>Sem desfecho {f.outcome === "sem" && <span className="tick"><I n="check" s={14} /></span>}</button>
          <div className="pop-div"></div>
          {OUTCOMES.map((o) => (
            <button key={o.id} className={"pop-it" + (f.outcome === o.id ? " on" : "")} onClick={() => { setF({ ...f, outcome: o.id }); close(); }}>
              <Badge label={o.label} tk={o.tk} lc /> {f.outcome === o.id && <span className="tick"><I n="check" s={14} /></span>}
            </button>
          ))}
        </>)}
      </DropChip>
      <DropChip label="Período" value={periodLabel(f.period)} width={250}>
        {(close) => {
          const custom = typeof f.period === "object" ? f.period : { from: "", to: "" };
          return (<>
            <button className={"pop-it" + (f.period === "all" ? " on" : "")} onClick={() => { setF({ ...f, period: "all" }); close(); }}>Qualquer data</button>
            {PERIODS.map(([k, l]) => (
              <button key={k} className={"pop-it" + (f.period === k ? " on" : "")} onClick={() => { setF({ ...f, period: k }); close(); }}>{l} {f.period === k && <span className="tick"><I n="check" s={14} /></span>}</button>
            ))}
            <div className="pop-div"></div>
            <div className="pop-h">Intervalo personalizado</div>
            <div className="pop-dates">
              <input type="date" value={custom.from} aria-label="De" onChange={(e) => setF({ ...f, period: { ...custom, from: e.target.value } })} />
              <input type="date" value={custom.to} aria-label="Até" onChange={(e) => setF({ ...f, period: { ...custom, to: e.target.value } })} />
            </div>
          </>);
        }}
      </DropChip>
      <button className={"chip" + (f.overdue ? " warnon" : "")} aria-pressed={f.overdue} onClick={() => setF({ ...f, overdue: !f.overdue })}>
        <I n="alert" s={13} /> Fase atrasada
      </button>
      <button className="chip morebtn" onClick={onOpenPanel} style={nPanel ? { borderColor: "color-mix(in oklab,var(--primary) 40%,var(--border))", color: "var(--primary)", fontWeight: 600 } : null}>
        <I n="filter" s={13} /> Mais filtros {nPanel > 0 && <span className="fcount">{nPanel}</span>}
      </button>
    </div>
  );
}

function ActiveFilters({ f, setF }) {
  const items = [];
  const rm = (patch) => () => setF({ ...f, ...patch });
  if (f.status !== "todos") items.push({ k: "Status", v: f.status === "abertos" ? "Em aberto" : STATUS_META[f.status].label, c: rm({ status: "todos" }) });
  if (f.outcome) items.push({ k: "Desfecho", v: f.outcome === "sem" ? "Sem desfecho" : OUTCOMES.find((o) => o.id === f.outcome).label, c: rm({ outcome: null }) });
  if (f.period !== "all") items.push({ k: "Período", v: periodLabel(f.period), c: rm({ period: "all" }) });
  if (f.overdue) items.push({ k: "Fase atrasada", v: null, c: rm({ overdue: false }) });
  f.resp.forEach((r) => items.push({ k: "Resp.", v: r, c: () => setF({ ...f, resp: f.resp.filter((x) => x !== r) }) }));
  f.types.forEach((t) => items.push({ k: "Tipo", v: t, c: () => setF({ ...f, types: f.types.filter((x) => x !== t) }) }));
  f.tags.forEach((t) => items.push({ k: "Etiqueta", v: t, c: () => setF({ ...f, tags: f.tags.filter((x) => x !== t) }) }));
  f.depts.forEach((d) => items.push({ k: "Setor", v: d, c: () => setF({ ...f, depts: f.depts.filter((x) => x !== d) }) }));
  if (f.semResp) items.push({ k: "Sem responsável", v: null, c: rm({ semResp: false }) });
  if (f.adverseOnly) items.push({ k: "Apenas adversos", v: null, c: rm({ adverseOnly: false }) });
  if (f.progress !== "any") items.push({ k: "Progresso", v: PROGRESS_OPTS.find(([k]) => k === f.progress)[1], c: rm({ progress: "any" }) });
  if (!items.length) return null;
  return (
    <div className="afbar rise">
      <span className="afbar-l">{items.length === 1 ? "1 filtro ativo" : items.length + " filtros ativos"}</span>
      {items.map((it, i) => (
        <span key={i} className="afchip"><b>{it.k}</b>{it.v && <>· {it.v}</>}<button onClick={it.c} aria-label={"Remover filtro " + it.k}><I n="x" s={11} w={2.2} /></button></span>
      ))}
      <button className="afclear" onClick={() => setF({ ...DEFAULT_F, q: f.q })}>Limpar tudo</button>
    </div>
  );
}

function CheckList({ title, opts, sel, onChange, counts }) {
  return (
    <div className="fsec">
      <div className="fsec-t">{title}{sel.length > 0 && <button className="clr" onClick={() => onChange([])}>Limpar</button>}</div>
      {opts.map((o) => {
        const on = sel.includes(o);
        return (
          <button key={o} className={"fopt" + (on ? " on" : "")} aria-pressed={on} onClick={() => onChange(on ? sel.filter((x) => x !== o) : [...sel, o])}>
            <span className="ck"><I n="check" s={11} w={3} /></span>{o}
            {counts && <span className="ct">{counts(o)}</span>}
          </button>
        );
      })}
    </div>
  );
}

function FilterPanel({ f, setF, rows, onClose }) {
  const [draft, setDraft] = React.useState(f);
  const preview = rows.filter((r) => matchRow(r, draft)).length;
  const cnt = (pred) => rows.filter(pred).length;
  const apply = () => { setF(draft); onClose(); };
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey); return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (<>
    <div className="ovl" onClick={onClose}></div>
    <aside className="panel" role="dialog" aria-label="Filtros avançados">
      <div className="panel-hd">
        <h2>Filtros avançados</h2>
        <button className="btn btn-gh btn-sm" onClick={() => setDraft({ ...DEFAULT_F, q: draft.q, status: draft.status, outcome: draft.outcome, period: draft.period, overdue: draft.overdue })}>Limpar</button>
        <button className="btn btn-gh btn-sm" onClick={onClose} aria-label="Fechar"><I n="x" s={16} /></button>
      </div>
      <div className="panel-bd">
        <CheckList title="Responsável" opts={MEMBERS} sel={draft.resp} onChange={(v) => setDraft({ ...draft, resp: v })}
          counts={(m) => cnt((r) => r.phases.some((p) => p.assigneeName === m))} />
        <CheckList title="Tipo de caso" opts={CASE_TYPES} sel={draft.types} onChange={(v) => setDraft({ ...draft, types: v })}
          counts={(t) => cnt((r) => r.type === t)} />
        <div className="fsec">
          <div className="fsec-t">Etiquetas{draft.tags.length > 0 && <button className="clr" onClick={() => setDraft({ ...draft, tags: [] })}>Limpar</button>}</div>
          <div className="tagchips">
            {TAGS.map((t) => {
              const on = draft.tags.includes(t);
              return <button key={t} className={"tagchip" + (on ? " on" : "")} aria-pressed={on} onClick={() => setDraft({ ...draft, tags: on ? draft.tags.filter((x) => x !== t) : [...draft.tags, t] })}>{t}</button>;
            })}
          </div>
        </div>
        <CheckList title="Unidade / setor" opts={DEPTS} sel={draft.depts} onChange={(v) => setDraft({ ...draft, depts: v })}
          counts={(d) => cnt((r) => r.dept === d)} />
        <div className="fsec">
          <div className="fsec-t">Progresso das fases</div>
          <div className="segline">
            {PROGRESS_OPTS.map(([k, l]) => (
              <button key={k} className={"tagchip" + (draft.progress === k ? " on" : "")} onClick={() => setDraft({ ...draft, progress: k })}>{l}</button>
            ))}
          </div>
        </div>
        <div className="fsec">
          <button className={"fopt" + (draft.semResp ? " on" : "")} aria-pressed={draft.semResp} onClick={() => setDraft({ ...draft, semResp: !draft.semResp })}>
            Sem responsável <span className="sw"></span>
          </button>
          <button className={"fopt" + (draft.adverseOnly ? " on" : "")} aria-pressed={draft.adverseOnly} onClick={() => setDraft({ ...draft, adverseOnly: !draft.adverseOnly })}>
            Apenas desfechos adversos <span className="sw"></span>
          </button>
        </div>
      </div>
      <div className="panel-ft">
        <span className="countline" style={{ flex: 1 }}>{preview} {preview === 1 ? "caso" : "casos"}</span>
        <button className="btn btn-out" onClick={onClose}>Cancelar</button>
        <button className="btn btn-pri" onClick={apply}>Aplicar filtros</button>
      </div>
    </aside>
  </>);
}

Object.assign(window, { DEFAULT_F, matchRow, normF, panelCount, SavedViews, ChipBar, ActiveFilters, FilterPanel, PROGRESS_OPTS, periodLabel });
