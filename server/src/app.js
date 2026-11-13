import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import crypto from 'crypto';
import ExcelJS from 'exceljs';
import { Admin, Game, Registration, Settings, AuditLog } from './models.js';
import { defaultSettings } from './defaults.js';
import { escapeHtml, isEmailConfigured, sendEmail } from './mailer.js';

export const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '100kb' }));

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const slugify = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const secret = () => process.env.JWT_SECRET;
const ACTIVE = { $in: ['pending', 'confirmed'] };

// ---------- auth ----------
const requireAdmin = (roles) => (req, res, next) => {
  try {
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    const user = jwt.verify(token, secret());
    if (roles && !roles.includes(user.role)) return res.status(403).json({ error: 'Forbidden' });
    req.admin = user;
    next();
  } catch { res.status(401).json({ error: 'Unauthorized' }); }
};
const audit = (req, action, target, detail) =>
  AuditLog.create({ admin: req.admin.email, action, target, detail });

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });
const regLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 30 });
const aiLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 20 });
const reminderLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 3 });

// ---------- public ----------
app.get('/api/health', (_, res) => res.json({ ok: true }));

app.get('/api/settings', wrap(async (_, res) => {
  const s = await Settings.findOne({ key: 'event' });
  res.json({ ...defaultSettings, ...(s?.value || {}) });
}));

app.get('/api/games', wrap(async (_, res) => {
  const games = await Game.find().sort({ name: 1 }).lean();
  const counts = await Registration.aggregate([{ $match: { status: ACTIVE } }, { $group: { _id: '$game', n: { $sum: 1 } } }]);
  const map = Object.fromEntries(counts.map((c) => [String(c._id), c.n]));
  res.json(games.map((g) => ({ ...g, registered: map[String(g._id)] || 0 })));
}));

app.get('/api/games/:slug', wrap(async (req, res) => {
  const g = await Game.findOne({ slug: req.params.slug }).lean();
  if (!g) return res.status(404).json({ error: 'Game not found' });
  res.json(g);
}));

const personZ = z.object({
  name: z.string().trim().min(2).max(80),
  rollNo: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{4,15}$/, 'Invalid roll number'),
  department: z.string().trim().min(2).max(80),
  year: z.enum(['1', '2', '3', '4', '5']),
  phone: z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a 10-digit mobile number'),
});
const regZ = z.object({
  gameId: z.string().length(24),
  email: z.string().trim().toLowerCase().email(),
  teamName: z.string().trim().min(2).max(60).optional(),
  leader: personZ,
  members: z.array(personZ).max(30).default([]),
});

app.post('/api/registrations', regLimiter, wrap(async (req, res) => {
  const parsed = regZ.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Validation failed', issues: parsed.error.flatten() });
  const d = parsed.data;
  const game = await Game.findById(d.gameId);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  if (!game.registrationOpen) return res.status(409).json({ error: 'Registration is closed for this game' });
  if (game.deadline && game.deadline < new Date()) return res.status(409).json({ error: 'Registration deadline has passed' });

  let members = [];
  if (game.type === 'team') {
    if (!d.teamName) return res.status(400).json({ error: 'Team name is required' });
    members = d.members;
    const size = 1 + members.length;
    if (size < game.teamSize.min || size > game.teamSize.max)
      return res.status(400).json({ error: `Team must have ${game.teamSize.min} to ${game.teamSize.max} players including the leader` });
  }
  const rollNos = [d.leader.rollNo, ...members.map((m) => m.rollNo)];
  if (new Set(rollNos).size !== rollNos.length) return res.status(400).json({ error: 'Duplicate roll numbers within the team' });

  if (game.capacity) {
    const n = await Registration.countDocuments({ game: game._id, status: ACTIVE });
    if (n >= game.capacity) return res.status(409).json({ error: 'This game is full' });
  }
  const dup = await Registration.findOne({ game: game._id, rollNos: { $in: rollNos }, status: ACTIVE });
  if (dup) return res.status(409).json({ error: 'One or more roll numbers are already registered for this game' });

  const ref = 'INT26-' + crypto.randomBytes(4).toString('hex').toUpperCase();
  let registration;
  try {
    registration = await Registration.create({
      ref, game: game._id, type: game.type, teamName: d.teamName, leader: d.leader, email: d.email,
      members, rollNos, history: [{ status: 'pending', by: 'student' }],
    });
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ error: 'Already registered for this game' });
    throw e;
  }
  let emailNotice = 'Confirmation email is not configured; save your reference number.';
  if (isEmailConfigured()) {
    const lookupUrl = `${(process.env.CLIENT_ORIGIN || 'http://localhost:5173').replace(/\/$/, '')}/status?ref=${encodeURIComponent(ref)}`;
    const gameName = escapeHtml(game.name);
    const safeRef = escapeHtml(ref);
    try {
      await sendEmail({
        to: registration.email,
        subject: `Registration received: ${game.name}`,
        text: `Your registration for ${game.name} was received. Reference: ${ref}. Check its status at ${lookupUrl}`,
        html: `<p>Your registration for <strong>${gameName}</strong> was received.</p><p>Reference: <strong>${safeRef}</strong></p><p><a href="${escapeHtml(lookupUrl)}">Check registration status</a></p>`,
      });
      emailNotice = 'A confirmation email was sent.';
    } catch (error) {
      console.error('Registration confirmation email failed', { ref, error: error.message });
      emailNotice = 'Your registration was saved, but the confirmation email could not be sent. Save your reference number.';
    }
  }
  res.status(201).json({ ref, game: game.name, status: 'pending', emailNotice });
}));

