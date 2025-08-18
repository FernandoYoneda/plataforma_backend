// server.js
const express = require("express");
const cors = require("cors");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const app = express();

// ---------------------------
// PORTA & AMBIENTE
// ---------------------------
const port = process.env.PORT || 10000;

// ---------------------------
// C O R S  (whitelist + preflight)
// ---------------------------
const fromEnv = (process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const isProd = process.env.NODE_ENV === "production";
const whitelist = [...fromEnv, ...(isProd ? [] : ["http://localhost:3000"])];

const corsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true);
    if (whitelist.includes(origin)) return cb(null, true);
    return cb(new Error(`Not allowed by CORS: ${origin}`));
  },
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.options("*", cors(corsOptions));
app.use(cors(corsOptions));
app.use(express.json());

// ---------------------------
// HEALTH-CHECK
// ---------------------------
app.get("/", (_req, res) =>
  res.json({ ok: true, service: "pedidos+ti-backend", db: "postgres" })
);

// ---------------------------
/** LOGIN
 *  Autentica por email+senha (texto puro neste exemplo de demo, sem hash).
 *  Retorna apenas o role.
 */
app.post("/api/login", async (req, res) => {
  try {
    const email = (req.body?.email || "").trim();
    const password = (req.body?.password || "").trim();

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.password !== password) {
      return res.status(401).json({ error: "Credenciais inválidas" });
    }
    return res.json({ role: user.role });
  } catch (e) {
    console.error("Login error:", e);
    return res.status(500).json({ error: "Erro interno" });
  }
});

// ---------------------------
// SETTINGS (único registro id=1)
// ---------------------------
app.get("/api/settings", async (_req, res) => {
  try {
    const s = await prisma.settings.findUnique({ where: { id: 1 } });
    return res.json(s || { sector: "", nameOrStore: "" });
  } catch (e) {
    console.error("GET /api/settings", e);
    return res.status(500).json({ error: "Erro ao carregar configurações" });
  }
});

app.post("/api/settings", async (req, res) => {
  try {
    const sector = (req.body?.sector || "").trim();
    const nameOrStore = (req.body?.nameOrStore || "").trim();

    const s = await prisma.settings.upsert({
      where: { id: 1 },
      update: { sector, nameOrStore },
      create: { id: 1, sector, nameOrStore },
    });
    return res.status(200).json(s);
  } catch (e) {
    console.error("POST /api/settings", e);
    return res.status(500).json({ error: "Erro ao salvar configurações" });
  }
});

// ---------------------------
// ORDERS
// ---------------------------
app.get("/api/orders", async (_req, res) => {
  try {
    const items = await prisma.order.findMany({
      orderBy: { createdAt: "desc" },
    });
    return res.json(items);
  } catch (e) {
    console.error("GET /api/orders", e);
    return res.status(500).json({ error: "Erro ao carregar pedidos" });
  }
});

app.post("/api/orders", async (req, res) => {
  try {
    const { item, qty, notes, sector, nameOrStore, role } = req.body;
    if (!item || !qty)
      return res
        .status(400)
        .json({ error: "Item e quantidade são obrigatórios" });

    const created = await prisma.order.create({
      data: {
        item: String(item).trim(),
        qty: Number(qty),
        notes: (notes || "").trim() || null,
        sector: sector || null,
        nameOrStore: nameOrStore || null,
        role: role || null,
      },
    });
    return res.status(201).json(created);
  } catch (e) {
    console.error("POST /api/orders", e);
    return res.status(500).json({ error: "Erro ao criar pedido" });
  }
});

// ---------------------------
// TI TICKETS
// ---------------------------
app.get("/api/ti/tickets", async (_req, res) => {
  try {
    const tickets = await prisma.tiTicket.findMany({
      orderBy: { createdAt: "desc" },
    });
    return res.json(tickets);
  } catch (e) {
    console.error("GET /api/ti/tickets", e);
    return res.status(500).json({ error: "Erro ao listar chamados" });
  }
});

app.post("/api/ti/tickets", async (req, res) => {
  try {
    const { title, description, sector, nameOrStore, createdBy } = req.body;
    if (!title || !description) {
      return res
        .status(400)
        .json({ error: "Título e descrição são obrigatórios" });
    }

    const created = await prisma.tiTicket.create({
      data: {
        title: String(title).trim(),
        description: String(description).trim(),
        sector: sector || null,
        nameOrStore: nameOrStore || null,
        createdBy: createdBy || null,
        status: "aberto",
      },
    });
    return res.status(201).json(created);
  } catch (e) {
    console.error("POST /api/ti/tickets", e);
    return res.status(500).json({ error: "Erro ao abrir chamado" });
  }
});

// ---------------------------
// START
// ---------------------------
app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
  console.log("CORS whitelist:", whitelist);
});
