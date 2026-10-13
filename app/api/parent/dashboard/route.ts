import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonNoStore } from "@/lib/requests";
import { getSession } from "@/lib/session";
import { getParentPortalProfile, getStudentAttendanceMonth } from "@/lib/attendance-portal";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  // AUD-F4: an unauthenticated call used to fall through to the profile
  // lookup and answer 404 ("No live parent profile is linked…"), which is
  // indistinguishable from a genuinely unlinked account — the mobile app
  // would tell a signed-out parent "no children linked" instead of prompting
  // re-authentication. Gate on the session first: 401 = re-authenticate,
  // 404 = authenticated but no parent profile linked yet.
  const session = await getSession();
  if (!session) {
    return jsonNoStore({ error: "Unauthorized" }, { status: 401 });
  }

  const context = await getParentPortalProfile();
  if (!context) {
    return jsonNoStore(
      { error: "No live parent profile is linked to this account yet." },
      { status: 404 },
    );
  }

  const children = context.profile.studentLinks.map((link) => ({
    id: link.studentProfile.id,
    studentId: link.studentProfile.studentId,
    displayName: link.studentProfile.displayName,
    className: link.studentProfile.currentClass.displayName,
    relationship: link.relationship,
    isPrimary: link.isPrimary,
  }));

  if (!children.length) {
    return jsonNoStore({
      parent: { displayName: context.profile.displayName },
      children: [],
      selectedChild: null,
      attendance: { present: 0, absent: 0, late: 0, total: 0, attendanceRate: 0 },
      finance: { totalBilled: 0, totalPaid: 0, totalOutstanding: 0, latestInvoice: null },
      recentAlerts: [],
    });
  }

  // Honour ?studentId= so a parent with several wards can switch between
  // them. Previously this was hardcoded to children[0], so the child
  // switcher in the mobile app was purely decorative — siblings 2..n were
  // unreachable. Falls back to the first child for an absent/unknown id,
  // and the .find() over the parent's OWN links is what keeps another
  // family's student from being addressable by guessing an id.
  const requestedStudentId = request.nextUrl.searchParams.get("studentId")?.trim();
  const selectedChild = children.find((child) => child.id === requestedStudentId) || children[0];
  const attendance = await getStudentAttendanceMonth(selectedChild.id, null);

  const [recentAlerts, childInvoices] = await Promise.all([
    prisma.attendanceAlertJob.findMany({
      where: {
        schoolId: context.user.schoolId,
        studentProfileId: selectedChild.id,
        OR: [{ parentProfileId: context.profile.id }, { parentProfileId: null }],
      },
      orderBy: { createdAt: "desc" },
      take: 4,
      select: {
        id: true,
        channel: true,
        status: true,
        messagePreview: true,
        createdAt: true,
      },
    }),
    prisma.feeInvoice.findMany({
      where: {
        schoolId: context.user.schoolId,
        studentProfileId: selectedChild.id,
      },
      orderBy: [{ issuedAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        invoiceNumber: true,
        termLabel: true,
        title: true,
        status: true,
        totalAmount: true,
        amountPaid: true,
        balanceDue: true,
        dueDate: true,
        issuedAt: true,
      },
    }),
  ]);

  const latestInvoice = childInvoices[0] || null;

  return jsonNoStore({
    parent: { displayName: context.profile.displayName },
    children,
    selectedChild,
    attendance: attendance.summary,
    finance: {
      totalBilled: childInvoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0),
      totalPaid: childInvoices.reduce((sum, invoice) => sum + invoice.amountPaid, 0),
      totalOutstanding: childInvoices.reduce((sum, invoice) => sum + invoice.balanceDue, 0),
      latestInvoice: latestInvoice
        ? {
            id: latestInvoice.id,
            invoiceNumber: latestInvoice.invoiceNumber,
            termLabel: latestInvoice.termLabel,
            title: latestInvoice.title,
            status: latestInvoice.status,
            totalAmount: latestInvoice.totalAmount,
            amountPaid: latestInvoice.amountPaid,
            balanceDue: latestInvoice.balanceDue,
            dueDate: latestInvoice.dueDate?.toISOString() || null,
            issuedAt: latestInvoice.issuedAt.toISOString(),
          }
        : null,
    },
    recentAlerts: recentAlerts.map((alert) => ({
      id: alert.id,
      channel: alert.channel,
      status: alert.status,
      messagePreview: alert.messagePreview,
      createdAt: alert.createdAt.toISOString(),
    })),
  });
}
