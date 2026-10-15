/**
 * The ledger (F5-08, F5-09, F5-13, F5-11) — the source of truth for money.
 *
 * Rule 10: invoices, fee balances and every dashboard figure are PROJECTIONS
 * of these three tables. Rule 9: nothing here is ever deleted or updated — a
 * mistake is corrected by a counter-entry with an actor attached.
 *
 * ── The model ──────────────────────────────────────────────────────────────
 * A `LedgerAccount` is one line in the chart of accounts (lib/ledger-accounts.ts
 * declares the provisioned set). A `LedgerJournal` is one balanced posting with
 * a source document, an actor and a timestamp. A `LedgerLine` is one leg,
 * signed integer kobo: **positive = debit, negative = credit**.
 *
 * The one invariant is Σ(lines) = 0 per journal, enforced three times over:
 *   1. here (`postJournal` refuses to build an unbalanced journal),
 *   2. in Postgres (a deferred constraint trigger, W3 migration),
 *   3. in the trial balance (`balanced` is computed, never assumed).
 *
 * ── Why signed amounts ─────────────────────────────────────────────────────
 * With separate debit/credit columns there is nothing stopping a debit of
 * −500, and every consumer re-derives direction. One signed column means
 * "the legs sum to zero" is a single `SUM`, the sign IS the direction, and a
 * counter-entry is just `-amount` (see `reverseJournal`).
 *
 * ── Units ──────────────────────────────────────────────────────────────────
 * Kobo, integers, no floats (Rule 2). The legacy documents hold whole naira;
 * `lib/money.ts` converts once at the posting boundary.
 */
import { Prisma } from "@prisma/client";
import { assertIntegerAmount, assertSignedAmount, negate, sumKobo } from "@/lib/money";
import {
  DEFAULT_CHART_OF_ACCOUNTS,
  isDebitNormal,
  type LedgerAccountTypeKey,
  type LedgerSourceTypeKey,
} from "@/lib/ledger-accounts";

/**
 * Anything that can run ledger queries: the client itself, or a transaction.
 * Every money path posts INSIDE the transaction that writes its document, so a
 * failed posting rolls the document back with it — there is no window where a
 * payment exists and the ledger has not heard about it.
 */
export type LedgerClient = Prisma.TransactionClient;

export type LedgerAccountRow = {
  id: string;
  code: string;
  name: string;
  type: LedgerAccountTypeKey;
  systemKey: string | null;
  isActive: boolean;
};

export class LedgerError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "LedgerError";
    this.code = code;
  }
}

export class LedgerImbalanceError extends LedgerError {
  readonly imbalance: number;
  constructor(imbalance: number) {
    super(
      "UNBALANCED_JOURNAL",
      `Refusing to post an unbalanced journal: debits and credits differ by ${imbalance} kobo.`,
    );
    this.name = "LedgerImbalanceError";
    this.imbalance = imbalance;
  }
}

/** A leg to post, addressed either by system key or by an explicit account id. */
export type JournalLineInput = {
  /** Provisioned account, e.g. "fees_receivable" or "expense:diesel_generator". */
  systemKey?: string;
  /** An already-resolved account id (used by reversals and manual postings). */
  accountId?: string;
  /** Signed kobo: positive = debit, negative = credit. */
  amount: number;
  memo?: string;
  studentProfileId?: string | null;
};

export type PostJournalInput = {
  schoolId: string;
  /** What a bursar reads on the statement. Required, and it must say something. */
  description: string;
  sourceType: LedgerSourceTypeKey;
  sourceId?: string | null;
  actorUserId?: string | null;
  /**
   * Rule 4. When present it is unique per school: a retried webhook, a
   * double-tapped button or a replayed queue job returns the existing journal
   * instead of posting a second one.
   */
  idempotencyKey?: string | null;
  postedAt?: Date;
  lines: JournalLineInput[];
  /** Set only by `reverseJournal`. */
  reversesJournalId?: string | null;
};

export type PostJournalResult = {
  journal: {
    id: string;
    number: string;
    description: string;
    postedAt: Date;
    sourceType: LedgerSourceTypeKey;
    sourceId: string | null;
  };
  /** True when an existing journal was returned for the same idempotency key. */
  replay: boolean;
};

