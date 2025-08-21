/*
  Warnings:

  - You are about to drop the column `role` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `createdBy` on the `TiTicket` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `TiTicket` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Order" DROP COLUMN "role",
ADD COLUMN     "done" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requesterEmail" TEXT,
ADD COLUMN     "requesterName" TEXT,
ADD COLUMN     "requesterSector" TEXT,
ADD COLUMN     "response" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'aberto',
ADD COLUMN     "updatedAt" TIMESTAMPTZ(6) NOT NULL,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "public"."Settings" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."TiTicket" DROP COLUMN "createdBy",
ADD COLUMN     "done" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requesterEmail" TEXT,
ADD COLUMN     "requesterName" TEXT,
ADD COLUMN     "requesterSector" TEXT,
ADD COLUMN     "response" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMPTZ(6) NOT NULL,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(6);
