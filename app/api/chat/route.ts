import { google } from '@ai-sdk/google';
import { GoogleAICacheManager } from '@google/generative-ai/server';
import { generateText } from 'ai';

export const maxDuration = 30;

const cacheManager = new GoogleAICacheManager(
  process.env.GOOGLE_GENERATIVE_AI_API_KEY || 'AIzaSyC3h0u2Vh9BDAqvodxB7NPwRVROXr4YYNM',
);

type GoogleModelCacheableId = 'models/gemini-2.0-flash';

const modelId: GoogleModelCacheableId = 'models/gemini-2.0-flash';

// ---------- helper ----------
interface OpenAIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}
const toGeminiContents = (msgs: OpenAIMessage[]) =>
  msgs.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

// -----------------------------

// Function to estimate token count for Gemini content
function getTokenCount(contents: any[]) {
  return contents.reduce((total, item) => total + item.parts.reduce((sum: number, part: { text: string }) => sum + part.text.split(/\s+/).length, 0), 0);
}

export async function POST(req: Request) {
  const { messages } = await req.json(); // messages: OpenAIMessage[]

  const geminiContents = toGeminiContents(messages);

  // Check token count
  const tokenCount = getTokenCount(geminiContents);
  const minTokenCount = 4096;

  let cachedContent = null;

  if (tokenCount >= minTokenCount) {
    // Only cache if token count is sufficient
    try {
      const { name } = await cacheManager.create({
        model: modelId,
        contents: geminiContents,
        ttlSeconds: 60 * 5,
      });

      if (name) {
        cachedContent = name;
      }
    } catch (error) {
      console.error('Error creating cache:', error);
      // Continue without cache if there's an error
    }
  }

  // Get the last user message as the main prompt
  let lastUserPrompt = "";

  const lastUserMessage = geminiContents
    .slice()
    .reverse()
    .find((c) => c.role === 'user');

  if (lastUserMessage && lastUserMessage.parts && lastUserMessage.parts[0]) {
    lastUserPrompt = lastUserMessage.parts[0].text;
  }

  try {
    const { text } = await generateText({
      model: google(modelId, cachedContent ? { cachedContent } : {}),
      prompt: lastUserPrompt,
    });

    console.log('AI response:', text);

    // Format tanggapan dalam format OpenAI yang diharapkan oleh kode klien
    const response = {
      choices: [
        {
          message: {
            role: "assistant",
            content: text
          }
        }
      ]
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error generating response:', error);

    // Return error response in OpenAI format
    return new Response(JSON.stringify({
      choices: [
        {
          message: {
            role: "assistant",
            content: "Maaf, terjadi kesalahan saat memproses permintaan Anda."
          }
        }
      ]
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
