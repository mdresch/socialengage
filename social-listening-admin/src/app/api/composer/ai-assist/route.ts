import { NextResponse } from 'next/server';

export interface AiAssistRequest {
  text: string;
  mode: 'autofit' | 'professional' | 'punchy' | 'hashtags' | 'custom';
  targetPlatform?: string;
  maxChars?: number;
  customPrompt?: string;
}

export async function POST(req: Request) {
  try {
    const body: AiAssistRequest = await req.json();
    const { text, mode, targetPlatform, maxChars, customPrompt } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Text is required.' }, { status: 400 });
    }

    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const apiKey = process.env.AZURE_OPENAI_KEY;
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-5-mini';

    let systemInstruction = 'You are an expert social media copywriter and editor for SocialEngage.';
    let userInstruction = '';

    const limitNotice = maxChars ? `Keep the total response strictly under ${maxChars} characters.` : '';
    const platformNotice = targetPlatform ? `Format specifically for ${targetPlatform}.` : '';

    switch (mode) {
      case 'autofit':
        userInstruction = `Condense and rephrase the following post so it retains its key message, hook, and meaning while fitting strictly within ${maxChars || 280} characters. Output ONLY the rewritten post without commentary.\n\nOriginal Post:\n${text}`;
        break;
      case 'professional':
        userInstruction = `Rewrite the following post into an authoritative, professional B2B thought-leadership format suitable for LinkedIn. Use clean line breaks, concise bullet points where appropriate, and a closing engaging question. ${limitNotice}\n\nOriginal Post:\n${text}`;
        break;
      case 'punchy':
        userInstruction = `Rewrite the following post to be high-impact, punchy, and engaging for social media feeds (X / Threads). Use short paragraphs, strong opening hook, and relevant emojis. ${limitNotice}\n\nOriginal Post:\n${text}`;
        break;
      case 'hashtags':
        userInstruction = `Suggest 4-6 high-converting, relevant hashtags for the following post and append them naturally at the bottom. Return the post with the added hashtags.\n\nOriginal Post:\n${text}`;
        break;
      case 'custom':
      default:
        userInstruction = `${customPrompt || 'Improve this social media post.'} ${platformNotice} ${limitNotice}\n\nOriginal Post:\n${text}`;
        break;
    }

    // Call Azure OpenAI if configured
    if (endpoint && apiKey) {
      const url = `${endpoint.replace(/\/$/, '')}/openai/deployments/${deployment}/chat/completions?api-version=2024-02-15-preview`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': apiKey,
        },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: userInstruction },
          ],
          temperature: 0.7,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const output = data.choices?.[0]?.message?.content?.trim();
        if (output) {
          return NextResponse.json({ result: output });
        }
      }
    }

    // High quality local fallback if Azure OpenAI network is unreachable
    let fallbackResult = text;
    if (mode === 'autofit') {
      const limit = maxChars || 280;
      const words = text.split(/\s+/);
      let acc = '';
      for (const w of words) {
        if ((acc + ' ' + w).length <= limit - 4) {
          acc += (acc ? ' ' : '') + w;
        } else break;
      }
      fallbackResult = acc + (acc.length < text.length ? '...' : '');
    } else if (mode === 'professional') {
      const lines = text.split('\n').filter(Boolean);
      fallbackResult = `Key takeaways:\n\n` + lines.map((l) => `• ${l.replace(/^[•\-*]\s*/, '')}`).join('\n') + `\n\nHow is your organization approaching this?`;
    } else if (mode === 'punchy') {
      fallbackResult = `🚀 Big milestone:\n\n${text}\n\n👇 Thoughts?`;
    } else if (mode === 'hashtags') {
      fallbackResult = `${text}\n\n#SocialListening #AI #Innovation #Marketing`;
    }

    return NextResponse.json({ result: fallbackResult });
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json({ error: err.message || 'AI processing error' }, { status: 500 });
  }
}
