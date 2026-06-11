import type { ScrapedHomepage } from "../scraper/homepage.ts";
import { normalizedCacheKey } from "../url/cache-key.ts";
import { readCachedVoice, writeCachedVoice } from "./voice-cache.ts";

export type BrandTokens = {
  colors: string[];
  font: {
    primary: string | null;
    fallbacks: string[];
  };
  voice: {
    tone: string;
    formality: "casual" | "neutral" | "formal";
    phrases: string[];
  };
  extraction_method: {
    colors: string;
    font: string;
    voice: string;
  };
};

export type VoiceTokens = BrandTokens["voice"];

export type VoiceProvider = (input: {
  url: string;
  title: string | null;
  description: string | null;
  headings: ScrapedHomepage["headings"];
  bodyText: string;
}) => Promise<VoiceTokens>;

type Color = {
  red: number;
  green: number;
  blue: number;
  alpha: number;
  hex: string;
};

const GENERIC_FONT_FAMILIES = new Set([
  "arial",
  "cursive",
  "fantasy",
  "inherit",
  "initial",
  "monospace",
  "sans-serif",
  "serif",
  "system-ui",
  "ui-monospace",
  "ui-rounded",
  "ui-sans-serif",
  "ui-serif",
  "unset",
]);
const ICON_FONT_PATTERN =
  /(^|\s)(fontawesome|font awesome|icomoon|ionicons|material icons|octicons)(\s|$)/i;

export async function extractBrandTokens(
  scraped: ScrapedHomepage,
  voiceProvider?: VoiceProvider,
): Promise<BrandTokens> {
  const colors = extractColors(scraped.styles.cssText, scraped.html);
  const font = extractFont(scraped.styles.cssText);
  const voice = await extractVoice(scraped, voiceProvider);

  return {
    colors,
    font,
    voice,
    extraction_method: {
      colors:
        "Deterministic CSS parser ranks real CSS and theme metadata colors, filters transparent and neutral values, and returns up to 3 found hex values with no invented fallbacks.",
      font:
        "Deterministic CSS parser ranks real font-family declarations from CSS variables, document root, and body-level rules; generic and icon fonts are excluded and no font is invented.",
      voice: voiceProvider
        ? "URL-cached voice extraction from page copy; first run may use the configured LLM provider, repeat runs for the same final URL return cached tokens without invented defaults."
        : "URL-cached deterministic voice extraction from title, meta description, headings, and body copy; no LLM provider configured and no defaults are invented.",
    },
  };
}

export function extractColors(cssText: string, html = ""): string[] {
  const candidates = new Map<
    string,
    {
      score: number;
      firstIndex: number;
      isNeutral: boolean;
    }
  >();
  const cssVariables = extractColorVariables(cssText);

  for (const match of html.matchAll(
    /<meta\s+[^>]*(?:name=["'](?:theme-color|msapplication-TileColor)["'][^>]*content=["']([^"']+)["']|content=["']([^"']+)["'][^>]*name=["'](?:theme-color|msapplication-TileColor)["'])[^>]*>/gi,
  )) {
    const color = parseCssColor(match[1] ?? match[2] ?? "");

    if (color && color.alpha >= 0.2) {
      addColorCandidate(
        candidates,
        color.hex,
        4,
        match.index ?? 0,
        isNeutralColor(color),
      );
    }
  }

  for (const match of cssText.matchAll(
    /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{4}|[0-9a-f]{3})\b/gi,
  )) {
    addParsedColor(candidates, cssText, match[0], match.index ?? 0);
  }

  for (const match of cssText.matchAll(/rgba?\(\s*[^)]+\)/gi)) {
    addParsedColor(candidates, cssText, match[0], match.index ?? 0);
  }

  for (const match of cssText.matchAll(/hsla?\(\s*[^)]+\)/gi)) {
    addParsedColor(candidates, cssText, match[0], match.index ?? 0);
  }

  for (const match of cssText.matchAll(/var\(\s*(--[-\w]+)[^)]*\)/g)) {
    const color = cssVariables.get(match[1]);

    if (!color || color.alpha < 0.2) {
      continue;
    }

    addColorCandidate(
      candidates,
      color.hex,
      colorScore(cssText, match.index ?? 0),
      match.index ?? 0,
      isNeutralColor(color),
    );
  }

  const rankedColors = [...candidates.entries()].sort(
    ([hexA, colorA], [hexB, colorB]) =>
      colorB.score - colorA.score ||
      colorA.firstIndex - colorB.firstIndex ||
      hexA.localeCompare(hexB),
  );
  const nonNeutralColors = rankedColors
    .filter(([, color]) => !color.isNeutral)
    .map(([hex]) => hex);

  return unique(nonNeutralColors).slice(0, 3);
}

