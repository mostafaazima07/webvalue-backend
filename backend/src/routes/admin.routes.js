import express from 'express';
import { body, query, param } from 'express-validator';
import AdminController from '../controllers/admin.controller.js';
import { authenticateToken, isAdmin } from '../middleware/auth.middleware.js';

const router = express.Router();

// All admin routes require authentication and admin role
router.use(authenticateToken, isAdmin);

// Validation middleware
const performanceScoreValidation = [
  param('userId')
    .isInt()
    .withMessage('Valid user ID is required'),
  body('score')
    .isInt({ min: 0, max: 100 })
    .withMessage('Score must be between 0 and 100'),
  body('month')
    .isISO8601()
    .withMessage('Valid month date is required')
    .custom((value) => {
      const date = new Date(value);
      const now = new Date();
      if (date > now) {
        throw new Error('Performance score month cannot be in the future');
      }
      return true;
    }),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes must be less than 500 characters')
];

const exportDataValidation = [
  query('type')
    .isIn(['tasks', 'users', 'performance'])
    .withMessage('Invalid export type'),
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid start date format'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid end date format')
    .custom((endDate, { req }) => {
      if (req.query.startDate && new Date(endDate) < new Date(req.query.startDate)) {
        throw new Error('End date must be after start date');
      }
      return true;
    })
];

// Routes
router.get('/users',
  AdminController.getAllUsers
);

router.get('/users/:userId/analytics',
  param('userId').isInt().withMessage('Valid user ID is required'),
  AdminController.getUserAnalytics
);

router.post('/users/:userId/performance',
  performanceScoreValidation,
  AdminController.updatePerformanceScore
);

router.get('/analytics',
  AdminController.getSystemAnalytics
);

router.get('/export',
  exportDataValidation,
  AdminController.exportData
);

export default router;
