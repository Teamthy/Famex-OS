import { SubjectCategory } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { assignStudentSubjects, resolveTeacherSubjects } from "@/lib/enrolment-subjects";

/**
 * Bridging a teacher's free-text subject to the subject catalogue.
 *
 * TeacherClassAssignment.subjectName is what an administrator typed into a box.
 * StudentSubject.subjectId is a foreign key. Everything about "tick this
 * teacher's subject for this student" depends on that bridge, so the matching
 * rules are pinned here: case, whitespace, codes, level, and — most
 * importantly — that an ambiguous match is REPORTED rather than guessed.
 */

type Assignment = {
  id: string;
  classId: string;
  subjectName: string | null;
  classroom: { level: string };
};
type Subject = { id: string; name: string; code: string | null; level: string; category: SubjectCategory };

/** Minimal stand-in for a Prisma transaction delegate. */
function fakeTx(assignments: Assignment[], subjects: Subject[]) {
  return {
    teacherClassAssignment: { findMany: async () => assignments },
    subject: {
      findMany: async (args: { where: { level?: { in: string[] } } }) => {
        const levels = args.where.level?.in;
        return levels ? subjects.filter((s) => levels.includes(s.level)) : subjects;
      },
    },
  } as never;
}

const JSS1 = "JSS1";
const SS1 = "SS1";

function catalogue(): Subject[] {
  return [
    { id: "mth-j1", name: "Mathematics", code: "MTH", level: JSS1, category: SubjectCategory.COMPULSORY },
    { id: "eng-j1", name: "English Language", code: "ENG", level: JSS1, category: SubjectCategory.COMPULSORY },
    { id: "frm-j1", name: "Further Mathematics", code: "FMTH", level: JSS1, category: SubjectCategory.ELECTIVE },
    { id: "mth-s1", name: "Mathematics", code: "MTH", level: SS1, category: SubjectCategory.COMPULSORY },
  ];
}

async function resolve(typed: string, level = JSS1) {
  const tx = fakeTx(
    [{ id: "a1", classId: "c1", subjectName: typed, classroom: { level } }],
    catalogue(),
  );
  const [result] = await resolveTeacherSubjects(tx, { schoolId: "s1", teacherProfileId: "t1" });
  return result;
}

describe("resolveTeacherSubjects", () => {
  it("matches an exact name", async () => {
    const result = await resolve("Mathematics");
    expect(result.subjectId).toBe("mth-j1");
    expect(result.ambiguous).toBe(false);
  });

  it("matches regardless of case", async () => {
    expect((await resolve("mathematics")).subjectId).toBe("mth-j1");
    expect((await resolve("MATHEMATICS")).subjectId).toBe("mth-j1");
  });

  it("matches regardless of extra whitespace", async () => {
    // The single most common way a hand-typed subject fails to match.
    expect((await resolve("  Mathematics  ")).subjectId).toBe("mth-j1");
    expect((await resolve("English   Language")).subjectId).toBe("eng-j1");
  });

  it("matches the subject code, because admins do type MTH", async () => {
    expect((await resolve("MTH")).subjectId).toBe("mth-j1");
    expect((await resolve("mth")).subjectId).toBe("mth-j1");
  });

  it("resolves against the level of the class, not the whole catalogue", async () => {
    // Mathematics exists for JSS1 and SS1. A JSS1 teacher must get the JSS1 row.
    expect((await resolve("Mathematics", JSS1)).subjectId).toBe("mth-j1");
    expect((await resolve("Mathematics", SS1)).subjectId).toBe("mth-s1");
  });

  it("resolves a unique prefix without guessing between two rows", async () => {
    expect((await resolve("Further Math")).subjectId).toBe("frm-j1");
  });

  it("resolves a unique abbreviation, because that is a real convenience", async () => {
    // "Math" prefixes only Mathematics at this level, so it resolves.
    const result = await resolve("Math");
    expect(result.subjectId).toBe("mth-j1");
    expect(result.ambiguous).toBe(false);
  });

  it("reports an ambiguous match instead of picking one", async () => {
    // Two catalogue rows share the prefix "Computer". Choosing the first
    // returned would silently put the wrong subject on the child's record, so
    // the assignment is reported as ambiguous and left for a human.
    const tx = fakeTx(
      [{ id: "a1", classId: "c1", subjectName: "Computer", classroom: { level: JSS1 } }],
      [
        ...catalogue(),
        { id: "csc-j1", name: "Computer Science", code: "CSC", level: JSS1, category: SubjectCategory.ELECTIVE },
        { id: "cst-j1", name: "Computer Studies", code: "CST", level: JSS1, category: SubjectCategory.ELECTIVE },
      ],
    );
    const [result] = await resolveTeacherSubjects(tx, { schoolId: "s1", teacherProfileId: "t1" });
    expect(result.subjectId).toBeNull();
    expect(result.ambiguous).toBe(true);
  });

  it("reports a subject that is not in the catalogue at all", async () => {
    const result = await resolve("Astrophysics");
    expect(result.subjectId).toBeNull();
    expect(result.ambiguous).toBe(false);
  });

  it("keeps what the admin typed so the UI can name it", async () => {
    const result = await resolve("Astrophysics");
    expect(result.typed).toBe("Astrophysics");
  });

  it("returns nothing when the teacher has no subject assignments", async () => {
    const tx = fakeTx([], catalogue());
    const result = await resolveTeacherSubjects(tx, { schoolId: "s1", teacherProfileId: "t1" });
    expect(result).toEqual([]);
  });
});

