import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

import { MekoToolError } from "./errors.js";
import type { MekoCall, MekoConnectionOptions } from "./types.js";

export interface ToolResultLike {
  content?: Array<{ type: string; text?: string }>;
  structuredContent?: unknown;
  isError?: boolean;
}

const DEFAULT_ENDPOINT = "https://mcp.mekodata.ai/mcp";

function tryJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export function parseMekoResult(tool: string, result: ToolResultLike): unknown {
  const text = (result.content ?? [])
    .filter((content) => content.type === "text" && typeof content.text === "string")
    .map((content) => content.text)
    .join("");

  if (result.isError) throw new MekoToolError(tool, "tool_error", text || undefined);

  let value: unknown = result.structuredContent ?? tryJson(text);
  if (value && typeof value === "object" && !Array.isArray(value) && "result" in value) {
    const inner = (value as { result: unknown }).result;
    value = typeof inner === "string" ? tryJson(inner) : inner;
  }

  const payload = value as { error?: unknown; detail?: unknown } | null;
  if (typeof payload?.error === "string") {
    throw new MekoToolError(
      tool,
      payload.error,
      typeof payload.detail === "string" ? payload.detail : undefined,
    );
  }
  return value;
}

export async function connectMeko(options: MekoConnectionOptions): Promise<{
  call: MekoCall;
  close(): Promise<void>;
}> {
  if (!options.apiKey.startsWith("mko_tkn_")) {
    throw new Error("Meko: apiKey must be a Meko user API key (mko_tkn_...)");
  }
  const clientName = options.clientName ?? "meko-memory";
  const clientVersion = options.clientVersion ?? "0.1.0";
  const userAgent = options.userAgent ?? `${clientName}/${clientVersion}`;
  if (userAgent.trim().length === 0) throw new Error("Meko: User-Agent must not be empty");

  const transport = new StreamableHTTPClientTransport(
    new URL(options.endpoint ?? DEFAULT_ENDPOINT),
    {
      requestInit: {
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          "User-Agent": userAgent,
        },
      },
    },
  );
  const client = new Client({ name: clientName, version: clientVersion });
  await client.connect(transport);
  return {
    call: async (tool, args) =>
      parseMekoResult(
        tool,
        (await client.callTool({ name: tool, arguments: args })) as ToolResultLike,
      ),
    close: () => client.close(),
  };
}
