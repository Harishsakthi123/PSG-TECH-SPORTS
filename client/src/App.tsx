import { useEffect, useState, createContext, useContext } from 'react';
import { Routes, Route, NavLink, Link, useLocation } from 'react-router-dom';
import { api } from './api';
import Home from './pages/Home';
import Games from './pages/Games';
import Rules from './pages/Rules';
import Register from './pages/Register';
import Admin from './pages/Admin';
import Status from './pages/Status';

export const SettingsCtx = createContext<any>(null);
export const useSettings = () => useContext(SettingsCtx);

function Nav() {
  const [open, setOpen] = useState(false);
  const links: [string, string][] = [['/', 'Home'], ['/games', 'Games'], ['/register', 'Register'], ['/status', 'Check status'], ['/#houses', 'Our houses'], ['/#contact', 'Contact'], ['/admin', 'Organizer sign in']];
  return (
    <header className="sticky top-0 z-50 bg-black/95 border-b-2 border-red">
      <nav className="mx-auto max-w-6xl flex items-center justify-between px-4 py-3" aria-label="Main">
        <Link to="/" className="h-display text-xl text-red">PSG Tech Intramurals</Link>
        <button id="nav-toggle" className="md:hidden btn btn-ghost !px-4 !py-2" aria-controls="primary-navigation" aria-expanded={open} onClick={() => setOpen(!open)}>Menu</button>
        <ul id="primary-navigation" className={`${open ? 'flex' : 'hidden'} md:flex absolute md:static top-full left-0 right-0 bg-black flex-col md:flex-row gap-4 p-4 md:p-0`}>
          {links.map(([to, label]) => (
            <li key={label}>
              {to.includes('#') ? <a href={to} onClick={() => setOpen(false)} className="hover:text-red">{label}</a>
                : <NavLink to={to} end onClick={() => setOpen(false)} className={({ isActive }) => (isActive ? 'text-red' : 'hover:text-red')}>{label}</NavLink>}
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}

export default function App() {
  const [settings, setSettings] = useState<any>(null);
  const loc = useLocation();
  useEffect(() => { api('/settings').then(setSettings).catch(() => setSettings({ error: true })); }, []);
  useEffect(() => { if (!loc.hash) window.scrollTo(0, 0); }, [loc.pathname]);
  const isAdmin = loc.pathname.startsWith('/admin');
  return (
    <SettingsCtx.Provider value={settings}>
      {!isAdmin && <Nav />}
      <main key={loc.pathname}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/games" element={<Games />} />
            <Route path="/games/:slug" element={<Rules />} />
            <Route path="/rules" element={<Rules />} />
            <Route path="/rules/:slug" element={<Rules />} />
            <Route path="/register" element={<Register />} />
            <Route path="/register/:slug" element={<Register />} />
            <Route path="/status" element={<Status />} />
            <Route path="/admin/*" element={<Admin />} />
            <Route path="*" element={<p className="p-10">Page not found. <Link className="text-red" to="/">Go home</Link></p>} />
          </Routes>
      </main>
    </SettingsCtx.Provider>
  );
}
