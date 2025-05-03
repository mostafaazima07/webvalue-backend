import express from 'express';
import { body, query, param } from 'express-validator';
import TaskController from '../controllers/task.controller.js';
import { authenticateToken, canUpdateTask } from '../middleware/auth.middleware.js';

const router = express.Router();

// Validation middleware
const createTaskValidation = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Task title is required')
    .isLength({ max: 255 })
    .withMessage('Task title must be less than 255 characters'),
  body('description')
    .optional()
    .trim(),
  body('assignedTo')
    .isInt()
    .withMessage('Valid assignee ID is required'),
  body('deadline')
    .isISO8601()
    .withMessage('Valid deadline date is required')
    .custom((value) => {
      if (new Date(value) < new Date()) {
        throw new Error('Deadline cannot be in the past');
      }
      return true;
    }),
  body('notes')
    .optional()
    .trim()
];

const updateTaskStatusValidation = [
  param('taskId')
    .isInt()
    .withMessage('Valid task ID is required'),
  body('status')
    .isIn(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'])
    .withMessage('Invalid task status')
];

const getTasksValidation = [
  query('status')
    .optional()
    .isIn(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'])
    .withMessage('Invalid status filter'),
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
router.post('/',
  authenticateToken,
  createTaskValidation,
  TaskController.createTask
);

router.get('/',
  authenticateToken,
  getTasksValidation,
  TaskController.getUserTasks
);

router.get('/:taskId',
  authenticateToken,
  param('taskId').isInt().withMessage('Valid task ID is required'),
  TaskController.getTaskDetails
);

router.patch('/:taskId/status',
  authenticateToken,
  updateTaskStatusValidation,
  canUpdateTask,
  TaskController.updateTaskStatus
);

export default router;
