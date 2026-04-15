import { prisma } from "../lib/prisma.js";
import { serializeCategory } from "../lib/serialize.js";
import { AppError } from "../lib/errors.js";
import type { CreateCategory, UpdateCategory } from "@time-tracker/shared";

export async function listCategories() {
  const cats = await prisma.category.findMany({ orderBy: { createdAt: "asc" } });
  return cats.map(serializeCategory);
}

export async function createCategory(data: CreateCategory) {
  if (data.parentId) {
    const parent = await prisma.category.findUnique({ where: { id: data.parentId } });
    if (!parent) {
      throw new AppError(404, "Parent category not found");
    }
    if (parent.parentId) {
      throw new AppError(400, "Categories can only be nested one level deep");
    }
  }

  const cat = await prisma.category.create({
    data: {
      name: data.name,
      hue: data.hue,
      saturation: data.saturation ?? 70,
      lightness: data.lightness ?? 55,
      parentId: data.parentId ?? null,
      description: data.description ?? null,
      keywords: JSON.stringify(data.keywords ?? []),
    },
  });
  return serializeCategory(cat);
}

export async function updateCategory(id: string, data: UpdateCategory) {
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError(404, "Category not found");
  }

  if (data.parentId) {
    const parent = await prisma.category.findUnique({ where: { id: data.parentId } });
    if (!parent) {
      throw new AppError(404, "Parent category not found");
    }
    if (parent.parentId) {
      throw new AppError(400, "Categories can only be nested one level deep");
    }
  }

  const updated = await prisma.category.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.hue !== undefined && { hue: data.hue }),
      ...(data.saturation !== undefined && { saturation: data.saturation }),
      ...(data.lightness !== undefined && { lightness: data.lightness }),
      ...(data.parentId !== undefined && { parentId: data.parentId }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.keywords !== undefined && { keywords: JSON.stringify(data.keywords) }),
    },
  });
  return serializeCategory(updated);
}

export async function deleteCategory(id: string) {
  const existing = await prisma.category.findUnique({ where: { id }, include: { projects: true } });
  if (!existing) {
    throw new AppError(404, "Category not found");
  }
  if (existing.projects.length > 0) {
    throw new AppError(409, "Cannot delete category with existing projects");
  }
  await prisma.category.delete({ where: { id } });
}
