import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { captureScreenshot } from "./capture.js";
import { registerCleanup } from "./browser.js";
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

  return server;
}
