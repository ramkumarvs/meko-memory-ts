import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { createLongTermMemory } from "../src/index.js";

describe("package entry point", () => {
  it("exports createLongTermMemory", () => {
    expect(createLongTermMemory).toBeTypeOf("function");
  });

  it("declares an ESM fallback after import for CommonJS loaders", async () => {
    const packageJson = JSON.parse(
      await readFile(new URL("../package.json", import.meta.url), "utf8"),
    ) as { exports: { ".": Record<string, string> } };
    const entry = packageJson.exports["."];

    expect(entry.default).toBe("./dist/index.js");
    expect(Object.keys(entry).indexOf("default")).toBeGreaterThan(
      Object.keys(entry).indexOf("import"),
    );
  });
});
