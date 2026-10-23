import { describe, expect, it } from "vitest";

import { connectMeko, createMekoMemory } from "../../src/index.js";

const apiKey = process.env.MEKO_API_KEY;
const smokeName = "meko-memory-ts-smoke";

describe.skipIf(!apiKey)("Meko live smoke", () => {
  it("proves the real add, read, list, and delete contract using only smoke data", async () => {
    expect(smokeName).toMatch(/^meko-memory-ts-smoke(?:-|$)/);
    const { call, close } = await connectMeko({ apiKey: apiKey! });
    const memory = await createMekoMemory({
      apiKey: apiKey!,
      invoker: call,
      entityScope: { mode: "datapack-per-entity", datapackName: () => smokeName },
    });
    const scope = {
      datapack: { name: smokeName },
      agentId: "meko_memory_smoke",
      entityId: "smoke",
    };
    const marker = `invented-smoke-${Date.now()}`;
    const createdIds: string[] = [];
    try {
      const added = await memory.addFact(scope, marker, { metadata: { smoke_key: marker } });
      createdIds.push(...added.memoryIds);
      expect(added.memoryIds.length).toBeGreaterThan(0);
      const id = added.memoryIds[0]!;

      expect(await memory.awaitVisible(scope, id, { timeoutMs: 30_000, pollMs: 500 })).toBe(true);
      const found = await memory.getById(scope, id);
      console.info("[smoke] memory_get_by_id", found?.raw);
      expect(found?.id).toBe(id);
      expect(found?.metadata.smoke_key).toBe(marker);

      const page = await memory.listPage(scope);
      if (page.truncated) {
        console.info("[smoke] memory_get_all truncated", {
          total: page.total,
          records: page.records.length,
        });
      } else {
        expect(page.records.some((record) => record.id === id)).toBe(true);
      }

      expect(await memory.deleteById(scope, id)).toBe("deleted");
      expect(await memory.getById(scope, id)).toBeNull();
      expect(await memory.deleteById(scope, id)).toBe("not-found");

      const resolved = await memory.resolve(scope);
      const args = {
        agent_id: resolved.agentId,
        datapack_id: resolved.datapackId,
        conversation_id: resolved.conversationId,
      };
      await call("memory_delete_by_id", { ...args, memory_id: id }).then(
        (response) => console.info("[smoke] memory_delete_by_id miss", response),
        (error: unknown) => console.info("[smoke] memory_delete_by_id miss", error),
      );
      await call("memory_search", { ...args, query: marker }).then(
        (response) => console.info("[smoke] memory_search", response),
        (error: unknown) => console.info("[smoke] memory_search", error),
      );
    } finally {
      await Promise.all(
        createdIds.map((id) => memory.deleteById(scope, id).catch(() => "not-found")),
      );
      await close();
    }
  });
});
