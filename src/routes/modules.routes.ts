import { Router, Request, Response } from 'express';
import { Pool } from 'pg';

const router = Router();

// DB Connection (Aapke existing PostgreSQL config ke mutabiq detail check kar lein)
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'HerFunds',
  password: process.env.DB_PASSWORD || 'your_password',
  port: Number(process.env.DB_PORT) || 5432,
});

// GET QUIZ QUESTIONS FOR A MODULE
router.get('/modules/:id/quiz', async (req: Request, res: Response) => {
  try {
    const moduleId = req.params.id;
    const result = await pool.query(
      'SELECT question_id, question_text, option_a, option_b, option_c, option_d, correct_option FROM public.quiz_questions WHERE module_id = $1 ORDER BY question_id ASC;',
      [moduleId]
    );

    return res.status(200).json({
      success: true,
      questions: result.rows,
    });
  } catch (error: any) {
    console.error('Error fetching quiz questions:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;