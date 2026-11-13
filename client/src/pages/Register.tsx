import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, Game, isRegistrationOpen } from '../api';

const person = z.object({
  name: z.string().trim().min(2, 'Enter full name'),
  rollNo: z.string().trim().regex(/^[A-Za-z0-9]{4,15}$/, 'Enter a valid roll number'),
  department: z.string().trim().min(2, 'Enter department'),
  year: z.enum(['1', '2', '3', '4', '5'], { errorMap: () => ({ message: 'Select year' }) }),
  phone: z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a 10-digit mobile number'),
});
const schema = z.object({ email: z.string().email('Enter a valid email'), teamName: z.string().optional(), leader: person, members: z.array(person) });
type Form = z.infer<typeof schema>;
const blank = { name: '', rollNo: '', department: '', year: '' as any, phone: '' };

function PersonFields({ prefix, reg, errors }: { prefix: string; reg: any; errors: any }) {
  const f: [string, string, string?][] = [['name', 'Full name'], ['rollNo', 'Roll number'], ['department', 'Department'], ['phone', 'Mobile number', 'tel']];
  const e = prefix.split('.').reduce((o, k) => o?.[k], errors) || {};
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {f.map(([k, label, t]) => (
        <label key={k} className="block"><span className="text-sm">{label}</span>
          <input type={t || 'text'} className="input" aria-invalid={!!e[k]} {...reg(`${prefix}.${k}`)} />
          {e[k] && <span role="alert" className="text-sm text-red">{e[k].message}</span>}</label>))}
      <label className="block"><span className="text-sm">Year</span>
        <select className="input" aria-invalid={!!e.year} {...reg(`${prefix}.year`)}><option value="">Select</option>{[1, 2, 3, 4, 5].map((y) => <option key={y}>{y}</option>)}</select>
        {e.year && <span role="alert" className="text-sm text-red">{e.year.message}</span>}</label>
    </div>);
}

