import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import {
  CategorySchema,
  CreateCategorySchema,
  UpdateCategorySchema,
} from "@time-tracker/shared";
import {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from "../services/categories.js";

export const categoriesRouter = new OpenAPIHono({
  defaultHook: (result, c) => {
    if (!result.success) {
      return c.json({ error: "Validation error", details: result.error.errors }, 422);
    }
  },
});

const CategoryResponseSchema = CategorySchema;

const listRoute = createRoute({
  method: "get",
  path: "/categories",
  responses: {
    200: {
      content: { "application/json": { schema: z.array(CategoryResponseSchema) } },
      description: "List of categories",
    },
  },
});

const createRoute_ = createRoute({
  method: "post",
  path: "/categories",
  request: {
    body: {
      content: { "application/json": { schema: CreateCategorySchema } },
    },
  },
  responses: {
    201: {
      content: { "application/json": { schema: CategoryResponseSchema } },
      description: "Created category",
    },
  },
});

const updateRoute = createRoute({
  method: "patch",
  path: "/categories/{id}",
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: { "application/json": { schema: UpdateCategorySchema } },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: CategoryResponseSchema } },
      description: "Updated category",
    },
  },
});

const deleteRoute = createRoute({
  method: "delete",
  path: "/categories/{id}",
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    204: { description: "Deleted" },
  },
});

categoriesRouter.openapi(listRoute, async (c) => {
  const categories = await listCategories();
  return c.json(categories, 200);
});

categoriesRouter.openapi(createRoute_, async (c) => {
  const data = c.req.valid("json");
  const category = await createCategory(data);
  return c.json(category, 201);
});

categoriesRouter.openapi(updateRoute, async (c) => {
  const { id } = c.req.valid("param");
  const data = c.req.valid("json");
  const category = await updateCategory(id, data);
  return c.json(category, 200);
});

categoriesRouter.openapi(deleteRoute, async (c) => {
  const { id } = c.req.valid("param");
  await deleteCategory(id);
  return new Response(null, { status: 204 });
});
