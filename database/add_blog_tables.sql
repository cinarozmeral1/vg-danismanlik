-- Blog Posts Table for AI-Generated SEO Content
-- This table stores automatically generated blog articles in both Turkish and English

CREATE TABLE IF NOT EXISTS blog_posts (
    id SERIAL PRIMARY KEY,
    
    -- Titles
    title_tr VARCHAR(255) NOT NULL,
    title_en VARCHAR(255) NOT NULL,
    
    -- URL slug (SEO-friendly)
    slug VARCHAR(255) UNIQUE NOT NULL,
    
    -- Content (HTML formatted)
    content_tr TEXT NOT NULL,
    content_en TEXT NOT NULL,
    
    -- Excerpt/Summary for listings
    excerpt_tr VARCHAR(500),
    excerpt_en VARCHAR(500),
    
    -- SEO Meta
    meta_description_tr VARCHAR(160),
    meta_description_en VARCHAR(160),
    keywords VARCHAR(500), -- Comma-separated keywords
    
    -- Topic categorization
    topic_type VARCHAR(50) DEFAULT 'general', -- university, program, country, general
    
    -- Related entities (for internal linking)
    related_university_id INTEGER REFERENCES universities(id) ON DELETE SET NULL,
    related_country VARCHAR(50),
    related_program VARCHAR(255),
    
    -- Featured image
    featured_image_url VARCHAR(500),
    
    -- Publishing
    is_published BOOLEAN DEFAULT TRUE,
    published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Tracking
    view_count INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published ON blog_posts(is_published, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_posts_topic ON blog_posts(topic_type);
CREATE INDEX IF NOT EXISTS idx_blog_posts_country ON blog_posts(related_country);

-- Track which topics have been covered to avoid repetition
CREATE TABLE IF NOT EXISTS blog_topic_history (
    id SERIAL PRIMARY KEY,
    topic_key VARCHAR(255) UNIQUE NOT NULL, -- e.g., "university_27", "country_Italy", "program_medicine"
    last_covered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    times_covered INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_blog_topic_history_key ON blog_topic_history(topic_key);

