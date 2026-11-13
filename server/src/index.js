import 'dotenv/config';
import mongoose from 'mongoose';
import { app } from './app.js';
if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET missing');
await mongoose.connect(process.env.MONGO_URI);
await mongoose.syncIndexes();
app.listen(process.env.PORT || 5000, () => console.log('API running'));
