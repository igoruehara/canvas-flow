# Canvas Flow production readiness

This is the minimum path for a controlled production rollout. Treat it as the
release gate before putting a customer workflow on Canvas Flow.

## Release gate

Run these commands before deploy:

```bash
cd backend
npm ci --legacy-peer-deps
npm test -- --runInBand
npm run audit:prod
npm run build

cd ../frontend
npm ci
npm run audit:prod
npm run build

cd ../npm_canvas_flow
npm run bundle
node bin/canvas-flow.js doctor --strict
```

For environments where network checks are not allowed in CI, use:

```bash
node bin/canvas-flow.js doctor --offline --strict
```

Warnings in `doctor --strict` should block a public production deploy. For an
internal pilot, a warning can be accepted only when the runbook explains why.

## Required production settings

Use [backend/.env.production.example](../backend/.env.production.example) or
[npm_canvas_flow/templates/config.production.example.json](../npm_canvas_flow/templates/config.production.example.json)
as the baseline.

Required decisions:

- `NODE_ENV=production`
- `ENABLE_SWAGGER=false`
- `CANVAS_FLOW_LOGIN=true` for any public admin UI
- strong `CANVAS_FLOW_API_TOKEN`, `CANVAS_FLOW_JWT_SECRET`, and media secret
- exact `CORS_ORIGINS`, never `*`
- Mongo backup configured outside the app
- LangGraph checkpoint TTL longer than the longest expected human approval window
- SQS enabled for public WhatsApp/API traffic when async recovery is needed
- provider secrets stored in env, SSM, or provider config, not in frontend env
- for AWS MCP infrastructure access, use a least-privilege runtime IAM role and require an approval node before mutating tools
- for OAuth MCP nodes, choose whether the credential is shared by the agent or isolated per Canvas Flow user; individual credentials require `CANVAS_FLOW_LOGIN=true`

## MCP OAuth user-scope migration

Deployments created before OAuth connections per user must migrate the Mongo
index once before enabling the new individual mode:

```bash
cd backend
npm run migrate:mcp-oauth-user-scope -- --dry-run
npm run migrate:mcp-oauth-user-scope
```

The migration preserves existing connections as `Compartilhada no agente`,
removes the legacy unique index, and adds the lookup index used by individual
connections.

For Google Workspace MCP servers, enable the base API and MCP API once in the
Google Cloud project used by the Canvas Flow OAuth client. Each Canvas Flow
user still authorizes their own Google account when the node uses
`Individual por usuario Canvas Flow`. A generated Canvas Flow API key runs
with the OAuth identity of the user who created that key. Cron, WhatsApp, and
master-token executions should use `Compartilhada no agente`.

## Staging smoke test

Run this after each staging deploy and before activating a customer release.

1. Check health:

```bash
curl -fsS "$CANVAS_FLOW_PUBLIC_URL/health"
```

2. Run a minimal inline flow through the API:

```bash
curl -fsS "$CANVAS_FLOW_PUBLIC_URL/api/canvas-flow/test" \
  -H "content-type: application/json" \
  -H "x-canvas-flow-token: $CANVAS_FLOW_API_TOKEN" \
  -d '{
    "agentId": "smoke",
    "conversationId": "smoke-001",
    "skipHistory": true,
    "config": {
      "title": "Smoke",
      "steps": [
        {"id":"start","type":"message","instruction":"ok"},
        {"id":"end","type":"end","instruction":"done"}
      ],
      "edges": [{"id":"e1","source":"start","target":"end"}]
    }
  }'
```

3. Validate persistence:

- create a draft flow in the UI
- deploy a version
- activate the version
- reload the UI and confirm the active version is still selected
- run two turns with the same `conversationId` and confirm `runtime.engine=langgraph`, `runtime.durable=true`, and a stable `runtime.threadId`
- run another conversation and confirm it receives a different `runtime.threadId`

4. Validate one real channel:

- for WebWidget, send a message and confirm memory/trace appears
- for WhatsApp, verify the webhook, send one inbound message, and confirm one outbound reply

5. Validate one real provider:

- for RAG, index one small document and ask a question
- for API/MCP, call a mock endpoint and inspect the stored slot

6. Validate the exposed MCP server:

```bash
MCP_AGENT_ID="${MCP_AGENT_ID:-default-agent}"
MCP_ENDPOINT="$CANVAS_FLOW_PUBLIC_URL/api/canvas-flow/mcp/$MCP_AGENT_ID"

curl -fsS "$MCP_ENDPOINT" \
  -H "x-canvas-flow-token: $CANVAS_FLOW_API_TOKEN"

curl -fsS "$MCP_ENDPOINT" \
  -H "content-type: application/json" \
  -H "x-canvas-flow-token: $CANVAS_FLOW_API_TOKEN" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"smoke-mcp-client","version":"1.0.0"}}}'

curl -fsS "$MCP_ENDPOINT" \
  -H "content-type: application/json" \
  -H "x-canvas-flow-token: $CANVAS_FLOW_API_TOKEN" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
```

Use one `result.tools[].name` from `tools/list` for a final `tools/call` smoke
test. Each saved flow with steps should appear as one MCP tool.

## Runbook

When a production incident happens, collect these identifiers first:

- `conversationId`
- LangGraph `runtime.threadId`
- `agentId`
- `flowId`
- `flowVersion`
- `agentRelease`
- channel/provider
- approximate timestamp

Immediate checks:

```bash
curl -fsS "$CANVAS_FLOW_PUBLIC_URL/health"
curl -fsS "$CANVAS_FLOW_PUBLIC_URL/api/canvas-flow/sqs/health" \
  -H "x-canvas-flow-token: $CANVAS_FLOW_API_TOKEN"
```

Recovery actions:

- If queue is accumulating, pause inbound webhooks if possible, inspect DLQ, then retry safe jobs.
- If a provider is failing, switch the affected flow to a known-good version or disable the provider node.
- If a release is bad, activate the previous flow version or previous agent release from the UI.
- If Mongo is unavailable, stop deploys and restore connectivity before retrying jobs. LangGraph retries transient checkpoint index failures and may continue the current execution with non-durable in-memory checkpoints after retries are exhausted.
- If secrets leaked, rotate provider secrets and `CANVAS_FLOW_API_TOKEN`.

Backup expectations:

- Mongo snapshots include flows, versions, agents, releases, memory, tags, API keys, provider config, document metadata, and LangGraph checkpoint collections.
- The private S3 documents bucket has versioning enabled and retains original uploads plus generated artifacts. Validate restore and signed-download access before rollout.
- Provider secrets must be recoverable from the external secret manager.
- Store package/deploy artifact identifiers for each release.

## Current known limits

- The first automated test suite covers the runner, version selection, and run controller contract. It does not yet replace full browser E2E or provider sandbox tests.
- `canvas-flow doctor` checks Mongo TCP reachability, not Mongo authentication.
- WhatsApp/Blip/Sinch behavior still needs provider sandbox validation before broad rollout.
