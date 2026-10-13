-- CreateTable
CREATE TABLE "SystemFlags" (
    "id" TEXT NOT NULL,
    "maintenanceMode" BOOLEAN NOT NULL DEFAULT false,
    "maintenanceMessage" TEXT NOT NULL DEFAULT 'Ykay EduPortal is undergoing scheduled maintenance. Please try again shortly.',
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedByUserId" TEXT,

    CONSTRAINT "SystemFlags_pkey" PRIMARY KEY ("id")
);
