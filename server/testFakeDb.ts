// Minimal in-memory drizzle-orm test double, scoped to the query shapes commonly used across
// this repo's services (plain single-table selects/inserts/updates/deletes, two-table
// innerJoins, eq/and/inArray where clauses, and asc/desc ordering).
// It is not a general-purpose drizzle emulator — it understands only the SQL fragment shapes
// that drizzle-orm's `eq`, `and`, `inArray`, `asc` and `desc` helpers actually produce.
import { Column, Param, SQL, getTableColumns, is } from "drizzle-orm";

type DbRow = Record<string, unknown>;

function tableColumnMaps(table: any) {
  const columns = getTableColumns(table);
  const jsToDb: Record<string, string> = {};
  const dbToJs: Record<string, string> = {};
  for (const [jsKey, column] of Object.entries(columns)) {
    jsToDb[jsKey] = (column as any).name;
    dbToJs[(column as any).name] = jsKey;
  }
  return { jsToDb, dbToJs };
}

function toDbRow(table: any, jsRow: Record<string, unknown>): DbRow {
  const { jsToDb } = tableColumnMaps(table);
  const out: DbRow = {};
  for (const [key, value] of Object.entries(jsRow)) {
    out[jsToDb[key] ?? key] = value;
  }
  return out;
}

function toJsRow(table: any, dbRow: DbRow): Record<string, unknown> {
  const { dbToJs } = tableColumnMaps(table);
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(dbRow)) {
    out[dbToJs[key] ?? key] = value;
  }
  return out;
}

function strVal(chunk: any): string {
  return Array.isArray(chunk?.value) ? chunk.value.join("") : "";
}

function evalCond(node: any, rowByTable: Map<any, DbRow>): boolean {
  if (node == null) return true;
  if (!(node instanceof SQL)) return true;
  const chunks: any[] = node.queryChunks;

  // and(...)/or(...): "(" + inner + ")"
  if (chunks.length === 3 && chunks[1] instanceof SQL && strVal(chunks[0]) === "(" && strVal(chunks[2]) === ")") {
    return evalCond(chunks[1], rowByTable);
  }
  // inner combinator: left <op> right
  if (chunks.length === 3 && chunks[0] instanceof SQL && chunks[2] instanceof SQL) {
    const op = strVal(chunks[1]).trim();
    if (op === "and") return evalCond(chunks[0], rowByTable) && evalCond(chunks[2], rowByTable);
    if (op === "or") return evalCond(chunks[0], rowByTable) || evalCond(chunks[2], rowByTable);
  }
  // eq / inArray: [ '', Column, ' <op> ', Param|Array<Param>|Column, '' ]
  if (chunks.length === 5 && is(chunks[1], Column)) {
    const column = chunks[1];
    const op = strVal(chunks[2]).trim();
    const row = rowByTable.get(column.table);
    if (!row) throw new Error(`Fake DB: no row context for table of column "${column.name}".`);
    const actual = row[column.name];
    if (op === "=" && chunks[3] instanceof Param) return actual === (chunks[3] as any).value;
    if (op === "=" && is(chunks[3], Column)) {
      const otherColumn = chunks[3];
      const otherRow = rowByTable.get(otherColumn.table);
      if (!otherRow) throw new Error(`Fake DB: no row context for table of column "${otherColumn.name}".`);
      return actual === otherRow[otherColumn.name];
    }
    if (op === "in" && Array.isArray(chunks[3])) {
      const values = (chunks[3] as any[]).map((entry) => entry.value);
      return values.includes(actual);
    }
  }
  throw new Error("Fake DB: unsupported condition shape in test double.");
}

function orderDirective(node: any): { column: any; direction: "asc" | "desc" } | null {
  if (!(node instanceof SQL)) return null;
  const chunks: any[] = node.queryChunks;
  if (chunks.length === 3 && is(chunks[1], Column)) {
    const direction = strVal(chunks[2]).trim();
    if (direction === "asc" || direction === "desc") return { column: chunks[1], direction };
  }
  return null;
}

