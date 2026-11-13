import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, Game, isRegistrationOpen } from '../api';
import { useSettings } from '../App';

export default function Home() {
  const s = useSettings();
  const [games, setGames] = useState<Game[] | null>(null);
  useEffect(() => { document.title = 'PSG Tech Intramurals 2025-2026'; api('/games').then(setGames).catch(() => setGames([])); }, []);
  if (!s) return <div className="p-10" aria-busy="true"><div className="h-40 bg-neutral-900 animate-pulse" /></div>;
  if (s.error) return <p className="p-10">Could not load event details. Please refresh.</p>;
  return (
    <>
      <section className="relative isolate overflow-hidden border-b border-white/5 bg-[radial-gradient(ellipse_at_75%_15%,rgb(127_29_45_/_28%),transparent_42%),linear-gradient(135deg,#111217,#090a0d_68%)] px-4 py-20 md:py-28">
        <div className="mx-auto grid max-w-6xl items-center gap-12 md:grid-cols-[1.2fr_.8fr]">
          <div>
            <p className="eyebrow">{s.college}</p>
            <p className="mt-2 text-sm text-neutral-400">{s.department}</p>
            <h1 className="h-display mt-7 max-w-3xl text-6xl md:text-8xl">{s.title}</h1>
            <p className="mt-6 max-w-xl text-lg text-neutral-300">One campus. Every house. A season of competition, teamwork and unforgettable moments.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/games" className="btn">Explore games</Link>
              <Link to="/register" className="btn btn-ghost">Register to compete</Link>
            </div>
            <p className="mt-6 text-sm text-neutral-400">Event starts: <span className="font-semibold text-white">{s.startDate || 'To be announced'}</span></p>
          </div>
          <div className="surface relative p-7 md:p-9">
            <p className="eyebrow">The spirit of intramurals</p>
            {s.slogan.map((word: string, index: number) => (
              <p key={`${word}-${index}`} className={`h-display mt-4 text-5xl md:text-6xl ${index === 1 ? 'text-red' : ''}`}>{word}</p>
            ))}
            <div className="mt-8 border-t border-white/10 pt-5">
              <p className="text-sm text-neutral-400">Find your event, read the rules and keep your registration reference close.</p>
              <Link to="/status" className="mt-4 inline-flex items-center gap-2 font-semibold text-rose-300 hover:text-white">Check registration status <span aria-hidden="true">→</span></Link>
            </div>
          </div>
        </div>
      </section>

      <section id="houses" className="mx-auto max-w-6xl py-16 px-4">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div><p className="eyebrow">Meet your team</p><h2 className="h-display mt-2 text-4xl md:text-5xl">Our houses</h2></div>
          <p className="max-w-md text-sm text-neutral-400">Represent your house with pride. House group and year information is published by the organizers.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {s.houses.map((house: any, index: number) => (
            <article key={house.name} className="surface p-5">
              <span className="font-mono text-sm text-rose-300">0{index + 1}</span>
              <h3 className="h-display mt-6 text-2xl">{house.name}</h3>
              <p className="mt-3 text-sm text-neutral-400">Year groups: {house.years || 'To be announced'}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-white/5 bg-[#0d0e12] py-16 px-4">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div><p className="eyebrow">Find your event</p><h2 className="h-display mt-2 text-4xl md:text-5xl">Games and format</h2></div>
            <Link to="/games" className="text-sm font-semibold text-rose-300 hover:text-white">Browse all games <span aria-hidden="true">→</span></Link>
          </div>
          {!games ? <div className="h-32 animate-pulse rounded-xl bg-neutral-900" /> : games.length === 0 ? <p className="text-neutral-400">Games will be announced soon.</p> : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {games.slice(0, 6).map((game) => (
                <article key={game._id} className="surface flex min-h-44 flex-col p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="h-display text-2xl">{game.name}</h3>
                    <span className="status-pill">{isRegistrationOpen(game) ? 'Open' : 'Closed'}</span>
                  </div>
                  <p className="mt-3 flex-1 text-sm text-neutral-400">{game.format || 'Competition format to be announced'}</p>
                  <p className="mt-4 text-xs uppercase tracking-wide text-neutral-500">{game.category || 'Intramural'} · {game.type}</p>
                </article>))}
            </div>)}
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-4 py-16 md:grid-cols-2">
        <article className="surface p-7 md:p-9"><p className="eyebrow">Know before you play</p><h2 className="h-display mt-3 text-4xl">Rules and regulations</h2>
          <p className="mt-3 text-neutral-400">Check the event format, eligibility and published rules for each game.</p>
          <Link to="/rules" className="btn btn-ghost mt-6">View game rules</Link></article>
        <article className="rounded-2xl border border-red/30 bg-[linear-gradient(140deg,rgb(127_29_45_/_30%),#151116)] p-7 md:p-9"><p className="eyebrow">Ready to compete?</p><h2 className="h-display mt-3 text-4xl">Your game starts here</h2>
          <p className="mt-3 text-neutral-300">Choose an open event and submit your details. Keep the reference to check your status later.</p>
          <Link to="/register" className="btn mt-6">Start registration</Link></article>
      </section>

      {s.announcements?.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pb-16"><p className="eyebrow">Stay up to date</p><h2 className="h-display mt-2 text-3xl">Announcements</h2>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">{s.announcements.map((announcement: string, i: number) => <li key={`${i}-${announcement}`} className="surface border-l-2 border-l-red p-4">{announcement}</li>)}</ul></section>)}

      <footer id="contact" className="border-t border-white/10 bg-[#0d0e12] py-12 px-4">
        <div className="mx-auto grid max-w-6xl gap-8 sm:grid-cols-2">
          <div><p className="eyebrow">Need help?</p><h2 className="h-display mt-2 text-4xl">Contact organizers</h2><p className="mt-3 text-sm text-neutral-400">Reach out to the event team for questions about schedules, eligibility or registrations.</p></div>
          <div className="space-y-2 sm:text-right">
            {s.contacts.phones?.map((phone: string) => <p key={phone}><a className="hover:text-rose-300" href={`tel:${phone}`}>{phone}</a></p>)}
            {s.contacts.email && <p><a className="hover:text-rose-300" href={`mailto:${s.contacts.email}`}>{s.contacts.email}</a></p>}
            {s.contacts.instagram && <p><a className="hover:text-rose-300" href={s.contacts.instagram} target="_blank" rel="noreferrer">Instagram</a></p>}
            {s.contacts.other && <p className="text-neutral-400">{s.contacts.other}</p>}
            {!s.contacts.phones?.length && !s.contacts.email && <p className="text-neutral-400">Contact details will be added by the organizers.</p>}
          </div>
          <p className="border-t border-white/10 pt-5 text-xs text-neutral-500 sm:col-span-2">PSG Tech Intramurals · {s.title}</p>
        </div>
      </footer>
    </>
  );
}
