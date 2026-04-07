import express from 'express';
import cors from 'cors';
import path from 'path';

import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import productRoutes from './routes/products';
import categoryRoutes from './routes/categories';
import orderRoutes from './routes/orders';
import paymentRoutes from './routes/payments';
import settingsRoutes from './routes/settings';
import uploadRoutes from './routes/upload';
import payuRoutes from './routes/payu';
import upiRoutes from './routes/upi';
import cartRoutes from './routes/cart';
import heroSlidesRoutes from './routes/heroSlides';

const app = express();

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/payu', payuRoutes);
app.use('/api/upi', upiRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/hero-slides', heroSlidesRoutes);

app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
});

export default app;
