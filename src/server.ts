
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { GoogleGenAI } from '@google/genai';

import pool, { initDB } from './config/db.js';
import aiRoutes from './routes/ai.routes.js';
import simulationRoutes from './routes/simulationRoutes.js';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 5000;

// Required environment variables
const requiredEnv = [
  'DATABASE_URL',
  'GEMINI_API_KEY',
  'JWT_SECRET',
  'GOOGLE_CLIENT_ID',
];

for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const JWT_SECRET = process.env.JWT_SECRET!;
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID!);
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

// Google client IDs accepted as token audiences
const googleAudiences = [
  process.env.GOOGLE_CLIENT_ID!,
  ...(process.env.GOOGLE_CLIENT_IDS || '')
    .split(',')
    .map(id => id.trim())
    .filter(Boolean),
];

app.use(cors({
  origin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
    : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '1mb' }));

// Basic server status
app.get('/', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'HerFunds Backend is running',
  });
});

// Health check including database connectivity
app.get('/api/health', async (_req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');

    res.status(200).json({
      status: 'Online',
      database: 'Connected',
      databaseTime: result.rows[0].now,
    });
  } catch (error) {
    console.error('Health check database error:', error);

    res.status(503).json({
      status: 'Database Error',
      database: 'Disconnected',
    });
  }
});

// Daily financial tips
const FINANCIAL_TIPS = [
  {
    id: 1,
    tip: 'Maintain an emergency fund for unexpected expenses.',
    category: 'Emergency Fund',
  },
  {
    id: 2,
    tip: 'SIP investments can help build a regular investing habit.',
    category: 'SIP Investment',
  },
  {
    id: 3,
    tip: 'Keep your credit utilisation low to help maintain a healthy credit profile.',
    category: 'Credit Score',
  },
  {
    id: 4,
    tip: 'Understand applicable TDS rules for your income and transactions.',
    category: 'Tax Compliance',
  },
  {
    id: 5,
    tip: 'Check whether you are eligible for applicable tax deductions.',
    category: 'Tax Saving',
  },
  {
    id: 6,
    tip: 'Understand the tax benefits and limits applicable to your chosen tax regime.',
    category: 'Tax Regime',
  },
  {
    id: 7,
    tip: 'Review your budget and savings contributions regularly.',
    category: 'Smart Saving',
  },
];

app.get('/api/daily-tips', (_req, res) => {
  const day = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) /
    86400000
  );

  const currentTip = FINANCIAL_TIPS[day % FINANCIAL_TIPS.length];

  res.json({
    success: true,
    dailyTip: currentTip,
    allTips: FINANCIAL_TIPS,
  });
});

// Manual registration
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, knowledgeLevel } = req.body;

  if (
    typeof name !== 'string' ||
    typeof email !== 'string' ||
    typeof password !== 'string' ||
    !name.trim() ||
    !email.trim() ||
    password.length < 8
  ) {
    return res.status(400).json({
      success: false,
      message: 'Valid name, email, and password of at least 8 characters are required.',
    });
  }

  try {
    const existing = await pool.query(
      'SELECT id FROM public.users WHERE email = $1',
      [email.trim().toLowerCase()]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Email is already registered.',
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `INSERT INTO public.users (name, email, password, knowledge_level)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email`,
      [
        name.trim(),
        email.trim().toLowerCase(),
        hashedPassword,
        knowledgeLevel || 'Beginner',
      ]
    );

    const user = result.rows[0];

    const token = jwt.sign(
      { id: user.id },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      token,
      user,
    });
  } catch (error) {
    console.error('Registration error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to register user.',
    });
  }
});

