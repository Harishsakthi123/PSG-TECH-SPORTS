import { useCallback, useEffect, useState } from 'react';
import { api, download, getToken, setToken, Game } from '../api';

const STATUSES = ['pending', 'confirmed', 'rejected', 'cancelled'];

function Login({ onOk }: { onOk: () => void }) {
  const [email, setEmail] = useState(''); const [password, setPw] = useState(''); const [showPassword, setShowPassword] = useState(false); const [err, setErr] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr('');
    try { const r = await api('/admin/login', { method: 'POST', body: { email, password } }); setToken(r.token); onOk(); }
    catch (x: any) { setErr(x.message); }
  };
  return (<form onSubmit={submit} className="mx-auto max-w-sm p-8 space-y-4">
    <h1 className="h-display text-4xl">Organizer sign in</h1>
    <input className="input" type="email" placeholder="Email" aria-label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
    <div className="relative">
      <input className="input pr-12" type={showPassword ? 'text' : 'password'} placeholder="Password" aria-label="Password" value={password} onChange={(e) => setPw(e.target.value)} />
      <button type="button" className="absolute inset-y-0 right-0 flex items-center px-3 text-white" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword((visible) => !visible)}>
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
          {showPassword
            ? <><path d="M3 3l18 18" /><path d="M10.6 10.6a2 2 0 002.8 2.8" /><path d="M9.9 5.2A10.7 10.7 0 0112 5c5 0 9 5 9 7a9.5 9.5 0 01-2.1 3.2" /><path d="M6.2 6.2C3.9 7.7 3 10.1 3 12c0 2 4 7 9 7a10.7 10.7 0 004.1-.8" /></>
            : <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>}
        </svg>
      </button>
    </div>
    {err && <p role="alert" className="text-red">{err}</p>}
    <button className="btn">Sign in</button></form>);
}

function Registrations({ games }: { games: Game[] }) {
  const [data, setData] = useState<any>(null); const [page, setPage] = useState(1);
  const [search, setSearch] = useState(''); const [game, setGame] = useState(''); const [status, setStatus] = useState(''); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false);
  const qs = new URLSearchParams({ ...(search && { search }), ...(game && { game }), ...(status && { status }) });
  const load = useCallback(() => api(`/admin/registrations?${qs}&page=${page}`, { auth: true }).then(setData).catch((e) => setMsg(e.message)), [qs.toString(), page]);
  useEffect(() => { load(); }, [load]);
  const setSt = async (id: string, nextStatus: string) => {
    setMsg('');
    try { await api(`/admin/registrations/${id}/status`, { method: 'PATCH', auth: true, body: { status: nextStatus } }); await load(); setMsg('Registration status updated.'); }
    catch (error) { setMsg(error instanceof Error ? error.message : 'Could not update registration status.'); }
  };
  const exportRows = async (format: 'csv' | 'xlsx') => {
    setBusy(true); setMsg('');
    try { await download(`/admin/export?format=${format}&${qs}`, `registrations.${format}`); }
    catch (error) { setMsg(error instanceof Error ? error.message : 'Export failed.'); }
    finally { setBusy(false); }
  };
  return (<div>
    <div className="surface mb-4 grid gap-3 p-4 sm:grid-cols-5">
      <input className="input sm:col-span-2" placeholder="Search name, roll no, team, ref" aria-label="Search" value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} />
      <select className="input" aria-label="Game" value={game} onChange={(e) => { setPage(1); setGame(e.target.value); }}><option value="">All games</option>{games.map((g) => <option key={g._id} value={g._id}>{g.name}</option>)}</select>
      <select className="input" aria-label="Status" value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }}><option value="">All statuses</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
      <div className="flex gap-2"><button className="btn" disabled={busy} onClick={() => exportRows('csv')}>CSV</button>
        <button className="btn btn-ghost" disabled={busy} onClick={() => exportRows('xlsx')}>Excel</button></div></div>
    {msg && <p role="alert" className="text-red">{msg}</p>}
    {!data ? <div className="h-32 bg-neutral-900 animate-pulse" /> : data.items.length === 0 ? <p>No registrations match.</p> : (
      <div className="surface overflow-x-auto"><table className="w-full text-left text-sm">
        <thead className="border-b border-white/10 bg-white/5"><tr>{['Ref', 'Game', 'Name / Team', 'Roll no', 'Phone', 'Status'].map((h) => <th key={h} className="p-3">{h}</th>)}</tr></thead>
        <tbody>{data.items.map((r: any) => (<tr key={r._id} className="border-b border-neutral-800">
          <td className="p-2">{r.ref}</td><td className="p-2">{r.game?.name}</td>
          <td className="p-2">{r.teamName ? `${r.teamName} (${1 + r.members.length})` : r.leader.name}</td>
          <td className="p-2">{r.leader.rollNo}</td><td className="p-2">{r.leader.phone}</td>
          <td className="min-w-36 p-2"><select className="input" aria-label={`Status for ${r.ref}`} value={r.status} onChange={(e) => setSt(r._id, e.target.value)}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></td></tr>))}</tbody></table></div>)}
    <div className="flex gap-3 mt-4 items-center"><button className="btn btn-ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</button>
      <span>Page {page} of {data?.pages || 1}</span><button className="btn btn-ghost" disabled={page >= (data?.pages || 1)} onClick={() => setPage(page + 1)}>Next</button></div></div>);
}

