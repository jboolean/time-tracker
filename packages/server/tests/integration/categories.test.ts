import { describe, test, expect, beforeEach } from "vitest";
import { app } from "../../src/app.js";
import { resetDB, testPrisma } from "../helpers/db.js";

beforeEach(async () => {
  await resetDB();
});

const BASE = "/api/categories";

const validCategory = {
  name: "Work",
  hue: 120,
  saturation: 70,
  lightness: 55,
};

describe("GET /api/categories", () => {
  test("returns empty array when no categories", async () => {
    const res = await app.request(BASE);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  test("returns categories", async () => {
    await testPrisma.category.create({ data: { name: "Work", hue: 120, keywords: "[]" } });
    const res = await app.request(BASE);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe("Work");
    expect(Array.isArray(body[0].keywords)).toBe(true);
  });
});

describe("POST /api/categories", () => {
  test("creates a category", async () => {
    const res = await app.request(BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validCategory),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe("Work");
    expect(body.hue).toBe(120);
    expect(body.id).toBeDefined();
    expect(body.createdAt).toBeDefined();
  });

  test("returns 422 on invalid body", async () => {
    const res = await app.request(BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "" }), // missing hue, invalid name
    });
    expect(res.status).toBe(422);
  });

  test("returns 400 on deep nesting", async () => {
    const parent = await testPrisma.category.create({
      data: { name: "Parent", hue: 0, keywords: "[]" },
    });
    const child = await testPrisma.category.create({
      data: { name: "Child", hue: 10, parentId: parent.id, keywords: "[]" },
    });

    const res = await app.request(BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...validCategory, parentId: child.id }),
    });
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/categories/:id", () => {
  test("updates a category", async () => {
    const cat = await testPrisma.category.create({
      data: { name: "Old", hue: 0, keywords: "[]" },
    });
    const res = await app.request(`${BASE}/${cat.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "New" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("New");
  });

  test("returns 404 if not found", async () => {
    const res = await app.request(`${BASE}/nonexistent-id`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "X" }),
    });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/categories/:id", () => {
  test("deletes a category", async () => {
    const cat = await testPrisma.category.create({
      data: { name: "ToDelete", hue: 0, keywords: "[]" },
    });
    const res = await app.request(`${BASE}/${cat.id}`, { method: "DELETE" });
    expect(res.status).toBe(204);
  });

  test("returns 409 if category has projects", async () => {
    const cat = await testPrisma.category.create({
      data: { name: "WithProject", hue: 0, keywords: "[]" },
    });
    await testPrisma.project.create({
      data: { name: "P", categoryId: cat.id, keywords: "[]" },
    });
    const res = await app.request(`${BASE}/${cat.id}`, { method: "DELETE" });
    expect(res.status).toBe(409);
  });

  test("returns 404 if not found", async () => {
    const res = await app.request(`${BASE}/nonexistent-id`, { method: "DELETE" });
    expect(res.status).toBe(404);
  });
});
