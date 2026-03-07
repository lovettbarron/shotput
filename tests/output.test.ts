import { describe, test } from "vitest";

describe("output", () => {
  describe("directory", () => {
    test.todo("creates output directory if missing");
    test.todo("defaults to cwd when no dir specified");
  });

  describe("filename", () => {
    test.todo("uses custom filename when provided");
    test.todo("generates default {domain}_{timestamp}.{ext} format");
    test.todo("overwrites existing file on collision");
  });
});
