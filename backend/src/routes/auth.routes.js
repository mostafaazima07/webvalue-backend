import express from 'express';
import { body } from 'express-validator';
import AuthController from '../controllers/auth.controller.js';
import { authenticateToken, isAdmin, validateCompanyEmail } from '../middleware/auth.middleware.js';

const router = express.Router();

// Validation middleware
const loginValidation = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
];

const createUserValidation = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('fullName')
    .trim()
    .notEmpty()
    .withMessage('Full name is required'),
  body('role')
    .isIn(['admin', 'employee'])
    .withMessage('Role must be either admin or employee')
];

// Routes
router.post('/login', 
  loginValidation,
  validateCompanyEmail,
  AuthController.login
);

router.post('/users', 
  authenticateToken,
  isAdmin,
  createUserValidation,
  validateCompanyEmail,
  AuthController.createUser
);

router.post('/refresh-token',
  body('refreshToken').notEmpty().withMessage('Refresh token is required'),
  AuthController.refreshToken
);

router.get('/profile',
  authenticateToken,
  AuthController.getProfile
);

export default router;
