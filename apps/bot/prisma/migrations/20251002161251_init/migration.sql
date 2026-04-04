-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "telegram_id" TEXT NOT NULL,
    "telegram_user" TEXT,
    "kick_name" TEXT,
    "role" TEXT NOT NULL DEFAULT 'VIEWER',
    "linked_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "game_rounds" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "phase" TEXT NOT NULL DEFAULT 'IDLE',
    "final_value" INTEGER,
    "grace_window" INTEGER NOT NULL DEFAULT 30,
    "window_min" INTEGER NOT NULL DEFAULT 0,
    "min_range" INTEGER NOT NULL DEFAULT 1,
    "max_range" INTEGER NOT NULL DEFAULT 1000000,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" DATETIME,
    "revealed_at" DATETIME,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "guesses" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "game_round_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "edited_at" DATETIME,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "guesses_game_round_id_fkey" FOREIGN KEY ("game_round_id") REFERENCES "game_rounds" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "guesses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "bonus_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "game_round_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "payout_x" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bonus_items_game_round_id_fkey" FOREIGN KEY ("game_round_id") REFERENCES "game_rounds" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "game_round_id" TEXT,
    "call_session_id" TEXT,
    "user_id" TEXT NOT NULL,
    "command" TEXT NOT NULL,
    "params" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_game_round_id_fkey" FOREIGN KEY ("game_round_id") REFERENCES "game_rounds" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "audit_logs_call_session_id_fkey" FOREIGN KEY ("call_session_id") REFERENCES "call_sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "telegram_groups" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "group_id" TEXT NOT NULL,
    "title" TEXT,
    "type" TEXT,
    "member_count" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT,
    "last_seen" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "schedules" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "day_of_week" INTEGER NOT NULL,
    "stream_number" INTEGER NOT NULL,
    "event_title" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "stream_notifications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "day_of_week" INTEGER NOT NULL,
    "stream_number" INTEGER NOT NULL,
    "notification_type" TEXT NOT NULL,
    "sent_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "event_date" DATETIME NOT NULL,
    "success_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "call_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "session_name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IDLE',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" DATETIME,
    "revealed_at" DATETIME,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "call_entries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "session_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "slot_name" TEXT NOT NULL,
    "multiplier" REAL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "call_entries_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "call_sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "call_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_telegram_id_key" ON "users"("telegram_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_kick_name_key" ON "users"("kick_name");

-- CreateIndex
CREATE UNIQUE INDEX "guesses_game_round_id_user_id_key" ON "guesses"("game_round_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "guesses_game_round_id_value_key" ON "guesses"("game_round_id", "value");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_groups_group_id_key" ON "telegram_groups"("group_id");

-- CreateIndex
CREATE UNIQUE INDEX "schedules_day_of_week_stream_number_key" ON "schedules"("day_of_week", "stream_number");

-- CreateIndex
CREATE UNIQUE INDEX "stream_notifications_day_of_week_stream_number_notification_type_event_date_key" ON "stream_notifications"("day_of_week", "stream_number", "notification_type", "event_date");

-- CreateIndex
CREATE UNIQUE INDEX "call_entries_session_id_user_id_key" ON "call_entries"("session_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "call_entries_session_id_slot_name_key" ON "call_entries"("session_id", "slot_name");
