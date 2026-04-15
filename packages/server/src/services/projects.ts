import { prisma } from "../lib/prisma.js";
import { serializeProject } from "../lib/serialize.js";
import { AppError } from "../lib/errors.js";
import type { CreateProject, UpdateProject } from "@time-tracker/shared";

export async function listProjects(filters?: { categoryId?: string }) {
  const projects = await prisma.project.findMany({
    where: filters?.categoryId ? { categoryId: filters.categoryId } : undefined,
    orderBy: { createdAt: "asc" },
  });
  return projects.map(serializeProject);
}

export async function createProject(data: CreateProject) {
  const project = await prisma.project.create({
    data: {
      name: data.name,
      description: data.description ?? null,
      keywords: JSON.stringify(data.keywords ?? []),
      isDefault: data.isDefault ?? false,
      categoryId: data.categoryId,
    },
  });
  return serializeProject(project);
}

export async function updateProject(id: string, data: UpdateProject) {
  const existing = await prisma.project.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError(404, "Project not found");
  }

  const updated = await prisma.project.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.keywords !== undefined && { keywords: JSON.stringify(data.keywords) }),
      ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
      ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
    },
  });
  return serializeProject(updated);
}

export async function deleteProject(id: string) {
  const existing = await prisma.project.findUnique({ where: { id }, include: { tasks: true } });
  if (!existing) {
    throw new AppError(404, "Project not found");
  }
  if (existing.tasks.length > 0) {
    throw new AppError(409, "Cannot delete project with existing tasks");
  }
  await prisma.project.delete({ where: { id } });
}
