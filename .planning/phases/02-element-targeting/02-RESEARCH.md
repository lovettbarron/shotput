# Phase 2: Element Targeting - Research

**Researched:** 2026-03-07
**Domain:** Playwright element screenshots, DOM inspection, page preparation
**Confidence:** HIGH

## Summary

Phase 2 extends the existing capture pipeline to support element-level screenshots, DOM inspection for Claude-assisted selector discovery, and page preparation (CSS/JS injection, element hiding). The entire phase builds on Playwright APIs that are well-documented and stable.

The core capture function (`captureScreenshot` in `src/capture.ts`) currently takes full-page or viewport screenshots. It needs to be extended with: (1) an optional CSS selector to clip to a specific element, (2) padding around the element bounding box, (3) transparent background support via `omitBackground`, and (4) pre-capture page preparation hooks for CSS injection, JS execution, and element hiding. A new `inspect_page` MCP tool must be added to return structured DOM information so Claude can reason about selectors.

**Primary recommendation:** Use Playwright's `locator.screenshot()` for element capture with `omitBackground` for transparency, `page.addStyleTag()`/`page.addScriptTag()` for injection, and `page.locator('body').ariaSnapshot()` combined with a custom DOM summary via `page.evaluate()` for the inspect_page tool.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ELEM-01 | Target specific DOM element by CSS selector | Playwright `page.locator(selector).screenshot()` -- direct API support |
| ELEM-02 | Natural language element description -> Claude identifies selector | `inspect_page` tool returns DOM summary; Claude reasons about selectors from structured output |
| ELEM-03 | Padding around targeted element bounding box | Use `locator.boundingBox()` to get coordinates, then `page.screenshot({ clip: { x, y, width, height } })` with padding math |
| ELEM-04 | Transparent background (no white fill) | Playwright `screenshot({ omitBackground: true })` -- requires PNG format |
| ELEM-05 | Page inspection tool returning structured DOM summary | New MCP tool using `page.evaluate()` for DOM tree + `locator.ariaSnapshot()` for accessibility tree |
| PREP-01 | Inject custom CSS before capture | `page.addStyleTag({ content: css })` -- built-in Playwright API |
| PREP-02 | Inject custom JavaScript before capture | `page.addScriptTag({ content: js })` or `page.evaluate(js)` |
| PREP-03 | Hide/remove specific elements by CSS selector | `page.evaluate()` to set `display: none` on matched elements, or inject CSS rule |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| playwright | ^1.58.2 | Element screenshots, DOM evaluation, CSS/JS injection | Already in project; has all needed APIs natively |
| @modelcontextprotocol/sdk | ^1.27.1 | MCP tool registration for inspect_page | Already in project |
| zod | ^3.25.0 | Schema validation for new tool parameters | Already in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none needed) | - | - | All requirements are covered by existing dependencies |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `locator.screenshot()` for element capture | `page.screenshot({ clip })` with manual bounding box | clip approach needed anyway for padding; locator is simpler for zero-padding case |
| `page.evaluate()` for DOM summary | `page.accessibility.snapshot()` (deprecated) | ariaSnapshot() on locator is the current API; page.evaluate gives richer custom output |
| `page.addStyleTag()` for CSS injection | `page.evaluate()` with style element creation | addStyleTag is cleaner and purpose-built |

**Installation:**
```bash
# No new dependencies needed -- all APIs come from existing playwright + MCP SDK
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  types.ts          # Extended CaptureParams with selector, padding, omitBackground, preparation
  capture.ts        # Extended captureScreenshot with element targeting + preparation pipeline
  inspect.ts        # NEW: DOM inspection logic (inspectPage function)
  server.ts         # Extended: add inspect_page tool, update shotput_capture schema
  browser.ts        # Unchanged
  scroll.ts         # Unchanged
  output.ts         # Unchanged
  index.ts          # Unchanged
```