const MAX_LINES_PER_JOURNAL = 100;

/** `JRN-2026-000042` — readable, per school, per year. */
export function formatJournalNumber(year: number, sequence: number): string {
  return `JRN-${year}-${String(sequence).padStart(6, "0")}`;
}

/**
 * Provision the chart of accounts for a school. Idempotent: it only ever
 * CREATES the accounts that are missing, and never touches an existing row
 * (a school may rename "Bank account" to the real bank, and that must survive
 * the next payment).
 */
export async function ensureLedgerAccounts(
  client: LedgerClient,
  schoolId: string,
): Promise<LedgerAccountRow[]> {
  const primary = await client.ledgerAccount.findMany({
    where: { schoolId },
    select: { id: true, code: true, name: true, type: true, systemKey: true, isActive: true },
  });
  const rows = primary ?? [];

  const missing = DEFAULT_CHART_OF_ACCOUNTS.filter(
    (definition) => !rows.some((row) => row.systemKey === definition.systemKey),
  );

  if (missing.length > 0) {
    await client.ledgerAccount.createMany({
      data: missing.map((definition) => ({
        schoolId,
        code: definition.code,
        name: definition.name,
        type: definition.type,
        systemKey: definition.systemKey,
      })),
      skipDuplicates: true,
    });
  }

  if (missing.length === 0) return rows.map(toAccountRow);

  const refreshed = await client.ledgerAccount.findMany({
    where: { schoolId },
    select: { id: true, code: true, name: true, type: true, systemKey: true, isActive: true },
  });
  return (refreshed ?? []).map(toAccountRow);
}

function toAccountRow(row: {
  id: string;
  code: string;
  name: string;
  type: string;
  systemKey: string | null;
  isActive: boolean;
}): LedgerAccountRow {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    type: row.type as LedgerAccountTypeKey,
    systemKey: row.systemKey,
    isActive: row.isActive,
  };
}

async function resolveAccountId(
  client: LedgerClient,
  schoolId: string,
  line: JournalLineInput,
  accounts: LedgerAccountRow[],
): Promise<string> {
  if (line.accountId) {
    const match = accounts.find((account) => account.id === line.accountId);
    if (!match) {
      throw new LedgerError(
        "UNKNOWN_ACCOUNT",
        "That ledger account does not belong to this school.",
      );
    }
    return match.id;
  }
  if (!line.systemKey) {
    throw new LedgerError(
      "ACCOUNT_REQUIRED",
      "Every ledger line needs a systemKey or an accountId.",
    );
  }
  const match = accounts.find((account) => account.systemKey === line.systemKey);
  if (!match) {
    // A category account created on demand (expense:*). Anything else means a
    // caller invented a key, and silently posting to the default account would
    // bury the money somewhere nobody looks.
    if (!line.systemKey.startsWith("expense:")) {
      throw new LedgerError(
        "UNKNOWN_ACCOUNT",
        `No ledger account is provisioned for key "${line.systemKey}".`,
      );
    }
    const created = await client.ledgerAccount.create({
      data: {
        schoolId,
        code: await nextExpenseCode(client, schoolId),
        name: line.systemKey.slice("expense:".length).replace(/_/g, " ") || "Expenses",
        type: "EXPENSE",
        systemKey: line.systemKey,
      },
      select: { id: true, code: true, name: true, type: true, systemKey: true, isActive: true },
    });
    if (!created) {
      throw new LedgerError(
        "ACCOUNT_CREATE_FAILED",
        `The ledger account for "${line.systemKey}" could not be created, so this posting was refused.`,
      );
    }
    const row = toAccountRow(created);
    accounts.push(row);
    return row.id;
  }
  return match.id;
}

/** Next free 5xxx code. The unique (schoolId, code) index is the real guard. */
async function nextExpenseCode(client: LedgerClient, schoolId: string): Promise<string> {
  const count = await client.ledgerAccount.count({ where: { schoolId, type: "EXPENSE" } });
  return String(5000 + (count ?? 0) + 1);
}

