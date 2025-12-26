import { google } from '@ai-sdk/google';
import { Content, GoogleAICacheManager } from '@google/generative-ai/server';
import { generateText } from 'ai';
import { config } from 'process';

export const maxDuration = 30;

const cacheManager = new GoogleAICacheManager(
  process.env.GOOGLE_GENERATIVE_AI_API_KEY || '',
);


// Pemetaan modelId untuk versi Gemini
type GeminiVersion =
  'gemini-2.5-pro' |
  'gemini-2.5-flash' |
  'gemini-2.5-flash-lite';

const geminiVersionToModelId = {
  'gemini-2.5-pro': 'models/gemini-2.5-pro',
  'gemini-2.5-flash': 'models/gemini-2.5-flash',
  'gemini-2.5-flash-lite': 'models/gemini-2.5-flash-lite',
};

type LangAIResponse =
  'Bahasa Jawa Indramayu' |
  'Sesuai Prompt';

const LangAIResponseToModelId = {
  'Bahasa Jawa Indramayu': 'indramayu-prompt',
  'Sesuai Prompt': 'no-template-prompt',
}

interface ModelConfig {
  model: string;
  gemini_version?: GeminiVersion;
  hf_token?: string;
  hf_endpoint?: string;
  hf_model_id?: string;
  colab_endpoint?: string;
  vllm_endpoint?: string;
  lang_ai_response?: LangAIResponse;
}

// ---------- helper ----------
interface OpenAIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

function IndramayuTemplate(prompt: string) {
  return `
  Tolong jawab pertanyaan atau permintaan saya hanya menggunakan bahasa Jawa Indramayu. Meskipun saya menggunakan bahasa Indonesia atau bahasa lain dalam pertanyaan saya, kamu tetap harus membalasnya dalam bahasa Jawa Indramayu saja, dengan tata bahasa dan kosa kata yang umum digunakan oleh penutur asli dari daerah Indramayu. Jangan gunakan bahasa Indonesia atau bahasa Jawa standar.

  Berikut ini pertanyaannya:
  ${prompt}
  `
}


function toGeminiContents(msgs: OpenAIMessage[], config: ModelConfig): Content[] {
  const LangAIResponse = config.lang_ai_response || 'Bahasa Jawa Indramayu';
  const LangAIResponseModelId = LangAIResponseToModelId[LangAIResponse] || 'indramayu-prompt';

  console.log('langAIResponse from config:', LangAIResponseModelId);

  console.log(LangAIResponseModelId);
  return msgs.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{
      text: LangAIResponseModelId === 'indramayu-prompt'
        ? IndramayuTemplate(m.content)
        : m.content,
    }],
  }));
}


// -----------------------------

// Function to estimate token count for Gemini content
function getTokenCount(contents: any[]) {
  return contents.reduce((total, item) => total + item.parts.reduce((sum: number, part: { text: string }) => sum + part.text.split(/\s+/).length, 0), 0);
}

export async function POST(req: Request) {
  try {
    const { messages, config } = await req.json();

    // Default ke Gemini jika tidak ada konfigurasi
    const modelConfig: ModelConfig = config || { model: 'gemini' };

    // Pilih model berdasarkan konfigurasi
    if (modelConfig.model === 'huggingface') {
      return await handleHuggingfaceRequest(messages, modelConfig);
    } else if (modelConfig.model === 'colab') {
      return await handleColabRequest(messages, modelConfig);
    } else if (modelConfig.model === 'vllm') {
      return await handleVLLMRequest(messages, modelConfig);
    } else {
      // Default ke Gemini
      return await handleGeminiRequest(messages, modelConfig);
    }
  } catch (error) {
    console.error('Error in chat API route:', error);
    return formatErrorResponse('Terjadi kesalahan dalam memproses permintaan Anda.');
  }
}