function extractColorVariables(cssText: string) {
  const rawVariables = new Map<string, string>();
  const resolvedVariables = new Map<string, Color>();
  const variableRegex = /(--[-\w]+)\s*:\s*([^;{}]+)/g;
  let match: RegExpExecArray | null;

  while ((match = variableRegex.exec(cssText))) {
    const name = match[1];
    const value = match[2].trim();

    if (!isIgnoredColorVariable(name)) {
      rawVariables.set(name, value);
    }
  }

  for (const [name, value] of rawVariables) {
    const color = resolveColorVariable(value, rawVariables);

    if (color) {
      resolvedVariables.set(name, color);
    }
  }

  return resolvedVariables;
}

function isIgnoredColorVariable(name: string) {
  return /^--framer-link(?:-[\w-]+)?-text-color$/.test(name);
}

function resolveColorVariable(value: string, rawVariables: Map<string, string>) {
  const directColor = parseCssColor(value);

  if (directColor) {
    return directColor;
  }

  const variableReference = value.match(/^var\(\s*(--[-\w]+)\s*\)$/);

  if (!variableReference) {
    return null;
  }

  const referencedValue = rawVariables.get(variableReference[1]);

  return referencedValue ? parseCssColor(referencedValue) : null;
}

export function extractFont(cssText: string): BrandTokens["font"] {
  const candidates = new Map<
    string,
    {
      score: number;
      firstIndex: number;
    }
  >();
  const declarationRegex = /([-\w]+)\s*:\s*([^;{}]+)/g;
  let match: RegExpExecArray | null;

  while ((match = declarationRegex.exec(cssText))) {
    const property = match[1].toLowerCase();

    if (!isFontFamilyDeclaration(property)) {
      continue;
    }

    for (const [familyIndex, family] of parseFontFamilyList(match[2]).entries()) {
      const normalizedFamily = normalizeFontFamily(family);

      if (
        !isValidFontFamily(normalizedFamily) ||
        GENERIC_FONT_FAMILIES.has(normalizedFamily.toLowerCase()) ||
        ICON_FONT_PATTERN.test(normalizedFamily)
      ) {
        continue;
      }

      const context = cssText
        .slice(Math.max(0, match.index - 120), match.index + match[0].length)
        .toLowerCase();
      let score = 3 + Math.max(0, 3 - familyIndex);

      if (/(body|html|:root|font-sans|font-body|--font)/.test(context)) {
        score += 4;
      }

      const existing = candidates.get(normalizedFamily);

      if (!existing) {
        candidates.set(normalizedFamily, {
          score,
          firstIndex: match.index,
        });
        continue;
      }

      existing.score += score;
      existing.firstIndex = Math.min(existing.firstIndex, match.index);
    }
  }

  const rankedFamilies = [...candidates.entries()]
    .sort(
      ([familyA, scoreA], [familyB, scoreB]) =>
        scoreB.score - scoreA.score ||
        scoreA.firstIndex - scoreB.firstIndex ||
        familyA.localeCompare(familyB),
    )
    .map(([family]) => family);

  return {
    primary: rankedFamilies[0] ?? null,
    fallbacks: rankedFamilies.slice(1, 5),
  };
}

function isFontFamilyDeclaration(property: string) {
  if (property === "font-family") {
    return true;
  }

  if (!property.startsWith("--")) {
    return false;
  }

  return (
    /^--font-(sans|serif|mono)$/.test(property) ||
    /\bfont-family\b/.test(property) ||
    /\b(family|typeface|typography)\b/.test(property)
  );
}

