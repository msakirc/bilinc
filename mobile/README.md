# Bilinç - Universal Review Platform

A React Native (Expo) app that enables users to review and share verified facts about any business, product, or brand in the world.

## Setup Instructions

### Prerequisites
- Node.js 18+
- npm or yarn
- Expo CLI (`npm install -g @expo/cli`)

### 1. Install Dependencies
```bash
cd mobile
npm install
```

### 2. Supabase Setup
1. Create a new project at [supabase.com](https://supabase.com)
2. Go to Settings > API to get your project URL and anon key
3. Update `app.json` with your credentials:
   ```json
   {
     "expo": {
       "extra": {
         "supabaseUrl": "https://your-project.supabase.co",
         "supabaseAnonKey": "your-anon-key-here"
       }
     }
   }
   ```

### 4. Database Setup
Run the following SQL in your Supabase SQL editor to create the database schema:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username TEXT UNIQUE NOT NULL,
  user_type TEXT NOT NULL CHECK (user_type IN ('consumer', 'business_owner', 'admin')),
  reputation_score INTEGER DEFAULT 0,
  credibility_level TEXT NOT NULL DEFAULT 'novice' CHECK (credibility_level IN ('novice', 'contributor', 'trusted', 'expert')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

-- Listings table (replaces businesses)
CREATE TABLE listings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('business', 'product', 'brand')),
  category TEXT NOT NULL,
  location TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_claimed BOOLEAN DEFAULT FALSE,
  claimed_at TIMESTAMP WITH TIME ZONE,
  average_rating DECIMAL(3,2) DEFAULT 0,
  total_reviews INTEGER DEFAULT 0
);

-- Reviews table
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  content TEXT NOT NULL,
  helpful_votes INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_flagged BOOLEAN DEFAULT FALSE
);

-- Facts table
CREATE TABLE facts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  statement TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('safety', 'ownership', 'health', 'quality', 'legal', 'other')),
  verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'disputed', 'needs_review')),
  truth_guarantee BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_flagged BOOLEAN DEFAULT FALSE
);

-- Fact checks table
CREATE TABLE fact_checks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fact_id UUID REFERENCES facts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  vote TEXT NOT NULL CHECK (vote IN ('verify', 'dispute', 'needs_evidence')),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Listing claims table
CREATE TABLE listing_claims (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
  subscription_tier TEXT NOT NULL CHECK (subscription_tier IN ('basic', 'pro', 'enterprise')),
  claimed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT TRUE
);

-- Responses table
CREATE TABLE responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('review', 'fact')),
  target_id UUID NOT NULL,
  content TEXT NOT NULL,
  response_type TEXT NOT NULL DEFAULT 'general' CHECK (response_type IN ('general', 'apologetic', 'grateful', 'corrective')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Media uploads table
CREATE TABLE media_uploads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('review', 'fact', 'response')),
  target_id UUID NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('image', 'video', 'document')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Votes table
CREATE TABLE votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('review', 'fact')),
  target_id UUID NOT NULL,
  vote_type TEXT NOT NULL CHECK (vote_type IN ('helpful', 'not_helpful')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Subscriptions table
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  tier TEXT NOT NULL CHECK (tier IN ('basic', 'pro', 'enterprise')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  payment_id TEXT
);

-- Row Level Security (RLS) policies will be added in the next step
```

### 5. Enable Row Level Security
Run the SQL from `supabase-policies.sql` in your Supabase SQL editor. This creates all Row Level Security policies and database functions for:

- **Access Control**: Public read access, authenticated write access, ownership-based updates
- **Reputation System**: Automatic score calculation and credibility level assignment
- **Business Logic**: Fact creation requirements, claim ownership, admin moderation
- **Data Integrity**: Triggers for updating listing stats and user reputation

Key policies include:
- Anyone can read public content (listings, reviews, facts)
- Users must be authenticated to create content
- Users can only modify their own content
- Fact creation requires reputation score ≥ 100
- Business owners can only respond to claimed listings
- Admins have full moderation access

### 6. Run the App
```bash
npm start
```

Or use Expo Go app on your phone to scan the QR code.

## Troubleshooting

### "string cannot be cast to boolean" Error
This error usually occurs when:

1. **Database tables not created**: Make sure you ran the schema SQL in Supabase
2. **RLS policies not applied**: Run the policies from `supabase-policies.sql`
3. **Type mismatch in data**: Check that boolean fields receive boolean values

### "Missing Supabase configuration" Error
1. Verify `app.json` has the correct `extra` config
2. Make sure you're using the **anon/public key**, not the service key
3. Restart the Expo server after updating `app.json`

### Database Connection Issues
Run this test to verify your setup:
```bash
node test-supabase.js
```

### Common Issues:
- **Package version warnings**: Run `npm install` to update packages
- **Auth not working**: Check that RLS policies allow user registration
- **Data not saving**: Verify table permissions and user authentication

## Current Implementation Status

✅ **Completed:**
- Project structure
- Navigation setup (Root + App navigators)
- Authentication flow (Login/Register screens)
- Supabase client configuration
- Zustand store for auth state
- Basic screens (placeholders)

🔄 **Next Steps (implement one screen at a time):**
1. Home Screen - Discovery and trending content
2. Search Screen - Universal search interface
3. Listing Detail Screen - Facts-first display
4. Write Review Screen - Review submission
5. Report Fact Screen - Fact submission
6. My Activity Screen - User contributions
7. Business dashboard screens

## Architecture Overview

- **Frontend:** React Native + Expo
- **Backend:** Supabase (PostgreSQL + Auth + Storage + Real-time)
- **State Management:** Zustand
- **Navigation:** React Navigation 6
- **Authentication:** Username-based (converted to email format)
- **Data Security:** Row Level Security (RLS)

The app follows a dual-layer information system where reviews represent subjective opinions and facts represent objective, verifiable claims.