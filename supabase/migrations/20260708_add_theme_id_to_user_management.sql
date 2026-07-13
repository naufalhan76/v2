-- Add theme preference column to user_management
ALTER TABLE public.user_management 
ADD COLUMN IF NOT EXISTS theme_id TEXT DEFAULT 'navy';

-- Optional: add check constraint for valid themes (can be removed later)
-- ALTER TABLE public.user_management 
-- ADD CONSTRAINT valid_theme_id CHECK (theme_id IN ('navy','teal','purple','rose','amber','slate'));