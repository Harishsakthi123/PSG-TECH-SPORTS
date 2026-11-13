import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, Game, isRegistrationOpen } from '../api';

export default function Games() {
  const [games, setGames] = useState<Game[] | null>(null);
  const [err, setErr] = useState('');
  const [q, setQ] = useState(''); const [type, setType] = useState(''); const [cat, setCat] = useState('');
  useEffect(() => { document.title = 'Games | PSG Tech Intramurals'; api('/games').then(setGames).catch((e) => setErr(e.message)); }, []);
  const cats = useMemo(() => [...new Set((games || []).map((g) => g.category).filter(Boolean))], [games]);
  const list = (games || []).filter((g) => `${g.name} ${g.category} ${g.format}`.toLowerCase().includes(q.trim().toLowerCase()) && (!type || g.type === type) && (!cat || g.category === cat));
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <p className="eyebrow">Explore the competition</p>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="h-display mt-2 text-5xl md:text-6xl">Games and rules</h1><p className="mt-3 max-w-2xl text-neutral-400">Find your event, understand the format and register while places are available.</p></div>
        <Link to="/status" className="text-sm font-semibold text-rose-300 hover:text-white">Already registered? Check status <span aria-hidden="true">→</span></Link>
      </div>
      <div className="surface mb-8 grid gap-3 p-4 sm:grid-cols-3">
        <label><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-400">Search</span><input className="input" placeholder="Name, category or format" aria-label="Search games" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <label><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-400">Competition type</span><select className="input" aria-label="Type" value={type} onChange={(e) => setType(e.target.value)}><option value="">All types</option><option value="individual">Individual</option><option value="team">Team</option></select></label>
        <label><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-400">Category</span><select className="input" aria-label="Category" value={cat} onChange={(e) => setCat(e.target.value)}><option value="">All categories</option>{cats.map((c) => <option key={c}>{c}</option>)}</select></label>
      </div>
      {err && <p role="alert" className="text-red">{err}</p>}
      {!games && !err && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Loading games">{[1, 2, 3].map((i) => <div key={i} className="surface h-64 animate-pulse" />)}</div>}
      {games && list.length === 0 && <div className="surface p-8 text-center"><h2 className="h-display text-2xl">No games found</h2><p className="mt-2 text-neutral-400">{games.length ? 'Try another search or clear the selected filters.' : 'Games will be announced by the organizers.'}</p>
        {games.length > 0 && <button className="btn btn-ghost mt-4" onClick={() => { setQ(''); setType(''); setCat(''); }}>Clear filters</button>}</div>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((g) => {
          const closed = !isRegistrationOpen(g);
          return (
            <article key={g._id} className="surface flex flex-col overflow-hidden">
              {g.imageUrl && <img src={g.imageUrl} alt={`${g.name} event`} loading="lazy" className="h-40 w-full object-cover" />}
              <div className="flex flex-1 flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div><p className="eyebrow">{g.category || 'Intramural'}</p><h2 className="h-display mt-2 text-2xl">{g.name}</h2></div>
                  <span className={`status-pill ${closed ? '!border-white/10 !bg-white/5 !text-neutral-400' : ''}`}>{closed ? 'Closed' : 'Open'}</span>
                </div>
                <p className="mt-3 text-sm capitalize text-neutral-400">{g.type}{g.type === 'team' && ` · ${g.teamSize.min}-${g.teamSize.max} players`}</p>
                <p className="mt-3 flex-1 text-sm text-neutral-300">{g.format || 'Competition format to be announced.'}</p>
                {g.capacity && <p className="mt-3 text-xs text-neutral-400">{g.registered || 0} of {g.capacity} registrations</p>}
                {g.deadline && <p className="mt-1 text-xs text-neutral-400">Registration deadline: {new Date(g.deadline).toLocaleDateString()}</p>}
                <div className="mt-5 flex flex-wrap gap-2">
                  <Link className="btn btn-ghost" to={`/rules/${g.slug}`}>View rules</Link>
                  {!closed && <Link className="btn" to={`/register/${g.slug}`}>Register</Link>}
                </div>
              </div>
            </article>);
        })}
      </div>
    </div>
  );
}
