import { FormEvent, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api';

type RegistrationStatus = {
  ref: string;
  game: string;
  status: string;
  teamName?: string;
  createdAt: string;
};

export default function Status() {
  const [params] = useSearchParams();
  const [ref, setRef] = useState(params.get('ref') || '');
  const [registration, setRegistration] = useState<RegistrationStatus | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { document.title = 'Registration status | PSG Tech Intramurals'; }, []);

  const lookup = async (event: FormEvent) => {
    event.preventDefault();
    const value = ref.trim().toUpperCase();
    if (!value) {
      setError('Enter your registration reference.');
      return;
    }
    setBusy(true);
    setError('');
    setRegistration(null);
    try {
      setRegistration(await api<RegistrationStatus>(`/registrations/${encodeURIComponent(value)}`));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not look up this registration.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mx-auto max-w-2xl px-4 py-16">
      <p className="eyebrow">Participant services</p>
      <h1 className="h-display text-5xl md:text-6xl mt-3">Check registration</h1>
      <p className="mt-4 text-neutral-300">Enter the reference number shown after registration to check its latest status.</p>
      <form onSubmit={lookup} className="mt-8 flex flex-col sm:flex-row gap-3">
        <label className="sr-only" htmlFor="registration-reference">Registration reference</label>
        <input id="registration-reference" className="input" autoComplete="off" placeholder="e.g. INT26-AB12CD34" value={ref} onChange={(event) => setRef(event.target.value)} />
        <button className="btn shrink-0" disabled={busy}>{busy ? 'Checking...' : 'Check status'}</button>
      </form>
      {error && <p role="alert" className="mt-4 rounded-lg border border-red/50 bg-red/10 p-4 text-red">{error}</p>}
      {registration && (
        <article className="surface mt-6 p-6" aria-live="polite">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="text-sm text-neutral-400">Registration reference</p><p className="font-mono text-lg">{registration.ref}</p></div>
            <span className="status-pill">{registration.status}</span>
          </div>
          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            <div><dt className="text-sm text-neutral-400">Game</dt><dd className="mt-1 font-semibold">{registration.game}</dd></div>
            {registration.teamName && <div><dt className="text-sm text-neutral-400">Team</dt><dd className="mt-1 font-semibold">{registration.teamName}</dd></div>}
            <div><dt className="text-sm text-neutral-400">Submitted</dt><dd className="mt-1">{new Date(registration.createdAt).toLocaleString()}</dd></div>
          </dl>
          <p className="mt-6 border-t border-white/10 pt-4 text-sm text-neutral-300">For questions about your registration, contact the event organizers.</p>
        </article>
      )}
      <Link to="/games" className="btn btn-ghost mt-8">Browse games</Link>
    </section>
  );
}
