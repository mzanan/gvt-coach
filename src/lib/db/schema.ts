export const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS gvt_coach_payments_status (
    id TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    checkout_order_id TEXT,
    json_data TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  )`,
  `CREATE TABLE IF NOT EXISTS gvt_coach_checkout_mapping (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    checkout_order_id TEXT UNIQUE,
    payment_order_id TEXT,
    payment_identifier_id TEXT,
    payment_status_id TEXT REFERENCES gvt_coach_payments_status(id),
    provider TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  )`,
  `CREATE TABLE IF NOT EXISTS gvt_coach_meetings_bookings (
    id TEXT PRIMARY KEY,
    checkout_order_id TEXT,
    user_email TEXT,
    user_name TEXT,
    booking_date TEXT,
    frequency TEXT,
    status TEXT,
    payment_status TEXT,
    checkout_completed INTEGER NOT NULL DEFAULT 0,
    payment_confirmed INTEGER NOT NULL DEFAULT 0,
    confirmation_email_sent INTEGER NOT NULL DEFAULT 0,
    meet_link TEXT,
    user_timezone TEXT,
    duration INTEGER,
    coach TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  )`,
  `CREATE TABLE IF NOT EXISTS session_summaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_email TEXT,
    session_date TEXT,
    summary TEXT,
    next_steps TEXT,
    resources TEXT,
    sent_at TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  )`,
  `CREATE TABLE IF NOT EXISTS coaches (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    photo_url TEXT NOT NULL DEFAULT '',
    timezone TEXT NOT NULL,
    email TEXT NOT NULL,
    working_hours TEXT NOT NULL,
    prices TEXT NOT NULL,
    payment_provider TEXT NOT NULL DEFAULT 'stripe',
    meeting_provider TEXT NOT NULL DEFAULT 'zoom',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  )`,
  `CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_bookings_checkout_order_id ON gvt_coach_meetings_bookings(checkout_order_id)`,
  `CREATE INDEX IF NOT EXISTS idx_bookings_user_email ON gvt_coach_meetings_bookings(user_email)`,
  `CREATE INDEX IF NOT EXISTS idx_bookings_booking_date ON gvt_coach_meetings_bookings(booking_date)`,
  `CREATE INDEX IF NOT EXISTS idx_mapping_payment_order_id ON gvt_coach_checkout_mapping(payment_order_id)`,
];
