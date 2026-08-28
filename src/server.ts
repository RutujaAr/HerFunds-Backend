import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { GoogleGenAI } from '@google/genai';
import pool from './config/db.js';
import aiRoutes from './routes/ai.routes';

// Simulation routes
import simulationRoutes from './routes/simulationRoutes.js';

dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const app = express();
const PORT = process.env.PORT || 5000;

// 🌐 Middleware Configuration
app.use(cors({
  origin: '*', // Allows requests from any origin during development
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// 🤖 AI Chatbot Routes
app.use('/api/ai', aiRoutes);


// 🔑 INITIALIZE GOOGLE AUTH CLIENT

const GOOGLE_CLIENT_ID =
  "1058256639702-ui0bbo682f3itque8029bf8qcrdbdnc1.apps.googleusercontent.com";

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);


// 📝 1. MANUAL USER REGISTRATION ENDPOINT

app.post('/api/auth/register', async (req, res) => {
  const {
    name,
    email,
    password,
    knowledgeLevel,
  } = req.body;

  try {
    const userExists = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (userExists.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Email is already registered.',
      });
    }

    const salt = await bcrypt.genSalt(10);

    const hashedPassword =
      await bcrypt.hash(password, salt);

    const newUser = await pool.query(
      `
      INSERT INTO users
      (name, email, password, knowledge_level)
      VALUES ($1, $2, $3, $4)
      RETURNING id, name, email
      `,
      [
        name,
        email,
        hashedPassword,
        knowledgeLevel || 'Beginner',
      ]
    );

    const token = jwt.sign(
      {
        id: newUser.rows[0].id,
      },
      process.env.JWT_SECRET || 'secret',
      {
        expiresIn: '24h',
      }
    );

    res.status(201).json({
      success: true,
      message: 'Account created successfully!',
      token,
      user: newUser.rows[0],
    });

  } catch (error) {

    const errorMessage =
      error instanceof Error
        ? error.message
        : String(error);

    console.error(
      'Registration Error:',
      errorMessage
    );

    res.status(500).json({
      success: false,
      message:
        'Server error processing registration.',
    });
  }
});


// 🌐 2. MOBILE GOOGLE SIGN-IN / SIGN-UP ENDPOINT

app.post('/api/auth/google', async (req, res) => {

  const { token } = req.body;

  try {

    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: [
        "1058256639702-kf6keqod679iifii1jvudn89r9f3e621.apps.googleusercontent.com", // Web Client ID
        "1058256639702-ui0bbo682f3itque8029bf8qcrdbdnc1.apps.googleusercontent.com", // Android Client ID
        "1058256639702-u2ns0js02n7srtqp1l6oo5sqhjj66gvq.apps.googleusercontent.com"  
      ],
    });

      const payload =
      ticket.getPayload();

    if (!payload) {

      return res.status(400).json({
        success: false,
        message:
          'Invalid Google token payload.',
      });
    }

    const {
      name,
      email,
    } = payload;

    let userResult =
      await pool.query(
        'SELECT * FROM users WHERE email = $1',
        [email]
      );

    let user =
      userResult.rows[0];

    if (!user) {

      const placeholderPassword =
        await bcrypt.hash(
          Math.random().toString(36),
          10
        );

      const newUser =
        await pool.query(
          `
          INSERT INTO users
          (name, email, password, knowledge_level)
          VALUES ($1, $2, $3, $4)
          RETURNING id, name, email
          `,
          [
            name,
            email,
            placeholderPassword,
            'Beginner',
          ]
        );

      user =
        newUser.rows[0];
    }

    const sessionToken =
      jwt.sign(
        {
          id: user.id,
        },
        process.env.JWT_SECRET || 'secret',
        {
          expiresIn: '24h',
        }
      );

    res.status(200).json({

      success: true,

      message:
        'Google Sign-In successful!',

      token: sessionToken,

      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });

  } catch (error) {

    const errorMessage =
      error instanceof Error
        ? error.message
        : String(error);

    console.error(
      'Google Auth Error:',
      errorMessage
    );

    res.status(500).json({
      success: false,
      message:
        'Google authentication processing error.',
    });
  }
});


// 🩺 3. DATABASE HEALTH CHECK ENDPOINT

