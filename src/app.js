const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const errorMiddleware = require('./middleware/error.middleware');

const authRoutes = require('./routes/auth.routes');
const quizRoutes = require('./routes/quiz.routes');

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false,
}));
app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 2000,                    // 20 requests per window per IP
  message: { success: false, error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/v1/auth', authLimiter, authRoutes);
app.use('/api/v1/quizzes', quizRoutes);

app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' })
})

app.use(errorMiddleware);

module.exports = app;
