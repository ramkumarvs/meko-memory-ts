import { InvalidRunIdError } from "./errors.js";

const ENTITY_METADATA_KEY = "meko_memory_entity_id";
const ENTITY_PREFIX = "[meko-entity:";

export function normalizeRunId(value: string): string {
  const trimmed = value.trim();
  if (!/^[0-9a-f]+$/i.test(trimmed)) throw new InvalidRunIdError(value);
  return trimmed.toLowerCase().replace(/^0+(?=.)/, "");
}

export function makeEntityPrefix(entityId: string): string {
  return `${ENTITY_PREFIX}${Buffer.from(entityId, "utf8").toString("base64url")}] `;
}

export function entityIdFromPrefix(text: string): string | undefined {
  if (!text.startsWith(ENTITY_PREFIX)) return undefined;
  const end = text.indexOf("] ");
  if (end < ENTITY_PREFIX.length) return undefined;
  try {
    return Buffer.from(text.slice(ENTITY_PREFIX.length, end), "base64url").toString("utf8");
  } catch {
    return undefined;
  }
}

export function stripEntityPrefix(text: string): string {
  const entityId = entityIdFromPrefix(text);
  return entityId === undefined ? text : text.slice(makeEntityPrefix(entityId).length);
}

export function metadataFrom(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value))
    return value as Record<string, unknown>;
  if (typeof value !== "string") return {};
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export function textFromMemory(value: Record<string, unknown>): string {
  return typeof value.memory === "string"
    ? value.memory
    : typeof value.text === "string"
      ? value.text
      : "";
}

export function entityIdFromMemory(value: Record<string, unknown>): string | undefined {
  const metadata = metadataFrom(value.metadata);
  const fromMetadata = metadata[ENTITY_METADATA_KEY];
  return typeof fromMetadata === "string"
    ? fromMetadata
    : entityIdFromPrefix(textFromMemory(value));
}

export function tagMetadata(
  metadata: Record<string, unknown> | undefined,
  entityId?: string,
): Record<string, unknown> {
  if (!entityId) return metadata ?? {};
  if (metadata?.[ENTITY_METADATA_KEY] !== undefined) {
    throw new Error(`Meko: ${ENTITY_METADATA_KEY} is reserved`);
  }
  return { ...metadata, [ENTITY_METADATA_KEY]: entityId };
}
