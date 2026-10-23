import { describe, expect, it } from "vitest";

import { MekoToolError } from "../src/errors.js";
import { connectMeko, parseMekoResult } from "../src/transport.js";

const text = (value: string) => ({ content: [{ type: "text", text: value }] });

describe("parseMekoResult", () => {
  it("parses text JSON and unwraps a string result", () => {
    expect(parseMekoResult("memory_add", text('{"id":"mem_1"}'))).toEqual({ id: "mem_1" });
    expect(
      parseMekoResult("datapack_list", text('{"result":"[{\\"datapack_id\\":\\"dp_1\\"}]"}')),
    ).toEqual([{ datapack_id: "dp_1" }]);
    expect(
      parseMekoResult(
        "memory_get_all",
        text(
          '{"result":"{\\"memories\\":[{\\"id\\":\\"mem_1\\",\\"data\\":\\"find the fork\\"}],\\"total\\":1,\\"page\\":1,\\"page_size\\":20}"}',
        ),
      ),
    ).toEqual({
      memories: [{ id: "mem_1", data: "find the fork" }],
      total: 1,
      page: 1,
      page_size: 20,
    });
  });

  it("prefers structured content", () => {
    expect(
      parseMekoResult("datapack_create", {
        ...text("ignored"),
        structuredContent: { result: '{"datapack_id":"dp_1"}' },
      }),
    ).toEqual({ datapack_id: "dp_1" });
  });

  it("preserves Meko payload error codes and details", () => {
    expect(() =>
      parseMekoResult(
        "memory_get_by_id",
        text('{"result":"{\\"error\\":\\"not_found\\",\\"detail\\":\\"No memory found.\\"}"}'),
      ),
    ).toThrow(MekoToolError);
    try {
      parseMekoResult(
        "memory_get_by_id",
        text('{"result":"{\\"error\\":\\"not_found\\",\\"detail\\":\\"No memory found.\\"}"}'),
      );
    } catch (error) {
      expect(error).toMatchObject({
        tool: "memory_get_by_id",
        code: "not_found",
        detail: "No memory found.",
        message: "Meko memory_get_by_id: not_found",
      });
    }
  });

  it("uses tool_error for MCP errors while retaining the result text as detail", () => {
    try {
      parseMekoResult("memory_add", { ...text("quota"), isError: true });
    } catch (error) {
      expect(error).toMatchObject({
        tool: "memory_add",
        code: "tool_error",
        detail: "quota",
        message: "Meko memory_add: tool_error",
      });
    }
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
