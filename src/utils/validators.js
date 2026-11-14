import { z } from 'zod';

export const registerSchema = z.object({
  user_name: z.string().trim().min(3).max(32).regex(/^[A-Za-z0-9_]+$/),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(128),
  relation: z.enum(['normal', 'friends', 'acquaintance', 'family', 'business']).optional()
});