/**
 * Post one balanced journal.
 *
 * Rejects (never "fixes"): an unbalanced set of legs, a zero leg, a fractional
 * amount, an unknown account, fewer than two legs. Returns the existing journal
 * when the idempotency key has been seen before.
 */
export async function postJournal(
  client: LedgerClient,
  input: PostJournalInput,
): Promise<PostJournalResult> {
  const schoolId = input.schoolId?.trim();
  if (!schoolId) throw new LedgerError("SCHOOL_REQUIRED", "A journal needs a school.");

  const description = input.description?.trim();
  if (!description || description.length < 3) {
    throw new LedgerError(
      "DESCRIPTION_REQUIRED",
      "A journal needs a description of what happened.",
    );
  }

  if (!Array.isArray(input.lines) || input.lines.length < 2) {
    throw new LedgerError(
      "TOO_FEW_LINES",
      "Double-entry needs at least two legs: something debited and something credited.",
    );
  }
  if (input.lines.length > MAX_LINES_PER_JOURNAL) {
    throw new LedgerError(
      "TOO_MANY_LINES",
      `A journal may have at most ${MAX_LINES_PER_JOURNAL} legs.`,
    );
  }

  const amounts = input.lines.map((line, index) =>
    assertSignedAmount(line.amount, `line ${index + 1} amount`),
  );
  const imbalance = sumKobo(amounts);
  if (imbalance !== 0) throw new LedgerImbalanceError(imbalance);

  // Idempotency first: a replay must not create accounts, numbers or rows.
  const idempotencyKey = input.idempotencyKey?.trim() || null;
  if (idempotencyKey) {
    const existing = await findJournalByKey(client, schoolId, idempotencyKey);
    if (existing) return existing;
  }

  const accounts = await ensureLedgerAccounts(client, schoolId);
  if (accounts.length === 0) {
    throw new LedgerError(
      "ACCOUNTS_UNAVAILABLE",
      "The chart of accounts could not be loaded, so this posting was refused.",
    );
  }

  const accountIds: string[] = [];
  for (const line of input.lines) {
    accountIds.push(await resolveAccountId(client, schoolId, line, accounts));
  }

  const postedAt = input.postedAt ?? new Date();
  const year = postedAt.getUTCFullYear();
  const sequence =
    (await client.ledgerJournal.count({
      where: { schoolId, postedAt: { gte: new Date(Date.UTC(year, 0, 1)) } },
    })) + 1;

  try {
    const journal = await client.ledgerJournal.create({
      data: {
        schoolId,
        number: formatJournalNumber(year, sequence),
        postedAt,
        description,
        sourceType: input.sourceType,
        sourceId: input.sourceId ?? null,
        actorUserId: input.actorUserId ?? null,
        idempotencyKey,
        reversesJournalId: input.reversesJournalId ?? null,
        lines: {
          createMany: {
            data: input.lines.map((line, index) => ({
              schoolId,
              accountId: accountIds[index],
              amount: amounts[index],
              memo: line.memo?.trim() || null,
              studentProfileId: line.studentProfileId ?? null,
            })),
          },
        },
      },
      select: {
        id: true,
        number: true,
        description: true,
        postedAt: true,
        sourceType: true,
        sourceId: true,
      },
    });

    return {
      journal: {
        ...journal,
        sourceType: journal.sourceType as LedgerSourceTypeKey,
      },
      replay: false,
    };
  } catch (error) {
    // Two concurrent retries of the same webhook: one wins, the other lands on
    // the unique (schoolId, idempotencyKey) index. That is a replay, not an
    // error — return the journal the winner wrote.
    if (
      idempotencyKey &&
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002" &&
      constraintTargets(error).some((target) => target.includes("idempotencyKey"))
    ) {
      const existing = await findJournalByKey(client, schoolId, idempotencyKey);
      if (existing) return existing;
    }
    throw error;
  }
}

/** Which index a P2002 came from, across Prisma's several shapes for `meta.target`. */
function constraintTargets(error: Prisma.PrismaClientKnownRequestError): string[] {
  const target = (error.meta as { target?: unknown } | undefined)?.target;
  if (Array.isArray(target)) return target.map(String);
  if (typeof target === "string") return [target];
  return [];
}

