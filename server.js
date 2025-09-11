// server.js
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const { PrismaClient } = require("@prisma/client");

const app = express();
const prisma = new PrismaClient();
const BUILD_TAG = "server-compact-v1";

// ===== ENV =====
const PORT = process.env.PORT || 10000;
const ALLOWED = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// ===== MIDDLEWARES =====
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

// ===== HELPERS =====
function pick(obj, keys) {
  const out = {};
  keys.forEach((k) => {
    if (obj[k] !== undefined) out[k] = obj[k];
  });
  return out;
}

// ===== DIAGNÓSTICOS BÁSICOS =====
app.get("/debug/version", (req, res) => {
  res.json({ build: BUILD_TAG, time: new Date().toISOString() });
});

app.get("/health", (req, res) => {
  res.json({ ok: true, now: new Date().toISOString() });
});

app.get("/health/db", async (req, res) => {
  try {
    const rows = await prisma.$queryRaw`select current_user as user, current_database() as db`;
    res.json({ ok: true, db: rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/debug/users", async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, role: true },
    });
    res.json(users);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/debug/routes", (req, res) => {
  const routes = [];
  app._router.stack.forEach((m) => {
    if (m.route && m.route.path) {
      routes.push({
        method: Object.keys(m.route.methods)[0].toUpperCase(),
        path: m.route.path,
      });
    } else if (m.name === "router" && m.handle?.stack) {
      m.handle.stack.forEach((s) => {
        if (s.route?.path) {
          routes.push({
            method: Object.keys(s.route.methods)[0].toUpperCase(),
            path: s.route.path,
          });
        }
      });
    }
  });
  res.json(routes);
});

// ===== DEBUG ESQUEMA: Tabela "Order" =====
app.get("/debug/columns/order", async (req, res) => {
  try {
    const rows = await prisma.$queryRaw`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'Order'
      ORDER BY ordinal_position
    `;
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/debug/orders/:id/raw", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id))
    return res.status(400).json({ error: "ID inválido" });
  try {
    const row = await prisma.$queryRawUnsafe(
      `SELECT * FROM "Order" WHERE id = $1`,
      id
    );
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ===== LOGIN =====
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

// ===== SETTINGS (eco simples p/ front salvar localmente) =====
app.post("/api/settings", (req, res) => {
  const sector = (req.body?.sector || "").trim();
  const nameOrStore = (req.body?.nameOrStore || "").trim();
  if (!sector || !nameOrStore) {
    return res
      .status(400)
      .json({ error: "sector e nameOrStore são obrigatórios" });
  }
  res.json({ sector, nameOrStore });
});

// ===== ORDERS (Materiais) =====
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

// GET 1 pedido (debug/uso geral)
app.get("/api/orders/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "ID inválido" });
    }
    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) return res.status(404).json({ error: "Pedido não encontrado" });
    res.json(order);
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
      payload.quantity == null ||
      !payload.sector ||
      !payload.nameOrStore
    ) {
      return res.status(400).json({
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

// PUT reforçado (único)
app.put("/api/orders/:id", async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: "ID inválido" });
  }

  console.log("[orders PUT] id =", id);
  console.log("[orders PUT] raw body =", req.body);
  console.log("[orders PUT] keys =", Object.keys(req.body || {}));

  // Somente estes campos podem mudar
  const allowed = new Set(["status", "response", "obs", "quantity"]);
  const patch = {};
  for (const [k, v] of Object.entries(req.body || {})) {
    if (allowed.has(k)) patch[k] = v;
    else console.warn("[orders PUT] Ignorando chave desconhecida:", k);
  }
  if (Object.keys(patch).length === 0) {
    return res.status(400).json({ error: "Nenhum campo válido para atualizar" });
  }

  // Normalização/validação
  if (patch.status != null) {
    const ok = ["aberto", "em_andamento", "finalizado"];
    if (!ok.includes(String(patch.status))) {
      return res.status(400).json({ error: "status inválido" });
    }
    patch.status = String(patch.status);
  }
  if (patch.response != null) patch.response = String(patch.response);
  if (patch.obs != null) patch.obs = String(patch.obs);
  if (patch.quantity != null) {
    const q = Number(patch.quantity);
    if (!Number.isFinite(q) || q < 1) {
      return res.status(400).json({ error: "quantity deve ser número >= 1" });
    }
    patch.quantity = q;
  }

  try {
    const exists = await prisma.order.findUnique({ where: { id } });
    if (!exists) return res.status(404).json({ error: "Pedido não encontrado" });

    const updated = await prisma.order.update({
      where: { id },
      data: patch,
    });
    return res.json(updated);
  } catch (e) {
    console.error("[orders PUT] ERRO Prisma/DB:", {
      id,
      patch,
      code: e.code,
      meta: e.meta,
      message: e.message,
    });
    if (e.code === "P2025")
      return res.status(404).json({ error: "Pedido não encontrado (P2025)" });
    return res.status(500).json({ error: `Falha ao atualizar pedido: ${e.message}` });
  }
});

// ===== TI TICKETS =====
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
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: "ID inválido" });
  }
  const allowed = new Set(["status", "response", "description"]);
  const patch = {};
  for (const [k, v] of Object.entries(req.body || {})) {
    if (allowed.has(k)) patch[k] = v;
    else console.warn("[tickets PUT] Ignorando chave desconhecida:", k);
  }
  if (Object.keys(patch).length === 0) {
    return res.status(400).json({ error: "Nenhum campo válido para atualizar" });
  }
  if (patch.status != null) {
    const ok = ["aberto", "em_andamento", "finalizado"];
    if (!ok.includes(String(patch.status))) {
      return res.status(400).json({ error: "status inválido" });
    }
    patch.status = String(patch.status);
  }
  if (patch.response != null) patch.response = String(patch.response);
  if (patch.description != null) patch.description = String(patch.description);

  try {
    const updated = await prisma.tiTicket.update({ where: { id }, data: patch });
    res.json(updated);
  } catch (e) {
    if (e.code === "P2025")
      return res.status(404).json({ error: "Chamado não encontrado" });
    console.error("[tickets PUT] Erro no update:", { id, patch, e });
    next(e);
  }
});

// ===== 404 / ERROR HANDLER =====
app.use((req, res) => {
  res.status(404).json({ error: "Rota não encontrada" });
});

app.use((err, req, res, next) => {
  console.error("UNCAUGHT ERROR:", err);
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || "Erro interno",
  });
});

// ===== START =====
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log("CORS whitelist:", ALLOWED.length ? ALLOWED : "*");
});
console.log("BUILD_TAG:", BUILD_TAG);
