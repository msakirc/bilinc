# Bilinç - Universal Review Platform Architecture

## A) APP OVERVIEW

### App Purpose
Bilinç is a universal review platform that enables users to review and share verified facts about any business, product, or brand in the world. Unlike category-limited platforms, Bilinç separates subjective opinions (reviews) from objective facts, creating a dual-layer credibility system where community reputation and fact-checking protect information quality.

### User Types
- **Consumer/Reviewer (Maya Chen)**: Mobile-first users who research purchases and contribute reviews/facts to help others
- **Business Owner (Carlos Rodriguez)**: Web dashboard users who claim listings and respond to feedback via subscription
- **Admin**: Moderation panel users who oversee platform quality and handle escalated issues

### Core Value Propositions
- **Universal Coverage**: Search and review anything without platform category restrictions
- **Transparent Information**: Clear separation between subjective reviews and objective facts
- **Credible Community**: Reputation-based contributor system with community fact-checking
- **Privacy-First**: Username-based authentication protecting user privacy
- **Fair Business Dialogue**: Subscription-based claiming allowing owners to respond professionally

## B) SCREEN REGISTRY (JSON)

```json
{
  "screens": [
    {
      "screen_id": "home",
      "user_type": "consumer",
      "purpose": "Discovery and onboarding hub showing trending content and quick actions",
      "inputs": ["user_location", "user_preferences", "previous_searches"],
      "outputs": ["selected_listing", "search_query", "contribution_intent"],
      "navigation_targets": ["search", "listing_detail", "write_review", "report_fact"]
    },
    {
      "screen_id": "search",
      "user_type": "consumer",
      "purpose": "Universal search interface for finding businesses, products, and brands",
      "inputs": ["search_query", "filters", "location"],
      "outputs": ["listing_list", "selected_listing"],
      "navigation_targets": ["listing_detail", "home"]
    },
    {
      "screen_id": "listing_detail",
      "user_type": "consumer",
      "purpose": "Comprehensive listing profile with facts-first display and contribution actions",
      "inputs": ["listing_id"],
      "outputs": ["contribution_type", "review_data", "fact_data"],
      "navigation_targets": ["write_review", "report_fact", "home", "search"]
    },
    {
      "screen_id": "write_review",
      "user_type": "consumer",
      "purpose": "Submit detailed review with star rating and optional media",
      "inputs": ["listing_id", "review_content", "rating", "media_files"],
      "outputs": ["review_submission"],
      "navigation_targets": ["listing_detail", "my_activity"]
    },
    {
      "screen_id": "report_fact",
      "user_type": "consumer",
      "purpose": "Submit objective factual claim with evidence and truth guarantee",
      "inputs": ["listing_id", "fact_statement", "evidence", "category"],
      "outputs": ["fact_submission"],
      "navigation_targets": ["listing_detail", "my_activity"]
    },
    {
      "screen_id": "my_activity",
      "user_type": "consumer",
      "purpose": "User's contribution history and reputation dashboard",
      "inputs": ["user_id"],
      "outputs": ["contribution_filters", "edit_actions"],
      "navigation_targets": ["listing_detail", "write_review", "report_fact", "profile"]
    },
    {
      "screen_id": "profile",
      "user_type": "consumer",
      "purpose": "User profile with reputation metrics and account settings",
      "inputs": ["user_id"],
      "outputs": ["profile_updates", "setting_changes"],
      "navigation_targets": ["my_activity", "settings"]
    },
    {
      "screen_id": "listing_dashboard",
      "user_type": "business_owner",
      "purpose": "Listing owner's central management interface with analytics",
      "inputs": ["listing_ids", "subscription_status"],
      "outputs": ["navigation_selection"],
      "navigation_targets": ["reviews_management", "facts_management", "subscription"]
    },
    {
      "screen_id": "reviews_management",
      "user_type": "business_owner",
      "purpose": "Interface for viewing and responding to customer reviews",
      "inputs": ["listing_id", "filters"],
      "outputs": ["response_data", "bulk_actions"],
      "navigation_targets": ["respond_to_review", "listing_dashboard"]
    },
    {
      "screen_id": "facts_management",
      "user_type": "business_owner",
      "purpose": "Interface for viewing and responding to factual claims",
      "inputs": ["listing_id", "filters"],
      "outputs": ["response_data", "dispute_actions"],
      "navigation_targets": ["respond_to_fact", "listing_dashboard"]
    }
  ]
}
```

## C) DATA MODELS (Supabase/Postgres)

### Tables

#### users
- `id` (uuid, primary key)
- `username` (text, unique, indexed)
- `user_type` (enum: consumer, business_owner, admin)
- `reputation_score` (integer, default 0)
- `credibility_level` (enum: novice, contributor, trusted, expert)
- `created_at` (timestamp)
- `last_active` (timestamp)
- `is_active` (boolean, default true)

