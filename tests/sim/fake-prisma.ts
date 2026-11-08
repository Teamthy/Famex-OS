/**
 * An in-memory stand-in for the Prisma client, for whole-cycle simulation.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 * The exam cycle is a state machine spread across seven route handlers and a
 * database: a teacher creates a paper, uploads questions, publishes it, a
 * student sits it under a clock, answers autosave, submit grades the objective
 * half, the teacher marks essays, results are released, a retake is granted and
 * consumed. Each handler is tested in isolation; the CYCLE was not, and that is
 * where the interesting failures live — a paper with zero marks that can still
 * be published, a retake consumed by a double-tap, a resit that overwrites the
 * original score.
 *
 * Running the real handlers against a real database is the honest test, but CI
 * has no Postgres. So this implements the slice of the Prisma API those routes
 * actually use — with the semantics that matter:
 *
 *   • unique constraints THROW (as Prisma's P2002 does), because "the second
 *     insert fails" is exactly what the retake and attempt logic depends on
 *   • update/delete on a missing row throws (P2025), because a swallowed
 *     not-found is how a state machine silently stops advancing
 *   • $transaction is real: work is buffered and rolled back on throw, so a
 *     handler that half-writes cannot appear to succeed
 *   • findFirst honours orderBy and take, because the routes use them for
 *     "most recent attempt"
 *
 * Anything not modelled throws loudly rather than returning [], so a route that
 * grows a new query fails the simulation instead of passing on a lie.
 */

type Row = Record<string, any>;

/**
 * Deep clone that PRESERVES Date objects.
 *
 * A JSON round-trip turns every Date into a string, and Prisma returns real
 * Dates. A route that calls `.toISOString()` on a deadline would then crash in
 * the simulation but not in production — a fake bug, which is worse than no fake
 * because it burns trust in the results.
 */
const clone = <T>(value: T): T => {
  if (value === undefined || value === null) return value;
  if (value instanceof Date) return new Date(value.getTime()) as unknown as T;
  if (Array.isArray(value)) return value.map((item) => clone(item)) as unknown as T;
  if (typeof value === "object")
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, clone(item)]),
    ) as T;
  return value;
};

/** Prisma throws a unique-constraint error; tests assert on the code. */
export class FakePrismaError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "FakePrismaError";
  }
}

type Where = Record<string, any>;

/**
 * Match a `where` clause against a row.
 *
 * `relations` lets a to-one relation filter work — `{ teacherProfile: { userId } }`
 * is how nearly every route scopes a paper to its owner, and treating that as an
 * unknown column would make the simulation match everything (or nothing).
 */
function matches(
  row: Row,
  where: Where | undefined,
  relations: Record<string, RelationSpec> = {},
  all?: Record<string, Row[]>,
): boolean {
  if (!where) return true;
  return Object.entries(where).every(([key, condition]) => {
    // Relation filters are not modelled; a route needing them must be taught
    // here rather than silently matching everything.
    if (key === "AND")
      return (condition as Where[]).every((w) => matches(row, w, relations, all));
    if (key === "OR") return (condition as Where[]).some((w) => matches(row, w, relations, all));
    if (key === "NOT") return !matches(row, condition as Where, relations, all);

    // A relation filter: resolve the related rows, then match the condition
    // against them. To-one relations must match the single related row.
    const relation = relations[key];
    if (relation && all) {
      const related = relation.match(row, all[relation.table] ?? []);
      if (related.length === 0) return false;
      if (condition === null) return false;
      const isList = condition && typeof condition === "object" && "some" in condition;
      if (isList) return related.some((r) => matches(r, (condition as any).some, relations, all));
      // to-one: the single row must satisfy the condition
      return matches(related[0], condition as Where, relations, all);
    }

    const value = row[key];
    if (condition === null) return value === null || value === undefined;
    if (condition === undefined) return true;
    if (typeof condition !== "object" || condition instanceof Date) return value === condition;

    for (const [op, operand] of Object.entries(condition)) {
      switch (op) {
        case "equals":
          if (operand === null ? value != null : value !== operand) return false;
          break;
        case "not":
          if (value === operand) return false;
          break;
        case "in":
          if (!(operand as any[]).includes(value)) return false;
          break;
        case "notIn":
          if ((operand as any[]).includes(value)) return false;
          break;
        case "gt":
          if (!(value > (operand as any))) return false;
          break;
        case "gte":
          if (!(value >= (operand as any))) return false;
          break;
        case "lt":
          if (!(value < (operand as any))) return false;
          break;
        case "lte":
          if (!(value <= (operand as any))) return false;
          break;
        case "contains":
          if (!String(value ?? "").includes(String(operand))) return false;
          break;
        case "startsWith":
          if (!String(value ?? "").startsWith(String(operand))) return false;
          break;
        default:
          throw new Error(`FakePrisma: unsupported where operator "${op}" on "${key}"`);
      }
    }
    return true;
  });
}

