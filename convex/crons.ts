import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

const crons = cronJobs();

// Daily check for users idle 3+ days — send a comeback push
// Rate-limited internally to max 1 notification per day per user.
crons.daily(
  'send inactivity pushes',
  { hourUTC: 15, minuteUTC: 0 }, // ~18:00 Israel time (UTC+3)
  internal.notifications.sendInactivityPushes,
);

export default crons;
