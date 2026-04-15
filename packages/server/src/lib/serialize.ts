import type { Category, Project, Task } from "@prisma/client";

export function serializeCategory(cat: Category) {
  return {
    id: cat.id,
    name: cat.name,
    hue: cat.hue,
    saturation: cat.saturation,
    lightness: cat.lightness,
    parentId: cat.parentId ?? null,
    description: cat.description ?? null,
    keywords: JSON.parse(cat.keywords) as string[],
    createdAt: cat.createdAt.toISOString(),
    updatedAt: cat.updatedAt.toISOString(),
  };
}

export function serializeProject(proj: Project) {
  return {
    id: proj.id,
    name: proj.name,
    description: proj.description ?? null,
    keywords: JSON.parse(proj.keywords) as string[],
    isDefault: proj.isDefault,
    categoryId: proj.categoryId,
    archived: proj.archived,
    createdAt: proj.createdAt.toISOString(),
    updatedAt: proj.updatedAt.toISOString(),
  };
}

export function serializeTask(task: Task) {
  return {
    id: task.id,
    title: task.title ?? null,
    description: task.description ?? null,
    rawInput: task.rawInput ?? null,
    projectId: task.projectId,
    startTime: task.startTime.toISOString(),
    endTime: task.endTime ? task.endTime.toISOString() : null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}
