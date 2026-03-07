export type WaitStrategy = "networkidle" | "domcontentloaded" | "load";

export interface CaptureParams {
  url: string;
  fullPage: boolean;
  format: "png" | "jpeg";
  quality?: number;
  width: number;
  height: number;
  scale: number;
  outputDir?: string;
  filename?: string;
  wait: WaitStrategy | number;
  autoScroll: boolean;
  timeout: number;
  selector?: string;
  padding?: number;
  omitBackground?: boolean;
  injectCSS?: string;
  injectJS?: string;
  hideSelectors?: string[];
}

export interface CaptureResult {
  filePath: string;
  buffer: Buffer;
  format: "png" | "jpeg";
  width: number;
  height: number;
  warning?: string;
}
