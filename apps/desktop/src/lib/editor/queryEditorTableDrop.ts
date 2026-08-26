import type { DatabaseType } from "@/types/database";
import { qualifiedTableName, quoteTableIdentifier } from "@/lib/table/tableSelectSql";

export const DBX_TABLE_REFERENCE_MIME = "application/x-dbx-table-reference";
export const DBX_TABLE_REFERENCE_DROP_EVENT = "dbx-table-reference-drop";
export const DBX_TABLE_REFERENCE_HOVER_EVENT = "dbx-table-reference-hover";
export const DBX_TABLE_REFERENCE_DRAG_END_EVENT = "dbx-table-reference-drag-end";

export interface QueryEditorTableReferencePayload {
  kind: "dbx-table-reference";
  connectionId: string;
  database: string;
  schema?: string;
  tableName?: string;
  columnName?: string;
  /** 多个结果列一起拖入时按选择顺序排列；单列沿用 columnName。 */
  columnNames?: string[];
  referenceType?: "database" | "table" | "column";
  databaseType?: DatabaseType;
  driverProfile?: string;
}

export interface QueryEditorTableReferenceDropDetail {
  payload: QueryEditorTableReferencePayload;
  clientX: number;
  clientY: number;
}

export interface QueryEditorTableReferenceHoverDetail {
  clientX: number;
  clientY: number;
}

function normalizeColumnNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((name) => (typeof name === "string" ? name.trim() : "")).filter((name) => name.length > 0);
}

/** schema/databaseType/driverProfile 为可选元数据，payload 各构造路径共用同一拷贝规则。 */
function applyOptionalReferenceMeta(payload: QueryEditorTableReferencePayload, source: Partial<QueryEditorTableReferencePayload>) {
  if (typeof source.schema === "string" && source.schema) payload.schema = source.schema;
  if (source.databaseType) payload.databaseType = source.databaseType;
  if (typeof source.driverProfile === "string" && source.driverProfile) payload.driverProfile = source.driverProfile;
}

let activeTableReferencePayload: QueryEditorTableReferencePayload | null = null;

export function createTableReferencePayload(options: {
  connectionId?: string;
  database?: string;
  schema?: string;
  tableName?: string;
  columnName?: string;
  referenceType?: "database" | "table" | "column";
  databaseType?: DatabaseType;
  driverProfile?: string;
}): QueryEditorTableReferencePayload | null {
  if (!options.connectionId || options.database == null) return null;
  const referenceType = options.referenceType ?? (options.columnName ? "column" : "table");
  if (referenceType !== "database" && !options.tableName) return null;
  const payload: QueryEditorTableReferencePayload = {
    kind: "dbx-table-reference",
    connectionId: options.connectionId,
    database: options.database,
  };
  if (referenceType === "database") {
    payload.referenceType = "database";
  } else {
    payload.tableName = options.tableName;
  }
  if (referenceType === "column" && options.columnName) {
    payload.columnName = options.columnName;
    payload.referenceType = "column";
  }
  applyOptionalReferenceMeta(payload, options);
  return payload;
}

export function createColumnReferencePayload(options: { connectionId?: string; database?: string; schema?: string; columnNames?: readonly (string | undefined | null)[]; databaseType?: DatabaseType }): QueryEditorTableReferencePayload | null {
  const columnNames = normalizeColumnNames(options.columnNames);
  if (!options.connectionId || options.database == null || columnNames.length === 0) return null;
  const payload: QueryEditorTableReferencePayload = {
    kind: "dbx-table-reference",
    connectionId: options.connectionId,
    database: options.database,
    referenceType: "column",
    columnNames,
  };
  applyOptionalReferenceMeta(payload, options as Partial<QueryEditorTableReferencePayload>);
  return payload;
}

export function serializeTableReferencePayload(payload: QueryEditorTableReferencePayload): string {
  return JSON.stringify(payload);
}

