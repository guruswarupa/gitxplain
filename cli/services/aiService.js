import process from "node:process";
import { buildPrompt } from "./promptService.js";

const SUPPORTED_PROVIDERS = new Set(["openai", "groq", "openrouter", "gemini", "ollama"]);
const SYSTEM_PROMPT = "You explain Git commits clearly and accurately for developers.";

function getProviderConfig(providerOverride, modelOverride) {
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

  return {
    provider,
    apiKey: process.env.OLLAMA_API_KEY ?? "ollama",
    baseUrl: process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434/v1",
    model: modelOverride ?? process.env.OLLAMA_MODEL ?? process.env.LLM_MODEL ?? "llama3.2"
  };
}

function validateProviderConfig(config) {
  if (!config.model) {
    throw new Error(`No model configured for provider "${config.provider}".`);
  }

  if (config.provider !== "ollama" && !config.apiKey) {
    throw new Error(`Missing API key for provider "${config.provider}".`);
  }
}

async function requestOpenAICompatible(config, prompt) {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.apiKey}`
  };

  if (config.provider === "openrouter") {
    headers["HTTP-Referer"] = process.env.OPENROUTER_SITE_URL ?? "https://github.com";
    headers["X-Title"] = process.env.OPENROUTER_APP_NAME ?? "gitxplain";
  }

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers,
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
      temperature: 0.2
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`${config.provider} request failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || "No explanation returned by the model.";
}

function extractGeminiText(data) {
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  return parts
    .map((part) => part.text)
    .filter(Boolean)
    .join("\n")
    .trim();
}

async function requestGemini(config, prompt) {
  const response = await fetch(
    `${config.baseUrl}/models/${config.model}:generateContent?key=${encodeURIComponent(config.apiKey)}`,
    {
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
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`gemini request failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return extractGeminiText(data) || "No explanation returned by the model.";
}

export async function generateExplanation({ mode, commitData, providerOverride, modelOverride }) {
  const config = getProviderConfig(providerOverride, modelOverride);
  validateProviderConfig(config);
  const prompt = buildPrompt(mode, commitData);

  if (config.provider === "gemini") {
    return requestGemini(config, prompt);
  }

  return requestOpenAICompatible(config, prompt);
}