async function findJournalByKey(
  client: LedgerClient,
  schoolId: string,
  idempotencyKey: string,
): Promise<PostJournalResult | null> {
  const existing = await client.ledgerJournal.findFirst({
    where: { schoolId, idempotencyKey },
    select: {
      id: true,
      number: true,
      description: true,
      postedAt: true,
      sourceType: true,
      sourceId: true,
    },
  });
  if (!existing) return null;
  return {
    journal: { ...existing, sourceType: existing.sourceType as LedgerSourceTypeKey },
    replay: true,
  };
}

/**
 * Reverse a journal with a counter-entry. NEVER deletes or edits: the original
 * stays on the statement and a mirrored posting (negated legs) cancels it, so
 * the audit trail reads "posted, then reversed, by whom, why".
 *
 * Refuses a second reversal (the database has a unique index on the link too)
 * and refuses to reverse a counter-entry — that would silently recreate the
 * original posting, which is not a correction any accountant asked for.
 */
export async function reverseJournal(
  client: LedgerClient,
  input: {
    schoolId: string;
    journalId: string;
    actorUserId?: string | null;
    /** Why. Required — "reversed" alone explains nothing a year later. */
    reason: string;
    idempotencyKey?: string | null;
    postedAt?: Date;
  },
): Promise<PostJournalResult> {
  const reason = input.reason?.trim();
  if (!reason) {
    throw new LedgerError("REASON_REQUIRED", "A reversal must record why it was made.");
  }

  const original = await client.ledgerJournal.findFirst({
    where: { id: input.journalId, schoolId: input.schoolId },
    select: {
      id: true,
      number: true,
      sourceType: true,
      sourceId: true,
      reversesJournalId: true,
      lines: { select: { accountId: true, amount: true, memo: true, studentProfileId: true } },
      reversedBy: { select: { id: true, number: true } },
    },
  });

  if (!original) {
    throw new LedgerError("JOURNAL_NOT_FOUND", "That journal does not exist for this school.");
  }
  if (original.reversedBy) {
    throw new LedgerError(
      "ALREADY_REVERSED",
      `Journal ${original.number} was already reversed by ${original.reversedBy.number}.`,
    );
  }
  if (original.reversesJournalId) {
    throw new LedgerError(
      "CANNOT_REVERSE_REVERSAL",
      "A counter-entry cannot be reversed. Post a new journal for the correction instead.",
    );
  }
  if (!original.lines.length) {
    throw new LedgerError(
      "EMPTY_JOURNAL",
      "That journal has no legs, so there is nothing to reverse.",
    );
  }

  try {
    return await postJournal(client, {
      schoolId: input.schoolId,
      description: `Reversal of ${original.number}: ${reason}`,
      sourceType: original.sourceType as LedgerSourceTypeKey,
      sourceId: original.sourceId,
      actorUserId: input.actorUserId ?? null,
      // The key is the identity of the REVERSAL, not the wording of the reason:
      // a retry that re-words "posted twice" as "duplicate posting" must replay
      // the same counter-entry instead of attempting a second one.
      idempotencyKey: input.idempotencyKey?.trim() || `reversal:${original.id}`,
      postedAt: input.postedAt,
      reversesJournalId: original.id,
      lines: original.lines.map((line) => ({
        accountId: line.accountId,
        amount: negate(line.amount),
        memo: line.memo ?? undefined,
        studentProfileId: line.studentProfileId,
      })),
    });
  } catch (error) {
    // Two reviewers clicked "reverse" at the same moment: the unique index on
    // `reversesJournalId` let one through. Report the other as what it is.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002" &&
      constraintTargets(error).some((target) => target.includes("reversesJournalId"))
    ) {
      throw new LedgerError(
        "ALREADY_REVERSED",
        `Journal ${original.number} has just been reversed by someone else.`,
      );
    }
    throw error;
  }
}

export type TrialBalanceRow = {
  accountId: string;
  code: string;
  name: string;
  type: LedgerAccountTypeKey;
  systemKey: string | null;
  /** Total debits posted to the account (positive kobo). */
  debits: number;
  /** Total credits posted to the account (positive kobo). */
  credits: number;
  /** Signed kobo: +debit / −credit. */
  balance: number;
  /** Balance in the account's normal direction — what a bursar expects to read. */
  displayBalance: number;
};

