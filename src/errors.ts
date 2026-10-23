export class InvalidRunIdError extends Error {
  constructor(value: string) {
    super(`Meko: runId must be a non-empty hexadecimal string, received ${JSON.stringify(value)}`);
    this.name = "InvalidRunIdError";
  }
}

export class MekoToolError extends Error {
  constructor(
    readonly tool: string,
    readonly code: string,
    readonly detail?: string,
  ) {
    super(`Meko ${tool}: ${code}`);
    this.name = "MekoToolError";
  }
}