function isValidFontFamily(family: string) {
  return (
    family.length > 0 &&
    /[a-z]/i.test(family) &&
    !/[()]/.test(family) &&
    !family.toLowerCase().endsWith(" placeholder") &&
    !family.toLowerCase().includes("var(")
  );
}

export async function extractVoice(
  scraped: ScrapedHomepage,
  voiceProvider?: VoiceProvider,
): Promise<VoiceTokens> {
  const cacheKey = normalizedCacheKey(scraped.finalUrl || scraped.requestedUrl);
  const cachedVoice = await readVoiceFromCache(cacheKey);

  if (cachedVoice) {
    return normalizeVoiceTokens(cachedVoice);
  }

  const voice = voiceProvider
    ? await voiceProvider({
        url: scraped.finalUrl,
        title: scraped.title,
        description: scraped.description,
        headings: scraped.headings,
        bodyText: scraped.bodyText,
      })
    : extractVoiceDeterministically(scraped);
  const normalizedVoice = normalizeVoiceTokens(voice);

  await writeVoiceToCache(cacheKey, normalizedVoice);
  return normalizedVoice;
}

async function readVoiceFromCache(cacheKey: string) {
  try {
    return await readCachedVoice(cacheKey);
  } catch (error) {
    console.warn("Brand voice cache read failed", error);
    return null;
  }
}

async function writeVoiceToCache(cacheKey: string, voice: VoiceTokens) {
  try {
    await writeCachedVoice(cacheKey, voice);
  } catch (error) {
    console.warn("Brand voice cache write failed", error);
  }
}

function extractVoiceDeterministically(scraped: ScrapedHomepage): VoiceTokens {
  const text = [
    scraped.title,
    scraped.description,
    ...scraped.headings.h1,
    ...scraped.headings.h2,
    scraped.bodyText,
  ]
    .filter(Boolean)
    .join(" ");
  const lowerText = text.toLowerCase();
  const phrases = unique([
    ...scraped.headings.h1,
    ...scraped.headings.h2,
    ...(scraped.description ? [scraped.description] : []),
  ])
    .map((phrase) => phrase.trim())
    .filter((phrase) => phrase.length > 0)
    .slice(0, 5);

  return {
    tone: inferTone(lowerText),
    formality: inferFormality(lowerText),
    phrases,
  };
}

function normalizeVoiceTokens(voice: VoiceTokens): VoiceTokens {
  return {
    tone: voice.tone.trim(),
    formality: voice.formality,
    phrases: unique(voice.phrases.map((phrase) => phrase.trim()).filter(Boolean))
      .slice(0, 5),
  };
}

function inferTone(text: string) {
  if (/\b(scale|growth|grow|revenue|convert|faster|performance)\b/.test(text)) {
    return "growth-focused";
  }

  if (/\b(simple|clear|easy|effortless|streamline)\b/.test(text)) {
    return "clear and practical";
  }

  if (/\b(trusted|secure|enterprise|compliance|reliable)\b/.test(text)) {
    return "trust-oriented";
  }

  return "";
}

function inferFormality(text: string): VoiceTokens["formality"] {
  if (/\b(enterprise|platform|solutions|compliance|organizations)\b/.test(text)) {
    return "formal";
  }

  if (/\b(you|your|easy|simple|start|try)\b/.test(text)) {
    return "casual";
  }

  return "neutral";
}

function addParsedColor(
  candidates: Map<
    string,
    {
      score: number;
      firstIndex: number;
      isNeutral: boolean;
    }
  >,
  cssText: string,
  rawColor: string,
  index: number,
) {
  const color = parseCssColor(rawColor);

  if (!color || color.alpha < 0.2) {
    return;
  }

  addColorCandidate(
    candidates,
    color.hex,
    colorScore(cssText, index),
    index,
    isNeutralColor(color),
  );
}

function addColorCandidate(
  candidates: Map<
    string,
    {
      score: number;
      firstIndex: number;
      isNeutral: boolean;
    }
  >,
  hex: string,
  score: number,
  index: number,
  isNeutral: boolean,
) {
  if (score <= 0) {
    return;
  }

  const existing = candidates.get(hex);

  if (!existing) {
    candidates.set(hex, { score, firstIndex: index, isNeutral });
    return;
  }

  existing.score += score;
  existing.firstIndex = Math.min(existing.firstIndex, index);
}

