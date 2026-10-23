import type {
  AddFactOptions,
  AddFactResult,
  AwaitVisibleOptions,
  DeleteOutcome,
  FlushResult,
  LongTermMemory,
  MemoryRecord,
  MemoryScope,
  RecordOptions,
  UpdateOutcome,
} from "./types.js";

export class DisabledMemory implements LongTermMemory {
  readonly disabled = true;
  async addFact(
    _scope: MemoryScope,
    _text: string,
    _options?: AddFactOptions,
  ): Promise<AddFactResult> {
    return { memoryIds: [] };
  }
  async record(
    _scope: MemoryScope,
    _messages: Parameters<LongTermMemory["record"]>[1],
    _options?: RecordOptions,
  ): Promise<AddFactResult> {
    return { memoryIds: [] };
  }
  async search(_scope: MemoryScope, _query: string): Promise<MemoryRecord[]> {
    return [];
  }
  async getById(_scope: MemoryScope, _memoryId: string): Promise<MemoryRecord | null> {
    return null;
  }
  async list(_scope: MemoryScope): Promise<MemoryRecord[]> {
    return [];
  }
  async update(_scope: MemoryScope, _memoryId: string, _text: string): Promise<UpdateOutcome> {
    return "not-found";
  }
  async deleteById(_scope: MemoryScope, _memoryId: string): Promise<DeleteOutcome> {
    return "not-found";
  }
  async flush(_scope?: MemoryScope): Promise<FlushResult> {
    return { directive: null };
  }
  async awaitVisible(
    _scope: MemoryScope,
    _memoryId: string,
    _options?: AwaitVisibleOptions,
  ): Promise<boolean> {
    return false;
  }
}
