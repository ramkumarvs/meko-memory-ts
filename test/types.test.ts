import { describe, expect, it } from "vitest";

import { InvalidRunIdError } from "../src/errors.js";
import {
  entityIdFromMemory,
  makeEntityPrefix,
  normalizeRunId,
  stripEntityPrefix,
} from "../src/internal.js";

describe("scope primitives", () => {
  it("normalizes a hexadecimal run id", () => {
    expect(normalizeRunId("00Af")).toBe("af");
    expect(normalizeRunId("0000")).toBe("0");
  });

  it("rejects a non-hex run id", () => {
    expect(() => normalizeRunId("session-123")).toThrow(InvalidRunIdError);
  });

  it("reads metadata first and falls back to its own entity prefix", () => {
    const prefix = makeEntityPrefix("entity amber");
    expect(
      entityIdFromMemory({
        metadata: JSON.stringify({ meko_memory_entity_id: "metadata-entity" }),
        memory: `${prefix}remember this`,
      }),
    ).toBe("metadata-entity");
    expect(entityIdFromMemory({ text: `${prefix}remember this` })).toBe("entity amber");
  });

  it("strips only its own position-zero prefix", () => {
    const prefix = makeEntityPrefix("entity amber");
    expect(stripEntityPrefix(`${prefix}remember this`)).toBe("remember this");
    expect(stripEntityPrefix(`[cn:42] ${prefix}remember this`)).toBe(
      `[cn:42] ${prefix}remember this`,
    );
  });
});
