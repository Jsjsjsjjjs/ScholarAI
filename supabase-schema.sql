-- Supabase Relational Database Schema Mirror (PostgreSQL)
-- This schema replicates the documents, subcollections, and keys of our Firestore database.
-- Run this script inside your Supabase SQL Editor to establish standard storage tables.

-- 1. Create Users Table
CREATE TABLE IF NOT EXISTS public.users (
    uid VARCHAR(255) PRIMARY KEY,                         -- Unique ID (Scholar ID or Auth UID)
    nickname VARCHAR(100) NOT NULL,                       -- Student displayName or random tag
    email VARCHAR(255) DEFAULT 'anonymous@scholarai.app', -- Student email address
    user_role VARCHAR(50) DEFAULT 'scholar',              -- Authorization level (scholar, owner, developer)
    plan VARCHAR(50) DEFAULT 'free tier',                 -- Subscription level (free, elite)
    ai_requests INTEGER DEFAULT 0,                        -- Count of AI commands dispatched
    total_tokens INTEGER DEFAULT 0,                       -- Total token counts consumed
    quota_exhausted BOOLEAN DEFAULT FALSE,                -- Quota limit safety state
    color_mode VARCHAR(20) DEFAULT 'dark',                -- Aesthetic theme preference (light/dark)
    ttt_wins INTEGER DEFAULT 0,                           -- Tic Tac Toe Wins
    ttt_losses INTEGER DEFAULT 0,                          -- Tic Tac Toe Losses
    ttt_ties INTEGER DEFAULT 0,                           -- Tic Tac Toe Ties
    ttt_elo INTEGER DEFAULT 1000,                         -- Tic Tac Toe Elo score
    discord_username VARCHAR(100),                        -- Linked Discord student handle
    discord_name VARCHAR(100),                            -- Dislay name of linked Discord user
    discord_avatar TEXT,                                  -- Link to Discord avatar URL
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),     -- Profile registration timestamp
    last_ai_activity TIMESTAMP WITH TIME ZONE,            -- Last AI usage timestamp
    last_quota_scan TIMESTAMP WITH TIME ZONE             -- Last elite quota scan timestamp
);

-- Enable Row Level Security (RLS) for Users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access for users profiles" 
    ON public.users FOR SELECT 
    USING (true);

CREATE POLICY "Allow write access for profile owners" 
    ON public.users FOR ALL 
    USING (auth.uid()::text = uid OR uid = 'pacifictheog' OR auth.jwt()->>'email' = 'arunwarrior98789@gmail.com'); -- Accommodates Scholar Session and Admin mappings

-- 2. Create Stats Table
CREATE TABLE IF NOT EXISTS public.stats (
    user_id VARCHAR(255) PRIMARY KEY REFERENCES public.users(uid) ON DELETE CASCADE,
    nickname VARCHAR(100) NOT NULL,
    quiz_correct INTEGER DEFAULT 0,
    total_attempted INTEGER DEFAULT 0,
    accuracy NUMERIC(5, 2) DEFAULT 0.00,
    time_spent INTEGER DEFAULT 0,                         -- Total minutes spent studying
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for Stats
ALTER TABLE public.stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access for leaderboard stats" 
    ON public.stats FOR SELECT 
    USING (true);

CREATE POLICY "Allow write access for stats owners" 
    ON public.stats FOR ALL 
    USING (auth.uid()::text = user_id OR user_id = 'pacifictheog' OR auth.jwt()->>'email' = 'arunwarrior98789@gmail.com');

-- 3. Create Progress Subcollection Table
CREATE TABLE IF NOT EXISTS public.progress (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL REFERENCES public.users(uid) ON DELETE CASCADE,
    topic_id VARCHAR(255) NOT NULL,                        -- URL-friendly topic slug
    topic VARCHAR(255) NOT NULL,                           -- Original topic name
    subject VARCHAR(100) NOT NULL,                         -- Course Subject (e.g., SCIENCE)
    notes_read BOOLEAN DEFAULT FALSE,
    quiz_taken BOOLEAN DEFAULT FALSE,
    pyqs_viewed BOOLEAN DEFAULT FALSE,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, topic_id)
);

CREATE INDEX IF NOT EXISTS idx_progress_user ON public.progress(user_id);

-- Enable RLS for Progress
ALTER TABLE public.progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow owners to manage their progress records" 
    ON public.progress FOR ALL 
    USING (auth.uid()::text = user_id OR user_id = 'pacifictheog' OR auth.jwt()->>'email' = 'arunwarrior98789@gmail.com');

-- 4. Create Doubts Subcollection Table
CREATE TABLE IF NOT EXISTS public.doubts (
    doubt_id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL REFERENCES public.users(uid) ON DELETE CASCADE,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doubts_user ON public.doubts(user_id);

-- Enable RLS for Doubts
ALTER TABLE public.doubts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow owners to manage their doubts records" 
    ON public.doubts FOR ALL 
    USING (auth.uid()::text = user_id OR user_id = 'pacifictheog' OR auth.jwt()->>'email' = 'arunwarrior98789@gmail.com');

-- 5. Create Reminders Subcollection Table
CREATE TABLE IF NOT EXISTS public.reminders (
    reminder_id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL REFERENCES public.users(uid) ON DELETE CASCADE,
    subject VARCHAR(100) NOT NULL,
    topic VARCHAR(255) NOT NULL,
    reminder_date VARCHAR(50) NOT NULL,                    -- text format as in Firestore
    reminder_time VARCHAR(50) NOT NULL,                    -- text format as in Firestore
    status VARCHAR(50) DEFAULT 'pending',                  -- pending, completed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reminders_user ON public.reminders(user_id);

-- Enable RLS for Reminders
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow owners to manage their reminders records" 
    ON public.reminders FOR ALL 
    USING (auth.uid()::text = user_id OR user_id = 'pacifictheog' OR auth.jwt()->>'email' = 'arunwarrior98789@gmail.com');

-- 6. Create Support Tickets Table
CREATE TABLE IF NOT EXISTS public.tickets (
    ticket_id VARCHAR(255) PRIMARY KEY,
    submitter_uid VARCHAR(255) NOT NULL,
    submitter_name VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'open',                     -- open, resolved, closed
    messages JSONB DEFAULT '[]'::jsonb,                    -- support chat transaction log
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for Tickets
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow submitter and admins to read tickets" 
    ON public.tickets FOR SELECT 
    USING (auth.uid()::text = submitter_uid OR submitter_uid = 'pacifictheog');

CREATE POLICY "Allow submitter and admins to update tickets" 
    ON public.tickets FOR UPDATE 
    USING (auth.uid()::text = submitter_uid OR submitter_uid = 'pacifictheog');
