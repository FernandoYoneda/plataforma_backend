// server.js
const express = require("express");
const cors = require("cors");
const { PrismaClient } = require("@prisma/client");

const app = express();
const prisma = new PrismaClient();

const PORT = process.env.PORT || 10000;

// ====== CORS ======
const raw = process.env.ALLOWED_ORIGINS || "";
const allowedOrigins = raw
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: function (origin, cb) {
      if (!origin) return cb(null, true); // dev tools / curl
      if (allowedOrigins.length === 0) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error("Not allowed by CORS: " + origin));
    },
    credentials: true,
  })
);

app.use(express.json());

// ====== LOGIN (sem JWT, simples por papel) ======
app.post("/api/login", async (req, res) => {
  try {
    const email = (req.body?.email || "").trim();
    const password = (req.body?.password || "").trim();

    if (!email || !password) {
      return res.status(400).json({ error: "E-mail e senha obrigatórios" });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.password !== password) {
      return res.status(401).json({ error: "Credenciais inválidas" });
    }

    // responde apenas com o papel que o frontend usa
    res.json({ role: user.role });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// ====== SETTINGS (id fixo = 1) ======
app.get("/api/settings", async (_req, res) => {
  try {
    const settings = await prisma.settings.findUnique({ where: { id: 1 } });
    res.json(settings || { id: 1, sector: "", nameOrStore: "" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao carregar settings" });
  }
});

app.post("/api/settings", async (req, res) => {
  try {
    const sector = (req.body?.sector || "").trim();
    const nameOrStore = (req.body?.nameOrStore || "").trim();

    if (!sector || !nameOrStore) {
      return res
        .status(400)
        .json({ error: "Campos 'sector' e 'nameOrStore' são obrigatórios" });
    }

    const updated = await prisma.settings.upsert({
      where: { id: 1 },
      update: { sector, nameOrStore },
      create: { id: 1, sector, nameOrStore },
    });

    res.json(updated);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao salvar settings" });
  }
});

// ====== ORDERS (Materiais) ======

// GET /api/orders?status=&sector=&nameOrStore=&q=
app.get("/api/orders", async (req, res) => {
  try {
    const { status, sector, nameOrStore, q } = req.query;

    const where = {};
    if (status) where.status = String(status);
    if (sector) where.sector = String(sector);
    if (nameOrStore) where.nameOrStore = String(nameOrStore);

    if (q) {
      const text = String(q);
      where.OR = [
        { item: { contains: text, mode: "insensitive" } },
        { obs: { contains: text, mode: "insensitive" } },
        { response: { contains: text, mode: "insensitive" } },
      ];
    }

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    res.json(orders);
  } catch (e) {
    console.error("GET /api/orders error:", e);
    res.status(500).json({ error: "Erro ao listar pedidos" });
  }
});

// POST /api/orders
app.post("/api/orders", async (req, res) => {
  try {
    const {
      sector,
      nameOrStore,
      item,
      quantity,
      obs, // observação do solicitante
    } = req.body || {};

    if (!sector || !nameOrStore || !item || !quantity) {
      return res.status(400).json({
        error:
          "Campos 'sector', 'nameOrStore', 'item' e 'quantity' são obrigatórios",
      });
    }

    const order = await prisma.order.create({
      data: {
        sector,
        nameOrStore,
        item,
        quantity: Number(quantity),
        obs: obs || "",
        status: "aberto",
      },
    });

    res.status(201).json(order);
  } catch (e) {
    console.error("POST /api/orders error:", e);
    res.status(500).json({ error: "Erro ao criar pedido" });
  }
});

// PUT /api/orders/:id
app.put("/api/orders/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "ID inválido" });

    // campos que podem ser atualizados
    const patch = {};
    if (req.body.status) patch.status = String(req.body.status);
    if (typeof req.body.response === "string")
      patch.response = req.body.response;

    const exists = await prisma.order.findUnique({ where: { id } });
    if (!exists)
      return res.status(404).json({ error: "Pedido não encontrado" });

    const updated = await prisma.order.update({
      where: { id },
      data: patch,
    });

    res.json(updated);
  } catch (e) {
    console.error("PUT /api/orders/:id error:", e);
    res.status(500).json({ error: "Erro ao atualizar pedido" });
  }
});

// ====== TI TICKETS ======

// GET /api/ti/tickets?status=&sector=&nameOrStore=&q=
app.get("/api/ti/tickets", async (req, res) => {
  try {
    const { status, sector, nameOrStore, q } = req.query;

    const where = {};
    if (status) where.status = String(status);
    if (sector) where.sector = String(sector);
    if (nameOrStore) where.nameOrStore = String(nameOrStore);

    if (q) {
      const text = String(q);
      where.OR = [
        { title: { contains: text, mode: "insensitive" } },
        { description: { contains: text, mode: "insensitive" } },
        { response: { contains: text, mode: "insensitive" } },
      ];
    }

    const tickets = await prisma.tiTicket.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    res.json(tickets);
  } catch (e) {
    console.error("GET /api/ti/tickets error:", e);
    res.status(500).json({ error: "Erro ao listar chamados" });
  }
});

// POST /api/ti/tickets
app.post("/api/ti/tickets", async (req, res) => {
  try {
    const {
      sector,
      nameOrStore,
      title,
      description, // descrição do solicitante (TI)
    } = req.body || {};

    if (!sector || !nameOrStore || !title) {
      return res.status(400).json({
        error: "Campos 'sector', 'nameOrStore' e 'title' são obrigatórios",
      });
    }

    const ticket = await prisma.tiTicket.create({
      data: {
        sector,
        nameOrStore,
        title,
        description: description || "",
        status: "aberto",
      },
    });

    res.status(201).json(ticket);
  } catch (e) {
    console.error("POST /api/ti/tickets error:", e);
    res.status(500).json({ error: "Erro ao abrir chamado" });
  }
});

// PUT /api/ti/tickets/:id
app.put("/api/ti/tickets/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "ID inválido" });

    const patch = {};
    if (req.body.status) patch.status = String(req.body.status);
    if (typeof req.body.response === "string")
      patch.response = req.body.response;

    const exists = await prisma.tiTicket.findUnique({ where: { id } });
    if (!exists)
      return res.status(404).json({ error: "Chamado não encontrado" });

    const updated = await prisma.tiTicket.update({
      where: { id },
      data: patch,
    });

    res.json(updated);
  } catch (e) {
    console.error("PUT /api/ti/tickets/:id error:", e);
    res.status(500).json({ error: "Erro ao atualizar chamado" });
  }
});

// ====== HEALTHCHECK ======
app.get("/health", (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log("CORS whitelist:", allowedOrigins);
});
