import { describe, test, expect, beforeEach } from "vitest";
import { app } from "../../src/app.js";
import { resetDB, testPrisma } from "../helpers/db.js";

beforeEach(async () => {
  await resetDB();
});

const BASE = "/api/projects";

async function makeCategory(name = "Cat") {
  return testPrisma.category.create({ data: { name, hue: 0, keywords: "[]" } });
}

describe("GET /api/projects", () => {
  test("returns empty array", async () => {
    const res = await app.request(BASE);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  test("returns projects filtered by categoryId", async () => {
    const cat1 = await makeCategory("C1");
    const cat2 = await makeCategory("C2");
    await testPrisma.project.create({ data: { name: "P1", categoryId: cat1.id, keywords: "[]" } });
    await testPrisma.project.create({ data: { name: "P2", categoryId: cat2.id, keywords: "[]" } });

    const res = await app.request(`${BASE}?categoryId=${cat1.id}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe("P1");
  });
});

describe("POST /api/projects", () => {
  test("creates a project", async () => {
    const cat = await makeCategory();
    const res = await app.request(BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "My Project", categoryId: cat.id }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe("My Project");
    expect(body.categoryId).toBe(cat.id);
    expect(Array.isArray(body.keywords)).toBe(true);
  });
});

describe("PATCH /api/projects/:id", () => {
  test("updates a project", async () => {
    const cat = await makeCategory();
    const proj = await testPrisma.project.create({
      data: { name: "Old", categoryId: cat.id, keywords: "[]" },
    });
    const res = await app.request(`${BASE}/${proj.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "New" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("New");
  });

  test("returns 404 if not found", async () => {
    const res = await app.request(`${BASE}/nonexistent`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "X" }),
    });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/projects/:id", () => {
  test("deletes a project", async () => {
    const cat = await makeCategory();
    const proj = await testPrisma.project.create({
      data: { name: "P", categoryId: cat.id, keywords: "[]" },
    });
    const res = await app.request(`${BASE}/${proj.id}`, { method: "DELETE" });
    expect(res.status).toBe(204);
  });

  test("returns 409 if project has tasks", async () => {
    const cat = await makeCategory();
    const proj = await testPrisma.project.create({
      data: { name: "P", categoryId: cat.id, keywords: "[]" },
    });
    await testPrisma.task.create({
      data: { projectId: proj.id, startTime: new Date() },
    });
    const res = await app.request(`${BASE}/${proj.id}`, { method: "DELETE" });
    expect(res.status).toBe(409);
  });

  test("returns 404 if not found", async () => {
    const res = await app.request(`${BASE}/nonexistent`, { method: "DELETE" });
    expect(res.status).toBe(404);
  });
});
