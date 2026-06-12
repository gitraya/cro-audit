import { GoogleGenerativeAI, TaskType } from "@google/generative-ai";
import { createServiceSupabaseClient } from "../supabase/admin.ts";

export type BalancedPrinciplesInput = {
  title: string | null;
  description: string | null;
  headings: {
    h1: string[];
    h2: string[];
  };
  bodyText: string;
  pageSpeedSummary?: string | null;
};

export type BalancedPrinciple = {
  id: string;
  book_title: string;
  book_author: string;
  principle: string;
  explanation: string;
  cro_application: string;
  distance: number;
  similarity: number;
};

type BookTitleRow = {
  book_title: string;
};

type BookPrincipleRpcRow = BalancedPrinciple;

type BookPrinciplesClient = {
  from: (table: "book_principles") => {
    select: (
      columns: "book_title",
    ) => PromiseLike<{
      data: BookTitleRow[] | null;
      error: { message: string } | null;
    }>;
  };
  rpc: (
    fn: "match_principles_by_book",
    args: {
      query_embedding: string;
      target_book: string;
      match_count: number;
    },
  ) => PromiseLike<{
    data: BookPrincipleRpcRow[] | null;
    error: { message: string } | null;
  }>;
};

const EMBEDDING_MODEL = "models/gemini-embedding-001";
const EMBEDDING_DIMENSIONS = 768;
const QUERY_BODY_LIMIT = 4_000;
const PRINCIPLES_PER_BOOK = 3;

export async function retrieveBalancedPrinciples(
  inputs: BalancedPrinciplesInput,
  options: {
    supabase?: BookPrinciplesClient;
    embedder?: (text: string) => Promise<number[]>;
  } = {},
): Promise<BalancedPrinciple[]> {
  const supabase = (options.supabase ??
    (createServiceSupabaseClient() as unknown as BookPrinciplesClient)) as BookPrinciplesClient;
  const embedder = options.embedder ?? createGeminiEmbedder();
  const queryText = buildBalancedPrinciplesQueryText(inputs);
  const queryEmbedding = await embedder(queryText);
  const queryEmbeddingVector = toPgVector(queryEmbedding);
  const bookTitles = await getDistinctBookTitles(supabase);

  const perBookResults = await Promise.all(
    bookTitles.map(async (bookTitle) => {
      const { data, error } = await supabase.rpc("match_principles_by_book", {
        query_embedding: queryEmbeddingVector,
        target_book: bookTitle,
        match_count: PRINCIPLES_PER_BOOK,
      });

      if (error) {
        throw new Error(`Failed to retrieve principles for ${bookTitle}: ${error.message}`);
      }

      return data ?? [];
    }),
  );

  return perBookResults
    .flat()
    .sort(
      (left, right) =>
        right.similarity - left.similarity ||
        left.book_title.localeCompare(right.book_title) ||
        left.principle.localeCompare(right.principle),
    );
}

export function buildBalancedPrinciplesQueryText(inputs: BalancedPrinciplesInput) {
  const parts = [
    inputs.title ? `Title: ${inputs.title}` : null,
    inputs.description ? `Description: ${inputs.description}` : null,
    inputs.headings.h1.length > 0 ? `H1: ${inputs.headings.h1.join(" | ")}` : null,
    inputs.headings.h2.length > 0 ? `H2: ${inputs.headings.h2.join(" | ")}` : null,
    `Body excerpt: ${inputs.bodyText.slice(0, QUERY_BODY_LIMIT)}`,
    inputs.pageSpeedSummary ? `PageSpeed summary: ${inputs.pageSpeedSummary}` : null,
  ];

  return parts.filter((part): part is string => Boolean(part)).join("\n");
}

async function getDistinctBookTitles(supabase: BookPrinciplesClient) {
  const { data, error } = await supabase.from("book_principles").select("book_title");

  if (error) {
    throw new Error(`Failed to read book titles: ${error.message}`);
  }

  return [...new Set((data ?? []).map((row) => row.book_title))].sort((left, right) =>
    left.localeCompare(right),
  );
}

function createGeminiEmbedder() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY environment variable");
  }

  const client = new GoogleGenerativeAI(apiKey);
  const model = client.getGenerativeModel({ model: EMBEDDING_MODEL });

  return async (text: string) => {
    const response = await model.embedContent({
      content: {
        role: "user",
        parts: [{ text }],
      },
      taskType: TaskType.RETRIEVAL_QUERY,
      outputDimensionality: EMBEDDING_DIMENSIONS,
    } as unknown as Parameters<typeof model.embedContent>[0]);

    const embedding = response.embedding?.values ?? [];

    if (embedding.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(
        `Expected ${EMBEDDING_DIMENSIONS} embedding dimensions, received ${embedding.length}.`,
      );
    }

    return normalizeVector(embedding);
  };
}

function normalizeVector(values: number[]) {
  const magnitude = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));

  return magnitude === 0 ? values : values.map((value) => value / magnitude);
}

function toPgVector(values: number[]) {
  return `[${values.join(",")}]`;
}
