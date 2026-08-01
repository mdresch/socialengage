// Throwaway diagnostic: list real Gemini model IDs that support generateContent.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI } from '@google/genai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.loadEnvFile(path.join(__dirname, '..', '.env'));

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const pager = await ai.models.list();
for await (const m of pager) {
  if (m.supportedActions?.includes('generateContent')) {
    console.log(`${m.name} | ${m.displayName}`);
  }
}
