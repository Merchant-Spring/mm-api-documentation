#!/usr/bin/env node
/**
 * prepare-openapi.mjs — turn the source API spec into a clean, Mintlify-ready OpenAPI doc.
 *
 * Source of truth today: mm-api-gateway-service/swagger.yaml (or its AWS `get-export` OAS3
 * artifact). This script is intentionally source-agnostic — point INPUT at the gateway spec
 * now, or at an mm-external-apis spec later; the output contract is the same. (This is the
 * same transform Hermes would run.)
 *
 * What it does:
 *   1. Strips AWS-only `x-amazon-apigateway-*` extensions (recursively).
 *   2. Drops the OPTIONS CORS-mock operations.
 *   3. Removes the duplicate per-operation `x-api-key` header parameter — the API key is
 *      already modelled by `components.securitySchemes.api_key` + each op's `security` ref,
 *      so the playground should render the auth field exactly once.
 *   4. Sets `servers` to the public hosts (prod first, dev second for testing).
 *
 * Usage:
 *   node scripts/prepare-openapi.mjs [INPUT] [OUTPUT]
 *
 * INPUT may be a local file path OR an http(s) URL. Resolution order:
 *   1. CLI arg:   node scripts/prepare-openapi.mjs <path-or-url> [output]
 *   2. env var:   OPENAPI_SOURCE=<path-or-url>   (e.g. a raw spec URL in CI / Hermes)
 *   3. default:   ../mm-api-gateway-service/swagger.yaml  (sibling checkout)
 * OUTPUT: CLI arg, or OPENAPI_OUTPUT env var, default ./api-reference/openapi.json.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");

const RAW_INPUT =
  process.argv[2] ||
  process.env.OPENAPI_SOURCE ||
  resolve(repoRoot, "../mm-api-gateway-service/swagger.yaml");
const INPUT_IS_URL = /^https?:\/\//i.test(RAW_INPUT);
const INPUT = INPUT_IS_URL ? RAW_INPUT : resolve(RAW_INPUT);
const OUTPUT = resolve(
  process.argv[3] || process.env.OPENAPI_OUTPUT || resolve(repoRoot, "api-reference/openapi.json")
);

// Load the source spec from a URL (fetched over HTTP) or a local file.
async function loadSource() {
  if (INPUT_IS_URL) {
    const res = await fetch(INPUT);
    if (!res.ok) {
      throw new Error(`Failed to fetch spec from ${INPUT} — ${res.status} ${res.statusText}`);
    }
    return res.text();
  }
  return readFileSync(INPUT, "utf8");
}

// Hosts verified reachable (keyless request returns 403); match api-deploy.sh per environment.
// Order matters: the FIRST entry is the playground's default, so a non-prod host is listed
// first to avoid accidental writes (tags / COGS endpoints mutate data) against production.
const SERVERS = [
  { url: "https://mm-api-staging.merchantspring.io", description: "Staging" },
  // TODO: Other environments intentionally omitted for now — uncomment when ready to expose them.
  // { url: "https://mm-api.merchantspring.io", description: "Production" },
];

// Endpoints not yet deployed to staging/prod — excluded from the published docs.
// Remove a prefix here once the endpoints ship, then re-run to publish them.
const EXCLUDE_PATH_PREFIXES = ["/tags"];

// Recursively delete any key matching `x-amazon-apigateway*` anywhere in the tree.
function stripAwsExtensions(node) {
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

const HTTP_METHODS = ["get", "put", "post", "delete", "patch", "head", "options", "trace"];

function isApiKeyHeaderParam(p) {
  return p && p.in === "header" && p.name === "x-api-key";
}

async function main() {
  const raw = await loadSource();
  const spec = yaml.load(raw);

  // 1. Strip AWS-only extensions (incl. top-level x-amazon-apigateway-documentation).
  stripAwsExtensions(spec);

  // 1b. Drop excluded paths (endpoints not yet live on staging/prod).
  let pathsExcluded = 0;
  for (const path of Object.keys(spec.paths || {})) {
    if (EXCLUDE_PATH_PREFIXES.some((prefix) => path === prefix || path.startsWith(prefix + "/"))) {
      delete spec.paths[path];
      pathsExcluded++;
    }
  }

  let optionsRemoved = 0;
  let apiKeyParamsRemoved = 0;
  let summariesCleaned = 0;

  for (const pathItem of Object.values(spec.paths || {})) {
    // 2. Drop OPTIONS CORS-mock operations.
    if (pathItem.options) {
      delete pathItem.options;
      optionsRemoved++;
    }
    for (const method of HTTP_METHODS) {
      const op = pathItem[method];
      if (!op) continue;
      // 3. Remove the duplicate x-api-key header parameter from every operation.
      if (Array.isArray(op.parameters)) {
        const before = op.parameters.length;
        op.parameters = op.parameters.filter((p) => !isApiKeyHeaderParam(p));
        apiKeyParamsRemoved += before - op.parameters.length;
        if (op.parameters.length === 0) delete op.parameters;
      }
      // 3b. Strip double-quotes from summaries — Mintlify derives the page slug from the
      //     summary, and quotes produce ugly %22 slugs that are awkward to link to.
      if (typeof op.summary === "string" && op.summary.includes('"')) {
        op.summary = op.summary.replace(/"/g, "");
        summariesCleaned++;
      }
    }
  }

  // Prune top-level tags that no longer have any operations after exclusion.
  if (Array.isArray(spec.tags)) {    
    const usedTags = new Set();
    for (const pathItem of Object.values(spec.paths || {})) {
      for (const method of HTTP_METHODS) {
        const op = pathItem[method];
        if (op && Array.isArray(op.tags)) op.tags.forEach((t) => usedTags.add(t));
      }
    }
    spec.tags = spec.tags.filter((t) => usedTags.has(t.name));
  }

  // Safety: the security scheme must exist for the playground auth field to render.
  const scheme =
    spec.components && spec.components.securitySchemes && spec.components.securitySchemes.api_key;
  if (!scheme) {
    spec.components = spec.components || {};
    spec.components.securitySchemes = spec.components.securitySchemes || {};
    spec.components.securitySchemes.api_key = { type: "apiKey", name: "x-api-key", in: "header" };
    console.warn("⚠  api_key security scheme was missing — added it.");
  }

  // 4. Public servers.
  spec.servers = SERVERS;

  mkdirSync(dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, JSON.stringify(spec, null, 2) + "\n", "utf8");

  const opCount = Object.values(spec.paths || {}).reduce(
    (n, item) => n + HTTP_METHODS.filter((m) => item[m]).length,
    0
  );
  console.log(`✓ wrote ${OUTPUT}`);
  console.log(`  input:                 ${INPUT}${INPUT_IS_URL ? " (url)" : ""}`);
  console.log(`  operations:            ${opCount}`);
  console.log(`  paths excluded:        ${pathsExcluded} (${EXCLUDE_PATH_PREFIXES.join(", ") || "none"})`);
  console.log(`  OPTIONS removed:       ${optionsRemoved}`);
  console.log(`  x-api-key params cut:  ${apiKeyParamsRemoved}`);
  console.log(`  summaries de-quoted:   ${summariesCleaned}`);
}

main().catch((err) => {
  console.error(`prepare-openapi failed: ${err.message || err}`);
  process.exit(1);
});
