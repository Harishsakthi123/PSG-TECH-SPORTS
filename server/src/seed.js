import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { Admin, Game, Settings } from './models.js';
import { defaultSettings } from './defaults.js';

await mongoose.connect(process.env.MONGO_URI);
await mongoose.syncIndexes();
const email = process.env.ADMIN_EMAIL, pw = process.env.ADMIN_PASSWORD;
if (!email || !pw) throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD');
await Admin.findOneAndUpdate({ email: email.toLowerCase() },
  { passwordHash: await bcrypt.hash(pw, 12), role: 'superadmin' }, { upsert: true });
await Settings.findOneAndUpdate({ key: 'event' }, { $setOnInsert: { value: defaultSettings } }, { upsert: true });
if (process.argv.includes('--sample')) {
  // SAMPLE DEV DATA ONLY - not organizer information
  await Game.findOneAndUpdate({ slug: 'sample-individual' }, { name: 'Sample Individual Game', slug: 'sample-individual', type: 'individual', format: 'Sample format', rules: [{ title: 'Sample rule', body: 'Replace with official rules.' }] }, { upsert: true });
  await Game.findOneAndUpdate({ slug: 'sample-team' }, { name: 'Sample Team Game', slug: 'sample-team', type: 'team', teamSize: { min: 2, max: 4 }, format: 'Sample format', rules: [] }, { upsert: true });
}
console.log('Seed done');
await mongoose.disconnect();
