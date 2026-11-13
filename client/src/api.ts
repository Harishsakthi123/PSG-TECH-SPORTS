const BASE = import.meta.env.VITE_API_URL || '/api';
export const getToken = () => sessionStorage.getItem('adm');
export const setToken = (t: string | null) => (t ? sessionStorage.setItem('adm', t) : sessionStorage.removeItem('adm'));

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown; auth?: boolean } = {}): Promise<T> {
  const res = await fetch(BASE + path, {
    method: opts.method || 'GET',
    headers: { 'Content-Type': 'application/json', ...(opts.auth ? { Authorization: `Bearer ${getToken()}` } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'Request failed'), { status: res.status, issues: data.issues });
  return data;
}
export async function download(path: string, name: string) {
  const res = await fetch(BASE + path, { headers: { Authorization: `Bearer ${getToken()}` } });
  if (!res.ok) throw new Error('Export failed');
  const url = URL.createObjectURL(await res.blob());
  Object.assign(document.createElement('a'), { href: url, download: name }).click();
  URL.revokeObjectURL(url);
}
export type Game = { _id: string; name: string; slug: string; category: string; type: 'individual' | 'team';
  teamSize: { min: number; max: number }; format: string; imageUrl: string; rules: { title: string; body: string }[];
  registrationOpen: boolean; deadline?: string; capacity?: number; registered?: number };

export function isRegistrationOpen(game: Pick<Game, 'registrationOpen' | 'deadline' | 'capacity' | 'registered'>): boolean {
  const deadlinePassed = Boolean(game.deadline && new Date(game.deadline).getTime() < Date.now());
  const capacityReached = Boolean(game.capacity && (game.registered || 0) >= game.capacity);
  return game.registrationOpen && !deadlinePassed && !capacityReached;
}
