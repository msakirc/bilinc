-- =====================================================
-- BİLİNÇ - COMPLETE DATABASE SCHEMA
-- Fresh install - no migrations
-- =====================================================

-- =====================================================
-- EXTENSIONS
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- PRIVATE SCHEMA (for RLS bypass functions)
-- =====================================================

CREATE SCHEMA IF NOT EXISTS private;

-- =====================================================
-- CITIES (All 81 Turkish provinces)
-- =====================================================

CREATE TABLE public.cities (
  code CHAR(2) PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  region TEXT NOT NULL
);

INSERT INTO cities (code, name, slug, region) VALUES
  ('01', 'Adana', 'adana', 'Akdeniz'),
  ('02', 'Adıyaman', 'adiyaman', 'Güneydoğu Anadolu'),
  ('03', 'Afyonkarahisar', 'afyonkarahisar', 'Ege'),
  ('04', 'Ağrı', 'agri', 'Doğu Anadolu'),
  ('05', 'Amasya', 'amasya', 'Karadeniz'),
  ('06', 'Ankara', 'ankara', 'İç Anadolu'),
  ('07', 'Antalya', 'antalya', 'Akdeniz'),
  ('08', 'Artvin', 'artvin', 'Karadeniz'),
  ('09', 'Aydın', 'aydin', 'Ege'),
  ('10', 'Balıkesir', 'balikesir', 'Marmara'),
  ('11', 'Bilecik', 'bilecik', 'Marmara'),
  ('12', 'Bingöl', 'bingol', 'Doğu Anadolu'),
  ('13', 'Bitlis', 'bitlis', 'Doğu Anadolu'),
  ('14', 'Bolu', 'bolu', 'Karadeniz'),
  ('15', 'Burdur', 'burdur', 'Akdeniz'),
  ('16', 'Bursa', 'bursa', 'Marmara'),
  ('17', 'Çanakkale', 'canakkale', 'Marmara'),
  ('18', 'Çankırı', 'cankiri', 'İç Anadolu'),
  ('19', 'Çorum', 'corum', 'Karadeniz'),
  ('20', 'Denizli', 'denizli', 'Ege'),
  ('21', 'Diyarbakır', 'diyarbakir', 'Güneydoğu Anadolu'),
  ('22', 'Edirne', 'edirne', 'Marmara'),
  ('23', 'Elazığ', 'elazig', 'Doğu Anadolu'),
  ('24', 'Erzincan', 'erzincan', 'Doğu Anadolu'),
  ('25', 'Erzurum', 'erzurum', 'Doğu Anadolu'),
  ('26', 'Eskişehir', 'eskisehir', 'İç Anadolu'),
  ('27', 'Gaziantep', 'gaziantep', 'Güneydoğu Anadolu'),
  ('28', 'Giresun', 'giresun', 'Karadeniz'),
  ('29', 'Gümüşhane', 'gumushane', 'Karadeniz'),
  ('30', 'Hakkari', 'hakkari', 'Doğu Anadolu'),
  ('31', 'Hatay', 'hatay', 'Akdeniz'),
  ('32', 'Isparta', 'isparta', 'Akdeniz'),
  ('33', 'Mersin', 'mersin', 'Akdeniz'),
  ('34', 'İstanbul', 'istanbul', 'Marmara'),
  ('35', 'İzmir', 'izmir', 'Ege'),
  ('36', 'Kars', 'kars', 'Doğu Anadolu'),
  ('37', 'Kastamonu', 'kastamonu', 'Karadeniz'),
  ('38', 'Kayseri', 'kayseri', 'İç Anadolu'),
  ('39', 'Kırklareli', 'kirklareli', 'Marmara'),
  ('40', 'Kırşehir', 'kirsehir', 'İç Anadolu'),
  ('41', 'Kocaeli', 'kocaeli', 'Marmara'),
  ('42', 'Konya', 'konya', 'İç Anadolu'),
  ('43', 'Kütahya', 'kutahya', 'Ege'),
  ('44', 'Malatya', 'malatya', 'Doğu Anadolu'),
  ('45', 'Manisa', 'manisa', 'Ege'),
  ('46', 'Kahramanmaraş', 'kahramanmaras', 'Akdeniz'),
  ('47', 'Mardin', 'mardin', 'Güneydoğu Anadolu'),
  ('48', 'Muğla', 'mugla', 'Ege'),
  ('49', 'Muş', 'mus', 'Doğu Anadolu'),
  ('50', 'Nevşehir', 'nevsehir', 'İç Anadolu'),
  ('51', 'Niğde', 'nigde', 'İç Anadolu'),
  ('52', 'Ordu', 'ordu', 'Karadeniz'),
  ('53', 'Rize', 'rize', 'Karadeniz'),
  ('54', 'Sakarya', 'sakarya', 'Marmara'),
  ('55', 'Samsun', 'samsun', 'Karadeniz'),
  ('56', 'Siirt', 'siirt', 'Güneydoğu Anadolu'),
  ('57', 'Sinop', 'sinop', 'Karadeniz'),
  ('58', 'Sivas', 'sivas', 'İç Anadolu'),
  ('59', 'Tekirdağ', 'tekirdag', 'Marmara'),
  ('60', 'Tokat', 'tokat', 'Karadeniz'),
  ('61', 'Trabzon', 'trabzon', 'Karadeniz'),
  ('62', 'Tunceli', 'tunceli', 'Doğu Anadolu'),
  ('63', 'Şanlıurfa', 'sanliurfa', 'Güneydoğu Anadolu'),
  ('64', 'Uşak', 'usak', 'Ege'),
  ('65', 'Van', 'van', 'Doğu Anadolu'),
  ('66', 'Yozgat', 'yozgat', 'İç Anadolu'),
  ('67', 'Zonguldak', 'zonguldak', 'Karadeniz'),
  ('68', 'Aksaray', 'aksaray', 'İç Anadolu'),
  ('69', 'Bayburt', 'bayburt', 'Karadeniz'),
  ('70', 'Karaman', 'karaman', 'İç Anadolu'),
  ('71', 'Kırıkkale', 'kirikkale', 'İç Anadolu'),
  ('72', 'Batman', 'batman', 'Güneydoğu Anadolu'),
  ('73', 'Şırnak', 'sirnak', 'Güneydoğu Anadolu'),
  ('74', 'Bartın', 'bartin', 'Karadeniz'),
  ('75', 'Ardahan', 'ardahan', 'Doğu Anadolu'),
  ('76', 'Iğdır', 'igdir', 'Doğu Anadolu'),
  ('77', 'Yalova', 'yalova', 'Marmara'),
  ('78', 'Karabük', 'karabuk', 'Karadeniz'),
  ('79', 'Kilis', 'kilis', 'Güneydoğu Anadolu'),
  ('80', 'Osmaniye', 'osmaniye', 'Akdeniz'),
  ('81', 'Düzce', 'duzce', 'Karadeniz');

-- =====================================================
-- DISTRICTS
-- =====================================================

CREATE TABLE public.districts (
  id SMALLINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  city_code CHAR(2) NOT NULL REFERENCES cities(code),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  UNIQUE(city_code, slug)
);

CREATE INDEX idx_districts_city ON districts(city_code);

-- Sample districts for major cities (full list populated via API sync)
INSERT INTO districts (city_code, name, slug) VALUES
  ('34', 'Kadıköy', 'kadikoy'),
  ('34', 'Beşiktaş', 'besiktas'),
  ('34', 'Şişli', 'sisli'),
  ('34', 'Beyoğlu', 'beyoglu'),
  ('34', 'Üsküdar', 'uskudar'),
  ('34', 'Fatih', 'fatih'),
  ('34', 'Bakırköy', 'bakirkoy'),
  ('34', 'Kartal', 'kartal'),
  ('34', 'Maltepe', 'maltepe'),
  ('34', 'Ataşehir', 'atasehir'),
  ('06', 'Çankaya', 'cankaya'),
  ('06', 'Keçiören', 'kecioren'),
  ('06', 'Yenimahalle', 'yenimahalle'),
  ('06', 'Mamak', 'mamak'),
  ('06', 'Etimesgut', 'etimesgut'),
  ('35', 'Konak', 'konak'),
  ('35', 'Karşıyaka', 'karsiyaka'),
  ('35', 'Bornova', 'bornova'),
  ('35', 'Buca', 'buca'),
  ('35', 'Alsancak', 'alsancak'),
  ('07', 'Muratpaşa', 'muratpasa'),
  ('07', 'Konyaaltı', 'konyaalti'),
  ('07', 'Kepez', 'kepez'),
  ('07', 'Lara', 'lara'),
  ('16', 'Osmangazi', 'osmangazi'),
  ('16', 'Nilüfer', 'nilufer'),
  ('16', 'Yıldırım', 'yildirim');

