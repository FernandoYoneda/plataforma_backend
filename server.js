// server.js (COMPLETO, com CORS robusto + health + error handler)
require("dotenv").config();
const express = require("express");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const app = express();

const PORT = process.env.PORT || 10000;

// ----------------- CORS ROBUSTO -----------------
const ALLOWED = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/**
 * Exemplo de ALLOWED_ORIGINS no Render:
 *   https://plataforma-frontend.onrender.com,http://localhost:3000
 */
app.use((req, res, next) => {
  const origin = req.headers.origin;
  res.header("Vary", "Origin");

  if (origin && (ALLOWED.length === 0 || ALLOWED.includes(origin))) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Credentials", "true");
  }

  res.header(
    "Access-Control-Allow-Methods",
    "GET,POST,PATCH,PUT,DELETE,OPTIONS"
  );
  res.header("Access-Control-Allow-Headers", "Content-Type,Authorization");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

app.use(express.json());

// ----------------- ROTAS DE DIAGNÓSTICO -----------------
app.get("/api/health", async (_req, res) => {
  try {
    // Verifica conexão básica com o banco
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      ok: true,
      db: "ok",
      allowedOrigins: ALLOWED,
      env: {
        hasDatabaseUrl: !!process.env.DATABASE_URL,
        nodeEnv: process.env.NODE_ENV || null,
      },
    });
  } catch (e) {
    console.error("HEALTH ERROR:", e);
    res.status(500).json({
      ok: false,
      error: "DB check failed",
      message: e.message,
    });
  }
});

app.get("/api/debug/cors", (req, res) => {
  res.json({
    originReceived: req.headers.origin || null,
    allowedOrigins: ALLOWED,
    corsApplied:
      !!req.headers.origin &&
      (ALLOWED.length === 0 || ALLOWED.includes(req.headers.origin)),
  });
});

// ----------------- AUTH -----------------
app.post("/api/login", async (req, res, next) => {
  try {
    const email = (req.body?.email || "").trim();
    const password = (req.body?.password || "").trim();

    if (!email || !password) {
      return res.status(400).json({ error: "Email e senha são obrigatórios" });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: "Credenciais inválidas" });

    // Se as senhas no banco estiverem em texto (seed simples):
    const ok = password === user.password;

    // Se estiver usando bcrypt no seed, troque por:
    // const bcrypt = require("bcryptjs");
    // const ok = await bcrypt.compare(password, user.password);

    if (!ok) return res.status(401).json({ error: "Credenciais inválidas" });

    return res.json({ role: user.role });
  } catch (e) {
    console.error("Login error:", e);
    next(e);
  }
});

// ----------------- SETTINGS -----------------
app.get("/api/settings", async (_req, res, next) => {
  try {
    const s = await prisma.settings.findUnique({ where: { id: 1 } });
    res.json(s || { id: 1, sector: "", nameOrStore: "" });
  } catch (e) {
    next(e);
  }
});

app.post("/api/settings", async (req, res, next) => {
  try {
    const { sector, nameOrStore } = req.body || {};
    const saved = await prisma.settings.upsert({
      where: { id: 1 },
      update: { sector: sector || "", nameOrStore: nameOrStore || "" },
      create: { id: 1, sector: sector || "", nameOrStore: nameOrStore || "" },
    });
    res.json(saved);
  } catch (e) {
    next(e);
  }
});

// ----------------- ORDERS (Materiais) -----------------
app.get("/api/orders", async (req, res, next) => {
  try {
    const { sector, nameOrStore } = req.query;
    const where = {};
    if (sector) where.sector = sector;
    if (nameOrStore) where.nameOrStore = nameOrStore;

    const list = await prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
    res.json(list);
  } catch (e) {
    next(e);
  }
});

app.post("/api/orders", async (req, res, next) => {
  try {
    const { item, qty, notes, sector, nameOrStore } = req.body || {};
    if (!item || !qty) {
      return res
        .status(400)
        .json({ error: "Item e quantidade são obrigatórios" });
    }

    const created = await prisma.order.create({
      data: {
        item,
        qty: Number(qty),
        notes: notes || null,
        sector: sector || null,
        nameOrStore: nameOrStore || null,
      },
    });
    res.status(201).json(created);
  } catch (e) {
    next(e);
  }
});

app.patch("/api/orders/:id/done", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { done } = req.body || {};
    const updated = await prisma.order.update({
      where: { id },
      data: { done: !!done, status: !!done ? "finalizado" : "aberto" },
    });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

app.patch("/api/orders/:id/status", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { status, response } = req.body || {};
    const data = {};
    if (status) data.status = status;
    if (typeof response === "string") data.response = response;
    if (status === "finalizado") data.done = true;
    if (status === "aberto") data.done = false;

    const updated = await prisma.order.update({ where: { id }, data });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

// ----------------- TI TICKETS -----------------
app.get("/api/ti/tickets", async (req, res, next) => {
  try {
    const { sector, nameOrStore } = req.query;
    const where = {};
    if (sector) where.sector = sector;
    if (nameOrStore) where.nameOrStore = nameOrStore;

    const list = await prisma.tiTicket.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
    res.json(list);
  } catch (e) {
    next(e);
  }
});

app.post("/api/ti/tickets", async (req, res, next) => {
  try {
    const { title, description, sector, nameOrStore } = req.body || {};
    if (!title || !description) {
      return res
        .status(400)
        .json({ error: "Título e descrição são obrigatórios" });
    }
    const created = await prisma.tiTicket.create({
      data: {
        title,
        description,
        sector: sector || null,
        nameOrStore: nameOrStore || null,
        status: "aberto",
      },
    });
    res.status(201).json(created);
  } catch (e) {
    next(e);
  }
});

app.patch("/api/ti/tickets/:id/done", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { done } = req.body || {};
    const updated = await prisma.tiTicket.update({
      where: { id },
      data: { done: !!done, status: !!done ? "finalizado" : "aberto" },
    });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

app.patch("/api/ti/tickets/:id/status", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { status, response } = req.body || {};
    const data = {};
    if (status) data.status = status;
    if (typeof response === "string") data.response = response;
    if (status === "finalizado") data.done = true;
    if (status === "aberto") data.done = false;

    const updated = await prisma.tiTicket.update({ where: { id }, data });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

// ----------------- ERROR HANDLER GLOBAL -----------------
app.use((err, _req, res, _next) => {
  console.error("UNCAUGHT ERROR:", err);
  const msg = (err && err.message) || "Erro interno no servidor";
  res.status(500).json({ error: msg });
});

// ----------------- START -----------------
(async () => {
  // Valida variáveis essenciais
  if (!process.env.DATABASE_URL) {
    console.warn("⚠️ DATABASE_URL não definida!");
  }
  console.log("CORS whitelist (ALLOWED_ORIGINS):", ALLOWED);
  app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
  });
})();