app.get('/api/health', async (req, res) => {

  try {

    const dbCheck =
      await pool.query(
        'SELECT NOW()'
      );

    res.json({
      status: 'Online',
      databaseTime:
        dbCheck.rows[0].now,
    });

  } catch (err) {

    res.status(500).json({
      status: 'Database Error',
      error: err,
    });
  }
});

// 📚 4. GET ALL LEARNING MODULES ENDPOINT
app.get('/api/modules', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT module_id, title, description, module_order FROM public.modules ORDER BY module_order ASC'
    );
    
    const formattedModules = result.rows.map(m => ({
      id: m.module_id,
      title: m.title,
      description: m.description,
      module_order: m.module_order
    }));

    res.status(200).json({
      success: true,
      modules: formattedModules
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Fetch Modules Error Details:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch learning modules.', error: errorMessage });
  }
});

// 📖 5. GET LESSONS FOR A SPECIFIC MODULE
app.get('/api/modules/:moduleId/lessons', async (req, res) => {
  const { moduleId } = req.params;
  try {
    const result = await pool.query(
      'SELECT * FROM public.lessons WHERE module_id = $1 ORDER BY lesson_order ASC',
      [moduleId]
    );

    const formattedLessons = result.rows.map(l => ({
      id: l.lesson_id,
      module_id: l.module_id,
      title: l.title,
      summary: l.summary,
      content: l.content,
      duration: l.duration,
      difficulty: l.difficulty,
      lesson_order: l.lesson_order
    }));

    res.status(200).json({
      success: true,
      lessons: formattedLessons
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Fetch Lessons Error Details:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch lessons.', error: errorMessage });
  }
});

// 🎯 6. SUBMIT MODULE QUIZ SCORE ENDPOINT
app.post('/api/modules/:moduleId/quiz-submit', async (req, res) => {
  const { moduleId } = req.params;
  const { score, total } = req.body;

  try {
    console.log(`Quiz submitted for Module ${moduleId}: ${score}/${total}`);
    
    // Future database logging logic can be added here if needed

    res.status(200).json({
      success: true,
      message: 'Quiz score submitted successfully!',
      score,
      total
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Quiz Submission Error:', errorMessage);
    res.status(500).json({
      success: false,
      message: 'Failed to record quiz score.'
    });
  }
});


// 🤖 7. HERFUNDS AI CHAT ENDPOINT

app.post('/api/ai/chat', async (req, res) => {

  const {
    message,
  } = req.body;

  if (
    !message ||
    typeof message !== 'string'
  ) {

    return res.status(400).json({
      success: false,
      message:
        'Please provide a valid message.',
    });
  }

  try {

    const systemInstruction = `
You are HerFunds AI, the financial literacy assistant inside the HerFunds application.

Your purpose is to educate users about:
- Personal finance
- Saving and budgeting
- Banking
- Digital payments and financial safety
- Investments and basic financial concepts
- Loans and EMIs
- Taxation
- Government financial schemes
- Financial planning concepts

Rules:
1. Explain financial concepts in simple language suitable for beginners.
2. Be supportive, clear and non-judgmental.
3. Use Indian financial context when relevant, including ₹, UPI, SIP, CIBIL, RBI, etc.
4. Do not pretend to be a personal financial advisor.
5. Do not guarantee investment returns or tell users that a specific investment will definitely make money.
6. For personalized investment decisions, explain the factors the user should consider and recommend consulting a qualified financial professional when appropriate.
7. If the question is unrelated to finance or financial literacy, politely explain that you are designed primarily for HerFunds financial education.
8. Keep normal answers concise and easy to understand.
9. Use examples when they make a concept easier to understand.
`;

    const response =
      await ai.models.generateContent({

        model:
          'gemini-3.6-flash',

        contents: `
${systemInstruction}

User question:
${message}
`,
      });

    const reply =
      response.text ||
      'I could not generate a response right now. Please try again.';

    return res.status(200).json({

      success: true,

      reply,
    });

  } catch (error) {

    console.error(
      'HerFunds AI Error:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'HerFunds AI could not process your request.',
    });
  }
});


// 🎮 8. GAMIFIED FINANCIAL SIMULATIONS

app.use(
  '/api/simulations',
  simulationRoutes
);


// 🚀 START SERVER LISTENING

const serverPort =
  Number(PORT) || 5000;

app.listen(
  serverPort,
  '0.0.0.0',
  () => {

    console.log(
      `HerFunds Backend running cleanly on port ${serverPort} across all adapters`
    );

  }
);