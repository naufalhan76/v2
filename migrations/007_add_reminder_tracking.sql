-- Migration: Create Service Reminders Tracking Table
-- Version: 007
-- Purpose: Track WhatsApp reminders sent for service records

CREATE TABLE IF NOT EXISTS service_reminders (
  reminder_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES service_records(service_id) ON DELETE CASCADE,
  order_id TEXT NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
  
  -- Reminder details
  reminder_type TEXT DEFAULT 'WHATSAPP', -- WHATSAPP, EMAIL, SMS
  recipient_phone TEXT,
  message TEXT,
  sent_by UUID REFERENCES user_management(auth_user_id),
  
  -- Metadata
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'sent', -- sent, failed, bounced
  external_id TEXT, -- WhatsApp message ID, email ID, etc.
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_service_reminders_service_id ON service_reminders(service_id);
CREATE INDEX IF NOT EXISTS idx_service_reminders_order_id ON service_reminders(order_id);
CREATE INDEX IF NOT EXISTS idx_service_reminders_sent_at ON service_reminders(sent_at);
CREATE INDEX IF NOT EXISTS idx_service_reminders_type ON service_reminders(reminder_type);

-- Enable RLS
ALTER TABLE service_reminders ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow authenticated users to read service_reminders"
  ON service_reminders FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert service_reminders"
  ON service_reminders FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Grant permissions
GRANT ALL ON service_reminders TO authenticated;

-- Comments
COMMENT ON TABLE service_reminders IS 'Track all reminders sent for service records (WhatsApp, Email, SMS)';
COMMENT ON COLUMN service_reminders.reminder_type IS 'Type of reminder: WHATSAPP, EMAIL, SMS';
COMMENT ON COLUMN service_reminders.status IS 'Delivery status: sent, failed, bounced';

