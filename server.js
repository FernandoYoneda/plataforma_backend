const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 3000;

app.use(cors({ origin: process.env.FRONTEND_URL || "*" }));
app.use(express.json());

let orders = [];
let settings = { sector: "", nameOrStore: "" };

const users = [
  {
    email: "solicitante@exemplo.com",
    password: "solicitante123",
    role: "solicitante",
  },
  {
    email: "responsavel@exemplo.com",
    password: "responsavel123",
    role: "responsavel",
  },
];

app.post("/api/login", (req, res) => {
  const { email, password, role } = req.body;
  const user = users.find(
    (u) => u.email === email && u.password === password && u.role === role
  );

  if (!user) {
    return res.status(401).json({ error: "Credenciais inválidas" });
  }

  res.json({ role: user.role });
});

app.get("/api/orders", (req, res) => {
  res.json(orders);
});

app.post("/api/orders", (req, res) => {
  const order = req.body;
  orders.push(order);
  res.status(201).json(order);
});

app.get("/api/settings", (req, res) => {
  res.json(settings);
});

app.post("/api/settings", (req, res) => {
  settings = req.body;
  res.status(200).json(settings);
});

app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