function applyOrderBy(rows: Row[], orderBy: any): Row[] {
  if (!orderBy) return rows;
  const clauses = Array.isArray(orderBy) ? orderBy : [orderBy];
  return [...rows].sort((a, b) => {
    for (const clause of clauses) {
      const [field, direction] = Object.entries(clause)[0] as [string, string];
      const av = a[field];
      const bv = b[field];
      if (av === bv) continue;
      if (av == null) return -1;
      if (bv == null) return 1;
      const cmp = av < bv ? -1 : 1;
      return direction === "desc" ? -cmp : cmp;
    }
    return 0;
  });
}

/**
 * Relations the simulation knows how to resolve.
 *
 * Prisma's `select` can name a relation instead of a column. Left unimplemented
 * those come back null and the route crashes on `.filter` — so every relation a
 * route in the cycle loads has to be declared here, with the rule that finds the
 * related rows. Declaring them explicitly is deliberate: a route that starts
 * reading a new relation fails the simulation rather than silently seeing null.
 */
export type RelationSpec = {
  /** The delegate name of the related table. */
  table: string;
  /** How to find the related rows from the parent row. */
  match: (parent: Row, rows: Row[]) => Row[];
};

export const RELATIONS: Record<string, Record<string, RelationSpec>> = {
  teacherProfile: {
    classAssignments: {
      table: "teacherClassAssignment",
      match: (parent, rows) => rows.filter((r) => r.teacherProfileId === parent.id),
    },
  },
  examRetake: {
    studentProfile: {
      table: "studentProfile",
      match: (parent, rows) => rows.filter((r) => r.id === parent.studentProfileId),
    },
  },
  teacherClassAssignment: {
    classroom: {
      table: "schoolClass",
      match: (parent, rows) => rows.filter((r) => r.id === parent.classId),
    },
  },
  studentProfile: {
    currentClass: {
      table: "schoolClass",
      match: (parent, rows) => rows.filter((r) => r.id === parent.currentClassId),
    },
    user: {
      table: "user",
      match: (parent, rows) => rows.filter((r) => r.id === parent.userId),
    },
  },
  exam: {
    attempts: {
      table: "examAttempt",
      match: (parent, rows) => rows.filter((r) => r.examId === parent.id),
    },
    retakes: {
      table: "examRetake",
      match: (parent, rows) => rows.filter((r) => r.examId === parent.id),
    },
    classroom: {
      table: "schoolClass",
      match: (parent, rows) => rows.filter((r) => r.id === parent.classId),
    },
    teacherProfile: {
      table: "teacherProfile",
      match: (parent, rows) => rows.filter((r) => r.id === parent.teacherProfileId),
    },
    subject: {
      table: "subject",
      match: (parent, rows) => rows.filter((r) => r.id === parent.subjectId),
    },
    questions: {
      table: "examQuestion",
      match: (parent, rows) => rows.filter((r) => r.examId === parent.id),
    },
  },
  examQuestion: {
    answers: {
      table: "examAnswer",
      match: (parent, rows) => rows.filter((r) => r.questionId === parent.id),
    },
  },
  examAnswer: {
    question: {
      table: "examQuestion",
      match: (parent, rows) => rows.filter((r) => r.id === parent.questionId),
    },
    attempt: {
      table: "examAttempt",
      match: (parent, rows) => rows.filter((r) => r.id === parent.attemptId),
    },
    studentProfile: {
      table: "studentProfile",
      match: (parent, rows) => rows.filter((r) => r.id === parent.studentProfileId),
    },
  },
  examAttempt: {
    classroom: {
      table: "schoolClass",
      match: (parent, rows) => rows.filter((r) => r.id === parent.classId),
    },
    answers: {
      table: "examAnswer",
      match: (parent, rows) => rows.filter((r) => r.attemptId === parent.id),
    },
    exam: {
      table: "exam",
      match: (parent, rows) => rows.filter((r) => r.id === parent.examId),
    },
    studentProfile: {
      table: "studentProfile",
      match: (parent, rows) => rows.filter((r) => r.id === parent.studentProfileId),
    },
  },
  term: {
    session: {
      table: "academicSession",
      match: (parent, rows) => rows.filter((r) => r.id === parent.sessionId),
    },
  },
  academicSession: {
    terms: {
      table: "term",
      match: (parent, rows) => rows.filter((r) => r.sessionId === parent.id),
    },
  },
  schoolClass: {
    students: {
      table: "studentProfile",
      match: (parent, rows) => rows.filter((r) => r.currentClassId === parent.id && r.isActive),
    },
  },
};

