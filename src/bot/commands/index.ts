import * as analytics from './analytics.js';
import * as assets from './assets.js';
import * as console_log from './console_log.js';
import * as doubt_solver from './doubt_solver.js';
import * as identity from './identity.js';
import * as internal_gen from './internal_gen.js';
import * as leaderboard from './leaderboard.js';
import * as profile from './profile.js';
import * as reminder from './reminder.js';
import * as stats from './stats.js';
import * as tictactoe_stats from './tictactoe_stats.js';
import * as view_library from './view_library.js';
import * as reload from './reload.js';
import * as forsaken from './forsaken.js';
import * as admin from './admin.js';
import * as dashboard from './dashboard.js';
import * as toggle_tick from './toggle_tick.js';
import * as ticket from './ticket.js';

export const allCommands: any[] = [
  analytics.default || analytics,
  assets.default || assets,
  console_log.default || console_log,
  doubt_solver.default || doubt_solver,
  identity.default || identity,
  internal_gen.default || internal_gen,
  leaderboard.default || leaderboard,
  profile.default || profile,
  reminder.default || reminder,
  stats.default || stats,
  tictactoe_stats.default || tictactoe_stats,
  view_library.default || view_library,
  reload.default || reload,
  forsaken.default || forsaken,
  admin.default || admin,
  dashboard.default || dashboard,
  (toggle_tick as any).default || toggle_tick,
  (ticket as any).default || ticket,
];
