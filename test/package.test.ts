import { describe, expect, it } from "vitest";

import { createLongTermMemory } from "../src/index.js";

describe("package entry point", () => {
  it("exports createLongTermMemory", () => {
    expect(createLongTermMemory).toBeTypeOf("function");
  });
});
