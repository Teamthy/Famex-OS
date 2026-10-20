import { z } from "zod";
import {
  createRecord,
  deleteRecord,
  listRecords,
  updateRecord,
  type ModuleRecord,
} from "@/lib/module-store";

const MODULE = "library_books";

export const BookSchema = z.object({
  title: z.string().trim().min(1).max(200),
  author: z.string().trim().min(1).max(200),
  isbn: z.string().trim().max(30).optional().nullable(),
  category: z.string().trim().max(60).optional().nullable(),
  copiesTotal: z.coerce.number().int().min(0).max(10_000).default(1),
  shelfLocation: z.string().trim().max(40).optional().nullable(),
});
export type Book = z.infer<typeof BookSchema>;

const LoanSchema = z.object({
  bookId: z.string().min(1),
  borrowerType: z.enum(["STUDENT", "STAFF"]),
  borrowerId: z.string().min(1),
  borrowerName: z.string().min(1),
  dueDate: z.string().min(1),
  returnedAt: z.string().nullable().optional(),
});
export type Loan = z.infer<typeof LoanSchema>;

export const listBooks = (schoolId: string) => listRecords<Book>(schoolId, MODULE);
export const addBook = (schoolId: string, data: unknown) =>
  createRecord(schoolId, MODULE, BookSchema, data);
export const updateBook = (schoolId: string, id: string, patch: unknown) =>
  updateRecord(schoolId, MODULE, BookSchema, id, patch);
export const removeBook = (schoolId: string, id: string) =>
  deleteRecord<Book>(schoolId, MODULE, id);

const LOAN_MODULE = "library_loans";
export const listLoans = (schoolId: string) => listRecords<Loan>(schoolId, LOAN_MODULE);
export const loanBook = (schoolId: string, data: unknown) =>
  createRecord(schoolId, LOAN_MODULE, LoanSchema, data);
export const returnBook = (schoolId: string, id: string) =>
  updateRecord(schoolId, LOAN_MODULE, LoanSchema, id, { returnedAt: new Date().toISOString() });

export function catalogueStats(books: Array<ModuleRecord<Book>>, loans: Array<ModuleRecord<Loan>>) {
  const totalCopies = books.reduce((s, b) => s + (b.data.copiesTotal || 0), 0);
  const outLoans = loans.filter((l) => !l.data.returnedAt).length;
  const overdue = loans.filter((l) => {
    if (l.data.returnedAt) return false;
    return new Date(l.data.dueDate) < new Date();
  }).length;
  return { titles: books.length, totalCopies, outLoans, overdue };
}
