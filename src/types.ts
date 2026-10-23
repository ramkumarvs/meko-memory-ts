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
  list(scope: MemoryScope): Promise<MemoryRecord[]>;
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
}

export type EntityScopeMode = SharedDatapackMode | DatapackPerEntityMode;

export interface CreateMemoryOptions {
  apiKey?: string;
  connection?: Omit<MekoConnectionOptions, "apiKey">;
  invoker?: MekoCall;
  captureMode?: CaptureMode;
  entityScope?: EntityScopeMode;
  bootstrapAgentId?: string;
  conversationTitle?(scope: ResolvedMemoryScope): string;
}