-- =====================================================
-- CATEGORIES (Hierarchical)
-- =====================================================

CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  name_en TEXT,
  icon TEXT,
  parent_id UUID REFERENCES categories(id),
  sort_order SMALLINT DEFAULT 0,
  allowed_types TEXT[] DEFAULT '{business,product,brand}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_categories_parent ON categories(parent_id);
CREATE INDEX idx_categories_slug ON categories(slug);

-- Parent categories
INSERT INTO categories (id, slug, name, name_en, icon, parent_id, allowed_types, sort_order) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'food-drink', 'Yiyecek & İçecek', 'Food & Drink', '🍽️', NULL, '{business,product,brand}', 1),
  ('a0000000-0000-0000-0000-000000000002', 'services', 'Hizmetler', 'Services', '🔧', NULL, '{business}', 2),
  ('a0000000-0000-0000-0000-000000000003', 'retail', 'Perakende', 'Retail', '🛍️', NULL, '{business,product,brand}', 3),
  ('a0000000-0000-0000-0000-000000000004', 'health-beauty', 'Sağlık & Güzellik', 'Health & Beauty', '💆', NULL, '{business,product,brand}', 4),
  ('a0000000-0000-0000-0000-000000000005', 'real-estate', 'Emlak', 'Real Estate', '🏠', NULL, '{business}', 5),
  ('a0000000-0000-0000-0000-000000000006', 'automotive', 'Otomotiv', 'Automotive', '🚗', NULL, '{business,product,brand}', 6),
  ('a0000000-0000-0000-0000-000000000007', 'entertainment', 'Eğlence', 'Entertainment', '🎭', NULL, '{business}', 7),
  ('a0000000-0000-0000-0000-000000000008', 'education', 'Eğitim', 'Education', '📚', NULL, '{business}', 8),
  ('a0000000-0000-0000-0000-000000000009', 'technology', 'Teknoloji', 'Technology', '💻', NULL, '{product,brand}', 9),
  ('a0000000-0000-0000-0000-000000000010', 'home-garden', 'Ev & Bahçe', 'Home & Garden', '🏡', NULL, '{business,product,brand}', 10);

-- Child categories: Food & Drink
INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types) VALUES
  ('cheese', 'Peynir', 'Cheese', '🧀', 'a0000000-0000-0000-0000-000000000001', '{product,brand}'),
  ('tea', 'Çay', 'Tea', '🍵', 'a0000000-0000-0000-0000-000000000001', '{product,brand}'),
  ('coffee', 'Kahve', 'Coffee', '☕', 'a0000000-0000-0000-0000-000000000001', '{product,brand}'),
  ('olive-oil', 'Zeytinyağı', 'Olive Oil', '🫒', 'a0000000-0000-0000-0000-000000000001', '{product,brand}'),
  ('honey', 'Bal', 'Honey', '🍯', 'a0000000-0000-0000-0000-000000000001', '{product,brand}'),
  ('restaurant', 'Restoran', 'Restaurant', '🍴', 'a0000000-0000-0000-0000-000000000001', '{business}'),
  ('cafe', 'Kafe', 'Cafe', '☕', 'a0000000-0000-0000-0000-000000000001', '{business}'),
  ('bakery', 'Fırın', 'Bakery', '🥖', 'a0000000-0000-0000-0000-000000000001', '{business}'),
  ('patisserie', 'Pastane', 'Patisserie', '🍰', 'a0000000-0000-0000-0000-000000000001', '{business}'),
  ('butcher', 'Kasap', 'Butcher', '🥩', 'a0000000-0000-0000-0000-000000000001', '{business}'),
  ('delicatessen', 'Şarküteri', 'Delicatessen', '🧆', 'a0000000-0000-0000-0000-000000000001', '{business}'),
  ('bar', 'Bar', 'Bar', '🍺', 'a0000000-0000-0000-0000-000000000001', '{business}'),
  ('fast-food', 'Fast Food', 'Fast Food', '🍔', 'a0000000-0000-0000-0000-000000000001', '{business,brand}');

-- Child categories: Services
INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types) VALUES
  ('barber', 'Berber', 'Barber', '💈', 'a0000000-0000-0000-0000-000000000002', '{business}'),
  ('hair-salon', 'Kuaför', 'Hair Salon', '💇', 'a0000000-0000-0000-0000-000000000002', '{business}'),
  ('dry-cleaner', 'Kuru Temizleme', 'Dry Cleaner', '👔', 'a0000000-0000-0000-0000-000000000002', '{business}'),
  ('tailor', 'Terzi', 'Tailor', '🧵', 'a0000000-0000-0000-0000-000000000002', '{business}'),
  ('car-wash', 'Oto Yıkama', 'Car Wash', '🚿', 'a0000000-0000-0000-0000-000000000002', '{business}'),
  ('mechanic', 'Oto Tamirci', 'Mechanic', '🔧', 'a0000000-0000-0000-0000-000000000002', '{business}'),
  ('plumber', 'Tesisatçı', 'Plumber', '🔧', 'a0000000-0000-0000-0000-000000000002', '{business}'),
  ('electrician', 'Elektrikçi', 'Electrician', '⚡', 'a0000000-0000-0000-0000-000000000002', '{business}'),
  ('cleaning', 'Temizlik', 'Cleaning', '🧹', 'a0000000-0000-0000-0000-000000000002', '{business}'),
  ('moving', 'Nakliyat', 'Moving', '📦', 'a0000000-0000-0000-0000-000000000002', '{business}'),
  ('pet-grooming', 'Pet Kuaförü', 'Pet Grooming', '🐕', 'a0000000-0000-0000-0000-000000000002', '{business}'),
  ('veterinary', 'Veteriner', 'Veterinary', '🏥', 'a0000000-0000-0000-0000-000000000002', '{business}');

-- Child categories: Real Estate
INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types) VALUES
  ('estate-agency', 'Emlak Ofisi', 'Estate Agency', '🏢', 'a0000000-0000-0000-0000-000000000005', '{business}'),
  ('property-management', 'Mülk Yönetimi', 'Property Management', '🔑', 'a0000000-0000-0000-0000-000000000005', '{business}'),
  ('construction', 'İnşaat', 'Construction', '🏗️', 'a0000000-0000-0000-0000-000000000005', '{business,brand}');

-- Child categories: Health & Beauty
INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types) VALUES
  ('pharmacy', 'Eczane', 'Pharmacy', '💊', 'a0000000-0000-0000-0000-000000000004', '{business}'),
  ('spa', 'Spa', 'Spa', '🧖', 'a0000000-0000-0000-0000-000000000004', '{business}'),
  ('gym', 'Spor Salonu', 'Gym', '🏋️', 'a0000000-0000-0000-0000-000000000004', '{business,brand}'),
  ('cosmetics', 'Kozmetik', 'Cosmetics', '💄', 'a0000000-0000-0000-0000-000000000004', '{product,brand}'),
  ('dentist', 'Diş Hekimi', 'Dentist', '🦷', 'a0000000-0000-0000-0000-000000000004', '{business}'),
  ('optician', 'Optik', 'Optician', '👓', 'a0000000-0000-0000-0000-000000000004', '{business}');

