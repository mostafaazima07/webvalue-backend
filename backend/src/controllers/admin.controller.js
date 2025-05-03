import { pool } from '../config/database.js';

class AdminController {
  // Get all users
  async getAllUsers(req, res) {
    try {
      const result = await pool.query(
        `SELECT 
          id, email, full_name, role, created_at,
          (SELECT COUNT(*) FROM tasks WHERE assigned_to = users.id) as assigned_tasks_count,
          (SELECT COUNT(*) FROM tasks WHERE assigned_to = users.id AND status = 'COMPLETED') as completed_tasks_count
         FROM users
         ORDER BY created_at DESC`
      );

      res.json(result.rows);
    } catch (error) {
      console.error('Get all users error:', error);
      res.status(500).json({
        message: 'An error occurred while fetching users'
      });
    }
  }

  // Get user analytics
  async getUserAnalytics(req, res) {
    try {
      const { userId } = req.params;

      // Get user details and task statistics
      const userAnalytics = await pool.query(
        `SELECT 
          u.id,
          u.email,
          u.full_name,
          u.role,
          COUNT(t.id) as total_tasks,
          COUNT(CASE WHEN t.status = 'COMPLETED' THEN 1 END) as completed_tasks,
          COUNT(CASE WHEN t.status = 'IN_PROGRESS' THEN 1 END) as in_progress_tasks,
          COUNT(CASE WHEN t.status = 'NOT_STARTED' THEN 1 END) as not_started_tasks,
          COUNT(CASE WHEN t.status = 'COMPLETED' AND t.deadline < t.updated_at THEN 1 END) as overdue_completed_tasks
         FROM users u
         LEFT JOIN tasks t ON t.assigned_to = u.id
         WHERE u.id = $1
         GROUP BY u.id`,
        [userId]
      );

      if (userAnalytics.rows.length === 0) {
        return res.status(404).json({
          message: 'User not found'
        });
      }

      // Get monthly performance scores
      const performanceScores = await pool.query(
        `SELECT score, month, notes
         FROM performance_scores
         WHERE user_id = $1
         ORDER BY month DESC
         LIMIT 12`,
        [userId]
      );

      // Get recent tasks
      const recentTasks = await pool.query(
        `SELECT 
          t.*,
          creator.full_name as assigned_by_name
         FROM tasks t
         LEFT JOIN users creator ON t.assigned_by = creator.id
         WHERE t.assigned_to = $1
         ORDER BY t.created_at DESC
         LIMIT 5`,
        [userId]
      );

      res.json({
        ...userAnalytics.rows[0],
        performance_history: performanceScores.rows,
        recent_tasks: recentTasks.rows
      });
    } catch (error) {
      console.error('Get user analytics error:', error);
      res.status(500).json({
        message: 'An error occurred while fetching user analytics'
      });
    }
  }

  // Update user performance score
  async updatePerformanceScore(req, res) {
    const client = await pool.connect();
    try {
      const { userId } = req.params;
      const { score, month, notes } = req.body;

      await client.query('BEGIN');

      // Check if user exists
      const userExists = await client.query(
        'SELECT id FROM users WHERE id = $1',
        [userId]
      );

      if (userExists.rows.length === 0) {
        return res.status(404).json({
          message: 'User not found'
        });
      }

      // Update or insert performance score
      const result = await client.query(
        `INSERT INTO performance_scores (user_id, score, month, notes)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, month) DO UPDATE
         SET score = EXCLUDED.score,
             notes = EXCLUDED.notes,
             updated_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [userId, score, month, notes]
      );

      await client.query('COMMIT');

      res.json({
        message: 'Performance score updated successfully',
        performance_score: result.rows[0]
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Update performance score error:', error);
      res.status(500).json({
        message: 'An error occurred while updating performance score'
      });
    } finally {
      client.release();
    }
  }

  // Get system analytics
  async getSystemAnalytics(req, res) {
    try {
      // Get overall task statistics
      const taskStats = await pool.query(
        `SELECT
          COUNT(*) as total_tasks,
          COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed_tasks,
          COUNT(CASE WHEN status = 'IN_PROGRESS' THEN 1 END) as in_progress_tasks,
          COUNT(CASE WHEN status = 'NOT_STARTED' THEN 1 END) as not_started_tasks,
          COUNT(CASE WHEN status = 'COMPLETED' AND deadline < updated_at THEN 1 END) as overdue_completed_tasks
         FROM tasks`
      );

      // Get user statistics
      const userStats = await pool.query(
        `SELECT
          COUNT(*) as total_users,
          COUNT(CASE WHEN role = 'admin' THEN 1 END) as admin_count,
          COUNT(CASE WHEN role = 'employee' THEN 1 END) as employee_count
         FROM users`
      );

      // Get top performing users
      const topPerformers = await pool.query(
        `SELECT 
          u.id,
          u.full_name,
          COUNT(t.id) as total_tasks,
          COUNT(CASE WHEN t.status = 'COMPLETED' AND t.deadline >= t.updated_at THEN 1 END) as on_time_completions,
          ROUND(AVG(ps.score), 2) as avg_performance_score
         FROM users u
         LEFT JOIN tasks t ON t.assigned_to = u.id
         LEFT JOIN performance_scores ps ON ps.user_id = u.id
         WHERE u.role = 'employee'
         GROUP BY u.id, u.full_name
         ORDER BY avg_performance_score DESC NULLS LAST
         LIMIT 5`
      );

      res.json({
        task_statistics: taskStats.rows[0],
        user_statistics: userStats.rows[0],
        top_performers: topPerformers.rows
      });
    } catch (error) {
      console.error('Get system analytics error:', error);
      res.status(500).json({
        message: 'An error occurred while fetching system analytics'
      });
    }
  }

  // Export data
  async exportData(req, res) {
    try {
      const { type, startDate, endDate } = req.query;

      let data;
      switch (type) {
        case 'tasks':
          data = await pool.query(
            `SELECT 
              t.*,
              creator.full_name as assigned_by_name,
              assignee.full_name as assigned_to_name
             FROM tasks t
             LEFT JOIN users creator ON t.assigned_by = creator.id
             LEFT JOIN users assignee ON t.assigned_to = assignee.id
             WHERE ($1::date IS NULL OR t.created_at >= $1)
             AND ($2::date IS NULL OR t.created_at <= $2)
             ORDER BY t.created_at DESC`,
            [startDate, endDate]
          );
          break;

        case 'users':
          data = await pool.query(
            `SELECT 
              u.*,
              COUNT(t.id) as total_tasks,
              COUNT(CASE WHEN t.status = 'COMPLETED' THEN 1 END) as completed_tasks
             FROM users u
             LEFT JOIN tasks t ON t.assigned_to = u.id
             GROUP BY u.id
             ORDER BY u.created_at DESC`
          );
          break;

        case 'performance':
          data = await pool.query(
            `SELECT 
              u.full_name,
              ps.score,
              ps.month,
              ps.notes
             FROM performance_scores ps
             JOIN users u ON u.id = ps.user_id
             WHERE ($1::date IS NULL OR ps.month >= $1)
             AND ($2::date IS NULL OR ps.month <= $2)
             ORDER BY ps.month DESC, u.full_name`,
            [startDate, endDate]
          );
          break;

        default:
          return res.status(400).json({
            message: 'Invalid export type'
          });
      }

      res.json({
        type,
        data: data.rows
      });
    } catch (error) {
      console.error('Export data error:', error);
      res.status(500).json({
        message: 'An error occurred while exporting data'
      });
    }
  }
}

export default new AdminController();
