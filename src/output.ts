import fs from "node:fs/promises";
import path from "node:path";

/**
 * Generate a default filename from URL and format.
 * Format: {domain-with-hyphens}_{YYYY-MM-DD_HH-mm-ss}.{ext}
 */
export function generateFilename(url: string, format: "png" | "jpeg"): string {
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    hostname = "unknown";
  }

  const sanitized = hostname.replace(/\./g, "-");
  const now = new Date();
  const timestamp = now.toISOString()
    .replace("T", "_")
    .replace(/:/g, "-")
    .replace(/\.\d+Z$/, "");
  const ext = format === "jpeg" ? "jpg" : "png";

  return `${sanitized}_${timestamp}.${ext}`;
}

/**
 * Resolve full output path from optional dir, filename, url, and format.
 * Defaults: dir = cwd, filename = generated from url.
 */
export function resolveOutputPath(
  outputDir: string | undefined,
  filename: string | undefined,
  url: string,
  format: "png" | "jpeg"
): string {
  const dir = outputDir ?? process.cwd();
  const name = filename ?? generateFilename(url, format);
  return path.resolve(dir, name);
}

/**
 * Ensure the output directory exists, creating it recursively if needed.
 */
export async function ensureOutputDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}
