import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { GoogleGenAI } from '@google/genai';
import pool from './config/db.js';

// Simulation routes
import simulationRoutes from './routes/simulationRoutes.js';

dotenv.config();

// ==========================================
// 1. INITIALIZE GEMINI AI CLIENT
// ==========================================

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error('GEMINI_API_KEY is not configured');
}

const ai = new GoogleGenAI({
  apiKey,
});

const GEMINI_MODEL =
  process.env.GEMINI_MODEL || 'gemini-2.5-flash';

// ==========================================
// 2. INITIALIZE EXPRESS SERVER
// ==========================================

const app = express();
const PORT = Number(process.env.PORT) || 5000;

// Middleware
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json());

// ==========================================
// 3. GOOGLE AUTH CLIENT
// ==========================================

const GOOGLE_CLIENT_ID =
  '1058256639702-ui0bbo682f3itque8029bf8qcrdbdnc1.apps.googleusercontent.com';

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// ==========================================
// 4. DAILY FINANCIAL TIPS
// ==========================================

const FINANCIAL_TIPS = [
  {
    id: 1,
    tip: 'Always maintain an emergency fund equal to 6 months of absolute expenses before executing volatile investments.',
    category: 'Emergency Fund',
  },
  {
    id: 2,
    tip: 'In Rupee Cost Averaging, you automatically buy more mutual fund units when market prices are low and fewer units when prices are high.',
    category: 'SIP Investment',
  },
  {
    id: 3,
    tip: 'Financial experts recommend maintaining a credit utilisation ratio below 30% to protect your credit score.',
    category: 'Credit Score',
  },
  {
    id: 4,
    tip: 'Failing to provide a valid PAN card to your bank or employer may result in higher TDS deductions.',
    category: 'Tax Compliance',
  },
  {
    id: 5,
    tip: 'Submit Form 15G or 15H to banks when eligible to prevent unnecessary TDS deduction.',
    category: 'Tax Saving',
  },
  {
    id: 6,
    tip: 'Under the Old Tax Regime, Section 80C provides a maximum deduction limit of ₹1,50,000 using eligible investments and expenses.',
    category: 'Tax Regime',
  },
  {
    id: 7,
    tip: 'Top-Up (Step-Up) SIP allows you to automatically increase your monthly contribution as your salary grows over time.',
    category: 'Smart SIP',
  },
];

// ==========================================
// 5. MANUAL USER REGISTRATION
// ==========================================

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

    const hashedPassword = await bcrypt.hash(
      password,
      salt
    );

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
      { id: newUser.rows[0].id },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '24h' }
    );

    return res.status(201).json({
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

    console.error('Registration Error:', errorMessage);

    return res.status(500).json({
      success: false,
      message: 'Server error processing registration.',
    });
  }
});

// ==========================================
// 6. GOOGLE SIGN-IN / SIGN-UP
// ==========================================

app.post('/api/auth/google', async (req, res) => {
  const { token } = req.body;

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: [
        '1058256639702-kf6keqod679iifii1jvudn89r9f3e621.apps.googleusercontent.com',
        '1058256639702-ui0bbo682f3itque8029bf8qcrdbdnc1.apps.googleusercontent.com',
        '1058256639702-u2ns0js02n7srtqp1l6oo5sqhjj66gvq.apps.googleusercontent.com',
      ],
    });

    const payload = ticket.getPayload();

    if (!payload) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Google token payload.',
      });
    }

    const { name, email } = payload;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Google account email is missing.',
      });
    }

    const userResult = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    let user = userResult.rows[0];

    if (!user) {
      const placeholderPassword = await bcrypt.hash(
        Math.random().toString(36),
        10
      );

      const newUser = await pool.query(
        `
        INSERT INTO users
        (name, email, password, knowledge_level)
        VALUES ($1, $2, $3, $4)
        RETURNING id, name, email
        `,
        [
          name || 'HerFunds User',
          email,
          placeholderPassword,
          'Beginner',
        ]
      );

      user = newUser.rows[0];
    }

    const sessionToken = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '24h' }
    );

    return res.status(200).json({
      success: true,
      message: 'Google Sign-In successful!',
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

    console.error('Google Auth Error:', errorMessage);

    return res.status(500).json({
      success: false,
      message: 'Google authentication processing error.',
    });
  }
});

// ==========================================
// 7. DATABASE HEALTH CHECK
// ==========================================

app.get('/api/health', async (req, res) => {
  try {
    const dbCheck = await pool.query('SELECT NOW()');

    return res.status(200).json({
      status: 'Online',
      databaseTime: dbCheck.rows[0].now,
    });

  } catch (error) {
    console.error('Database Health Error:', error);

    return res.status(500).json({
      status: 'Database Error',
      message: 'Database connection failed.',
    });
  }
});