export default function Register() {
  const { slug } = useParams(); const nav = useNavigate();
  const [games, setGames] = useState<Game[] | null>(null);
  const [done, setDone] = useState<{ ref: string; game: string; status: string; emailNotice?: string } | null>(null);
  const [serverErr, setServerErr] = useState(''); const [busy, setBusy] = useState(false);
  const { register, control, handleSubmit, formState: { errors }, trigger, getValues } = useForm<Form>({
    resolver: zodResolver(schema), defaultValues: { email: '', teamName: '', leader: blank, members: [] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'members' });
  useEffect(() => { document.title = 'Register | PSG Tech Intramurals'; api('/games').then(setGames).catch(() => setGames([])); }, []);
  const game = games?.find((g) => g.slug === slug);
  const open = isRegistrationOpen;

  // add the minimum required members when a team game is chosen
  useEffect(() => { if (game?.type === 'team' && fields.length === 0) for (let i = 1; i < game.teamSize.min; i++) append(blank); }, [game?._id]);

  const onSubmit = async (v: Form) => {
    if (!game) return;
    setServerErr('');
    if (game.type === 'team') {
      const n = 1 + v.members.length;
      if (!v.teamName || v.teamName.trim().length < 2) return setServerErr('Enter a team name');
      if (n < game.teamSize.min || n > game.teamSize.max) return setServerErr(`Team must have ${game.teamSize.min} to ${game.teamSize.max} players including you`);
    }
    setBusy(true);
    try {
      setDone(await api('/registrations', { method: 'POST', body: { gameId: game._id, email: v.email, teamName: game.type === 'team' ? v.teamName : undefined, leader: v.leader, members: game.type === 'team' ? v.members : [] } }));
    } catch (e: any) { setServerErr(e.message); } finally { setBusy(false); }
  };

  const step = done ? 3 : game ? 2 : 1;
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="h-display text-5xl mb-4">Register</h1>
      <ol className="flex gap-2 mb-8" aria-label="Progress">
        {['Choose game', 'Your details', 'Confirmation'].map((l, i) => (
          <li key={l} aria-current={step === i + 1 ? 'step' : undefined} className={`flex-1 p-2 text-center text-sm ${step >= i + 1 ? 'bg-red' : 'bg-neutral-800'}`}>{l}</li>))}
      </ol>

      {!games && <div className="h-40 bg-neutral-900 animate-pulse" />}
      {games && games.length === 0 && <p>No games are open yet. Check back soon.</p>}

      {games && !game && !done && (<>
        {slug && <p role="alert" className="text-red mb-3">Game not found. Pick one below.</p>}
        <ul className="grid sm:grid-cols-2 gap-3">
          {games.map((g) => (<li key={g._id}>
            <button disabled={!open(g)} onClick={() => nav(`/register/${g.slug}`)} className="w-full text-left bg-neutral-900 border-l-4 border-red p-4 disabled:opacity-50 enabled:hover:bg-neutral-800">
              <span className="h-display text-xl block">{g.name}</span>
              <span className="text-sm capitalize text-neutral-400">{open(g) ? g.type : 'Registration closed'}</span></button></li>))}
        </ul></>)}

      {game && !done && !open(game) && <div className="surface p-6">
        <p className="eyebrow">Registration unavailable</p><h2 className="h-display mt-2 text-3xl">{game.name}</h2>
        <p className="mt-3 text-neutral-300">Registration for this game is closed, full, or past its deadline.</p>
        <Link to="/games" className="btn btn-ghost mt-5">Browse open games</Link>
      </div>}

      {game && !done && open(game) && (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
          <p className="bg-neutral-900 p-3">Game: <b>{game.name}</b> ({game.type}) <Link to="/register" className="text-red ml-2">Change</Link></p>
          {game.type === 'team' && <label className="block"><span className="text-sm">Team name</span><input className="input" {...register('teamName')} /></label>}
          <fieldset><legend className="h-display text-2xl mb-2">{game.type === 'team' ? 'Team leader (you)' : 'Your details'}</legend>
            <PersonFields prefix="leader" reg={register} errors={errors} /></fieldset>
          <label className="block"><span className="text-sm">Email</span><input type="email" className="input" aria-invalid={!!errors.email} {...register('email')} />
            {errors.email && <span role="alert" className="text-sm text-red">{errors.email.message}</span>}</label>
          {game.type === 'team' && (<div>
            <h2 className="h-display text-2xl mb-2">Team members ({game.teamSize.min}-{game.teamSize.max} players including you)</h2>
            {fields.map((f, i) => (<div key={f.id} className="border border-neutral-700 p-3 mb-3">
              <div className="flex justify-between mb-2"><b>Member {i + 2}</b>
                {1 + fields.length > game.teamSize.min && <button type="button" className="text-red" onClick={() => remove(i)}>Remove</button>}</div>
              <PersonFields prefix={`members.${i}`} reg={register} errors={errors} /></div>))}
            {1 + fields.length < game.teamSize.max && <button type="button" className="btn btn-ghost" onClick={() => append(blank)}>Add member</button>}
          </div>)}
          {serverErr && <p role="alert" className="bg-red/20 border border-red p-3">{serverErr}</p>}
          <button className="btn" disabled={busy}>{busy ? 'Submitting...' : 'Submit registration'}</button>
        </form>)}

      {done && (<div className="surface border-t-4 border-t-red p-6" role="status">
        <p className="eyebrow">Submission complete</p><h2 className="h-display mt-2 text-3xl">Registration received</h2>
        <p className="mt-3">Game: {done.game}</p>
        <p>Reference ID: <b className="text-2xl text-red select-all">{done.ref}</b></p>
        <p className="mt-1">Status: <span className="status-pill">{done.status}</span></p>
        <p className="mt-4 text-sm text-neutral-300">{done.emailNotice || 'Save this reference ID so you can check your registration status later.'}</p>
        <div className="mt-5 flex flex-wrap gap-3"><Link to={`/status?ref=${encodeURIComponent(done.ref)}`} className="btn">Check registration status</Link>
          <Link to="/games" className="btn btn-ghost">Back to games</Link></div></div>)}
    </div>
  );
}
