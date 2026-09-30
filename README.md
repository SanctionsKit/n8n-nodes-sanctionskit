# n8n-nodes-sanctionskit

Connect [SanctionsKit](https://www.sanctionskit.com/) to n8n for sanctions screening during customer onboarding, supplier review and other compliance workflows. Screen a subject, inspect source availability and approved policies, and retrieve retained results or evidence.

**The free sandbox uses synthetic records. Production screening requires paid access and a production API key.** Potential matches require review. A no-match result is limited to the selected coverage and matching rules; neither result is a business approval or legal clearance.

## Installation

For self-hosted n8n, install `n8n-nodes-sanctionskit` under **Settings → Community Nodes**. See [n8n's community-node installation guide](https://docs.n8n.io/integrations/community-nodes/installation-and-management/gui-installation).

n8n Cloud availability depends on n8n verification. This package does not claim verified status.

## Credentials

1. [Create a SanctionsKit account](https://www.sanctionskit.com/signup) and follow the [quickstart](https://www.sanctionskit.com/docs/quickstart).
2. Create a sandbox API key in your dashboard. Use a key with permission for the operations you need.
3. Add a **SanctionsKit API** credential in n8n. Paste the API key into the password field and select **Sandbox (Synthetic Data)**.
4. Test the credential. The test reads the source catalog; it does not run a screening.

The API key owns its environment. Both environments use `https://www.sanctionskit.com/api/v1`. This node checks the key prefix against the selected environment before execution and rejects conflicting coverage. For production, create a separate credential, select **Production (Paid Screening)** and explicitly select your available coverage package or source IDs.

## Operations

| Resource | Operation | Output |
| --- | --- | --- |
| Screening | Create | One screening result per input item |
| Screening | Get | Retained result, including retained subject and reference when available |
| Screening | Get Evidence | Complete `sanctionskit-evidence@1` document, including retention and replay limits |
| Source | Get Many | Source catalog entries with availability, rights, freshness and capability information |
| Policy | Get Page | Policy page with `items`, `requirePolicy` and `nextCursor` |

Source catalog membership does not prove that a source is active, fresh or authorized for your screening. Inspect availability and capability fields. The API rejects unavailable coverage. Policy pages deliberately retain `requirePolicy`, including when `items` is empty. Supply the approved policy ID and exact version when your organization requires a policy. Follow `nextCursor` to retrieve subsequent pages.

Create Screening accepts a name and entity type, with optional country, partial date of birth, typed identifiers, internal reference, approved policy, counterparty ID and retention setting. Do not invent missing dates or identifiers. A linked counterparty must already exist with the same identity in the selected environment.

## First workflow

Import [the synthetic sandbox example](examples/synthetic-screening.json), select your sandbox credential on both SanctionsKit nodes, and run it manually. It screens the fictional person **Alex Example** using `sandbox@1`, then retrieves the evidence document. It contains no API key, account identifiers or real customer data.

The example builds a key from the workflow execution ID and item index. That is suitable for independent demonstration runs. In an operational workflow, use a stable business-event identifier such as `onboarding:customer123:v1`. Reuse the same idempotency key and unchanged input when retrying an event, including after a timeout. Use a new key for a different screening. Keys must be 8–128 letters, digits, underscores, colons, periods or hyphens. Each successfully completed production subject consumes one allowance unit; failed screenings and identical idempotent retries do not consume additional units.

The default output preserves returned fields, including candidates, coverage, source versions, matching policy and interpretation limits. **Simplify** reduces a screening result to at most ten fields while retaining that decision context; it omits retained inputs and future extension fields. When used as a tool, Output offers Raw, Simplified and Selected Fields. Selected Fields always retains ID, environment, status, coverage, versions and interpretation limits. Get Evidence always returns the full evidence document. Keep that evidence with the human review record. Minimal retention omits submitted inputs and limits historical replay.

## Errors and retries

Errors stop the node unless **On Error → Continue** is enabled. Continued failures return an `error` field; they never become a no-match result. Route these items to an error or review branch. Request failures omit subject inputs and credentials from their error text. n8n can still retain node inputs and outputs in execution history: configure your instance's access and execution-retention settings for your data.

Check API-key permissions for authentication or authorization errors, allowance for `402`, the unchanged body and key for `409`, and source availability or freshness for coverage failures. For `429` or transient service failures, use a bounded retry with backoff. The node does not automatically retry or fall back to different sources. Requests time out after 30 seconds and do not follow redirects.

## Compatibility and development

TypeScript package using n8n's credential and HTTP helpers, with no additional runtime dependencies. Requires Node.js 22.16 or later. Local automated validation uses `n8n-workflow` 2.41.1, TypeScript 5.9.3 and the official `@n8n/node-cli` 0.50.3. Package loading and example workflow import/export were also checked in n8n 2.41.4. Visual editor and authenticated sandbox checks are separate release checks.

```sh
npm ci
npm run check
npm run dev
```

The node uses programmatic execution to validate environment/coverage and idempotency together, preserve complete evidence, and sanitize failures without returning a successful decision. Tests use synthetic fixtures and a dated snapshot of the public OpenAPI request contract. They never call the production API.

## Resources

- [SanctionsKit API documentation](https://www.sanctionskit.com/docs)
- [Sanctions screening API quickstart](https://www.sanctionskit.com/docs/quickstart)
- [OpenAPI contract](https://www.sanctionskit.com/openapi.json)
- [Report an integration issue](https://github.com/SanctionsKit/n8n-nodes-sanctionskit/issues)

Maintained by SanctionsKit. Support: support@sanctionskit.com. Licensed under MIT; see [LICENSE](LICENSE).
