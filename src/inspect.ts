import { getBrowser } from "./browser.js";

export interface DomNode {
  tag: string;
  id?: string;
  classes?: string[];
  text?: string;
  selector: string;
  attributes?: Record<string, string>;
  children?: DomNode[];
}

export interface InspectResult {
  title: string;
  url: string;
  ariaSnapshot: string;
  domSummary: DomNode;
  truncated: boolean;
}

export async function inspectPage(params: {
  url: string;
  width?: number;
  height?: number;
  wait?: "networkidle" | "domcontentloaded" | "load" | number;
  timeout?: number;
}): Promise<InspectResult> {
  throw new Error("Not implemented");
}
