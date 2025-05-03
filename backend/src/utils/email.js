import nodemailer from 'nodemailer';
import { pool } from '../config/database.js';

// Create reusable transporter object using SMTP transport
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_PORT === '465',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Verify SMTP connection
transporter.verify((error, success) => {
  if (error) {
    console.error('SMTP connection error:', error);
  } else {
    console.log('SMTP server is ready to send emails');
  }
});

// Email templates
const emailTemplates = {
  taskAssignment: (task, assignee, assigner) => ({
    subject: `New Task Assigned: ${task.title}`,
    html: `
      <h2>New Task Assignment</h2>
      <p>Hello ${assignee.full_name},</p>
      <p>You have been assigned a new task by ${assigner.full_name}.</p>
      
      <h3>Task Details:</h3>
      <ul>
        <li><strong>Title:</strong> ${task.title}</li>
        <li><strong>Description:</strong> ${task.description || 'No description provided'}</li>
        <li><strong>Deadline:</strong> ${new Date(task.deadline).toLocaleString()}</li>
        ${task.notes ? `<li><strong>Notes:</strong> ${task.notes}</li>` : ''}
      </ul>

      <p>Please log in to the task management system to view more details and update the task status.</p>
      
      <p>Best regards,<br>Task Management System</p>
    `
  }),

  taskReminder: (task, assignee) => ({
    subject: `Task Reminder: ${task.title}`,
    html: `
      <h2>Task Reminder</h2>
      <p>Hello ${assignee.full_name},</p>
      <p>This is a reminder about your upcoming task deadline.</p>
      
      <h3>Task Details:</h3>
      <ul>
        <li><strong>Title:</strong> ${task.title}</li>
        <li><strong>Deadline:</strong> ${new Date(task.deadline).toLocaleString()}</li>
        <li><strong>Current Status:</strong> ${task.status}</li>
      </ul>

      <p>Please ensure to update the task status and complete it before the deadline.</p>
      
      <p>Best regards,<br>Task Management System</p>
    `
  }),

  statusUpdate: (task, assignee, assigner) => ({
    subject: `Task Status Update: ${task.title}`,
    html: `
      <h2>Task Status Update</h2>
      <p>Hello ${assigner.full_name},</p>
      <p>${assignee.full_name} has updated the status of their assigned task.</p>
      
      <h3>Task Details:</h3>
      <ul>
        <li><strong>Title:</strong> ${task.title}</li>
        <li><strong>New Status:</strong> ${task.status}</li>
        <li><strong>Updated At:</strong> ${new Date(task.updated_at).toLocaleString()}</li>
      </ul>

      <p>You can log in to the task management system to view more details.</p>
      
      <p>Best regards,<br>Task Management System</p>
    `
  })
};

// Send task notification email
export const sendTaskNotification = async ({ taskId, assigneeId, assignerId, type = 'assignment' }) => {
  try {
    // Get task details
    const taskResult = await pool.query(
      'SELECT * FROM tasks WHERE id = $1',
      [taskId]
    );
    const task = taskResult.rows[0];

    // Get assignee details
    const assigneeResult = await pool.query(
      'SELECT * FROM users WHERE id = $1',
      [assigneeId]
    );
    const assignee = assigneeResult.rows[0];

    // Get assigner details
    const assignerResult = await pool.query(
      'SELECT * FROM users WHERE id = $1',
      [assignerId]
    );
    const assigner = assignerResult.rows[0];

    let emailContent;
    switch (type) {
      case 'assignment':
        emailContent = emailTemplates.taskAssignment(task, assignee, assigner);
        break;
      case 'reminder':
        emailContent = emailTemplates.taskReminder(task, assignee);
        break;
      case 'status_update':
        emailContent = emailTemplates.statusUpdate(task, assignee, assigner);
        break;
      default:
        throw new Error('Invalid notification type');
    }

    // Send email
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: assignee.email,
      ...emailContent
    });

    console.log(`Task notification email sent successfully: ${type}`);
    return true;
  } catch (error) {
    console.error('Send task notification error:', error);
    // Don't throw error to prevent transaction rollback
    // Just log the error and continue
    return false;
  }
};

// Schedule task reminders
export const scheduleTaskReminders = async (taskId) => {
  try {
    const task = await pool.query(
      'SELECT * FROM tasks WHERE id = $1',
      [taskId]
    );

    if (!task.rows[0]) {
      throw new Error('Task not found');
    }

    const deadline = new Date(task.rows[0].deadline);
    const reminderTime = new Date(deadline.getTime() - 24 * 60 * 60 * 1000); // 24 hours before deadline

    // If reminder time is in the future, schedule it
    if (reminderTime > new Date()) {
      setTimeout(async () => {
        await sendTaskNotification({
          taskId,
          assigneeId: task.rows[0].assigned_to,
          assignerId: task.rows[0].assigned_by,
          type: 'reminder'
        });
      }, reminderTime.getTime() - Date.now());
    }

    return true;
  } catch (error) {
    console.error('Schedule task reminders error:', error);
    return false;
  }
};
