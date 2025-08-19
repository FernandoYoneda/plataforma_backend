// server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { PrismaClient } = require("@prisma/client");
// const bcrypt = require("bcryptjs"); // use se tiver senha com hash

const prisma = new PrismaClient();
const app = express();

const PORT = process.env.PORT || 10000;
const allowed = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowed.length === 0 || allowed.includes(origin))
        return cb(null, true);
      return cb(new Error("Not allowed by CORS: " + origin));
    },
    credentials: true,
  })
);
app.use(express.json());

// ---------- AUTH ----------
app.post("/api/login", async (req, res) => {
  try {
    const email = (req.body?.email || "").trim();
    const password = (req.body?.password || "").trim();
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: "Credenciais inválidas" });

    // Se usar hash:
    // const ok = await bcrypt.compare(password, user.password);
    const ok = password === user.password;
    if (!ok) return res.status(401).json({ error: "Credenciais inválidas" });

    res.json({ role: user.role });
  } catch (e) {
    console.error("Login error:", e);
    res.status(500).json({ error: "Erro no login" });
  }
});

// ---------- SETTINGS ----------
app.get("/api/settings", async (_req, res) => {
  const s = await prisma.settings.findUnique({ where: { id: 1 } });
  res.json(s || { id: 1, sector: "", nameOrStore: "" });
});

app.post("/api/settings", async (req, res) => {
  const { sector, nameOrStore } = req.body || {};
  const saved = await prisma.settings.upsert({
    where: { id: 1 },
    update: { sector: sector || "", nameOrStore: nameOrStore || "" },
    create: { id: 1, sector: sector || "", nameOrStore: nameOrStore || "" },
  });
  res.json(saved);
});

// ---------- ORDERS ----------
app.get("/api/orders", async (req, res) => {
  const { sector, nameOrStore } = req.query;
  const where = {};
  if (sector) where.sector = sector;
  if (nameOrStore) where.nameOrStore = nameOrStore;

  const list = await prisma.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });
  res.json(list);
});

app.post("/api/orders", async (req, res) => {
  const { item, qty, notes, sector, nameOrStore } = req.body || {};
  if (!item || !qty)
    return res
      .status(400)
      .json({ error: "Item e quantidade são obrigatórios" });

  const created = await prisma.order.create({
    data: { item, qty: Number(qty), notes: notes || null, sector, nameOrStore },
  });
  res.status(201).json(created);
});

// marcar “feito” (ou desfazer)
app.patch("/api/orders/:id/done", async (req, res) => {
  const id = Number(req.params.id);
  const { done } = req.body || {};
  const updated = await prisma.order.update({
    where: { id },
    data: { done: !!done, status: !!done ? "finalizado" : "aberto" },
  });
  res.json(updated);
});

// atualizar status/response
app.patch("/api/orders/:id/status", async (req, res) => {
  const id = Number(req.params.id);
  const { status, response } = req.body || {};
  const data = {};
  if (status) data.status = status;
  if (typeof response === "string") data.response = response;
  if (status === "finalizado") data.done = true;
  if (status === "aberto") data.done = false;

  const updated = await prisma.order.update({ where: { id }, data });
  res.json(updated);
});

// ---------- TI TICKETS ----------
app.get("/api/ti/tickets", async (req, res) => {
  const { sector, nameOrStore } = req.query;
  const where = {};
  if (sector) where.sector = sector;
  if (nameOrStore) where.nameOrStore = nameOrStore;

  const list = await prisma.tiTicket.findMany({
    where,
    orderBy: { createdAt: "asc" },
  });
  res.json(list);
});

app.post("/api/ti/tickets", async (req, res) => {
  const { title, description, sector, nameOrStore } = req.body || {};
  if (!title || !description)
    return res
      .status(400)
      .json({ error: "Título e descrição são obrigatórios" });

  const created = await prisma.tiTicket.create({
    data: { title, description, sector, nameOrStore },
  });
  res.status(201).json(created);
});

app.patch("/api/ti/tickets/:id/done", async (req, res) => {
  const id = Number(req.params.id);
  const { done } = req.body || {};
  const updated = await prisma.tiTicket.update({
    where: { id },
    data: { done: !!done, status: !!done ? "finalizado" : "aberto" },
  });
  res.json(updated);
});

app.patch("/api/ti/tickets/:id/status", async (req, res) => {
  const id = Number(req.params.id);
  const { status, response } = req.body || {};
  const data = {};
  if (status) data.status = status;
  if (typeof response === "string") data.response = response;
  if (status === "finalizado") data.done = true;
  if (status === "aberto") data.done = false;

  const updated = await prisma.tiTicket.update({ where: { id }, data });
  res.json(updated);
});

// ---------- START ----------
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log("CORS whitelist:", allowed);
});
