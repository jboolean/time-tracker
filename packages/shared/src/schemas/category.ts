import { z } from "zod";

export const CategorySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  hue: z.number().min(0).max(360),
  saturation: z.number().min(0).max(100).default(70),
  lightness: z.number().min(0).max(100).default(55),
  parentId: z.string().uuid().nullable().optional(),
  description: z.string().optional().nullable(),
  keywords: z.array(z.string()).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const CreateCategorySchema = CategorySchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const UpdateCategorySchema = CreateCategorySchema.partial();

export type Category = z.infer<typeof CategorySchema>;
export type CreateCategory = z.infer<typeof CreateCategorySchema>;
export type UpdateCategory = z.infer<typeof UpdateCategorySchema>;
