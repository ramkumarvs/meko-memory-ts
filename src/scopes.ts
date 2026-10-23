import { normalizeRunId } from "./internal.js";
import type { CreateMemoryOptions, MekoCall, MemoryScope, ResolvedMemoryScope } from "./types.js";

function requiredString(value: unknown, field: string, tool: string): string {
  const found = (value as Record<string, unknown> | null)?.[field];
  if (typeof found !== "string" || found.length === 0)
    throw new Error(`Meko ${tool}: response has no ${field}`);
  return found;
}

export class ScopeManager {
  private readonly datapacks = new Map<string, Promise<string>>();
  private readonly conversations = new Map<string, Promise<string>>();

  constructor(
    private readonly call: MekoCall,
    private readonly options: Pick<
      CreateMemoryOptions,
      "entityScope" | "bootstrapAgentId" | "conversationTitle"
    >,
  ) {}

  async resolve(scope: MemoryScope): Promise<ResolvedMemoryScope> {
    const runId = scope.runId === undefined ? undefined : normalizeRunId(scope.runId);
    const datapackId =
      "id" in scope.datapack
        ? scope.datapack.id
        : await this.resolveNamedDatapack(scope, scope.datapack.name);
    const conversationId =
      scope.conversationId ?? (await this.conversation(scope.agentId, datapackId, runId));
    return { ...scope, datapackId, conversationId, runId };
  }

  args(scope: ResolvedMemoryScope): Record<string, string> {
    return {
      agent_id: scope.agentId,
      datapack_id: scope.datapackId,
      conversation_id: scope.conversationId,
      ...(scope.runId === undefined ? {} : { run_id: scope.runId }),
    };
  }

  async ensureDatapack(name: string, agentId: string, description?: string): Promise<string> {
    return this.memoize(this.datapacks, name, async () => {
      const bootstrap = requiredString(
        await this.call("conversation_create", {
          agent_id: agentId,
          title: `meko-memory: datapack lookup ${name}`,
        }),
        "id",
        "conversation_create",
      );
      const listed = await this.call("datapack_list", { conversation_id: bootstrap });
      if (!Array.isArray(listed)) throw new Error("Meko datapack_list: expected a list");
      const existing = listed.find(
        (item) => (item as Record<string, unknown>).datapack_name === name,
      );
      if (existing) return requiredString(existing, "datapack_id", "datapack_list");
      const datapackId = requiredString(
        await this.call("datapack_create", { name, conversation_id: bootstrap }),
        "datapack_id",
        "datapack_create",
      );
      if (description !== undefined) {
        await this.call("datapack_update", {
          datapack_id: datapackId,
          description,
          conversation_id: bootstrap,
        });
      }
      return datapackId;
    });
  }

  private async resolveNamedDatapack(scope: MemoryScope, name: string): Promise<string> {
    const mode = this.options.entityScope;
    if (mode?.mode === "datapack-per-entity") {
      if (!scope.entityId)
        throw new Error("Meko: datapack-per-entity requires entityId for named datapacks");
      if (mode.datapackName(scope.entityId) !== name)
        throw new Error("Meko: named datapack does not match entityId");
    }
    return this.ensureDatapack(name, scope.agentId);
  }

  private async conversation(agentId: string, datapackId: string, runId?: string): Promise<string> {
    const key = `${datapackId}\u0000${agentId}\u0000${runId ?? ""}`;
    return this.memoize(this.conversations, key, async () => {
      const scope = {
        agentId,
        datapack: { id: datapackId },
        datapackId,
        conversationId: "",
        runId,
      } as ResolvedMemoryScope;
      const title =
        this.options.conversationTitle?.(scope) ??
        `meko-memory: ${agentId} ${datapackId} ${runId ?? "durable"}`;
      return requiredString(
        await this.call("conversation_create", {
          agent_id: agentId,
          datapack_id: datapackId,
          title,
        }),
        "id",
        "conversation_create",
      );
    });
  }

  private memoize(
    cache: Map<string, Promise<string>>,
    key: string,
    create: () => Promise<string>,
  ): Promise<string> {
    const existing = cache.get(key);
    if (existing) return existing;
    const pending = create().catch((error: unknown) => {
      cache.delete(key);
      throw error;
    });
    cache.set(key, pending);
    return pending;
  }
}
