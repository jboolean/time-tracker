import { prisma } from "../lib/prisma.js";
import { serializeTask } from "../lib/serialize.js";
import { AppError } from "../lib/errors.js";
import type { CreateTask, UpdateTask } from "@time-tracker/shared";

export async function listTasks(filters?: {
  startTime?: string;
  endTime?: string;
  projectId?: string;
  categoryId?: string;
}) {
  const where: Record<string, unknown> = {};

  if (filters?.startTime || filters?.endTime) {
    where.startTime = {
      ...(filters.startTime && { gte: new Date(filters.startTime) }),
      ...(filters.endTime && { lte: new Date(filters.endTime) }),
    };
  }

  if (filters?.projectId) {
    where.projectId = filters.projectId;
  }

  if (filters?.categoryId) {
    where.project = { categoryId: filters.categoryId };
  }

  const tasks = await prisma.task.findMany({ where, orderBy: { startTime: "asc" } });
  return tasks.map(serializeTask);
}

export async function getActiveTask() {
  const task = await prisma.task.findFirst({ where: { endTime: null } });
  return task ? serializeTask(task) : null;
}

export async function createTask(data: CreateTask) {
  if (!data.endTime) {
    const active = await prisma.task.findFirst({ where: { endTime: null } });
    if (active) {
      throw new AppError(409, "A task is already active");
    }
  }

  const task = await prisma.task.create({
    data: {
      title: data.title ?? null,
      description: data.description ?? null,
      rawInput: data.rawInput ?? null,
      projectId: data.projectId,
      startTime: new Date(data.startTime),
      endTime: data.endTime ? new Date(data.endTime) : null,
    },
  });
  return serializeTask(task);
}

export async function updateTask(id: string, data: UpdateTask) {
  const existing = await prisma.task.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError(404, "Task not found");
  }

  const updated = await prisma.task.update({
    where: { id },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.rawInput !== undefined && { rawInput: data.rawInput }),
      ...(data.projectId !== undefined && { projectId: data.projectId }),
      ...(data.startTime !== undefined && { startTime: new Date(data.startTime) }),
      ...(data.endTime !== undefined && { endTime: data.endTime ? new Date(data.endTime) : null }),
    },
  });
  return serializeTask(updated);
}

export async function deleteTask(id: string) {
  const existing = await prisma.task.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError(404, "Task not found");
  }
  await prisma.task.delete({ where: { id } });
}

export async function endTask(id: string) {
  const existing = await prisma.task.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError(404, "Task not found");
  }
  if (existing.endTime !== null) {
    throw new AppError(409, "Task is already ended");
  }
  const updated = await prisma.task.update({
    where: { id },
    data: { endTime: new Date() },
  });
  return serializeTask(updated);
}