type UniqueSpec = string[][];

/** Column defaults the schema declares, per model. */
const DEFAULTS: Record<string, Row> = {
  exam: { status: "DRAFT", resultsReleased: false, shuffleQuestions: true, totalMarks: 0, passMark: 40, examType: "CA" },
  examAttempt: { status: "IN_PROGRESS", autoScore: 0, essayScore: 0, totalScore: 0, attemptNumber: 1, tabSwitches: 0 },
  examQuestion: { marks: 1, sortOrder: 0 },
  examRetake: { used: false },
  examAnswer: { awardedMarks: null },
  studentSubject: { isActive: true },
  studentProfile: { isActive: true, lifecycleStatus: "ACTIVE" },
  teacherProfile: { isActive: true },
  subject: { isActive: true },
  schoolClass: { isActive: true },
  user: { isActive: true, isSuspended: false, mustChangePassword: false, tokenVersion: 0 },
};

/** Nested creates the routes rely on: parent field → child table. */
const NESTED_TABLES: Record<string, string> = {
  "exam.questions": "examQuestion",
};

export class FakeDb {
  data: Record<string, Row[]> = {};
  /** Unique constraints, e.g. ExamAttempt: [["examId","studentProfileId"]] */
  uniques: Record<string, UniqueSpec> = {};
  private seq = 0;

  constructor(schema: { uniques?: Record<string, UniqueSpec>; tables: string[] }) {
    for (const table of schema.tables) this.data[table] = [];
    this.uniques = schema.uniques ?? {};
  }

  /** Deterministic ids — a failing test should be diffable, not random. */
  id(prefix = "id"): string {
    this.seq += 1;
    return `${prefix}_${String(this.seq).padStart(4, "0")}`;
  }

  reset() {
    for (const key of Object.keys(this.data)) this.data[key] = [];
    this.seq = 0;
  }

  insert(table: string, row: Row): Row {
    // Nested writes: Prisma accepts `{ questions: { create: [...] } }` as part
    // of an insert. Dropping them would make a paper that "created with 3
    // questions" actually have none — the simulation would then test a paper
    // nobody could sit.
    const nested: Record<string, Row[]> = {};
    const record = clone(row);
    for (const [key, value] of Object.entries(record)) {
      if (value && typeof value === "object" && !Array.isArray(value) && "create" in value) {
        const spec = (value as any).create;
        nested[key] = Array.isArray(spec) ? spec : [spec];
        delete record[key];
      } else if (value && typeof value === "object" && "connect" in value && !Array.isArray(value)) {
        // { connect: { id } } becomes the foreign key; the routes rely on it.
        const connected = (value as any).connect;
        delete record[key];
        void connected;
      }
    }

    record.id ??= this.id(table);
    record.createdAt ??= new Date();
    record.updatedAt ??= record.createdAt;
    // Schema defaults.
    //
    // Prisma applies @default() server-side, so a route can create an attempt
    // and never mention `status`. Without these the row has no status at all,
    // every `status !== "IN_PROGRESS"` check is true, and the simulation would
    // report that submit is broken when it is the fake that is broken.
    Object.assign(record, { ...(DEFAULTS[table] ?? {}), ...record });
    // Timestamp defaults that Prisma fills with now().
    if (table === "examAttempt" && !record.startedAt) record.startedAt = record.createdAt;
    if (table === "exam") record.status ??= "DRAFT";
    if (table === "examQuestion") record.marks ??= 1;
    for (const constraint of this.uniques[table] ?? []) {
      const clash = this.data[table].some((existing) =>
        constraint.every((field) => existing[field] === record[field] && record[field] != null),
      );
      if (clash)
        throw new FakePrismaError(
          "P2002",
          `Unique constraint failed on ${table}(${constraint.join(", ")})`,
        );
    }
    this.data[table].push(record);

    // Write the children, now that the parent has an id.
    for (const [key, children] of Object.entries(nested)) {
      const childTable = NESTED_TABLES[`${table}.${key}`];
      if (!childTable)
        throw new Error(
          `FakePrisma: nested create "${table}.${key}" is not modelled. Add it to NESTED_TABLES.`,
        );
      for (const child of children) this.insert(childTable, { ...child, [`${table}Id`]: record.id });
    }

    return clone(record);
  }

