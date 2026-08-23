// Shared primitives — Action Item detail prototype
const AID_ICONS = {
  "arrow-left": '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  "arrow-up-right": '<path d="M7 7h10v10"/><path d="M7 17 17 7"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  "check-circle": '<path d="M21.801 10A10 10 0 1 1 17 3.335"/><path d="m9 11 3 3L22 4"/>',
  play: '<polygon points="6 3 20 12 6 21 6 3"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  bell: '<path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/>',
  "alert-triangle": '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  "alert-circle": '<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  "folder-open": '<path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  "calendar-clock": '<path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h5"/><path d="M17.5 17.5 16 16.25V14"/><circle cx="16" cy="16" r="6"/>',
  "calendar-days": '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/>',
  send: '<path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/>',
  "message-square": '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  "rotate-ccw": '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  pencil: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>',
  eye: '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  "layout-dashboard": '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
  "clipboard-list": '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>',
  "list-checks": '<path d="M13 5h8"/><path d="M13 12h8"/><path d="M13 19h8"/><path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/>',
  "list-todo": '<path d="M13 5h8"/><path d="M13 12h8"/><path d="M13 19h8"/><path d="m3 17 2 2 4-4"/><rect x="3" y="4" width="6" height="6" rx="1"/>',
  briefcase: '<path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><rect width="20" height="14" x="2" y="6" rx="2"/>',
  "shield-alert": '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
  swap: '<path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/>',
  "clipboard-check": '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
  ban: '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
};
function AiIcon({ n, s = 16, className, style }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true" dangerouslySetInnerHTML={{ __html: AID_ICONS[n] || "" }} />;
}
const AID_STATUS = {
  open: { label: "Aberto", cls: "t-open" },
  in_progress: { label: "Em andamento", cls: "t-active" },
  done: { label: "Concluído", cls: "t-done" },
  cancelled: { label: "Cancelado", cls: "t-cancel" },
};
const AID_PRIO = {
  baixa: { label: "Prioridade baixa", cls: "t-cancel" },
  media: { label: "Prioridade média", cls: "t-open" },
  alta: { label: "Prioridade alta", cls: "bdg-warn" },
  critica: { label: "Prioridade crítica", cls: "bdg-dngr" },
};
const AID_UPD = {
  progress: { label: "Progresso", cls: "prog" },
  note: { label: "Nota", cls: "note" },
  blocker: { label: "Impedimento", cls: "blk" },
  deadline_change: { label: "Alteração de prazo", cls: "ddl" },
};
const AID_UPD_ICON = { progress: "message-square", note: "message-square", blocker: "alert-circle", deadline_change: "calendar-clock" };
function AiBadge({ tone, icon, up, title, children }) {
  return <span className={"bdg " + (tone || "") + (up ? " up" : "")} title={title}>{icon && <AiIcon n={icon} s={11} />}{children}</span>;
}
function AiAvatar({ name, size = 26 }) {
  const init = (name || "—").split(" ").filter((w) => w.length > 2 || /^[A-Z]/.test(w)).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return <span className="av" style={{ width: size, height: size, fontSize: size * 0.38 }}>{init}</span>;
}
function AiBtn({ v = "out", sm, icon, children, className, ...rest }) {
  return <button type="button" className={`btn btn-${v}${sm ? " btn-sm" : ""}${className ? " " + className : ""}`} {...rest}>{icon && <AiIcon n={icon} s={sm ? 13 : 15} />}{children}</button>;
}
function AiCard({ title, sub, right, children, d, className }) {
  return (
    <section className={"crd rise" + (className ? " " + className : "")} style={{ "--d": (d || 0) + "ms" }}>
      {title && <div className="crd-hd"><div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}><h2 className="crd-t">{title}</h2>{sub && <p className="crd-sub">{sub}</p>}</div>{right && <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>{right}</div>}</div>}
      {children}
    </section>
  );
}
// pt-BR date helpers pinned to the prototype's "today"
function aidFmt(iso) { const [y, m, d] = iso.split("-"); return `${d}/${m}/${y}`; }
function aidDaysLate(iso) { return Math.round((new Date(window.AID.today) - new Date(iso)) / 864e5); }
Object.assign(window, { AiIcon, AiBadge, AiAvatar, AiBtn, AiCard, AID_STATUS, AID_PRIO, AID_UPD, AID_UPD_ICON, aidFmt, aidDaysLate });
