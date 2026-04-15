import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const workCategory = await prisma.category.create({
    data: {
      name: "Work",
      hue: 210,
      saturation: 70,
      lightness: 55,
    },
  });

  const generalWorkProject = await prisma.project.create({
    data: {
      name: "General Work",
      isDefault: true,
      categoryId: workCategory.id,
    },
  });

  const personalCategory = await prisma.category.create({
    data: {
      name: "Personal",
      hue: 120,
      saturation: 65,
      lightness: 50,
    },
  });

  await prisma.project.create({
    data: {
      name: "Personal Tasks",
      isDefault: true,
      categoryId: personalCategory.id,
    },
  });

  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  await prisma.task.create({
    data: {
      title: "Initial setup",
      projectId: generalWorkProject.id,
      startTime: oneHourAgo,
      endTime: now,
    },
  });

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
