import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { categoriesRouter } from "./routes/categories.js";
import { projectsRouter } from "./routes/projects.js";
import { tasksRouter } from "./routes/tasks.js";
import { intakeRouter } from "./routes/intake.js";
import { errorMiddleware } from "./middleware/error.js";

export const app = new OpenAPIHono();

app.use("*", cors());
app.onError(errorMiddleware);

app.route("/api", categoriesRouter);
app.route("/api", projectsRouter);
app.route("/api", tasksRouter);
app.route("/api", intakeRouter);

app.doc("/api/doc", {
  openapi: "3.1.0",
  info: { title: "Time Tracker API", version: "1.0.0" },
});

export type AppType = typeof app;