#### listings
- `id` (uuid, primary key)
- `name` (text, indexed)
- `description` (text)
- `entity_type` (enum: business, product, brand)
- `category` (text, indexed)
- `location` (text, nullable)
- `created_by` (uuid, foreign key to users)
- `created_at` (timestamp)
- `is_claimed` (boolean, default false)
- `claimed_at` (timestamp, nullable)
- `average_rating` (decimal, computed)
- `total_reviews` (integer, default 0)

#### reviews
- `id` (uuid, primary key)
- `listing_id` (uuid, foreign key to listings)
- `user_id` (uuid, foreign key to users)
- `rating` (integer, 1-5)
- `content` (text)
- `helpful_votes` (integer, default 0)
- `created_at` (timestamp)
- `updated_at` (timestamp)
- `is_flagged` (boolean, default false)

#### facts
- `id` (uuid, primary key)
- `listing_id` (uuid, foreign key to listings)
- `user_id` (uuid, foreign key to users)
- `statement` (text)
- `category` (enum: safety, ownership, health, quality, legal, other)
- `verification_status` (enum: pending, verified, disputed, needs_review)
- `truth_guarantee` (boolean, required true)
- `created_at` (timestamp)
- `is_flagged` (boolean, default false)

#### fact_checks
- `id` (uuid, primary key)
- `fact_id` (uuid, foreign key to facts)
- `user_id` (uuid, foreign key to users)
- `vote` (enum: verify, dispute, needs_evidence)
- `comment` (text, nullable)
- `created_at` (timestamp)

#### listing_claims
- `id` (uuid, primary key)
- `listing_id` (uuid, foreign key to listings)
- `owner_id` (uuid, foreign key to users)
- `subscription_tier` (enum: basic, pro, enterprise)
- `claimed_at` (timestamp)
- `expires_at` (timestamp)
- `is_active` (boolean, default true)

#### responses
- `id` (uuid, primary key)
- `listing_id` (uuid, foreign key to listings)
- `owner_id` (uuid, foreign key to users)
- `target_type` (enum: review, fact)
- `target_id` (uuid)
- `content` (text)
- `response_type` (enum: general, apologetic, grateful, corrective)
- `created_at` (timestamp)
- `updated_at` (timestamp)

#### media_uploads
- `id` (uuid, primary key)
- `user_id` (uuid, foreign key to users)
- `target_type` (enum: review, fact, response)
- `target_id` (uuid)
- `file_path` (text)
- `file_type` (enum: image, video, document)
- `created_at` (timestamp)

#### votes
- `id` (uuid, primary key)
- `user_id` (uuid, foreign key to users)
- `target_type` (enum: review, fact)
- `target_id` (uuid)
- `vote_type` (enum: helpful, not_helpful)
- `created_at` (timestamp)

#### subscriptions
- `id` (uuid, primary key)
- `user_id` (uuid, foreign key to users)
- `tier` (enum: basic, pro, enterprise)
- `status` (enum: active, expired, cancelled)
- `started_at` (timestamp)
- `expires_at` (timestamp)
- `payment_id` (text, nullable)

### Relationships
- users → listings (one-to-many, created_by)
- listings → reviews (one-to-many)
- listings → facts (one-to-many)
- listings → listing_claims (one-to-one active)
- users → reviews (one-to-many)
- users → facts (one-to-many)
- facts → fact_checks (one-to-many)
- reviews → responses (one-to-many)
- facts → responses (one-to-many)
- users → responses (one-to-many, owner_id)

### Access Permissions (RLS)
- **Consumers**: Read all listings, reviews, facts; Write reviews/facts if reputation >= threshold; Read/write own profile
- **Listing Owners**: Read claimed listings data; Write responses to reviews/facts; Read/write listing profile
- **Admins**: Read/write all data; Moderate flagged content; Manage users

## D) BUSINESS LOGIC

### Rules
1. **Fact Reporting Threshold**: Users must have reputation_score >= 100 to submit facts
2. **Listing Claiming**: Only verified listing owners can claim via paid subscription
3. **Response Limits**: Listing owners can only respond to reviews/facts about their claimed listings
4. **Voting Restrictions**: Users cannot vote on their own content
5. **Content Moderation**: Flagged content requires admin review within 24 hours
6. **Subscription Tiers**: Basic (1 listing), Pro (5 listings), Enterprise (unlimited)

### Permissions
- **Anonymous Users**: Read-only access to public listing profiles
- **Registered Consumers**: Submit reviews, vote on content, achieve reputation
- **Verified Listing Owners**: Claim listings, respond to feedback, access analytics
- **Admins**: Moderate content, manage users, override listing claims

