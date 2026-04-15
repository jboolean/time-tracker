import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import {
  TaskSchema,
  CreateTaskSchema,
  UpdateTaskSchema,
} from "@time-tracker/shared";
import {
  listTasks,
  getActiveTask,
  createTask,
  updateTask,
  deleteTask,
  endTask,
} from "../services/tasks.js";
import { AppError } from "../lib/errors.js";

export const tasksRouter = new OpenAPIHono({
  defaultHook: (result, c) => {
    if (!result.success) {
      return c.json({ error: "Validation error", details: result.error.errors }, 422);
    }
  },
});

const TaskResponseSchema = TaskSchema;

const listRoute = createRoute({
  method: "get",
  path: "/tasks",
  request: {
    query: z.object({
      startTime: z.string().optional(),
      endTime: z.string().optional(),
      projectId: z.string().optional(),
      categoryId: z.string().optional(),
    }),
  },
  responses: {
    200: {
      content: { "application/json": { schema: z.array(TaskResponseSchema) } },
      description: "List of tasks",
    },
  },
});

const getActiveRoute = createRoute({
  method: "get",
  path: "/tasks/active",
  responses: {
    200: {
      content: { "application/json": { schema: TaskResponseSchema } },
      description: "Active task",
    },
    404: {
      content: { "application/json": { schema: z.object({ error: z.string() }) } },
      description: "No active task",
    },
  },
});

const createRoute_ = createRoute({
  method: "post",
  path: "/tasks",
  request: {
    body: {
      content: { "application/json": { schema: CreateTaskSchema } },
    },
  },
  responses: {
    201: {
      content: { "application/json": { schema: TaskResponseSchema } },
      description: "Created task",
    },
  },
});

const updateRoute = createRoute({
  method: "patch",
  path: "/tasks/{id}",
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: { "application/json": { schema: UpdateTaskSchema } },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: TaskResponseSchema } },
      description: "Updated task",
    },
  },
});

const deleteRoute = createRoute({
  method: "delete",
  path: "/tasks/{id}",
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    204: { description: "Deleted" },
  },
});

const endRoute = createRoute({
  method: "post",
  path: "/tasks/{id}/end",
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: {
      content: { "application/json": { schema: TaskResponseSchema } },
      description: "Ended task",
    },
  },
});

tasksRouter.openapi(listRoute, async (c) => {
  const query = c.req.valid("query");
  const tasks = await listTasks(query);
  return c.json(tasks, 200);
});

tasksRouter.openapi(getActiveRoute, async (c) => {
  const task = await getActiveTask();
  if (!task) {
    return c.json({ error: "No active task" }, 404);
  }
  return c.json(task, 200);
});

tasksRouter.openapi(createRoute_, async (c) => {
  const data = c.req.valid("json");
  const task = await createTask(data);
  return c.json(task, 201);
});

tasksRouter.openapi(updateRoute, async (c) => {
  const { id } = c.req.valid("param");
  const data = c.req.valid("json");
  const task = await updateTask(id, data);
  return c.json(task, 200);
});

tasksRouter.openapi(deleteRoute, async (c) => {
  const { id } = c.req.valid("param");
  await deleteTask(id);
  return new Response(null, { status: 204 });
});

tasksRouter.openapi(endRoute, async (c) => {
  const { id } = c.req.valid("param");
  const task = await endTask(id);
  return c.json(task, 200);
});
