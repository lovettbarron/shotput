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
  sessionName?: string;
}

export type SameSitePolicy = "Strict" | "Lax" | "None";

export interface CookieParam {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: SameSitePolicy;
}

export interface CookieInput {
  name: string;
  value: string;
  domain: string;
  path?: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: SameSitePolicy;
}

export interface OriginState {
  origin: string;
  localStorage: Array<{ name: string; value: string }>;
}

export interface StorageState {
  cookies: CookieParam[];
  origins: OriginState[];
}

export interface CaptureResult {
  filePath: string;
  buffer: Buffer;
  format: "png" | "jpeg";
  width: number;
  height: number;
  warning?: string;
}