// Google Sign-In
app.post('/api/auth/google', async (req, res) => {
  const { token } = req.body;

  if (typeof token !== 'string' || !token) {
    return res.status(400).json({
      success: false,
      message: 'Google ID token is required.',
    });
  }

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: googleAudiences,
    });

    const payload = ticket.getPayload();

    if (!payload || !payload.email || !payload.email_verified) {
      return res.status(401).json({
        success: false,
        message: 'Google account verification failed.',
      });
    }

    const name = payload.name || 'Google User';
    const email = payload.email.toLowerCase();

    let result = await pool.query(
      `SELECT id, name, email
       FROM public.users
       WHERE email = $1`,
      [email]
    );

    let user = result.rows[0];

    if (!user) {
      const placeholderPassword = await bcrypt.hash(
        `${Date.now()}-${Math.random()}`,
        12
      );

      result = await pool.query(
        `INSERT INTO public.users
         (name, email, password, knowledge_level)
         VALUES ($1, $2, $3, $4)
         RETURNING id, name, email`,
        [name, email, placeholderPassword, 'Beginner']
      );

      user = result.rows[0];
    }

    const sessionToken = jwt.sign(
      { id: user.id },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.status(200).json({
      success: true,
      message: 'Google Sign-In successful.',
      token: sessionToken,
      user,
    });
  } catch (error) {
    console.error('Google authentication error:', error);

    return res.status(401).json({
      success: false,
      message: 'Google authentication failed. Please sign in again.',
    });
  }
});

// Learning modules
app.get('/api/modules', async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT module_id, title, description, module_order
       FROM public.modules
       ORDER BY module_order ASC`
    );

    const modules = result.rows.map(module => ({
      id: module.module_id,
      title: module.title,
      description: module.description,
      module_order: module.module_order,
    }));

    return res.json({ success: true, modules });
  } catch (error) {
    console.error('Fetch modules error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch learning modules.',
    });
  }
});

// Banking lessons (Module ID: 5)
app.get('/api/banking-details', async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         lesson_id,
         module_id,
         title,
         summary,
         content,
         duration,
         difficulty,
         lesson_order,
         image_url,
         audio_url,
         video_url
       FROM public.lessons
       WHERE module_id = $1
       ORDER BY lesson_order ASC`,
      [5]
    );

    return res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Fetch banking lessons error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch banking lessons.',
    });
  }
});

// Lessons for a module
app.get('/api/modules/:moduleId/lessons', async (req, res) => {
  const moduleId = Number(req.params.moduleId);

  if (!Number.isInteger(moduleId) || moduleId <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Invalid module ID.',
    });
  }

  try {
    const result = await pool.query(
      `SELECT *
       FROM public.lessons
       WHERE module_id = $1
       ORDER BY lesson_order ASC`,
      [moduleId]
    );

    const lessons = result.rows.map(lesson => ({
      id: lesson.lesson_id,
      module_id: lesson.module_id,
      title: lesson.title,
      summary: lesson.summary,
      content: lesson.content,
      duration: lesson.duration,
      difficulty: lesson.difficulty,
      lesson_order: lesson.lesson_order,
    }));

    return res.json({ success: true, lessons });
  } catch (error) {
    console.error('Fetch lessons error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch lessons.',
    });
  }
});

// Quiz questions for a module
app.get('/api/modules/:moduleId/quiz', async (req, res) => {
  const moduleId = Number(req.params.moduleId);

  if (!Number.isInteger(moduleId) || moduleId <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Invalid module ID.',
    });
  }

  try {
    const result = await pool.query(
      `SELECT question_id, module_id, question_text,
              option_a, option_b, option_c, option_d, correct_option
       FROM public.quiz_questions
       WHERE module_id = $1
       ORDER BY question_id ASC`,
      [moduleId]
    );

    const questions = result.rows.map(question => ({
      id: question.question_id,
      question_id: question.question_id,
      module_id: question.module_id,
      question: question.question_text,
      question_text: question.question_text,
      options: [
        question.option_a,
        question.option_b,
        question.option_c,
        question.option_d,
      ],
      option_a: question.option_a,
      option_b: question.option_b,
      option_c: question.option_c,
      option_d: question.option_d,
      correctOption: question.correct_option,
      correct_option: question.correct_option,
    }));

    return res.json({ success: true, questions });
  } catch (error) {
    console.error('Fetch quiz error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch quiz questions.',
    });
  }
});