function colorScore(cssText: string, index: number) {
  const declaration = cssText
    .slice(
      declarationStartIndex(cssText, index),
      declarationEndIndex(cssText, index),
    )
    .toLowerCase();
  const selector = selectorContext(cssText, index);
  const context = `${selector} ${declaration}`;
  let score = 3;

  if (/--framer-link(?:-[\w-]+)?-text-color\s*:/.test(declaration)) {
    return 0;
  }

  if (/--[^:{;}]*(primary|main|cta)/.test(declaration)) {
    score += 4;
  } else if (/--[^:{;}]*(brand|theme)/.test(declaration)) {
    score += 2;
  }

  if (/--[^:{;}]*(secondary|accent)/.test(declaration)) {
    score += 1;
  }

  if (/(background|background-color|border-color|fill)\s*:/.test(declaration)) {
    score += 4;
  } else if (/(color|border|stroke)\s*:/.test(declaration)) {
    score += 2;
  }

  if (/(button|btn|cta|hero|header|nav|banner)/.test(selector)) {
    score += 3;
  }

  if (/(box-shadow|text-shadow|outline)\s*:/.test(declaration)) {
    score -= 3;
  }

  if (/(disabled|muted|overlay|subtle|ghost)/.test(context)) {
    score -= 2;
  }

  return Math.max(1, score);
}

function selectorContext(cssText: string, index: number) {
  const ruleStart = cssText.lastIndexOf("{", index);

  if (ruleStart < 0) {
    return "";
  }

  const previousRuleEnd = cssText.lastIndexOf("}", ruleStart);

  return cssText.slice(previousRuleEnd + 1, ruleStart).toLowerCase();
}

function declarationStartIndex(cssText: string, index: number) {
  return Math.max(
    cssText.lastIndexOf(";", index),
    cssText.lastIndexOf("{", index),
    cssText.lastIndexOf("}", index),
    0,
  );
}

function declarationEndIndex(cssText: string, index: number) {
  const endCandidates = [cssText.indexOf(";", index), cssText.indexOf("}", index)]
    .filter((candidate) => candidate >= 0);

  return endCandidates.length > 0 ? Math.min(...endCandidates) : cssText.length;
}

function parseFontFamilyList(value: string) {
  const families: string[] = [];
  let current = "";
  let quote: string | null = null;
  let parenthesisDepth = 0;

  for (const character of value) {
    if ((character === "'" || character === '"') && !quote) {
      quote = character;
      current += character;
      continue;
    }

    if (character === quote) {
      quote = null;
      current += character;
      continue;
    }

    if (character === "(" && !quote) {
      parenthesisDepth += 1;
      current += character;
      continue;
    }

    if (character === ")" && !quote) {
      parenthesisDepth = Math.max(0, parenthesisDepth - 1);
      current += character;
      continue;
    }

    if (character === "," && !quote && parenthesisDepth === 0) {
      families.push(current);
      current = "";
      continue;
    }

    current += character;
  }

  if (current) {
    families.push(current);
  }

  return families;
}

function normalizeFontFamily(value: string) {
  return value
    .replace(/\bvar\([^)]*\)/gi, "")
    .replace(/!important/gi, "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .trim();
}

function parseCssColor(value: string): Color | null {
  const color = value.trim().toLowerCase();

  if (color.startsWith("#")) {
    return parseHexColor(color);
  }

  if (color.startsWith("rgb")) {
    return parseRgbColor(color);
  }

  if (color.startsWith("hsl")) {
    return parseHslColor(color);
  }

  return null;
}

function parseHexColor(value: string): Color | null {
  const hex = value.slice(1);
  let red: number;
  let green: number;
  let blue: number;
  let alpha = 1;

  if (hex.length === 3 || hex.length === 4) {
    red = parseInt(hex[0] + hex[0], 16);
    green = parseInt(hex[1] + hex[1], 16);
    blue = parseInt(hex[2] + hex[2], 16);
    alpha = hex.length === 4 ? parseInt(hex[3] + hex[3], 16) / 255 : 1;
  } else if (hex.length === 6 || hex.length === 8) {
    red = parseInt(hex.slice(0, 2), 16);
    green = parseInt(hex.slice(2, 4), 16);
    blue = parseInt(hex.slice(4, 6), 16);
    alpha = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
  } else {
    return null;
  }

  return toColor(red, green, blue, alpha);
}