export type TrialBalance = {
  rows: TrialBalanceRow[];
  totals: { debits: number; credits: number; balance: number };
  /** True when every debit has a credit. A false here is a five-alarm fire. */
  balanced: boolean;
};

/**
 * Trial balance, computed from the ledger with two SQL aggregates (never by
 * loading lines into Node — a term's payments would not fit).
 */
export async function trialBalance(client: LedgerClient, schoolId: string): Promise<TrialBalance> {
  const accounts = await client.ledgerAccount.findMany({
    where: { schoolId },
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true, type: true, systemKey: true },
  });

  const [debitSums, creditSums] = await Promise.all([
    client.ledgerLine.groupBy({
      by: ["accountId"],
      where: { schoolId, amount: { gt: 0 } },
      _sum: { amount: true },
    }),
    client.ledgerLine.groupBy({
      by: ["accountId"],
      where: { schoolId, amount: { lt: 0 } },
      _sum: { amount: true },
    }),
  ]);

  const debitOf = new Map((debitSums ?? []).map((row) => [row.accountId, row._sum?.amount ?? 0]));
  const creditOf = new Map((creditSums ?? []).map((row) => [row.accountId, row._sum?.amount ?? 0]));

  const rows: TrialBalanceRow[] = (accounts ?? []).map((account) => {
    const debits = assertIntegerAmount(debitOf.get(account.id) ?? 0, "debits");
    const credits = Math.abs(assertIntegerAmount(creditOf.get(account.id) ?? 0, "credits"));
    const balance = debits - credits;
    const type = account.type as LedgerAccountTypeKey;
    return {
      accountId: account.id,
      code: account.code,
      name: account.name,
      type,
      systemKey: account.systemKey,
      debits,
      credits,
      balance,
      displayBalance: isDebitNormal(type) ? balance : Math.abs(balance) * (balance > 0 ? -1 : 1),
    };
  });

  const totals = {
    debits: sumKobo(rows.map((row) => row.debits)),
    credits: sumKobo(rows.map((row) => row.credits)),
    balance: sumKobo(rows.map((row) => row.balance)),
  };

  return { rows, totals, balanced: totals.debits === totals.credits && totals.balance === 0 };
}

/** Balance of one account, addressed by system key or id. */
export async function accountBalance(
  client: LedgerClient,
  input: { schoolId: string; systemKey?: string; accountId?: string },
): Promise<{ accountId: string; debits: number; credits: number; balance: number }> {
  const account = await findAccount(client, input);
  if (!account) {
    throw new LedgerError("ACCOUNT_NOT_FOUND", "No such ledger account for this school.");
  }

  const [debits, credits] = await Promise.all([
    client.ledgerLine.aggregate({
      where: { schoolId: input.schoolId, accountId: account.id, amount: { gt: 0 } },
      _sum: { amount: true },
    }),
    client.ledgerLine.aggregate({
      where: { schoolId: input.schoolId, accountId: account.id, amount: { lt: 0 } },
      _sum: { amount: true },
    }),
  ]);

  const debitTotal = assertIntegerAmount(debits?._sum?.amount ?? 0, "debits");
  const creditTotal = Math.abs(assertIntegerAmount(credits?._sum?.amount ?? 0, "credits"));
  return {
    accountId: account.id,
    debits: debitTotal,
    credits: creditTotal,
    balance: debitTotal - creditTotal,
  };
}

async function findAccount(
  client: LedgerClient,
  input: { schoolId: string; systemKey?: string; accountId?: string },
) {
  if (input.accountId) {
    return client.ledgerAccount.findFirst({
      where: { id: input.accountId, schoolId: input.schoolId },
      select: { id: true, code: true, name: true, type: true },
    });
  }
  if (input.systemKey) {
    return client.ledgerAccount.findFirst({
      where: { schoolId: input.schoolId, systemKey: input.systemKey },
      select: { id: true, code: true, name: true, type: true },
    });
  }
  return null;
}