// Public lookup returns only non-private fields
app.get('/api/registrations/:ref', wrap(async (req, res) => {
  const r = await Registration.findOne({ ref: req.params.ref }).populate('game', 'name').lean();
  if (!r) return res.status(404).json({ error: 'Not found' });
  res.json({ ref: r.ref, game: r.game.name, status: r.status, teamName: r.teamName, createdAt: r.createdAt });
}));

// ---------- admin ----------
app.post('/api/admin/login', loginLimiter, wrap(async (req, res) => {
  const { email, password } = req.body || {};
  const a = await Admin.findOne({ email: String(email || '').toLowerCase() });
  if (!a || !(await bcrypt.compare(String(password || ''), a.passwordHash)))
    return res.status(401).json({ error: 'Invalid email or password' });
  const token = jwt.sign({ id: a._id, email: a.email, role: a.role }, secret(), { expiresIn: '8h' });
  await AuditLog.create({ admin: a.email, action: 'login' });
  res.json({ token, role: a.role });
}));

const admin = express.Router();
admin.use(requireAdmin());

admin.get('/stats', wrap(async (_, res) => {
  const total = await Registration.countDocuments();
  const byGame = await Registration.aggregate([
    { $group: { _id: '$game', count: { $sum: 1 } } },
    { $lookup: { from: 'games', localField: '_id', foreignField: '_id', as: 'g' } },
    { $project: { name: { $arrayElemAt: ['$g.name', 0] }, count: 1 } },
  ]);
  const byStatus = await Registration.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
  res.json({ total, byGame, byStatus });
}));

admin.get('/integrations', (_, res) => res.json({
  email: isEmailConfigured(),
  ai: Boolean(process.env.AI_API_KEY),
}));

