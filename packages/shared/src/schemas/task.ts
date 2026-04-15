import { z } from "zod";

export const TaskSchema = z.object({
  id: z.string().uuid(),
  title: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  rawInput: z.string().optional().nullable(),
  projectId: z.string().uuid(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const CreateTaskSchema = TaskSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const UpdateTaskSchema = CreateTaskSchema.partial();

export type Task = z.infer<typeof TaskSchema>;
export type CreateTask = z.infer<typeof CreateTaskSchema>;
export type UpdateTask = z.infer<typeof UpdateTaskSchema>;