// Handler untuk model Gemini
async function handleGeminiRequest(messages: OpenAIMessage[], config: ModelConfig) {

  const geminiContents = toGeminiContents(messages, config);

  // Mendapatkan versi Gemini yang dipilih, default ke gemini-2.0-flash jika tidak ada
  const geminiVersion = config.gemini_version || 'gemini-2.0-flash';
  const modelId = geminiVersionToModelId[geminiVersion] || 'models/gemini-2.0-flash';

  console.log(`Using Gemini version: ${geminiVersion}, modelId: ${modelId}`);

  // Check token count
  const tokenCount = getTokenCount(geminiContents);
  const minTokenCount = 4096;

  let cachedContent = null;

  if (tokenCount >= minTokenCount) {
    // Only cache if token count is sufficient
    try {
      const { name } = await cacheManager.create({
        model: modelId as any,
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
  let lastUserPrompt = '';

  const lastUserMessage = geminiContents
    .slice()
    .reverse()
    .find((c) => c.role === 'user');

  if (lastUserMessage && lastUserMessage.parts && lastUserMessage.parts[0]) {
    lastUserPrompt = lastUserMessage.parts[0].text || '';
  }

  try {
    const { text } = await generateText({
      model: google(modelId as any, cachedContent ? { cachedContent } : {}),
      prompt: lastUserPrompt,
    });

    console.log('Gemini AI response:', text);

    return formatSuccessResponse(text);
  } catch (error) {
    console.error('Error generating Gemini response:', error);
    return formatErrorResponse('Terjadi kesalahan saat menghasilkan respons dari Gemini.');
  }
}

// Handler untuk model Huggingface
async function handleHuggingfaceRequest(messages: OpenAIMessage[], config: ModelConfig) {
  try {
    // Validasi konfigurasi yang diperlukan
    if (!config.hf_token || !config.hf_endpoint) {
      return formatErrorResponse('HF Token dan Endpoint URL diperlukan untuk menggunakan model Huggingface.');
    }

    // Gunakan model ID default
    const modelId = 'mistralai/Mistral-7B-Instruct-v0.2';
    console.log(`Using default Huggingface model: ${modelId}`);

    // Ambil pesan terakhir dari pengguna
    const lastUserMessage = messages
      .slice()
      .reverse()
      .find(m => m.role === 'user');

    if (!lastUserMessage) {
      return formatErrorResponse('Tidak dapat menemukan pesan pengguna.');
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
      processedInput = processedInput.substring(0, maxInputChars) + '... [teks terpotong karena terlalu panjang]';
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
    return formatErrorResponse('Terjadi kesalahan saat menghasilkan respons dari Huggingface.');
  }
}

// Handler untuk model Google Colab (FastAPI)
async function handleColabRequest(messages: OpenAIMessage[], config: ModelConfig) {
  try {
    // Validasi konfigurasi yang diperlukan
    if (!config.colab_endpoint) {
      return formatErrorResponse('URL Endpoint diperlukan untuk menggunakan Google Colab (FastAPI).');
    }

    // Ambil pesan terakhir dari pengguna
    const lastUserMessage = messages
      .slice()
      .reverse()
      .find(m => m.role === 'user');

    if (!lastUserMessage) {
      return formatErrorResponse('Tidak dapat menemukan pesan pengguna.');
    }

    // Pastikan URL endpoint diakhiri dengan / jika belum
    let endpoint = config.colab_endpoint;
    if (!endpoint.endsWith('/')) {
      endpoint += '/';
    }

    // Buat payload untuk API FastAPI di Colab
    const payload = {
      prompt: lastUserMessage.content,
      max_tokens: 512 // Nilai default
    };

    console.log(`Sending request to Colab endpoint: ${endpoint}`);

    // Panggil API Colab
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorDetails = await response.text();
      console.error('Colab API error:', errorDetails);
      return formatErrorResponse(`Kesalahan dari Google Colab API: ${response.status}`);
    }

    // Parse respons dari Colab
    const result = await response.json();

    // Format respons sesuai dengan apa yang dikembalikan oleh Colab
    // Colab mungkin mengembalikan format yang berbeda, disesuaikan
    let aiResponse;

    if (typeof result.generated_text === 'string') {
      aiResponse = result.generated_text;
    } else if (typeof result.text === 'string') {
      aiResponse = result.text;
    } else if (typeof result.response === 'string') {
      aiResponse = result.response;
    } else if (typeof result.output === 'string') {
      aiResponse = result.output;
    } else if (typeof result.output === 'string') {
      aiResponse = result.result;
    } else {
      // Fallback, kembalikan JSON string jika format tidak dikenal
      aiResponse = JSON.stringify(result);
    }

    console.log('Colab AI response:', aiResponse);
    return formatSuccessResponse(aiResponse);
  } catch (error) {
    console.error('Error generating Colab response:', error);
    return formatErrorResponse('Terjadi kesalahan saat menghasilkan respons dari Google Colab.');
  }
}

// Handler untuk model VLLM
async function handleVLLMRequest(messages: OpenAIMessage[], config: ModelConfig) {
  try {
    // Validasi konfigurasi yang diperlukan
    if (!config.vllm_endpoint) {
      return formatErrorResponse('URL Endpoint diperlukan untuk menggunakan model VLLM.');
    }

    // Gunakan endpoint apa adanya, tanpa modifikasi
    let endpoint = config.vllm_endpoint.trim();

    console.log(`Mencoba menghubungi endpoint VLLM: ${endpoint}`);

    // Format pesan ke format OpenAI
    const formattedMessages = messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    // Buat payload sesuai dengan format OpenAI chat completion
    const payload = {
      model: 'any', // Parameter model default sesuai contoh
      messages: formattedMessages,
      max_tokens: 512
    };

    // Panggil API VLLM dengan timeout yang lebih panjang
    let response;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 detik timeout

      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
    } catch (fetchError: any) {
      console.error('Fetch error details:', fetchError);
      return formatErrorResponse(`Gagal terhubung ke endpoint VLLM. Detail error: ${fetchError.message}`);
    }

    if (!response.ok) {
      const errorDetails = await response.text();
      console.error('VLLM API error. Status:', response.status, 'Details:', errorDetails);
      return formatErrorResponse(`Kesalahan dari VLLM API: ${response.status}. ${errorDetails}`);
    }

    // Parse respons dari VLLM
    const result = await response.json();
    console.log('VLLM response raw:', JSON.stringify(result).substring(0, 200) + '...');

    // Format respons dari OpenAI-compatible API
    let aiResponse;

    if (result.choices && result.choices.length > 0 && result.choices[0].message) {
      aiResponse = result.choices[0].message.content;
    } else if (typeof result.generated_text === 'string') {
      aiResponse = result.generated_text;
    } else if (typeof result.text === 'string') {
      aiResponse = result.text;
    } else {
      // Fallback, kembalikan JSON string jika format tidak dikenal
      aiResponse = JSON.stringify(result);
    }

    console.log('VLLM AI response:', aiResponse);
    return formatSuccessResponse(aiResponse);
  } catch (error) {
    console.error('Error generating VLLM response:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return formatErrorResponse(`Terjadi kesalahan saat menghasilkan respons dari VLLM: ${errorMessage}`);
  }
}

// Fungsi helper untuk memformat respons sukses
function formatSuccessResponse(text: string) {
  const response = {
    choices: [
      {
        message: {
          role: 'assistant',
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
          role: 'assistant',
          content: errorMessage
        }
      }
    ]
  }), {
    status: 500,
    headers: { 'Content-Type': 'application/json' },
  });
}
