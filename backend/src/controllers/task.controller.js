import { pool } from '../config/database.js';
import { sendTaskNotification } from '../utils/email.js';
import { createCalendarEvent } from '../utils/calendar.js';

class TaskController {
  // Create a new task
  async createTask(req, res) {
    const client = await pool.connect();
    try {
      const { title, description, assignedTo, deadline, notes } = req.body;
      const assignedBy = req.user.id;

      await client.query('BEGIN');

      // Create task
      const taskResult = await client.query(
        `INSERT INTO tasks 
         (title, description, assigned_by, assigned_to, deadline, status, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [title, description, assignedBy, assignedTo, deadline, 'NOT_STARTED', notes]
      );

      const task = taskResult.rows[0];

      // Create calendar events
      const calendarEvent = await createCalendarEvent({
        title,
        description,
        startTime: deadline,
        assigneeId: assignedTo
      });

      // Store calendar event IDs
      if (calendarEvent) {
        await client.query(
          `INSERT INTO calendar_events 
           (task_id, google_event_id, microsoft_event_id)
           VALUES ($1, $2, $3)`,
          [task.id, calendarEvent.googleEventId, calendarEvent.microsoftEventId]
        );
      }

      // Send email notification
      await sendTaskNotification({
        taskId: task.id,
        assigneeId: assignedTo,
        assignerId: assignedBy,
        deadline
      });

      await client.query('COMMIT');

      res.status(201).json({
        message: 'Task created successfully',
        task
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Create task error:', error);
      res.status(500).json({
        message: 'An error occurred while creating the task'
      });
    } finally {
      client.release();
    }
  }

  // Get tasks for current user (assigned to them or created by them)
  async getUserTasks(req, res) {
    try {
      const userId = req.user.id;
      const { status, startDate, endDate } = req.query;

      let query = `
        SELECT 
          t.*,
          creator.full_name as assigned_by_name,
          assignee.full_name as assigned_to_name
        FROM tasks t
        LEFT JOIN users creator ON t.assigned_by = creator.id
        LEFT JOIN users assignee ON t.assigned_to = assignee.id
        WHERE (t.assigned_to = $1 OR t.assigned_by = $1)
      `;

      const queryParams = [userId];
      let paramCount = 1;

      if (status) {
        paramCount++;
        query += ` AND t.status = $${paramCount}`;
        queryParams.push(status);
      }

      if (startDate) {
        paramCount++;
        query += ` AND t.deadline >= $${paramCount}`;
        queryParams.push(startDate);
      }

      if (endDate) {
        paramCount++;
        query += ` AND t.deadline <= $${paramCount}`;
        queryParams.push(endDate);
      }

      query += ' ORDER BY t.deadline ASC';

      const result = await pool.query(query, queryParams);

      res.json(result.rows);
    } catch (error) {
      console.error('Get user tasks error:', error);
      res.status(500).json({
        message: 'An error occurred while fetching tasks'
      });
    }
  }

  // Update task status
  async updateTaskStatus(req, res) {
    const client = await pool.connect();
    try {
      const { taskId } = req.params;
      const { status } = req.body;
      const userId = req.user.id;

      await client.query('BEGIN');

      // Get task details
      const taskResult = await client.query(
        'SELECT * FROM tasks WHERE id = $1',
        [taskId]
      );

      const task = taskResult.rows[0];

      if (!task) {
        return res.status(404).json({
          message: 'Task not found'
        });
      }

      // Verify user is the assignee
      if (task.assigned_to !== userId && req.user.role !== 'admin') {
        return res.status(403).json({
          message: 'Only the assigned user can update task status'
        });
      }

      // Update task status
      const updatedTask = await client.query(
        `UPDATE tasks 
         SET status = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING *`,
        [status, taskId]
      );

      // If task is completed, update calendar events
      if (status === 'COMPLETED') {
        // Update or delete calendar events as needed
        // Implementation depends on calendar service requirements
      }

      await client.query('COMMIT');

      res.json({
        message: 'Task status updated successfully',
        task: updatedTask.rows[0]
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Update task status error:', error);
      res.status(500).json({
        message: 'An error occurred while updating task status'
      });
    } finally {
      client.release();
    }
  }

  // Get task details
  async getTaskDetails(req, res) {
    try {
      const { taskId } = req.params;
      const userId = req.user.id;

      const result = await pool.query(
        `SELECT 
          t.*,
          creator.full_name as assigned_by_name,
          assignee.full_name as assigned_to_name
         FROM tasks t
         LEFT JOIN users creator ON t.assigned_by = creator.id
         LEFT JOIN users assignee ON t.assigned_to = assignee.id
         WHERE t.id = $1 AND 
         (t.assigned_to = $2 OR t.assigned_by = $2 OR $3 = 'admin')`,
        [taskId, userId, req.user.role]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          message: 'Task not found or access denied'
        });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Get task details error:', error);
      res.status(500).json({
        message: 'An error occurred while fetching task details'
      });
    }
  }
}

export default new TaskController();
