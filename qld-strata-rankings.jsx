import { useState, useEffect, useMemo } from "react";
import { Crown, ScrollText, Trophy, Droplet, ArrowUpCircle, Swords, Settings } from "lucide-react";

// Polyfill for local dev / any environment outside Claude's own artifact preview.
// Uses the browser's localStorage so data survives a page refresh. Safe to leave
// in permanently -- it steps aside automatically if a real window.storage exists.
if (typeof window !== "undefined" && !window.storage) {
  window.storage = {
    async get(key) {
      const v = localStorage.getItem(key);
      if (v === null) throw new Error("not found");
      return { key, value: v, shared: false };
    },
    async set(key, value) {
      localStorage.setItem(key, value);
      return { key, value, shared: false };
    },
    async delete(key) {
      localStorage.removeItem(key);
      return { key, deleted: true, shared: false };
    },
    async list(prefix = "") {
      const keys = Object.keys(localStorage).filter((k) => k.startsWith(prefix));
      return { keys, prefix, shared: false };
    },
  };
}

const SPONSOR_NAME = "Top Tier Plumbing";
const SPONSOR_NAVY = "#1b2a3f";
const SPONSOR_BLUE = "#3ba3d9";

const AGENCY_LOGOS = {
  "sskb": "data:image/png;base64,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",
  "top tier plumbing": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKcAAABACAMAAABIiZfkAAAAIGNIUk0AAHomAACAhAAA+gAAAIDoAAB1MAAA6mAAADqYAAAXcJy6UTwAAAAtUExURSEzSzJNZTRFWzat3CtsjxosRTey4wwfOZWdqfb291Becba8w2l1hdDU2XmDkioJsBIAAAAHdElNRQfqCQgUDQQaQ2kiAAADAklEQVRo3u2XiZKjIBCGAUWb5nj/x51ukEPNbAzJJtkt/kpNCIJ+9kWPEENDQ0NDQ0NDQ89Lqk8TXNM0608jXJCel0X+A6ByWpbp0xAXRJjL8vWeZ69P0/d7XpIxpfw2z+uiPDNFn8+t5w8ryuzpwmF82HXzLtekJEsplStm9PqGWzyvkg6PkNu0kvV2Td3NV48zooN0BVOEOpuT+Qovs9u0wrYhq13d6tK8Vt5AeTcfL9UZjdtd8HHQE6eu/q4GzZzGN8bRoW4NmZMoMpXKF+2Bs7zWA9IIIRAF/Q1qo5vSQNdUYk5rgQwETfjJshXkbU4LLGw4PYlAHz+VKa5XMoxcU3wzXEmfeZkSAHF6Wkme9Iet5HtcS24cOd3KyrdjTqBv6DEo74cSm/sTs4w3Tr3n3HzfPPOmPd2OcxX8bq/grGWTjs85cxpEpHV3OGXlFDk+7dpwWkTn6+Oe4izBIxt73s6AP3DGPOJwhNaeG3oH5dnv8ykGCicc7HCHM+yWF07f19y2nDHfUyHWamrzvc3cq5ywq/PR72Cb0HiCM5Z3xccbN3eycHq96vV0/3t+3zmBOcMq7NktPfbk8j7NpKa1Y3ve3vooJ42l6c0jBGiPbiaMmsuUg/Dr1l37FwDrppCUZ7SKkcN7ujhj49NKzhNplu0C/dtO/evvUyO2Pae7Zzo9nFCleNHN/rIuQGaz6LKj/C6GS1+7WfEqc16VdCny4l8tMY20cjSIxQhRpi+exbSEfzv1TlAqE54PFuU5K3TwAg3lFE0jxhxX1Bpx3oDl5KGjHWItoBrXl+/dnNZxg6bMjpM4ABKnAS5amdNgHASDojffu+3JbRpxrpFTJ05vPX2iob0vnM6DtzRYwdOnr9D3cqZzWhmurWQnFWL/6x3hmfQCYETmNMpy/0EDh70nZ5co3Lhj4+45hWnqgpkOpJE8is1S4VQmx6d/p99F/jcTMeZ5zGuxpT/WC9s6zne5rX9rvpeDoNTRWj6F3l3I07t1Q0NDQ0NDQ0NDQ0P/rX4AMSkjyV00ZcYAAAAASUVORK5CYII=",
};
const normalizeAgency = (name) => (name || "").trim().toLowerCase();

