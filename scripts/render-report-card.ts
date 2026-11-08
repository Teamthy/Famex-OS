/**
 * Render the printable report card to PNG, without a browser or a database.
 *
 * The sheet in `components/ReportCardSheet.tsx` is HTML and is printed by the
 * browser, so its real output is only visible in a browser. This script draws
 * the same layout — same measurements, same palette, same field positions —
 * straight to SVG and rasterises it with sharp, so the format can be checked
 * and shown to a school for sign-off in CI, on a laptop, or in a sandbox with
 * no headless Chrome.
 *
 * It is a *picture of the format*, not a PDF generator: nothing here is served
 * to users. If the CSS and this script disagree about a measurement, the CSS
 * is authoritative and this file is the thing that is wrong.
 *
 *   npx tsx scripts/render-report-card.ts [out.png]
 */
import { writeFileSync } from "node:fs";
import sharp from "sharp";

const W = 794; // A4 @96dpi
const H = 1123;
const M = 57; // 15mm margin
const CW = W - M * 2;
const NAVY = "#0c1824";
const INK = "#111827";
const MUTED = "#4b5563";
const AMBER = "#f6b73c";
const GREEN = "#4ec54d";

const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;");
const out: string[] = [];

function text(
  x: number,
  y: number,
  s: string,
  opts: {
    size?: number;
    weight?: number;
    fill?: string;
    anchor?: "start" | "middle" | "end";
    spacing?: number;
    italic?: boolean;
  } = {},
) {
  const { size = 13, weight = 400, fill = INK, anchor = "start", spacing = 0, italic } = opts;
  out.push(
    `<text x="${x}" y="${y}" font-family="Helvetica,Arial,sans-serif" font-size="${size}"` +
      ` font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" letter-spacing="${spacing}"` +
      `${italic ? ' font-style="italic"' : ""}>${esc(s)}</text>`,
  );
}
function line(x1: number, y1: number, x2: number, y2: number, stroke = INK, w = 1, dash = "") {
  out.push(
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${w}"` +
      `${dash ? ` stroke-dasharray="${dash}"` : ""}/>`,
  );
}
function rect(x: number, y: number, w: number, h: number, fill = "none", stroke = INK, sw = 1) {
  out.push(
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`,
  );
}

/* Representative data only — chosen to exercise every column, including a
   grade band on each side of the pass mark. */
const SAMPLE = {
  school: "FAMEX INTERNATIONAL SCHOOLS",
  motto: "Raising Role Models",
  contact:
    "12 Adeola Odeku Street, Victoria Island, Lagos  ·  +234 701 537 4411  ·  info@famex.school",
  student: "CHIDERA OKONKWO",
  studentId: "FIS/2026/0148",
  className: "JSS 2A",
  term: "First Term",
  year: "2025/2026",
  reportNumber: "RC/2026/T1/FIS-0148",
  subjects: [
    ["Mathematics", 79, "A"],
    ["English Language", 71, "B"],
    ["Basic Science", 76, "A"],
    ["Social Studies", 64, "C"],
    ["Computer Studies", 84, "A"],
  ] as Array<[string, number, string]>,
  total: 374,
  average: 75,
  grade: "A",
  position: "3rd of 42",
  present: 58,
  absent: 2,
  late: 1,
  comment:
    "Chidera has had an excellent term. Her work in Mathematics and Computer Studies is outstanding, and she has been a steady influence on her group.",
  nextResumption: "12 January 2026",
  verificationCode: "rc_K7pQ2mXvB9nL4tRs8wYzA3",
  verifyUrl: "https://portal.famex.school/verify/report/rc_K7pQ2mXvB9nL4tRs8wYzA3",
  feeBalance: 0,
};

let y = M;

// ── Letterhead ────────────────────────────────────────────────────────────
text(M, y + 14, SAMPLE.school, { size: 23, weight: 800, fill: NAVY, spacing: 0.4 });
y += 22;
text(M, y + 12, SAMPLE.motto, { size: 11, italic: true, fill: MUTED });
y += 16;
text(M, y + 10, SAMPLE.contact, { size: 9.5, fill: MUTED });
y += 16;
line(M, y, W - M, y, NAVY, 2.5);
y += 34;

// ── Title ─────────────────────────────────────────────────────────────────
text(W / 2, y, "STUDENT PROGRESS REPORT", {
  size: 24,
  weight: 800,
  fill: GREEN,
  anchor: "middle",
  spacing: 1,
});
y += 34;

// ── Student details ───────────────────────────────────────────────────────
text(M, y, "STUDENT DETAILS", { size: 13, weight: 800, fill: NAVY, spacing: 0.8 });
const colW = (CW - 34) / 2;
const col2 = M + colW + 34;
function field(x: number, yy: number, label: string, value: string, w: number) {
  text(x, yy, `${label}:`, { size: 12 });
  const vx = x + label.length * 6.4 + 14;
  if (value) text(vx + 3, yy, value, { size: 12, weight: 700 });
  line(vx, yy + 3, x + w, yy + 3, "#6b7280", 0.8, "1.5,2");
}
y += 16;
field(M, y, "Name", SAMPLE.student, colW);
field(col2, y, "Student ID", SAMPLE.studentId, colW);
y += 26;
field(M, y, "Grade", SAMPLE.className, colW);
field(col2, y, "Term", SAMPLE.term, colW);
y += 26;
field(M, y, "Academic Year", SAMPLE.year, colW);
field(col2, y, "Report No.", SAMPLE.reportNumber, colW);
y += 30;

// ── Academic performance ──────────────────────────────────────────────────
text(M, y, "ACADEMIC PERFORMANCE", { size: 13, weight: 800, fill: NAVY, spacing: 0.8 });
y += 12;
const widths = [0.34, 0.13, 0.12, 0.41];
const xs: number[] = [];
let cx = M;
for (const w of widths) {
  xs.push(cx);
  cx += w * CW;
}
const rowH = 30; // 8mm at 96dpi
const headH = 34;
const tableTop = y;
rect(M, y, CW, headH, AMBER, AMBER, 0);
for (let i = 1; i < 4; i++) line(xs[i], y, xs[i], y + headH, INK, 1);
text(xs[0] + 8, y + 22, "Subject", { size: 11, weight: 700, fill: NAVY });
text(xs[1] + (widths[1] * CW) / 2, y + 22, "Score", {
  size: 11,
  weight: 700,
  fill: NAVY,
  anchor: "middle",
});
text(xs[2] + (widths[2] * CW) / 2, y + 22, "Grade", {
  size: 11,
  weight: 700,
  fill: NAVY,
  anchor: "middle",
});
text(xs[3] + 8, y + 22, "Remarks", { size: 11, weight: 700, fill: NAVY });
y += headH;
for (const [name, total, grade] of SAMPLE.subjects) {
  // Full grid: the form's rows are ruled, not just its columns. Without the
  // top rule each row runs into the one above it.
  line(M, y, W - M, y, INK, 0.8);
  for (let i = 1; i < 4; i++) line(xs[i], y, xs[i], y + rowH, INK, 1);
  text(xs[0] + 8, y + 20, name, { size: 12, weight: 600 });
  text(xs[1] + (widths[1] * CW) / 2, y + 20, String(total), { size: 12, anchor: "middle" });
  text(xs[2] + (widths[2] * CW) / 2, y + 20, grade, { size: 12, weight: 700, anchor: "middle" });
  y += rowH;
}
// The form is ruled to five lines; fill the remainder so a short term still
// produces a usable sheet.
for (let i = SAMPLE.subjects.length; i < 5; i++) {
  line(M, y, W - M, y, INK, 0.8);
  for (let c = 1; c < 4; c++) line(xs[c], y, xs[c], y + rowH, INK, 1);
  y += rowH;
}
rect(M, tableTop, CW, y - tableTop, "none", INK, 1);
y += 12;

const summary: Array<[string, string]> = [
  ["Total", String(SAMPLE.total)],
  ["Average", `${SAMPLE.average}%`],
  ["Overall Grade", SAMPLE.grade],
  ["Position", SAMPLE.position],
];
let sx = M;
for (const [label, value] of summary) {
  text(sx, y, `${label}:`, { size: 11.5, weight: 700 });
  const vx = sx + label.length * 6.9 + 9;
  text(vx, y, value, { size: 11.5 });
  sx = vx + value.length * 7.4 + 36;
}
y += 12;
line(M, y, W - M, y, "#9ca3af", 0.8);
y += 30;

// ── Attendance + comments ─────────────────────────────────────────────────
const leftW = CW * 0.42;
const rightX = M + leftW + 34;
const rightW = W - M - rightX;
text(M, y, "ATTENDANCE SUMMARY", { size: 13, weight: 800, fill: NAVY, spacing: 0.8 });
text(rightX, y, "TEACHER COMMENTS", { size: 13, weight: 800, fill: NAVY, spacing: 0.8 });
field(M, y + 20, "Present", String(SAMPLE.present), leftW);
field(M, y + 46, "Absent", String(SAMPLE.absent), leftW);
field(M, y + 72, "Late", String(SAMPLE.late), leftW);

rect(rightX, y + 8, rightW, 100, "none", INK, 1);
for (let i = 1; i < 5; i++)
  line(rightX, y + 8 + i * 20, rightX + rightW, y + 8 + i * 20, "#d1d5db", 0.6);
// Wrap the comment to the box: the real sheet lets the browser do this.
const maxChars = Math.floor(rightW / 5.4);
const words = SAMPLE.comment.split(" ");
const lines: string[] = [];
let current = "";
for (const word of words) {
  if ((current + " " + word).trim().length > maxChars) {
    lines.push(current.trim());
    current = word;
  } else {
    current = `${current} ${word}`;
  }
}
if (current.trim()) lines.push(current.trim());
lines.slice(0, 5).forEach((l, i) => text(rightX + 8, y + 26 + i * 15, l, { size: 10.5 }));
y += 118;

// ── Signatures ────────────────────────────────────────────────────────────
text(M, y, "SIGNATURES", { size: 13, weight: 800, fill: NAVY, spacing: 0.8 });
y += 52;
line(M, y, M + colW, y, INK, 1);
line(col2, y, col2 + colW, y, INK, 1);
y += 14;
text(M, y, "Class Teacher", { size: 11, fill: "#374151" });
text(col2, y, "Parent / Guardian", { size: 11, fill: "#374151" });
y += 26;
text(M, y, `Next term begins: ${SAMPLE.nextResumption}`, { size: 11 });

// ── Verification (pinned to the foot) ─────────────────────────────────────
y = H - M - 78;
line(M, y, W - M, y, "#9ca3af", 0.8);
y += 16;
const qs = 62;
rect(M, y, qs, qs, "none", "#d1d5db", 0.8);
const finder = (fx: number, fy: number) => {
  rect(fx, fy, 18, 18, INK, INK, 0);
  rect(fx + 4, fy + 4, 10, 10, "#fff", "#fff", 0);
  rect(fx + 7, fy + 7, 4, 4, INK, INK, 0);
};
finder(M + 6, y + 6);
finder(M + qs - 24, y + 6);
finder(M + 6, y + qs - 24);
for (let i = 0; i < 26; i++) {
  const px = M + 6 + ((i * 13) % (qs - 14));
  const py = y + 28 + ((i * 7) % (qs - 34));
  rect(px, py, 3, 3, INK, INK, 0);
}
text(M + qs + 16, y + 16, "VERIFY THIS DOCUMENT", {
  size: 9.5,
  weight: 700,
  fill: NAVY,
  spacing: 0.8,
});
text(M + qs + 16, y + 32, SAMPLE.verificationCode, { size: 11, weight: 700 });
text(M + qs + 16, y + 46, SAMPLE.verifyUrl, { size: 8, fill: "#374151" });
text(W - M, y + 32, SAMPLE.feeBalance > 0 ? "Balance outstanding" : "Fees fully paid", {
  size: 10.5,
  weight: 700,
  anchor: "end",
});

const svg =
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
  `<rect width="${W}" height="${H}" fill="#fff"/>${out.join("")}</svg>`;

const target = process.argv[2] || "report-card-format.png";
await sharp(Buffer.from(svg)).png().toFile(target);
writeFileSync(`${target}.svg`, svg);
console.log(`Wrote ${target} and ${target}.svg — the report card format, A4 at 96dpi.`);
