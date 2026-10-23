import { createLongTermMemory } from "meko-memory-ts";

const memory = await createLongTermMemory({ apiKey: process.env.MEKO_API_KEY });
await memory.addFact(
  { datapack: { id: "invented-datapack" }, agentId: "invented-agent" },
  "This is invented example data.",
);