type Selection = Record<string, any> | undefined;

class SelectBuilder implements PromiseLike<any[]> {
  private table: any;
  private joins: Array<{ table: any; cond: any }> = [];
  private whereCond: any;
  private orderDirectives: Array<{ column: any; direction: "asc" | "desc" }> = [];
  private limitCount: number | undefined;

  constructor(
    private store: Map<any, DbRow[]>,
    private selection: Selection,
  ) {}

  from(table: any) {
    this.table = table;
    return this;
  }

  innerJoin(table: any, cond: any) {
    this.joins.push({ table, cond });
    return this;
  }

  where(cond: any) {
    this.whereCond = cond;
    return this;
  }

  orderBy(...directives: any[]) {
    for (const directive of directives) {
      const parsed = orderDirective(directive);
      if (parsed) this.orderDirectives.push(parsed);
    }
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  private materialize(): any[] {
    let combos: Array<Map<any, DbRow>> = (this.store.get(this.table) ?? []).map(
      (row) => new Map([[this.table, row]]),
    );

    for (const join of this.joins) {
      const otherRows = this.store.get(join.table) ?? [];
      const next: Array<Map<any, DbRow>> = [];
      for (const combo of combos) {
        for (const otherRow of otherRows) {
          const candidate = new Map(combo);
          candidate.set(join.table, otherRow);
          if (evalCond(join.cond, candidate)) next.push(candidate);
        }
      }
      combos = next;
    }

    if (this.whereCond) combos = combos.filter((combo) => evalCond(this.whereCond, combo));

    for (const { column, direction } of this.orderDirectives.slice().reverse()) {
      combos = combos.slice().sort((a, b) => {
        const left = a.get(column.table)?.[column.name];
        const right = b.get(column.table)?.[column.name];
        if (left === right) return 0;
        const cmp = (left as any) < (right as any) ? -1 : 1;
        return direction === "asc" ? cmp : -cmp;
      });
    }

    if (this.limitCount !== undefined) combos = combos.slice(0, this.limitCount);

    return combos.map((combo) => {
      if (!this.selection) return toJsRow(this.table, combo.get(this.table)!);
      const out: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(this.selection)) {
        if (is(value, Column)) {
          out[key] = combo.get(value.table)?.[value.name];
        } else {
          out[key] = toJsRow(value, combo.get(value)!);
        }
      }
      return out;
    });
  }

  then<TResult1 = any[], TResult2 = never>(
    onfulfilled?: ((value: any[]) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve().then(() => this.materialize()).then(onfulfilled, onrejected);
  }
}

class InsertBuilder implements PromiseLike<any[]> {
  private rows: Record<string, unknown>[] = [];
  private conflictTargets: any[] | null = null;
  private didReturn = false;

  constructor(
    private store: Map<any, DbRow[]>,
    private sequences: Map<any, number>,
    private table: any,
  ) {}

  values(input: Record<string, unknown> | Record<string, unknown>[]) {
    this.rows = Array.isArray(input) ? input : [input];
    return this;
  }

  onConflictDoNothing(_opts?: { target?: any[] }) {
    this.conflictTargets = _opts?.target ?? [];
    return this;
  }

  returning(_selection?: any) {
    this.didReturn = true;
    return this;
  }

  private materialize(): any[] {
    const existing = this.store.get(this.table) ?? [];
    if (!this.store.has(this.table)) this.store.set(this.table, existing);
    const inserted: DbRow[] = [];

    for (const jsRow of this.rows) {
      const dbRow = toDbRow(this.table, jsRow);

      if (this.conflictTargets && this.conflictTargets.length) {
        const conflict = existing.some((row) =>
          this.conflictTargets!.every((column) => row[column.name] === dbRow[column.name]),
        );
        if (conflict) continue;
      }

      const nextId = (this.sequences.get(this.table) ?? 0) + 1;
      this.sequences.set(this.table, nextId);
      const now = new Date();
      const finalRow: DbRow = { id: nextId, created_at: now, updated_at: now, ...dbRow };
      existing.push(finalRow);
      inserted.push(finalRow);
    }

    return this.didReturn ? inserted.map((row) => toJsRow(this.table, row)) : [];
  }