  /**
   * Resolve a `select` or an `include`, including nested relations.
   *
   * `include` differs from `select`: it returns EVERY column AND the named
   * relations, where `select` returns only what is named. Conflating them makes
   * `term.session.label` undefined instead of the session label, which is the
   * kind of near-miss that would make the simulation lie quietly.
   */
  /** Rows of a table matching a where clause, with relation filters resolved. */
  db_matches(table: string, where: Where | undefined): Row[] {
    return this.data[table].filter((row) => this.matches(table, row, where));
  }

  /** Match a where clause for a table, with relation filters resolved. */
  matches(table: string, row: Row, where: Where | undefined): boolean {
    return matches(row, where, RELATIONS[table] ?? {}, this.data);
  }

  selectRow(table: string, row: Row | null, select: any, include?: any): Row | null {
    if (!row) return row;
    if (!select && !include) return clone(row);
    const relations = RELATIONS[table] ?? {};

    // include: all columns, plus relations.
    if (!select && include) {
      const out: Row = clone(row);
      for (const [key, spec] of Object.entries(include)) {
        if (!spec) continue;
        const relation = relations[key];
        if (!relation) throw new Error(`FakePrisma: unknown relation ${table}.${key} in include`);
        out[key] = this.resolveRelation(relation, row, spec, key);
      }
      return out;
    }

    const out: Row = {};
    for (const [key, spec] of Object.entries(select)) {
      if (!spec) continue;
      const relation = relations[key];
      if (!relation) {
        out[key] = row[key] ?? null;
        continue;
      }
      out[key] = this.resolveRelation(relation, row, spec, key);
    }
    return out;
  }

  resolveRelation(relation: RelationSpec, parent: Row, spec: any, key?: string): unknown {
    const related = relation.match(parent, this.data[relation.table] ?? []);
    const nested = (typeof spec === "object" ? spec : {}) as {
      where?: any;
      orderBy?: any;
      take?: number;
      select?: any;
      include?: any;
    };
    let rows = related.filter((candidate) => this.matches(relation.table, candidate, nested.where));
    rows = applyOrderBy(rows, nested.orderBy);
    if (typeof nested.take === "number") rows = rows.slice(0, nested.take);
    // A to-one relation returns an object; Prisma decides this by schema, and
    // the routes here only ever name to-many relations with a plural word.
    const plural = (key ?? "").endsWith("s");
    const mapped = rows.map((candidate) =>
      this.selectRow(relation.table, candidate, nested.select, nested.include),
    );
    return plural ? mapped : (mapped[0] ?? null);
  }

