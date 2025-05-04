import { google } from 'googleapis';
import { Client } from '@microsoft/microsoft-graph-client';
import 'isomorphic-fetch';
import dotenv from 'dotenv';
import { pool } from '../config/database.js';

dotenv.config();

// Google Calendar Setup
const googleAuth = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

const calendar = google.calendar({ version: 'v3', auth: googleAuth });

// Create Microsoft Graph Client using simple authProvider
const createGraphClient = (accessToken) => {
  return Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    }
  });
};

// Create calendar event in both Google and Microsoft calendars
export const createCalendarEvent = async ({ title, description, startTime, assigneeId }) => {
  try {
    const endTime = new Date(startTime);
    endTime.setHours(endTime.getHours() + 1);

    const assigneeEmail = await getAssigneeEmail(assigneeId);
    if (!assigneeEmail) throw new Error('Assignee email not found');

    const googleEvent = await createGoogleCalendarEvent({ title, description, startTime, endTime, attendeeEmail: assigneeEmail });
    const microsoftEvent = await createMicrosoftCalendarEvent({ title, description, startTime, endTime, attendeeEmail: assigneeEmail });

    return {
      googleEventId: googleEvent?.id,
      microsoftEventId: microsoftEvent?.id
    };
  } catch (error) {
    console.error('Create calendar event error:', error);
    return null;
  }
};

export const updateCalendarEvents = async ({ taskId, updates }) => {
  try {
    const eventIds = await getCalendarEventIds(taskId);
    if (!eventIds) return false;

    if (eventIds.googleEventId) await updateGoogleCalendarEvent(eventIds.googleEventId, updates);
    if (eventIds.microsoftEventId) await updateMicrosoftCalendarEvent(eventIds.microsoftEventId, updates);

    return true;
  } catch (error) {
    console.error('Update calendar events error:', error);
    return false;
  }
};

export const deleteCalendarEvents = async (taskId) => {
  try {
    const eventIds = await getCalendarEventIds(taskId);
    if (!eventIds) return false;

    if (eventIds.googleEventId) await deleteGoogleCalendarEvent(eventIds.googleEventId);
    if (eventIds.microsoftEventId) await deleteMicrosoftCalendarEvent(eventIds.microsoftEventId);

    return true;
  } catch (error) {
    console.error('Delete calendar events error:', error);
    return false;
  }
};

const getAssigneeEmail = async (assigneeId) => {
  try {
    const result = await pool.query('SELECT email FROM users WHERE id = $1', [assigneeId]);
    return result.rows[0]?.email;
  } catch (error) {
    console.error('Get assignee email error:', error);
    return null;
  }
};

const getCalendarEventIds = async (taskId) => {
  try {
    const result = await pool.query('SELECT google_event_id, microsoft_event_id FROM calendar_events WHERE task_id = $1', [taskId]);
    return result.rows[0];
  } catch (error) {
    console.error('Get calendar event IDs error:', error);
    return null;
  }
};

const createGoogleCalendarEvent = async ({ title, description, startTime, endTime, attendeeEmail }) => {
  try {
    const event = {
      summary: title,
      description,
      start: { dateTime: startTime, timeZone: 'UTC' },
      end: { dateTime: endTime, timeZone: 'UTC' },
      attendees: [{ email: attendeeEmail }],
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 },
          { method: 'popup', minutes: 30 }
        ]
      }
    };

    const response = await calendar.events.insert({ calendarId: 'primary', resource: event, sendUpdates: 'all' });
    return response.data;
  } catch (error) {
    console.error('Create Google Calendar event error:', error);
    return null;
  }
};

const updateGoogleCalendarEvent = async (eventId, updates) => {
  try {
    const response = await calendar.events.patch({ calendarId: 'primary', eventId, resource: updates, sendUpdates: 'all' });
    return response.data;
  } catch (error) {
    console.error('Update Google Calendar event error:', error);
    return null;
  }
};

const deleteGoogleCalendarEvent = async (eventId) => {
  try {
    await calendar.events.delete({ calendarId: 'primary', eventId, sendUpdates: 'all' });
    return true;
  } catch (error) {
    console.error('Delete Google Calendar event error:', error);
    return false;
  }
};

const createMicrosoftCalendarEvent = async ({ title, description, startTime, endTime, attendeeEmail }) => {
  try {
    const client = createGraphClient(process.env.MS_ACCESS_TOKEN);
    const event = {
      subject: title,
      body: { contentType: 'HTML', content: description },
      start: { dateTime: startTime, timeZone: 'UTC' },
      end: { dateTime: endTime, timeZone: 'UTC' },
      attendees: [
        {
          emailAddress: { address: attendeeEmail },
          type: 'required'
        }
      ],
      isReminderOn: true,
      reminderMinutesBeforeStart: 30
    };

    const response = await client.api('/me/events').post(event);
    return response;
  } catch (error) {
    console.error('Create Microsoft Calendar event error:', error);
    return null;
  }
};

const updateMicrosoftCalendarEvent = async (eventId, updates) => {
  try {
    const client = createGraphClient(process.env.MS_ACCESS_TOKEN);
    const response = await client.api(`/me/events/${eventId}`).patch(updates);
    return response;
  } catch (error) {
    console.error('Update Microsoft Calendar event error:', error);
    return null;
  }
};

const deleteMicrosoftCalendarEvent = async (eventId) => {
  try {
    const client = createGraphClient(process.env.MS_ACCESS_TOKEN);
    await client.api(`/me/events/${eventId}`).delete();
    return true;
  } catch (error) {
    console.error('Delete Microsoft Calendar event error:', error);
    return false;
  }
};