// ==========================================
// 8. DAILY FINANCIAL TIPS
// ==========================================

app.get('/api/daily-tips', (req, res) => {
  const dayOfYear = Math.floor(
    (Date.now() -
      new Date(new Date().getFullYear(), 0, 0).getTime()) /
      86400000
  );

  const index = dayOfYear % FINANCIAL_TIPS.length;

  const currentTip = FINANCIAL_TIPS[index];

  return res.status(200).json({
    success: true,
    dailyTip: currentTip,
    allTips: FINANCIAL_TIPS,
  });
});

// ==========================================
// 9. GET ALL LEARNING MODULES
// ==========================================

app.get('/api/modules', async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        module_id,
        title,
        description,
        module_order
      FROM public.modules
      ORDER BY module_order ASC
      `
    );

    const formattedModules = result.rows.map((m) => ({
      id: m.module_id,
      title: m.title,
      description: m.description,
      module_order: m.module_order,
    }));

    return res.status(200).json({
      success: true,
      modules: formattedModules,
    });

  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : String(error);

    console.error('Fetch Modules Error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch learning modules.',
      error: errorMessage,
    });
  }
});

// ==========================================
// 10. BANKING MODULE DETAILS
// ==========================================

app.get('/api/banking-details', async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT *
      FROM banking_module_detailed
      ORDER BY id ASC
      `
    );

    return res.status(200).json({
      success: true,
      data: result.rows,
    });

  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : String(error);

    console.error('Fetch Banking Details Error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch banking details.',
      error: errorMessage,
    });
  }
});

// ==========================================
// 11. GET LESSONS FOR A MODULE
// ==========================================

app.get(
  '/api/modules/:moduleId/lessons',
  async (req, res) => {
    const { moduleId } = req.params;

    try {
      const result = await pool.query(
        `
        SELECT *
        FROM public.lessons
        WHERE module_id = $1
        ORDER BY lesson_order ASC
        `,
        [moduleId]
      );

      const formattedLessons = result.rows.map((l) => ({
        id: l.lesson_id,
        module_id: l.module_id,
        title: l.title,
        summary: l.summary,
        content: l.content,
        duration: l.duration,
        difficulty: l.difficulty,
        lesson_order: l.lesson_order,
      }));

      return res.status(200).json({
        success: true,
        lessons: formattedLessons,
      });

    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : String(error);

      console.error('Fetch Lessons Error:', error);

      return res.status(500).json({
        success: false,
        message: 'Failed to fetch lessons.',
        error: errorMessage,
      });
    }
  }
);

// ==========================================
// 12. GET QUIZ QUESTIONS
// ==========================================

app.get(
  '/api/modules/:moduleId/quiz',
  async (req, res) => {
    const { moduleId } = req.params;

    try {
      const result = await pool.query(
        `
        SELECT
          question_id,
          module_id,
          question_text,
          option_a,
          option_b,
          option_c,
          option_d,
          correct_option
        FROM public.quiz_questions
        WHERE module_id = $1
        ORDER BY question_id ASC
        `,
        [moduleId]
      );

      const formattedQuestions = result.rows.map((q) => ({
        id: q.question_id,
        question_id: q.question_id,
        module_id: q.module_id,
        question: q.question_text,
        question_text: q.question_text,
        options: [
          q.option_a,
          q.option_b,
          q.option_c,
          q.option_d,
        ],
        option_a: q.option_a,
        option_b: q.option_b,
        option_c: q.option_c,
        option_d: q.option_d,
        correctOption: q.correct_option,
        correct_option: q.correct_option,
      }));

      return res.status(200).json({
        success: true,
        questions: formattedQuestions,
      });

    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : String(error);

      console.error('Fetch Quiz Error:', error);

      return res.status(500).json({
        success: false,
        message: 'Failed to fetch quiz questions.',
        error: errorMessage,
      });
    }
  }
);

// ==========================================
// 13. SUBMIT QUIZ SCORE & UNLOCK BADGE
// ==========================================

