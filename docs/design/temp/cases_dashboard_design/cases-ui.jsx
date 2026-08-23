// shared primitives: icons, badges, avatar
const IC = {
  search: <path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm10 2-4.35-4.35" />,
  plus: <path d="M5 12h14M12 5v14" />,
  layers: <path d="m12 2 8.5 4.5L12 11 3.5 6.5 12 2ZM3.5 12 12 16.5 20.5 12M3.5 17.5 12 22l8.5-4.5" />,
  filter: <path d="M4 5h16l-6.5 7.5V19l-3 2v-8.5L4 5Z" />,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  chevD: <path d="m6 9 6 6 6-6" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  cal: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" /></>,
  check: <path d="m4 12.5 5 5L20 6.5" />,
  table: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M9 10v10" /></>,
  kanban: <><rect x="4" y="4" width="4.5" height="14" rx="1.2" /><rect x="10" y="4" width="4.5" height="10" rx="1.2" /><rect x="16" y="4" width="4.5" height="7" rx="1.2" /></>,
  home: <path d="m3 10.5 9-7.5 9 7.5V20a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 20v-9.5Z" />,
  folder: <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4.6l2 2.5h8.4A1.5 1.5 0 0 1 21 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5v-12Z" />,
  calDays: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 17.5h.01M12 17.5h.01" /></>,
  file: <path d="M6 2.5h7.5L19 8v12a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 20V4a1.5 1.5 0 0 1 1-1.5ZM13 3v5.5h5.5" />,
  docs: <path d="M8 3.5h9A1.5 1.5 0 0 1 18.5 5v14a1.5 1.5 0 0 1-1.5 1.5H8A1.5 1.5 0 0 1 6.5 19V5A1.5 1.5 0 0 1 8 3.5ZM9.5 8h6M9.5 12h6M9.5 16h4" />,
  chart: <path d="M3 3v16a2 2 0 0 0 2 2h16M8 16v-5M13 16V8M18 16v-8" />,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M12 2v2.5M12 19.5V22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M2 12h2.5M19.5 12H22M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" /></>,
  alert: <path d="M12 3 2.5 20h19L12 3Zm0 7v4m0 3h.01" />,
  bookmark: <path d="M6.5 3.5h11V21L12 17l-5.5 4V3.5Z" />,
  arrowUp: <path d="M12 19V5m-6 6 6-6 6 6" />,
  arrowDown: <path d="M12 5v14m6-6-6 6-6-6" />,
  sort: <path d="m8 9 4-4 4 4M8 15l4 4 4-4" />,
  ext: <path d="M14 4h6v6M20 4l-9 9M19 14v5a1.5 1.5 0 0 1-1.5 1.5h-12A1.5 1.5 0 0 1 4 19V6.5A1.5 1.5 0 0 1 5.5 5H10" />,
};
function I({ n, s = 16, w = 1.7 }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{IC[n]}</svg>;
}
function Badge({ label, tk, lc }) { return <span className={"bdg tk-" + tk + (lc ? " bdg-lc" : "")}>{label}</span>; }
function StatusBadge({ status }) { const m = STATUS_META[status]; return <Badge label={m.label} tk={m.tk} />; }
function Avatar({ name }) {
  return name ? <span className="av" title={name}>{initials(name)}</span> : <span className="av none">—</span>;
}
function PhaseDots({ row }) {
  const { done, total } = phaseProgress(row);
  const ordered = [...row.phases].sort((a, b) => a.position - b.position);
  return (
    <span className="pdots">
      <span className="ds" aria-hidden="true">{ordered.map((p) => <span key={p.position} className={"pd " + p.status}></span>)}</span>
      <span className="pfrac">{done}/{total}</span>
    </span>
  );
}
// popover positioning helper: closes on outside click / Esc
function usePop(close) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) close(); };
    const onKey = (e) => { if (e.key === "Escape") close(); };
    document.addEventListener("mousedown", onDoc); document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [close]);
  return ref;
}
Object.assign(window, { I, Badge, StatusBadge, Avatar, PhaseDots, usePop });
