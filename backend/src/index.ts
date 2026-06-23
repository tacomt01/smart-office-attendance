import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import authRoutes from './routes/auth.routes.js';
import uploadRoutes from './routes/upload.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import chatRoutes from './routes/chat.routes.js';
import usersRoutes from './routes/users.routes.js';
import profileRoutes from './routes/profile.routes.js';
import dataRoutes from './routes/data.routes.js';

dotenv.config();

if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'change-this-secret-in-production') {
  console.warn('⚠️  WARNING: Set a strong JWT_SECRET in .env for production use');
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:3000'], credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/data', dataRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err: any, _req: any, res: any, _next: any) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