-- Child categories: Technology
INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types) VALUES
  ('smartphone', 'Akıllı Telefon', 'Smartphone', '📱', 'a0000000-0000-0000-0000-000000000009', '{product,brand}'),
  ('laptop', 'Dizüstü Bilgisayar', 'Laptop', '💻', 'a0000000-0000-0000-0000-000000000009', '{product,brand}'),
  ('headphones', 'Kulaklık', 'Headphones', '🎧', 'a0000000-0000-0000-0000-000000000009', '{product,brand}'),
  ('tv', 'Televizyon', 'TV', '📺', 'a0000000-0000-0000-0000-000000000009', '{product,brand}'),
  ('appliances', 'Beyaz Eşya', 'Appliances', '🧊', 'a0000000-0000-0000-0000-000000000009', '{product,brand}');

-- =====================================================
-- USERS
-- =====================================================

CREATE TABLE public.users (
  id UUID PRIMARY KEY, -- from Supabase auth.users, no default
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  user_type TEXT NOT NULL DEFAULT 'consumer' CHECK (user_type IN ('consumer', 'business_owner', 'admin')),
  reputation_score INTEGER DEFAULT 0,
  credibility_level TEXT NOT NULL DEFAULT 'novice' CHECK (credibility_level IN ('novice', 'contributor', 'trusted', 'expert')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_active TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_type ON users(user_type);
CREATE INDEX idx_users_reputation ON users(reputation_score DESC);
CREATE INDEX idx_users_active ON users(is_active) WHERE is_active = true;

-- =====================================================
-- USER SECURITY (for password recovery)
-- =====================================================

CREATE TABLE public.user_security (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  security_question_1 TEXT NOT NULL,
  security_answer_1_hash TEXT NOT NULL,
  security_question_2 TEXT NOT NULL,
  security_answer_2_hash TEXT NOT NULL,
  failed_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_security_user ON user_security(user_id);

-- =====================================================
-- LISTINGS
-- =====================================================

CREATE TABLE public.listings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,

  entity_type TEXT NOT NULL CHECK (entity_type IN ('business', 'product', 'brand')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'merged', 'removed', 'duplicate')),

  -- Product → Brand relationship
  parent_id UUID REFERENCES listings(id),

  -- Location (businesses only)
  city_code CHAR(2) REFERENCES cities(code),
  district_id SMALLINT REFERENCES districts(id),
  address_line TEXT,
  latitude NUMERIC(9,6),
  longitude NUMERIC(9,6),

  -- Merge tracking
  merged_into_id UUID REFERENCES listings(id),

  -- Stats (denormalized for performance)
  average_rating NUMERIC(3,2) DEFAULT 0,
  total_reviews INTEGER DEFAULT 0,

  -- Metadata
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Search
  search_vector TSVECTOR,

  -- Constraints
  CONSTRAINT listings_parent_check CHECK (
    (entity_type = 'product') OR (parent_id IS NULL)
  ),
  CONSTRAINT listings_location_check CHECK (
    (entity_type != 'business') OR (city_code IS NOT NULL)
  ),
  CONSTRAINT listings_merge_check CHECK (
    (status != 'merged') OR (merged_into_id IS NOT NULL)
  )
);

CREATE INDEX idx_listings_slug ON listings(slug);
CREATE INDEX idx_listings_status ON listings(status);
CREATE INDEX idx_listings_type ON listings(entity_type);
CREATE INDEX idx_listings_status_type ON listings(status, entity_type);
CREATE INDEX idx_listings_city ON listings(city_code) WHERE city_code IS NOT NULL;
CREATE INDEX idx_listings_district ON listings(district_id) WHERE district_id IS NOT NULL;
CREATE INDEX idx_listings_parent ON listings(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX idx_listings_rating ON listings(average_rating DESC) WHERE status = 'active';
CREATE INDEX idx_listings_created_by ON listings(created_by);
CREATE INDEX idx_listings_search ON listings USING GIN(search_vector);
CREATE INDEX idx_listings_location ON listings(latitude, longitude) WHERE latitude IS NOT NULL;

-- =====================================================
-- LISTING CATEGORIES (Many-to-Many)
-- =====================================================

CREATE TABLE public.listing_categories (
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (listing_id, category_id)
);

CREATE UNIQUE INDEX idx_listing_primary_category
  ON listing_categories(listing_id) WHERE is_primary = true;
CREATE INDEX idx_listing_categories_category ON listing_categories(category_id);

-- =====================================================
-- LISTING SOURCES (External API data)
-- =====================================================

CREATE TABLE public.listing_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  source TEXT NOT NULL, -- 'google_places', 'foursquare', 'yemeksepeti', 'getir', 'manual'
  external_id TEXT NOT NULL,
  external_url TEXT,
  raw_data JSONB,
  confidence_score NUMERIC(3,2),
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source, external_id)
);

CREATE INDEX idx_sources_listing ON listing_sources(listing_id);
CREATE INDEX idx_sources_source ON listing_sources(source);

-- =====================================================
-- LISTING CONTACTS
-- =====================================================

CREATE TABLE public.listing_contacts (
  listing_id UUID PRIMARY KEY REFERENCES listings(id) ON DELETE CASCADE,
  phone TEXT,
  phone_secondary TEXT,
  email TEXT,
  website TEXT,
  instagram TEXT,
  facebook TEXT,
  twitter TEXT,
  whatsapp TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES users(id)
);

-- =====================================================
-- LISTING HOURS
-- =====================================================

CREATE TABLE public.listing_hours (
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday
  open_time TIME,
  close_time TIME,
  is_closed BOOLEAN DEFAULT false,
  notes TEXT,
  PRIMARY KEY (listing_id, day_of_week)
);

-- =====================================================
-- LISTING PHOTOS
-- =====================================================

CREATE TABLE public.listing_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES users(id),
  url TEXT NOT NULL,
  caption TEXT,
  is_primary BOOLEAN DEFAULT false,
  source TEXT DEFAULT 'user' CHECK (source IN ('user', 'owner', 'google', 'api')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'pending', 'rejected')),
  sort_order SMALLINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_listing_photos_listing ON listing_photos(listing_id);
CREATE UNIQUE INDEX idx_listing_photos_primary
  ON listing_photos(listing_id) WHERE is_primary = true;

-- =====================================================
-- LISTING CLAIMS
-- This is the source of truth for ownership
-- No is_claimed boolean on listings table
-- =====================================================

CREATE TABLE public.listing_claims (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  role TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'manager', 'employee')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected', 'revoked', 'expired')),

  -- Verification
  verification_method TEXT CHECK (verification_method IN ('document', 'phone', 'email', 'domain', 'admin')),
  verification_document_url TEXT,
  verification_notes TEXT,
  verified_by UUID REFERENCES users(id),
  verified_at TIMESTAMPTZ,

  -- Timing
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,

  -- Rejection
  rejection_reason TEXT
);

-- Only one verified owner per listing
CREATE UNIQUE INDEX idx_claims_verified_owner
  ON listing_claims(listing_id)
  WHERE status = 'verified' AND role = 'owner';

-- Only one pending claim per user per listing
CREATE UNIQUE INDEX idx_claims_pending_user
  ON listing_claims(listing_id, user_id)
  WHERE status = 'pending';

CREATE INDEX idx_claims_listing ON listing_claims(listing_id);
CREATE INDEX idx_claims_user ON listing_claims(user_id);
CREATE INDEX idx_claims_status ON listing_claims(status);

-- =====================================================
-- LISTING EDITS (Community maintenance audit trail)
-- =====================================================

CREATE TABLE public.listing_edits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),

  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,

  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'auto_approved')),
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_listing_edits_listing ON listing_edits(listing_id);
CREATE INDEX idx_listing_edits_status ON listing_edits(status) WHERE status = 'pending';
CREATE INDEX idx_listing_edits_user ON listing_edits(user_id);

-- =====================================================
-- REVIEWS
-- =====================================================

CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title TEXT,
  content TEXT NOT NULL,

  helpful_count INTEGER DEFAULT 0, -- derived from review_votes

  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'hidden', 'removed')),
  is_flagged BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_reviews_user_listing ON reviews(user_id, listing_id);
