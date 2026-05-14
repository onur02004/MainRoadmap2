import { z } from 'zod';

export const registerSchema = z.object({
  user_name: z.string().min(3).max(32).regex(/^[A-Za-z0-9_]+$/),
  email: z.string().email(),
  password: z.string().min(8),
  relation: z.enum(['normal', 'friends', 'acquaintance', 'family', 'business']).optional()
});