#!/usr/bin/env node
/**
 * prepare-openapi.mjs — turn the source API spec into a clean, Mintlify-ready OpenAPI doc.
 *
 * Source of truth today: mm-api-gateway-service/swagger.yaml (or its AWS `get-export` OAS3
 * artifact). This script is intentionally source-agnostic — point INPUT at the gateway spec
 * now, or at an mm-external-apis spec later; the output contract is the same. (This is the
 * same transform Hermes would run.)
 *
 * This file is just orchestration: load the spec, run the transforms (see
 * ./openapi-transforms.mjs), write the result, and log a summary.
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
import {
  countOperations,
  dequoteSummaries,
  dropOptionsOperations,
  ensureApiKeyScheme,
  normalizeTags,
  removeApiKeyParams,
  sanitizeProseTree,
  stripAwsExtensions,
} from "./openapi-transforms.mjs";

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

// Hosts verified reachable (keyless request returns 403); match api-deploy.sh per environment.
// Order matters: the FIRST entry is the playground's default, so a non-prod host is listed
// first to avoid accidental writes (tags / COGS endpoints mutate data) against production.
const SERVERS = [
  { url: "https://mm-api.merchantspring.io", description: "Production" },
  { url: "https://mm-api-staging.merchantspring.io", description: "Staging" }
];

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

async function main() {
  const spec = yaml.load(await loadSource());

  stripAwsExtensions(spec);
  const optionsRemoved = dropOptionsOperations(spec);
  const apiKeyParamsRemoved = removeApiKeyParams(spec);
  const summariesCleaned = dequoteSummaries(spec);
  const proseSanitized = sanitizeProseTree(spec);
  const navGroups = normalizeTags(spec);
  if (ensureApiKeyScheme(spec)) console.warn("⚠  api_key security scheme was missing — added it.");
  spec.servers = SERVERS;

  mkdirSync(dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, JSON.stringify(spec, null, 2) + "\n", "utf8");

  console.log(`✓ wrote ${OUTPUT}`);
  console.log(`  input:                 ${INPUT}${INPUT_IS_URL ? " (url)" : ""}`);
  console.log(`  operations:            ${countOperations(spec)}`);
  console.log(`  nav groups:            ${navGroups.join(", ")}`);
  console.log(`  OPTIONS removed:       ${optionsRemoved}`);
  console.log(`  x-api-key params cut:  ${apiKeyParamsRemoved}`);
  console.log(`  summaries de-quoted:   ${summariesCleaned}`);
  console.log(`  prose sanitized:       ${proseSanitized}`);
}

main().catch((err) => {
  console.error(`prepare-openapi failed: ${err.message || err}`);
  process.exit(1);
});
