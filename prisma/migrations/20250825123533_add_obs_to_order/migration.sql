-- Torna a migração idempotente (segura para múltiplas execuções)
-- Postgres: usa IF EXISTS / IF NOT EXISTS e normaliza tipos/constraints

-----------------------
-- Tabela: "Order"
-----------------------

-- Adiciona colunas novas se não existirem e normaliza tipos
ALTER TABLE "public"."Order"
  ADD COLUMN IF NOT EXISTS "obs" TEXT,
  ADD COLUMN IF NOT EXISTS "quantity" INTEGER,
  ALTER COLUMN "createdAt" TYPE TIMESTAMP(3);

-- Garante valor para quantity e aplica NOT NULL
UPDATE "public"."Order" SET "quantity" = 1 WHERE "quantity" IS NULL;
ALTER TABLE "public"."Order"
  ALTER COLUMN "quantity" SET NOT NULL;

-- Garante NOT NULL das colunas que precisam
ALTER TABLE "public"."Order"
  ALTER COLUMN "sector" SET NOT NULL,
  ALTER COLUMN "nameOrStore" SET NOT NULL;

-- Remove colunas antigas apenas se existirem
ALTER TABLE "public"."Order"
  DROP COLUMN IF EXISTS "done",
  DROP COLUMN IF EXISTS "notes",
  DROP COLUMN IF EXISTS "qty",
  DROP COLUMN IF EXISTS "requesterEmail",
  DROP COLUMN IF EXISTS "requesterName",
  DROP COLUMN IF EXISTS "requesterSector",
  DROP COLUMN IF EXISTS "updatedAt";


-----------------------
-- Tabela: "TiTicket"
-----------------------

-- Normaliza nulabilidade/ tipo
ALTER TABLE "public"."TiTicket"
  ALTER COLUMN "description" DROP NOT NULL,
  ALTER COLUMN "createdAt" TYPE TIMESTAMP(3);

-- Garante NOT NULL das colunas que precisam
ALTER TABLE "public"."TiTicket"
  ALTER COLUMN "sector" SET NOT NULL,
  ALTER COLUMN "nameOrStore" SET NOT NULL;

-- Remove colunas antigas apenas se existirem
ALTER TABLE "public"."TiTicket"
  DROP COLUMN IF EXISTS "done",
  DROP COLUMN IF EXISTS "requesterEmail",
  DROP COLUMN IF EXISTS "requesterName",
  DROP COLUMN IF EXISTS "requesterSector",
  DROP COLUMN IF EXISTS "updatedAt";
