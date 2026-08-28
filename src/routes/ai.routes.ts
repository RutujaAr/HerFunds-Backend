import { Router, Request, Response } from 'express';

const router = Router();

const HERFUNDS_SYSTEM_INSTRUCTION = `
You are HerFunds AI, an empathetic, supportive, and beginner-friendly financial literacy tutor specifically tailored for women.

Core Principles & Rules:
1. Purely Educational: Explain financial concepts (like SIP, Mutual Funds, Savings, Budgeting, Inflation, UPI Safety) using simple analogies.
2. Strict Advice Disclaimer: DO NOT recommend specific stocks, direct buy/sell decisions, or guaranteed returns.
3. Language Support: Respond in simple English, Hindi, or Hinglish depending on the user's prompt.
4. Formatting: Keep responses concise, well-structured with clear bullet points.
`;

router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ success: false, message: 'Message is required.' });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        message: 'OpenRouter API Key is missing in server .env configuration.',
      });
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openrouter/free',
        messages: [
          {
            role: 'system',
            content: HERFUNDS_SYSTEM_INSTRUCTION,
          },
          {
            role: 'user',
            content: message,
          },
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('OpenRouter API Error:', data);
      return res.status(response.status).json({
        success: false,
        message: 'OpenRouter API Error',
        error: data,
      });
    }

    const responseText = data.choices?.[0]?.message?.content || 'No response generated.';

    return res.status(200).json({
      success: true,
      reply: responseText,
    });
  } catch (error: any) {
    console.error('Server Endpoint Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch AI response.',
      error: error.message || error,
    });
  }
});

export default router;