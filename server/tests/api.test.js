import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
process.env.JWT_SECRET = 'test-secret';
delete process.env.AI_API_KEY;
delete process.env.SMTP_HOST;
delete process.env.SMTP_FROM;
const { app } = await import('../src/app.js');
const { Game, Admin, Registration } = await import('../src/models.js');
const { escapeHtml } = await import('../src/mailer.js');

const person = (roll) => ({ name: 'Test User', rollNo: roll, department: 'CSE', year: '2', phone: '9876543210' });
let game, team, token;

beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI_TEST);
  await mongoose.connection.dropDatabase();
  await Registration.syncIndexes();
  game = await Game.create({ name: 'G1', slug: 'g1', type: 'individual' });
  team = await Game.create({ name: 'T1', slug: 't1', type: 'team', teamSize: { min: 2, max: 3 } });
  await Admin.create({ email: 'a@x.com', passwordHash: await bcrypt.hash('pass12345', 4), role: 'superadmin' });
  token = (await request(app).post('/api/admin/login').send({ email: 'a@x.com', password: 'pass12345' })).body.token;
});
afterAll(() => mongoose.disconnect());

describe('registration', () => {
  it('rejects invalid input', async () => {
    const r = await request(app).post('/api/registrations').send({ gameId: String(game._id), email: 'bad', leader: person('x') });
    expect(r.status).toBe(400);
  });
  it('creates and persists a registration', async () => {
    const r = await request(app).post('/api/registrations').send({ gameId: String(game._id), email: 'a@b.com', leader: person('22PW01') });
    expect(r.status).toBe(201);
    expect(r.body.emailNotice).toMatch(/not configured/i);
    expect(await Registration.countDocuments({ ref: r.body.ref })).toBe(1);
  });
  it('prevents duplicates', async () => {
    const r = await request(app).post('/api/registrations').send({ gameId: String(game._id), email: 'a@b.com', leader: person('22PW01') });
    expect(r.status).toBe(409);
  });
  it('enforces team size', async () => {
    const r = await request(app).post('/api/registrations').send({ gameId: String(team._id), teamName: 'Tigers', email: 'a@b.com', leader: person('22PW02') });
    expect(r.status).toBe(400);
  });
});
describe('authorization', () => {
  it('blocks admin routes without token', async () => {
    expect((await request(app).get('/api/admin/stats')).status).toBe(401);
  });
  it('allows admin with token', async () => {
    expect((await request(app).get('/api/admin/stats').set('Authorization', `Bearer ${token}`)).status).toBe(200);
  });
  it('public lookup hides private data', async () => {
    const reg = await Registration.findOne();
    const r = await request(app).get(`/api/registrations/${reg.ref}`);
    expect(r.body.leader).toBeUndefined();
    expect(r.body.email).toBeUndefined();
    expect(r.body.game).toBe('G1');
  });
});
describe('organizer integrations', () => {
  it('reports whether optional services are configured without exposing credentials', async () => {
    const r = await request(app).get('/api/admin/integrations').set('Authorization', `Bearer ${token}`);
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ email: false, ai: false });
  });
  it('explains when the rules assistant has not been configured', async () => {
    const r = await request(app).post('/api/admin/ai/rules').set('Authorization', `Bearer ${token}`).send({
      game: { name: 'G1', type: 'individual' }, prompt: 'Draft scoring rules',
    });
    expect(r.status).toBe(503);
  });
  it('does not attempt reminders when SMTP is unavailable', async () => {
    const r = await request(app).post('/api/admin/reminders').set('Authorization', `Bearer ${token}`).send({});
    expect(r.status).toBe(503);
  });
  it('escapes HTML values used in outgoing email', () => {
    expect(escapeHtml('<script>"&</script>')).toBe('&lt;script&gt;&quot;&amp;&lt;/script&gt;');
  });
});
describe('organizer content management', () => {
  it('rejects team games with an impossible team-size range', async () => {
    const r = await request(app).post('/api/admin/games').set('Authorization', `Bearer ${token}`).send({
      name: 'Invalid Team Game', type: 'team', teamSize: { min: 5, max: 2 },
    });
    expect(r.status).toBe(400);
  });
  it('validates and saves public event settings', async () => {
    const valid = await request(app).put('/api/admin/settings').set('Authorization', `Bearer ${token}`).send({ title: 'Test intramurals' });
    expect(valid.status).toBe(200);
    expect(valid.body.title).toBe('Test intramurals');

    const invalid = await request(app).put('/api/admin/settings').set('Authorization', `Bearer ${token}`).send({ contacts: { email: 'not-an-email' } });
    expect(invalid.status).toBe(400);
  });
});
