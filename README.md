# mm-api-documentation

Public developer documentation for the **MerchantSpring Public API**, built with
[Mintlify](https://mintlify.com). The API reference is generated from the OpenAPI spec
that lives in `mm-api-gateway-service`; the guides are hand-written MDX.

Mintlify hosts the published site and auto-deploys on every merge to `main`. This repo is
just the content + config — there is no server to run in production.

## Prerequisites

- **Node.js 18+** (developed on Node 22).
- **Mintlify CLI** (`mint`), installed globally:
  ```bash
  npm i -g mint
  ```
  > On nvm, the CLI is tied to the active Node version — re-run the install if you switch versions.

## Run it locally

```bash
npm install        # installs js-yaml (used by the spec script)
mint dev           # or: npm run dev
```

Open **http://localhost:3000**. The dev server hot-reloads on file changes.

> You do **not** need the `mm-api-gateway-service` repo to preview — the prepared spec
> (`api-reference/openapi.json`) is committed. You only need it to *regenerate* the spec (below).

## How the docs are structured

| Path | What it is |
|------|------------|
| `docs.json` | Mintlify config: theme, branding, navigation, and the API-reference + playground wiring. |
| `introduction.mdx`, `authentication.mdx`, `quickstart.mdx` | Getting-started pages (hand-written MDX). |
| `guides/*.mdx` | Concept guides — reports, profitability, tags, conventions. |
| `api-reference/openapi.json` | The cleaned OpenAPI spec. **Generated — do not edit by hand.** |
| `scripts/prepare-openapi.mjs` | Produces `openapi.json` from the source spec (see below). |
| `logo/`, `images/`, `favicon.png` | Branding assets. |

The API-reference pages are **auto-generated** from `openapi.json` — they are not MDX files.
To change an endpoint's docs, change the source spec, not this repo.

## Updating the API reference (the spec pipeline)

The source of truth is `mm-api-gateway-service/swagger.yaml` (an AWS-flavored OpenAPI doc).
`scripts/prepare-openapi.mjs` cleans it into the Mintlify-ready `api-reference/openapi.json`:

- strips AWS-only `x-amazon-apigateway-*` extensions and OPTIONS CORS mocks,
- removes the duplicate per-operation `x-api-key` header parameter (the key is modeled once
  via the `api_key` security scheme, so the playground shows the auth field once),
- de-quotes operation summaries (for clean page slugs),
- sets the public `servers`.

The input can be a **local file path or an http(s) URL**, resolved in this order:

1. **CLI argument** — `node scripts/prepare-openapi.mjs <path-or-url> [output]`
2. **`OPENAPI_SOURCE` env var** — handy in CI / Hermes where there's no sibling checkout
3. **Default** — `../mm-api-gateway-service/swagger.yaml` (only works in the conductor checkout)

```bash
# Default: sibling checkout of mm-api-gateway-service
npm run prepare-openapi

# Explicit local path:
node scripts/prepare-openapi.mjs /path/to/swagger.yaml

# From a URL (e.g. a hosted/exported spec) — no gateway repo needed:
OPENAPI_SOURCE="https://example.com/swagger.yaml" npm run prepare-openapi
node scripts/prepare-openapi.mjs "https://example.com/swagger.yaml"
```

Output path can likewise be overridden via the 2nd CLI arg or `OPENAPI_OUTPUT`
(default `api-reference/openapi.json`). Commit the regenerated `openapi.json`.

> The sibling-path default only works inside the conductor checkout. A standalone clone or
> CI run should pass the source via argument or `OPENAPI_SOURCE`.

### Excluding not-yet-released endpoints

Endpoints that aren't on staging/prod yet are excluded via `EXCLUDE_PATH_PREFIXES` in the
script (currently `["/tags"]`). Remove a prefix and re-run to publish those endpoints.

## Validating

```bash
npm run broken-links    # mint broken-links — checks internal links
mint validate           # validates the OpenAPI spec
```

Run both before opening a PR.

## Editing content

- **Engineers:** edit the `.mdx` files directly and run `mint dev` to preview.
- **Non-Engineers:** use the Mintlify web editor (visual, no Git needed). It commits
  back to this repo — edits on a feature branch open a PR for review.
- Keep heavily-custom JSX out of pages meant for non-technical editing.

## Deployment

Merging to `main` triggers Mintlify to build and deploy automatically (requires the Mintlify
GitHub App to be installed on this repo). Pull requests get preview builds.

## Notes

- Live "Try it" requests in the playground route through Mintlify's proxy to the API host in
  `openapi.json` (`servers`). A valid `x-api-key` is required — keys are provisioned by
  MerchantSpring, **not** from these docs.
- `node_modules/` and `.mintlify/` are gitignored.
