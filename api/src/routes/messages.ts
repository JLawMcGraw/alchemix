import { Router, Request, Response } from 'express';
import axios from 'axios';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// POST /api/messages - Send message to AI
router.post('/', async (req: Request, res: Response) => {
  try {
    const { message, context } = req.body;

    // Validation
    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    // Check if API key is configured
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return res.status(503).json({
        success: false,
        error: 'AI service is not configured. Please add ANTHROPIC_API_KEY to environment variables.'
      });
    }

    // Call Anthropic API
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: message
          }
        ],
        system: context || 'You are a knowledgeable bartender assistant helping users with cocktail recipes and recommendations.'
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        }
      }
    );

    const aiMessage = response.data.content[0]?.text || 'No response from AI';

    res.json({
      success: true,
      data: {
        message: aiMessage
      }
    });
  } catch (error) {
    console.error('AI message error:', error);

    if (axios.isAxiosError(error)) {
      return res.status(error.response?.status || 500).json({
        success: false,
        error: error.response?.data?.error?.message || 'Failed to get AI response'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to send message to AI'
    });
  }
});

export default router;
