// server.js
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const { PrismaClient } = require("@prisma/client");

const app = express();
const prisma = new PrismaClient();

// ENV
const PORT = process.env.PORT || 10000;
const ALLOWED = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(morgan("dev"));
app.use(express.json());

// CORS
if (ALLOWED.length > 0) {
  app.use(
    cors({
      origin: function (origin, cb) {
        if (!origin) return cb(null, true); // curl/postman
        const ok = ALLOWED.includes(origin);
        cb(ok ? null : new Error("Not allowed by CORS"), ok);
      },
      credentials: true,
    })
  );
} else {
  app.use(cors());
}

// Healthcheck
app.get("/health", (req, res) => {
  res.json({ ok: true, now: new Date().toISOString() });
});

// Teste de conexão/usuário atual no banco
app.get("/health/db", async (req, res) => {
  try {
    const rows = await prisma.$queryRaw`select current_user as user, current_database() as db`;
    res.json({ ok: true, db: rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// (Opcional) Listar usuários para conferir seed (REMOVA depois!)
app.get("/debug/users", async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, role: true }
    });
    res.json(users);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * Helpers
 */
function pick(obj, keys) {
  const out = {};
  keys.forEach((k) => {
    if (obj[k] !== undefined) out[k] = obj[k];
  });
  return out;
}

/**
 * LOGIN
 */
app.post("/api/login", async (req, res, next) => {
  try {
    const email = (req.body?.email || "").trim();
    const password = (req.body?.password || "").trim();

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.password !== password) {
      return res.status(401).json({ error: "Credenciais inválidas" });
    }
    res.json({ role: user.role });
  } catch (e) {
    next(e);
  }
});

/**
 * ORDERS (Materiais)
 */
app.get("/api/orders", async (req, res, next) => {
  try {
    const { status, sector, nameOrStore, q } = req.query;

    const where = {};
    if (status) where.status = status;
    if (sector) where.sector = sector;
    if (nameOrStore) where.nameOrStore = nameOrStore;

    if (q) {
      where.OR = [
        { item: { contains: q, mode: "insensitive" } },
        { obs: { contains: q, mode: "insensitive" } },
        { response: { contains: q, mode: "insensitive" } },
      ];
    }

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    res.json(orders);
  } catch (e) {
    next(e);
  }
});

app.post("/api/orders", async (req, res, next) => {
  try {
    const payload = pick(req.body || {}, [
      "item",
      "quantity",
      "obs",
      "sector",
      "nameOrStore",
    ]);

    if (
      !payload.item ||
      !payload.quantity ||
      !payload.sector ||
      !payload.nameOrStore
    ) {
      return res
        .status(400)
        .json({
          error: "item, quantity, sector e nameOrStore são obrigatórios",
        });
    }

    const created = await prisma.order.create({
      data: {
        item: String(payload.item),
        quantity: Number(payload.quantity),
        obs: payload.obs ? String(payload.obs) : null,
        sector: String(payload.sector),
        nameOrStore: String(payload.nameOrStore),
        status: "aberto",
      },
    });

    res.status(201).json(created);
  } catch (e) {
    next(e);
  }
});

app.put("/api/orders/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const patch = pick(req.body || {}, [
      "status",
      "response",
      "obs",
      "quantity",
    ]);
    const updated = await prisma.order.update({
      where: { id },
      data: patch,
    });

    res.json(updated);
  } catch (e) {
    if (e.code === "P2025") {
      return res.status(404).json({ error: "Pedido não encontrado" });
    }
    next(e);
  }
});

/**
 * TI TICKETS
 */
app.get("/api/ti/tickets", async (req, res, next) => {
  try {
    const { status, sector, nameOrStore, q } = req.query;

    const where = {};
    if (status) where.status = status;
    if (sector) where.sector = sector;
    if (nameOrStore) where.nameOrStore = nameOrStore;
    if (q) {
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { response: { contains: q, mode: "insensitive" } },
      ];
    }

    const tickets = await prisma.tiTicket.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    res.json(tickets);
  } catch (e) {
    next(e);
  }
});

app.post("/api/ti/tickets", async (req, res, next) => {
  try {
    const payload = pick(req.body || {}, [
      "title",
      "description",
      "sector",
      "nameOrStore",
    ]);

    if (!payload.title || !payload.sector || !payload.nameOrStore) {
      return res
        .status(400)
        .json({ error: "title, sector e nameOrStore são obrigatórios" });
    }

    const created = await prisma.tiTicket.create({
      data: {
        title: String(payload.title),
        description: payload.description ? String(payload.description) : null,
        sector: String(payload.sector),
        nameOrStore: String(payload.nameOrStore),
        status: "aberto",
      },
    });

    res.status(201).json(created);
  } catch (e) {
    next(e);
  }
});

app.put("/api/ti/tickets/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const patch = pick(req.body || {}, ["status", "response", "description"]);
    const updated = await prisma.tiTicket.update({
      where: { id },
      data: patch,
    });

    res.json(updated);
  } catch (e) {
    if (e.code === "P2025") {
      return res.status(404).json({ error: "Chamado não encontrado" });
    }
    next(e);
  }
});

/**
 * 404 em JSON
 */
app.use((req, res) => {
  res.status(404).json({ error: "Rota não encontrada" });
});

/**
 * Error handler em JSON
 */
app.use((err, req, res, next) => {
  // Log básico:
  console.error("UNCAUGHT ERROR:", err);
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || "Erro interno",
  });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log("CORS whitelist:", ALLOWED.length ? ALLOWED : "*");
});
