import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import type { ResponseSchema } from "@google/generative-ai";
import type { VoiceProvider, VoiceTokens } from "../extraction.ts";

export const GEMINI_VOICE_MODEL = "gemini-2.5-flash";

const BODY_TEXT_LIMIT = 4_000;
const VOICE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    tone: {
      type: SchemaType.STRING,
    },
    formality: {
      type: SchemaType.STRING,
      format: "enum",
      enum: ["casual", "neutral", "formal"],
    },
    phrases: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.STRING,
      },
    },
  },
  required: ["tone", "formality", "phrases"],
} satisfies ResponseSchema;

const SYSTEM_INSTRUCTION = [
  "You are a brand voice analyst.",
  "Analyze only the provided page content: title, description, headings, and body text.",
  "Do not invent phrases, taglines, claims, or wording that is not present in the content.",
  "Return formality as exactly one of: casual, neutral, formal.",
  "Return tone as a short 2-4 word description.",
  "Return up to 3 characteristic phrases or taglines actually found in the text.",
].join(" ");

export function createGeminiVoiceProvider(): VoiceProvider {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY environment variable");
  }

  const client = new GoogleGenerativeAI(apiKey);
  const model = client.getGenerativeModel({
    model: GEMINI_VOICE_MODEL,
    systemInstruction: SYSTEM_INSTRUCTION,
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: VOICE_SCHEMA,
    },
  });

  return async (input) => {
    const prompt = buildPrompt(input);
    const pageText = buildPageText(input);
    let lastError: unknown;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const result = await model.generateContent(prompt);
        const parsed = parseVoiceJson(result.response.text());

        return normalizeGeminiVoiceTokens(parsed, pageText);
      } catch (error) {
        lastError = error;
      }
    }

    throw new Error(
      `Gemini voice extraction failed after retry: ${errorMessage(lastError)}`,
    );
  };
}

function buildPrompt(input: Parameters<VoiceProvider>[0]) {
  return JSON.stringify(
    {
      url: input.url,
      title: input.title,
      description: input.description,
      headings: input.headings,
      bodyText: input.bodyText.slice(0, BODY_TEXT_LIMIT),
    },
    null,
    2,
  );
}

function buildPageText(input: Parameters<VoiceProvider>[0]) {
  return [
    input.title,
    input.description,
    ...input.headings.h1,
    ...input.headings.h2,
    ...input.headings.h3,
    input.bodyText.slice(0, BODY_TEXT_LIMIT),
  ]
    .filter((value): value is string => Boolean(value))
    .join("\n")
    .toLowerCase();
}

function parseVoiceJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Gemini returned invalid voice JSON: ${errorMessage(error)}`);
  }
}

function normalizeGeminiVoiceTokens(
  value: unknown,
  pageText: string,
): VoiceTokens {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    throw new Error("Gemini returned malformed voice JSON");
  }

  const record = value as Record<string, unknown>;
  const tone = typeof record.tone === "string" ? record.tone.trim() : "";
  const phrases = Array.isArray(record.phrases) ? record.phrases : [];

  return {
    tone,
    formality: normalizeFormality(record.formality),
    phrases: phrases
      .filter((phrase): phrase is string => typeof phrase === "string")
      .map((phrase) => phrase.trim())
      .filter((phrase) => phrase.length > 0)
      .filter((phrase) => pageText.includes(phrase.toLowerCase()))
      .slice(0, 3),
  };
}

function normalizeFormality(value: unknown): VoiceTokens["formality"] {
  return value === "casual" || value === "formal" || value === "neutral"
    ? value
    : "neutral";
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