### Pattern 1: Extended CaptureParams
**What:** Add optional fields to the existing CaptureParams interface for element targeting and page preparation.
**When to use:** When the capture pipeline needs new optional behaviors without breaking existing callers.
**Example:**
```typescript
// Extend existing CaptureParams
export interface CaptureParams {
  // ... existing fields ...
  selector?: string;          // CSS selector for element targeting (ELEM-01)
  padding?: number;           // Pixels of padding around element (ELEM-03)
  omitBackground?: boolean;   // Transparent background (ELEM-04)
  injectCSS?: string;         // Custom CSS to inject before capture (PREP-01)
  injectJS?: string;          // Custom JS to execute before capture (PREP-02)
  hideSelectors?: string[];   // Elements to hide before capture (PREP-03)
}
```

### Pattern 2: Pre-Capture Preparation Pipeline
**What:** A sequence of page modifications applied after navigation but before screenshot, in deterministic order.
**When to use:** PREP-01, PREP-02, PREP-03 -- all page preparation must happen after navigation completes but before the screenshot is taken.
**Example:**
```typescript
// Order matters: CSS first, then JS, then hide elements
async function preparePage(page: Page, params: CaptureParams): Promise<void> {
  if (params.hideSelectors?.length) {
    const css = params.hideSelectors
      .map(sel => `${sel} { display: none !important; }`)
      .join('\n');
    await page.addStyleTag({ content: css });
  }
  if (params.injectCSS) {
    await page.addStyleTag({ content: params.injectCSS });
  }
  if (params.injectJS) {
    await page.evaluate(params.injectJS);
  }
}
```

### Pattern 3: Element Screenshot with Padding
**What:** Use bounding box + clip for padded element screenshots; use locator.screenshot() for zero-padding case.
**When to use:** ELEM-01 and ELEM-03.
**Example:**
```typescript
async function captureElement(
  page: Page,
  selector: string,
  padding: number,
  format: "png" | "jpeg",
  quality: number | undefined,
  omitBackground: boolean
): Promise<Buffer> {
  const locator = page.locator(selector);
  await locator.waitFor({ state: 'visible', timeout: 5000 });

  if (padding === 0) {
    return Buffer.from(await locator.screenshot({
      type: format,
      quality: format === "jpeg" ? quality : undefined,
      omitBackground,
    }));
  }

  // With padding: get bounding box and use page.screenshot with clip
  const box = await locator.boundingBox();
  if (!box) throw new Error(`Element not visible: ${selector}`);

  const clip = {
    x: Math.max(0, box.x - padding),
    y: Math.max(0, box.y - padding),
    width: box.width + padding * 2,
    height: box.height + padding * 2,
  };

  return Buffer.from(await page.screenshot({
    type: format,
    quality: format === "jpeg" ? quality : undefined,
    omitBackground,
    clip,
  }));
}
```

### Pattern 4: DOM Inspection for Claude
**What:** Return a structured DOM summary that gives Claude enough context to identify CSS selectors from natural language descriptions.
**When to use:** ELEM-02 and ELEM-05.
**Example:**
```typescript
export interface InspectResult {
  title: string;
  url: string;
  ariaSnapshot: string;       // YAML accessibility tree
  domSummary: DomNode[];      // Simplified DOM tree with selectors
}

interface DomNode {
  tag: string;
  id?: string;
  classes?: string[];
  text?: string;              // First 100 chars of textContent
  children?: DomNode[];
  selector: string;           // Generated unique CSS selector
  attributes?: Record<string, string>;  // data-testid, role, aria-label, etc.
}
```

### Anti-Patterns to Avoid
- **Using page.accessibility.snapshot():** This API is deprecated in modern Playwright. Use `locator.ariaSnapshot()` instead.
- **Deep DOM serialization:** Returning the entire DOM tree will overwhelm Claude's context. Limit depth (3-4 levels) and truncate text content.
- **fullPage + selector combination:** If a selector is provided, fullPage should be ignored. The element screenshot is inherently scoped.
- **Transparent background with JPEG:** JPEG does not support alpha channels. If `omitBackground: true` and format is JPEG, either warn or force PNG.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Element screenshot | Manual coordinate calculation | `locator.screenshot()` (zero-padding case) | Handles scroll position, viewport clipping, device scale |
| CSS injection | Creating style elements via evaluate | `page.addStyleTag({ content })` | Handles race conditions, proper injection timing |
| JS injection | Custom script loading | `page.addScriptTag({ content })` or `page.evaluate()` | Proper execution context, error handling |
| Waiting for element | Custom polling loops | `locator.waitFor({ state: 'visible' })` | Built-in retry, proper timeout handling |
| Bounding box calculation | Manual offset computation | `locator.boundingBox()` | Accounts for transforms, scroll position, scale factor |

