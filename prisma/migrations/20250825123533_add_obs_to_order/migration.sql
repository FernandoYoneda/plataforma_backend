-- prisma/migrations/20250825123533_add_obs_to_order/migration.sql
-- Migração idempotente e segura para produção

BEGIN;

-- =========================
-- Tabela "Order"
-- =========================
-- Drop de colunas antigas SOMENTE se existirem
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'Order' AND column_name = 'done') THEN
    EXECUTE 'ALTER TABLE "Order" DROP COLUMN "done"';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'Order' AND column_name = 'notes') THEN
    EXECUTE 'ALTER TABLE "Order" DROP COLUMN "notes"';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'Order' AND column_name = 'qty') THEN
    EXECUTE 'ALTER TABLE "Order" DROP COLUMN "qty"';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'Order' AND column_name = 'requesterEmail') THEN
    EXECUTE 'ALTER TABLE "Order" DROP COLUMN "requesterEmail"';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'Order' AND column_name = 'requesterName') THEN
    EXECUTE 'ALTER TABLE "Order" DROP COLUMN "requesterName"';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'Order' AND column_name = 'requesterSector') THEN
    EXECUTE 'ALTER TABLE "Order" DROP COLUMN "requesterSector"';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'Order' AND column_name = 'updatedAt') THEN
    EXECUTE 'ALTER TABLE "Order" DROP COLUMN "updatedAt"';
  END IF;
END $$;

-- Criações/ajustes seguros
ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "obs" TEXT;

ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "quantity" INTEGER;

-- Se a coluna quantity existir mas estiver nula, defina default e preencha
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'Order' AND column_name = 'quantity') THEN
    EXECUTE 'ALTER TABLE "Order" ALTER COLUMN "quantity" SET DEFAULT 1';
    EXECUTE 'UPDATE "Order" SET "quantity" = 1 WHERE "quantity" IS NULL';
  END IF;
END $$;

ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "status" TEXT;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'Order' AND column_name = 'status') THEN
    EXECUTE 'ALTER TABLE "Order" ALTER COLUMN "status" SET DEFAULT ''aberto''';
    EXECUTE 'UPDATE "Order" SET "status" = ''aberto'' WHERE "status" IS NULL';
  END IF;
END $$;

ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "sector" TEXT;

ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "nameOrStore" TEXT;

ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ;

-- Ajusta tipo de createdAt para TIMESTAMPTZ e garante valor
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'Order' AND column_name = 'createdAt') THEN
    -- Converte para timestamptz de forma segura
    EXECUTE 'ALTER TABLE "Order" ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ USING CASE WHEN "createdAt" IS NULL THEN NOW() ELSE "createdAt"::timestamptz END';
    EXECUTE 'ALTER TABLE "Order" ALTER COLUMN "createdAt" SET DEFAULT NOW()';
    EXECUTE 'UPDATE "Order" SET "createdAt" = NOW() WHERE "createdAt" IS NULL';
  END IF;
END $$;

-- NÃO fazemos SET NOT NULL agora (evita falhas em produção).
-- Se quiser travar depois:
-- ALTER TABLE "Order" ALTER COLUMN "sector" SET NOT NULL;
-- ALTER TABLE "Order" ALTER COLUMN "nameOrStore" SET NOT NULL;
-- ALTER TABLE "Order" ALTER COLUMN "quantity" SET NOT NULL;
-- ALTER TABLE "Order" ALTER COLUMN "status" SET NOT NULL;
-- ALTER TABLE "Order" ALTER COLUMN "createdAt" SET NOT NULL;


-- =========================
-- Tabela "TiTicket"
-- =========================
-- Drop de colunas antigas SOMENTE se existirem
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'TiTicket' AND column_name = 'done') THEN
    EXECUTE 'ALTER TABLE "TiTicket" DROP COLUMN "done"';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'TiTicket' AND column_name = 'requesterEmail') THEN
    EXECUTE 'ALTER TABLE "TiTicket" DROP COLUMN "requesterEmail"';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'TiTicket' AND column_name = 'requesterName') THEN
    EXECUTE 'ALTER TABLE "TiTicket" DROP COLUMN "requesterName"';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'TiTicket' AND column_name = 'requesterSector') THEN
    EXECUTE 'ALTER TABLE "TiTicket" DROP COLUMN "requesterSector"';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'TiTicket' AND column_name = 'updatedAt') THEN
    EXECUTE 'ALTER TABLE "TiTicket" DROP COLUMN "updatedAt"';
  END IF;
END $$;

-- Deixa description opcional (não obriga a existir nem NOT NULL)
-- (Se a coluna existe, apenas garantimos que pode ser nula)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'TiTicket' AND column_name = 'description') THEN
    -- Algumas versões podem precisar de um truque, mas tentar drop not null:
    BEGIN
      EXECUTE 'ALTER TABLE "TiTicket" ALTER COLUMN "description" DROP NOT NULL';
    EXCEPTION WHEN OTHERS THEN
      -- ignora se já não tem NOT NULL
      NULL;
    END;
  END IF;
END $$;

ALTER TABLE "TiTicket"
  ADD COLUMN IF NOT EXISTS "status" TEXT;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'TiTicket' AND column_name = 'status') THEN
    EXECUTE 'ALTER TABLE "TiTicket" ALTER COLUMN "status" SET DEFAULT ''aberto''';
    EXECUTE 'UPDATE "TiTicket" SET "status" = ''aberto'' WHERE "status" IS NULL';
  END IF;
END $$;

ALTER TABLE "TiTicket"
  ADD COLUMN IF NOT EXISTS "sector" TEXT;

ALTER TABLE "TiTicket"
  ADD COLUMN IF NOT EXISTS "nameOrStore" TEXT;

ALTER TABLE "TiTicket"
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'TiTicket' AND column_name = 'createdAt') THEN
    EXECUTE 'ALTER TABLE "TiTicket" ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ USING CASE WHEN "createdAt" IS NULL THEN NOW() ELSE "createdAt"::timestamptz END';
    EXECUTE 'ALTER TABLE "TiTicket" ALTER COLUMN "createdAt" SET DEFAULT NOW()';
    EXECUTE 'UPDATE "TiTicket" SET "createdAt" = NOW() WHERE "createdAt" IS NULL';
  END IF;
END $$;

-- Também não aplicamos SET NOT NULL agora.

COMMIT;