CREATE INDEX idx_reviews_listing ON reviews(listing_id);
CREATE INDEX idx_reviews_user ON reviews(user_id);
CREATE INDEX idx_reviews_rating ON reviews(rating);
CREATE INDEX idx_reviews_created ON reviews(created_at DESC);
CREATE INDEX idx_reviews_status ON reviews(status) WHERE status = 'active';

-- =====================================================
-- REVIEW PHOTOS
-- =====================================================

CREATE TABLE public.review_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  caption TEXT,
  sort_order SMALLINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_review_photos_review ON review_photos(review_id);

-- =====================================================
-- REVIEW VOTES
-- =====================================================

CREATE TABLE public.review_votes (
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vote_type TEXT NOT NULL CHECK (vote_type IN ('helpful', 'not_helpful')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (review_id, user_id)
);

CREATE INDEX idx_review_votes_review ON review_votes(review_id);

-- =====================================================
-- REVIEW RESPONSES (from business owners)
-- =====================================================

CREATE TABLE public.review_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE UNIQUE,
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_review_responses_listing ON review_responses(listing_id);

-- =====================================================
-- FACTS
-- =====================================================

CREATE TABLE public.facts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  statement TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('safety', 'ownership', 'health', 'quality', 'legal', 'environmental', 'other')),

  verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'disputed', 'needs_review', 'retracted')),
  truth_guarantee BOOLEAN NOT NULL DEFAULT TRUE,

  helpful_count INTEGER DEFAULT 0,

  is_flagged BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_facts_listing ON facts(listing_id);
CREATE INDEX idx_facts_user ON facts(user_id);
CREATE INDEX idx_facts_status ON facts(verification_status);
CREATE INDEX idx_facts_category ON facts(category);

-- =====================================================
-- FACT CHECKS
-- =====================================================

CREATE TABLE public.fact_checks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fact_id UUID NOT NULL REFERENCES facts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vote TEXT NOT NULL CHECK (vote IN ('verify', 'dispute', 'needs_evidence')),
  comment TEXT,
  evidence_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(fact_id, user_id)
);

CREATE INDEX idx_fact_checks_fact ON fact_checks(fact_id);
CREATE INDEX idx_fact_checks_user ON fact_checks(user_id);

-- =====================================================
-- FACT VOTES
-- =====================================================

CREATE TABLE public.fact_votes (
  fact_id UUID NOT NULL REFERENCES facts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vote_type TEXT NOT NULL CHECK (vote_type IN ('helpful', 'not_helpful')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (fact_id, user_id)
);

CREATE INDEX idx_fact_votes_fact ON fact_votes(fact_id);

-- =====================================================
-- FACT RESPONSES (from business owners)
-- =====================================================

CREATE TABLE public.fact_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fact_id UUID NOT NULL REFERENCES facts(id) ON DELETE CASCADE UNIQUE,
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fact_responses_listing ON fact_responses(listing_id);

-- =====================================================
-- SUBSCRIPTIONS (User-level billing)
-- =====================================================

CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tier TEXT NOT NULL CHECK (tier IN ('free', 'basic', 'pro', 'enterprise')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'past_due')),

  -- Billing
  payment_provider TEXT CHECK (payment_provider IN ('stripe', 'iyzico', 'manual')),
  payment_id TEXT,

  -- Timing
  started_at TIMESTAMPTZ DEFAULT NOW(),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ
);

CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status) WHERE status = 'active';

-- =====================================================
-- PRIVATE BYPASS FUNCTIONS
-- =====================================================

CREATE OR REPLACE FUNCTION private.get_user_reputation(p_user_id UUID)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(reputation_score, 0)
  FROM public.users
  WHERE id = p_user_id;
$$;

