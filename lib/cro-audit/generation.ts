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
  "Ground every finding only in the provided principles.",
  "Cite the principle name and source book verbatim from the provided principles.",
  "Describe specific problems on this page, not generic advice.",
  "Connect to PageSpeed data when it is relevant to the observed issue.",
  "Use different books when the page genuinely warrants it, but do not force balance.",
  "Do not collapse distinct issues into one finding.",
  "Produce 5-7 findings.",
  "The grounding set contains principles from MULTIPLE books. The findings as a whole MUST draw on at least 3 DIFFERENT principles, and SHOULD span at least 2 different source books where the page genuinely warrants it.",
  "Do NOT ground more than 2 findings in the same principle. If multiple problems seem to fit one generic principle, choose the MORE SPECIFIC applicable principle for each instead of repeating the generic one.",
  'Match each finding to the principle that fits it MOST SPECIFICALLY, not the most broadly applicable one. (e.g. a slow-load/performance problem should map to a performance/speed-related principle, not a generic "reduce noise" principle.)',
  "Before finalizing, check: are findings clustered on one book? If so, re-evaluate whether some genuinely map better to principles from other provided books.",
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
