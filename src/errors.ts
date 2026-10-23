export class InvalidRunIdError extends Error {
  constructor(value: string) {
    super(`Meko: runId must be a non-empty hexadecimal string, received ${JSON.stringify(value)}`);
    this.name = "InvalidRunIdError";
  }
}
