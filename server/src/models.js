import mongoose from 'mongoose';
const { Schema, model } = mongoose;

const Admin = model('Admin', new Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['superadmin', 'organizer'], default: 'organizer' },
}, { timestamps: true }));

const Game = model('Game', new Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  category: { type: String, default: '' },
  type: { type: String, enum: ['individual', 'team'], required: true },
  teamSize: { min: { type: Number, default: 1 }, max: { type: Number, default: 1 } },
  format: { type: String, default: '' },
  imageUrl: { type: String, default: '' },
  rules: [{ title: String, body: String }],
  registrationOpen: { type: Boolean, default: true },
  deadline: Date,
  capacity: Number,
}, { timestamps: true }));

const personSchema = new Schema({
  name: String, rollNo: String, department: String, year: String, phone: String,
}, { _id: false });

const regSchema = new Schema({
  ref: { type: String, required: true, unique: true },
  game: { type: Schema.Types.ObjectId, ref: 'Game', required: true },
  type: { type: String, enum: ['individual', 'team'], required: true },
  teamName: String,
  leader: personSchema,
  email: String,
  members: [personSchema],
  rollNos: [String], // all participants; unique per game
  status: { type: String, enum: ['pending', 'confirmed', 'rejected', 'cancelled'], default: 'pending' },
  history: [{ status: String, by: String, at: { type: Date, default: Date.now } }],
}, { timestamps: true });
// Multikey unique index: a roll number can appear only once per game, across all registrations.
regSchema.index({ game: 1, rollNos: 1 }, { unique: true });
const Registration = model('Registration', regSchema);

const Settings = model('Settings', new Schema({
  key: { type: String, unique: true },
  value: Schema.Types.Mixed,
}));

const AuditLog = model('AuditLog', new Schema({
  admin: String, action: String, target: String, detail: Schema.Types.Mixed,
}, { timestamps: true }));

export { Admin, Game, Registration, Settings, AuditLog };
