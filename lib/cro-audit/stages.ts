export const STAGES = [
  { key: "scraping", label: "Scraping the page" },
  { key: "analyzing_performance", label: "Analyzing performance" },
  { key: "extracting_brand", label: "Extracting brand" },
  { key: "auditing", label: "Running CRO audit" },
  { key: "generating", label: "Generating homepage" },
] as const;

export type StageKey = (typeof STAGES)[number]["key"];
export type Stage = StageKey | "done";