const buildQuery = (q) => {
  const f = {};
  if (q.game) f.game = q.game;
  if (q.status) f.status = q.status;
  if (q.search) {
    const rx = new RegExp(String(q.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    f.$or = [{ ref: rx }, { 'leader.name': rx }, { rollNos: rx }, { teamName: rx }];
  }
  return f;
};

admin.get('/registrations', wrap(async (req, res) => {
  const page = Math.max(1, +req.query.page || 1), limit = 20;
  const f = buildQuery(req.query);
  const [items, total] = await Promise.all([
    Registration.find(f).populate('game', 'name').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Registration.countDocuments(f),
  ]);
  res.json({ items, total, pages: Math.ceil(total / limit) });
}));

admin.patch('/registrations/:id/status', wrap(async (req, res) => {
  const { status } = z.object({ status: z.enum(['pending', 'confirmed', 'rejected', 'cancelled']) }).parse(req.body);
  const r = await Registration.findByIdAndUpdate(req.params.id,
    { status, $push: { history: { status, by: req.admin.email } } }, { new: true });
  if (!r) return res.status(404).json({ error: 'Not found' });
  await audit(req, 'registration.status', r.ref, { status });
  res.json(r);
}));

admin.get('/export', wrap(async (req, res) => {
  const rows = await Registration.find(buildQuery(req.query)).populate('game', 'name').sort({ createdAt: -1 }).lean();
  const flat = rows.map((r) => ({
    Reference: r.ref, Game: r.game?.name, Type: r.type, Team: r.teamName || '', Name: r.leader.name,
    RollNo: r.leader.rollNo, Department: r.leader.department, Year: r.leader.year, Phone: r.leader.phone,
    Email: r.email, Members: r.members.map((m) => `${m.name} (${m.rollNo})`).join('; '),
    Status: r.status, Registered: r.createdAt.toISOString(),
  }));
  await audit(req, 'export', req.query.format || 'csv', { count: flat.length });
  if (req.query.format === 'xlsx') {
    const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('Registrations');
    ws.columns = Object.keys(flat[0] || { Reference: 1 }).map((k) => ({ header: k, key: k, width: 20 }));
    ws.addRows(flat);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=registrations.xlsx');
    return res.send(Buffer.from(await wb.xlsx.writeBuffer()));
  }
  const cell = (v) => { let s = String(v ?? ''); if (/^[=+\-@]/.test(s)) s = "'" + s; return `"${s.replace(/"/g, '""')}"`; };
  const keys = Object.keys(flat[0] || { Reference: 1 });
  const csv = [keys.join(','), ...flat.map((r) => keys.map((k) => cell(r[k])).join(','))].join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=registrations.csv');
  res.send(csv);
}));

admin.post('/ai/rules', aiLimiter, wrap(async (req, res) => {
  const input = z.object({
    game: z.object({
      name: z.string().trim().min(2).max(120),
      category: z.string().max(120).optional(),
      type: z.enum(['individual', 'team']),
      format: z.string().max(2000).optional(),
      teamSize: z.object({ min: z.number().int().min(1), max: z.number().int().min(1) }).optional(),
      rules: z.array(z.object({ title: z.string().max(100), body: z.string().max(2500) })).max(20).optional(),
    }),
    prompt: z.string().trim().min(3).max(1200),
    history: z.array(z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string().max(2500),
    })).max(8).default([]),
  }).parse(req.body);
  if (!process.env.AI_API_KEY) return res.status(503).json({ error: 'AI rules assistant is not configured on the server.' });
  if (input.game.type === 'team' && input.game.teamSize && input.game.teamSize.min > input.game.teamSize.max)
    return res.status(400).json({ error: 'Minimum team size cannot exceed maximum team size.' });

  const responseSchema = z.object({
    reply: z.string().min(1).max(2500),
    rules: z.array(z.object({
      title: z.string().trim().min(1).max(100),
      body: z.string().trim().min(1).max(2500),
    })).max(20),
  });
  const endpoint = process.env.AI_API_URL || 'https://api.openai.com/v1/chat/completions';
  let upstream;
  try {
    upstream = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.AI_API_KEY}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(30000),
      body: JSON.stringify({
        model: process.env.AI_MODEL || 'gpt-4o-mini',
        temperature: 0.3,
        max_tokens: 3000,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'You are a drafting assistant for intramural sports organizers. Help create clear, practical game-rule sections from the organizer request. Treat all generated rules as drafts, never claim they are official or verified. Do not invent institution policies, dates, eligibility rules, safety standards, or legal requirements; ask the organizer to confirm unknown details. Return only JSON with shape {"reply":"brief helpful response","rules":[{"title":"section title","body":"rule text"}]}. Keep rules concise and use an empty rules array when clarification is needed.',
          },
          ...input.history.map(({ role, content }) => ({ role, content })),
          {
            role: 'user',
            content: JSON.stringify({
              game: { ...input.game, currentDraftRules: input.game.rules || [] },
              instruction: input.prompt,
            }),
          },
        ],
      }),
    });
  } catch (error) {
    console.error('AI rules provider request failed', { error: error.message });
    return res.status(502).json({ error: 'The AI provider could not be reached. Please try again.' });
  }
  if (!upstream.ok) {
    console.error('AI rules provider returned an error', { status: upstream.status });
    return res.status(502).json({ error: 'The AI provider could not draft rules. Please try again.' });
  }
  let parsed;
  try {
    const data = await upstream.json();
    const content = data.choices?.[0]?.message?.content;
    parsed = responseSchema.parse(JSON.parse(content));
  } catch (error) {
    console.error('AI rules provider returned an invalid response', { error: error.message });
    return res.status(502).json({ error: 'The AI provider returned an invalid draft. Please try again.' });
  }
  res.json(parsed);
}));

