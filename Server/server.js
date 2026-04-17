import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import productRoutes from './routes/productRoutes.js';
import userRoutes from './routes/userRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import { notFound, errorHandler } from './middleware/errorMiddleware.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = Number(process.env.PORT) || 5000;

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(cors({
  origin: ['https://maisonheera.vercel.app', 'http://localhost:5173', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true
}));
app.use(express.json());

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

if (process.env.MONGO_URI) {
  mongoose
    .connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB Connected'))
    .catch((error) => console.error('MongoDB connection failed:', error.message));
} else {
  console.warn('MONGO_URI is not set. API will run without database connectivity.');
}

app.use('/api/products', productRoutes);
app.use('/api/users', apiLimiter, userRoutes);
app.use('/api/orders', orderRoutes);

app.get('/api', (req, res) => {
  res.send('API Running');
});

app.get('/api/databases', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
      return res.status(503).json({ message: 'Database is not connected' });
    }

    const adminDb = mongoose.connection.db.admin();
    const databases = await adminDb.listDatabases();
    return res.json(databases);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.use(notFound);
app.use(errorHandler);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// Trigger nodemon restart to load new environment variables
