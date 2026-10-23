import { describe, expect, it } from "vitest";

import { ScopeManager } from "../src/scopes.js";
import type { MekoCall, MemoryScope } from "../src/types.js";

describe("ScopeManager", () => {
  it("uses one bootstrap and one conversation for parallel first use", async () => {
    const calls: Array<{ tool: string; args: Record<string, unknown> }> = [];
    let conversation = 0;
    const call: MekoCall = async (tool, args) => {
      calls.push({ tool, args });
      if (tool === "conversation_create") return { id: `conv_${++conversation}` };
      if (tool === "datapack_list") return [];
      if (tool === "datapack_create") return { datapack_id: "dp_1" };
      if (tool === "datapack_update") return { ok: true };
      throw new Error(`unexpected ${tool}`);
    };
    const manager = new ScopeManager(call, {
      entityScope: { mode: "datapack-per-entity", datapackName: (id) => `app-${id}` },
    });
    const scope: MemoryScope = {
      datapack: { name: "app-amber" },
      agentId: "agent",
      entityId: "amber",
      runId: "00Af",
    };

    const resolved = await Promise.all([
      manager.resolve(scope),
      manager.resolve(scope),
      manager.resolve(scope),
    ]);

    expect(resolved.map((item) => item.datapackId)).toEqual(["dp_1", "dp_1", "dp_1"]);
    expect(calls.filter((call) => call.tool === "datapack_create")).toHaveLength(1);
    expect(calls.filter((call) => call.tool === "conversation_create")).toHaveLength(2);
    expect(calls.find((call) => call.tool === "datapack_list")?.args).toEqual({
      conversation_id: "conv_1",
    });
    expect(calls.at(-1)?.args).toEqual({
      agent_id: "agent",
      datapack_id: "dp_1",
      title: "meko-memory: agent dp_1 af",
    });
  });
});
