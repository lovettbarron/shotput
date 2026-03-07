import { describe, test, expect, afterEach } from "vitest";
import { generateFilename, resolveOutputPath, ensureOutputDir } from "../src/output.js";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

describe("output", () => {
  describe("generateFilename", () => {
    test('generateFilename("https://example.com/page", "png") returns "example-com_{timestamp}.png"', () => {
      const name = generateFilename("https://example.com/page", "png");
      expect(name).toMatch(/^example-com_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.png$/);
    });

    test("generateFilename with jpeg format returns .jpg extension", () => {
      const name = generateFilename("https://example.com", "jpeg");
      expect(name).toMatch(/\.jpg$/);
    });
  });

  describe("resolveOutputPath", () => {
    test("resolveOutputPath with custom dir and filename uses them directly", () => {
      const result = resolveOutputPath("/tmp/custom", "shot.png", "https://example.com", "png");
      expect(result).toBe(path.resolve("/tmp/custom", "shot.png"));
    });

    test("resolveOutputPath with no dir defaults to cwd", () => {
      const result = resolveOutputPath(undefined, "shot.png", "https://example.com", "png");
      expect(result).toBe(path.resolve(process.cwd(), "shot.png"));
    });

    test("resolveOutputPath with no filename generates one", () => {
      const result = resolveOutputPath("/tmp", undefined, "https://example.com", "png");
      expect(result).toMatch(/example-com_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.png$/);
    });
  });

  describe("ensureOutputDir", () => {
    let tmpDir: string;

    afterEach(async () => {
      if (tmpDir) {
        await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
      }
    });

    test("creates directory recursively if missing", async () => {
      tmpDir = path.join(os.tmpdir(), `shotput-test-${Date.now()}`);
      const nested = path.join(tmpDir, "a", "b", "c");
      await ensureOutputDir(nested);
      const stat = await fs.stat(nested);
      expect(stat.isDirectory()).toBe(true);
    });
  });

  describe("file collision", () => {
    test("writing to existing path overwrites silently", async () => {
      const tmpDir = path.join(os.tmpdir(), `shotput-collision-${Date.now()}`);
      await fs.mkdir(tmpDir, { recursive: true });
      const filePath = path.join(tmpDir, "test.png");
      await fs.writeFile(filePath, "original");
      await fs.writeFile(filePath, "overwritten");
      const content = await fs.readFile(filePath, "utf-8");
      expect(content).toBe("overwritten");
      await fs.rm(tmpDir, { recursive: true, force: true });
    });
  });
});
