-- ============================================================================
-- TestPilot Runner: Supabase Schema & Storage Configuration
-- Paste this entire script into the Supabase SQL Editor and click "Run".
-- ============================================================================

-- 1. Create the `runs` table
CREATE TABLE IF NOT EXISTS public.runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  command TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'smoke' CHECK (mode IN ('smoke', 'user_flow', 'full_qa')),
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'stopped')),
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  bugs JSONB NOT NULL DEFAULT '[]'::jsonb,
  score INTEGER NULL CHECK (score >= 0 AND score <= 100),
  error JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ NULL
);

-- Index for fast lookup by id and status queries
CREATE INDEX IF NOT EXISTS idx_runs_status ON public.runs(status);
CREATE INDEX IF NOT EXISTS idx_runs_created_at ON public.runs(created_at DESC);

-- Enable Row Level Security (RLS)
-- With RLS enabled and NO public policies defined, the table is strictly accessible
-- ONLY by the backend service using the Supabase Service Role Key (BYPASS RLS).
-- Anonymous and standard authenticated clients cannot directly inspect or modify runs.
ALTER TABLE public.runs ENABLE ROW LEVEL SECURITY;

-- 2. Create the `screenshots` storage bucket for test artifacts
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'screenshots',
  'screenshots',
  true,
  5242880, -- 5 MB limit per screenshot
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- 3. Storage Security Policies for `screenshots` bucket
-- Anyone with the public screenshot URL can view the screenshot in the TestPilot dashboard
DROP POLICY IF EXISTS "Public Read Screenshots" ON storage.objects;
CREATE POLICY "Public Read Screenshots"
ON storage.objects FOR SELECT
USING (bucket_id = 'screenshots');

-- Allow service_role to insert/update screenshots
DROP POLICY IF EXISTS "Service Role Upload Screenshots" ON storage.objects;
CREATE POLICY "Service Role Upload Screenshots"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'screenshots');

DROP POLICY IF EXISTS "Service Role Update Screenshots" ON storage.objects;
CREATE POLICY "Service Role Update Screenshots"
ON storage.objects FOR UPDATE
TO service_role
USING (bucket_id = 'screenshots');