const emptyGame = { name: '', category: '', type: 'individual', teamSize: { min: 1, max: 1 }, format: '', imageUrl: '', rules: [] as { title: string; body: string }[], registrationOpen: true, deadline: '', capacity: '' };
type RulesAssistantMessage = { role: 'user' | 'assistant'; content: string; rules?: Game['rules'] };

function GamesAdmin({ games, reload }: { games: Game[]; reload: () => void }) {
  const [g, setG] = useState<any>(emptyGame); const [id, setId] = useState(''); const [msg, setMsg] = useState('');
  const [assistantPrompt, setAssistantPrompt] = useState(''); const [assistantBusy, setAssistantBusy] = useState(false);
  const [assistantError, setAssistantError] = useState(''); const [assistantChat, setAssistantChat] = useState<RulesAssistantMessage[]>([]);
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg('');
    if (g.type === 'team' && g.teamSize.min > g.teamSize.max) return setMsg('Minimum team size cannot be larger than maximum team size.');
    const body = { ...g, deadline: g.deadline || null, capacity: g.capacity ? Number(g.capacity) : null };
    try { await api(id ? `/admin/games/${id}` : '/admin/games', { method: id ? 'PUT' : 'POST', auth: true, body }); setG(emptyGame); setId(''); setAssistantChat([]); reload(); setMsg('Saved'); }
    catch (x: any) { setMsg(x.message); }
  };
  const edit = (x: Game) => { setId(x._id); setG({ ...x, deadline: x.deadline ? x.deadline.slice(0, 10) : '', capacity: x.capacity || '' }); setAssistantChat([]); setAssistantError(''); };
  const del = async (x: Game) => { if (!confirm(`Delete ${x.name}?`)) return; try { await api(`/admin/games/${x._id}`, { method: 'DELETE', auth: true }); reload(); } catch (e: any) { setMsg(e.message); } };
  const upd = (k: string, v: any) => setG({ ...g, [k]: v });
  const askAssistant = async (event: React.FormEvent) => {
    event.preventDefault();
    if (g.name.trim().length < 2) { setAssistantError('Add a game name before asking for a rule draft.'); return; }
    const prompt = assistantPrompt.trim();
    if (prompt.length < 3) { setAssistantError('Describe the rules or changes you want help drafting.'); return; }
    setAssistantBusy(true); setAssistantError('');
    const nextChat = [...assistantChat, { role: 'user' as const, content: prompt }];
    setAssistantChat(nextChat);
    setAssistantPrompt('');
    try {
      const response = await api<{ reply: string; rules: Game['rules'] }>('/admin/ai/rules', {
        method: 'POST', auth: true,
        body: {
          game: { name: g.name, category: g.category, type: g.type, teamSize: g.teamSize, format: g.format, rules: g.rules },
          prompt,
          history: assistantChat.slice(-8).map(({ role, content }) => ({ role, content })),
        },
      });
      setAssistantChat([...nextChat, { role: 'assistant', content: response.reply, rules: response.rules }]);
    } catch (error) {
      setAssistantChat(assistantChat);
      setAssistantPrompt(prompt);
      setAssistantError(error instanceof Error ? error.message : 'The rules assistant could not respond.');
    } finally { setAssistantBusy(false); }
  };
  const addDraftRules = (draft: Game['rules']) => {
    upd('rules', [...g.rules, ...draft]);
    setMsg('Draft rules added to the form. Review and save them when ready.');
  };
  return (<div className="grid md:grid-cols-2 gap-6">
    <form onSubmit={save} className="space-y-3">
      <h2 className="h-display text-2xl">{id ? 'Edit game' : 'Add game'}</h2>
      <input className="input" placeholder="Game name" aria-label="Game name" value={g.name} onChange={(e) => upd('name', e.target.value)} required />
      <input className="input" placeholder="Category" aria-label="Category" value={g.category} onChange={(e) => upd('category', e.target.value)} />
      <select className="input" aria-label="Type" value={g.type} onChange={(e) => upd('type', e.target.value)}><option value="individual">Individual</option><option value="team">Team</option></select>
      {g.type === 'team' && <div className="flex gap-2"><input className="input" type="number" min={1} aria-label="Min team size" value={g.teamSize.min} onChange={(e) => upd('teamSize', { ...g.teamSize, min: +e.target.value })} />
        <input className="input" type="number" min={1} aria-label="Max team size" value={g.teamSize.max} onChange={(e) => upd('teamSize', { ...g.teamSize, max: +e.target.value })} /></div>}
      <textarea className="input" placeholder="Competition format" aria-label="Format" value={g.format} onChange={(e) => upd('format', e.target.value)} />
      <input className="input" placeholder="Image URL" aria-label="Image URL" value={g.imageUrl} onChange={(e) => upd('imageUrl', e.target.value)} />
      <div className="flex gap-2"><input className="input" type="date" aria-label="Deadline" value={g.deadline} onChange={(e) => upd('deadline', e.target.value)} />
        <input className="input" type="number" placeholder="Capacity" aria-label="Capacity" value={g.capacity} onChange={(e) => upd('capacity', e.target.value)} /></div>
      <label className="flex gap-2"><input type="checkbox" checked={g.registrationOpen} onChange={(e) => upd('registrationOpen', e.target.checked)} /> Registration open</label>
      <h3 className="font-semibold">Rules sections</h3>
      {g.rules.map((r: any, i: number) => (<div key={i} className="space-y-1">
        <input className="input" placeholder="Section title (e.g. Scoring)" aria-label="Rule title" value={r.title} onChange={(e) => upd('rules', g.rules.map((x: any, j: number) => (j === i ? { ...x, title: e.target.value } : x)))} />
        <textarea className="input" aria-label="Rule text" value={r.body} onChange={(e) => upd('rules', g.rules.map((x: any, j: number) => (j === i ? { ...x, body: e.target.value } : x)))} />
        <button type="button" className="text-red" onClick={() => upd('rules', g.rules.filter((_: any, j: number) => j !== i))}>Remove section</button></div>))}
      <button type="button" className="btn btn-ghost" onClick={() => upd('rules', [...g.rules, { title: '', body: '' }])}>Add rules section</button>
      <section className="surface space-y-3 p-4" aria-labelledby="rules-assistant-title">
        <div><p className="eyebrow">Organizer tool</p><h3 id="rules-assistant-title" className="h-display mt-1 text-2xl">AI rules assistant</h3>
          <p className="mt-2 text-sm text-neutral-400">Ask for a draft or revisions. Review every suggestion before saving; AI output is not official guidance.</p></div>
        {assistantChat.length > 0 && <ol className="max-h-72 space-y-3 overflow-y-auto rounded-lg bg-black/20 p-3" aria-live="polite">
          {assistantChat.map((item, index) => <li key={`${index}-${item.role}`} className={item.role === 'user' ? 'ml-6 rounded-lg bg-white/5 p-3' : 'mr-6 rounded-lg border border-white/10 p-3'}>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-rose-300">{item.role === 'user' ? 'You' : 'Assistant · draft only'}</p>
            <p className="whitespace-pre-line text-sm">{item.content}</p>
            {item.role === 'assistant' && item.rules && item.rules.length > 0 && <button type="button" className="btn btn-ghost mt-3 !min-h-9 !px-3 !py-1 text-xs" onClick={() => addDraftRules(item.rules || [])}>Add {item.rules.length} draft section{item.rules.length === 1 ? '' : 's'} to form</button>}
          </li>)}
        </ol>}
        <form onSubmit={askAssistant} className="space-y-2">
          <label className="sr-only" htmlFor="rules-assistant-prompt">Instructions for the rules assistant</label>
          <textarea id="rules-assistant-prompt" className="input min-h-24" maxLength={1200} placeholder="What should the rules cover? For example: scoring, match length and tie-breaks." value={assistantPrompt} onChange={(event) => setAssistantPrompt(event.target.value)} />
          {assistantError && <p role="alert" className="text-sm text-red">{assistantError}</p>}
          <button type="submit" className="btn" disabled={assistantBusy}>{assistantBusy ? 'Drafting...' : 'Ask rules assistant'}</button>
        </form>
      </section>
      <div className="flex gap-2"><button className="btn">Save game</button>{id && <button type="button" className="btn btn-ghost" onClick={() => { setId(''); setG(emptyGame); }}>Cancel</button>}</div>
      {msg && <p role="status">{msg}</p>}
    </form>
    <ul className="space-y-2">{games.map((x) => (<li key={x._id} className="bg-neutral-900 p-3 flex justify-between items-center"><span>{x.name} <small className="text-neutral-400">({x.registered || 0})</small></span>
      <span className="flex gap-3"><button className="text-red" onClick={() => edit(x)}>Edit</button><button className="text-red" onClick={() => del(x)}>Delete</button></span></li>))}
      {games.length === 0 && <li>No games yet. Add the first one.</li>}</ul></div>);
}

