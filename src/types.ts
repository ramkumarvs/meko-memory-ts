export type MekoCall = (tool: string, args: Record<string, unknown>) => Promise<unknown>;

export type CaptureMode = "none" | "explicit" | "conversational";

export type DatapackRef = { id: string } | { name: string };

export interface MemoryScope {
  datapack: DatapackRef;
  agentId: string;
  entityId?: string;
  runId?: string;
  conversationId?: string;
}

export interface ResolvedMemoryScope extends MemoryScope {
  datapackId: string;
  conversationId: string;
  runId?: string;
}

export interface MemoryRecord {
  id: string;
  text: string;
  metadata: Record<string, unknown>;
  raw: unknown;
}

/** The first page returned by Meko's non-paginated memory listing tool. */
export interface MemoryPage {
  records: MemoryRecord[];
  total: number | null;
  truncated: boolean;
}

export interface AddFactOptions {
  metadata?: Record<string, unknown>;
}

export interface RecordOptions extends AddFactOptions {
  captureMode?: CaptureMode;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
}

export interface AddFactResult {
  memoryIds: string[];
}

export type UpdateOutcome = "updated" | "not-found" | "entity-mismatch";
export type DeleteOutcome = "deleted" | "not-found" | "entity-mismatch";

export interface FlushResult {
  directive: unknown | null;
}

export interface AwaitVisibleOptions {
  timeoutMs?: number;
  pollMs?: number;
}

export interface LongTermMemory {
  addFact(scope: MemoryScope, text: string, options?: AddFactOptions): Promise<AddFactResult>;
  record(
    scope: MemoryScope,
    messages: readonly ChatMessage[],
    options?: RecordOptions,
  ): Promise<AddFactResult>;
  search(scope: MemoryScope, query: string): Promise<MemoryRecord[]>;
  getById(scope: MemoryScope, memoryId: string): Promise<MemoryRecord | null>;
  /** Returns only Meko's first (currently 20-record) page. */
  list(scope: MemoryScope): Promise<MemoryRecord[]>;
  /** Returns Meko's first page and reports when the service truncated it. */
  listPage(scope: MemoryScope): Promise<MemoryPage>;
  update(scope: MemoryScope, memoryId: string, text: string): Promise<UpdateOutcome>;
  deleteById(scope: MemoryScope, memoryId: string): Promise<DeleteOutcome>;
  flush(scope?: MemoryScope): Promise<FlushResult>;
  awaitVisible(
    scope: MemoryScope,
    memoryId: string,
    options?: AwaitVisibleOptions,
  ): Promise<boolean>;
}

export interface MekoConnectionOptions {
  apiKey: string;
  endpoint?: string;
  clientName?: string;
  clientVersion?: string;
  userAgent?: string;
}

export interface SharedDatapackMode {
  mode: "shared-datapack";
}

export interface DatapackPerEntityMode {
  mode: "datapack-per-entity";
  /** Must be pseudonymous: it is shown in a bootstrap title in the default Datapack. */
  datapackName(entityId: string): string;
  /** Applied only when this entity's Datapack is first created. */
  datapackDescription?(entityId: string): string;
}

export type EntityScopeMode = SharedDatapackMode | DatapackPerEntityMode;

export interface CreateMemoryOptions {
  apiKey?: string;
  connection?: Omit<MekoConnectionOptions, "apiKey">;
  invoker?: MekoCall;
  captureMode?: CaptureMode;
  entityScope?: EntityScopeMode;
  bootstrapAgentId?: string;
  /** Names the bootstrap conversation used to find or create a Datapack. */
  bootstrapConversationTitle?(datapackName: string): string;
  conversationTitle?(scope: ResolvedMemoryScope): string;
}
