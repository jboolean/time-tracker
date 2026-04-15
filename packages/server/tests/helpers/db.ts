import path from "path";
import { PrismaClient } from "@prisma/client";

const testDbPath = path.resolve(__dirname, "../../prisma/test.db");
process.env.DATABASE_URL = `file:${testDbPath}`;

export const testPrisma = new PrismaClient();

export async function resetDB() {
  await testPrisma.task.deleteMany();
  await testPrisma.project.deleteMany();
  // Delete child categories first (those with a parentId), then parents
  await testPrisma.category.deleteMany({ where: { parentId: { not: null } } });
  await testPrisma.category.deleteMany();
}
