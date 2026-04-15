import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { IntakeSchema, TaskSchema } from "@time-tracker/shared";
import { processIntake } from "../services/intake.js";

export const intakeRouter = new OpenAPIHono({
  defaultHook: (result, c) => {
    if (!result.success) {
      return c.json({ error: "Validation error", details: result.error.errors }, 422);
    }
  },
});

const TaskResponseSchema = TaskSchema;

const intakeRoute = createRoute({
  method: "post",
  path: "/intake",
  request: {
    body: {
      content: { "application/json": { schema: IntakeSchema } },
    },
  },
  responses: {
    201: {
      content: { "application/json": { schema: TaskResponseSchema } },
      description: "Created task from intake",
    },
  },
});

intakeRouter.openapi(intakeRoute, async (c) => {
  const data = c.req.valid("json");
  const task = await processIntake(data);
  return c.json(task, 201);
});
