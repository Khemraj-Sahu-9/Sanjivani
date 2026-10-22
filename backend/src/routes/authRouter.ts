/**
 * backend/src/routes/authRouter.ts
 *
 * Authentication routes.
 */

import { Router } from 'express';
import { register, login, getCurrentUser, requestPasswordReset } from '../controllers/authController.js';
import { requireAuth } from '../middlewares/auth.js';

export const authRouter = Router();

authRouter.post('/register', register);
authRouter.post('/login', login);
authRouter.get('/me', requireAuth, getCurrentUser);
authRouter.post('/recover-password', requestPasswordReset);