// Submit quiz and unlock badge
app.post('/api/modules/:moduleId/quiz-submit', async (req, res) => {
  const moduleId = Number(req.params.moduleId);
  const { userId, score, total } = req.body;

  if (
    !Number.isInteger(moduleId) ||
    moduleId <= 0 ||
    !Number.isFinite(score) ||
    !Number.isFinite(total) ||
    total <= 0 ||
    score < 0 ||
    score > total
  ) {
    return res.status(400).json({
      success: false,
      message: 'Invalid quiz submission.',
    });
  }

  try {
    const passed = score >= Math.ceil(total * 0.6);

    const badgeMap: Record<number, string> = {
      1: 'Finance Basics',
      2: 'Mutual Fund Guide',
      3: 'SIP Learner',
      4: 'Digital Finance User',
      5: 'Banking Essentials',
      6: 'Investment Basics',
      7: 'Tax Awareness',
    };

    const badgeName = passed
      ? badgeMap[moduleId] || 'Smart Investor'
      : null;

    if (passed && userId) {
      await pool.query(
        `INSERT INTO public.user_badges
         (user_id, module_id, badge_name, unlocked_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (user_id, module_id)
         DO UPDATE SET badge_name = EXCLUDED.badge_name`,
        [userId, moduleId, badgeName]
      );
    }

    return res.json({
      success: true,
      message: 'Quiz score submitted successfully.',
      score,
      total,
      badgeUnlocked: passed,
      badgeName,
    });
  } catch (error) {
    console.error('Quiz submission error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to record quiz score.',
    });
  }
});

// User badges
app.get('/api/users/:userId/badges', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT module_id, badge_name, unlocked_at
       FROM public.user_badges
       WHERE user_id = $1
       ORDER BY module_id ASC`,
      [req.params.userId]
    );

    return res.json({
      success: true,
      badges: result.rows,
    });
  } catch (error) {
    console.error('Fetch badges error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch user badges.',
    });
  }
});

// Get user streak
app.get('/api/users/:userId/streak', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT streak_count, last_checkin_date
       FROM public.users
       WHERE id = $1`,
      [req.params.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    const user = result.rows[0];
    const today = new Date().toISOString().split('T')[0];

    const lastCheckin = user.last_checkin_date
      ? new Date(user.last_checkin_date).toISOString().split('T')[0]
      : null;

    return res.json({
      success: true,
      streak: user.streak_count || 0,
      checkedInToday: lastCheckin === today,
    });
  } catch (error) {
    console.error('Fetch streak error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch streak.',
    });
  }
});

// Update user streak
app.post('/api/users/:userId/streak-checkin', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const result = await pool.query(
      `UPDATE public.users
       SET streak_count = COALESCE(streak_count, 0) + 1,
           last_checkin_date = $1
       WHERE id = $2
       RETURNING streak_count`,
      [today, req.params.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    return res.json({
      success: true,
      message: 'Streak updated successfully.',
      streak: result.rows[0].streak_count,
    });
  } catch (error) {
    console.error('Update streak error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to update streak.',
    });
  }
});

// AI chatbot routes
app.use('/api/ai', aiRoutes);

// AI chat endpoint
app.post('/api/ai/chat', async (req, res) => {
  const { message } = req.body;

  if (typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a valid message.',
    });
  }

  try {
    const systemInstruction = `
You are HerFunds AI, a financial literacy assistant.
Explain personal finance, saving, budgeting, banking, digital payments,
investments, loans, taxation and financial planning in simple language.
Use Indian financial context when relevant, including ₹, UPI, SIP,
CIBIL and RBI. Do not guarantee investment returns or pretend to be
a personal financial advisor. Be supportive and concise.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: `${systemInstruction}\n\nUser question:\n${message}`,
    });

    return res.json({
      success: true,
      reply: response.text ||
        'I could not generate a response right now. Please try again.',
    });
  } catch (error) {
    console.error('HerFunds AI error:', error);

    return res.status(500).json({
      success: false,
      message: 'HerFunds AI could not process your request.',
    });
  }
});

// Financial simulations
app.use('/api/simulations', simulationRoutes);

// Handle unknown routes
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: 'API route not found.',
  });
});

// Start only after database connectivity is verified
const startServer = async () => {
  try {
    await initDB();

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`HerFunds Backend running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Backend startup failed: database connection unavailable.');
    process.exit(1);
  }
};

startServer();
