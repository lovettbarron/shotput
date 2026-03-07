import { describe, test } from "vitest";

describe("capture", () => {
  describe("full page", () => {
    test.todo("captures entire scrollable page");
  });

  describe("viewport", () => {
    test.todo("captures only visible viewport");
  });

  describe("format", () => {
    test.todo("outputs PNG file");
    test.todo("outputs JPEG file");
  });

  describe("quality", () => {
    test.todo("respects JPEG quality setting");
  });

  describe("wait strategies", () => {
    test.todo("waits for network idle");
    test.todo("waits for DOMContentLoaded");
    test.todo("waits for fixed delay in ms");
  });

  describe("viewport dimensions", () => {
    test.todo("respects custom width and height");
  });

  describe("scale", () => {
    test.todo("respects device scale factor");
  });
});
