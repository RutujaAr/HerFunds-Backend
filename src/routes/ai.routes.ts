
import { Router, Request, Response } from 'express';

const router = Router();

const HERFUNDS_SYSTEM_INSTRUCTION = `
You are HerFunds AI, an empathetic, supportive, and beginner-friendly financial literacy tutor specifically tailored for women.

Core Principles & Rules:
1. Purely Educational: Explain financial concepts like SIP, Mutual Funds, Savings, Budgeting, Inflation, and UPI Safety using simple analogies.
2. DO NOT recommend specific stocks, direct buy/sell decisions, or guaranteed returns.
3. Respond in simple English, Hindi, or Hinglish depending on the user's prompt.
4. Keep responses concise and well-structured with clear bullet points.
`;

router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { message } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'A valid message is required.',
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.error('GEMINI_API_KEY is missing.');

      return res.status(500).json({
        success: false,
        message: 'Gemini API Key is missing in server configuration.',
      });
    }

    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: HERFUNDS_SYSTEM_INSTRUCTION }],
          },
          contents: [
            {
              role: 'user',
              parts: [{ text: message }],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024,
          },
        }),
      }
    );

    const data: any = await response.json();

    if (!response.ok) {
      const errorMessage =
        data?.error?.message || 'Unknown Gemini API error';

      console.error('Gemini API Error:', {
        status: response.status,
        message: errorMessage,
        statusText: data?.error?.status,
      });

      return res.status(502).json({
        success: false,
        message: 'Gemini API request failed.',
        error: errorMessage,
        geminiStatus: response.status,
      });
    }

    const responseText =
      data.candidates?.[0]?.content?.parts
        ?.map((part: { text?: string }) => part.text || '')
        .join('')
        .trim();

    if (!responseText) {
      console.error('Gemini returned an empty response:', {
        finishReason: data.candidates?.[0]?.finishReason,
      });

      return res.status(502).json({
        success: false,
        message: 'No AI response generated.',
        error: data.candidates?.[0]?.finishReason || 'Empty Gemini response',
      });
    }

    return res.status(200).json({
      success: true,
      reply: responseText,
    });

  } catch (error: any) {
    console.error('Gemini Server Error:', error.message || error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch AI response.',
      error: error.message || 'Unknown server error',
    });
  }
});

export default router;
