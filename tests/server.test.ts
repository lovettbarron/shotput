import { describe, test, expect, afterAll } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.js";
import { closeBrowser } from "../src/browser.js";
import path from "node:path";
import fs from "node:fs";
import { execSync } from "node:child_process";

afterAll(async () => {
  await closeBrowser();
});

describe("MCP server", () => {
  test("createServer returns an McpServer instance", () => {
    const server = createServer();
    expect(server).toBeInstanceOf(McpServer);
  });

  test("shotput_capture tool is registered and callable", async () => {
    const server = createServer();
    const client = new Client({ name: "test-client", version: "1.0.0" });

    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();

    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);

    const tools = await client.listTools();
    const captureTool = tools.tools.find((t) => t.name === "shotput_capture");
    expect(captureTool).toBeDefined();
    expect(captureTool!.description).toBe(
      "Capture a screenshot of a web page"
    );

    // Verify schema has url as required
    const schema = captureTool!.inputSchema;
    expect(schema.required).toContain("url");

    await client.close();
    await server.close();
  });

  test("tool returns text content with file path for small screenshots", async () => {
    const server = createServer();
    const client = new Client({ name: "test-client", version: "1.0.0" });

    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();

    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);

    const fixtureUrl = `file://${path.resolve("tests/fixtures/test-page.html")}`;
    const result = await client.callTool({
      name: "shotput_capture",
      arguments: { url: fixtureUrl },
    });

    const content = result.content as Array<{
      type: string;
      text?: string;
      data?: string;
      mimeType?: string;
    }>;

    // Should have text content with file path
    const textContent = content.find(
      (c) => c.type === "text" && c.text?.includes("Screenshot saved to:")
    );
    expect(textContent).toBeDefined();

    // Should have image content (small test page screenshot will be under 750KB)
    const imageContent = content.find((c) => c.type === "image");
    expect(imageContent).toBeDefined();
    expect(imageContent!.mimeType).toBe("image/png");
    expect(imageContent!.data).toBeTruthy();

    // Clean up screenshot file
    const filePath = textContent!.text!.replace("Screenshot saved to: ", "");
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await client.close();
    await server.close();
  });

  test("shotput_inspect tool is registered and callable", async () => {
    const server = createServer();
    const client = new Client({ name: "test-client", version: "1.0.0" });

    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();

    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);

    const tools = await client.listTools();
    const inspectTool = tools.tools.find((t) => t.name === "shotput_inspect");
    expect(inspectTool).toBeDefined();
    expect(inspectTool!.description).toContain("Inspect");

    // Verify schema has url as required
    const schema = inspectTool!.inputSchema;
    expect(schema.required).toContain("url");

    await client.close();
    await server.close();
  });

  test("shotput_inspect returns DOM summary as text content", async () => {
    const server = createServer();
    const client = new Client({ name: "test-client", version: "1.0.0" });

    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();

    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);

    const fixtureUrl = `file://${path.resolve("tests/fixtures/element-page.html")}`;
    const result = await client.callTool({
      name: "shotput_inspect",
      arguments: { url: fixtureUrl },
    });

    const content = result.content as Array<{
      type: string;
      text?: string;
    }>;

    // Should have page title text
    const pageText = content.find(
      (c) => c.type === "text" && c.text?.includes("Page:")
    );
    expect(pageText).toBeDefined();

    // Should have DOM summary as JSON
    const domText = content.find(
      (c) => c.type === "text" && c.text?.includes("DOM Summary:")
    );
    expect(domText).toBeDefined();

    // Parse the JSON portion
    const jsonStr = domText!.text!.replace("DOM Summary:\n", "");
    const parsed = JSON.parse(jsonStr);
    expect(parsed.tag).toBe("body");

    await client.close();
    await server.close();
  });

  test("no console.log in production source files", () => {
    const result = execSync(
      'grep -r "console\\.log" src/ || echo "__NONE__"',
      { cwd: path.resolve("."), encoding: "utf-8" }
    );
    expect(result.trim()).toBe("__NONE__");
  });
});
