// server.js
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const { PrismaClient } = require("@prisma/client");

const app = express();
const prisma = new PrismaClient();

const BUILD_TAG = "orders-put-guard-v3";



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

app.get("/debug/version", (req, res) => {
  res.json({ build: BUILD_TAG, time: new Date().toISOString() });
});


// Health simples
app.get("/health", (req, res) => {
  res.json({ ok: true, now: new Date().toISOString() });
});

// Health DB / debug users (mantenha só durante testes)
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

// Helpers
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

// --- Settings (eco simples, sem persistir em DB) ---
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
      return res
        .status(400)
        .json({ error: "item, quantity, sector e nameOrStore são obrigatórios" });
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

// ===== PUT /api/orders/:id (versão auditada) =====
app.put("/api/orders/:id", async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: "ID inválido" });
  }

  // LOGS que precisamos ver no terminal
  console.log("[orders PUT] id =", id);
  console.log("[orders PUT] raw body =", req.body);
  console.log("[orders PUT] keys =", Object.keys(req.body || {}));

  // Whitelist estrita
  const allowed = ["status", "response", "obs", "quantity"];
  const patch = {};
  for (const k of allowed) {
    if (req.body?.[k] !== undefined) patch[k] = req.body[k];
  }

  const unknown = Object.keys(req.body || {}).filter(k => !allowed.includes(k));
  if (unknown.length) {
    console.warn("[orders PUT] Ignorando chaves desconhecidas:", unknown);
  }
  if (Object.keys(patch).length === 0) {
    console.warn("[orders PUT] Sem campos válidos. Body=", req.body);
    return res.status(400).json({ error: "Nenhum campo válido para atualizar" });
  }

  try {
    const updated = await prisma.order.update({
      where: { id },
      data: patch,
    });
    return res.json(updated);
  } catch (e) {
    if (e.code === "P2025") {
      return res.status(404).json({ error: "Pedido não encontrado" });
    }
    console.error("[orders PUT] ERRO:", { body: req.body, patch }, e);
    return next(e);
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

app.get("/debug/routes", (req, res) => {
  const routes = [];
  app._router.stack.forEach((m) => {
    if (m.route && m.route.path) {
      routes.push({ method: Object.keys(m.route.methods)[0].toUpperCase(), path: m.route.path });
    } else if (m.name === 'router' && m.handle?.stack) {
      m.handle.stack.forEach((s) => {
        if (s.route?.path) {
          routes.push({ method: Object.keys(s.route.methods)[0].toUpperCase(), path: s.route.path });
        }
      });
    }
  });
  res.json(routes);
});

// === DIAGNÓSTICOS DE ESQUEMA (cole perto das outras rotas debug) ===

// Lista as colunas reais da tabela "Order" (atenção: maiúscula/minúscula)
app.get('/debug/columns/order', async (req, res) => {
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

// Mostra o registro "cru" do pedido (por id)
app.get('/debug/orders/:id/raw', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'ID inválido' });
  try {
    const row = await prisma.$queryRawUnsafe(`SELECT * FROM "Order" WHERE id = $1`, id);
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Versão do erro do Prisma mais detalhada
app.put('/api/orders/:id', async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'ID inválido' });

  console.log('[orders PUT] id =', id);
  console.log('[orders PUT] raw body =', req.body);
  console.log('[orders PUT] keys =', Object.keys(req.body || {}));

  const allowed = ['status', 'response', 'obs', 'quantity'];
  const patch = {};
  for (const k of allowed) if (req.body?.[k] !== undefined) patch[k] = req.body[k];

  const unknown = Object.keys(req.body || {}).filter(k => !allowed.includes(k));
  if (unknown.length) console.warn('[orders PUT] Ignorando chaves desconhecidas:', unknown);
  if (Object.keys(patch).length === 0) {
    console.warn('[orders PUT] Sem campos válidos. Body=', req.body);
    return res.status(400).json({ error: 'Nenhum campo válido para atualizar' });
  }

  try {
    const updated = await prisma.order.update({ where: { id }, data: patch });
    return res.json(updated);
  } catch (e) {
    // Log estendido do Prisma
    console.error('[orders PUT] ERRO DETALHADO:', {
      prismaCode: e.code,
      prismaMeta: e.meta,
      message: e.message,
      patch
    });
    if (e.code === 'P2025') return res.status(404).json({ error: 'Pedido não encontrado' });
    return res.status(500).json({ error: e.message });
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

  // ✅ whitelist
  const allowed = ["status", "response", "description"];
  const patch = {};
  for (const k of allowed) {
    if (req.body?.[k] !== undefined) patch[k] = req.body[k];
  }

  const unknown = Object.keys(req.body || {}).filter((k) => !allowed.includes(k));
  if (unknown.length) {
    console.warn("[tickets PUT] Ignorando chaves desconhecidas:", unknown);
  }
  if (Object.keys(patch).length === 0) {
    console.warn("[tickets PUT] Payload vazio ou inválido. Body=", req.body);
    return res.status(400).json({ error: "Nenhum campo válido para atualizar" });
  }

  try {
    const updated = await prisma.tiTicket.update({
      where: { id },
      data: patch,
    });
    res.json(updated);
  } catch (e) {
    if (e.code === "P2025") {
      return res.status(404).json({ error: "Chamado não encontrado" });
    }
    console.error("[tickets PUT] Erro no update. Body=", req.body, "Patch=", patch, e);
    next(e);
  }
});

/** 404 JSON */
app.use((req, res) => {
  res.status(404).json({ error: "Rota não encontrada" });
});

/** Error handler JSON */
app.use((err, req, res, next) => {
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

console.log("BUILD_TAG:", BUILD_TAG);
