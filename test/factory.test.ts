import { describe, expect, it } from "vitest";

import { createLongTermMemory } from "../src/index.js";

describe("createLongTermMemory", () => {
  it("returns disabled memory without using an invoker when no key is configured", async () => {
    const memory = await createLongTermMemory({
      invoker: async () => {
        throw new Error("must not construct transport");
      },
    });
    const scope = { datapack: { id: "dp_1" }, agentId: "agent" } as const;
    await expect(memory.search(scope, "anything")).resolves.toEqual([]);
    await expect(memory.deleteById(scope, "missing")).resolves.toBe("not-found");
  });
});