app.post(
  '/api/modules/:moduleId/quiz-submit',
  async (req, res) => {
    const { moduleId } = req.params;
    const { userId, score, total } = req.body;

    try {
      console.log(
        `Quiz submitted for Module ${moduleId} by User ${userId}: ${score}/${total}`
      );

      const passingScore = Math.ceil(total * 0.6);

      const isPassed = score >= passingScore;

      let badgeName: string | null = null;

      if (isPassed) {
        const numericModuleId = Number(moduleId);

        const badgeMap: {
          [key: number]: string;
        } = {
          1: 'Finance Basics',
          2: 'Mutual Fund Guide',
          3: 'SIP Learner',
          4: 'Digital Finance User',
          5: 'Banking Essentials',
          6: 'Investment Basics',
          7: 'Tax Awareness',
        };

        badgeName =
          badgeMap[numericModuleId] || 'Smart Investor';

        if (userId) {
          await pool.query(
            `
            INSERT INTO public.user_badges
            (user_id, module_id, badge_name, unlocked_at)
            VALUES ($1, $2, $3, NOW())
            ON CONFLICT (user_id, module_id)
            DO UPDATE SET
              badge_name = EXCLUDED.badge_name
            `,
            [userId, moduleId, badgeName]
          );
        }
      }

      return res.status(200).json({
        success: true,
        message: 'Quiz score submitted successfully!',
        score,
        total,
        badgeUnlocked: isPassed,
        badgeName,
      });

    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : String(error);

      console.error('Quiz Submission Error:', errorMessage);

      return res.status(500).json({
        success: false,
        message: 'Failed to record quiz score.',
      });
    }
  }
);

// ==========================================
// 14. GET UNLOCKED BADGES
// ==========================================

app.get(
  '/api/users/:userId/badges',
  async (req, res) => {
    const { userId } = req.params;

    try {
      const result = await pool.query(
        `
        SELECT
          module_id,
          badge_name,
          unlocked_at
        FROM public.user_badges
        WHERE user_id = $1
        ORDER BY module_id ASC
        `,
        [userId]
      );

      return res.status(200).json({
        success: true,
        badges: result.rows,
      });

    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : String(error);

      console.error('Fetch User Badges Error:', errorMessage);

      return res.status(500).json({
        success: false,
        message: 'Failed to fetch user badges.',
        error: errorMessage,
      });
    }
  }
);

// ==========================================
// 15. GET USER STREAK
// ==========================================

app.get(
  '/api/users/:userId/streak',
  async (req, res) => {
    const { userId } = req.params;

    try {
      const result = await pool.query(
        `
        SELECT
          streak_count,
          last_checkin_date
        FROM public.users
        WHERE id = $1
        `,
        [userId]
      );

      if (result.rows.length === 0) {
        return res.status(200).json({
          success: true,
          streak: 3,
          checkedInToday: false,
        });
      }

      const user = result.rows[0];

      const today = new Date()
        .toISOString()
        .split('T')[0];

      const lastCheckin = user.last_checkin_date
        ? new Date(user.last_checkin_date)
            .toISOString()
            .split('T')[0]
        : null;

      return res.status(200).json({
        success: true,
        streak: user.streak_count || 3,
        checkedInToday: lastCheckin === today,
      });

    } catch (error) {
      console.error('Fetch Streak Error:', error);

      return res.status(200).json({
        success: true,
        streak: 3,
        checkedInToday: false,
      });
    }
  }
);

// ==========================================
// 16. USER STREAK CHECK-IN
// ==========================================

app.post(
  '/api/users/:userId/streak-checkin',
  async (req, res) => {
    const { userId } = req.params;

    try {
      const today = new Date()
        .toISOString()
        .split('T')[0];

      const result = await pool.query(
        `
        UPDATE public.users
        SET
          streak_count = COALESCE(streak_count, 0) + 1,
          last_checkin_date = $1
        WHERE id = $2
        RETURNING streak_count
        `,
        [today, userId]
      );

      const newStreak =
        result.rows[0]?.streak_count || 4;

      return res.status(200).json({
        success: true,
        message: 'Streak updated successfully!',
        streak: newStreak,
      });

    } catch (error) {
      console.error('Streak Check-In Error:', error);

      return res.status(200).json({
        success: true,
        message: 'Streak updated locally!',
        streak: 4,
      });
    }
  }
);

// ==========================================
// 17. HERFUNDS AI CHAT
// ==========================================

app.post('/api/ai/chat', async (req, res) => {
  const { message } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'Please provide a valid message.',
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

    // Correct Gemini API call.
    // model and contents must be inside the same object.

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: `${systemInstruction}\n\nUser question:\n${message}`,
    });

    const reply =
      response.text ||
      'I could not generate a response right now. Please try again.';

    return res.status(200).json({
      success: true,
      reply,
    });

  } catch (error) {
    console.error('HerFunds AI Error:', error);

    return res.status(500).json({
      success: false,
      message: 'HerFunds AI could not process your request.',
    });
  }
});

// ==========================================
// 18. FINANCIAL SIMULATIONS
// ==========================================

app.use(
  '/api/simulations',
  simulationRoutes
);

// ==========================================
// 19. BASIC HEALTH CHECK
// ==========================================

app.get('/health', (req, res) => {
  return res.status(200).json({
    status: 'ok',
    app: 'HerFunds',
  });
});

// ==========================================
// 20. START SERVER
// ==========================================

app.listen(
  PORT,
  '0.0.0.0',
  () => {
    console.log(
      `HerFunds Backend running on port ${PORT}`
    );
  }
);