  then<TResult1 = any[], TResult2 = never>(
    onfulfilled?: ((value: any[]) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve().then(() => this.materialize()).then(onfulfilled, onrejected);
  }
}

class UpdateBuilder implements PromiseLike<any[]> {
  private patch: Record<string, unknown> = {};
  private whereCond: any;
  private didReturn = false;

  constructor(
    private store: Map<any, DbRow[]>,
    private table: any,
  ) {}

  set(patch: Record<string, unknown>) {
    this.patch = patch;
    return this;
  }

  where(cond: any) {
    this.whereCond = cond;
    return this;
  }

  returning(_selection?: any) {
    this.didReturn = true;
    return this;
  }

  private materialize(): any[] {
    const rows = this.store.get(this.table) ?? [];
    const patchDb = toDbRow(this.table, this.patch);
    const updated: DbRow[] = [];
    for (const row of rows) {
      const combo = new Map([[this.table, row]]);
      if (this.whereCond && !evalCond(this.whereCond, combo)) continue;
      for (const [key, value] of Object.entries(patchDb)) {
        if (value !== undefined) row[key] = value;
      }
      updated.push(row);
    }
    return this.didReturn ? updated.map((row) => toJsRow(this.table, row)) : [];
  }

  then<TResult1 = any[], TResult2 = never>(
    onfulfilled?: ((value: any[]) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve().then(() => this.materialize()).then(onfulfilled, onrejected);
  }
}

class DeleteBuilder implements PromiseLike<any[]> {
  private whereCond: any;

  constructor(
    private store: Map<any, DbRow[]>,
    private table: any,
  ) {}

  where(cond: any) {
    this.whereCond = cond;
    return this;
  }

  private materialize(): any[] {
    const rows = this.store.get(this.table) ?? [];
    const remaining = rows.filter((row) => {
      const combo = new Map([[this.table, row]]);
      return this.whereCond ? !evalCond(this.whereCond, combo) : false;
    });
    this.store.set(this.table, remaining);
    return [];
  }

  then<TResult1 = any[], TResult2 = never>(
    onfulfilled?: ((value: any[]) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve().then(() => this.materialize()).then(onfulfilled, onrejected);
  }
}

export function createFakeDb() {
  const store = new Map<any, DbRow[]>();
  const sequences = new Map<any, number>();

  return {
    select(selection?: Selection) {
      return new SelectBuilder(store, selection);
    },
    insert(table: any) {
      return new InsertBuilder(store, sequences, table);
    },
    update(table: any) {
      return new UpdateBuilder(store, table);
    },
    delete(table: any) {
      return new DeleteBuilder(store, table);
    },
    /** Test-only helper: seed rows directly (bypasses id auto-increment bookkeeping unless you set `id`). */
    seed(table: any, rows: Record<string, unknown>[]) {
      const dbRows = rows.map((row) => {
        const dbRow = toDbRow(table, row);
        if (typeof dbRow.id === "number") {
          sequences.set(table, Math.max(sequences.get(table) ?? 0, dbRow.id as number));
        }
        return dbRow;
      });
      store.set(table, [...(store.get(table) ?? []), ...dbRows]);
    },
    /** Test-only helper: read back all rows of a table as JS-keyed objects. */
    dump(table: any) {
      return (store.get(table) ?? []).map((row) => toJsRow(table, row));
    },
  };
}

export type FakeDb = ReturnType<typeof createFakeDb>;
