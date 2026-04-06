import dotenv from 'dotenv';
dotenv.config();

import app from './server';
import { connectDb } from './lib/db';

const PORT = process.env.PORT ? Number(process.env.PORT) : 5000;

const start = async () => {
  await connectDb();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
