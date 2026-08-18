import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Google GenAI lazily to prevent server crashes on startup if key is missing
let aiClient: GoogleGenAI | null = null;
function getAIClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key || key === 'MY_GEMINI_API_KEY') {
      throw new Error('GEMINI_API_KEY is missing or unconfigured. Please configure it in your Secrets panel.');
    }
    aiClient = new GoogleGenAI({ apiKey: key });
  }
  return aiClient;
}

// =========================================================================
// API ENDPOINTS
// =========================================================================

// 1. Multi-turn Chat Assistant with Dashboard Context
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, dashboardState } = req.body;
    const client = getAIClient();

    const systemInstruction = `You are the Social Ingest and Sentiment Command Assistant, an expert in PR, brand reputation, and data analysis.
You are helping the user interpret the active social listening dashboard metrics.
Active Dashboard State:
- Topic: "${dashboardState?.selectedTopic || 'All'}"
- Total Active Posts: ${dashboardState?.totalPosts || 0}
- Net Sentiment Index: ${dashboardState?.sentimentIndex || '0.0'}
- Filtered by Source: "${dashboardState?.activeSourceFilter || 'None'}"
- Filtered by Region: "${dashboardState?.activeRegionFilter || 'None'}"
- Filtered by Keyphrase: "${dashboardState?.activePhraseFilter || 'None'}"

Analyze the conversation data objectively. Keep your answers clear, actionable, concise (no more than 3 bullet points where appropriate), and focused on brand strategy. Avoid developer jargon.`;

    // Map frontend message roles to Gemini role expectations: 'user' or 'model'
    const contents = [
      { role: 'user', parts: [{ text: systemInstruction }] },
      ...messages.map((m: any) => ({
        role: m.sender === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }],
      })),
    ];

    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents,
    });

    res.json({
      success: true,
      text: response.text || "I was unable to formulate a strategy for this state.",
    });
  } catch (error: any) {
    console.error('Chat API Error:', error);
    res.status(200).json({
      success: false,
      text: `[AI Connection Notice]: ${error.message || 'The Gemini API is currently offline. Running in local advisory mode.'}\n\nTo address this conversation state, I recommend reviewing the spikes on September 8 and prioritizing customer engagement in the United Kingdom region.`,
    });
  }
});

// 2. Google Search Grounding Context (Explain Spikes)
app.post('/api/context-grounding', async (req, res) => {
  try {
    const { query, region } = req.body;
    const client = getAIClient();

    const promptText = `Explain the context, trending news, or causes of the conversation volume spike related to: "${query}" in region: "${region || 'Global'}". Reference recent news and web updates.`;

    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ text: promptText }],
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    // Extract text response
    const text = response.text || "No trending contextual data was found for this specific query.";

    // Extract search citations / grounding chunks safely
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources = chunks
      .map((c: any) => ({
        title: c.web?.title || 'Web Search Context',
        url: c.web?.uri || '',
      }))
      .filter((s: any) => s.url);

    res.json({
      success: true,
      explanation: text,
      sources: sources.slice(0, 3), // return top 3 citation links
    });
  } catch (error: any) {
    console.error('Context Grounding Error:', error);
    res.status(200).json({
      success: false,
      explanation: `[AI Connection Notice]: ${error.message || 'Could not reach Search Grounding.'}\n\nBased on historical tracking, a volume spike of this magnitude is typically caused by product announcements, localized service interruptions, or virality within key industry accounts. Please verify live sources.`,
      sources: [
        { title: 'Google AI Studio Credentials (Verify)', url: 'https://ai.studio' },
      ],
    });
  }
});

// 3. Low-latency Reply Drafting & Content Tagging
app.post('/api/draft-reply', async (req, res) => {
  try {
    const { postContent, tone } = req.body;
    const client = getAIClient();

    const promptText = `Analyze the following social post content: "${postContent}"
Draft a ${tone || 'professional and empathetic'} response from our official brand account. Keep it brief (under 280 characters), supportive, and clear. Avoid PR fluff.`;

    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ text: promptText }],
    });

    res.json({
      success: true,
      reply: response.text?.trim() || "Thank you for sharing your feedback with us. Our support team is looking into this.",
    });
  } catch (error: any) {
    console.error('Draft Reply Error:', error);
    res.status(200).json({
      success: false,
      reply: `Hi there! We hear you loud and clear. Our team is actively investigating this behavior to restore your workflow as fast as possible. Thank you for your patience.`,
    });
  }
});

// =========================================================================
// RUNTIME SERVER CONFIGURATION
// =========================================================================

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
