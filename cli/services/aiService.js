import process from "node:process";
import { createCacheKey, readCache, writeCache } from "./cacheService.js";
import { buildPrompt } from "./promptService.js";

const SUPPORTED_PROVIDERS = new Set([
  "openai",
  "groq",
  "openrouter",
  "gemini",
  "ollama",
  "chutes"
]);
const SYSTEM_PROMPT = "You explain Git commits clearly and accurately for developers.";

export function getProviderConfig(providerOverride, modelOverride) {
  const provider = (providerOverride ?? process.env.LLM_PROVIDER ?? "openai").toLowerCase();

  if (!SUPPORTED_PROVIDERS.has(provider)) {
    throw new Error(
      `Unsupported provider "${provider}". Supported providers: ${[...SUPPORTED_PROVIDERS].join(", ")}.`
    );
  }

  if (provider === "openai") {
    return {
      provider,
      apiKey: process.env.OPENAI_API_KEY,
      baseUrl: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
      model: modelOverride ?? process.env.OPENAI_MODEL ?? process.env.LLM_MODEL ?? "gpt-4.1-mini"
    };
  }

  if (provider === "groq") {
    return {
      provider,
      apiKey: process.env.GROQ_API_KEY,
      baseUrl: process.env.GROQ_BASE_URL ?? "https://api.groq.com/openai/v1",
      model: modelOverride ?? process.env.GROQ_MODEL ?? process.env.LLM_MODEL ?? "llama-3.3-70b-versatile"
    };
  }

  if (provider === "openrouter") {
    return {
      provider,
      apiKey: process.env.OPENROUTER_API_KEY,
      baseUrl: process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
      model: modelOverride ?? process.env.OPENROUTER_MODEL ?? process.env.LLM_MODEL ?? "openai/gpt-4.1-mini"
    };
  }

  if (provider === "gemini") {
    return {
      provider,
      apiKey: process.env.GEMINI_API_KEY,
      baseUrl:
        process.env.GEMINI_BASE_URL ?? "https://generativelanguage.googleapis.com/v1beta",
      model: modelOverride ?? process.env.GEMINI_MODEL ?? process.env.LLM_MODEL ?? "gemini-2.5-flash"
    };
  }

  if (provider === "chutes") {
    return {
      provider,
      apiKey: process.env.CHUTES_API_KEY,
      baseUrl: process.env.CHUTES_BASE_URL ?? "https://llm.chutes.ai/v1",
      model:
        modelOverride ??
        process.env.CHUTES_MODEL ??
        process.env.LLM_MODEL ??
        "deepseek-ai/DeepSeek-V3-0324"
    };
  }

  return {
    provider,
    apiKey: process.env.OLLAMA_API_KEY ?? "ollama",
    baseUrl: process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434/v1",
    model: modelOverride ?? process.env.OLLAMA_MODEL ?? process.env.LLM_MODEL ?? "llama3.2"
  };
}

export function validateProviderConfig(config) {
  if (!config.model) {
    throw new Error(`No model configured for provider "${config.provider}".`);
  }

  if (config.provider !== "ollama" && !config.apiKey) {
    throw new Error(`Missing API key for provider "${config.provider}".`);
  }
}

