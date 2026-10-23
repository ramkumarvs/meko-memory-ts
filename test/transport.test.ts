import { describe, expect, it } from "vitest";

import { MekoToolError } from "../src/errors.js";
import { connectMeko, parseMekoResult } from "../src/transport.js";

const text = (value: string) => ({ content: [{ type: "text", text: value }] });

const captureToolError = (run: () => unknown): MekoToolError => {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(MekoToolError);
    return error as MekoToolError;
  }

  throw new Error("Expected MekoToolError");
};

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
    const error = captureToolError(() =>
      parseMekoResult("memory_get_by_id", {
        structuredContent: { error: "not_found", detail: "No memory found with id X." },
      }),
    );

    expect(error).toMatchObject({
      tool: "memory_get_by_id",
      code: "not_found",
      detail: "No memory found with id X.",
      message: "Meko memory_get_by_id: not_found",
    });
  });

  it("uses the MCP error text in the message while retaining tool_error as the code", () => {
    const error = captureToolError(() =>
      parseMekoResult("memory_add", { ...text("quota exceeded"), isError: true }),
    );

    expect(error).toMatchObject({
      tool: "memory_add",
      code: "tool_error",
      detail: "quota exceeded",
      message: "Meko memory_add: quota exceeded",
    });
  });

  it("uses a fallback message for MCP errors without text", () => {
    const error = captureToolError(() => parseMekoResult("memory_add", { isError: true }));

    expect(error).toMatchObject({
      tool: "memory_add",
      code: "tool_error",
      detail: undefined,
      message: "Meko memory_add: tool error",
    });
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
