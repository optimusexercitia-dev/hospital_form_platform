// app shell: sidebar + header + KPIs + outcome strip + orchestration
const NAV = [
  { h: "Comissão" },
  { l: "Visão geral", i: "home" },
  { l: "Casos", i: "folder", on: true, ct: CASES.length },
  { l: "Reuniões", i: "calDays" },
  { l: "Formulários", i: "file" },
  { l: "Documentos", i: "docs" },
  { l: "Indicadores", i: "chart" },
  { l: "Membros", i: "users" },
  { h: "Administração" },
  { l: "Configurações", i: "gear" },
];
function Sidebar() {
  return (
    <nav className="sb">
      <div className="sb-logo"><span className="sb-mark">SM</span><span className="sb-name">Santa Marta</span></div>
      <div className="sb-comm">Comissão de Óbitos e Eventos Adversos</div>
      <div className="sb-nav">
        {NAV.map((it, i) => it.h ? <div key={i} className="sb-h">{it.h}</div> : (
          <button key={i} className={"sb-a" + (it.on ? " on" : "")}><I n={it.i} s={16} />{it.l}{it.ct != null && <span className="sb-ct">{it.ct}</span>}</button>
        ))}
      </div>
      <div className="sb-foot"><span className="av">HC</span><div><div className="sb-uname">Dra. Helena Cruz</div><div className="sb-urole">Coordenadora</div></div></div>
    </nav>
  );
}

function KpiStrip({ rows, f, setF }) {
  const k = computeKpis(rows);
  const eq = (patch) => Object.entries(patch).every(([key, v]) => JSON.stringify(f[key]) === JSON.stringify(v));
  const toggle = (patch, reset) => () => {
    if (eq(patch)) setF({ ...f, ...reset });
    else setF({ ...DEFAULT_F, q: f.q, ...patch });
  };
  const cards = [
    { l: "Em aberto", v: k.abertos, s: k.abertosMes > 0 ? "+" + k.abertosMes + " este mês" : "Nenhum novo este mês", tone: "var(--primary)", patch: { status: "abertos" }, reset: { status: "todos" } },
    { l: "Fases ativas", v: k.fasesAtivas, s: "em " + k.casosComFaseAtiva + (k.casosComFaseAtiva === 1 ? " caso" : " casos"), tone: "var(--muted-fg)", patch: { status: "in_review" }, reset: { status: "todos" } },
    { l: "Etapas pendentes", v: k.fasesPendentes, s: "Fases e narrativas em aberto", tone: "var(--warning)", patch: { status: "pending" }, reset: { status: "todos" } },
    { l: "Fases atrasadas", v: k.atrasadas, s: "em " + k.casosAtrasados + (k.casosAtrasados === 1 ? " caso" : " casos"), tone: "var(--destructive)", patch: { overdue: true }, reset: { overdue: false } },
    { l: "Encerrados no mês", v: k.concluidosMes, s: k.concluidos + " no total", tone: "var(--success)", patch: { status: "completed", period: "month" }, reset: { status: "todos", period: "all" } },
  ];
  return (
    <section className="kpis" aria-label="Indicadores dos casos">
      {cards.map((c, i) => (
        <button key={c.l} className={"kpi rise" + (eq(c.patch) ? " on" : "")} style={{ "--d": i * 60 + "ms" }} onClick={toggle(c.patch, c.reset)} title="Clique para filtrar">
          <span className="kpi-x">Filtrando</span>
          <span className="kpi-l">{c.l}</span>
          <span className="kpi-v">{c.v}</span>
          <span className="kpi-s"><span className="dot" style={{ background: c.tone }}></span><span>{c.s}</span></span>
        </button>
      ))}
      <a className="kpi rise" style={{ "--d": "300ms", textDecoration: "none", color: "inherit" }} href="#" onClick={(e) => e.preventDefault()} title="Abrir itens de ação">
        <span className="kpi-l" style={{ display: "flex", alignItems: "center", gap: 5 }}>Itens de ação em atraso <I n="ext" s={11} /></span>
        <span className="kpi-v" style={ACTION_ITEMS.overdue > 0 ? { color: "var(--destructive)" } : null}>{ACTION_ITEMS.overdue}</span>
        <span className="kpi-s"><span className="dot" style={{ background: "var(--destructive)" }}></span><span>de {ACTION_ITEMS.open} abertos</span></span>
      </a>
    </section>
  );
}

