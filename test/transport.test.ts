import { describe, expect, it } from "vitest";

import { connectMeko, parseMekoResult } from "../src/transport.js";

const text = (value: string) => ({ content: [{ type: "text", text: value }] });

describe("parseMekoResult", () => {
  it("parses text JSON and unwraps a string result", () => {
    expect(parseMekoResult("memory_add", text('{"id":"mem_1"}'))).toEqual({ id: "mem_1" });
    expect(
      parseMekoResult("datapack_list", text('{"result":"[{\\"datapack_id\\":\\"dp_1\\"}]"}')),
    ).toEqual([{ datapack_id: "dp_1" }]);
  });

  it("prefers structured content", () => {
    expect(
      parseMekoResult("datapack_create", {
        ...text("ignored"),
        structuredContent: { result: '{"datapack_id":"dp_1"}' },
      }),
    ).toEqual({ datapack_id: "dp_1" });
  });

  it("throws for MCP and payload errors", () => {
    expect(() => parseMekoResult("memory_add", { ...text("quota"), isError: true })).toThrow(
      "Meko memory_add: quota",
    );
    expect(() =>
      parseMekoResult("datapack_list", text('{"error":"conversation_required"}')),
    ).toThrow("Meko datapack_list: conversation_required");
  });
});

describe("connectMeko validation", () => {
  it("rejects invalid credentials before connecting", async () => {
    await expect(connectMeko({ apiKey: "not-meko" })).rejects.toThrow("mko_tkn_");
  });

  it("rejects an empty user agent before connecting", async () => {
    await expect(connectMeko({ apiKey: "mko_tkn_test", userAgent: " " })).rejects.toThrow(
      "User-Agent",
    );
  });
});
