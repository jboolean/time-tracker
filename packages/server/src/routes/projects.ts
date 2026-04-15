import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import {
  ProjectSchema,
  CreateProjectSchema,
  UpdateProjectSchema,
} from "@time-tracker/shared";
import {
  listProjects,
  createProject,
  updateProject,
  deleteProject,
} from "../services/projects.js";

export const projectsRouter = new OpenAPIHono({
  defaultHook: (result, c) => {
    if (!result.success) {
      return c.json({ error: "Validation error", details: result.error.errors }, 422);
    }
  },
});

const ProjectResponseSchema = ProjectSchema;

const listRoute = createRoute({
  method: "get",
  path: "/projects",
  request: {
    query: z.object({ categoryId: z.string().optional() }),
  },
  responses: {
    200: {
      content: { "application/json": { schema: z.array(ProjectResponseSchema) } },
      description: "List of projects",
    },
  },
});

const createRoute_ = createRoute({
  method: "post",
  path: "/projects",
  request: {
    body: {
      content: { "application/json": { schema: CreateProjectSchema } },
    },
  },
  responses: {
    201: {
      content: { "application/json": { schema: ProjectResponseSchema } },
      description: "Created project",
    },
  },
});

const updateRoute = createRoute({
  method: "patch",
  path: "/projects/{id}",
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: { "application/json": { schema: UpdateProjectSchema } },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: ProjectResponseSchema } },
      description: "Updated project",
    },
  },
});

const deleteRoute = createRoute({
  method: "delete",
  path: "/projects/{id}",
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    204: { description: "Deleted" },
  },
});

projectsRouter.openapi(listRoute, async (c) => {
  const { categoryId } = c.req.valid("query");
  const projects = await listProjects(categoryId ? { categoryId } : undefined);
  return c.json(projects, 200);
});

projectsRouter.openapi(createRoute_, async (c) => {
  const data = c.req.valid("json");
  const project = await createProject(data);
  return c.json(project, 201);
});

projectsRouter.openapi(updateRoute, async (c) => {
  const { id } = c.req.valid("param");
  const data = c.req.valid("json");
  const project = await updateProject(id, data);
  return c.json(project, 200);
});

projectsRouter.openapi(deleteRoute, async (c) => {
  const { id } = c.req.valid("param");
  await deleteProject(id);
  return new Response(null, { status: 204 });
});
