import { Router } from 'express';
import { equipmentController } from '../controllers/equipment.controller.js';

export const equipmentRoutes = Router();

equipmentRoutes.get('/', (req, res, next) => equipmentController.list(req, res, next));
equipmentRoutes.post('/', (req, res, next) => equipmentController.create(req, res, next));
equipmentRoutes.put('/:id', (req, res, next) => equipmentController.update(req, res, next));
equipmentRoutes.delete('/:id', (req, res, next) => equipmentController.delete(req, res, next));

