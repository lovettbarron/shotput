import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { captureScreenshot } from "./capture.js";
import { inspectPage } from "./inspect.js";
import { registerCleanup } from "./browser.js";
import { getSessionManager } from "./auth.js";
import type { CaptureParams } from "./types.js";

const INLINE_IMAGE_LIMIT = 750 * 1024; // 750KB

/**
 * Create and configure the MCP server with the shotput_capture tool.
 */
export function createServer(): McpServer {
  const server = new McpServer({
    name: "shotput",
    version: "0.1.0",
  });

  registerCleanup();

  server.tool(
    "shotput_capture",
    "Capture a screenshot of a web page",
    {
      url: z.string().url(),
      fullPage: z.boolean().default(false),
      format: z.enum(["png", "jpeg"]).default("png"),
      quality: z.number().min(0).max(100).optional(),
      width: z.number().int().positive().default(1280),
      height: z.number().int().positive().default(720),
      scale: z.number().min(1).max(3).default(1),
      outputDir: z.string().optional(),
      filename: z.string().optional(),
      wait: z
        .union([
          z.enum(["networkidle", "domcontentloaded", "load"]),
          z.number().positive(),
        ])
        .default("networkidle"),
      autoScroll: z.boolean().default(true),
      timeout: z.number().positive().default(30000),
      selector: z.string().optional().describe("CSS selector to capture a specific element"),
      padding: z.number().int().min(0).default(0).describe("Pixels of padding around element"),
      omitBackground: z.boolean().default(false).describe("Transparent background (PNG only)"),
      injectCSS: z.string().optional().describe("Custom CSS to inject before capture"),
      injectJS: z.string().optional().describe("Custom JavaScript to execute before capture"),
      hideSelectors: z.array(z.string()).optional().describe("CSS selectors of elements to hide before capture"),
      sessionName: z.string().optional().describe("Name of a stored auth session to use for this capture"),
    },
    async (params) => {
      const captureParams: CaptureParams = {
        url: params.url,
        fullPage: params.fullPage,
        format: params.format,
        quality: params.quality,
        width: params.width,
        height: params.height,
        scale: params.scale,
        outputDir: params.outputDir,
        filename: params.filename,
        wait: params.wait,
        autoScroll: params.autoScroll,
        timeout: params.timeout,
        selector: params.selector,
        padding: params.padding,
        omitBackground: params.omitBackground,
        injectCSS: params.injectCSS,
        injectJS: params.injectJS,
        hideSelectors: params.hideSelectors,
        sessionName: params.sessionName,
      };

      const result = await captureScreenshot(captureParams);

      const content: Array<
        | { type: "text"; text: string }
        | { type: "image"; data: string; mimeType: string }
      > = [];

      if (result.warning) {
        content.push({ type: "text", text: `Warning: ${result.warning}` });
      }

      content.push({
        type: "text",
        text: `Screenshot saved to: ${result.filePath}`,
      });

      if (result.buffer.length <= INLINE_IMAGE_LIMIT) {
        content.push({
          type: "image",
          data: result.buffer.toString("base64"),
          mimeType: `image/${result.format}`,
        });
      } else {
        content.push({
          type: "text",
          text: "Image too large for inline display. View the saved file.",
        });
      }

      return { content };
    }
  );

  server.tool(
    "shotput_inspect",
    "Inspect a web page's DOM structure to identify CSS selectors for element targeting. Returns structured DOM summary and accessibility tree. Use this before shotput_capture when you need to find the right CSS selector for an element.",
    {
      url: z.string().url(),
      width: z.number().int().positive().default(1280),
      height: z.number().int().positive().default(720),
      wait: z
        .union([
          z.enum(["networkidle", "domcontentloaded", "load"]),
          z.number().positive(),
        ])
        .default("networkidle"),
      timeout: z.number().positive().default(30000),
    },
    async (params) => {
      const result = await inspectPage({
        url: params.url,
        width: params.width,
        height: params.height,
        wait: params.wait,
        timeout: params.timeout,
      });

      const content: Array<{ type: "text"; text: string }> = [];

      content.push({
        type: "text",
        text: `Page: ${result.title} (${result.url})`,
      });

      content.push({
        type: "text",
        text: `Aria Snapshot:\n${result.ariaSnapshot}`,
      });

      content.push({
        type: "text",
        text: `DOM Summary:\n${JSON.stringify(result.domSummary, null, 2)}`,
      });

      if (result.truncated) {
        content.push({
          type: "text",
          text: "Note: DOM summary was truncated. Large page - not all elements shown.",
        });
      }

      return { content };
    }
  );

  server.tool(
    "shotput_set_cookies",
    "Inject cookies for authenticated page captures. Stores cookies as a named session that can be referenced by shotput_capture's sessionName parameter.",
    {
      sessionName: z.string().describe("Label for this session (use with shotput_capture's sessionName)"),
      cookies: z
        .array(
          z.object({
            name: z.string(),
            value: z.string(),
            domain: z.string(),
            path: z.string().default("/"),
            httpOnly: z.boolean().default(false),
            secure: z.boolean().default(false),
            sameSite: z.enum(["Strict", "Lax", "None"]).default("None"),
            expires: z.number().default(-1),
          })
        )
        .min(1),
    },
    async (params) => {
      getSessionManager().createSessionFromCookies(
        params.sessionName,
        params.cookies
      );

      return {
        content: [
          {
            type: "text" as const,
            text: `Session '${params.sessionName}' stored with ${params.cookies.length} cookie(s). Use sessionName: '${params.sessionName}' in shotput_capture.`,
          },
        ],
      };
    }
  );

  server.tool(
    "shotput_clear_sessions",
    "Clear stored authentication sessions. Clears a specific session by name, or all sessions if no name provided.",
    {
      sessionName: z.string().optional(),
    },
    async (params) => {
      const mgr = getSessionManager();
      if (params.sessionName) {
        mgr.clearSession(params.sessionName);
        return {
          content: [
            {
              type: "text" as const,
              text: `Session '${params.sessionName}' cleared.`,
            },
          ],
        };
      } else {
        const count = mgr.listSessions().length;
        mgr.clearAllSessions();
        return {
          content: [
            {
              type: "text" as const,
              text: `All sessions cleared (${count} removed).`,
            },
          ],
        };
      }
    }
  );

  return server;
}
