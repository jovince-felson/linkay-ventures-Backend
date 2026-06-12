import { GoogleGenAI } from '@google/genai';
import { sendSuccess, sendError } from '../utils/response.js';
import { logger } from 'linkay-shared-utils';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const ENHANCEMENT_PROMPT = `You are an expert content enhancement specialist.

Your task is to transform a short user description into a highly detailed, engaging, and informative paragraph.

Requirements:
- Generate between 250 and 400 words.
- Preserve the original meaning.
- Add historical context when relevant.
- Add architectural details when relevant.
- Add visual appearance and design details.
- Describe materials, colors, textures, and surroundings.
- Include cultural significance if applicable.
- Write in a professional and descriptive style.
- Return only the enhanced description.
- Do not use bullet points.
- Do not include titles or headings.

User Input:
{input_text}`;

export async function enhanceDescription(req, res) {
  if (!GEMINI_API_KEY) {
    return sendError(res, 'AI enhancement is not configured. Set GEMINI_API_KEY in .env.', 503);
  }

  const { description } = req.body;

  if (!description || !description.trim()) {
    return sendError(res, 'Description cannot be empty.', 400);
  }

  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    const prompt = ENHANCEMENT_PROMPT.replace('{input_text}', description.trim());

    logger.info('[AI Enhance] Sending request to Gemini');

    const response = await Promise.race([
      ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Gemini timeout')), 30000),
      ),
    ]);

    const enhanced = response.text?.trim();

    if (!enhanced) {
      return sendError(res, 'AI returned an empty response. Please try again.', 502);
    }

    logger.info('[AI Enhance] Successfully processed');

    return sendSuccess(res, { enhanced_description: enhanced }, 'Description enhanced successfully');
  } catch (err) {
    logger.error('[AI Enhance] Error', { message: err.message });

    if (err.message === 'Gemini timeout') {
      return sendError(res, 'AI request timed out. Please try again.', 504);
    }

    return sendError(res, `AI enhancement failed: ${err.message}`, 502);
  }
}