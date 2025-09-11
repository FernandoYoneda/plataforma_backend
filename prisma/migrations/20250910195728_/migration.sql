-- AlterTable
ALTER TABLE "public"."Settings" ALTER COLUMN "id" SET DEFAULT 1;

-- CreateIndex
CREATE INDEX "idx_order_createdat" ON "public"."Order"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "idx_order_nameorstore" ON "public"."Order"("nameOrStore");

-- CreateIndex
CREATE INDEX "idx_order_sector" ON "public"."Order"("sector");

-- CreateIndex
CREATE INDEX "idx_order_status" ON "public"."Order"("status");

-- CreateIndex
CREATE INDEX "idx_titicket_createdat" ON "public"."TiTicket"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "idx_titicket_nameorstore" ON "public"."TiTicket"("nameOrStore");

-- CreateIndex
CREATE INDEX "idx_titicket_sector" ON "public"."TiTicket"("sector");

-- CreateIndex
CREATE INDEX "idx_titicket_status" ON "public"."TiTicket"("status");