admin.post('/reminders', reminderLimiter, wrap(async (req, res) => {
  if (!isEmailConfigured()) return res.status(503).json({ error: 'SMTP email is not configured on the server.' });
  const input = z.object({ gameId: z.string().regex(/^[a-f\d]{24}$/i).optional() }).parse(req.body || {});
  const filter = { status: 'pending', email: { $type: 'string', $ne: '' } };
  if (input.gameId) filter.game = input.gameId;
  const registrations = await Registration.find(filter)
    .populate('game', 'name')
    .sort({ createdAt: -1 })
    .limit(501)
    .lean();
  if (registrations.length > 500) return res.status(413).json({ error: 'More than 500 pending registrations match. Choose a game to send a smaller batch.' });

  let sent = 0;
  let failed = 0;
  for (const registration of registrations) {
    try {
      await sendEmail({
        to: registration.email,
        subject: `Registration reminder: ${registration.game?.name || 'Intramurals'}`,
        text: `Your registration ${registration.ref} for ${registration.game?.name || 'Intramurals'} is still pending. Please contact the organizers if you need help.`,
        html: `<p>Your registration <strong>${escapeHtml(registration.ref)}</strong> for <strong>${escapeHtml(registration.game?.name || 'Intramurals')}</strong> is still pending.</p><p>Please contact the organizers if you need help.</p>`,
      });
      sent++;
    } catch (error) {
      failed++;
      console.error('Registration reminder email failed', { ref: registration.ref, error: error.message });
    }
  }
  await audit(req, 'registration.reminder', input.gameId || 'all games', { sent, failed });
  res.json({ attempted: registrations.length, sent, failed });
}));

const gameZ = z.object({
  name: z.string().trim().min(2),
  category: z.string().default(''),
  type: z.enum(['individual', 'team']),
  teamSize: z.object({ min: z.number().int().min(1), max: z.number().int().min(1) }).default({ min: 1, max: 1 }),
  format: z.string().default(''),
  imageUrl: z.string().default(''),
  rules: z.array(z.object({ title: z.string().max(100), body: z.string().max(2500) })).max(20).default([]),
  registrationOpen: z.boolean().default(true),
  deadline: z.string().nullable().optional(),
  capacity: z.number().int().positive().nullable().optional(),
}).superRefine((game, context) => {
  if (game.type === 'team' && game.teamSize.min > game.teamSize.max) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['teamSize'], message: 'Minimum team size cannot exceed maximum team size' });
  }
  if (game.deadline && Number.isNaN(Date.parse(game.deadline))) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['deadline'], message: 'Enter a valid registration deadline' });
  }
});
const settingsZ = z.object({
  college: z.string().max(160),
  department: z.string().max(160),
  title: z.string().trim().min(1).max(120),
  startDate: z.string().max(80),
  slogan: z.array(z.string().max(80)).max(8),
  houses: z.array(z.object({ name: z.string().max(120), years: z.string().max(80) })).max(12),
  contacts: z.object({
    phones: z.array(z.string().max(40)).max(10),
    email: z.string().email().or(z.literal('')),
    instagram: z.string().url().or(z.literal('')),
    other: z.string().max(500),
  }),
  announcements: z.array(z.string().max(500)).max(50),
  registrationDeadline: z.string().max(80).nullable(),
});

admin.post('/games', wrap(async (req, res) => {
  const d = gameZ.parse(req.body);
  const g = await Game.create({ ...d, slug: slugify(d.name) });
  await audit(req, 'game.create', g.name);
  res.status(201).json(g);
}));
admin.put('/games/:id', wrap(async (req, res) => {
  const d = gameZ.parse(req.body);
  const g = await Game.findByIdAndUpdate(req.params.id, { ...d, slug: slugify(d.name) }, { new: true });
  if (!g) return res.status(404).json({ error: 'Not found' });
  await audit(req, 'game.update', g.name);
  res.json(g);
}));
admin.delete('/games/:id', requireAdmin(['superadmin']), wrap(async (req, res) => {
  if (await Registration.exists({ game: req.params.id }))
    return res.status(409).json({ error: 'Game has registrations. Close registration instead of deleting.' });
  const g = await Game.findByIdAndDelete(req.params.id);
  await audit(req, 'game.delete', g?.name);
  res.json({ ok: true });
}));

admin.put('/settings', wrap(async (req, res) => {
  const value = settingsZ.parse({
    ...defaultSettings,
    ...req.body,
    contacts: { ...defaultSettings.contacts, ...(req.body?.contacts || {}) },
  });
  await Settings.findOneAndUpdate({ key: 'event' }, { value }, { upsert: true });
  await audit(req, 'settings.update', 'event');
  res.json(value);
}));
admin.get('/audit', wrap(async (_, res) => res.json(await AuditLog.find().sort({ createdAt: -1 }).limit(100))));
app.use('/api/admin', admin);

app.use('/api', (_, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, _next) => {
  if (err instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed', issues: err.flatten() });
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});
