-- Add admin_role column to users table for co-admin system
-- admin_role can be: 'super_admin' (main admin) or 'co_admin' (helper admin)

ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_role VARCHAR(20) 
CHECK (admin_role IN ('super_admin', 'co_admin'));

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_users_admin_role ON users(admin_role);