describe("assignStudentSubjects", () => {
  function assignTx(subjects: Subject[], existing: Array<{ subjectId: string; isActive: boolean }> = []) {
    const created: string[] = [];
    const tx = {
      subject: {
        findMany: async (args: { where: { id?: { in: string[] } } }) => {
          const ids = args.where.id?.in;
          return subjects
            .filter((s) => s.level === JSS1 && (!ids || ids.includes(s.id)))
            .map((s) => ({ id: s.id, name: s.name, category: s.category }));
        },
      },
      studentSubject: {
        findMany: async () => existing,
        createMany: async () => ({ count: 0 }),
        upsert: async (args: { create: { subjectId: string } }) => {
          created.push(args.create.subjectId);
          return {};
        },
      },
      __created: created,
    };
    return tx as unknown as never;
  }

  it("assigns the requested subjects", async () => {
    const tx = assignTx(catalogue());
    const result = await assignStudentSubjects(tx, {
      schoolId: "s1",
      studentProfileId: "st1",
      level: JSS1,
      subjectIds: ["mth-j1", "eng-j1"],
    });
    expect(result.assigned).toBe(2);
    expect(result.rejected).toEqual([]);
  });

  it("reports ids that are not at the student's level rather than assigning them", async () => {
    const tx = assignTx(catalogue());
    const result = await assignStudentSubjects(tx, {
      schoolId: "s1",
      studentProfileId: "st1",
      level: JSS1,
      // mth-s1 is the SS1 Mathematics row: a stale form must not enrol a JSS1
      // student in an SS1 subject.
      subjectIds: ["mth-j1", "mth-s1"],
    });
    expect(result.assigned).toBe(1);
    expect(result.rejected).toEqual(["mth-s1"]);
  });

  it("counts an already-active subject as present, not assigned", async () => {
    const tx = assignTx(catalogue(), [{ subjectId: "mth-j1", isActive: true }]);
    const result = await assignStudentSubjects(tx, {
      schoolId: "s1",
      studentProfileId: "st1",
      level: JSS1,
      subjectIds: ["mth-j1"],
    });
    expect(result.assigned).toBe(0);
    expect(result.alreadyPresent).toBe(1);
  });

  it("reactivates a subject that was dropped earlier", async () => {
    // The row still exists with isActive=false. Creating it again would violate
    // the (studentProfileId, subjectId) unique constraint; it must be upserted.
    const tx = assignTx(catalogue(), [{ subjectId: "mth-j1", isActive: false }]);
    const result = await assignStudentSubjects(tx, {
      schoolId: "s1",
      studentProfileId: "st1",
      level: JSS1,
      subjectIds: ["mth-j1"],
    });
    expect(result.assigned).toBe(1);
    expect(result.alreadyPresent).toBe(0);
  });

  it("does nothing when no subjects are requested", async () => {
    const tx = assignTx(catalogue());
    const result = await assignStudentSubjects(tx, {
      schoolId: "s1",
      studentProfileId: "st1",
      level: JSS1,
      subjectIds: [],
    });
    expect(result).toEqual({ assigned: 0, alreadyPresent: 0, rejected: [] });
  });

  it("is safe to re-run with the same input", async () => {
    // Enrolment is retried on a lost response; the second run must not double
    // up or throw.
    const tx = assignTx(catalogue());
    const params = {
      schoolId: "s1",
      studentProfileId: "st1",
      level: JSS1,
      subjectIds: ["mth-j1"],
    };
    expect((await assignStudentSubjects(tx, params)).assigned).toBe(1);
  });
});
