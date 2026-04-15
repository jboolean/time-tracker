import path from "path";

const testDbPath = path.resolve(__dirname, "../prisma/test.db");
process.env.DATABASE_URL = `file:${testDbPath}`;
