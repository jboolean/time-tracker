import { z } from "zod";

export const IntakeSchema = z.object({
  rawInput: z.string().min(1),
  projectId: z.string().uuid().optional(),
  startTime: z.string().datetime().optional(),
});

export type Intake = z.infer<typeof IntakeSchema>;
