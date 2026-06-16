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

The API-reference pages **and their navigation** are **auto-generated** from `openapi.json` —
they are not MDX files, and endpoints are grouped automatically by their OpenAPI tag. To change
an endpoint, edit the source spec (not `openapi.json` by hand) — see
[Adding (or changing) an endpoint](#adding-or-changing-an-endpoint).

## Updating the API reference

The source of truth for the endpoints for now is `mm-api-gateway-service/swagger.yaml`.
`scripts/prepare-openapi.mjs` cleans it into the Mintlify-ready `api-reference/openapi.json`:

- strips AWS-only `x-amazon-apigateway-*` extensions and OPTIONS CORS mocks,
- removes the duplicate per-operation `x-api-key` header parameter (the key is modeled once
  via the `api_key` security scheme, so the playground shows the auth field once),
- de-quotes operation summaries (for clean page slugs),
- derives clean navigation group headings from each tag (via `x-group`),
- converts inline HTML in descriptions to MDX-safe Markdown (so pages compile),
- sets the public `servers`.

As long as `mm-api-gateway-service` is checked out in the same parent directory as
`mm-api-documentation` (sibling folders), we can run:

```bash
npm run prepare-openapi
```

Then commit the regenerated `api-reference/openapi.json`.

<details>
<summary>Advanced: other input sources (CI / standalone clones)</summary>

The script reads the source spec from, in order: a CLI argument, the `OPENAPI_SOURCE` env var,
or the default sibling path `../mm-api-gateway-service/swagger.yaml`. The input may be a local
path or an http(s) URL; the output path can be overridden with a 2nd arg or `OPENAPI_OUTPUT`.

```bash
node scripts/prepare-openapi.mjs /path/to/swagger.yaml
OPENAPI_SOURCE="https://example.com/swagger.yaml" npm run prepare-openapi
```
</details>

### Adding (or changing) an endpoint

Navigation is **auto-generated**: endpoints are grouped by their OpenAPI `tag`, the group
headings come from the spec (the script derives them), and each tag renders as its own
collapsible group. So you normally only touch the spec:

1. **Regenerate:** `npm run prepare-openapi` (pulls the latest `swagger.yaml` and rewrites
   `api-reference/openapi.json`). A new endpoint appears automatically under its tag's group; a
   brand-new tag creates a new group on its own — no manual nav entry needed.
2. **Validate:** `mint validate` and `npm run broken-links`.
3. **Commit** `api-reference/openapi.json`.

You only edit `docs.json` to change the nav *structure* itself (e.g. rename the parent
"MerchantSpring API" group). Individual endpoints never need a manual entry there.

> To **change** an existing endpoint (params / responses / description), edit the source spec
> in `mm-api-gateway-service` and re-run step 1 — don't hand-edit `openapi.json`.

> To **hide** an endpoint, add `"x-excluded": true` (removes it entirely) or `"x-hidden": true`
> (keeps the page, drops it from nav) under that operation in the source spec, then regenerate.

## Validating

```bash
npm run broken-links    # mint broken-links — checks internal links
mint validate           # validates the OpenAPI spec
```

Run both before opening a PR.

## Editing Content (Non-API)

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