CREATE OR REPLACE FUNCTION private.get_user_type(p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT user_type
  FROM public.users
  WHERE id = p_user_id;
$$;

CREATE OR REPLACE FUNCTION private.user_owns_listing(p_user_id UUID, p_listing_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.listing_claims
    WHERE listing_id = p_listing_id
    AND user_id = p_user_id
    AND status = 'verified'
    AND (expires_at IS NULL OR expires_at > NOW())
  );
$$;

CREATE OR REPLACE FUNCTION private.hash_security_answer(p_answer TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN crypt(lower(trim(p_answer)), gen_salt('bf', 10));
END;
$$;

-- =====================================================
-- PUBLIC WRAPPER FUNCTIONS
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_user_reputation(p_user_id UUID)
RETURNS INTEGER
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
  SELECT private.get_user_reputation(p_user_id);
$$;

CREATE OR REPLACE FUNCTION public.get_user_type(p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
  SELECT private.get_user_type(p_user_id);
$$;

CREATE OR REPLACE FUNCTION public.user_owns_listing(p_user_id UUID, p_listing_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
  SELECT private.user_owns_listing(p_user_id, p_listing_id);
$$;

-- =====================================================
-- SECURITY QUESTION FUNCTIONS
-- =====================================================

CREATE OR REPLACE FUNCTION public.set_security_questions(
  p_question_1 TEXT,
  p_answer_1 TEXT,
  p_question_2 TEXT,
  p_answer_2 TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF length(trim(p_answer_1)) < 3 OR length(trim(p_answer_2)) < 3 THEN
    RAISE EXCEPTION 'Security answers must be at least 3 characters';
  END IF;

  INSERT INTO public.user_security (
    user_id,
    security_question_1,
    security_answer_1_hash,
    security_question_2,
    security_answer_2_hash
  ) VALUES (
    v_user_id,
    trim(p_question_1),
    private.hash_security_answer(p_answer_1),
    trim(p_question_2),
    private.hash_security_answer(p_answer_2)
  )
  ON CONFLICT (user_id) DO UPDATE SET
    security_question_1 = EXCLUDED.security_question_1,
    security_answer_1_hash = EXCLUDED.security_answer_1_hash,
    security_question_2 = EXCLUDED.security_question_2,
    security_answer_2_hash = EXCLUDED.security_answer_2_hash,
    updated_at = NOW(),
    failed_attempts = 0,
    locked_until = NULL;

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_security_questions(p_username TEXT)
RETURNS TABLE(question_1 TEXT, question_2 TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id
  FROM public.users
  WHERE username = lower(trim(p_username))
  AND is_active = true;

  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT us.security_question_1, us.security_question_2
  FROM public.user_security us
  WHERE us.user_id = v_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_security_answers(
  p_username TEXT,
  p_answer_1 TEXT,
  p_answer_2 TEXT
)
RETURNS TABLE(success BOOLEAN, message TEXT, reset_token UUID)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_stored_hash_1 TEXT;
  v_stored_hash_2 TEXT;
  v_failed_attempts INTEGER;
  v_locked_until TIMESTAMPTZ;
  v_reset_token UUID;
BEGIN
  SELECT id INTO v_user_id
  FROM public.users
  WHERE username = lower(trim(p_username))
  AND is_active = true;

  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Invalid credentials'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  SELECT
    security_answer_1_hash,
    security_answer_2_hash,
    us.failed_attempts,
    us.locked_until
  INTO v_stored_hash_1, v_stored_hash_2, v_failed_attempts, v_locked_until
  FROM public.user_security us
  WHERE us.user_id = v_user_id;

  IF v_stored_hash_1 IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Security questions not set'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  IF v_locked_until IS NOT NULL AND v_locked_until > NOW() THEN
    RETURN QUERY SELECT FALSE,
      format('Account locked. Try again after %s', v_locked_until)::TEXT,
      NULL::UUID;
    RETURN;
  END IF;

  IF crypt(lower(trim(p_answer_1)), v_stored_hash_1) = v_stored_hash_1
     AND crypt(lower(trim(p_answer_2)), v_stored_hash_2) = v_stored_hash_2 THEN

    UPDATE public.user_security
    SET failed_attempts = 0, locked_until = NULL
    WHERE user_id = v_user_id;

    v_reset_token := uuid_generate_v4();
    RETURN QUERY SELECT TRUE, 'Verification successful'::TEXT, v_reset_token;
  ELSE
    v_failed_attempts := COALESCE(v_failed_attempts, 0) + 1;

    UPDATE public.user_security us
    SET
      failed_attempts = v_failed_attempts,
      locked_until = CASE
        WHEN v_failed_attempts >= 5 THEN NOW() + INTERVAL '30 minutes'
        WHEN v_failed_attempts >= 3 THEN NOW() + INTERVAL '5 minutes'
        ELSE NULL
      END
    WHERE us.user_id = v_user_id;

    IF v_failed_attempts >= 5 THEN
      RETURN QUERY SELECT FALSE, 'Too many attempts. Account locked for 30 minutes'::TEXT, NULL::UUID;
    ELSIF v_failed_attempts >= 3 THEN
      RETURN QUERY SELECT FALSE, 'Too many attempts. Account locked for 5 minutes'::TEXT, NULL::UUID;
    ELSE
      RETURN QUERY SELECT FALSE, 'Invalid credentials'::TEXT, NULL::UUID;
    END IF;
  END IF;
END;
$$;

-- =====================================================
-- TRIGGER FUNCTIONS
-- =====================================================

-- Update listing search vector
CREATE OR REPLACE FUNCTION update_listing_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('turkish', COALESCE(NEW.name, '')), 'A') ||
    setweight(to_tsvector('turkish', COALESCE(NEW.description, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER listings_search_vector_update
BEFORE INSERT OR UPDATE OF name, description ON listings
FOR EACH ROW EXECUTE FUNCTION update_listing_search_vector();

-- Update listing stats from reviews
CREATE OR REPLACE FUNCTION private.update_listing_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_listing_id UUID;
BEGIN
  v_listing_id := COALESCE(NEW.listing_id, OLD.listing_id);

  IF v_listing_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  UPDATE public.listings
  SET
    average_rating = COALESCE((
      SELECT ROUND(AVG(rating)::numeric, 2)
      FROM public.reviews
      WHERE listing_id = v_listing_id
      AND status = 'active'
    ), 0),
    total_reviews = (
      SELECT COUNT(*)
      FROM public.reviews
      WHERE listing_id = v_listing_id
      AND status = 'active'
    ),
    updated_at = NOW()
  WHERE id = v_listing_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER update_listing_stats_on_review
AFTER INSERT OR UPDATE OR DELETE ON reviews
FOR EACH ROW EXECUTE FUNCTION private.update_listing_stats();

-- Update review helpful_count from votes
CREATE OR REPLACE FUNCTION update_review_helpful_count()
RETURNS TRIGGER AS $$
DECLARE
  v_review_id UUID;
BEGIN
  v_review_id := COALESCE(NEW.review_id, OLD.review_id);

  UPDATE reviews
  SET helpful_count = (
    SELECT
      COUNT(*) FILTER (WHERE vote_type = 'helpful') -
      COUNT(*) FILTER (WHERE vote_type = 'not_helpful')
    FROM review_votes
    WHERE review_id = v_review_id
  )
  WHERE id = v_review_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER update_review_helpful_on_vote
AFTER INSERT OR UPDATE OR DELETE ON review_votes
FOR EACH ROW EXECUTE FUNCTION update_review_helpful_count();

-- Update fact helpful_count from votes
CREATE OR REPLACE FUNCTION update_fact_helpful_count()
RETURNS TRIGGER AS $$
DECLARE
  v_fact_id UUID;
BEGIN
  v_fact_id := COALESCE(NEW.fact_id, OLD.fact_id);

  UPDATE facts
  SET helpful_count = (
    SELECT
      COUNT(*) FILTER (WHERE vote_type = 'helpful') -
      COUNT(*) FILTER (WHERE vote_type = 'not_helpful')
    FROM fact_votes
    WHERE fact_id = v_fact_id
  )
  WHERE id = v_fact_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER update_fact_helpful_on_vote
AFTER INSERT OR UPDATE OR DELETE ON fact_votes
FOR EACH ROW EXECUTE FUNCTION update_fact_helpful_count();

-- Update user reputation
CREATE OR REPLACE FUNCTION private.update_user_reputation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_target_user_id UUID;
  v_new_score INTEGER;
BEGIN
  v_target_user_id := COALESCE(NEW.user_id, OLD.user_id);

  IF v_target_user_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT INTO v_new_score (
    -- Points from helpful reviews
    COALESCE((
      SELECT SUM(GREATEST(helpful_count, 0)) * 2
      FROM public.reviews
      WHERE user_id = v_target_user_id AND status = 'active'
    ), 0) +
    -- Points from verified facts
    COALESCE((
      SELECT COUNT(*) * 5
      FROM public.facts
      WHERE user_id = v_target_user_id
      AND verification_status = 'verified'
    ), 0) +
    -- Activity bonus (capped at 50)
    LEAST(
      COALESCE((SELECT COUNT(*) FROM public.reviews WHERE user_id = v_target_user_id AND status = 'active'), 0) +
      COALESCE((SELECT COUNT(*) FROM public.facts WHERE user_id = v_target_user_id), 0),
      50
    ) -
    -- Penalty for disputed facts
    COALESCE((
      SELECT COUNT(*) * 3
      FROM public.facts
      WHERE user_id = v_target_user_id
      AND verification_status = 'disputed'
    ), 0)
  );

  v_new_score := GREATEST(COALESCE(v_new_score, 0), 0);

  UPDATE public.users
  SET
    reputation_score = v_new_score,
    credibility_level = CASE
      WHEN v_new_score >= 500 THEN 'expert'
      WHEN v_new_score >= 200 THEN 'trusted'
      WHEN v_new_score >= 50 THEN 'contributor'
      ELSE 'novice'
    END,
    last_active = NOW()
  WHERE id = v_target_user_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER update_reputation_on_review
AFTER INSERT OR UPDATE OR DELETE ON reviews
FOR EACH ROW EXECUTE FUNCTION private.update_user_reputation();

CREATE TRIGGER update_reputation_on_fact
AFTER INSERT OR UPDATE OR DELETE ON facts
FOR EACH ROW EXECUTE FUNCTION private.update_user_reputation();

CREATE TRIGGER update_reputation_on_review_vote
AFTER INSERT OR UPDATE OR DELETE ON review_votes
FOR EACH ROW EXECUTE FUNCTION private.update_user_reputation();

CREATE TRIGGER update_reputation_on_fact_vote
AFTER INSERT OR UPDATE OR DELETE ON fact_votes
FOR EACH ROW EXECUTE FUNCTION private.update_user_reputation();

-- =====================================================
-- VIEWS
-- =====================================================

-- Check if listing is claimed (replaces is_claimed column)
CREATE OR REPLACE VIEW public.listing_claim_status AS
SELECT
  l.id AS listing_id,
  CASE WHEN lc.id IS NOT NULL THEN true ELSE false END AS is_claimed,
  lc.user_id AS claimed_by,
  lc.verified_at AS claimed_at,
  lc.role AS claim_role
FROM listings l
LEFT JOIN listing_claims lc ON lc.listing_id = l.id
  AND lc.status = 'verified'
  AND lc.role = 'owner'
  AND (lc.expires_at IS NULL OR lc.expires_at > NOW());

-- Full listing view with related data
CREATE OR REPLACE VIEW public.listing_full AS
SELECT
  l.id,
  l.slug,
  l.name,
  l.description,
  l.entity_type,
  l.status,
  l.average_rating,
  l.total_reviews,
  l.created_at,
  l.updated_at,

  -- Location
  l.city_code,
  c.name AS city_name,
  c.slug AS city_slug,
  c.region,
  l.district_id,
  d.name AS district_name,
  d.slug AS district_slug,
  l.address_line,
  l.latitude,
  l.longitude,

  -- Primary category
  cat.id AS category_id,
  cat.slug AS category_slug,
  cat.name AS category_name,
  cat.icon AS category_icon,
  parent_cat.slug AS parent_category_slug,
  parent_cat.name AS parent_category_name,

  -- Brand (for products)
  brand.id AS brand_id,
  brand.name AS brand_name,
  brand.slug AS brand_slug,

  -- Claim status
  cls.is_claimed,
  cls.claimed_by,

  -- Primary photo
  photo.url AS primary_photo_url

FROM listings l
LEFT JOIN cities c ON c.code = l.city_code
LEFT JOIN districts d ON d.id = l.district_id
LEFT JOIN listing_categories lcat ON lcat.listing_id = l.id AND lcat.is_primary = true
LEFT JOIN categories cat ON cat.id = lcat.category_id
LEFT JOIN categories parent_cat ON parent_cat.id = cat.parent_id
LEFT JOIN listings brand ON brand.id = l.parent_id
LEFT JOIN listing_claim_status cls ON cls.listing_id = l.id
LEFT JOIN listing_photos photo ON photo.listing_id = l.id AND photo.is_primary = true AND photo.status = 'active';

-- =====================================================
-- MATERIALIZED VIEWS
-- =====================================================

-- Brand statistics
CREATE MATERIALIZED VIEW public.brand_product_stats AS
SELECT
  parent.id AS brand_id,
  parent.name AS brand_name,
  parent.slug AS brand_slug,
  COUNT(child.id) AS product_count,
  ROUND(AVG(child.average_rating) FILTER (WHERE child.total_reviews >= 3), 2) AS avg_product_rating,
  SUM(child.total_reviews) AS total_product_reviews
FROM listings parent
LEFT JOIN listings child ON child.parent_id = parent.id AND child.entity_type = 'product' AND child.status = 'active'
WHERE parent.entity_type = 'brand'
  AND parent.status = 'active'
GROUP BY parent.id, parent.name, parent.slug;

CREATE UNIQUE INDEX idx_brand_stats_id ON brand_product_stats(brand_id);

-- Category statistics
CREATE MATERIALIZED VIEW public.category_stats AS
SELECT
  c.id AS category_id,
  c.slug,
  c.name,
  c.parent_id,
  COUNT(DISTINCT lc.listing_id) FILTER (WHERE l.status = 'active') AS listing_count,
  ROUND(AVG(l.average_rating) FILTER (WHERE l.total_reviews >= 3 AND l.status = 'active'), 2) AS avg_rating
FROM categories c
LEFT JOIN listing_categories lc ON lc.category_id = c.id
LEFT JOIN listings l ON l.id = lc.listing_id
GROUP BY c.id, c.slug, c.name, c.parent_id;

CREATE UNIQUE INDEX idx_category_stats_id ON category_stats(category_id);

-- =====================================================
-- BİLİNÇ - COMPLETE DATABASE SCHEMA (CONTINUED)
-- Part 2: From refresh_materialized_views onwards
-- =====================================================

-- =====================================================
-- REFRESH MATERIALIZED VIEWS FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION public.refresh_materialized_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY brand_product_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY category_stats;
END;
$$;

-- =====================================================
-- UTILITY FUNCTIONS
-- =====================================================

-- Generate URL-safe slug from Turkish text
CREATE OR REPLACE FUNCTION public.generate_slug(input_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  result TEXT;
BEGIN
  result := lower(trim(input_text));

  -- Turkish character replacements
  result := replace(result, 'ı', 'i');
  result := replace(result, 'İ', 'i');
  result := replace(result, 'ğ', 'g');
  result := replace(result, 'Ğ', 'g');
  result := replace(result, 'ü', 'u');
  result := replace(result, 'Ü', 'u');
  result := replace(result, 'ş', 's');
  result := replace(result, 'Ş', 's');
  result := replace(result, 'ö', 'o');
  result := replace(result, 'Ö', 'o');
  result := replace(result, 'ç', 'c');
  result := replace(result, 'Ç', 'c');

  -- Replace non-alphanumeric with hyphens
  result := regexp_replace(result, '[^a-z0-9]+', '-', 'g');

  -- Remove leading/trailing hyphens
  result := trim(both '-' from result);

  -- Collapse multiple hyphens
  result := regexp_replace(result, '-+', '-', 'g');

  RETURN result;
END;
$$;

-- Auto-generate slug on listing insert
CREATE OR REPLACE FUNCTION auto_generate_listing_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := public.generate_slug(NEW.name);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER listings_auto_slug
BEFORE INSERT ON listings
FOR EACH ROW EXECUTE FUNCTION auto_generate_listing_slug();

-- =====================================================
-- SEARCH FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION public.search_listings(
  search_query TEXT,
  p_entity_type TEXT DEFAULT NULL,
  p_city_code CHAR(2) DEFAULT NULL,
  p_category_slug TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  slug TEXT,
  name TEXT,
  description TEXT,
  entity_type TEXT,
  city_name TEXT,
  district_name TEXT,
  category_name TEXT,
  average_rating NUMERIC,
  total_reviews INTEGER,
  rank REAL
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.id,
    l.slug,
    l.name,
    l.description,
    l.entity_type,
    c.name AS city_name,
    d.name AS district_name,
    cat.name AS category_name,
    l.average_rating,
    l.total_reviews,
    ts_rank(l.search_vector, websearch_to_tsquery('turkish', search_query)) AS rank
  FROM listings l
  LEFT JOIN cities c ON c.code = l.city_code
  LEFT JOIN districts d ON d.id = l.district_id
  LEFT JOIN listing_categories lc ON lc.listing_id = l.id AND lc.is_primary = true
  LEFT JOIN categories cat ON cat.id = lc.category_id
  WHERE l.status = 'active'
    AND l.search_vector @@ websearch_to_tsquery('turkish', search_query)
    AND (p_entity_type IS NULL OR l.entity_type = p_entity_type)
    AND (p_city_code IS NULL OR l.city_code = p_city_code)
    AND (p_category_slug IS NULL OR cat.slug = p_category_slug)
  ORDER BY rank DESC, l.average_rating DESC, l.total_reviews DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- =====================================================
-- LISTING STATISTICS FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_listing_stats(p_listing_id UUID)
RETURNS TABLE (
  total_reviews BIGINT,
  average_rating NUMERIC,
  rating_1 BIGINT,
  rating_2 BIGINT,
  rating_3 BIGINT,
  rating_4 BIGINT,
  rating_5 BIGINT,
  total_facts BIGINT,
  verified_facts BIGINT,
  disputed_facts BIGINT,
  total_photos BIGINT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM reviews WHERE listing_id = p_listing_id AND status = 'active'),
    (SELECT ROUND(AVG(rating)::numeric, 2) FROM reviews WHERE listing_id = p_listing_id AND status = 'active'),
    (SELECT COUNT(*) FROM reviews WHERE listing_id = p_listing_id AND status = 'active' AND rating = 1),
    (SELECT COUNT(*) FROM reviews WHERE listing_id = p_listing_id AND status = 'active' AND rating = 2),
    (SELECT COUNT(*) FROM reviews WHERE listing_id = p_listing_id AND status = 'active' AND rating = 3),
    (SELECT COUNT(*) FROM reviews WHERE listing_id = p_listing_id AND status = 'active' AND rating = 4),
    (SELECT COUNT(*) FROM reviews WHERE listing_id = p_listing_id AND status = 'active' AND rating = 5),
    (SELECT COUNT(*) FROM facts WHERE listing_id = p_listing_id AND verification_status != 'retracted'),
    (SELECT COUNT(*) FROM facts WHERE listing_id = p_listing_id AND verification_status = 'verified'),
    (SELECT COUNT(*) FROM facts WHERE listing_id = p_listing_id AND verification_status = 'disputed'),
    (SELECT COUNT(*) FROM listing_photos WHERE listing_id = p_listing_id AND status = 'active');
END;
$$;

-- =====================================================
-- USER PROFILE FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_user_profile(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  reputation_score INTEGER,
  credibility_level TEXT,
  member_since TIMESTAMPTZ,
  total_reviews BIGINT,
  total_facts BIGINT,
  verified_facts BIGINT,
  helpful_votes_received BIGINT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id,
    u.username,
    u.display_name,
    u.avatar_url,
    u.reputation_score,
    u.credibility_level,
    u.created_at AS member_since,
    (SELECT COUNT(*) FROM reviews WHERE user_id = p_user_id AND status = 'active'),
    (SELECT COUNT(*) FROM facts WHERE user_id = p_user_id AND verification_status != 'retracted'),
    (SELECT COUNT(*) FROM facts WHERE user_id = p_user_id AND verification_status = 'verified'),
    (SELECT COALESCE(SUM(GREATEST(helpful_count, 0)), 0) FROM reviews WHERE user_id = p_user_id AND status = 'active')
  FROM users u
  WHERE u.id = p_user_id AND u.is_active = true;
END;
$$;

-- =====================================================
-- NEARBY LISTINGS FUNCTION (for businesses)
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_nearby_listings(
  p_latitude NUMERIC,
  p_longitude NUMERIC,
  p_radius_km NUMERIC DEFAULT 5,
  p_category_slug TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  slug TEXT,
  name TEXT,
  entity_type TEXT,
  city_name TEXT,
  district_name TEXT,
  category_name TEXT,
  average_rating NUMERIC,
  total_reviews INTEGER,
  latitude NUMERIC,
  longitude NUMERIC,
  distance_km NUMERIC
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.id,
    l.slug,
    l.name,
    l.entity_type,
    c.name AS city_name,
    d.name AS district_name,
    cat.name AS category_name,
    l.average_rating,
    l.total_reviews,
    l.latitude,
    l.longitude,
    ROUND((
      6371 * acos(
        cos(radians(p_latitude)) * cos(radians(l.latitude)) *
        cos(radians(l.longitude) - radians(p_longitude)) +
        sin(radians(p_latitude)) * sin(radians(l.latitude))
      )
    )::numeric, 2) AS distance_km
  FROM listings l
  LEFT JOIN cities c ON c.code = l.city_code
  LEFT JOIN districts d ON d.id = l.district_id
  LEFT JOIN listing_categories lc ON lc.listing_id = l.id AND lc.is_primary = true
  LEFT JOIN categories cat ON cat.id = lc.category_id
  WHERE l.status = 'active'
    AND l.entity_type = 'business'
    AND l.latitude IS NOT NULL
    AND l.longitude IS NOT NULL
    AND (p_category_slug IS NULL OR cat.slug = p_category_slug)
    AND (
      6371 * acos(
        cos(radians(p_latitude)) * cos(radians(l.latitude)) *
        cos(radians(l.longitude) - radians(p_longitude)) +
        sin(radians(p_latitude)) * sin(radians(l.latitude))
      )
    ) <= p_radius_km
  ORDER BY distance_km ASC
  LIMIT p_limit;
END;
$$;

-- =====================================================
-- FACT VERIFICATION STATUS UPDATE TRIGGER
-- Auto-update verification_status based on fact_checks
-- =====================================================

CREATE OR REPLACE FUNCTION update_fact_verification_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_fact_id UUID;
  v_verify_count INTEGER;
  v_dispute_count INTEGER;
  v_needs_evidence_count INTEGER;
  v_total_checks INTEGER;
BEGIN
  v_fact_id := COALESCE(NEW.fact_id, OLD.fact_id);

  SELECT
    COUNT(*) FILTER (WHERE vote = 'verify'),
    COUNT(*) FILTER (WHERE vote = 'dispute'),
    COUNT(*) FILTER (WHERE vote = 'needs_evidence'),
    COUNT(*)
  INTO v_verify_count, v_dispute_count, v_needs_evidence_count, v_total_checks
  FROM fact_checks
  WHERE fact_id = v_fact_id;

  -- Only update if there are enough checks
  IF v_total_checks >= 3 THEN
    UPDATE facts
    SET
      verification_status = CASE
        WHEN v_verify_count >= 3 AND v_verify_count > v_dispute_count * 2 THEN 'verified'
        WHEN v_dispute_count >= 3 AND v_dispute_count > v_verify_count THEN 'disputed'
        WHEN v_needs_evidence_count >= 2 THEN 'needs_review'
        ELSE verification_status
      END,
      updated_at = NOW()
    WHERE id = v_fact_id
    AND verification_status NOT IN ('retracted');
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER update_fact_status_on_check
AFTER INSERT OR UPDATE OR DELETE ON fact_checks
FOR EACH ROW EXECUTE FUNCTION update_fact_verification_status();

-- =====================================================
-- AUTO-APPROVE EDITS FROM TRUSTED USERS
-- =====================================================

CREATE OR REPLACE FUNCTION auto_approve_trusted_edits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_credibility TEXT;
  v_is_owner BOOLEAN;
BEGIN
  -- Check if user owns the listing
  v_is_owner := private.user_owns_listing(NEW.user_id, NEW.listing_id);

  -- Get user credibility
  SELECT credibility_level INTO v_user_credibility
  FROM users
  WHERE id = NEW.user_id;

  -- Auto-approve if owner or trusted/expert user
  IF v_is_owner OR v_user_credibility IN ('trusted', 'expert') THEN
    NEW.status := 'auto_approved';
    NEW.reviewed_at := NOW();
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER listing_edits_auto_approve
BEFORE INSERT ON listing_edits
FOR EACH ROW EXECUTE FUNCTION auto_approve_trusted_edits();

-- =====================================================
-- APPLY AUTO-APPROVED EDITS
-- =====================================================

CREATE OR REPLACE FUNCTION apply_approved_edit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only apply if status changed to approved/auto_approved
  IF NEW.status IN ('approved', 'auto_approved') AND OLD.status = 'pending' THEN
    -- Update the listing field
    EXECUTE format(
      'UPDATE listings SET %I = $1, updated_at = NOW() WHERE id = $2',
      NEW.field_name
    ) USING NEW.new_value, NEW.listing_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER listing_edits_apply
AFTER UPDATE OF status ON listing_edits
FOR EACH ROW EXECUTE FUNCTION apply_approved_edit();

-- =====================================================
-- PREVENT SELF-REVIEW
-- =====================================================

CREATE OR REPLACE FUNCTION prevent_self_review()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if user owns the listing they're trying to review
  IF private.user_owns_listing(NEW.user_id, NEW.listing_id) THEN
    RAISE EXCEPTION 'Cannot review your own listing';
  END IF;

  -- Check if user created the listing
  IF private.user_created_listing(NEW.user_id, NEW.listing_id) THEN
    RAISE EXCEPTION 'Cannot review a listing you created';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER reviews_prevent_self
BEFORE INSERT ON reviews
FOR EACH ROW EXECUTE FUNCTION prevent_self_review();

-- =====================================================
-- PREVENT SELF-VOTE
-- =====================================================

CREATE OR REPLACE FUNCTION prevent_self_vote_review()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM reviews
    WHERE id = NEW.review_id
    AND user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'Cannot vote on your own review';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER review_votes_prevent_self
BEFORE INSERT ON review_votes
FOR EACH ROW EXECUTE FUNCTION prevent_self_vote_review();

CREATE OR REPLACE FUNCTION prevent_self_vote_fact()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM facts
    WHERE id = NEW.fact_id
    AND user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'Cannot vote on your own fact';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER fact_votes_prevent_self
BEFORE INSERT ON fact_votes
FOR EACH ROW EXECUTE FUNCTION prevent_self_vote_fact();

-- =====================================================
-- UPDATED_AT TRIGGERS
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER listings_updated_at
BEFORE UPDATE ON listings
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER reviews_updated_at
BEFORE UPDATE ON reviews
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER facts_updated_at
BEFORE UPDATE ON facts
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER review_responses_updated_at
BEFORE UPDATE ON review_responses
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER fact_responses_updated_at
BEFORE UPDATE ON fact_responses
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER listing_contacts_updated_at
BEFORE UPDATE ON listing_contacts
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER user_security_updated_at
BEFORE UPDATE ON user_security
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- LISTING URL HELPER
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_listing_url(p_listing_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT
    CASE entity_type
      WHEN 'business' THEN '/isletme/'
      WHEN 'product' THEN '/urun/'
      WHEN 'brand' THEN '/marka/'
    END || id || '/' || slug
  FROM listings
  WHERE id = p_listing_id;
$$;

-- =====================================================
-- CATEGORY TREE FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_category_tree()
RETURNS TABLE (
  id UUID,
  slug TEXT,
  name TEXT,
  name_en TEXT,
  icon TEXT,
  parent_id UUID,
  parent_slug TEXT,
  parent_name TEXT,
  depth INTEGER,
  listing_count BIGINT
)
LANGUAGE sql
STABLE
AS $$
  WITH RECURSIVE category_tree AS (
    -- Root categories
    SELECT
      c.id,
      c.slug,
      c.name,
      c.name_en,
      c.icon,
      c.parent_id,
      NULL::TEXT AS parent_slug,
      NULL::TEXT AS parent_name,
      0 AS depth
    FROM categories c
    WHERE c.parent_id IS NULL

    UNION ALL

    -- Child categories
    SELECT
      c.id,
      c.slug,
      c.name,
      c.name_en,
      c.icon,
      c.parent_id,
      ct.slug AS parent_slug,
      ct.name AS parent_name,
      ct.depth + 1
    FROM categories c
    JOIN category_tree ct ON c.parent_id = ct.id
  )
  SELECT
    ct.*,
    COALESCE(
      (SELECT COUNT(DISTINCT lc.listing_id)
       FROM listing_categories lc
       JOIN listings l ON l.id = lc.listing_id
       WHERE lc.category_id = ct.id AND l.status = 'active'),
      0
    ) AS listing_count
  FROM category_tree ct
  ORDER BY ct.depth, ct.name;
$$;

-- =====================================================
-- BRAND PRODUCTS FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_brand_products(p_brand_id UUID)
RETURNS TABLE (
  id UUID,
  slug TEXT,
  name TEXT,
  description TEXT,
  average_rating NUMERIC,
  total_reviews INTEGER,
  primary_photo_url TEXT,
  category_name TEXT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    l.id,
    l.slug,
    l.name,
    l.description,
    l.average_rating,
    l.total_reviews,
    (SELECT url FROM listing_photos WHERE listing_id = l.id AND is_primary = true AND status = 'active' LIMIT 1),
    cat.name
  FROM listings l
  LEFT JOIN listing_categories lc ON lc.listing_id = l.id AND lc.is_primary = true
  LEFT JOIN categories cat ON cat.id = lc.category_id
  WHERE l.parent_id = p_brand_id
    AND l.entity_type = 'product'
    AND l.status = 'active'
  ORDER BY l.average_rating DESC NULLS LAST, l.total_reviews DESC;
$$;

-- =====================================================
-- TRENDING LISTINGS (last 30 days activity)
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_trending_listings(
  p_entity_type TEXT DEFAULT NULL,
  p_city_code CHAR(2) DEFAULT NULL,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  slug TEXT,
  name TEXT,
  entity_type TEXT,
  city_name TEXT,
  category_name TEXT,
  average_rating NUMERIC,
  total_reviews INTEGER,
  recent_reviews BIGINT,
  trend_score NUMERIC
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    l.id,
    l.slug,
    l.name,
    l.entity_type,
    c.name AS city_name,
    cat.name AS category_name,
    l.average_rating,
    l.total_reviews,
    (SELECT COUNT(*) FROM reviews r WHERE r.listing_id = l.id AND r.created_at > NOW() - INTERVAL '30 days' AND r.status = 'active') AS recent_reviews,
    (
      l.average_rating * 0.3 +
      LEAST(l.total_reviews, 100) * 0.01 +
      (SELECT COUNT(*) FROM reviews r WHERE r.listing_id = l.id AND r.created_at > NOW() - INTERVAL '7 days' AND r.status = 'active') * 0.5
    )::NUMERIC AS trend_score
  FROM listings l
  LEFT JOIN cities c ON c.code = l.city_code
  LEFT JOIN listing_categories lc ON lc.listing_id = l.id AND lc.is_primary = true
  LEFT JOIN categories cat ON cat.id = lc.category_id
  WHERE l.status = 'active'
    AND (p_entity_type IS NULL OR l.entity_type = p_entity_type)
    AND (p_city_code IS NULL OR l.city_code = p_city_code)
  ORDER BY trend_score DESC
  LIMIT p_limit;
$$;

-- =====================================================
-- ADMIN DASHBOARD STATS
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_admin_stats()
RETURNS TABLE (
  total_users BIGINT,
  active_users_30d BIGINT,
  total_listings BIGINT,
  pending_listings BIGINT,
  total_reviews BIGINT,
  reviews_today BIGINT,
  total_facts BIGINT,
  pending_claims BIGINT,
  pending_edits BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only allow admins
  IF NOT private.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM users WHERE is_active = true),
    (SELECT COUNT(*) FROM users WHERE last_active > NOW() - INTERVAL '30 days'),
    (SELECT COUNT(*) FROM listings WHERE status = 'active'),
    (SELECT COUNT(*) FROM listings WHERE status = 'pending'),
    (SELECT COUNT(*) FROM reviews WHERE status = 'active'),
    (SELECT COUNT(*) FROM reviews WHERE created_at::date = CURRENT_DATE AND status = 'active'),
    (SELECT COUNT(*) FROM facts WHERE verification_status != 'retracted'),
    (SELECT COUNT(*) FROM listing_claims WHERE status = 'pending'),
    (SELECT COUNT(*) FROM listing_edits WHERE status = 'pending');
END;
$$;

-- =====================================================
-- GRANT EXECUTE ON PUBLIC FUNCTIONS
-- =====================================================

GRANT EXECUTE ON FUNCTION public.generate_slug(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_listings(TEXT, TEXT, CHAR, TEXT, INTEGER, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_listing_stats(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_profile(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_nearby_listings(NUMERIC, NUMERIC, NUMERIC, TEXT, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_listing_url(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_category_tree() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_brand_products(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_trending_listings(TEXT, CHAR, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_materialized_views() TO authenticated;

-- =====================================================
-- CRON JOB SETUP (via pg_cron extension if available)
-- =====================================================

-- Uncomment if pg_cron is enabled:
-- SELECT cron.schedule('refresh-materialized-views', '0 */6 * * *', 'SELECT public.refresh_materialized_views()');

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
DECLARE
  table_count INTEGER;
  function_count INTEGER;
  trigger_count INTEGER;
  index_count INTEGER;
  view_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO table_count
  FROM pg_tables
  WHERE schemaname = 'public';

  SELECT COUNT(*) INTO function_count
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public';

  SELECT COUNT(*) INTO trigger_count
  FROM pg_trigger t
  JOIN pg_class c ON t.tgrelid = c.oid
  JOIN pg_namespace n ON c.relnamespace = n.oid
  WHERE n.nspname = 'public'
  AND NOT t.tgisinternal;

  SELECT COUNT(*) INTO index_count
  FROM pg_indexes
  WHERE schemaname = 'public';

  SELECT COUNT(*) INTO view_count
  FROM pg_views
  WHERE schemaname = 'public';

  RAISE NOTICE '══════════════════════════════════════════════════';
  RAISE NOTICE '  BİLİNÇ DATABASE SETUP COMPLETE';
  RAISE NOTICE '══════════════════════════════════════════════════';
  RAISE NOTICE '  Tables created:     %', table_count;
  RAISE NOTICE '  Functions created:  %', function_count;
  RAISE NOTICE '  Triggers created:   %', trigger_count;
  RAISE NOTICE '  Indexes created:    %', index_count;
  RAISE NOTICE '  Views created:      %', view_count;
  RAISE NOTICE '══════════════════════════════════════════════════';
  RAISE NOTICE '  Next steps:';
  RAISE NOTICE '  1. Run the RLS policies script';
  RAISE NOTICE '  2. Populate districts via API sync';
  RAISE NOTICE '  3. Create first admin user';
  RAISE NOTICE '══════════════════════════════════════════════════';
END $$;

ALTER TABLE listings ADD CONSTRAINT listings_slug_unique UNIQUE (slug);
