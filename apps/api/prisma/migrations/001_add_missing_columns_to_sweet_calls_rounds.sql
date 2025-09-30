-- Migration to add missing columns to sweet_calls_rounds table
-- This fixes the "column does not exist" error for createdAt, closedAt, revealedAt, updatedAt

-- Add createdAt column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'sweet_calls_rounds' 
                   AND column_name = 'createdAt') THEN
        ALTER TABLE sweet_calls_rounds ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;

-- Add closedAt column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'sweet_calls_rounds' 
                   AND column_name = 'closedAt') THEN
        ALTER TABLE sweet_calls_rounds ADD COLUMN "closedAt" TIMESTAMP(3);
    END IF;
END $$;

-- Add revealedAt column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'sweet_calls_rounds' 
                   AND column_name = 'revealedAt') THEN
        ALTER TABLE sweet_calls_rounds ADD COLUMN "revealedAt" TIMESTAMP(3);
    END IF;
END $$;

-- Add updatedAt column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'sweet_calls_rounds' 
                   AND column_name = 'updatedAt') THEN
        ALTER TABLE sweet_calls_rounds ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;

-- Create trigger to automatically update updatedAt column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop trigger if it exists and recreate it
DROP TRIGGER IF EXISTS update_sweet_calls_rounds_updated_at ON sweet_calls_rounds;
CREATE TRIGGER update_sweet_calls_rounds_updated_at
    BEFORE UPDATE ON sweet_calls_rounds
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
