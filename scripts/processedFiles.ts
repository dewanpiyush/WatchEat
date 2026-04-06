import fs from "fs";
import path from "path";

export const SCRIPTS_DATA_DIR = path.join(process.cwd(), "scripts", "data");
export const PROCESSED_FILES_PATH = path.join(
  SCRIPTS_DATA_DIR,
  "processed_files.json",
);

export type ProcessedFilesState = {
  /** `restaurantSlug/file.json` successfully ingested into Supabase */
  ingested: string[];
  /** Same keys; signals + metrics have been recomputed for that restaurant after ingest */
  signalsProcessed: string[];
};

export function fileKey(restaurantSlug: string, fileName: string): string {
  return `${restaurantSlug}/${fileName}`;
}

export function loadProcessed(): ProcessedFilesState {
  if (!fs.existsSync(PROCESSED_FILES_PATH)) {
    return { ingested: [], signalsProcessed: [] };
  }
  try {
    const raw = JSON.parse(
      fs.readFileSync(PROCESSED_FILES_PATH, "utf-8"),
    ) as Partial<ProcessedFilesState>;
    return {
      ingested: [...new Set(raw.ingested ?? [])],
      signalsProcessed: [...new Set(raw.signalsProcessed ?? [])],
    };
  } catch {
    return { ingested: [], signalsProcessed: [] };
  }
}

export function saveProcessed(state: ProcessedFilesState): void {
  fs.mkdirSync(SCRIPTS_DATA_DIR, { recursive: true });
  const normalized: ProcessedFilesState = {
    ingested: [...new Set(state.ingested)].sort(),
    signalsProcessed: [...new Set(state.signalsProcessed)].sort(),
  };
  fs.writeFileSync(
    PROCESSED_FILES_PATH,
    JSON.stringify(normalized, null, 2) + "\n",
    "utf-8",
  );
}