**Key insight:** Playwright's locator API handles the hard problems (scroll offsets, device scale factors, element visibility) internally. The only custom logic needed is padding math and DOM tree summarization.

## Common Pitfalls

### Pitfall 1: Element Not Found / Not Visible
**What goes wrong:** CSS selector matches nothing or matches a hidden element; `boundingBox()` returns null.
**Why it happens:** Dynamic pages, selector typos, elements hidden by responsive design.
**How to avoid:** Always call `locator.waitFor({ state: 'visible' })` with a reasonable timeout before capturing. Return a clear error message with the selector that failed.
**Warning signs:** `boundingBox()` returning null, screenshot being 0x0 pixels.

### Pitfall 2: Transparent Background Requires PNG
**What goes wrong:** User requests `omitBackground: true` with JPEG format; JPEG has no alpha channel so transparency is lost.
**Why it happens:** JPEG format limitation.
**How to avoid:** Validate at the parameter level: if `omitBackground` is true and format is JPEG, either auto-switch to PNG with a warning, or reject with a clear error.
**Warning signs:** White background appearing despite omitBackground being set.

### Pitfall 3: Padding Extends Beyond Viewport
**What goes wrong:** Padding causes clip coordinates to go negative or exceed page dimensions.
**Why it happens:** Element is near the edge of the viewport/page.
**How to avoid:** Clamp clip coordinates: `x = Math.max(0, box.x - padding)`. For the right/bottom edges, clamp to page dimensions. Consider scrolling to center the element first.
**Warning signs:** Playwright throwing "clip area is outside of the page" errors.

### Pitfall 4: DOM Summary Too Large for MCP Response
**What goes wrong:** Large pages produce DOM summaries that exceed reasonable size for Claude to process.
**Why it happens:** Complex pages with thousands of elements.
**How to avoid:** Limit DOM traversal depth (3-4 levels), truncate text content (100 chars), skip script/style/svg internals, cap total nodes (500-1000). Include a `truncated: true` flag when limits are hit.
**Warning signs:** MCP response taking too long, Claude struggling to parse the output.

### Pitfall 5: Preparation Order Matters
**What goes wrong:** JS injection runs before CSS injection, or element hiding doesn't take effect before screenshot.
**Why it happens:** Async operations completing in unpredictable order.
**How to avoid:** Execute preparation steps sequentially in a defined order: (1) hide elements via CSS, (2) inject custom CSS, (3) execute custom JS. Await each step.
**Warning signs:** Inconsistent screenshot results on the same page.

### Pitfall 6: Scale Factor Affects Bounding Box
**What goes wrong:** Padding calculations are off when device scale factor is not 1x.
**Why it happens:** `boundingBox()` returns CSS pixels, but screenshot clip also uses CSS pixels, so this should be consistent. However, the resulting image dimensions will be multiplied by the scale factor.
**How to avoid:** Keep padding in CSS pixels (matching boundingBox units). Document that padding is in CSS pixels, not physical pixels. The screenshot dimensions in the result will reflect the scale factor.
**Warning signs:** Padding appearing larger or smaller than expected at different scale factors.

## Code Examples

### Element Screenshot (ELEM-01, ELEM-03, ELEM-04)
```typescript
// Source: Playwright docs - locator.screenshot() and page.screenshot({ clip })
const locator = page.locator(selector);
await locator.waitFor({ state: 'visible', timeout: 5000 });

// Zero padding: use locator.screenshot directly
const buffer = await locator.screenshot({
  type: 'png',
  omitBackground: true,  // ELEM-04: transparent background
});

// With padding: use bounding box + clip
const box = await locator.boundingBox();
const clip = {
  x: Math.max(0, box.x - padding),
  y: Math.max(0, box.y - padding),
  width: box.width + padding * 2,
  height: box.height + padding * 2,
};
const buffer = await page.screenshot({ type: 'png', omitBackground: true, clip });
```

