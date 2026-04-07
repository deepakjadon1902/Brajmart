import dotenv from 'dotenv';
dotenv.config();

import bcrypt from 'bcryptjs';
import { connectDb, isDbConnected, dbQuery, dbExecute } from '../src/lib/db';

const run = async () => {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME || 'Admin';
  const forceSingle = String(process.env.ADMIN_FORCE_SINGLE || 'true').toLowerCase() !== 'false';

  if (!email || !password) {
    console.error('ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env');
    process.exit(1);
  }

  await connectDb();
  if (!isDbConnected()) {
    console.error('Database not connected. Check DB credentials.');
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 12);
  const existing = await dbQuery<any>('SELECT id FROM admins WHERE email = ? LIMIT 1', [email]);

  if (forceSingle) {
    await dbExecute('UPDATE admins SET status = ? WHERE email <> ?', ['blocked', email]);
  }

  if (existing.length) {
    await dbExecute('UPDATE admins SET name = ?, password = ?, status = ? WHERE id = ?', [name, hash, 'active', existing[0].id]);
    console.log(`Admin updated: ${email}`);
  } else {
    await dbExecute('INSERT INTO admins (name, email, password, status) VALUES (?, ?, ?, ?)', [name, email, hash, 'active']);
    console.log(`Admin created: ${email}`);
  }

  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
