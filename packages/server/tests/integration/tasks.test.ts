import { describe, test, expect, beforeEach } from "vitest";
import { app } from "../../src/app.js";
import { resetDB, testPrisma } from "../helpers/db.js";

beforeEach(async () => {
  await resetDB();
});

const BASE = "/api/tasks";

async function makeProject() {
  const cat = await testPrisma.category.create({ data: { name: "C", hue: 0, keywords: "[]" } });
  return testPrisma.project.create({ data: { name: "P", categoryId: cat.id, keywords: "[]" } });
}

describe("GET /api/tasks", () => {
  test("returns empty array", async () => {
    const res = await app.request(BASE);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  test("filters by date range", async () => {
    const proj = await makeProject();
    const now = new Date();
    const yesterday = new Date(now.getTime() - 86400000);
    const tomorrow = new Date(now.getTime() + 86400000);
    const twoDaysAgo = new Date(now.getTime() - 2 * 86400000);

    await testPrisma.task.create({ data: { projectId: proj.id, startTime: now } });
    await testPrisma.task.create({ data: { projectId: proj.id, startTime: twoDaysAgo } });

    const res = await app.request(
      `${BASE}?startTime=${yesterday.toISOString()}&endTime=${tomorrow.toISOString()}`
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
  });
});

describe("GET /api/tasks/active", () => {
  test("returns 404 when no active task", async () => {
    const res = await app.request(`${BASE}/active`);
    expect(res.status).toBe(404);
  });

  test("returns active task", async () => {
    const proj = await makeProject();
    await testPrisma.task.create({ data: { projectId: proj.id, startTime: new Date(), endTime: null } });
    const res = await app.request(`${BASE}/active`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.endTime).toBeNull();
  });
});

describe("POST /api/tasks", () => {
  test("creates a task", async () => {
    const proj = await makeProject();
    const res = await app.request(BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: proj.id,
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 3600000).toISOString(),
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.projectId).toBe(proj.id);
  });

  test("returns 409 if active task exists when creating open-ended task", async () => {
    const proj = await makeProject();
    await testPrisma.task.create({ data: { projectId: proj.id, startTime: new Date() } });

    const res = await app.request(BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: proj.id, startTime: new Date().toISOString() }),
    });
    expect(res.status).toBe(409);
  });
});

describe("PATCH /api/tasks/:id", () => {
  test("updates a task", async () => {
    const proj = await makeProject();
    const task = await testPrisma.task.create({
      data: { projectId: proj.id, startTime: new Date(), title: "Old" },
    });
    const res = await app.request(`${BASE}/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.title).toBe("New");
  });
});

describe("DELETE /api/tasks/:id", () => {
  test("deletes a task", async () => {
    const proj = await makeProject();
    const task = await testPrisma.task.create({ data: { projectId: proj.id, startTime: new Date() } });
    const res = await app.request(`${BASE}/${task.id}`, { method: "DELETE" });
    expect(res.status).toBe(204);
  });

  test("returns 404 if not found", async () => {
    const res = await app.request(`${BASE}/nonexistent`, { method: "DELETE" });
    expect(res.status).toBe(404);
  });
});

describe("POST /api/tasks/:id/end", () => {
  test("ends an active task", async () => {
    const proj = await makeProject();
    const task = await testPrisma.task.create({ data: { projectId: proj.id, startTime: new Date() } });
    const res = await app.request(`${BASE}/${task.id}/end`, { method: "POST" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.endTime).not.toBeNull();
  });

  test("returns 409 if already ended", async () => {
    const proj = await makeProject();
    const task = await testPrisma.task.create({
      data: { projectId: proj.id, startTime: new Date(), endTime: new Date() },
    });
    const res = await app.request(`${BASE}/${task.id}/end`, { method: "POST" });
    expect(res.status).toBe(409);
  });

  test("returns 404 if not found", async () => {
    const res = await app.request(`${BASE}/nonexistent/end`, { method: "POST" });
    expect(res.status).toBe(404);
  });
});
