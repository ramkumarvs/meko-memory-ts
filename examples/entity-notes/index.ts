import { createLongTermMemory } from "meko-memory-ts";

const memory = await createLongTermMemory({
  apiKey: process.env.MEKO_API_KEY,
  entityScope: { mode: "shared-datapack" },
});
const scope = { datapack: { id: "invented-datapack" }, agentId: "notes", entityId: "entity-amber" };
await memory.addFact(scope, "Invented note: prefers shorter practice sessions.", {
  metadata: { sourceId: "note-001" },
});
