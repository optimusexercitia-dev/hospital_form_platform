// table + kanban views
function SortTh({ label, k, sort, setSort }) {
  const active = sort.k === k;
  const n = active ? (sort.dir === "asc" ? "arrowUp" : "arrowDown") : "sort";
  return (
    <th scope="col" aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
      <button onClick={() => setSort(active ? { k, dir: sort.dir === "asc" ? "desc" : "asc" } : { k, dir: "asc" })}>
        {label} <I n={n} s={12} w={2} />
      </button>
    </th>
  );
}
const STATUS_RANK = Object.fromEntries(CASE_STATUSES.map((s, i) => [s, i]));

function CasesTable({ rows }) {
  const [sort, setSort] = React.useState({ k: "caso", dir: "desc" });
  const sorted = React.useMemo(() => {
    const a = [...rows];
    a.sort((x, y) => {
      let c = 0;
      if (sort.k === "caso") c = x.n - y.n;
      else if (sort.k === "criado") c = new Date(x.createdAt) - new Date(y.createdAt);
      else c = STATUS_RANK[x.status] - STATUS_RANK[y.status];
      return sort.dir === "asc" ? c : -c;
    });
    return a;
  }, [rows, sort]);
  return (
    <div className="tblwrap rise">
      <table>
        <thead>
          <tr>
            <SortTh label="Caso" k="caso" sort={sort} setSort={setSort} />
            <th scope="col">Rótulo</th>
            <SortTh label="Status" k="status" sort={sort} setSort={setSort} />
            <th scope="col">Desfecho</th>
            <th scope="col">Progresso</th>
            <th scope="col">Fase atual</th>
            <th scope="col">Resp.</th>
            <SortTh label="Criado" k="criado" sort={sort} setSort={setSort} />
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr style={{ cursor: "default" }}><td colSpan={8}><div className="emptyrow">Nenhum caso corresponde aos filtros.</div></td></tr>
          ) : sorted.map((r) => {
            const o = outcomeOf(r), cp = currentPhase(r), acts = activePhases(r);
            return (
              <tr key={r.id} onClick={() => {}} tabIndex={0}>
                <td><span className="caseid">{fmtCaseNumber(r.n)}</span></td>
                <td>{r.label ? <span className="lbl">{r.label}</span> : <span className="nolbl">Sem rótulo</span>}</td>
                <td><StatusBadge status={r.status} /></td>
                <td>{o ? <Badge label={o.label} tk={o.tk} lc /> : <span style={{ color: "var(--muted-fg)" }}>—</span>}</td>
                <td><PhaseDots row={r} /></td>
                <td className="phcell">
                  {acts.length > 1 ? <span className="t">{acts.length} fases ativas</span> : cp ? (<>
                    <span className="t">Fase {cp.position}</span>
                    <span className="s">{cp.title}</span>
                    {cp.dueDate && (() => { const late = isOverduePhase(cp); return <span className={"due" + (late ? " late" : "")}><I n="cal" s={11} /> {fmtDate(cp.dueDate)}{late && " · Atrasada"}</span>; })()}
                  </>) : <span style={{ color: "var(--muted-fg)" }}>—</span>}
                </td>
                <td><Avatar name={cp ? cp.assigneeName : null} /></td>
                <td className="datecell">{fmtDate(r.createdAt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function KCard({ r, i }) {
  const m = STATUS_META[r.status], o = outcomeOf(r), cp = currentPhase(r), acts = activePhases(r);
  const { done, total } = phaseProgress(r);
  return (
    <a className="kcard rise" href="#" onClick={(e) => e.preventDefault()} style={{ borderLeftColor: m.color, "--d": Math.min(i, 8) * 40 + "ms" }}>
      <div className="top">
        <span className="caseid">{fmtCaseNumber(r.n)}</span>
        {r.tags.includes("Sentinela") && <Badge label="Sentinela" tk="red" />}
      </div>
      <p className="sum" style={!r.label ? { color: "var(--muted-fg)", fontStyle: "italic" } : null}>{r.label || "Sem rótulo"}</p>
      {o && <div style={{ marginTop: 7 }}><Badge label={o.label} tk={o.tk} lc /></div>}
      <div className="meta">
        <span className="ds" style={{ display: "flex", gap: 4 }} aria-hidden="true">{[...r.phases].sort((a, b) => a.position - b.position).map((p) => <span key={p.position} className={"pd " + p.status}></span>)}</span>
        <span className="pfrac">{done}/{total}</span>
        {acts.length > 1 ? <span>· {acts.length} fases ativas</span> : cp ? <span>· Fase {cp.position}</span> : null}
        {hasOverdueWork(r) && <span style={{ color: "var(--destructive)", fontWeight: 600 }}>· Atrasada</span>}
      </div>
      <div className="foot">
        <span className="who"><Avatar name={cp ? cp.assigneeName : null} /><span>{acts.length > 1 ? acts.length + " responsáveis" : (cp && cp.assigneeName) || "Não atribuído"}</span></span>
        <span className="age"><I n="clock" s={12} /> {ageLabel(r.createdAt)}</span>
      </div>
    </a>
  );
}

function CasesKanban({ rows }) {
  return (
    <div className="kb">
      {CASE_STATUSES.map((st) => {
        const m = STATUS_META[st], items = rows.filter((r) => r.status === st);
        return (
          <section key={st} className="kcol" aria-label={m.label}>
            <header className="kcol-hd">
              <span className="cdot" style={{ width: 8, height: 8, borderRadius: 99, background: m.color, flexShrink: 0 }} aria-hidden="true"></span>
              <h3>{m.label}</h3>
              <span className="kcol-ct">{items.length}</span>
            </header>
            <div className="kcol-bd">
              {items.length === 0 ? <p className="kempty">Nenhum caso</p> : items.map((r, i) => <KCard key={r.id} r={r} i={i} />)}
            </div>
          </section>
        );
      })}
    </div>
  );
}
Object.assign(window, { CasesTable, CasesKanban });
