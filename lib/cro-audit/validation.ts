import type { AuditFinding, GeneratedAudit } from "./generation.ts";

export type ProvidedPrinciple = {
  book_title: string;
  principle: string;
};

export type ValidationResult = {
  validFindings: AuditFinding[];
  rejectedFindings: Array<{
    finding: AuditFinding;
    reason: string;
  }>;
  sourceCoverage: Record<string, number>;
  collapsedToSingleSource: boolean;
};

export function validateAudit(
  audit: GeneratedAudit,
  providedPrinciples: ProvidedPrinciple[],
): ValidationResult {
  const exactMatches = new Map<string, ProvidedPrinciple>();
  const principleMatches = new Map<string, ProvidedPrinciple>();

  for (const principle of providedPrinciples) {
    const exactKey = makePairKey(principle.book_title, principle.principle);
    const principleKey = normalizeKey(principle.principle);

    exactMatches.set(exactKey, principle);

    if (!principleMatches.has(principleKey)) {
      principleMatches.set(principleKey, principle);
    }
  }

  const validFindings: AuditFinding[] = [];
  const rejectedFindings: ValidationResult["rejectedFindings"] = [];

  for (const finding of audit.findings ?? []) {
    const normalizedFinding = normalizeFinding(finding);
    const exactMatch = exactMatches.get(
      makePairKey(normalizedFinding.source_book, normalizedFinding.principle),
    );

    if (exactMatch) {
      validFindings.push(normalizedFinding);
      continue;
    }

    const principleMatch = principleMatches.get(normalizeKey(normalizedFinding.principle));

    if (principleMatch) {
      validFindings.push({
        ...normalizedFinding,
        source_book: principleMatch.book_title,
      });
      continue;
    }

    rejectedFindings.push({
      finding: normalizedFinding,
      reason: "Principle not present in the provided set.",
    });
  }

  const sourceCoverage = validFindings.reduce<Record<string, number>>(
    (coverage, finding) => {
      coverage[finding.source_book] = (coverage[finding.source_book] ?? 0) + 1;
      return coverage;
    },
    {},
  );

  return {
    validFindings,
    rejectedFindings,
    sourceCoverage,
    collapsedToSingleSource:
      validFindings.length >= 3 && Object.keys(sourceCoverage).length <= 1,
  };
}

function normalizeFinding(finding: AuditFinding): AuditFinding {
  return {
    observation: finding.observation.trim(),
    solution: finding.solution.trim(),
    principle: finding.principle.trim(),
    source_book: finding.source_book.trim(),
  };
}

function makePairKey(bookTitle: string, principle: string) {
  return `${normalizeKey(bookTitle)}::${normalizeKey(principle)}`;
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase();
}
