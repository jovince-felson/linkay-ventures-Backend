import axios from 'axios';
import { sendSuccess, sendError } from '../utils/response.js';
import { logger } from 'linkay-shared-utils';

// Groq — 100% FREE, no credit card needed, powered by Llama 3
// Get key: https://console.groq.com  → API Keys → Create
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL   = 'llama-3.1-8b-instant';   // free, very fast

/**
 * POST /api/v1/ai/suggest-description
 * Body: { title, assetType, custodian, ownershipEntity, jurisdiction, historicalContext }
 * Returns: { description }  — AI-generated asset description (max 200 words)
 */
export async function suggestDescription(req, res) {
  if (!GROQ_API_KEY) {
    return sendError(res, 'AI suggestion is not configured. Set GROQ_API_KEY in .env.', 503);
  }

  const { title, assetType, custodian, ownershipEntity, jurisdiction, historicalContext } = req.body;

  if (!title && !assetType) {
    return sendError(res, 'Provide at least an Asset Title or Asset Type to generate a description.', 400);
  }

  const contextLines = [
    title             && `Asset Name: ${title}`,
    assetType         && `Asset Type: ${assetType}`,
    custodian         && `Custodian: ${custodian}`,
    ownershipEntity   && `Ownership Entity: ${ownershipEntity}`,
    jurisdiction      && `Jurisdiction: ${jurisdiction}`,
    historicalContext && `Historical Context: ${historicalContext}`,
  ].filter(Boolean).join('\n');

  const prompt = `You are an expert in Real World Asset (RWA) tokenization on blockchain platforms.

Based on the following asset details, write a compelling and professional asset description in under 200 words. The description should highlight the asset's investment value, uniqueness, and relevance to investors. Write in third person, formal tone.

${contextLines}

Return only the description text. No headings, no bullet points, no extra commentary.`;

  try {
    const response = await axios.post(
      GROQ_API_URL,
      {
        model:       GROQ_MODEL,
        messages:    [{ role: 'user', content: prompt }],
        max_tokens:  400,
        temperature: 0.7,
      },
      {
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type':  'application/json',
        },
        timeout: 30000,
      },
    );

    const description = response.data?.choices?.[0]?.message?.content?.trim();
    if (!description) {
      return sendError(res, 'AI returned an empty response. Please try again.', 502);
    }

    return sendSuccess(res, { description }, 'AI description generated successfully');
  } catch (err) {
    const status    = err.response?.status;
    const groqError = err.response?.data?.error;
    const message   = groqError?.message || err.message;

    logger.error('[AI Suggest] Groq error', { status, message });

    if (status === 401) return sendError(res, 'Invalid GROQ_API_KEY. Check your key at console.groq.com.', 502);
    if (status === 429) return sendError(res, 'AI rate limit reached. Please try again shortly.', 429);

    return sendError(res, `AI suggestion failed: ${message}`, 502);
  }
}