function parseRgbColor(value: string): Color | null {
  const body = value.slice(value.indexOf("(") + 1, value.lastIndexOf(")"));
  const parts = body.split(/[,\s/]+/).filter(Boolean);

  if (parts.length < 3) {
    return null;
  }

  const red = parseRgbComponent(parts[0]);
  const green = parseRgbComponent(parts[1]);
  const blue = parseRgbComponent(parts[2]);
  const alpha = parts[3] ? parseAlpha(parts[3]) : 1;

  return red === null || green === null || blue === null
    ? null
    : toColor(red, green, blue, alpha);
}

function parseHslColor(value: string): Color | null {
  const body = value.slice(value.indexOf("(") + 1, value.lastIndexOf(")"));
  const parts = body.split(/[,\s/]+/).filter(Boolean);

  if (parts.length < 3) {
    return null;
  }

  const hue = Number.parseFloat(parts[0]);
  const saturation = parsePercentage(parts[1]);
  const lightness = parsePercentage(parts[2]);
  const alpha = parts[3] ? parseAlpha(parts[3]) : 1;

  if (!Number.isFinite(hue) || saturation === null || lightness === null) {
    return null;
  }

  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const huePrime = (((hue % 360) + 360) % 360) / 60;
  const x = chroma * (1 - Math.abs((huePrime % 2) - 1));
  const [red1, green1, blue1] =
    huePrime < 1
      ? [chroma, x, 0]
      : huePrime < 2
        ? [x, chroma, 0]
        : huePrime < 3
          ? [0, chroma, x]
          : huePrime < 4
            ? [0, x, chroma]
            : huePrime < 5
              ? [x, 0, chroma]
              : [chroma, 0, x];
  const m = lightness - chroma / 2;

  return toColor(
    Math.round((red1 + m) * 255),
    Math.round((green1 + m) * 255),
    Math.round((blue1 + m) * 255),
    alpha,
  );
}

function parseRgbComponent(value: string) {
  if (value.endsWith("%")) {
    const percentage = parsePercentage(value);

    return percentage === null ? null : Math.round(percentage * 255);
  }

  const number = Number.parseFloat(value);

  return Number.isFinite(number) ? clamp(Math.round(number), 0, 255) : null;
}

function parsePercentage(value: string) {
  if (!value.endsWith("%")) {
    return null;
  }

  const number = Number.parseFloat(value);

  return Number.isFinite(number) ? clamp(number / 100, 0, 1) : null;
}

function parseAlpha(value: string) {
  if (value.endsWith("%")) {
    const percentage = parsePercentage(value);

    return percentage ?? 1;
  }

  const number = Number.parseFloat(value);

  return Number.isFinite(number) ? clamp(number, 0, 1) : 1;
}

function toColor(red: number, green: number, blue: number, alpha: number): Color {
  return {
    red,
    green,
    blue,
    alpha,
    hex: `#${toHex(red)}${toHex(green)}${toHex(blue)}`,
  };
}

function toHex(value: number) {
  return clamp(value, 0, 255).toString(16).padStart(2, "0");
}

function isNeutralColor(color: Color) {
  const { saturation, lightness } = rgbToHsl(
    color.red,
    color.green,
    color.blue,
  );

  return saturation < 0.12 || lightness < 0.08 || lightness > 0.94;
}

function rgbToHsl(red: number, green: number, blue: number) {
  const normalizedRed = red / 255;
  const normalizedGreen = green / 255;
  const normalizedBlue = blue / 255;
  const max = Math.max(normalizedRed, normalizedGreen, normalizedBlue);
  const min = Math.min(normalizedRed, normalizedGreen, normalizedBlue);
  const lightness = (max + min) / 2;
  const delta = max - min;
  const saturation =
    delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));

  return { saturation, lightness };
}

function unique<T>(items: T[]) {
  return [...new Set(items)];
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