### CSS Injection (PREP-01)
```typescript
// Source: Playwright docs - page.addStyleTag()
await page.addStyleTag({ content: 'body { background: #f0f0f0; }' });
```

### JS Injection (PREP-02)
```typescript
// Source: Playwright docs - page.evaluate()
await page.evaluate(() => {
  document.querySelector('.cookie-banner')?.remove();
});

// Or for user-provided JS string:
await page.evaluate(userJsString);
```

### Element Hiding (PREP-03)
```typescript
// Source: Playwright docs - page.addStyleTag()
const hideCSS = selectors
  .map(s => `${s} { display: none !important; }`)
  .join('\n');
await page.addStyleTag({ content: hideCSS });
```

### DOM Inspection (ELEM-05)
```typescript
// Source: Playwright docs - locator.ariaSnapshot()
const ariaSnapshot = await page.locator('body').ariaSnapshot();

// Custom DOM summary via page.evaluate
const domSummary = await page.evaluate((maxDepth) => {
  function summarize(el: Element, depth: number): any {
    if (depth > maxDepth) return null;
    const tag = el.tagName.toLowerCase();
    if (['script', 'style', 'svg', 'noscript'].includes(tag)) return null;

    const node: any = { tag };
    if (el.id) node.id = el.id;
    const classes = Array.from(el.classList);
    if (classes.length) node.classes = classes;

    // Include useful attributes
    const testId = el.getAttribute('data-testid');
    if (testId) node.attributes = { ...node.attributes, 'data-testid': testId };
    const role = el.getAttribute('role');
    if (role) node.attributes = { ...node.attributes, role };
    const ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel) node.attributes = { ...node.attributes, 'aria-label': ariaLabel };

    // Text content (leaf nodes only, truncated)
    if (el.children.length === 0) {
      const text = el.textContent?.trim().slice(0, 100);
      if (text) node.text = text;
    }

    // Generate a selector
    if (el.id) {
      node.selector = `#${el.id}`;
    } else if (testId) {
      node.selector = `[data-testid="${testId}"]`;
    } else {
      node.selector = tag + (classes.length ? `.${classes.join('.')}` : '');
    }

    const children = Array.from(el.children)
      .map(c => summarize(c, depth + 1))
      .filter(Boolean);
    if (children.length) node.children = children;

    return node;
  }
  return summarize(document.body, 0);
}, 4);  // max depth of 4
```

### MCP Tool Registration for inspect_page (ELEM-05)
```typescript
// Source: MCP SDK docs
server.tool(
  "shotput_inspect",
  "Inspect a web page and return its DOM structure for element targeting",
  {
    url: z.string().url(),
    width: z.number().int().positive().default(1280),
    height: z.number().int().positive().default(720),
    wait: z.union([
      z.enum(["networkidle", "domcontentloaded", "load"]),
      z.number().positive(),
    ]).default("networkidle"),
    timeout: z.number().positive().default(30000),
  },
  async (params) => {
    // ... navigate, build DOM summary, return structured content
  }
);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `page.accessibility.snapshot()` | `locator.ariaSnapshot()` | Playwright 1.49+ | Returns YAML string, more structured |
| `elementHandle.screenshot()` | `locator.screenshot()` | Playwright 1.14+ | Locator API is preferred, auto-waits |
| `page.$()` for element selection | `page.locator()` | Playwright 1.14+ | Locator is the standard API now |

**Deprecated/outdated:**
- `page.accessibility.snapshot()`: Replaced by `locator.ariaSnapshot()` in modern Playwright
- `ElementHandle` API: Replaced by Locator API; locators auto-wait and are more robust

## Open Questions

1. **DOM summary depth/size limits**
   - What we know: Large pages can produce very large DOM trees. Need to cap output.
   - What's unclear: Exact limits for optimal Claude reasoning (too little = can't find elements, too much = context overflow).
   - Recommendation: Start with depth=4, max 500 nodes, 100-char text truncation. Adjust based on testing.

