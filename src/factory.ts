import { DisabledMemory } from "./disabled.js";
import { MekoMemory } from "./memory.js";
import { connectMeko } from "./transport.js";
import type { CreateMemoryOptions, LongTermMemory, MekoCall } from "./types.js";

export async function createLongTermMemory(
  options: CreateMemoryOptions = {},
): Promise<LongTermMemory> {
  if (!options.apiKey?.trim()) return new DisabledMemory();
  return createMekoMemory(options as CreateMemoryOptions & { apiKey: string });
}

export async function createMekoMemory(
  options: CreateMemoryOptions & { apiKey: string },
): Promise<MekoMemory & { close(): Promise<void> }> {
  let call: MekoCall;
  let close: () => Promise<void> = async () => {};
  if (options.invoker) call = options.invoker;
  else {
    const connection = await connectMeko({ apiKey: options.apiKey, ...options.connection });
    call = connection.call;
    close = connection.close;
  }
  return Object.assign(new MekoMemory(call, options), { close });
}