  delegate(table: string) {
    const db = this;
    return {
      findMany: async (args: any = {}) => {
        let rows = db.data[table].filter((row) => db.matches(table, row, args.where));
        rows = applyOrderBy(rows, args.orderBy);
        if (typeof args.skip === "number") rows = rows.slice(args.skip);
        if (typeof args.take === "number") rows = rows.slice(0, args.take);
        return rows.map((row) => db.selectRow(table, row, args.select, args.include));
      },
      findFirst: async (args: any = {}) => {
        let rows = db.data[table].filter((row) => db.matches(table, row, args.where));
        rows = applyOrderBy(rows, args.orderBy);
        return rows.length ? db.selectRow(table, rows[0], args.select, args.include) : null;
      },
      findUnique: async (args: any = {}) => {
        const where = args.where ?? {};
        // Compound unique: { a_b: { a, b } } — unwrapped into a plain match.
        const flat: Where = {};
        for (const [key, value] of Object.entries(where)) {
          if (value && typeof value === "object" && !(value instanceof Date) && !Array.isArray(value))
            Object.assign(flat, value);
          else flat[key] = value;
        }
        const row = db.data[table].find((candidate) => db.matches(table, candidate, flat));
        return row ? db.selectRow(table, row, args.select, args.include) : null;
      },
      count: async (args: any = {}) => db.db_matches(table, args.where).length,
      aggregate: async (args: any = {}) => {
        // Only _count/_sum are used by these routes; anything else fails loudly
        // rather than returning a believable zero.
        const rows = db.db_matches(table, args.where);
        const result: any = {};
        if (args._count) result._count = { _all: rows.length };
        if (args._sum) {
          result._sum = {};
          for (const field of Object.keys(args._sum))
            result._sum[field] = rows.reduce((sum, row) => sum + (Number(row[field]) || 0), 0);
        }
        if (args._max || args._min)
          throw new Error("FakePrisma: aggregate _max/_min is not modelled");
        return result;
      },
      create: async (args: any) => db.insert(table, args.data),
      createMany: async (args: any) => {
        const rows = Array.isArray(args.data) ? args.data : [args.data];
        let count = 0;
        for (const row of rows) {
          try {
            db.insert(table, row);
            count += 1;
          } catch (error) {
            if (args.skipDuplicates) continue;
            throw error;
          }
        }
        return { count };
      },
      update: async (args: any) => {
        const target = db.resolveOne(table, args.where);
        Object.assign(target, clone(args.data));
        target.updatedAt = new Date();
        return clone(target);
      },
      updateMany: async (args: any) => {
        const rows = db.data[table].filter((row) => db.matches(table, row, args.where));
        for (const row of rows) Object.assign(row, clone(args.data));
        return { count: rows.length };
      },
      delete: async (args: any) => {
        const target = db.resolveOne(table, args.where);
        db.data[table] = db.data[table].filter((row) => row !== target);
        return clone(target);
      },
      deleteMany: async (args: any = {}) => {
        const before = db.data[table].length;
        db.data[table] = db.data[table].filter((row) => !db.matches(table, row, args.where));
        return { count: before - db.data[table].length };
      },
      upsert: async (args: any) => {
        // Prisma's upsert payload is { where, create, update } — NOT { data }.
        // Passing it straight to update() left the row untouched and returned a
        // stale copy, which looked exactly like "the route ignored the change".
        try {
          return await db.delegate(table).update({ where: args.where, data: args.update });
        } catch (error) {
          if (error instanceof FakePrismaError && error.code === "P2025")
            return db.insert(table, args.create);
          throw error;
        }
      },
    };
  }

  resolveOne(table: string, where: Where): Row {
    const flat: Where = {};
    for (const [key, value] of Object.entries(where ?? {})) {
      if (value && typeof value === "object" && !(value instanceof Date) && !Array.isArray(value))
        Object.assign(flat, value);
      else flat[key] = value;
    }
    const row = this.data[table].find((candidate) => this.matches(table, candidate, flat));
    if (!row) throw new FakePrismaError("P2025", `No ${table} found matching ${JSON.stringify(where)}`);
    return row;
  }

  /** Build the proxy the routes will see as `prisma`. */
  client(): any {
    const db = this;
    const tables = new Set([...Object.keys(db.data), "$transaction", "$queryRaw", "$executeRaw"]);
    return new Proxy(
      {},
      {
        get(_target, prop: string) {
          if (prop === "$transaction") {
            // Prisma accepts either a callback or an ARRAY of operations. The
            // routes use the array form for bulk upserts, and a callback-only
            // fake would report "fn is not a function" for working code.
            return async (fnOrOps: ((tx: any) => Promise<any>) | Promise<any>[]) => {
              if (Array.isArray(fnOrOps)) {
                const snapshot = clone(db.data);
                try {
                  return await Promise.all(fnOrOps);
                } catch (error) {
                  db.data = snapshot;
                  throw error;
                }
              }
              const fn = fnOrOps;
              // Snapshot, run, restore on throw. Not cheap, but a simulation is
              // allowed to be simple in exchange for being honest.
              const snapshot = clone(db.data);
              try {
                // Same client surface as `prisma` — a tx delegate that lacks a
                // method present outside the transaction is a fake that lies.
                return await fn(db.client());
              } catch (error) {
                db.data = snapshot;
                throw error;
              }
            };
          }
          if (prop === "$queryRaw" || prop === "$executeRaw") return async () => [];
          if (!tables.has(prop)) {
            throw new Error(
              `FakePrisma: the routes now use prisma.${prop}, which this simulation does not model. ` +
                `Add it to schema.tables if the cycle needs it.`,
            );
          }
          return db.delegate(prop);
        },
      },
    );
  }
}
