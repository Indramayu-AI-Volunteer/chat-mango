import { google } from '@ai-sdk/google';
import { GoogleAICacheManager } from '@google/generative-ai/server';
import { generateText } from 'ai';

export const maxDuration = 30;

const cacheManager = new GoogleAICacheManager(
  process.env.GOOGLE_GENERATIVE_AI_API_KEY || '',
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

// Interface untuk konfigurasi model
interface ModelConfig {
  model: string;
  hf_token?: string;
  hf_endpoint?: string;
  hf_model_id?: string;
}

export async function POST(req: Request) {
  try {
    const { messages, config } = await req.json();

    // Default ke Gemini jika tidak ada konfigurasi
    const modelConfig: ModelConfig = config || { model: "gemini" };

    // Pilih model berdasarkan konfigurasi
    if (modelConfig.model === "huggingface") {
      return await handleHuggingfaceRequest(messages, modelConfig);
    } else {
      // Default ke Gemini
      return await handleGeminiRequest(messages);
    }
  } catch (error) {
    console.error('Error in chat API route:', error);
    return formatErrorResponse("Terjadi kesalahan dalam memproses permintaan Anda.");
  }
}

// Handler untuk model Gemini
async function handleGeminiRequest(messages: OpenAIMessage[]) {
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

    console.log('Gemini AI response:', text);

    return formatSuccessResponse(text);
  } catch (error) {
    console.error('Error generating Gemini response:', error);
    return formatErrorResponse("Terjadi kesalahan saat menghasilkan respons dari Gemini.");
  }
}

// Handler untuk model Huggingface
async function handleHuggingfaceRequest(messages: OpenAIMessage[], config: ModelConfig) {
  try {
    // Validasi konfigurasi yang diperlukan
    if (!config.hf_token || !config.hf_endpoint) {
      return formatErrorResponse("HF Token dan Endpoint URL diperlukan untuk menggunakan model Huggingface.");
    }

    // Gunakan model ID default
    const modelId = "mistralai/Mistral-7B-Instruct-v0.2";
    console.log(`Using default Huggingface model: ${modelId}`);

    // Ambil pesan terakhir dari pengguna
    const lastUserMessage = messages
      .slice()
      .reverse()
      .find(m => m.role === 'user');

    if (!lastUserMessage) {
      return formatErrorResponse("Tidak dapat menemukan pesan pengguna.");
    }

    // Batas token untuk model Huggingface
    const TOKEN_LIMIT = 1024;
    const MIN_OUTPUT_TOKENS = 100;

    // Estimasi ukuran input dalam token (perkiraan kasar: 1 token ≈ 4 karakter)
    const inputLength = lastUserMessage.content.length;
    const estimatedTokens = Math.ceil(inputLength / 4);

    // Jika input terlalu panjang, potong agar masih ada ruang untuk output
    let processedInput = lastUserMessage.content;
    if (estimatedTokens > TOKEN_LIMIT - MIN_OUTPUT_TOKENS) {
      // Kita perlu memotong input
      const maxInputChars = (TOKEN_LIMIT - MIN_OUTPUT_TOKENS) * 4;
      processedInput = processedInput.substring(0, maxInputChars) + "... [teks terpotong karena terlalu panjang]";
      console.log(`Input terlalu panjang, dipotong dari ${inputLength} ke ${processedInput.length} karakter`);
    }

    // Hitung ulang estimasi token setelah pemotongan
    const finalEstimatedTokens = Math.ceil(processedInput.length / 4);
    const maxNewTokens = Math.max(MIN_OUTPUT_TOKENS, TOKEN_LIMIT - finalEstimatedTokens);

    console.log(`Estimated input tokens: ${finalEstimatedTokens}, Setting max_new_tokens: ${maxNewTokens}`);

    // Buat payload untuk API Huggingface
    const payload = {
      inputs: processedInput,
      parameters: {
        max_new_tokens: maxNewTokens,
        temperature: 0.7,
        top_p: 0.9,
        do_sample: true,
      }
    };

    // Panggil API Huggingface
    const response = await fetch(config.hf_endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.hf_token}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorDetails = await response.text();
      console.error('Huggingface API error:', errorDetails);
      return formatErrorResponse(`Kesalahan dari Huggingface API: ${response.status}`);
    }

    // Parse respons dari Huggingface
    const result = await response.json();

    // Format respons sesuai dengan apa yang dikembalikan oleh Huggingface
    let aiResponse;

    // Huggingface dapat mengembalikan berbagai format berdasarkan model
    if (Array.isArray(result) && result[0] && typeof result[0].generated_text === 'string') {
      // Format untuk model teks generatif
      aiResponse = result[0].generated_text;
    } else if (typeof result.generated_text === 'string') {
      // Format alternatif
      aiResponse = result.generated_text;
    } else if (Array.isArray(result) && typeof result[0] === 'string') {
      // Beberapa model mengembalikan array string
      aiResponse = result[0];
    } else {
      // Fallback, kembalikan JSON string jika format tidak dikenal
      aiResponse = JSON.stringify(result);
    }

    console.log('Huggingface AI response:', aiResponse);
    return formatSuccessResponse(aiResponse);
  } catch (error) {
    console.error('Error generating Huggingface response:', error);
    return formatErrorResponse("Terjadi kesalahan saat menghasilkan respons dari Huggingface.");
  }
}

// Fungsi helper untuk memformat respons sukses
function formatSuccessResponse(text: string) {
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
}

// Fungsi helper untuk memformat respons error
function formatErrorResponse(errorMessage: string) {
  return new Response(JSON.stringify({
    choices: [
      {
        message: {
          role: "assistant",
          content: errorMessage
        }
      }
    ]
  }), {
    status: 500,
    headers: { 'Content-Type': 'application/json' },
  });
}
