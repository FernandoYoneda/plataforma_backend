// server.js
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const { PrismaClient } = require("@prisma/client");

const app = express();
const prisma = new PrismaClient();

const PORT = process.env.PORT || 10000;
const ALLOWED = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// CORS
const corsOptions = {
  origin: function (origin, cb) {
    if (!origin) return cb(null, true); // allow curl/postman
    if (ALLOWED.length === 0) return cb(null, true);
    if (ALLOWED.includes(origin)) return cb(null, true);
    cb(new Error("Not allowed by CORS"));
  },
  credentials: true,
};
app.use(cors(corsOptions));

// Middlewares
app.use(express.json());
app.use(morgan("combined"));

// Helper: resposta de erro sempre em JSON
function sendError(res, status, message) {
  res.status(status).json({ error: message || "Erro" });
}

// -------------------- AUTH --------------------
app.post("/api/login", async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim();
    const password = String(req.body?.password || "").trim();

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.password !== password) {
      return sendError(res, 401, "Credenciais inválidas");
    }
    res.json({ role: user.role });
  } catch (e) {
    console.error("LOGIN ERROR:", e);
    return sendError(res, 500, "Falha no login");
  }
});

// -------------------- SETTINGS --------------------
let cachedSettings = { sector: "", nameOrStore: "" };

app.get("/api/settings", (req, res) => {
  res.json(cachedSettings);
});

app.post("/api/settings", (req, res) => {
  const sector = String(req.body?.sector || "").trim();
  const nameOrStore = String(req.body?.nameOrStore || "").trim();
  cachedSettings = { sector, nameOrStore };
  res.json(cachedSettings);
});

// -------------------- ORDERS (Materiais) --------------------
// GET /api/orders?status=&sector=&nameOrStore=&q=&page=&pageSize=
app.get("/api/orders", async (req, res) => {
  try {
    const {
      status,
      sector,
      nameOrStore,
      q = "",
      page = "1",
      pageSize = "50",
    } = req.query;

    const where = {};
    if (status) where.status = String(status);
    if (sector) where.sector = String(sector);
    if (nameOrStore) where.nameOrStore = String(nameOrStore);
    if (q) {
      where.OR = [
        { item: { contains: String(q), mode: "insensitive" } },
        { obs: { contains: String(q), mode: "insensitive" } },
        { response: { contains: String(q), mode: "insensitive" } },
      ];
    }

    const skip = (Number(page) - 1) * Number(pageSize);
    const take = Number(pageSize);

    const [total, items] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
    ]);

    res.json({
      total,
      page: Number(page),
      pageSize: Number(pageSize),
      items,
    });
  } catch (e) {
    console.error("GET /orders ERROR:", e);
    return sendError(res, 500, "Erro ao listar pedidos");
  }
});

// POST /api/orders
app.post("/api/orders", async (req, res) => {
  try {
    const {
      sector,
      nameOrStore,
      item,
      quantity = 1,
      obs = "",
    } = req.body || {};
    if (!sector || !nameOrStore || !item) {
      return sendError(
        res,
        400,
        "Campos obrigatórios: sector, nameOrStore, item"
      );
    }

    const created = await prisma.order.create({
      data: {
        sector: String(sector),
        nameOrStore: String(nameOrStore),
        item: String(item),
        quantity: Number(quantity) || 1,
        obs: String(obs || ""),
        status: "aberto",
      },
    });
    res.status(201).json(created);
  } catch (e) {
    console.error("POST /orders ERROR:", e);
    return sendError(res, 500, "Erro ao criar pedido");
  }
});

// PUT /api/orders/:id
app.put("/api/orders/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return sendError(res, 400, "ID inválido");

    // Somente os campos permitidos
    const patch = {};
    if (req.body.hasOwnProperty("status"))
      patch.status = String(req.body.status);
    if (req.body.hasOwnProperty("response"))
      patch.response = String(req.body.response);

    const updated = await prisma.order.update({
      where: { id },
      data: patch,
    });

    res.json(updated);
  } catch (e) {
    if (e.code === "P2025") return sendError(res, 404, "Pedido não encontrado");
    console.error("PUT /orders/:id ERROR:", e);
    return sendError(res, 500, "Erro ao atualizar pedido");
  }
});

// -------------------- TI TICKETS --------------------
// GET /api/ti/tickets?status=&sector=&nameOrStore=&q=&page=&pageSize=
app.get("/api/ti/tickets", async (req, res) => {
  try {
    const {
      status,
      sector,
      nameOrStore,
      q = "",
      page = "1",
      pageSize = "50",
    } = req.query;

    const where = {};
    if (status) where.status = String(status);
    if (sector) where.sector = String(sector);
    if (nameOrStore) where.nameOrStore = String(nameOrStore);
    if (q) {
      where.OR = [
        { title: { contains: String(q), mode: "insensitive" } },
        { description: { contains: String(q), mode: "insensitive" } },
        { response: { contains: String(q), mode: "insensitive" } },
      ];
    }

    const skip = (Number(page) - 1) * Number(pageSize);
    const take = Number(pageSize);

    const [total, items] = await Promise.all([
      prisma.tiTicket.count({ where }),
      prisma.tiTicket.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
    ]);

    res.json({
      total,
      page: Number(page),
      pageSize: Number(pageSize),
      items,
    });
  } catch (e) {
    console.error("GET /ti/tickets ERROR:", e);
    return sendError(res, 500, "Erro ao listar chamados");
  }
});

// POST /api/ti/tickets
app.post("/api/ti/tickets", async (req, res) => {
  try {
    const { sector, nameOrStore, title, description = "" } = req.body || {};
    if (!sector || !nameOrStore || !title) {
      return sendError(
        res,
        400,
        "Campos obrigatórios: sector, nameOrStore, title"
      );
    }

    const created = await prisma.tiTicket.create({
      data: {
        sector: String(sector),
        nameOrStore: String(nameOrStore),
        title: String(title),
        description: String(description || ""),
        status: "aberto",
      },
    });
    res.status(201).json(created);
  } catch (e) {
    console.error("POST /ti/tickets ERROR:", e);
    return sendError(res, 500, "Erro ao criar chamado");
  }
});

// PUT /api/ti/tickets/:id
app.put("/api/ti/tickets/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return sendError(res, 400, "ID inválido");

    const patch = {};
    if (req.body.hasOwnProperty("status"))
      patch.status = String(req.body.status);
    if (req.body.hasOwnProperty("response"))
      patch.response = String(req.body.response);

    const updated = await prisma.tiTicket.update({
      where: { id },
      data: patch,
    });

    res.json(updated);
  } catch (e) {
    if (e.code === "P2025")
      return sendError(res, 404, "Chamado não encontrado");
    console.error("PUT /ti/tickets/:id ERROR:", e);
    return sendError(res, 500, "Erro ao atualizar chamado");
  }
});

// Health
app.get("/api/health", (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// Fallback 404 JSON
app.use((req, res) => {
  res.status(404).json({ error: "Not Found" });
});

// Erro final JSON
app.use((err, req, res, next) => {
  console.error("UNCAUGHT:", err);
  res.status(500).json({ error: "Erro interno" });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log("CORS whitelist:", ALLOWED);
});
