import type { Context } from "hono";
import { ZodError } from "zod";
import { AppError } from "../lib/errors.js";

export function errorMiddleware(err: Error, c: Context) {
  if (err instanceof AppError) {
    return c.json({ error: err.message }, err.status as 400 | 404 | 409 | 422 | 500);
  }

  if (err instanceof ZodError) {
    return c.json({ error: "Validation error", details: err.errors }, 422);
  }

  // Prisma not found error (P2025)
  if (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "P2025"
  ) {
    return c.json({ error: "Not found" }, 404);
  }

  console.error(err);
  return c.json({ error: "Internal server error" }, 500);
}
