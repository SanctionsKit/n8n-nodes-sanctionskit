# Publishing and n8n verification

Repository: `SanctionsKit/n8n-nodes-sanctionskit`.
Package: `n8n-nodes-sanctionskit`.
Company contact: `support@sanctionskit.com`.

## Before first publication

1. Use the SanctionsKit GitHub identity and a public repository matching `package.json`. Check commit author and committer; do not publish a personal identity. Publish the package directory as the repository root, excluding `node_modules`, `dist`, local credentials and unrelated marketing material.
2. Run `npm ci --ignore-scripts`, `npm run check` and `npm pack --dry-run`. Inspect the resulting file list.
3. Run a supported local n8n instance, import `examples/synthetic-screening.json`, select a sandbox credential and verify Create → Get Evidence. Also inspect Source: Get Many, Policy: Get Page, credential failure and Continue On Error behavior. Record the actual n8n version and result separately from unit tests. Do not substitute a production key.
4. Confirm the npm account is `sanctionskit`. Configure a narrowly scoped `NPM_TOKEN` GitHub Actions secret for the first publication, or use an existing npm trusted-publishing setup. Do not put tokens in source, command logs or documentation. The workflow authenticates through the standard `NODE_AUTH_TOKEN` mechanism.
5. Push `main`, allow CI to pass, then tag the exact checked commit as `v0.1.0` and push the tag. `.github/workflows/publish.yml` checks that the tag matches `package.json`, runs checks and publishes using `--provenance`. Never publish this verification candidate directly from a local workstation.
6. Verify npm metadata, owner, repository link, public tarball contents and the actual provenance attestation. Set npm Trusted Publisher to owner `SanctionsKit`, repository `n8n-nodes-sanctionskit`, workflow `publish.yml`. Remove bootstrap token access once trusted publishing has been tested.
7. Run `npx @n8n/scan-community-package n8n-nodes-sanctionskit@0.1.0` against the published package. The registry/provenance scan is distinct from running the same scanner's `analyzePackage` function on local source and compiled files.
8. Sign in to the [n8n Creator Portal](https://creators.n8n.io/nodes), submit the exact package and repository, and save the receipt. Respond to reviewer requests and update the package using a new version if needed.
9. After acceptance, verify the actual integration page, company `href` and `rel`, discoverability in the node picker and installation behavior. An npm release or review submission is not an accepted n8n integration or a new n8n backlink.

## Submission facts

- Display name: SanctionsKit
- Company: SanctionsKit, LLC
- Homepage: https://www.sanctionskit.com/
- Documentation: https://www.sanctionskit.com/docs/quickstart
- Public source: https://github.com/SanctionsKit/n8n-nodes-sanctionskit
- npm package: https://www.npmjs.com/package/n8n-nodes-sanctionskit
- License: MIT
- Authentication: bearer API key, sandbox and production environments
- Purpose: sanctions screening with source coverage, approved policies and retained evidence for onboarding and supplier-review workflows
- Operations: create screening; retrieve retained result; retrieve evidence; list source availability; retrieve approved policy pages
- Example: fictional synthetic sandbox screening followed by evidence retrieval
- Additional runtime dependencies: none; `n8n-workflow` is the host peer dependency
- Limitations: synthetic sandbox is not production coverage; review is required for potential matches; no-match is limited to selected coverage; no automated legal-clearance or business-approval decision

## Official requirements checked 30 September 2026

- [Verification guidelines](https://docs.n8n.io/connect/create-nodes/build-your-node/reference/verification-guidelines)
- [Submission and provenance workflow](https://docs.n8n.io/connect/create-nodes/deploy-your-node/submit-community-nodes)
- [Node UX guidelines](https://docs.n8n.io/connect/create-nodes/build-your-node/reference/ux-guidelines)
- [Official node CLI](https://docs.n8n.io/connect/create-nodes/build-your-node/using-the-n8n-node-tool)

The submission route is the Creator Portal. The older `/integrations/creating-nodes/...` pages are stale. n8n review and timing remain controlled by n8n.
