import { verifyAccessToken } from '../utils/jwt.js';

// Authenticate JWT token
export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ message: 'Authentication token is required' });
  }

  const { valid, expired, decoded } = verifyAccessToken(token);

  if (expired) {
    return res.status(401).json({ message: 'Token has expired' });
  }

  if (!valid) {
    return res.status(401).json({ message: 'Invalid token' });
  }

  // Attach user to request object
  req.user = decoded;
  next();
};

// Check if user is admin
export const isAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }

  next();
};

// Check if user is accessing their own resources or is admin
export const isOwnerOrAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  // Allow if user is admin
  if (req.user.role === 'admin') {
    return next();
  }

  // Check if user is accessing their own resource
  const resourceUserId = parseInt(req.params.userId) || parseInt(req.body.userId);
  if (req.user.id !== resourceUserId) {
    return res.status(403).json({ message: 'Unauthorized access to resource' });
  }

  next();
};

// Validate task ownership for updates
export const canUpdateTask = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  const taskId = parseInt(req.params.taskId);
  
  try {
    // Get task from database (to be implemented in task service)
    const task = await req.app.locals.taskService.getTaskById(taskId);
    
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Admin can update any task
    if (req.user.role === 'admin') {
      return next();
    }

    // For status updates, only the assignee can update
    if (req.body.status && task.assigned_to !== req.user.id) {
      return res.status(403).json({ 
        message: 'Only the assigned user can update task status' 
      });
    }

    // For other updates, only the creator can update
    if (task.assigned_by !== req.user.id) {
      return res.status(403).json({ 
        message: 'Only the task creator can update task details' 
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};

// Validate company email domain
export const validateCompanyEmail = (req, res, next) => {
  const { email } = req.body;
  const domain = email.split('@')[1];

  if (domain !== process.env.ALLOWED_EMAIL_DOMAIN) {
    return res.status(400).json({ 
      message: `Only ${process.env.ALLOWED_EMAIL_DOMAIN} email addresses are allowed` 
    });
  }

  next();
};
