// server.js (COMPLETO)
require("dotenv").config();
const express = require("express");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const app = express();

const PORT = process.env.PORT || 10000;

// --------- CORS ROBUSTO (sem depender de biblioteca) ---------
const ALLOWED = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/**
 * Ex.: ALLOWED_ORIGINS no Render:
 * https://plataforma-frontend.onrender.com,http://localhost:3000
 */
app.use((req, res, next) => {
  const origin = req.headers.origin;
  // Permite variar por origem (evita cache errado por proxies)
  res.header("Vary", "Origin");

  if (origin && (ALLOWED.length === 0 || ALLOWED.includes(origin))) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Credentials", "true");
  }
  // Métodos e headers padrão p/ preflight
  res.header(
    "Access-Control-Allow-Methods",
    "GET,POST,PATCH,PUT,DELETE,OPTIONS"
  );
  res.header("Access-Control-Allow-Headers", "Content-Type,Authorization");

  // Responde preflight sem erro
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

app.use(express.json());

// ---------- AUTH ----------
app.post("/api/login", async (req, res) => {
  try {
    const email = (req.body?.email || "").trim();
    const password = (req.body?.password || "").trim();

    if (!email || !password) {
      return res.status(400).json({ error: "Email e senha são obrigatórios" });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: "Credenciais inválidas" });

    // ATENÇÃO: se você fez hash no seed, troque p/ bcrypt.compare
    const ok = password === user.password;
    if (!ok) return res.status(401).json({ error: "Credenciais inválidas" });

    return res.json({ role: user.role });
  } catch (e) {
    console.error("Login error:", e);
    return res.status(500).json({ error: "Erro no login" });
  }
});

// ---------- SETTINGS ----------
app.get("/api/settings", async (_req, res) => {
  try {
    const s = await prisma.settings.findUnique({ where: { id: 1 } });
    return res.json(s || { id: 1, sector: "", nameOrStore: "" });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Erro ao buscar settings" });
  }
});

app.post("/api/settings", async (req, res) => {
  try {
    const { sector, nameOrStore } = req.body || {};
    const saved = await prisma.settings.upsert({
      where: { id: 1 },
      update: { sector: sector || "", nameOrStore: nameOrStore || "" },
      create: { id: 1, sector: sector || "", nameOrStore: nameOrStore || "" },
    });
    return res.json(saved);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Erro ao salvar settings" });
  }
});

// ---------- ORDERS ----------
app.get("/api/orders", async (req, res) => {
  try {
    const { sector, nameOrStore } = req.query;
    const where = {};
    if (sector) where.sector = sector;
    if (nameOrStore) where.nameOrStore = nameOrStore;

    const list = await prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
    return res.json(list);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Erro ao listar pedidos" });
  }
});

app.post("/api/orders", async (req, res) => {
  try {
    const { item, qty, notes, sector, nameOrStore } = req.body || {};
    if (!item || !qty)
      return res
        .status(400)
        .json({ error: "Item e quantidade são obrigatórios" });

    const created = await prisma.order.create({
      data: {
        item,
        qty: Number(qty),
        notes: notes || null,
        sector,
        nameOrStore,
      },
    });
    return res.status(201).json(created);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Erro ao criar pedido" });
  }
});

app.patch("/api/orders/:id/done", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { done } = req.body || {};
    const updated = await prisma.order.update({
      where: { id },
      data: { done: !!done, status: !!done ? "finalizado" : "aberto" },
    });
    return res.json(updated);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Erro ao atualizar pedido" });
  }
});

app.patch("/api/orders/:id/status", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status, response } = req.body || {};
    const data = {};
    if (status) data.status = status;
    if (typeof response === "string") data.response = response;
    if (status === "finalizado") data.done = true;
    if (status === "aberto") data.done = false;

    const updated = await prisma.order.update({ where: { id }, data });
    return res.json(updated);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Erro ao atualizar pedido" });
  }
});

// ---------- TI ----------
app.get("/api/ti/tickets", async (req, res) => {
  try {
    const { sector, nameOrStore } = req.query;
    const where = {};
    if (sector) where.sector = sector;
    if (nameOrStore) where.nameOrStore = nameOrStore;

    const list = await prisma.tiTicket.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
    return res.json(list);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Erro ao listar chamados" });
  }
});

app.post("/api/ti/tickets", async (req, res) => {
  try {
    const { title, description, sector, nameOrStore } = req.body || {};
    if (!title || !description) {
      return res
        .status(400)
        .json({ error: "Título e descrição são obrigatórios" });
    }
    const created = await prisma.tiTicket.create({
      data: { title, description, sector, nameOrStore, status: "aberto" },
    });
    return res.status(201).json(created);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Erro ao criar chamado" });
  }
});

app.patch("/api/ti/tickets/:id/done", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { done } = req.body || {};
    const updated = await prisma.tiTicket.update({
      where: { id },
      data: { done: !!done, status: !!done ? "finalizado" : "aberto" },
    });
    return res.json(updated);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Erro ao atualizar chamado" });
  }
});

app.patch("/api/ti/tickets/:id/status", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status, response } = req.body || {};
    const data = {};
    if (status) data.status = status;
    if (typeof response === "string") data.response = response;
    if (status === "finalizado") data.done = true;
    if (status === "aberto") data.done = false;

    const updated = await prisma.tiTicket.update({ where: { id }, data });
    return res.json(updated);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Erro ao atualizar chamado" });
  }
});

// ---------- START ----------
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log("CORS whitelist:", ALLOWED);
});
