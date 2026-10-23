# meko-memory-ts

An unofficial community TypeScript wrapper for Meko's MCP memory tools. It is not a Yugabyte product.

Meko extraction is asynchronous: `addFact()` can return zero or more IDs, and a subsequent search may not see a new fact immediately. Use `awaitVisible()` before a retrieval-dependent workflow.

## Install

```bash
npm install meko-memory-ts
```

## Durable facts

```ts
import { createLongTermMemory } from "meko-memory-ts";

const memory = await createLongTermMemory({
  apiKey: process.env.MEKO_API_KEY,
  connection: { userAgent: "my-app/1.0" },
  entityScope: { mode: "datapack-per-entity", datapackName: (id) => `app-${id}` },
});

const scope = {
  datapack: { name: "app-entity-amber" },
  agentId: "support",
  entityId: "entity-amber",
};
const { memoryIds } = await memory.addFact(scope, "Prefers email support");
if (memoryIds[0]) await memory.awaitVisible(scope, memoryIds[0]);
```

Datapack names appear in a bootstrap conversation title in the account default Datapack. `datapackName` must therefore be pseudonymous and must never contain names or other PII.

## Entity scope modes

`datapack-per-entity` uses an individual Datapack as the isolation boundary and is the recommended mode for sensitive per-entity data.

`shared-datapack` prefixes text and stores an entity id in JSON metadata, then filters reads in the client. This is an **experimental client-side convention**, not a Meko authorization boundary: a principal with Meko account/Datapack access can query outside this wrapper. The live smoke test verifies whether metadata survives the service's extraction round trip before this mode can be represented as reliable.

## Method mapping

| Method                  | Meko tool                               | Notes                                                      |
| ----------------------- | --------------------------------------- | ---------------------------------------------------------- |
| `addFact`               | `memory_add`                            | Returns 0..N ids.                                          |
| `record`                | `memory_add`                            | Opt-in via capture mode; default is no-op.                 |
| `search`                | `memory_search`                         | Search is eventually consistent.                           |
| `getById` / `list`      | `memory_get_by_id` / `memory_get_all`   | Conversation ids are required tokens, not assumed filters. |
| `update` / `deleteById` | `memory_update` / `memory_delete_by_id` | Return explicit mutation outcomes.                         |
| `flush`                 | `flush_pending_memory_candidates`       | Returns a directive; it never claims a write committed.    |

The client rejects empty User-Agent values and non-`mko_tkn_` keys. When no API key is configured, `createLongTermMemory()` returns disabled memory: writes no-op and reads are empty.

## Tests

`npm test` runs the offline fake-invoker suite. `MEKO_API_KEY=... npm run test:live` is an explicit, self-cleaning smoke path and only accepts Datapacks named `meko-memory-ts-smoke-*`.
