-- Auth Guard Allowlist Tables
-- Allows restricting Clerk sign-ups to specific emails or domains

CREATE TABLE IF NOT EXISTS allowed_emails (
  email TEXT PRIMARY KEY,
  added_by TEXT,
  added_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS allowed_domains (
  domain TEXT PRIMARY KEY,
  added_by TEXT,
  added_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit log for blocked sign-up attempts
CREATE TABLE IF NOT EXISTS blocked_signups (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email TEXT,
  clerk_user_id TEXT,
  reason TEXT,
  blocked_at TIMESTAMPTZ DEFAULT NOW()
);

-- Helper function: check if an email is allowed
-- Returns true if email is in allowed_emails OR domain is in allowed_domains
CREATE OR REPLACE FUNCTION is_email_allowed(check_email TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  email_domain TEXT;
BEGIN
  -- Exact email match
  PERFORM 1 FROM allowed_emails WHERE email = LOWER(check_email);
  IF FOUND THEN RETURN TRUE; END IF;

  -- Domain match
  email_domain := SPLIT_PART(LOWER(check_email), '@', 2);
  IF email_domain = '' THEN RETURN FALSE; END IF;

  PERFORM 1 FROM allowed_domains WHERE domain = email_domain;
  IF FOUND THEN RETURN TRUE; END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql STABLE;
