-- Create table for tracking invoice communications
CREATE TABLE IF NOT EXISTS invoice_communications (
  communication_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(invoice_id) ON DELETE CASCADE,
  communication_type TEXT NOT NULL, -- 'EMAIL' or 'WHATSAPP'
  recipient TEXT NOT NULL, -- email address or phone number
  status TEXT DEFAULT 'sent', -- 'sent', 'delivered', 'failed'
  sent_by UUID REFERENCES auth.users(id),
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Optional: email service response
  external_id TEXT, -- Resend email ID or WhatsApp message ID
  error_message TEXT,
  
  CONSTRAINT valid_communication_type CHECK (communication_type IN ('EMAIL', 'WHATSAPP'))
);

-- Index for faster queries
CREATE INDEX idx_invoice_communications_invoice_id ON invoice_communications(invoice_id);
CREATE INDEX idx_invoice_communications_sent_at ON invoice_communications(sent_at DESC);

-- RLS Policies
ALTER TABLE invoice_communications ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view communications for their own invoices
CREATE POLICY "Users can view invoice communications"
  ON invoice_communications
  FOR SELECT
  USING (
    invoice_id IN (
      SELECT invoice_id FROM invoices
      WHERE TRUE -- Add your tenant/user filter here
    )
  );

-- Policy: Users can insert communications
CREATE POLICY "Users can create invoice communications"
  ON invoice_communications
  FOR INSERT
  WITH CHECK (
    invoice_id IN (
      SELECT invoice_id FROM invoices
      WHERE TRUE -- Add your tenant/user filter here
    )
  );

-- Grant permissions (UUID doesn't use sequence)
GRANT ALL ON invoice_communications TO authenticated;
