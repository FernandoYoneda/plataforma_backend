require("dotenv").config();
const express = require("express");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const app = express();

const PORT = process.env.PORT || 10000;

// --------- CORS dinâmico ---------
const ALLOWED = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

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
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use(express.json());

// ---------- Health / Debug ----------
app.get("/api/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, db: "ok", allowedOrigins: ALLOWED });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
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

// ---------- Auth ----------
app.post("/api/login", async (req, res, next) => {
  try {
    const email = (req.body?.email || "").trim();
    const password = (req.body?.password || "").trim();
    if (!email || !password)
      return res.status(400).json({ error: "Email e senha são obrigatórios" });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: "Credenciais inválidas" });

    const ok = password === user.password; // se usar bcrypt, ajuste aqui
    if (!ok) return res.status(401).json({ error: "Credenciais inválidas" });

    res.json({ role: user.role, email: user.email });
  } catch (e) {
    next(e);
  }
});

// ---------- Settings (global legado) ----------
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

// ---------- Orders (Materiais) ----------
app.get("/api/orders", async (req, res, next) => {
  try {
    const {
      requesterEmail,
      requesterName,
      requesterSector,
      sector,
      nameOrStore,
    } = req.query;
    const where = {};
    if (requesterEmail) where.requesterEmail = requesterEmail;
    if (requesterName) where.requesterName = requesterName;
    if (requesterSector) where.requesterSector = requesterSector;
    if (sector && !where.requesterSector) where.sector = sector; // compat
    if (nameOrStore && !where.requesterName) where.nameOrStore = nameOrStore; // compat

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
    const {
      item,
      qty,
      notes,
      sector,
      nameOrStore,
      requesterEmail,
      requesterName,
      requesterSector,
    } = req.body || {};

    if (!item || !qty)
      return res
        .status(400)
        .json({ error: "Item e quantidade são obrigatórios" });

    const created = await prisma.order.create({
      data: {
        item,
        qty: Number(qty),
        notes: notes || null,
        sector: sector || null,
        nameOrStore: nameOrStore || null,
        requesterEmail: requesterEmail || null,
        requesterName: requesterName || null,
        requesterSector: requesterSector || null,
      },
    });
    res.status(201).json(created);
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

// ---------- TI Tickets ----------
app.get("/api/ti/tickets", async (req, res, next) => {
  try {
    const {
      requesterEmail,
      requesterName,
      requesterSector,
      sector,
      nameOrStore,
    } = req.query;
    const where = {};
    if (requesterEmail) where.requesterEmail = requesterEmail;
    if (requesterName) where.requesterName = requesterName;
    if (requesterSector) where.requesterSector = requesterSector;
    if (sector && !where.requesterSector) where.sector = sector; // compat
    if (nameOrStore && !where.requesterName) where.nameOrStore = nameOrStore; // compat

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
    const {
      title,
      description,
      sector,
      nameOrStore,
      requesterEmail,
      requesterName,
      requesterSector,
    } = req.body || {};

    if (!title || !description)
      return res
        .status(400)
        .json({ error: "Título e descrição são obrigatórios" });

    const created = await prisma.tiTicket.create({
      data: {
        title,
        description,
        sector: sector || null,
        nameOrStore: nameOrStore || null,
        requesterEmail: requesterEmail || null,
        requesterName: requesterName || null,
        requesterSector: requesterSector || null,
        status: "aberto",
      },
    });
    res.status(201).json(created);
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

// ---------- Error handler ----------
app.use((err, _req, res, _next) => {
  console.error("UNCAUGHT ERROR:", err);
  res.status(500).json({ error: err?.message || "Erro interno no servidor" });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log("CORS whitelist:", ALLOWED);
});
