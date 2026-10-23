import { describe, expect, it } from "vitest";

import { createMekoMemory } from "../../src/index.js";

const apiKey = process.env.MEKO_API_KEY;
const smokeName = `meko-memory-ts-smoke-${Math.random().toString(16).slice(2)}`;

describe.skipIf(!apiKey)("Meko live smoke", () => {
  it("adds, becomes visible, reads, searches, and deletes only smoke data", async () => {
    expect(smokeName).toMatch(/^meko-memory-ts-smoke-/);
    const memory = await createMekoMemory({
      apiKey: apiKey!,
      entityScope: { mode: "datapack-per-entity", datapackName: () => smokeName },
    });
    const scope = {
      datapack: { name: smokeName },
      agentId: "meko_memory_smoke",
      entityId: "smoke",
    };
    const marker = `invented-smoke-${Date.now()}`;
    const added = await memory.addFact(scope, marker);
    expect(added.memoryIds.length).toBeGreaterThan(0);
    const id = added.memoryIds[0]!;
    expect(await memory.awaitVisible(scope, id, { timeoutMs: 30_000, pollMs: 500 })).toBe(true);
    expect((await memory.getById(scope, id))?.id).toBe(id);
    await memory.deleteById(scope, id);
    expect((await memory.list(scope)).some((item) => item.id === id)).toBe(false);
    await memory.close();
  });
});
