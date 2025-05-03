import { google } from 'googleapis';
import { Client } from '@microsoft/microsoft-graph-client';
import { TokenCredentialAuthenticationProvider } from '@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials';
import dotenv from 'dotenv';

dotenv.config();

// Google Calendar Setup
const googleAuth = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

const calendar = google.calendar({ version: 'v3', auth: googleAuth });

// Microsoft Graph Setup
const msGraphAuth = {
  getAccessToken: async () => {
    // Implement token acquisition logic here
    // This should use proper OAuth flow or managed identity
    return process.env.MS_ACCESS_TOKEN;
  }
};

const msGraphClient = Client.init({
  authProvider: new TokenCredentialAuthenticationProvider(msGraphAuth)
});

// Create calendar event in both Google and Microsoft calendars
export const createCalendarEvent = async ({ title, description, startTime, assigneeId }) => {
  try {
    const endTime = new Date(startTime);
    endTime.setHours(endTime.getHours() + 1); // Default duration: 1 hour

    // Get assignee's email for calendar invitation
    const assigneeEmail = await getAssigneeEmail(assigneeId);
    if (!assigneeEmail) {
      throw new Error('Assignee email not found');
    }

    // Create Google Calendar event
    const googleEvent = await createGoogleCalendarEvent({
      title,
      description,
      startTime,
      endTime,
      attendeeEmail: assigneeEmail
    });

    // Create Microsoft Calendar event
    const microsoftEvent = await createMicrosoftCalendarEvent({
      title,
      description,
      startTime,
      endTime,
      attendeeEmail: assigneeEmail
    });

    return {
      googleEventId: googleEvent?.id,
      microsoftEventId: microsoftEvent?.id
    };
  } catch (error) {
    console.error('Create calendar event error:', error);
    // Don't throw error to prevent transaction rollback
    return null;
  }
};

// Update calendar events
export const updateCalendarEvents = async ({ taskId, updates }) => {
  try {
    // Get existing calendar event IDs
    const eventIds = await getCalendarEventIds(taskId);
    if (!eventIds) return false;

    if (eventIds.googleEventId) {
      await updateGoogleCalendarEvent(eventIds.googleEventId, updates);
    }

    if (eventIds.microsoftEventId) {
      await updateMicrosoftCalendarEvent(eventIds.microsoftEventId, updates);
    }

    return true;
  } catch (error) {
    console.error('Update calendar events error:', error);
    return false;
  }
};

// Delete calendar events
export const deleteCalendarEvents = async (taskId) => {
  try {
    const eventIds = await getCalendarEventIds(taskId);
    if (!eventIds) return false;

    if (eventIds.googleEventId) {
      await deleteGoogleCalendarEvent(eventIds.googleEventId);
    }

    if (eventIds.microsoftEventId) {
      await deleteMicrosoftCalendarEvent(eventIds.microsoftEventId);
    }

    return true;
  } catch (error) {
    console.error('Delete calendar events error:', error);
    return false;
  }
};

// Helper functions
const getAssigneeEmail = async (assigneeId) => {
  try {
    const result = await pool.query(
      'SELECT email FROM users WHERE id = $1',
      [assigneeId]
    );
    return result.rows[0]?.email;
  } catch (error) {
    console.error('Get assignee email error:', error);
    return null;
  }
};

const getCalendarEventIds = async (taskId) => {
  try {
    const result = await pool.query(
      'SELECT google_event_id, microsoft_event_id FROM calendar_events WHERE task_id = $1',
      [taskId]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Get calendar event IDs error:', error);
    return null;
  }
};

// Google Calendar specific functions
const createGoogleCalendarEvent = async ({ title, description, startTime, endTime, attendeeEmail }) => {
  try {
    const event = {
      summary: title,
      description,
      start: {
        dateTime: startTime,
        timeZone: 'UTC'
      },
      end: {
        dateTime: endTime,
        timeZone: 'UTC'
      },
      attendees: [{ email: attendeeEmail }],
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 }, // 24 hours before
          { method: 'popup', minutes: 30 } // 30 minutes before
        ]
      }
    };

    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
      sendUpdates: 'all'
    });

    return response.data;
  } catch (error) {
    console.error('Create Google Calendar event error:', error);
    return null;
  }
};

const updateGoogleCalendarEvent = async (eventId, updates) => {
  try {
    const response = await calendar.events.patch({
      calendarId: 'primary',
      eventId,
      resource: updates,
      sendUpdates: 'all'
    });
    return response.data;
  } catch (error) {
    console.error('Update Google Calendar event error:', error);
    return null;
  }
};

const deleteGoogleCalendarEvent = async (eventId) => {
  try {
    await calendar.events.delete({
      calendarId: 'primary',
      eventId,
      sendUpdates: 'all'
    });
    return true;
  } catch (error) {
    console.error('Delete Google Calendar event error:', error);
    return false;
  }
};

// Microsoft Calendar specific functions
const createMicrosoftCalendarEvent = async ({ title, description, startTime, endTime, attendeeEmail }) => {
  try {
    const event = {
      subject: title,
      body: {
        contentType: 'HTML',
        content: description
      },
      start: {
        dateTime: startTime,
        timeZone: 'UTC'
      },
      end: {
        dateTime: endTime,
        timeZone: 'UTC'
      },
      attendees: [
        {
          emailAddress: {
            address: attendeeEmail
          },
          type: 'required'
        }
      ],
      isReminderOn: true,
      reminderMinutesBeforeStart: 30
    };

    const response = await msGraphClient
      .api('/me/events')
      .post(event);

    return response;
  } catch (error) {
    console.error('Create Microsoft Calendar event error:', error);
    return null;
  }
};

const updateMicrosoftCalendarEvent = async (eventId, updates) => {
  try {
    const response = await msGraphClient
      .api(`/me/events/${eventId}`)
      .patch(updates);
    return response;
  } catch (error) {
    console.error('Update Microsoft Calendar event error:', error);
    return null;
  }
};

const deleteMicrosoftCalendarEvent = async (eventId) => {
  try {
    await msGraphClient
      .api(`/me/events/${eventId}`)
      .delete();
    return true;
  } catch (error) {
    console.error('Delete Microsoft Calendar event error:', error);
    return false;
  }
};
