import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.js';

export const authRoutes = Router();

authRoutes.post('/login', (req, res, next) => authController.login(req, res, next));
authRoutes.post('/logout', (req, res, next) => authController.logout(req, res, next));
authRoutes.get('/me', requireAuth, (req, res, next) => authController.me(req, res, next));
