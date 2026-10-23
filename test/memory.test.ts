import { describe, expect, it } from "vitest";

import { MekoToolError } from "../src/errors.js";
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

  it("reads real list responses from memories.data and reports truncation", async () => {
    const call: MekoCall = async (tool) => {
      if (tool === "conversation_create") return { id: "conv_1" };
      if (tool === "memory_get_all") {
        return {
          memories: [{ id: "mem_1", data: "find the fork" }],
          total: 21,
          page: 1,
          page_size: 20,
        };
      }
      throw new Error(`unexpected ${tool}`);
    };
    const memory = new MekoMemory(call);

    await expect(memory.list(scope)).resolves.toMatchObject([
      { id: "mem_1", text: "find the fork", metadata: {} },
    ]);
    await expect(memory.listPage(scope)).resolves.toMatchObject({
      records: [{ id: "mem_1", text: "find the fork", metadata: {} }],
      total: 21,
      truncated: true,
    });
  });

  it("maps a real not_found read to null and mutation outcomes", async () => {
    const call: MekoCall = async (tool) => {
      if (tool === "conversation_create") return { id: "conv_1" };
      if (tool === "memory_get_by_id") {
        throw new MekoToolError("memory_get_by_id", "not_found", "No memory found.");
      }
      throw new Error(`unexpected ${tool}`);
    };
    const memory = new MekoMemory(call);

    await expect(memory.getById(scope, "missing")).resolves.toBeNull();
    await expect(memory.deleteById(scope, "missing")).resolves.toBe("not-found");
    await expect(memory.update(scope, "missing", "new text")).resolves.toBe("not-found");
  });

  it("maps a not_found delete race to not-found", async () => {
    const call: MekoCall = async (tool) => {
      if (tool === "conversation_create") return { id: "conv_1" };
      if (tool === "memory_get_by_id") return { id: "mem_1", memory: "soon removed" };
      if (tool === "memory_delete_by_id") {
        throw new MekoToolError("memory_delete_by_id", "not_found", "Already deleted.");
      }
      throw new Error(`unexpected ${tool}`);
    };
    await expect(new MekoMemory(call).deleteById(scope, "mem_1")).resolves.toBe("not-found");
  });

  it("keeps polling after not_found but propagates other Meko errors", async () => {
    let reads = 0;
    const call: MekoCall = async (tool) => {
      if (tool === "conversation_create") return { id: "conv_1" };
      if (tool === "memory_get_by_id") {
        reads++;
        if (reads === 1) throw new MekoToolError("memory_get_by_id", "not_found");
        return { id: "mem_1", memory: "visible" };
      }
      throw new Error(`unexpected ${tool}`);
    };
    const memory = new MekoMemory(call);
    await expect(memory.awaitVisible(scope, "mem_1", { timeoutMs: 100, pollMs: 0 })).resolves.toBe(
      true,
    );

    const failing = new MekoMemory(async () => {
      throw new MekoToolError("memory_get_by_id", "quota_exceeded");
    });
    await expect(
      failing.awaitVisible(scope, "mem_1", { timeoutMs: 100, pollMs: 0 }),
    ).rejects.toMatchObject({
      code: "quota_exceeded",
    });
  });

  it("shares resolved ids with later memory calls and preserves caller metadata", async () => {
    const calls: Array<{ tool: string; args: Record<string, unknown> }> = [];
    const call: MekoCall = async (tool, args) => {
      calls.push({ tool, args });
      if (tool === "conversation_create")
        return { id: calls.length === 1 ? "bootstrap_1" : "conv_1" };
      if (tool === "datapack_list") return [];
      if (tool === "datapack_create") return { datapack_id: "dp_1" };
      if (tool === "datapack_update") return { ok: true };
      if (tool === "memory_add") return { results: [{ id: "mem_1" }] };
      throw new Error(`unexpected ${tool}`);
    };
    const memory = new MekoMemory(call, {
      entityScope: {
        mode: "datapack-per-entity",
        datapackName: (entityId) => `entity-${entityId}`,
        datapackDescription: (entityId) => `Facts for ${entityId}`,
      },
      bootstrapConversationTitle: (name) => `lookup ${name}`,
    });
    const namedScope: MemoryScope = {
      datapack: { name: "entity-amber" },
      entityId: "amber",
      agentId: "agent",
    };

    await expect(memory.resolve(namedScope)).resolves.toMatchObject({
      datapackId: "dp_1",
      conversationId: "conv_1",
    });
    await expect(
      memory.addFact(namedScope, "prefers forks", { metadata: { coach_note_id: "n1" } }),
    ).resolves.toEqual({ memoryIds: ["mem_1"] });
    expect(calls.filter((call) => call.tool === "conversation_create")).toHaveLength(2);
    expect(calls.find((call) => call.tool === "datapack_update")?.args).toMatchObject({
      datapack_id: "dp_1",
      description: "Facts for amber",
      conversation_id: "bootstrap_1",
    });
    expect(calls.find((call) => call.tool === "conversation_create")?.args).toMatchObject({
      title: "lookup entity-amber",
    });
    expect(calls.find((call) => call.tool === "memory_add")?.args.metadata).toBe(
      JSON.stringify({ coach_note_id: "n1" }),
    );
  });
});