function buildOpenAICompatibleHeaders(config) {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.apiKey}`
  };

  if (config.provider === "openrouter") {
    headers["HTTP-Referer"] = process.env.OPENROUTER_SITE_URL ?? "https://github.com";
    headers["X-Title"] = process.env.OPENROUTER_APP_NAME ?? "gitxplain";
  }

  return headers;
}

function extractUsage(data) {
  return data.usage ?? null;
}

function extractOpenAIContent(data) {
  return data.choices?.[0]?.message?.content?.trim() || "No explanation returned by the model.";
}

function extractGeminiText(data) {
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  return parts
    .map((part) => part.text)
    .filter(Boolean)
    .join("\n");
}

async function consumeSseStream(response, getChunkText, onChunk) {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Streaming is not supported by this runtime.");
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const event of events) {
      const dataLines = event
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .filter(Boolean);

      for (const line of dataLines) {
        if (line === "[DONE]") {
          continue;
        }

        const parsed = JSON.parse(line);
        const chunkText = getChunkText(parsed);
        if (!chunkText) {
          continue;
        }

        fullText += chunkText;
        onChunk?.(chunkText);
      }
    }
  }

  return fullText.trim();
}

async function requestOpenAICompatible(config, prompt, options) {
  const startedAt = Date.now();
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: buildOpenAICompatibleHeaders(config),
    body: JSON.stringify({
      model: config.model,
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.2,
      stream: options.stream === true
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`${config.provider} request failed (${response.status}): ${errorText}`);
  }

  if (options.stream) {
    const explanation = await consumeSseStream(
      response,
      (data) => {
        const content = data.choices?.[0]?.delta?.content;
        if (typeof content === "string") {
          return content;
        }

        if (Array.isArray(content)) {
          return content.map((item) => item.text ?? "").join("");
        }

        return "";
      },
      options.onChunk
    );

    return {
      explanation,
      responseMeta: {
        provider: config.provider,
        model: config.model,
        cacheHit: false,
        latencyMs: Date.now() - startedAt,
        usage: null
      }
    };
  }

  const data = await response.json();
  return {
    explanation: extractOpenAIContent(data),
    responseMeta: {
      provider: config.provider,
      model: config.model,
      cacheHit: false,
      latencyMs: Date.now() - startedAt,
      usage: extractUsage(data)
    }
  };
}

async function requestGemini(config, prompt, options) {
  const startedAt = Date.now();
  const endpoint = options.stream
    ? `${config.baseUrl}/models/${config.model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(config.apiKey)}`
    : `${config.baseUrl}/models/${config.model}:generateContent?key=${encodeURIComponent(config.apiKey)}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [
          {
            text: SYSTEM_PROMPT
          }
        ]
      },
      contents: [
        {
          role: "user",
          parts: [
            {
              text: prompt
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.2
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`gemini request failed (${response.status}): ${errorText}`);
  }

  if (options.stream) {
    const explanation = await consumeSseStream(response, extractGeminiText, options.onChunk);
    return {
      explanation,
      responseMeta: {
        provider: config.provider,
        model: config.model,
        cacheHit: false,
        latencyMs: Date.now() - startedAt,
        usage: null
      }
    };
  }

  const data = await response.json();
  return {
    explanation: extractGeminiText(data).trim() || "No explanation returned by the model.",
    responseMeta: {
      provider: config.provider,
      model: config.model,
      cacheHit: false,
      latencyMs: Date.now() - startedAt,
      usage: data.usageMetadata ?? null
    }
  };
}

export async function generateExplanation({
  mode,
  commitData,
  providerOverride,
  modelOverride,
  maxDiffLines,
  stream = false,
  onChunk = null,
  onStart = null
}) {
  const config = getProviderConfig(providerOverride, modelOverride);
  validateProviderConfig(config);

  const { prompt, promptMeta } = buildPrompt(mode, commitData, { maxDiffLines });
  onStart?.({
    promptMeta,
    provider: config.provider,
    model: config.model
  });

  const cacheKey = createCacheKey({
    targetRef: commitData.targetRef,
    mode,
    provider: config.provider,
    model: config.model,
    prompt
  });
  const cached = readCache(cacheKey);

  if (cached) {
    return {
      explanation: cached.explanation,
      promptMeta,
      responseMeta: {
        ...cached.responseMeta,
        cacheHit: true
      }
    };
  }

  const requestOptions = { stream, onChunk };
  const result =
    config.provider === "gemini"
      ? await requestGemini(config, prompt, requestOptions)
      : await requestOpenAICompatible(config, prompt, requestOptions);

  writeCache(cacheKey, {
    explanation: result.explanation,
    responseMeta: result.responseMeta
  });

  return {
    explanation: result.explanation,
    promptMeta,
    responseMeta: result.responseMeta
  };
}
