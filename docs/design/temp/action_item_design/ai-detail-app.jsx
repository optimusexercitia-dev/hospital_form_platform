// App shell — sidebar, layout, state + role tweak
const AID_NAV = [
  { h: "Geral" },
  { l: "Visão geral", i: "layout-dashboard" },
  { h: "Meu trabalho" },
  { l: "Formulários", i: "clipboard-list" },
  { l: "Minhas respostas", i: "list-checks" },
  { l: "Meus itens de ação", i: "list-todo", on: true, ct: 2 },
  { l: "Meus Casos", i: "briefcase", ct: 4 },
  { l: "Reuniões", i: "calendar-days" },
  { l: "Eventos de segurança", i: "shield-alert" },
  { l: "Encaminhamentos", i: "swap" },
  { h: "Organização" },
  { l: "Aprovações pendentes", i: "clipboard-check" },
];

function AidSidebar({ user }) {
  return (
    <aside className="sb">
      <div className="sb-logo"><span className="sb-mark">CH</span><span className="sb-name">Comissões</span></div>
      <p className="sb-comm">Comissão de Controle de Infecção Hospitalar</p>
      <nav className="sb-nav" aria-label="Navegação da comissão">
        {AID_NAV.map((n, i) => n.h
          ? <p key={i} className="sb-h">{n.h}</p>
          : <button key={i} type="button" className={"sb-a" + (n.on ? " on" : "")}><AiIcon n={n.i} s={16} />{n.l}{n.ct && <span className="sb-ct">{n.ct}</span>}</button>
        )}
      </nav>
      <div className="sb-foot">
        <AiAvatar name={user.name} size={30} />
        <div style={{ minWidth: 0 }}><p className="sb-uname">{user.name}</p><p className="sb-urole">{user.role}</p></div>
      </div>
    </aside>
  );
}

const AID_TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "papel": "Responsável"
}/*EDITMODE-END*/;

function AidApp() {
  const [t, setTweak] = useTweaks(AID_TWEAK_DEFAULTS);
  const role = t.papel === "Coordenação" ? "coord" : "member";
  const user = window.AID.users[role];
  const D = window.AID;
  const [it, setIt] = React.useState(D.item);
  const [checklist, setChecklist] = React.useState(D.checklist);
  const [reminders, setReminders] = React.useState(D.reminders);
  const [following, setFollowing] = React.useState(false);
  const [activity, setActivity] = React.useState(D.activity);
  const [composerType, setComposerType] = React.useState("progress");
  const [dueEditOpen, setDueEditOpen] = React.useState(false);
  const composerRef = React.useRef(null);
  const uid = React.useRef(100);
  const nid = () => "n" + uid.current++;
  const NOW = "23/08/2026, agora";

  const sys = (icon, html) => setActivity((a) => [{ id: nid(), kind: "system", icon, at: NOW, html }, ...a]);
  const setStatus = (status, patch, icon, html) => { setIt((p) => ({ ...p, status, ...patch })); sys(icon, html); };

  const onStart = () => setStatus("in_progress", { startedAt: "23/08/2026" }, "play", [{ b: user.name }, " iniciou o item — status alterado para ", { b: "Em andamento" }]);
  const onComplete = () => setStatus("done", { completedAt: "23/08/2026", completedBy: user.name }, "check", ["Item concluído por ", { b: user.name }]);
  const onCancel = () => setStatus("cancelled", { cancelledAt: "23/08/2026" }, "ban", ["Item cancelado por ", { b: user.name }]);
  const onReopen = () => setStatus("in_progress", { completedAt: null, startedAt: it.startedAt || "23/08/2026" }, "rotate-ccw", ["Item reaberto por ", { b: user.name }]);

  const onUpdate = (type, text) => {
    setActivity((a) => [{ id: nid(), kind: "update", type, author: user.name, at: NOW, text }, ...a]);
  };
  const onToggle = (id) => {
    setChecklist((cs) => cs.map((c) => c.id === id ? { ...c, done: !c.done, by: !c.done ? user.name.split(" ")[1] || user.name : undefined, at: !c.done ? "23/08" : undefined } : c));
    const c = checklist.find((x) => x.id === id);
    if (c && !c.done) sys("check", ["Subtarefa concluída: ", { b: c.title }]);
  };
  const onAddCheck = (title) => setChecklist((cs) => [...cs, { id: nid(), title, done: false }]);
  const onReassign = (name) => { setIt((p) => ({ ...p, assignee: name })); sys("user", ["Atribuído a ", { b: name }, " por " + user.name]); };
  const onDue = (iso) => { setIt((p) => ({ ...p, dueDate: iso })); sys("calendar-clock", ["Prazo alterado para ", { b: aidFmt(iso) }, " por " + user.name]); };
  const onPrio = (p) => { setIt((x) => ({ ...x, priority: p })); sys("flag", ["Prioridade definida como ", { b: AID_PRIO[p].label.replace("Prioridade ", "") }]); };
  const onRemoveRem = (id) => setReminders((rs) => rs.filter((r) => r.id !== id));
  const onAddRem = (text) => setReminders((rs) => [...rs, { id: nid(), text }]);
  const watchers = following ? [...D.watchers, user.name] : D.watchers.filter((w) => w !== user.name);
  const focusBlocker = () => { setComposerType("blocker"); requestAnimationFrame(() => composerRef.current && composerRef.current.focus()); };
  const openDueEdit = () => setDueEditOpen(true);

  return (
    <div className="aid">
      <div className="aid-shell">
        <AidSidebar user={user} />
        <div className="aid-mainwrap">
          <div className="aid-content">
            <div className="col">
              <a className="backlk rise" href="#" onClick={(e) => e.preventDefault()}><AiIcon n="arrow-left" s={15} />Meus itens de ação</a>
              <AidBanner it={it} role={role} onBlocker={focusBlocker} onEditDue={openDueEdit} />
              <AidHeader it={it} role={role} onStart={onStart} onComplete={onComplete} onCancel={onCancel} onReopen={onReopen} />
              <AidStepper it={it} />
              <AidChecklist list={checklist} canContribute={it.status !== "cancelled"} onToggle={onToggle} onAdd={onAddCheck} />
              <AidActivity items={activity} canContribute={it.status !== "cancelled"} composerType={composerType} setComposerType={setComposerType} onSubmit={onUpdate} composerRef={composerRef} />
            </div>
            <div className="rail">
              <AidDetails it={it} role={role} dueEditOpen={dueEditOpen} setDueEditOpen={setDueEditOpen} onReassign={onReassign} onDue={onDue} onPrio={onPrio} />
              <AidReminders list={reminders} canManage={role === "coord"} onRemove={onRemoveRem} onAdd={onAddRem} />
              <AidWatchers list={watchers} following={following} onToggle={() => setFollowing(!following)} />
              <AidLinked list={D.linked} />
            </div>
          </div>
        </div>
      </div>
      <TweaksPanel>
        <TweakSection label="Ponto de vista" />
        <TweakRadio label="Papel" value={t.papel} options={["Responsável", "Coordenação"]} onChange={(v) => setTweak("papel", v)} />
      </TweaksPanel>
    </div>
  );
}
Object.assign(window, { AidApp });
