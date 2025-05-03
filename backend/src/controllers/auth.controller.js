import bcrypt from 'bcryptjs';
import { pool } from '../config/database.js';
import { generateTokens, validateEmailDomain } from '../utils/jwt.js';

class AuthController {
  // Login user
  async login(req, res) {
    try {
      const { email, password } = req.body;

      // Validate company email domain
      if (!validateEmailDomain(email)) {
        return res.status(401).json({
          message: `Only ${process.env.ALLOWED_EMAIL_DOMAIN} email addresses are allowed`
        });
      }

      // Check if user exists
      const userResult = await pool.query(
        'SELECT * FROM users WHERE email = $1',
        [email]
      );

      const user = userResult.rows[0];

      if (!user) {
        return res.status(401).json({
          message: 'Invalid credentials'
        });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password_hash);

      if (!isValidPassword) {
        return res.status(401).json({
          message: 'Invalid credentials'
        });
      }

      // Generate tokens
      const tokens = generateTokens(user);

      // Return user info and tokens
      res.json({
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          role: user.role
        },
        ...tokens
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        message: 'An error occurred during login'
      });
    }
  }

  // Create new user (admin only)
  async createUser(req, res) {
    try {
      const { email, password, fullName, role } = req.body;

      // Validate company email domain
      if (!validateEmailDomain(email)) {
        return res.status(400).json({
          message: `Only ${process.env.ALLOWED_EMAIL_DOMAIN} email addresses are allowed`
        });
      }

      // Check if user already exists
      const existingUser = await pool.query(
        'SELECT * FROM users WHERE email = $1',
        [email]
      );

      if (existingUser.rows.length > 0) {
        return res.status(400).json({
          message: 'User with this email already exists'
        });
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      // Create new user
      const newUser = await pool.query(
        `INSERT INTO users (email, password_hash, full_name, role)
         VALUES ($1, $2, $3, $4)
         RETURNING id, email, full_name, role`,
        [email, passwordHash, fullName, role]
      );

      res.status(201).json({
        message: 'User created successfully',
        user: newUser.rows[0]
      });
    } catch (error) {
      console.error('Create user error:', error);
      res.status(500).json({
        message: 'An error occurred while creating the user'
      });
    }
  }

  // Refresh access token
  async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          message: 'Refresh token is required'
        });
      }

      // Verify refresh token and generate new tokens
      const { valid, expired, decoded } = verifyRefreshToken(refreshToken);

      if (!valid || expired) {
        return res.status(401).json({
          message: 'Invalid or expired refresh token'
        });
      }

      // Get user from database to ensure they still exist and have same role
      const userResult = await pool.query(
        'SELECT * FROM users WHERE id = $1',
        [decoded.id]
      );

      const user = userResult.rows[0];

      if (!user) {
        return res.status(401).json({
          message: 'User no longer exists'
        });
      }

      // Generate new tokens
      const tokens = generateTokens(user);

      res.json(tokens);
    } catch (error) {
      console.error('Token refresh error:', error);
      res.status(500).json({
        message: 'An error occurred while refreshing the token'
      });
    }
  }

  // Get current user profile
  async getProfile(req, res) {
    try {
      const userId = req.user.id;

      const userResult = await pool.query(
        'SELECT id, email, full_name, role, created_at FROM users WHERE id = $1',
        [userId]
      );

      const user = userResult.rows[0];

      if (!user) {
        return res.status(404).json({
          message: 'User not found'
        });
      }

      res.json(user);
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({
        message: 'An error occurred while fetching the profile'
      });
    }
  }
}

export default new AuthController();
