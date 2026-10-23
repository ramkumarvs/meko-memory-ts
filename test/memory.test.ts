import { describe, expect, it } from "vitest";

import { MekoMemory } from "../src/memory.js";
import type { MekoCall, MemoryScope } from "../src/types.js";

const scope: MemoryScope = { datapack: { id: "dp_1" }, agentId: "agent", entityId: "amber" };

describe("MekoMemory", () => {
  it("tags a shared-datapack fact in metadata and text", async () => {
    const calls: Array<{ tool: string; args: Record<string, unknown> }> = [];
    const call: MekoCall = async (tool, args) => {
      calls.push({ tool, args });
      return tool === "conversation_create" ? { id: "conv_1" } : { results: [{ id: "mem_1" }] };
    };
    const memory = new MekoMemory(call, { entityScope: { mode: "shared-datapack" } });

    await expect(
      memory.addFact(scope, "plays the Sicilian", { metadata: { kind: "note" } }),
    ).resolves.toEqual({
      memoryIds: ["mem_1"],
    });
    const add = calls.find((item) => item.tool === "memory_add")!;
    expect(add.args).toMatchObject({
      agent_id: "agent",
      datapack_id: "dp_1",
      conversation_id: "conv_1",
    });
    expect(add.args.metadata).toBe(
      JSON.stringify({ kind: "note", meko_memory_entity_id: "amber" }),
    );
    expect(add.args.text).toMatch(/^\[meko-entity:YW1iZXI\] /);
  });

  it("filters another entity from a shared list", async () => {
    const call: MekoCall = async (tool) => {
      if (tool === "conversation_create") return { id: "conv_1" };
      return [
        { id: "a", memory: "mine", metadata: JSON.stringify({ meko_memory_entity_id: "amber" }) },
        { id: "b", memory: "theirs", metadata: JSON.stringify({ meko_memory_entity_id: "blue" }) },
      ];
    };
    const memory = new MekoMemory(call, { entityScope: { mode: "shared-datapack" } });
    await expect(memory.list(scope)).resolves.toMatchObject([{ id: "a", text: "mine" }]);
  });

  it("reports an entity mismatch without deleting", async () => {
    const calls: string[] = [];
    const call: MekoCall = async (tool) => {
      calls.push(tool);
      if (tool === "conversation_create") return { id: "conv_1" };
      return {
        id: "b",
        memory: "theirs",
        metadata: JSON.stringify({ meko_memory_entity_id: "blue" }),
      };
    };
    const memory = new MekoMemory(call, { entityScope: { mode: "shared-datapack" } });
    await expect(memory.deleteById(scope, "b")).resolves.toBe("entity-mismatch");
    expect(calls).not.toContain("memory_delete_by_id");
  });

  it("does not capture messages when capture is none", async () => {
    const call: MekoCall = async () => {
      throw new Error("must not call");
    };
    const memory = new MekoMemory(call, { captureMode: "none" });
    await expect(memory.record(scope, [{ role: "user", content: "hello" }])).resolves.toEqual({
      memoryIds: [],
    });
  });

  it("rejects an unscoped write in shared-datapack mode", async () => {
    const memory = new MekoMemory(async () => ({ id: "ignored" }), {
      entityScope: { mode: "shared-datapack" },
    });
    await expect(
      memory.addFact({ datapack: { id: "dp_1" }, agentId: "agent" }, "untagged"),
    ).rejects.toThrow("requires entityId");
  });
});
