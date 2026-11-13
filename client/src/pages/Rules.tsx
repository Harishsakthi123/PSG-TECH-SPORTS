import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, Game, isRegistrationOpen } from '../api';

export default function Rules() {
  const { slug } = useParams();
  const [games, setGames] = useState<Game[] | null>(null);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    document.title = 'Games and rules | PSG Tech Intramurals';
    api('/games').then(setGames).catch((reason) => { setError(reason.message); setGames([]); });
  }, []);
  const game = games?.find((g) => g.slug === slug);
  const filteredGames = useMemo(() => (games || []).filter((item) =>
    `${item.name} ${item.category} ${item.format}`.toLowerCase().includes(q.trim().toLowerCase())), [games, q]);
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 md:py-16">
      {!games && <div className="surface h-40 animate-pulse" aria-label="Loading game rules" />}
      {error && <p role="alert" className="rounded-lg border border-red/40 bg-red/10 p-4 text-red">{error}</p>}
      {games && !slug && <>
        <p className="eyebrow">Competition guide</p><h1 className="h-display mt-2 text-5xl md:text-6xl">Rules and regulations</h1>
        <p className="mt-4 max-w-2xl text-neutral-400">Review each competition's format and organizer-published rules before you register.</p>
        <label className="mt-8 block max-w-xl"><span className="mb-1 block text-sm">Find a game</span><input className="input" placeholder="Search games, category or format" aria-label="Search games" value={q} onChange={(event) => setQ(event.target.value)} /></label>
        {!error && games.length === 0 && <p className="surface mt-6 p-5 text-neutral-300">Rules will be published by the organizers.</p>}
        {games.length > 0 && filteredGames.length === 0 && <p className="mt-6 text-neutral-400">No games match this search.</p>}
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredGames.map((item) => <li key={item._id}><Link to={`/rules/${item.slug}`} className="surface block h-full p-5 transition hover:border-white/30">
            <p className="eyebrow">{item.category || 'Intramural'}</p><h2 className="h-display mt-2 text-2xl">{item.name}</h2>
            <p className="mt-3 text-sm text-neutral-400">{item.rules?.length || 0} published rule section{item.rules?.length === 1 ? '' : 's'} · {item.type}</p>
            <span className="mt-5 inline-block text-sm font-semibold text-rose-300">Read game guide <span aria-hidden="true">→</span></span>
          </Link></li>)}
        </ul>
      </>}
      {games && slug && !game && <div className="surface mt-8 p-6"><h1 className="h-display text-3xl">Game not found</h1><p className="mt-2 text-neutral-400">This game may have been removed or its link may have changed.</p><Link className="btn btn-ghost mt-5" to="/rules">Browse all game rules</Link></div>}
      {game && <>
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-neutral-400"><Link className="hover:text-white" to="/">Home</Link><span aria-hidden="true"> / </span><Link className="hover:text-white" to="/rules">Games and rules</Link><span aria-hidden="true"> / </span><span className="text-white">{game.name}</span></nav>
        <p className="eyebrow">{game.category || 'Intramural'} · {game.type}</p><h1 className="h-display mt-2 text-5xl md:text-6xl">{game.name}</h1>
        <div className="surface mt-7 grid gap-5 p-5 sm:grid-cols-2">
          <div><p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Competition format</p><p className="mt-1">{game.format || 'To be announced'}</p></div>
          {game.type === 'team' && <div><p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Team size</p><p className="mt-1">{game.teamSize.min} to {game.teamSize.max} players</p></div>}
          <div><p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Registration</p><p className="mt-1">{isRegistrationOpen(game) ? 'Open' : 'Closed'}</p></div>
        </div>
        <section className="mt-10">
          <p className="eyebrow">Official game guide</p><h2 className="h-display mt-2 text-3xl">Rules and details</h2>
          {!game.rules?.length ? <p className="surface mt-5 p-5 text-neutral-300">Official rules for this game have not been published yet.</p> :
            <ol className="mt-5 space-y-3">{game.rules.map((rule, index) => <li key={`${rule.title}-${index}`} className="surface p-5">
              <p className="font-mono text-xs text-rose-300">SECTION {String(index + 1).padStart(2, '0')}</p><h3 className="h-display mt-2 text-2xl">{rule.title}</h3>
              <p className="mt-2 whitespace-pre-line text-neutral-300">{rule.body}</p>
            </li>)}</ol>}
        </section>
        <div className="mt-8 flex flex-wrap gap-3"><Link className="btn btn-ghost" to="/games">Back to games</Link>
          {isRegistrationOpen(game) && <Link className="btn" to={`/register/${game.slug}`}>Register for this game</Link>}</div>
      </>}
    </div>
  );
}
