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

const MAX_DEPTH = 4;
const MAX_NODES = 500;
const MAX_TEXT_LENGTH = 100;
const EXCLUDED_TAGS = new Set(["script", "style", "svg", "noscript"]);

export async function inspectPage(params: {
  url: string;
  width?: number;
  height?: number;
  wait?: "networkidle" | "domcontentloaded" | "load" | number;
  timeout?: number;
}): Promise<InspectResult> {
  const {
    url,
    width = 1280,
    height = 720,
    wait = "networkidle",
    timeout = 30000,
  } = params;

  const browser = await getBrowser();
  const context = await browser.newContext({
    viewport: { width, height },
  });

  try {
    const page = await context.newPage();

    // Navigate
    if (typeof wait === "number") {
      await page.goto(url, { waitUntil: "load", timeout });
      await page.waitForTimeout(wait);
    } else {
      await page.goto(url, { waitUntil: wait, timeout });
    }

    const title = await page.title();

    // Get aria snapshot
    let ariaSnapshot: string;
    try {
      ariaSnapshot = await page.locator("body").ariaSnapshot();
    } catch {
      ariaSnapshot = "";
    }

    // Get DOM summary via page.evaluate
    const { domSummary, truncated } = await page.evaluate(
      ({ maxDepth, maxNodes, maxTextLength, excludedTags }) => {
        let nodeCount = 0;
        let wasTruncated = false;

        function summarize(
          element: Element,
          depth: number
        ): {
          tag: string;
          id?: string;
          classes?: string[];
          text?: string;
          selector: string;
          attributes?: Record<string, string>;
          children?: Array<ReturnType<typeof summarize>>;
        } | null {
          if (nodeCount >= maxNodes) {
            wasTruncated = true;
            return null;
          }

          const tag = element.tagName.toLowerCase();
          if (excludedTags.includes(tag)) {
            return null;
          }

          nodeCount++;

          const id = element.id || undefined;
          const classList = Array.from(element.classList);
          const classes = classList.length > 0 ? classList : undefined;
          const testId = element.getAttribute("data-testid");
          const role = element.getAttribute("role");
          const ariaLabel = element.getAttribute("aria-label");
          const href =
            tag === "a" ? element.getAttribute("href") || undefined : undefined;

          // Build selector
          let selector: string;
          if (id) {
            selector = `#${id}`;
          } else if (testId) {
            selector = `[data-testid="${testId}"]`;
          } else if (classes && classes.length > 0) {
            selector = `${tag}.${classes.join(".")}`;
          } else {
            selector = tag;
          }

          // Collect attributes of interest
          const attrs: Record<string, string> = {};
          if (testId) attrs["data-testid"] = testId;
          if (role) attrs["role"] = role;
          if (ariaLabel) attrs["aria-label"] = ariaLabel;
          if (href) attrs["href"] = href;
          const attributes =
            Object.keys(attrs).length > 0 ? attrs : undefined;

          // Children
          let children: Array<ReturnType<typeof summarize>> | undefined;
          if (depth < maxDepth) {
            const childElements = Array.from(element.children);
            if (childElements.length > 0) {
              const childNodes = childElements
                .map((child) => summarize(child, depth + 1))
                .filter(Boolean);
              if (childNodes.length > 0) {
                children = childNodes as Array<ReturnType<typeof summarize>>;
              }
            }
          }

          // Text content: only for leaf nodes (no element children)
          let text: string | undefined;
          if (!children || children.length === 0) {
            const raw = element.textContent?.trim();
            if (raw && raw.length > 0) {
              text =
                raw.length > maxTextLength
                  ? raw.substring(0, maxTextLength)
                  : raw;
            }
          }

          return { tag, id, classes, text, selector, attributes, children };
        }

        const body = document.querySelector("body");
        if (!body) {
          return {
            domSummary: { tag: "body", selector: "body" },
            truncated: false,
          };
        }

        const result = summarize(body, 0);
        return {
          domSummary: result || { tag: "body", selector: "body" },
          truncated: wasTruncated,
        };
      },
      {
        maxDepth: MAX_DEPTH,
        maxNodes: MAX_NODES,
        maxTextLength: MAX_TEXT_LENGTH,
        excludedTags: Array.from(EXCLUDED_TAGS),
      }
    );

    return {
      title,
      url,
      ariaSnapshot,
      domSummary: domSummary as DomNode,
      truncated,
    };
  } finally {
    await context.close();
  }
}
