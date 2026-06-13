import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import type { ResponseSchema } from "@google/generative-ai";
import type {
  BalancedPrinciple,
  BalancedPrinciplesInput,
} from "./retrieval.ts";

export type AuditFinding = {
  observation: string;
  solution: string;
  principle: string;
  source_book: string;
};

export type GeneratedAudit = {
  findings: AuditFinding[];
};

type GeminiAuditModel = {
  generateContent: (prompt: string) => Promise<{
    response: {
      text: () => string;
    };
  }>;
};

const AUDIT_MODEL = "gemini-2.5-flash";
const SYSTEM_INSTRUCTION = [
  "You are a conversion rate optimization auditor.",
  "You will be given a balanced set of grounding principles drawn from MULTIPLE source books. Your findings must reflect that diversity.",

  // Hard distribution rules — no soft language, no escape hatches.
  "DISTRIBUTION REQUIREMENTS (these are mandatory, not preferences):",
  "- Produce exactly 5-7 findings.",
  "- The findings MUST collectively cite at least 3 different principles.",
  "- The findings MUST draw from EVERY source book that has a clearly applicable principle in the provided set. Do not leave a book entirely unused unless none of its principles plausibly apply to this page.",
  "- No single principle may be cited by more than 2 findings.",
  "- No single source book may account for more than half of the findings.",

  // Force the model to reason about fit per-principle, not pick the easy one.
  "PRINCIPLE SELECTION:",
  "- For each finding, select the principle that fits the specific problem MOST PRECISELY. Generic principles (e.g. reducing noise/clutter) are a last resort, not a default.",
  "- A performance/speed problem maps to a speed/clarity principle, not a generic friction principle.",
  "- A trust/credibility gap maps to a social-proof or authority principle.",
  "- A messaging/value-proposition problem maps to a clarity or storytelling principle.",
  "- Before assigning a generic principle, first check whether a more specific principle from ANY book fits better.",

  // Grounding integrity.
  "Ground every finding ONLY in the provided principles. Cite the principle name and source book verbatim.",
  "Describe specific problems on THIS page using its actual content — not generic advice.",
  "Connect to PageSpeed data when relevant to the observed issue.",
  "Each finding must address one distinct issue; do not merge distinct issues.",

  // Self-check before output.
  "FINAL CHECK before returning: Count how many findings cite each source book. If any book with an applicable principle is unused, or if one book exceeds half the findings, REASSIGN findings to better-fitting principles from the underused books. Only output once the distribution requirements are satisfied.",
].join(" ");

const AUDIT_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    findings: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          observation: {
            type: SchemaType.STRING,
          },
          solution: {
            type: SchemaType.STRING,
          },
          principle: {
            type: SchemaType.STRING,
          },
          source_book: {
            type: SchemaType.STRING,
          },
        },
        required: ["observation", "solution", "principle", "source_book"],
      },
    },
  },
  required: ["findings"],
} satisfies ResponseSchema;

export async function generateAudit(
  inputs: BalancedPrinciplesInput,
  principles: BalancedPrinciple[],
  options: {
    model?: GeminiAuditModel;
  } = {},
): Promise<GeneratedAudit> {
  const model = options.model ?? createGeminiAuditModel();
  const prompt = buildAuditPrompt(inputs, principles);
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const result = await model.generateContent(prompt);
      return parseAuditJson(result.response.text());
    } catch (error) {
      lastError = error;

      if (!isParseError(error) || attempt === 1) {
        throw new Error(
          `Gemini audit generation failed: ${errorMessage(error)}`,
        );
      }
    }
  }

  throw new Error(
    `Gemini audit generation failed after retry: ${errorMessage(lastError)}`,
  );
}

function createGeminiAuditModel(): GeminiAuditModel {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY environment variable");
  }

  const client = new GoogleGenerativeAI(apiKey);
  const model = client.getGenerativeModel({
    model: AUDIT_MODEL,
    systemInstruction: SYSTEM_INSTRUCTION,
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: AUDIT_SCHEMA,
    },
  });

  return {
    generateContent: (prompt: string) => model.generateContent(prompt),
  };
}

function buildAuditPrompt(
  inputs: BalancedPrinciplesInput,
  principles: BalancedPrinciple[],
) {
  return JSON.stringify(
    {
      page: {
        title: inputs.title,
        description: inputs.description,
        headings: inputs.headings,
        bodyText: inputs.bodyText.slice(0, 4_000),
        pageSpeedSummary: inputs.pageSpeedSummary ?? null,
      },
      principles: principles.map((principle) => ({
        book_title: principle.book_title,
        book_author: principle.book_author,
        principle: principle.principle,
        explanation: principle.explanation,
        cro_application: principle.cro_application,
        similarity: principle.similarity,
      })),
    },
    null,
    2,
  );
}

function parseAuditJson(text: string): GeneratedAudit {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new ParseError(
      `Gemini returned invalid audit JSON: ${errorMessage(error)}`,
    );
  }

  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error("Gemini returned malformed audit JSON");
  }

  const record = parsed as Record<string, unknown>;
  const findings = Array.isArray(record.findings) ? record.findings : null;

  if (!findings) {
    throw new Error("Gemini audit JSON did not include findings");
  }

  return {
    findings: findings.map(validateFindingRecord),
  };
}

function validateFindingRecord(value: unknown): AuditFinding {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    throw new Error("Gemini audit finding must be an object");
  }

  const record = value as Record<string, unknown>;
  const observation = getRequiredString(record, "observation");
  const solution = getRequiredString(record, "solution");
  const principle = getRequiredString(record, "principle");
  const source_book = getRequiredString(record, "source_book");

  return {
    observation,
    solution,
    principle,
    source_book,
  };
}

function getRequiredString(record: Record<string, unknown>, key: string) {
  const value = record[key];

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Gemini audit finding is missing valid ${key}`);
  }

  return value.trim();
}

function isParseError(error: unknown) {
  return error instanceof ParseError;
}

class ParseError extends Error {}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
