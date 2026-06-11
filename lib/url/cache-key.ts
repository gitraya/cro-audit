export function normalizedCacheKey(url: string) {
  try {
    return new URL(url).toString();
  } catch {
    return url.trim();
  }
}