const SEASON_YEAR = 2026;
const UPGRADE_POINTS = 25;
const WIN_POINTS = { 1: 5, 2: 10, 3: 30 };
const LOSS_POINTS = { 1: -5, 2: -10, 3: -35 };
const STORAGE_KEY = "qld-strata-rankings-data";

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const todayStr = () => new Date().toISOString().slice(0, 10);
const yearOf = (dateStr) => new Date(dateStr).getFullYear();

const emptyData = { managers: [], schemes: [], events: [] };

export default function App() {
  const [data, setData] = useState(emptyData);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("rankings");

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get(STORAGE_KEY, true);
        if (res && res.value) setData(JSON.parse(res.value));
      } catch (e) {
        // no existing data yet
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const persist = async (next) => {
    setData(next);
    try {
      await window.storage.set(STORAGE_KEY, JSON.stringify(next), true);
    } catch (e) {
      console.error("Storage error", e);
    }
  };

  const managerById = (id) => data.managers.find((m) => m.id === id);
  const schemeById = (id) => data.schemes.find((s) => s.id === id);

  const standings = useMemo(() => {
    const totals = {};
    for (const m of data.managers) {
      totals[m.id] = { manager: m, points: 0, events: 0, wins: 0, upgrades: 0, losses: 0 };
    }
    for (const ev of data.events) {
      if (yearOf(ev.date) !== SEASON_YEAR) continue;
      if (!totals[ev.managerId]) continue;
      totals[ev.managerId].points += ev.points;
      totals[ev.managerId].events += 1;
      if (ev.type === "win") totals[ev.managerId].wins += 1;
      if (ev.type === "upgrade") totals[ev.managerId].upgrades += 1;
      if (ev.type === "loss") totals[ev.managerId].losses += 1;
    }
    return Object.values(totals).sort((a, b) => b.points - a.points);
  }, [data]);

  const sortedEvents = useMemo(
    () => [...data.events].filter((e) => yearOf(e.date) === SEASON_YEAR).sort((a, b) => new Date(b.date) - new Date(a.date)),
    [data]
  );

  return (
    <div className="min-h-screen bg-stone-50 text-slate-900">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <header className="border-b-2 border-slate-900 pb-5 mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-4xl sm:text-5xl leading-tight">QLD Strata Rankings</h1>
            <p className="text-slate-600 mt-2 max-w-md">
              {SEASON_YEAR} season — self-reported wins only. Everyone starts at 0.
            </p>
          </div>
          <nav className="flex gap-1 bg-slate-900 rounded-full p-1">
            {[
              { id: "rankings", label: "Rankings", icon: Trophy },
              { id: "log", label: "Recent wins", icon: ScrollText },
              { id: "report", label: "Report a win", icon: ArrowUpCircle },
              { id: "admin", label: "Admin", icon: Settings },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  tab === id ? "bg-amber-500 text-slate-900" : "text-stone-200 hover:text-white"
                }`}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
          </nav>
        </header>

        {loading ? (
          <p className="text-slate-500">Loading rankings…</p>
        ) : tab === "rankings" ? (
          <Rankings standings={standings} />
        ) : tab === "log" ? (
          <EventLog events={sortedEvents} managerById={managerById} schemeById={schemeById} />
        ) : tab === "admin" ? (
          <AdminPanel data={data} persist={persist} />
        ) : (
          <ReportWin data={data} persist={persist} />
        )}
      </div>
    </div>
  );
}

function AgencyBadge({ agency }) {
  if (!agency) return null;
  const logo = AGENCY_LOGOS[normalizeAgency(agency)];
  if (logo) {
    return <img src={logo} alt={agency} className="h-6 w-auto object-contain shrink-0" />;
  }
  const initials = agency.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className="h-6 min-w-6 px-1.5 rounded bg-slate-200 text-slate-600 text-[10px] font-medium flex items-center justify-center shrink-0">
      {initials}
    </div>
  );
}

function Rankings({ standings }) {
  if (standings.length === 0) {
    return (
      <div className="border border-dashed border-slate-300 rounded-lg py-16 text-center">
        <p className="text-slate-500">No wins reported yet for {SEASON_YEAR}.</p>
        <p className="text-slate-400 text-sm mt-1">Be the first — head to "Report a win".</p>
      </div>
    );
  }
  return (
    <div>
      {standings.map((row, i) => {
        const rank = i + 1;
        return (
          <div
            key={row.manager.id}
            className={`flex items-center gap-4 py-4 border-b border-slate-200 ${rank === 1 ? "bg-amber-50 -mx-4 px-4 rounded-lg border-b-0" : ""}`}
          >
            <div className="w-10 text-center font-serif text-2xl text-slate-400 shrink-0">
              {rank === 1 ? <Crown size={26} className="text-amber-500 mx-auto" /> : rank}
            </div>
            <div className="flex-1 min-w-0 flex items-center gap-2.5">
              <AgencyBadge agency={row.manager.agency} />
              <div className="min-w-0">
                <p className="font-medium truncate">{row.manager.name}</p>
                {row.manager.agency && <p className="text-sm text-slate-500 truncate">{row.manager.agency}</p>}
              </div>
            </div>
            <div className="text-sm text-slate-500 hidden sm:flex gap-3 shrink-0">
              <span className="text-teal-700">{row.wins} wins</span>
              <span className="text-amber-600">{row.upgrades} upgrades</span>
              {row.losses > 0 && <span className="text-rose-600">{row.losses} lost</span>}
            </div>
            <div className="font-serif text-2xl w-20 text-right shrink-0">{row.points}</div>
          </div>
        );
      })}
    </div>
  );
}

function EventLog({ events, managerById, schemeById }) {
  if (events.length === 0) {
    return (
      <div className="border border-dashed border-slate-300 rounded-lg py-16 text-center">
        <p className="text-slate-500">No wins reported yet.</p>
      </div>
    );
  }
  const typeStyle = {
    upgrade: { label: "3yr upgrade", cls: "bg-amber-100 text-amber-800" },
    win: { label: "Won building", cls: "bg-teal-100 text-teal-800" },
    loss: { label: "Lost building", cls: "bg-rose-100 text-rose-700" },
  };
  return (
    <div className="space-y-0">
      {events.map((ev) => {
        const manager = managerById(ev.managerId);
        const scheme = schemeById(ev.schemeId);
        const t = typeStyle[ev.type] || typeStyle.win;
        return (
          <div key={ev.id} className="flex items-start gap-4 py-4 border-b border-slate-200">
            <AgencyBadge agency={manager?.agency} />
            <div className="flex-1 min-w-0">
              <p className="font-medium">{scheme?.name || "Unknown scheme"} {scheme?.cts && <span className="text-slate-400 font-normal">· CTS {scheme.cts}</span>}</p>
              <p className="text-sm text-slate-500">
                {manager?.name || "Unknown manager"}
                {ev.prevTerm ? ` · ${ev.prevTerm}yr → ${ev.newTerm}yr` : ` · ${ev.newTerm}yr`}
                {" · "}{ev.date}
              </p>
              {ev.source && <p className="text-xs text-slate-400 mt-1 truncate">Source: {ev.source}</p>}
              {ev.sponsorTip && (
                <div className="flex items-center gap-2 mt-2 px-2.5 py-1.5 rounded-md text-xs" style={{ background: SPONSOR_NAVY, color: "#e8eef4" }}>
                  <Droplet size={13} style={{ color: SPONSOR_BLUE, flexShrink: 0 }} />
                  <span>
                    Sponsored tip · {ev.sponsorName || SPONSOR_NAME} — {ev.sponsorTip}
                    <span className="opacity-60"> (labeled sponsored)</span>
                  </span>
                </div>
              )}
            </div>
            <span className={`text-xs font-medium px-2 py-1 rounded-full shrink-0 ${t.cls}`}>{t.label}</span>
            <div className={`font-serif text-lg w-14 text-right shrink-0 ${ev.points > 0 ? "text-teal-700" : ev.points < 0 ? "text-rose-600" : "text-slate-400"}`}>
              {ev.points > 0 ? `+${ev.points}` : ev.points}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ReportWin({ data, persist }) {
  const [mode, setMode] = useState("win"); // win | upgrade
  const [schemeName, setSchemeName] = useState("");
  const [cts, setCts] = useState("");
  const [managerName, setManagerName] = useState("");
  const [agency, setAgency] = useState("");
  const [prevTerm, setPrevTerm] = useState(1);
  const [oldTerm, setOldTerm] = useState(null);
  const [newTerm, setNewTerm] = useState(3);
  const [prevManagerName, setPrevManagerName] = useState("");
  const [prevAgency, setPrevAgency] = useState("");
  const [date, setDate] = useState(todayStr());
  const [source, setSource] = useState("");
  const [addSponsorTip, setAddSponsorTip] = useState(false);
  const [sponsorTip, setSponsorTip] = useState("");
  const [confirmation, setConfirmation] = useState(null);

  const findScheme = (name) => data.schemes.find((s) => s.name.toLowerCase() === name.toLowerCase().trim());
  const findManager = (name) => data.managers.find((m) => m.name.toLowerCase() === name.toLowerCase().trim());

  const points = mode === "upgrade" ? UPGRADE_POINTS : WIN_POINTS[newTerm];

  const reset = () => {
    setSchemeName(""); setCts(""); setManagerName(""); setAgency("");
    setPrevManagerName(""); setPrevAgency(""); setSource(""); setOldTerm(null);
    setAddSponsorTip(false); setSponsorTip("");
  };

  const submit = async () => {
    if (!schemeName.trim() || !managerName.trim()) return;
    let workingData = data;

    let manager = findManager(managerName);
    if (!manager) {
      manager = { id: uid(), name: managerName.trim(), agency: agency.trim() };
      workingData = { ...workingData, managers: [...workingData.managers, manager] };
    } else if (agency.trim() && !manager.agency) {
      manager = { ...manager, agency: agency.trim() };
      workingData = { ...workingData, managers: workingData.managers.map((m) => m.id === manager.id ? manager : m) };
    }

    let scheme = findScheme(schemeName);
    if (!scheme) {
      scheme = { id: uid(), name: schemeName.trim(), cts: cts.trim(), currentManagerId: null, currentTerm: null };
      workingData = { ...workingData, schemes: [...workingData.schemes, scheme] };
    }

    const tipFields = { sponsorTip: addSponsorTip ? sponsorTip.trim() : "", sponsorName: addSponsorTip ? SPONSOR_NAME : "" };
    const events = [...workingData.events];

    if (mode === "upgrade") {
      events.push({
        id: uid(), type: "upgrade", schemeId: scheme.id, managerId: manager.id,
        newTerm: 3, prevTerm, points: UPGRADE_POINTS, date, source, ...tipFields,
      });
      const updatedSchemes = workingData.schemes.map((s) => s.id === scheme.id ? { ...s, currentManagerId: manager.id, currentTerm: 3 } : s);
      workingData = { ...workingData, schemes: updatedSchemes };
      setConfirmation({ points: UPGRADE_POINTS, label: `Upgrade logged for ${manager.name}` });
    } else {
      const winPoints = WIN_POINTS[newTerm];
      const winEvent = { id: uid(), type: "win", schemeId: scheme.id, managerId: manager.id, newTerm, prevTerm: oldTerm, points: winPoints, date, source, ...tipFields };
      events.push(winEvent);

      // attribute the loss: prefer the system's own record of who held the scheme, else the typed name
      let prevManager = scheme.currentManagerId ? workingData.managers.find((m) => m.id === scheme.currentManagerId) : null;
      if (!prevManager && prevManagerName.trim()) {
        prevManager = findManager(prevManagerName);
        if (!prevManager) {
          prevManager = { id: uid(), name: prevManagerName.trim(), agency: prevAgency.trim() };
          workingData = { ...workingData, managers: [...workingData.managers, prevManager] };
        }
      }
      if (prevManager && prevManager.id !== manager.id) {
        events.push({
          id: uid(), type: "loss", schemeId: scheme.id, managerId: prevManager.id,
          newTerm, prevTerm: scheme.currentTerm || oldTerm, points: LOSS_POINTS[newTerm], date, source,
          linkedEventId: winEvent.id,
        });
      }
      const updatedSchemes = workingData.schemes.map((s) => s.id === scheme.id ? { ...s, currentManagerId: manager.id, currentTerm: newTerm } : s);
      workingData = { ...workingData, schemes: updatedSchemes };
      setConfirmation({ points: winPoints, label: `Win logged for ${manager.name}` });
    }

    await persist({ ...workingData, events });
    reset();
  };

  return (
    <div className="max-w-lg">
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => { setMode("win"); setConfirmation(null); }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium border ${mode === "win" ? "bg-slate-900 text-white border-slate-900" : "border-slate-300 text-slate-600"}`}
        >
          <Swords size={15} /> Won from a competitor
        </button>
        <button
          onClick={() => { setMode("upgrade"); setConfirmation(null); }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium border ${mode === "upgrade" ? "bg-slate-900 text-white border-slate-900" : "border-slate-300 text-slate-600"}`}
        >
          <ArrowUpCircle size={15} /> Upgraded to 3yr
        </button>
      </div>
      <p className="text-sm text-slate-500 mb-5">
        {mode === "win"
          ? "You signed a building that was previously with another manager."
          : "Your own client re-signed for 3 years, up from a 1 or 2 year term."}
      </p>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Building name">
            <input value={schemeName} onChange={(e) => setSchemeName(e.target.value)} placeholder="e.g. 88 Boundary St" className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
          </Field>
          <Field label="CTS number">
            <input value={cts} onChange={(e) => setCts(e.target.value)} placeholder="e.g. 50083" className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Your name">
            <input value={managerName} onChange={(e) => setManagerName(e.target.value)} placeholder="e.g. Rod Harding" className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
          </Field>
          <Field label="Your agency">
            <input value={agency} onChange={(e) => setAgency(e.target.value)} placeholder="e.g. SSKB" className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
          </Field>
        </div>

        {mode === "win" ? (
          <>
            <Field label="New term">
              <TermSelect value={newTerm} onChange={setNewTerm} />
            </Field>
            <Field label="Old term (what they had it on before you)">
              <div className="flex gap-2">
                {[1, 2, 3].map((t) => (
                  <button key={t} type="button" onClick={() => setOldTerm(t)}
                    className={`flex-1 py-2 rounded-md text-sm font-medium border ${oldTerm === t ? "bg-slate-900 text-white border-slate-900" : "border-slate-300 text-slate-600"}`}>
                    {t}yr
                  </button>
                ))}
                <button type="button" onClick={() => setOldTerm(null)}
                  className={`flex-1 py-2 rounded-md text-sm font-medium border ${oldTerm === null ? "bg-slate-900 text-white border-slate-900" : "border-slate-300 text-slate-600"}`}>
                  Unknown
                </button>
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Previous manager (optional)">
                <input value={prevManagerName} onChange={(e) => setPrevManagerName(e.target.value)} placeholder="Who had it before you" className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
              </Field>
              <Field label="Their agency (optional)">
                <input value={prevAgency} onChange={(e) => setPrevAgency(e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
              </Field>
            </div>
          </>
        ) : (
          <Field label="Previous term (before this upgrade)">
            <div className="flex gap-2">
              {[1, 2].map((t) => (
                <button key={t} type="button" onClick={() => setPrevTerm(t)}
                  className={`flex-1 py-2 rounded-md text-sm font-medium border ${prevTerm === t ? "bg-slate-900 text-white border-slate-900" : "border-slate-300 text-slate-600"}`}>
                  {t}yr
                </button>
              ))}
            </div>
          </Field>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
          </Field>
          <Field label="Source (optional)">
            <input value={source} onChange={(e) => setSource(e.target.value)} placeholder="Link or note" className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
          </Field>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={addSponsorTip} onChange={(e) => setAddSponsorTip(e.target.checked)} />
          Attach a sponsored tip from {SPONSOR_NAME}
        </label>
        {addSponsorTip && (
          <div className="flex items-center gap-2 pl-6">
            <Droplet size={14} style={{ color: SPONSOR_BLUE, flexShrink: 0 }} />
            <input value={sponsorTip} onChange={(e) => setSponsorTip(e.target.value)} placeholder="e.g. burst pipe response in high-rise schemes" className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-6 border-t border-slate-200 pt-4">
        <p className="text-sm text-slate-500">
          Points: <span className="font-serif text-lg text-slate-900">+{points}</span>
          {mode === "win" && (prevManagerName.trim() || "") && (
            <span className="text-rose-600 ml-2 text-xs">({prevManagerName.trim()} loses {Math.abs(LOSS_POINTS[newTerm])})</span>
          )}
        </p>
        <button
          onClick={submit}
          disabled={!schemeName.trim() || !managerName.trim()}
          className="bg-amber-500 text-slate-900 font-medium px-5 py-2.5 rounded-lg text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-amber-400"
        >
          Report win
        </button>
      </div>

      {confirmation && (
        <div className="mt-4 bg-teal-50 border border-teal-200 rounded-lg px-4 py-3 text-sm text-teal-800">
          {confirmation.label} · +{confirmation.points} points
        </div>
      )}
    </div>
  );
}

function AdminPanel({ data, persist }) {
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({});

  const managerById = (id) => data.managers.find((m) => m.id === id);
  const schemeById = (id) => data.schemes.find((s) => s.id === id);

  const computePoints = (type, newTerm) => {
    if (type === "upgrade") return UPGRADE_POINTS;
    if (type === "win") return WIN_POINTS[newTerm] || 0;
    if (type === "loss") return LOSS_POINTS[newTerm] || 0;
    return 0;
  };

  const startEdit = (ev) => {
    const manager = managerById(ev.managerId);
    const scheme = schemeById(ev.schemeId);
    setEditingId(ev.id);
    setDraft({
      schemeName: scheme?.name || "",
      cts: scheme?.cts || "",
      managerName: manager?.name || "",
      agency: manager?.agency || "",
      type: ev.type,
      newTerm: ev.newTerm,
      prevTerm: ev.prevTerm,
      date: ev.date,
      source: ev.source || "",
    });
  };

  const cancelEdit = () => { setEditingId(null); setDraft({}); };

  const saveEdit = async (ev) => {
    let workingData = data;

    let manager = workingData.managers.find((m) => m.name.toLowerCase() === draft.managerName.toLowerCase().trim());
    if (!manager) {
      manager = { id: uid(), name: draft.managerName.trim(), agency: draft.agency.trim() };
      workingData = { ...workingData, managers: [...workingData.managers, manager] };
    } else if (draft.agency.trim() && manager.agency !== draft.agency.trim()) {
      manager = { ...manager, agency: draft.agency.trim() };
      workingData = { ...workingData, managers: workingData.managers.map((m) => (m.id === manager.id ? manager : m)) };
    }

    let scheme = workingData.schemes.find((s) => s.name.toLowerCase() === draft.schemeName.toLowerCase().trim());
    if (!scheme) {
      scheme = { id: uid(), name: draft.schemeName.trim(), cts: draft.cts.trim(), currentManagerId: null, currentTerm: null };
      workingData = { ...workingData, schemes: [...workingData.schemes, scheme] };
    } else if (draft.cts.trim() && scheme.cts !== draft.cts.trim()) {
      scheme = { ...scheme, cts: draft.cts.trim() };
      workingData = { ...workingData, schemes: workingData.schemes.map((s) => (s.id === scheme.id ? scheme : s)) };
    }

    const points = computePoints(draft.type, draft.newTerm);
    const updatedEvent = {
      ...ev,
      schemeId: scheme.id,
      managerId: manager.id,
      type: draft.type,
      newTerm: draft.newTerm,
      prevTerm: draft.prevTerm || null,
      points,
      date: draft.date,
      source: draft.source,
    };
    const events = workingData.events.map((e) => (e.id === ev.id ? updatedEvent : e));
    await persist({ ...workingData, events });
    cancelEdit();
  };

  const deleteEvent = async (ev) => {
    let events = data.events.filter((e) => e.id !== ev.id);
    if (ev.type === "win") {
      events = events.filter((e) => e.linkedEventId !== ev.id);
    }
    await persist({ ...data, events });
  };

  const sorted = [...data.events].sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <div>
      <p className="text-sm text-slate-500 mb-4">
        Edit or remove any reported event. Points recalculate automatically from the formula when you save — deleting a win also removes its linked loss, so the two stay in sync.
      </p>
      {sorted.length === 0 && <p className="text-slate-400 text-sm">No events yet.</p>}
      {sorted.map((ev) => {
        const manager = managerById(ev.managerId);
        const scheme = schemeById(ev.schemeId);
        const isEditing = editingId === ev.id;
        return (
          <div key={ev.id} className="py-3 border-b border-slate-200">
            {!isEditing ? (
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{scheme?.name || "—"} · {manager?.name || "—"}</p>
                  <p className="text-xs text-slate-500">
                    {ev.type} · {ev.prevTerm ? `${ev.prevTerm}yr → ` : ""}{ev.newTerm}yr · {ev.date} · {ev.points > 0 ? `+${ev.points}` : ev.points} pts
                  </p>
                </div>
                <button onClick={() => startEdit(ev)} className="text-xs text-teal-700 hover:underline shrink-0">Edit</button>
                <button onClick={() => deleteEvent(ev)} className="text-xs text-rose-600 hover:underline shrink-0">Delete</button>
              </div>
            ) : (
              <div className="space-y-2 bg-slate-50 p-3 rounded-lg">
                <div className="grid grid-cols-2 gap-2">
                  <input value={draft.schemeName} onChange={(e) => setDraft((d) => ({ ...d, schemeName: e.target.value }))} placeholder="Scheme" className="border border-slate-300 rounded px-2 py-1 text-sm" />
                  <input value={draft.cts} onChange={(e) => setDraft((d) => ({ ...d, cts: e.target.value }))} placeholder="CTS" className="border border-slate-300 rounded px-2 py-1 text-sm" />
                  <input value={draft.managerName} onChange={(e) => setDraft((d) => ({ ...d, managerName: e.target.value }))} placeholder="Manager" className="border border-slate-300 rounded px-2 py-1 text-sm" />
                  <input value={draft.agency} onChange={(e) => setDraft((d) => ({ ...d, agency: e.target.value }))} placeholder="Agency" className="border border-slate-300 rounded px-2 py-1 text-sm" />
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  <select value={draft.type} onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value }))} className="border border-slate-300 rounded px-2 py-1 text-sm">
                    <option value="win">Win</option>
                    <option value="upgrade">Upgrade</option>
                    <option value="loss">Loss</option>
                  </select>
                  <select value={draft.newTerm} onChange={(e) => setDraft((d) => ({ ...d, newTerm: parseInt(e.target.value, 10) }))} className="border border-slate-300 rounded px-2 py-1 text-sm">
                    {[1, 2, 3].map((t) => <option key={t} value={t}>{t}yr new</option>)}
                  </select>
                  <select value={draft.prevTerm ?? ""} onChange={(e) => setDraft((d) => ({ ...d, prevTerm: e.target.value ? parseInt(e.target.value, 10) : null }))} className="border border-slate-300 rounded px-2 py-1 text-sm">
                    <option value="">no old term</option>
                    {[1, 2, 3].map((t) => <option key={t} value={t}>{t}yr old</option>)}
                  </select>
                  <input type="date" value={draft.date} onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))} className="border border-slate-300 rounded px-2 py-1 text-sm" />
                </div>
                <input value={draft.source} onChange={(e) => setDraft((d) => ({ ...d, source: e.target.value }))} placeholder="Source (optional)" className="w-full border border-slate-300 rounded px-2 py-1 text-sm" />
                <p className="text-xs text-slate-500">Recalculated points: <span className="font-medium text-slate-700">{computePoints(draft.type, draft.newTerm)}</span></p>
                <div className="flex gap-2">
                  <button onClick={() => saveEdit(ev)} className="bg-amber-500 text-slate-900 text-xs font-medium px-3 py-1.5 rounded">Save</button>
                  <button onClick={cancelEdit} className="text-xs text-slate-500 px-3 py-1.5">Cancel</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-sm text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

function TermSelect({ value, onChange }) {
  return (
    <div className="flex gap-2">
      {[1, 2, 3].map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => onChange(t)}
          className={`flex-1 py-2 rounded-md text-sm font-medium border ${value === t ? "bg-slate-900 text-white border-slate-900" : "border-slate-300 text-slate-600"}`}
        >
          {t}yr
        </button>
      ))}
    </div>
  );
}