2. **Natural language to selector workflow (ELEM-02)**
   - What we know: The `inspect_page` tool provides DOM context. Claude uses its reasoning to map "the login button" to a CSS selector. The user then passes that selector to `shotput_capture`.
   - What's unclear: Whether the tool should attempt any selector suggestion itself, or purely return data for Claude.
   - Recommendation: Keep the tool as a pure data provider. Claude is the reasoning layer. The tool returns structured DOM data; Claude picks the selector.

3. **Element screenshot dimensions in CaptureResult**
   - What we know: Current CaptureResult returns viewport width/height. Element screenshots have different dimensions.
   - What's unclear: Whether to return element dimensions or keep returning viewport dimensions.
   - Recommendation: Return actual captured dimensions (element bounding box + padding, multiplied by scale factor) when a selector is used.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (latest) |
| Config file | implied via package.json `vitest run --reporter=verbose` |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run --reporter=verbose` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ELEM-01 | Element capture by CSS selector | integration | `npx vitest run tests/capture.test.ts -t "element" -x` | No - Wave 0 |
| ELEM-02 | Natural language -> Claude identifies selector | manual-only | N/A (requires Claude reasoning) | N/A |
| ELEM-03 | Padding around element bounding box | unit+integration | `npx vitest run tests/capture.test.ts -t "padding" -x` | No - Wave 0 |
| ELEM-04 | Transparent background capture | integration | `npx vitest run tests/capture.test.ts -t "transparent" -x` | No - Wave 0 |
| ELEM-05 | inspect_page tool returns DOM summary | integration | `npx vitest run tests/server.test.ts -t "inspect" -x` | No - Wave 0 |
| PREP-01 | Inject custom CSS before capture | integration | `npx vitest run tests/capture.test.ts -t "inject CSS" -x` | No - Wave 0 |
| PREP-02 | Inject custom JS before capture | integration | `npx vitest run tests/capture.test.ts -t "inject JS" -x` | No - Wave 0 |
| PREP-03 | Hide elements by selector before capture | integration | `npx vitest run tests/capture.test.ts -t "hide" -x` | No - Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run --reporter=verbose`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/fixtures/element-page.html` -- test page with multiple identifiable elements (id, class, data-testid), varied backgrounds, nested structure
- [ ] `tests/inspect.test.ts` -- tests for DOM inspection / inspect_page tool
- [ ] Extended tests in `tests/capture.test.ts` for element targeting, padding, transparency
- [ ] Extended tests in `tests/server.test.ts` for shotput_inspect tool registration and response format

## Sources

### Primary (HIGH confidence)
- Playwright official docs: locator.screenshot(), page.screenshot({ clip }), omitBackground option
- Playwright official docs: page.addStyleTag(), page.addScriptTag(), page.evaluate()
- Playwright official docs: locator.ariaSnapshot() -- [Snapshot testing](https://playwright.dev/docs/aria-snapshots)
- Playwright official docs: locator.boundingBox()
- MCP SDK: server.tool() registration pattern (already proven in Phase 1)

### Secondary (MEDIUM confidence)
- [Playwright element screenshot techniques](https://lirantal.com/blog/advanced-usage-patterns-for-taking-page-element-screenshots-with-playwright) -- padding and masking patterns
- [Playwright evaluating JavaScript](https://playwright.dev/docs/evaluating) -- page.evaluate patterns

### Tertiary (LOW confidence)
- DOM summary structure and limits: Based on general practice; specific limits (depth=4, 500 nodes) need validation through testing

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all needed APIs exist in current Playwright version already in project
- Architecture: HIGH - straightforward extension of existing capture pipeline
- Pitfalls: HIGH - well-known issues with element screenshots, transparent backgrounds, and DOM size
- DOM inspection design: MEDIUM - the ariaSnapshot API is confirmed, but optimal DOM summary structure for Claude reasoning needs empirical tuning

**Research date:** 2026-03-07
**Valid until:** 2026-04-07 (stable APIs, low churn risk)