function OutcomeStrip({ rows }) {
  const [open, setOpen] = React.useState(false);
  const b = computeBreakdown(rows);
  if (b.total === 0) return null;
  const TKC = { red: "var(--destructive)", amber: "var(--warning)", green: "var(--success)", slate: "var(--st-todo)", muted: "var(--muted-fg)", blue: "var(--primary)", violet: "oklch(.55 .12 320)" };
  return (
    <div className="ocard rise" style={{ "--d": "120ms" }}>
      <button className="ocard-hd" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="ocard-t">Desfechos</span>
        <span className="ocard-sub">{b.total} {b.total === 1 ? "caso com desfecho" : "casos com desfecho"}</span>
        <span className="obar" aria-hidden="true">
          {b.list.map((o) => <span key={o.id} style={{ width: (o.count / b.total) * 100 + "%", background: TKC[o.tk] }} title={o.label + " · " + o.count}></span>)}
        </span>
        <span className="ocard-adv">{b.pct}% adversos ({b.adverse}/{b.total})</span>
        <span className={"ocard-chev" + (open ? " open" : "")}><I n="chevD" s={16} /></span>
      </button>
      {open && (
        <div className="ocard-body">
          {b.list.map((o) => (
            <div key={o.id} className="orow">
              <Badge label={o.label} tk={o.tk} lc />
              {o.isAdverse && <span style={{ font: "600 9.5px var(--font-sans)", letterSpacing: ".05em", textTransform: "uppercase", color: "var(--destructive)" }}>Adverso</span>}
              <span className="ct">{o.count} · {Math.round((o.count / b.total) * 100)}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SaveViewDialog({ onSave, onClose }) {
  const [name, setName] = React.useState("");
  return (
    <div className="dlg" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dlg-c" role="dialog" aria-label="Salvar visão">
        <h3>Salvar visão</h3>
        <p>Os filtros atuais ficarão disponíveis como uma aba para acesso rápido.</p>
        <input autoFocus placeholder="Nome da visão — ex.: Óbitos em análise" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) { onSave(name.trim()); onClose(); } }} />
        <div className="dlg-ft">
          <button className="btn btn-out" onClick={onClose}>Cancelar</button>
          <button className="btn btn-pri" disabled={!name.trim()} style={!name.trim() ? { opacity: .5, pointerEvents: "none" } : null} onClick={() => { onSave(name.trim()); onClose(); }}>Salvar</button>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [f, setF] = React.useState({ ...DEFAULT_F });
  const [view, setView] = React.useState("table");
  const [panel, setPanel] = React.useState(false);
  const [saveDlg, setSaveDlg] = React.useState(null); // holds the saveView fn
  const rows = CASES;
  const filtered = React.useMemo(() => rows.filter((r) => matchRow(r, f)), [rows, f]);
  return (
    <div className="shell">
      <Sidebar />
      <main className="main">
        <div className="content">
          <header className="hd-row rise">
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span className="eyebrow">Comissão de Óbitos e Eventos Adversos</span>
              <h1 className="h1">Casos</h1>
              <p className="hd-desc">Acompanhe as avaliações multifásicas em andamento e o progresso de cada fase. Um caso é identificado por um número — nunca por dados de paciente.</p>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn btn-out"><I n="layers" s={15} /> Múltiplos casos</button>
              <button className="btn btn-pri"><I n="plus" s={15} w={2} /> Novo caso</button>
            </div>
          </header>

          <KpiStrip rows={rows} f={f} setF={setF} />
          <OutcomeStrip rows={rows} />

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="viewsrow rise" style={{ "--d": "160ms" }}>
              <SavedViews f={f} setF={setF} onSave={(fn) => setSaveDlg(() => fn)} />
              <div className="toolbar-right">
                <div className="search">
                  <I n="search" s={15} />
                  <input type="search" placeholder="Buscar caso, rótulo ou etiqueta" aria-label="Buscar" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
                </div>
                <div className="seg" role="group" aria-label="Modo de visualização">
                  <button className={view === "table" ? "on" : ""} aria-pressed={view === "table"} onClick={() => setView("table")}><I n="table" s={13} /> Tabela</button>
                  <button className={view === "kanban" ? "on" : ""} aria-pressed={view === "kanban"} onClick={() => setView("kanban")}><I n="kanban" s={13} /> Kanban</button>
                </div>
              </div>
            </div>
            <ChipBar f={f} setF={setF} rows={rows} onOpenPanel={() => setPanel(true)} />
            <ActiveFilters f={f} setF={setF} />
            <p className="countline">{filtered.length === rows.length ? rows.length + " casos" : filtered.length + " de " + rows.length + " casos"}</p>
            {view === "table" ? <CasesTable rows={filtered} /> : <CasesKanban rows={filtered} />}
          </div>
        </div>
      </main>
      {panel && <FilterPanel f={f} setF={setF} rows={rows} onClose={() => setPanel(false)} />}
      {saveDlg && <SaveViewDialog onSave={saveDlg} onClose={() => setSaveDlg(null)} />}
    </div>
  );
}
ReactDOM.createRoot(document.getElementById("root")).render(<App />);