### Edge Cases
1. **Duplicate Listings**: Merge similar listings with admin oversight
2. **False Fact Claims**: Community fact-checking with admin intervention for disputes
3. **Listing Ownership Disputes**: Require legal documentation for resolution
4. **Review Manipulation**: Detect and penalize coordinated voting patterns
5. **Subscription Expiry**: Grace period for responses, then public access resumes
6. **High-Impact Facts**: Safety/health claims trigger urgent listing notification

### Server-Side Enforcement
- **Reputation Calculation**: Edge function recalculates scores after votes/contributions
- **Fact Verification Workflow**: Automated status updates based on community consensus
- **Listing Claim Validation**: Document verification before approval
- **Content Filtering**: Automated detection of spam/harmful content
- **Subscription Management**: Automated tier enforcement and renewal handling

## E) BACKEND STRATEGY

### Supabase-Only (RLS + Built-in APIs)
- **Authentication**: Username-based auth with Supabase Auth
- **Basic CRUD**: All standard read/write operations for reviews, facts, profiles
- **Real-time Subscriptions**: Live updates for new reviews/facts on listing pages
- **File Storage**: Media uploads for reviews, facts, and responses
- **Row Level Security**: Automatic permission enforcement for all tables
- **Database Functions**: Simple aggregations (average ratings, vote counts)

### Edge Functions (Complex Business Logic)
- **Reputation Engine**: Calculate user scores based on contribution quality and community feedback
- **Listing Claiming Workflow**: Verify ownership, process payments, update permissions
- **Subscription Management**: Handle tier upgrades, billing, and feature access
- **Content Moderation**: Process flagged content, apply automated rules, escalate to admins
- **Fact Verification Algorithm**: Analyze community votes to determine fact status
- **Notification System**: Send alerts for new reviews, urgent facts, subscription changes

### Client-Side (UI Logic)
- **Form Validation**: Input sanitization and basic validation before submission
- **Offline Support**: Queue contributions for sync when connectivity returns
- **UI State Management**: Local state for forms, filters, and navigation
- **Basic Calculations**: Star rating averages, progress indicators
- **Caching**: Local storage of frequently accessed listing data

## F) FRONTEND IMPLEMENTATION PLAN

### React Native + Expo
- **Framework**: React Native 0.72+ with Expo SDK 49+
- **Navigation**: React Navigation 6.x with native stack and tab navigators
- **State Management**: Zustand for global state (user session, app settings)
- **API Client**: Supabase JS client with real-time subscriptions
- **UI Components**: Custom component library with consistent design tokens
- **Media Handling**: Expo Image and expo-file-system for uploads
- **Offline Support**: Redux Persist for critical data caching

### Navigation Structure
```
Tab Navigator (Main)
├── Home Stack
│   ├── Home Screen
│   └── Listing Detail Stack
│       ├── Listing Detail
│       ├── Write Review
│       └── Report Fact
├── Search Stack
│   ├── Search Screen
│   └── Listing Detail (shared)
├── My Activity Stack
│   ├── My Activity
│   └── Listing Detail (shared)
└── Profile Stack
    ├── Profile
    └── Settings
```

### State Management Approach
- **User Session**: Authentication state, profile data, reputation scores
- **App Settings**: Theme preferences, notification settings, privacy options
- **Listing Cache**: Recently viewed listings with offline availability
- **Form State**: Multi-step contribution flows with draft saving
- **UI State**: Loading states, error handling, modal visibility

### Screen Mapping to Registry
- `home` → HomeScreen component
- `search` → SearchScreen component  
- `listing_detail` → ListingDetailScreen component
- `write_review` → WriteReviewScreen component
- `report_fact` → ReportFactScreen component
- `my_activity` → MyActivityScreen component
- `profile` → ProfileScreen component

### Implementation Priorities
1. **Core Infrastructure**: Auth, navigation, basic screens, data models
2. **Dual-Layer System**: Review and fact submission with validation
3. **Reputation Features**: Scoring, thresholds, credibility levels
4. **Listing Integration**: Claiming workflow, response system
5. **Admin Features**: Moderation tools, user management
6. **Advanced Features**: Real-time updates, offline support, analytics

### Deployment Strategy
- **Development**: Expo development builds with hot reloading
- **Staging**: Internal distribution for testing with realistic data
- **Production**: Expo Application Services (EAS) build and submit to stores
- **Backend**: Supabase project with environment-specific configurations
- **CI/CD**: GitHub Actions for automated testing and deployment

This architecture provides a solid foundation for Bilinç's dual-layer review platform, with clear separation of concerns, scalable data models, and maintainable frontend implementation. The design prioritizes information transparency, community credibility, and listing-owner empowerment while maintaining platform integrity through reputation systems and admin oversight.