import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { initDatabase } from './config/database.js';

dotenv.config();

const app = express();

// ✅ إعدادات CORS
app.use(cors({
  origin: [
    'https://thewebvalue.com',
    'http://localhost:3000',
    'http://localhost:8000'
  ],
  credentials: true
}));

// ✅ الحماية
app.use(helmet());

// ✅ تحديد معدل الطلبات
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use(limiter);

// ✅ التعامل مع البيانات
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ مسارات أساسية
app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));
app.get('/', (req, res) => res.send('🎯 Web Value Task Management API is running'));
app.get('/debug', (req, res) => res.json({ status: 'Server is running', timestamp: new Date() }));

// ✅ استيراد وربط المسارات
import authRoutes from './routes/auth.routes.js';
import taskRoutes from './routes/task.routes.js';
import adminRoutes from './routes/admin.routes.js';

app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/admin', adminRoutes);

// ✅ تسجيل كل الطلبات
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// ✅ معالجة الأخطاء
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal Server Error',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
});

// ✅ بدء الخادم
const PORT = process.env.PORT || 3000;
const startServer = async () => {
  try {
    await initDatabase();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

