export function normalizeInputUpdateValue(columnKey: string, value: unknown) {
  if (typeof value !== "string") {
    return value;
  }
  return value;
}

export function normalizeOutputUpdateValue(columnKey: string, value: unknown) {
  if (typeof value !== "string") {
    return value;
  }
  return value;
}
