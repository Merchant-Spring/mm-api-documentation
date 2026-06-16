/**
 * openapi-transforms.mjs — the pure transforms that turn a raw source spec into a clean,
 * Mintlify-ready OpenAPI document.
 *
 * Each transform mutates the passed `spec` in place and returns a small result (a count or the
 * resulting group list) so the orchestrator (prepare-openapi.mjs) can log what it did. These are
 * intentionally dependency-free and I/O-free (no fs / network / console) — easy to read in
 * isolation and to unit-test.
 */

export const HTTP_METHODS = ["get", "put", "post", "delete", "patch", "head", "options", "trace"];

// Derive a human nav-group heading from a tag name: split words on - _ and camelCase
// boundaries, then Title-Case each. e.g. "content-change" -> "Content Change",
// "customGroup" -> "Custom Group", "APIKey" -> "API Key", "profitability" -> "Profitability".
export const toDisplayName = (tag) =>
  tag
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2") // fooBar -> foo Bar
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2") // APIKey -> API Key
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

// Recursively delete any key matching `x-amazon-apigateway*` anywhere in the tree.
export function stripAwsExtensions(node) {
  if (Array.isArray(node)) {
    node.forEach(stripAwsExtensions);
    return;
  }
  if (node && typeof node === "object") {
    for (const key of Object.keys(node)) {
      if (key.startsWith("x-amazon-apigateway")) {
        delete node[key];
      } else {
        stripAwsExtensions(node[key]);
      }
    }
  }
}

// Drop the OPTIONS CORS-mock operations. Returns the count removed.
export function dropOptionsOperations(spec) {
  let removed = 0;
  for (const pathItem of Object.values(spec.paths || {})) {
    if (pathItem.options) {
      delete pathItem.options;
      removed++;
    }
  }
  return removed;
}

// Remove the duplicate per-operation `x-api-key` header parameter — the API key is already
// modelled by `components.securitySchemes.api_key` + each op's `security` ref, so the playground
// should render the auth field exactly once. Returns the count removed.
export function removeApiKeyParams(spec) {
  const isApiKeyHeaderParam = (p) => p && p.in === "header" && p.name === "x-api-key";
  let removed = 0;
  for (const pathItem of Object.values(spec.paths || {})) {
    for (const method of HTTP_METHODS) {
      const op = pathItem[method];
      if (!op || !Array.isArray(op.parameters)) continue;
      const before = op.parameters.length;
      op.parameters = op.parameters.filter((p) => !isApiKeyHeaderParam(p));
      removed += before - op.parameters.length;
      if (op.parameters.length === 0) delete op.parameters;
    }
  }
  return removed;
}

// Strip double-quotes from summaries — Mintlify derives the page slug from the summary, and
// quotes produce ugly %22 slugs that are awkward to link to. Returns the count changed.
export function dequoteSummaries(spec) {
  let changed = 0;
  for (const pathItem of Object.values(spec.paths || {})) {
    for (const method of HTTP_METHODS) {
      const op = pathItem[method];
      if (op && typeof op.summary === "string" && op.summary.includes('"')) {
        op.summary = op.summary.replace(/"/g, "");
        changed++;
      }
    }
  }
  return changed;
}

// Make a description/summary string MDX-safe: convert the inline HTML that appears in the source
// spec into Markdown, then escape any remaining stray angle brackets (placeholder text such as
// <tag> or <month columns>) so Mintlify's MDX parser doesn't read them as JSX and fail to compile.
function sanitizeProse(str) {
  return str
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(strong|b)>/gi, "**")
    .replace(/<\/?(em|i)>/gi, "*")
    .replace(/<\/?code>/gi, "`")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Recursively run sanitizeProse over every `description`/`summary` string. Returns the count changed.
export function sanitizeProseTree(node) {
  let changed = 0;
  if (Array.isArray(node)) {
    for (const item of node) changed += sanitizeProseTree(item);
  } else if (node && typeof node === "object") {
    for (const key of Object.keys(node)) {
      const value = node[key];
      if ((key === "description" || key === "summary") && typeof value === "string") {
        const next = sanitizeProse(value);
        if (next !== value) {
          node[key] = next;
          changed++;
        }
      } else {
        changed += sanitizeProseTree(value);
      }
    }
  }
  return changed;
}

// Rebuild the top-level tags so Mintlify's auto-generated nav has clean headings. Mintlify groups
// endpoints by their operation `tags` and reads this array: the lowercase `name` stays the URL
// slug, `x-group` is the displayed heading, and array order sets group order. We keep any
// already-declared tags in their existing order, then append newly-seen tags (sorted), and derive
// every heading automatically — so a new tag needs no manual change here. Returns the headings.
export function normalizeTags(spec) {
  const usedTags = new Set();
  for (const pathItem of Object.values(spec.paths || {})) {
    for (const method of HTTP_METHODS) {
      const op = pathItem[method];
      if (op && Array.isArray(op.tags)) op.tags.forEach((t) => usedTags.add(t));
    }
  }
  const declared = (spec.tags || []).map((t) => t.name).filter((n) => usedTags.has(n));
  const extra = [...usedTags].filter((n) => !declared.includes(n)).sort();
  spec.tags = [...declared, ...extra].map((name) => ({ name, "x-group": toDisplayName(name) }));
  return spec.tags.map((t) => t["x-group"]);
}

// Ensure the api_key security scheme exists — the playground auth field won't render without it.
// Returns true if it had to be added (so the caller can warn).
export function ensureApiKeyScheme(spec) {
  const scheme =
    spec.components && spec.components.securitySchemes && spec.components.securitySchemes.api_key;
  if (scheme) return false;
  spec.components = spec.components || {};
  spec.components.securitySchemes = spec.components.securitySchemes || {};
  spec.components.securitySchemes.api_key = { type: "apiKey", name: "x-api-key", in: "header" };
  return true;
}

// Count operations across all paths.
export function countOperations(spec) {
  return Object.values(spec.paths || {}).reduce(
    (n, item) => n + HTTP_METHODS.filter((m) => item[m]).length,
    0
  );
}
