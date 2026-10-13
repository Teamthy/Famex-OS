import { ApplicationStatus, PaymentStatus, Prisma } from "@prisma/client";
import { APPLICATION_FEE_KOBO, type AdmissionDraft } from "@/lib/admissions";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/security";
import { getSchool } from "@/lib/school";

export async function findAuthorizedApplication(applicationId: string, uploadToken: string) {
  const application = await prisma.admissionApplication.findUnique({
    where: { applicationId },
    include: { documents: true, payment: true },
  });

  if (
    !application ||
    !application.uploadTokenHash ||
    !application.uploadTokenExpiresAt ||
    application.uploadTokenExpiresAt < new Date() ||
    application.uploadTokenHash !== hashToken(uploadToken)
  ) {
    return null;
  }

  return application;
}

export function admissionDraftToData(draft: AdmissionDraft) {
  return {
    firstName: draft.firstName,
    middleName: draft.middleName,
    lastName: draft.lastName,
    dateOfBirth: new Date(`${draft.dateOfBirth}T12:00:00.000Z`),
    gender: draft.gender,
    stateOfOrigin: draft.stateOfOrigin,
    lga: draft.lga,
    religion: draft.religion,
    bloodGroup: draft.bloodGroup,
    genotype: draft.genotype,
    classApplying: draft.classApplying,
    preferredArm: draft.preferredArm,
    fatherName: draft.fatherName,
    motherName: draft.motherName,
    guardianName: draft.guardianName,
    guardianRelationship: draft.guardianRelationship,
    primaryContact: draft.primaryContact,
    parentPhone: draft.parentPhone,
    whatsappPhone: draft.whatsappPhone,
    parentEmail: draft.parentEmail,
    parentAddress: draft.parentAddress,
    occupation: draft.occupation,
    previousSchool: draft.previousSchool,
    previousClass: draft.previousClass,
    reasonForLeaving: draft.reasonForLeaving,
    achievements: draft.achievements,
  };
}

export async function updateDraft(applicationId: string, draft: AdmissionDraft) {
  return prisma.admissionApplication.update({
    where: { applicationId },
    data: admissionDraftToData(draft),
  });
}

export async function getRequiredDocumentTypes() {
  return ["BIRTH_CERTIFICATE", "PASSPORT_PHOTO", "REPORT_CARD"] as const;
}

export async function markApplicationPaid(
  applicationId: string,
  reference: string,
  providerData: Prisma.InputJsonValue,
) {
  return prisma.$transaction(async (tx) => {
    const application = await tx.admissionApplication.update({
      where: { applicationId },
      data: {
        paymentStatus: PaymentStatus.PAID,
        paymentReference: reference,
      },
    });

    await tx.paymentTransaction.upsert({
      where: { applicationId },
      create: {
        applicationId: application.id,
        reference,
        amountKobo: APPLICATION_FEE_KOBO,
        status: PaymentStatus.PAID,
        paidAt: new Date(),
        providerData,
      },
      update: {
        reference,
        status: PaymentStatus.PAID,
        paidAt: new Date(),
        providerData,
      },
    });

    return application;
  });
}

export async function writeAdmissionAuditLog(input: {
  schoolId: string;
  action: string;
  entityId?: string;
  ipAddress?: string;
  metadata?: Prisma.InputJsonValue;
}) {
  return prisma.auditLog.create({
    data: {
      schoolId: input.schoolId,
      action: input.action,
      entityType: "AdmissionApplication",
      entityId: input.entityId,
      ipAddress: input.ipAddress,
      metadata: input.metadata,
    },
  });
}

export async function getApplicationForStatus(applicationId: string) {
  const school = await getSchool();
  return prisma.admissionApplication.findFirst({
    where: {
      schoolId: school.id,
      applicationId,
      status: { not: ApplicationStatus.DRAFT },
    },
    select: {
      applicationId: true,
      firstName: true,
      lastName: true,
      classApplying: true,
      status: true,
      statusNote: true,
      submittedAt: true,
      paymentStatus: true,
    },
  });
}
