import { GoogleGenerativeAI, TaskType } from "@google/generative-ai";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServiceSupabaseClient } from "../lib/supabase/admin.ts";

type BookPrincipleInput = {
  book_title: string;
  book_author: string;
  principle: string;
  explanation: string;
  cro_application: string;
};

type BookPrincipleRow = BookPrincipleInput & {
  embedding: string;
};

const EMBEDDING_MODEL = "models/gemini-embedding-001";
const EMBEDDING_DIMENSIONS = 768;
const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 1_000;
const INPUT_FILE = "book-principles.json";

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY.");
  }

  const principles = await readPrinciples(INPUT_FILE);
  const gemini = new GoogleGenerativeAI(apiKey);
  const model = gemini.getGenerativeModel({ model: EMBEDDING_MODEL });
  const supabase = createServiceSupabaseClient();
  const insertedByBook = new Map<string, number>();

  console.log(
    `Seeding ${principles.length} principles with ${EMBEDDING_MODEL} (${EMBEDDING_DIMENSIONS} dimensions).`,
  );
  console.log("Idempotency: upserting on natural key (book_title, principle).");

  let embeddedCount = 0;
  let insertedCount = 0;

  for (let index = 0; index < principles.length; index += BATCH_SIZE) {
    const batch = principles.slice(index, index + BATCH_SIZE);
    const embeddings = await embedBatch(model, batch);

    const rows: BookPrincipleRow[] = batch.map((principle, batchIndex) => ({
      ...principle,
      embedding: toPgVector(embeddings[batchIndex]),
    }));

    const { error } = await supabase.from("book_principles").upsert(rows, {
      onConflict: "book_title,principle",
    });

    if (error) {
      throw new Error(`Failed to upsert principles: ${error.message}`);
    }

    embeddedCount += batch.length;
    insertedCount += batch.length;

    for (const row of rows) {
      insertedByBook.set(
        row.book_title,
        (insertedByBook.get(row.book_title) ?? 0) + 1,
      );
    }

    console.log(
      `Embedded and upserted ${embeddedCount}/${principles.length} principles.`,
    );

    if (index + BATCH_SIZE < principles.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  console.log(
    `Done. Embedded ${embeddedCount} principles and upserted ${insertedCount} rows.`,
  );
  console.log("Per-book totals:");

  for (const [bookTitle, count] of [...insertedByBook.entries()].sort()) {
    console.log(`- ${bookTitle}: ${count}`);
  }
}

async function readPrinciples(filePath: string) {
  const raw = await readFile(resolve(process.cwd(), filePath), "utf8");
  const data: unknown = JSON.parse(raw);

  if (!Array.isArray(data)) {
    throw new Error(`${filePath} must contain an array.`);
  }

  return data.map(validatePrinciple);
}

function validatePrinciple(value: unknown, index: number): BookPrincipleInput {
  if (!value || typeof value !== "object") {
    throw new Error(`Principle at index ${index} must be an object.`);
  }

  const record = value as Record<string, unknown>;
  const principle = {
    book_title: getRequiredString(record, "book_title", index),
    book_author: getRequiredString(record, "book_author", index),
    principle: getRequiredString(record, "principle", index),
    explanation: getRequiredString(record, "explanation", index),
    cro_application: getRequiredString(record, "cro_application", index),
  };

  return principle;
}

function getRequiredString(
  record: Record<string, unknown>,
  key: string,
  index: number,
) {
  const value = record[key];

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Principle at index ${index} has invalid ${key}.`);
  }

  return value.trim();
}

async function embedBatch(
  model: ReturnType<GoogleGenerativeAI["getGenerativeModel"]>,
  principles: BookPrincipleInput[],
) {
  const response = await model.batchEmbedContents({
    requests: principles.map((principle) => ({
      content: {
        role: "user",
        parts: [{ text: embeddingText(principle) }],
      },
      taskType: TaskType.RETRIEVAL_DOCUMENT,
      title: principle.principle,
      outputDimensionality: EMBEDDING_DIMENSIONS,
    })),
  });

  if (response.embeddings.length !== principles.length) {
    throw new Error(
      `Expected ${principles.length} embeddings, received ${response.embeddings.length}.`,
    );
  }

  return response.embeddings.map((embedding, index) => {
    if (embedding.values.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(
        `Embedding dimension mismatch for "${principles[index].principle}": expected ${EMBEDDING_DIMENSIONS}, received ${embedding.values.length}.`,
      );
    }

    return normalize(embedding.values);
  });
}

function normalize(values: number[]) {
  const magnitude = Math.sqrt(values.reduce((sum, v) => sum + v * v, 0));
  return magnitude === 0 ? values : values.map((v) => v / magnitude);
}

function embeddingText(principle: BookPrincipleInput) {
  return `${principle.principle}. ${principle.explanation} ${principle.cro_application}`;
}

function toPgVector(values: number[]) {
  return `[${values.join(",")}]`;
}

function sleep(ms: number) {
  return new Promise((resolveSleep) => {
    setTimeout(resolveSleep, ms);
  });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