export type StatementLine = {
  id: string;
  journalId: string;
  journalNumber: string;
  postedAt: Date;
  description: string;
  sourceType: LedgerSourceTypeKey;
  sourceId: string | null;
  memo: string | null;
  studentProfileId: string | null;
  amount: number;
  /** Running balance, oldest-first, including everything before the window. */
  runningBalance: number;
};

/**
 * Account statement with a running balance. `openingBalance` is the sum of
 * everything posted before the window (one SQL aggregate), so the last
 * running balance always equals `accountBalance()` — the two cannot disagree.
 */
export async function accountStatement(
  client: LedgerClient,
  input: {
    schoolId: string;
    accountId: string;
    from?: Date;
    to?: Date;
    limit?: number;
  },
): Promise<{ openingBalance: number; lines: StatementLine[]; closingBalance: number }> {
  const limit = Math.min(Math.max(input.limit ?? 200, 1), 500);
  const windowFilter = {
    schoolId: input.schoolId,
    accountId: input.accountId,
    ...(input.from || input.to
      ? {
          journal: {
            postedAt: {
              ...(input.from ? { gte: input.from } : {}),
              ...(input.to ? { lt: input.to } : {}),
            },
          },
        }
      : {}),
  };

  const openingAggregate = input.from
    ? await client.ledgerLine.aggregate({
        where: {
          schoolId: input.schoolId,
          accountId: input.accountId,
          journal: { postedAt: { lt: input.from } },
        },
        _sum: { amount: true },
      })
    : null;
  const openingBalance = assertIntegerAmount(
    openingAggregate?._sum?.amount ?? 0,
    "opening balance",
  );

  const lines = await client.ledgerLine.findMany({
    where: windowFilter,
    orderBy: { createdAt: "asc" },
    take: limit,
    select: {
      id: true,
      journalId: true,
      amount: true,
      memo: true,
      studentProfileId: true,
      journal: {
        select: {
          number: true,
          postedAt: true,
          description: true,
          sourceType: true,
          sourceId: true,
        },
      },
    },
  });

  let running = openingBalance;
  const statement: StatementLine[] = (lines ?? []).map((line) => {
    running = running + assertIntegerAmount(line.amount, "line amount");
    return {
      id: line.id,
      journalId: line.journalId,
      journalNumber: line.journal.number,
      postedAt: line.journal.postedAt,
      description: line.journal.description,
      sourceType: line.journal.sourceType as LedgerSourceTypeKey,
      sourceId: line.journal.sourceId,
      memo: line.memo,
      studentProfileId: line.studentProfileId,
      amount: line.amount,
      runningBalance: running,
    };
  });

  return { openingBalance, lines: statement, closingBalance: running };
}

/** Recent postings, for the ledger screen and the bursar dashboard. */
export async function recentJournals(
  client: LedgerClient,
  input: { schoolId: string; limit?: number; sourceType?: LedgerSourceTypeKey },
) {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);
  const journals = await client.ledgerJournal.findMany({
    where: {
      schoolId: input.schoolId,
      ...(input.sourceType ? { sourceType: input.sourceType } : {}),
    },
    orderBy: { postedAt: "desc" },
    take: limit,
    select: {
      id: true,
      number: true,
      postedAt: true,
      description: true,
      sourceType: true,
      sourceId: true,
      reversesJournalId: true,
      actorUserId: true,
      lines: {
        select: {
          id: true,
          amount: true,
          memo: true,
          studentProfileId: true,
          account: { select: { code: true, name: true, type: true } },
        },
      },
    },
  });

  return (journals ?? []).map((journal) => ({
    id: journal.id,
    number: journal.number,
    postedAt: journal.postedAt,
    description: journal.description,
    sourceType: journal.sourceType as LedgerSourceTypeKey,
    sourceId: journal.sourceId,
    reversesJournalId: journal.reversesJournalId,
    actorUserId: journal.actorUserId,
    lines: journal.lines.map((line) => ({
      id: line.id,
      amount: line.amount,
      memo: line.memo,
      studentProfileId: line.studentProfileId,
      accountCode: line.account.code,
      accountName: line.account.name,
      accountType: line.account.type as LedgerAccountTypeKey,
    })),
  }));
}
