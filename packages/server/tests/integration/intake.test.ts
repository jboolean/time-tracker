import { describe, test, expect, beforeEach } from "vitest";
import { app } from "../../src/app.js";
import { resetDB, testPrisma } from "../helpers/db.js";

beforeEach(async () => {
  await resetDB();
});

const BASE = "/api/intake";

async function makeDefaultProject() {
  const cat = await testPrisma.category.create({ data: { name: "C", hue: 0, keywords: "[]" } });
  return testPrisma.project.create({
    data: { name: "Default", categoryId: cat.id, keywords: "[]", isDefault: true },
  });
}

describe("POST /api/intake", () => {
  test("creates a task with rawInput under a specified project", async () => {
    const proj = await makeDefaultProject();
    const res = await app.request(BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rawInput: "Working on stuff", projectId: proj.id }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.rawInput).toBe("Working on stuff");
    expect(body.projectId).toBe(proj.id);
    expect(body.endTime).toBeNull();
  });

  test("uses default project when no projectId provided", async () => {
    const proj = await makeDefaultProject();
    const res = await app.request(BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rawInput: "Doing things" }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.projectId).toBe(proj.id);
  });

  test("closes active task and creates new one", async () => {
    const proj = await makeDefaultProject();
    const activeTask = await testPrisma.task.create({
      data: { projectId: proj.id, startTime: new Date(), rawInput: "Old task" },
    });

    const res = await app.request(BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rawInput: "New task", projectId: proj.id }),
    });
    expect(res.status).toBe(201);

    // Old task should be ended
    const oldTask = await testPrisma.task.findUnique({ where: { id: activeTask.id } });
    expect(oldTask?.endTime).not.toBeNull();

    // New task is the active one
    const body = await res.json();
    expect(body.rawInput).toBe("New task");
    expect(body.endTime).toBeNull();
  });

  test("returns 400 if no default project and no projectId", async () => {
    const res = await app.request(BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rawInput: "Something" }),
    });
    expect(res.status).toBe(400);
  });

  test("returns 422 on invalid body", async () => {
    const res = await app.request(BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rawInput: "" }), // empty string fails min(1)
    });
    expect(res.status).toBe(422);
  });
});