function SettingsAdmin() {
  const [settings, setSettings] = useState<any>(null); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { api('/settings').then(setSettings).catch((error) => setMsg(error.message)); }, []);
  const update = (key: string, value: any) => setSettings((current: any) => ({ ...current, [key]: value }));
  const updateContact = (key: string, value: any) => setSettings((current: any) => ({ ...current, contacts: { ...current.contacts, [key]: value } }));
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setMsg('');
    try { setSettings(await api('/admin/settings', { method: 'PUT', auth: true, body: settings })); setMsg('Event details saved.'); }
    catch (error) { setMsg(error instanceof Error ? error.message : 'Could not save event details.'); }
    finally { setBusy(false); }
  };
  if (!settings) return <p role={msg ? 'alert' : undefined} className={msg ? 'text-red' : 'text-neutral-400'}>{msg || 'Loading event settings...'}</p>;
  const houses = settings.houses || []; const contacts = settings.contacts || {};
  return (<form onSubmit={save} className="surface space-y-8 p-5 md:p-7">
    <div><p className="eyebrow">Public event information</p><h2 className="h-display mt-2 text-3xl">Event settings</h2><p className="mt-2 text-sm text-neutral-400">These details appear on the participant portal. Only publish confirmed event information.</p></div>
    <section className="grid gap-4 sm:grid-cols-2" aria-label="Event details">
      <label className="block"><span className="mb-1 block text-sm">Event title</span><input className="input" required maxLength={120} value={settings.title || ''} onChange={(event) => update('title', event.target.value)} /></label>
      <label className="block"><span className="mb-1 block text-sm">Start date or announcement</span><input className="input" maxLength={80} value={settings.startDate || ''} onChange={(event) => update('startDate', event.target.value)} /></label>
      <label className="block"><span className="mb-1 block text-sm">College</span><input className="input" maxLength={160} value={settings.college || ''} onChange={(event) => update('college', event.target.value)} /></label>
      <label className="block"><span className="mb-1 block text-sm">Department</span><input className="input" maxLength={160} value={settings.department || ''} onChange={(event) => update('department', event.target.value)} /></label>
      <label className="block sm:col-span-2"><span className="mb-1 block text-sm">Event slogan (one line per phrase)</span><textarea className="input min-h-24" value={(settings.slogan || []).join('\n')} onChange={(event) => update('slogan', event.target.value.split('\n').map((line: string) => line.trim()).filter(Boolean))} /></label>
    </section>
    <section aria-label="Houses">
      <div className="mb-3 flex items-center justify-between gap-3"><h3 className="h-display text-2xl">Houses</h3><button type="button" className="btn btn-ghost" onClick={() => update('houses', [...houses, { name: '', years: '' }])}>Add house</button></div>
      <div className="space-y-3">{houses.map((house: any, index: number) => <div key={index} className="grid gap-2 rounded-lg border border-white/10 p-3 sm:grid-cols-[1fr_.7fr_auto]">
        <label><span className="sr-only">House name</span><input className="input" placeholder="House name" value={house.name || ''} onChange={(event) => update('houses', houses.map((item: any, i: number) => i === index ? { ...item, name: event.target.value } : item))} /></label>
        <label><span className="sr-only">Year groups</span><input className="input" placeholder="Year groups" value={house.years || ''} onChange={(event) => update('houses', houses.map((item: any, i: number) => i === index ? { ...item, years: event.target.value } : item))} /></label>
        <button type="button" className="btn btn-ghost" aria-label={`Remove ${house.name || 'house'}`} onClick={() => update('houses', houses.filter((_: any, i: number) => i !== index))}>Remove</button>
      </div>)}</div>
    </section>
    <section className="grid gap-4 sm:grid-cols-2" aria-label="Contact details">
      <label className="block"><span className="mb-1 block text-sm">Organizer email</span><input type="email" className="input" value={contacts.email || ''} onChange={(event) => updateContact('email', event.target.value)} /></label>
      <label className="block"><span className="mb-1 block text-sm">Instagram URL</span><input type="url" className="input" placeholder="https://" value={contacts.instagram || ''} onChange={(event) => updateContact('instagram', event.target.value)} /></label>
      <label className="block"><span className="mb-1 block text-sm">Phone numbers (one per line)</span><textarea className="input min-h-24" value={(contacts.phones || []).join('\n')} onChange={(event) => updateContact('phones', event.target.value.split('\n').map((line: string) => line.trim()).filter(Boolean))} /></label>
      <label className="block"><span className="mb-1 block text-sm">Other contact information</span><textarea className="input min-h-24" value={contacts.other || ''} onChange={(event) => updateContact('other', event.target.value)} /></label>
    </section>
    <section className="space-y-3">
      <h3 className="h-display text-2xl">Announcements</h3>
      <label className="block"><span className="mb-1 block text-sm">One announcement per line</span><textarea className="input min-h-28" value={(settings.announcements || []).join('\n')} onChange={(event) => update('announcements', event.target.value.split('\n').map((line: string) => line.trim()).filter(Boolean))} /></label>
    </section>
    {msg && <p role={msg.includes('saved') ? 'status' : 'alert'} className={msg.includes('saved') ? 'text-green-300' : 'text-red'}>{msg}</p>}
    <button className="btn" disabled={busy}>{busy ? 'Saving...' : 'Save event settings'}</button>
  </form>);
}

