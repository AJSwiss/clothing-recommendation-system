CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS users (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
 first_name TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS user_preferences (
 user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 preferred_colors TEXT[] NOT NULL DEFAULT '{}', preferred_shirt_styles TEXT[] NOT NULL DEFAULT '{}',
 preferred_pant_styles TEXT[] NOT NULL DEFAULT '{}', preferred_materials TEXT[] NOT NULL DEFAULT '{}',
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS clothing_items (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL, category TEXT NOT NULL,
 subcategory TEXT NOT NULL, gender_tag TEXT NOT NULL, color TEXT NOT NULL, style TEXT NOT NULL,
 material TEXT NOT NULL, image_url TEXT NOT NULL, price NUMERIC(10,2) NOT NULL, created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS user_interactions (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID REFERENCES users(id) ON DELETE CASCADE,
 item_id UUID REFERENCES clothing_items(id) ON DELETE CASCADE, interaction_type TEXT NOT NULL CHECK (interaction_type IN ('like','dislike')),
 created_at TIMESTAMPTZ DEFAULT now(), UNIQUE(user_id,item_id)
);
CREATE INDEX IF NOT EXISTS interactions_user_idx ON user_interactions(user_id);
CREATE INDEX IF NOT EXISTS items_category_idx ON clothing_items(category,subcategory);
