import { z } from "zod";

export const ProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  keywords: z.array(z.string()).default([]),
  isDefault: z.boolean().default(false),
  categoryId: z.string().uuid(),
  archived: z.boolean().default(false),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const CreateProjectSchema = ProjectSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  archived: true,
});

export const UpdateProjectSchema = CreateProjectSchema.partial();

export type Project = z.infer<typeof ProjectSchema>;
export type CreateProject = z.infer<typeof CreateProjectSchema>;
export type UpdateProject = z.infer<typeof UpdateProjectSchema>;
