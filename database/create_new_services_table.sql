-- Drop existing services and installments tables
DROP TABLE IF EXISTS installments CASCADE;
DROP TABLE IF EXISTS services CASCADE;

-- Create new simplified services table
CREATE TABLE services (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    service_name VARCHAR(200) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
    due_date DATE,
    payment_date DATE,
    is_paid BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for better performance
CREATE INDEX idx_services_user_id ON services(user_id);
CREATE INDEX idx_services_due_date ON services(due_date);
CREATE INDEX idx_services_is_paid ON services(is_paid);
