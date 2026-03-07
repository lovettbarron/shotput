import { describe, test, expect, afterAll } from "vitest";
import { inspectPage, type InspectResult, type DomNode } from "../src/inspect.js";
import { closeBrowser } from "../src/browser.js";
import path from "node:path";

const fixtureUrl = `file://${path.resolve("tests/fixtures/element-page.html")}`;

afterAll(async () => {
  await closeBrowser();
});

describe("inspectPage", () => {
  test("returns title, url, ariaSnapshot, and domSummary", async () => {
    const result = await inspectPage({ url: fixtureUrl });
    expect(result.title).toBe("Element Targeting Test Page");
    expect(result.url).toBe(fixtureUrl);
    expect(typeof result.ariaSnapshot).toBe("string");
    expect(result.ariaSnapshot.length).toBeGreaterThan(0);
    expect(result.domSummary).toBeDefined();
    expect(result.domSummary.tag).toBeDefined();
  });

  test("domSummary contains nodes with tag and selector fields", () => {
    // We'll use the result from a real call
    return inspectPage({ url: fixtureUrl }).then((result) => {
      expect(result.domSummary.tag).toBe("body");
      expect(result.domSummary.selector).toBeDefined();
    });
  });

  test("elements with id get #id selector", async () => {
    const result = await inspectPage({ url: fixtureUrl });
    const found = findNode(result.domSummary, (n) => n.selector === "#target-box");
    expect(found).toBeDefined();
    expect(found!.tag).toBe("div");
  });

  test("elements with data-testid get attribute selector", async () => {
    const result = await inspectPage({ url: fixtureUrl });
    // container has data-testid="container" but no id
    const found = findNode(
      result.domSummary,
      (n) => n.selector === '[data-testid="container"]'
    );
    expect(found).toBeDefined();
  });

  test("script, style, svg, noscript elements are excluded", async () => {
    const result = await inspectPage({ url: fixtureUrl });
    // The fixture has a <style> tag in <head>, but head content may not be traversed.
    // The body should not contain any script/style/svg/noscript nodes.
    const badNode = findNode(
      result.domSummary,
      (n) => ["script", "style", "svg", "noscript"].includes(n.tag)
    );
    expect(badNode).toBeUndefined();
  });

  test("text content is truncated to 100 characters", async () => {
    const result = await inspectPage({ url: fixtureUrl });
    const allNodes = collectNodes(result.domSummary);
    for (const node of allNodes) {
      if (node.text) {
        expect(node.text.length).toBeLessThanOrEqual(100);
      }
    }
  });

  test("truncated flag is false for small pages", async () => {
    const result = await inspectPage({ url: fixtureUrl });
    expect(result.truncated).toBe(false);
  });
});

// Helper: recursively find a node matching a predicate
function findNode(
  node: DomNode,
  predicate: (n: DomNode) => boolean
): DomNode | undefined {
  if (predicate(node)) return node;
  if (node.children) {
    for (const child of node.children) {
      const found = findNode(child, predicate);
      if (found) return found;
    }
  }
  return undefined;
}

// Helper: collect all nodes into a flat array
function collectNodes(node: DomNode): DomNode[] {
  const result: DomNode[] = [node];
  if (node.children) {
    for (const child of node.children) {
      result.push(...collectNodes(child));
    }
  }
  return result;
}