export function parseTableReferencePayload(value: string | undefined | null): QueryEditorTableReferencePayload | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<QueryEditorTableReferencePayload>;
    if (parsed.kind !== "dbx-table-reference" || typeof parsed.connectionId !== "string" || typeof parsed.database !== "string" || !parsed.connectionId) {
      return null;
    }
    if (parsed.referenceType === "database") {
      const payload: QueryEditorTableReferencePayload = {
        kind: "dbx-table-reference",
        connectionId: parsed.connectionId,
        database: parsed.database,
        referenceType: "database",
      };
      if (parsed.databaseType) payload.databaseType = parsed.databaseType;
      if (typeof parsed.driverProfile === "string" && parsed.driverProfile) payload.driverProfile = parsed.driverProfile;
      return payload;
    }
    if (typeof parsed.tableName !== "string" || !parsed.tableName) {
      // 无来源表的纯列引用（如从查询结果列头拖入），tableName 非必需。
      const columnNames = normalizeColumnNames(parsed.columnNames);
      if (columnNames.length === 0) return null;
      const payload: QueryEditorTableReferencePayload = {
        kind: "dbx-table-reference",
        connectionId: parsed.connectionId,
        database: parsed.database,
        referenceType: "column",
        columnNames,
      };
      applyOptionalReferenceMeta(payload, parsed);
      return payload;
    }
    const columnName = typeof parsed.columnName === "string" && parsed.columnName ? parsed.columnName : undefined;
    const referenceType = parsed.referenceType === "column" || columnName ? "column" : "table";
    if (referenceType === "column" && !columnName) return null;
    const payload: QueryEditorTableReferencePayload = {
      kind: "dbx-table-reference",
      connectionId: parsed.connectionId,
      database: parsed.database,
      tableName: parsed.tableName,
    };
    if (referenceType === "column" && columnName) {
      payload.columnName = columnName;
      payload.referenceType = "column";
    }
    applyOptionalReferenceMeta(payload, parsed);
    return payload;
  } catch {
    return null;
  }
}

export function hasTableReferencePayloadType(types: Iterable<string> | undefined | null): boolean {
  if (!types) return false;
  for (const type of types) {
    if (type === DBX_TABLE_REFERENCE_MIME) return true;
  }
  return false;
}

export function setActiveTableReferencePayload(payload: QueryEditorTableReferencePayload | null) {
  activeTableReferencePayload = payload;
}

export function activeTableReferencePayloadValue(): QueryEditorTableReferencePayload | null {
  return activeTableReferencePayload;
}

export function clearActiveTableReferencePayload(payload?: QueryEditorTableReferencePayload | null) {
  if (!payload || activeTableReferencePayload === payload) {
    activeTableReferencePayload = null;
  }
}

export function createTableReferenceDropEvent(detail: QueryEditorTableReferenceDropDetail) {
  return new CustomEvent<QueryEditorTableReferenceDropDetail>(DBX_TABLE_REFERENCE_DROP_EVENT, { detail });
}

export function createTableReferenceHoverEvent(detail: QueryEditorTableReferenceHoverDetail) {
  return new CustomEvent<QueryEditorTableReferenceHoverDetail>(DBX_TABLE_REFERENCE_HOVER_EVENT, { detail });
}

export function createTableReferenceDragEndEvent(): Event {
  return new Event(DBX_TABLE_REFERENCE_DRAG_END_EVENT);
}

export function tableReferenceInsertText(payload: QueryEditorTableReferencePayload, fallbackDatabaseType?: DatabaseType): string {
  const databaseType = payload.databaseType ?? fallbackDatabaseType;
  if (payload.referenceType === "database") {
    return quoteTableIdentifier(databaseType, payload.database);
  }
  const columnNames = payload.columnNames?.length ? payload.columnNames : payload.columnName ? [payload.columnName] : [];
  if (payload.referenceType === "column" && columnNames.length > 0) {
    return columnNames.map((name) => quoteTableIdentifier(databaseType, name)).join(",\n");
  }
  const tableName = payload.tableName || payload.database;
  return qualifiedTableName({
    databaseType,
    driverProfile: payload.driverProfile,
    schema: payload.schema,
    tableName,
  });
}
