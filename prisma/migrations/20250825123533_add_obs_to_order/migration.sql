/*
  Warnings:

  - You are about to drop the column `done` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `notes` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `qty` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `requesterEmail` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `requesterName` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `requesterSector` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `done` on the `TiTicket` table. All the data in the column will be lost.
  - You are about to drop the column `requesterEmail` on the `TiTicket` table. All the data in the column will be lost.
  - You are about to drop the column `requesterName` on the `TiTicket` table. All the data in the column will be lost.
  - You are about to drop the column `requesterSector` on the `TiTicket` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `TiTicket` table. All the data in the column will be lost.
  - Made the column `sector` on table `Order` required. This step will fail if there are existing NULL values in that column.
  - Made the column `nameOrStore` on table `Order` required. This step will fail if there are existing NULL values in that column.
  - Made the column `sector` on table `TiTicket` required. This step will fail if there are existing NULL values in that column.
  - Made the column `nameOrStore` on table `TiTicket` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "public"."Order" DROP COLUMN "done",
DROP COLUMN "notes",
DROP COLUMN "qty",
DROP COLUMN "requesterEmail",
DROP COLUMN "requesterName",
DROP COLUMN "requesterSector",
DROP COLUMN "updatedAt",
ADD COLUMN     "obs" TEXT,
ADD COLUMN     "quantity" INTEGER NOT NULL DEFAULT 1,
ALTER COLUMN "sector" SET NOT NULL,
ALTER COLUMN "nameOrStore" SET NOT NULL,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "public"."TiTicket" DROP COLUMN "done",
DROP COLUMN "requesterEmail",
DROP COLUMN "requesterName",
DROP COLUMN "requesterSector",
DROP COLUMN "updatedAt",
ALTER COLUMN "description" DROP NOT NULL,
ALTER COLUMN "sector" SET NOT NULL,
ALTER COLUMN "nameOrStore" SET NOT NULL,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);