function RemindersAdmin({ games }: { games: Game[] }) {
  const [gameId, setGameId] = useState(''); const [configured, setConfigured] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [error, setError] = useState('');
  useEffect(() => { api<{ email: boolean }>('/admin/integrations', { auth: true }).then((result) => setConfigured(result.email)).catch((reason) => setError(reason.message)); }, []);
  const send = async () => {
    const gameName = games.find((game) => game._id === gameId)?.name;
    if (!confirm(`Send a registration reminder to all pending registrations${gameName ? ` for ${gameName}` : ''}?`)) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const result = await api<{ attempted: number; sent: number; failed: number }>('/admin/reminders', { method: 'POST', auth: true, body: gameId ? { gameId } : {} });
      setMessage(`Reminder run complete: ${result.sent} sent, ${result.failed} failed, ${result.attempted} attempted.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not send reminders.'); }
    finally { setBusy(false); }
  };
  return (<section className="surface max-w-3xl space-y-5 p-5 md:p-7">
    <div><p className="eyebrow">Participant communications</p><h2 className="h-display mt-2 text-3xl">Registration reminders</h2>
      <p className="mt-2 text-sm text-neutral-400">Send one reminder to each pending registration with an email address. Choose a specific game to narrow the list. This does not send reminders on a schedule.</p></div>
    {configured === false && <p className="rounded-lg border border-amber-400/30 bg-amber-300/5 p-4 text-sm text-amber-200">SMTP is not configured. Add the SMTP settings to the server environment before sending messages.</p>}
    {configured === true && <label className="block"><span className="mb-1 block text-sm">Game</span><select className="input" value={gameId} onChange={(event) => setGameId(event.target.value)}><option value="">All games with pending registrations</option>{games.map((game) => <option key={game._id} value={game._id}>{game.name}</option>)}</select></label>}
    {error && <p role="alert" className="text-red">{error}</p>}
    {message && <p role="status" className="text-green-300">{message}</p>}
    {configured && <button className="btn" disabled={busy} onClick={send}>{busy ? 'Sending...' : 'Send pending reminders'}</button>}
  </section>);
}

function Overview() {
  const [s, setS] = useState<any>(null); const [log, setLog] = useState<any[]>([]); const [error, setError] = useState('');
  useEffect(() => {
    Promise.all([api('/admin/stats', { auth: true }), api('/admin/audit', { auth: true })])
      .then(([stats, auditLog]) => { setS(stats); setLog(auditLog); })
      .catch((reason) => setError(reason.message));
  }, []);
  if (!s) return error ? <p role="alert" className="rounded-lg border border-red/40 bg-red/10 p-4 text-red">{error}</p> : <div className="h-32 animate-pulse rounded-xl bg-neutral-900" />;
  const max = Math.max(1, ...s.byGame.map((x: any) => x.count));
  return (<div className="grid md:grid-cols-2 gap-6">
    <section className="surface p-5"><p className="eyebrow">Activity snapshot</p><p className="h-display mt-3 text-6xl text-red">{s.total}</p><p className="text-neutral-400">Total registrations</p>
      <ul className="mt-5 flex flex-wrap gap-2">{s.byStatus.map((item: any) => <li key={item._id} className="status-pill">{item._id}: {item.count}</li>)}</ul>
      <div className="mt-6 space-y-4">{s.byGame.map((item: any) => (<div key={item._id}><div className="mb-1 flex justify-between text-sm"><span>{item.name || 'Unlisted game'}</span><span>{item.count}</span></div>
        <div className="h-2 overflow-hidden rounded-full bg-neutral-800"><div className="h-full rounded-full bg-red" style={{ width: `${(item.count / max) * 100}%` }} /></div></div>))}</div></section>
    <section className="surface p-5"><h2 className="h-display mb-4 text-2xl">Recent organizer activity</h2><ul className="max-h-96 space-y-2 overflow-auto text-sm">{log.map((item) => <li key={item._id} className="border-b border-white/5 pb-2 text-neutral-300"><span className="text-neutral-500">{new Date(item.createdAt).toLocaleString()}</span><br />{item.admin}: {item.action} {item.target || ''}</li>)}
      {log.length === 0 && <li className="text-neutral-400">No organizer activity recorded yet.</li>}</ul></section></div>);
}

export default function Admin() {
  const [authed, setAuthed] = useState(!!getToken()); const [tab, setTab] = useState('Overview'); const [games, setGames] = useState<Game[]>([]); const [loadError, setLoadError] = useState('');
  const reload = useCallback(async () => {
    setLoadError('');
    try { setGames(await api<Game[]>('/games')); }
    catch (error) { setLoadError(error instanceof Error ? error.message : 'Could not load games.'); }
  }, []);
  useEffect(() => { if (authed) reload(); }, [authed, reload]);
  if (!authed) return <Login onOk={() => setAuthed(true)} />;
  const tabs = ['Overview', 'Registrations', 'Games and rules', 'Event settings', 'Reminders'];
  return (<div className="mx-auto max-w-6xl px-4 py-10">
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">Management workspace</p><h1 className="h-display mt-2 text-4xl text-white">Organizer dashboard</h1></div>
      <button className="btn btn-ghost" onClick={() => { setToken(null); setAuthed(false); }}>Sign out</button></div>
    <div className="mb-6 flex flex-wrap gap-2 border-b border-white/10 pb-4" role="tablist" aria-label="Organizer tools">{tabs.map((name) => (
      <button key={name} id={`tab-${name.replace(/ /g, '-')}`} role="tab" aria-selected={tab === name} aria-controls="organizer-panel" className={`btn ${tab === name ? '' : 'btn-ghost'}`} onClick={() => setTab(name)}>{name}</button>))}</div>
    {loadError && <p role="alert" className="mb-4 text-red">{loadError}</p>}
    <div id="organizer-panel" role="tabpanel" aria-labelledby={`tab-${tab.replace(/ /g, '-')}`}>
    {tab === 'Overview' && <Overview />}
    {tab === 'Registrations' && <Registrations games={games} />}
    {tab === 'Games and rules' && <GamesAdmin games={games} reload={reload} />}
    {tab === 'Event settings' && <SettingsAdmin />}
    {tab === 'Reminders' && <RemindersAdmin games={games} />}
    </div>
  </div>);
}
