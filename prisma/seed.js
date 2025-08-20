// prisma/seed.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
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
    {
      email: "solicitante.ti@exemplo.com",
      password: "solti123",
      role: "solicitante_ti",
    },
    {
      email: "responsavel.ti@exemplo.com",
      password: "resti123",
      role: "responsavel_ti",
    },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: u,
    });
  }

  await prisma.settings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, sector: "", nameOrStore: "" },
  });

  console.log("Seed concluído.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
