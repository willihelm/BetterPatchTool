type DiffStatus = "added" | "removed" | "modified";

const SYSTEM_FIELDS = new Set(["_id", "_creationTime", "projectId"]);

export type RowDiff<T = Record<string, any>> = {
  order: number;
  status: DiffStatus;
  label: string;
  changedFields?: string[];
  before?: T;
  after?: T;
};

export type ConfigDiff = {
  added: number;
  removed: number;
  modified: number;
};

export type ItemDiff<T = Record<string, any>> = {
  id: string;
  status: DiffStatus;
  label: string;
  changedFields?: string[];
  before?: T;
  after?: T;
};

function getComparableKeys(value: Record<string, unknown>) {
  return Object.keys(value).filter((key) => !SYSTEM_FIELDS.has(key));
}

export function diffRows<T extends Record<string, any>>(
  snapshotRows: T[],
  currentRows: T[],
  options: {
    label: (row: T) => string;
    orderKey?: keyof T;
  }
): RowDiff<T>[] {
  const orderKey = options.orderKey ?? ("order" as keyof T);
  const snapshotByOrder = new Map<number, T>();
  const currentByOrder = new Map<number, T>();

  for (const row of snapshotRows) {
    const order = Number(row[orderKey]);
    if (!Number.isNaN(order)) {
      snapshotByOrder.set(order, row);
    }
  }

  for (const row of currentRows) {
    const order = Number(row[orderKey]);
    if (!Number.isNaN(order)) {
      currentByOrder.set(order, row);
    }
  }

  const diffs: RowDiff<T>[] = [];

  for (const [order, snapshotRow] of snapshotByOrder.entries()) {
    const currentRow = currentByOrder.get(order);
    if (!currentRow) {
      diffs.push({
        order,
        status: "removed",
        label: options.label(snapshotRow),
        before: snapshotRow,
      });
      continue;
    }

    const changedFields = diffFields(snapshotRow, currentRow);
    if (changedFields.length > 0) {
      diffs.push({
        order,
        status: "modified",
        label: options.label(currentRow),
        changedFields,
        before: snapshotRow,
        after: currentRow,
      });
    }
  }

  for (const [order, currentRow] of currentByOrder.entries()) {
    if (!snapshotByOrder.has(order)) {
      diffs.push({
        order,
        status: "added",
        label: options.label(currentRow),
        after: currentRow,
      });
    }
  }

  return diffs.sort((a, b) => a.order - b.order);
}

export function diffFields<T extends Record<string, any>>(
  snapshotRow: T,
  currentRow: T
) {
  const keys = new Set([
    ...getComparableKeys(snapshotRow),
    ...getComparableKeys(currentRow),
  ]);

  const changedFields: string[] = [];
  for (const key of keys) {
    if (key === "order") continue;
    const snapshotValue = snapshotRow[key];
    const currentValue = currentRow[key];
    if (JSON.stringify(snapshotValue) !== JSON.stringify(currentValue)) {
      changedFields.push(key);
    }
  }

  return changedFields;
}

export function diffConfigById<T extends Record<string, any>>(
  snapshotItems: T[],
  currentItems: T[]
): ConfigDiff {
  const snapshotMap = new Map<string, T>(
    snapshotItems.map((item) => [String(item._id), item])
  );
  const currentMap = new Map<string, T>(
    currentItems.map((item) => [String(item._id), item])
  );

  let added = 0;
  let removed = 0;
  let modified = 0;

  for (const [id, snapshotItem] of snapshotMap.entries()) {
    const currentItem = currentMap.get(id);
    if (!currentItem) {
      removed += 1;
      continue;
    }
    if (diffFields(snapshotItem, currentItem).length > 0) {
      modified += 1;
    }
  }

  for (const id of currentMap.keys()) {
    if (!snapshotMap.has(id)) {
      added += 1;
    }
  }

  return { added, removed, modified };
}

export function diffItemsById<T extends Record<string, any>>(
  snapshotItems: T[],
  currentItems: T[],
  options: {
    label: (item: T) => string;
  }
): ItemDiff<T>[] {
  const snapshotMap = new Map<string, T>(
    snapshotItems.map((item) => [String(item._id), item])
  );
  const currentMap = new Map<string, T>(
    currentItems.map((item) => [String(item._id), item])
  );

  const diffs: ItemDiff<T>[] = [];

  for (const item of snapshotItems) {
    const id = String(item._id);
    const currentItem = currentMap.get(id);
    if (!currentItem) {
      diffs.push({
        id,
        status: "removed",
        label: options.label(item),
        before: item,
      });
      continue;
    }

    const changedFields = diffFields(item, currentItem);
    if (changedFields.length > 0) {
      diffs.push({
        id,
        status: "modified",
        label: options.label(currentItem),
        changedFields,
        before: item,
        after: currentItem,
      });
    }
  }

  for (const item of currentItems) {
    const id = String(item._id);
    if (!snapshotMap.has(id)) {
      diffs.push({
        id,
        status: "added",
        label: options.label(item),
        after: item,
      });
    }
  }

  return diffs;
}

export type { DiffStatus };
