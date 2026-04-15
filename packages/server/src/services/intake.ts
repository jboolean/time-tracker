import { prisma } from "../lib/prisma.js";
import { serializeTask } from "../lib/serialize.js";
import { AppError } from "../lib/errors.js";
import type { Intake } from "@time-tracker/shared";

export async function processIntake(data: Intake) {
  // End currently active task if one exists
  const active = await prisma.task.findFirst({ where: { endTime: null } });
  if (active) {
    await prisma.task.update({ where: { id: active.id }, data: { endTime: new Date() } });
  }

  // Resolve project
  let projectId = data.projectId;
  if (!projectId) {
    const defaultProject = await prisma.project.findFirst({ where: { isDefault: true } });
    if (!defaultProject) {
      throw new AppError(400, "No default project found. Please specify a projectId.");
    }
    projectId = defaultProject.id;
  }

  const task = await prisma.task.create({
    data: {
      rawInput: data.rawInput,
      projectId,
      startTime: data.startTime ? new Date(data.startTime) : new Date(),
      endTime: null,
    },
  });
  return serializeTask(task);
}
