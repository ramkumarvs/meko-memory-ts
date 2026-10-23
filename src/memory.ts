import {
  entityIdFromMemory,
  metadataFrom,
  stripEntityPrefix,
  tagMetadata,
  textFromMemory,
} from "./internal.js";
import { ScopeManager } from "./scopes.js";
import type {
  AddFactOptions,
  AddFactResult,
  AwaitVisibleOptions,
  CreateMemoryOptions,
  DeleteOutcome,
  FlushResult,
  LongTermMemory,
  MemoryRecord,
  MemoryScope,
  MekoCall,
  RecordOptions,
  UpdateOutcome,
} from "./types.js";

function ids(value: unknown): string[] {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof (value as { id?: unknown }).id === "string"
  ) {
    return [(value as { id: string }).id];
  }
  const items = Array.isArray(value) ? value : (value as { results?: unknown } | null)?.results;
  return Array.isArray(items)
    ? items
        .map((item) => (item as { id?: unknown }).id)
        .filter((id): id is string => typeof id === "string")
    : [];
}

function records(value: unknown): Record<string, unknown>[] {
  const items = Array.isArray(value) ? value : (value as { results?: unknown } | null)?.results;
  return Array.isArray(items)
    ? items.filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    : [];
}

export class MekoMemory implements LongTermMemory {
  private readonly scopes: ScopeManager;

  constructor(
    private readonly call: MekoCall,
    private readonly options: CreateMemoryOptions = {},
  ) {
    this.scopes = new ScopeManager(call, options);
  }

  async addFact(
    scope: MemoryScope,
    text: string,
    options?: AddFactOptions,
  ): Promise<AddFactResult> {
    const resolved = await this.scopes.resolve(scope);
    const tagged = this.tag(scope, text, options?.metadata);
    return {
      memoryIds: ids(
        await this.call("memory_add", {
          ...this.scopes.args(resolved),
          text: tagged.text,
          metadata: JSON.stringify(tagged.metadata),
        }),
      ),
    };
  }

  async record(
    scope: MemoryScope,
    messages: Parameters<LongTermMemory["record"]>[1],
    options?: RecordOptions,
  ): Promise<AddFactResult> {
    if ((options?.captureMode ?? this.options.captureMode ?? "none") === "none")
      return { memoryIds: [] };
    const resolved = await this.scopes.resolve(scope);
    const metadata = tagMetadata(
      options?.metadata,
      this.shared(scope) ? scope.entityId : undefined,
    );
    return {
      memoryIds: ids(
        await this.call("memory_add", {
          ...this.scopes.args(resolved),
          messages,
          metadata: JSON.stringify(metadata),
        }),
      ),
    };
  }

  async search(scope: MemoryScope, query: string): Promise<MemoryRecord[]> {
    const resolved = await this.scopes.resolve(scope);
    return this.filter(
      scope,
      records(await this.call("memory_search", { ...this.scopes.args(resolved), query })),
    );
  }

  async getById(scope: MemoryScope, memoryId: string): Promise<MemoryRecord | null> {
    const raw = await this.raw(scope, memoryId);
    return raw && this.owns(scope, raw) ? this.toRecord(raw) : null;
  }

  async list(scope: MemoryScope): Promise<MemoryRecord[]> {
    const resolved = await this.scopes.resolve(scope);
    return this.filter(
      scope,
      records(await this.call("memory_get_all", this.scopes.args(resolved))),
    );
  }

  async update(scope: MemoryScope, memoryId: string, text: string): Promise<UpdateOutcome> {
    const raw = await this.raw(scope, memoryId);
    if (!raw) return "not-found";
    if (!this.owns(scope, raw)) return "entity-mismatch";
    const resolved = await this.scopes.resolve(scope);
    await this.call("memory_update", {
      ...this.scopes.args(resolved),
      memory_id: memoryId,
      text: this.tag(scope, text).text,
    });
    return "updated";
  }

  async deleteById(scope: MemoryScope, memoryId: string): Promise<DeleteOutcome> {
    const raw = await this.raw(scope, memoryId);
    if (!raw) return "not-found";
    if (!this.owns(scope, raw)) return "entity-mismatch";
    const resolved = await this.scopes.resolve(scope);
    await this.call("memory_delete_by_id", { ...this.scopes.args(resolved), memory_id: memoryId });
    return "deleted";
  }

  async flush(scope?: MemoryScope): Promise<FlushResult> {
    if (!scope) return { directive: null };
    const resolved = await this.scopes.resolve(scope);
    return {
      directive: await this.call("flush_pending_memory_candidates", this.scopes.args(resolved)),
    };
  }

  async awaitVisible(
    scope: MemoryScope,
    memoryId: string,
    options?: AwaitVisibleOptions,
  ): Promise<boolean> {
    const timeoutMs = options?.timeoutMs ?? 30_000;
    const pollMs = options?.pollMs ?? 500;
    const deadline = Date.now() + timeoutMs;
    do {
      if (await this.getById(scope, memoryId)) return true;
      if (Date.now() >= deadline) return false;
      await new Promise((resolve) => setTimeout(resolve, pollMs));
    } while (true);
  }

  private async raw(scope: MemoryScope, memoryId: string): Promise<Record<string, unknown> | null> {
    const resolved = await this.scopes.resolve(scope);
    const value = await this.call("memory_get_by_id", {
      ...this.scopes.args(resolved),
      memory_id: memoryId,
    });
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }

  private shared(scope: MemoryScope): boolean {
    if (this.options.entityScope?.mode !== "shared-datapack") return false;
    if (!scope.entityId) throw new Error("Meko: shared-datapack requires entityId");
    return true;
  }

  private tag(scope: MemoryScope, text: string, metadata?: Record<string, unknown>) {
    const entityId = this.shared(scope) ? scope.entityId : undefined;
    const taggedMetadata = tagMetadata(metadata, entityId);
    return {
      metadata: taggedMetadata,
      text: entityId
        ? `${Buffer.from(entityId, "utf8").toString("base64url") ? `[meko-entity:${Buffer.from(entityId, "utf8").toString("base64url")}] ` : ""}${text}`
        : text,
    };
  }

  private owns(scope: MemoryScope, raw: Record<string, unknown>): boolean {
    const entityId = entityIdFromMemory(raw);
    if (this.shared(scope)) return entityId === scope.entityId;
    return !entityId || entityId === scope.entityId;
  }

  private filter(scope: MemoryScope, source: Record<string, unknown>[]): MemoryRecord[] {
    return source.filter((raw) => this.owns(scope, raw)).map((raw) => this.toRecord(raw));
  }

  private toRecord(raw: Record<string, unknown>): MemoryRecord {
    const id = raw.id;
    if (typeof id !== "string") throw new Error("Meko memory response has no id");
    return {
      id,
      text: stripEntityPrefix(textFromMemory(raw)),
      metadata: metadataFrom(raw.metadata),
      raw,
    };
  }
}
