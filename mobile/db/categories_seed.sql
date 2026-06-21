-- ============================================================
-- Turkish Category Seed
-- 12 L1 root categories, ~80 L2 subcategories, selective L3
-- Runs AFTER backup_tables.sql clears the categories table
-- ============================================================

BEGIN;

-- ============================================================
-- L1: Root Categories
-- ============================================================

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('yiyecek-icecek', 'Yiyecek & İçecek', 'Food & Beverage', 'restaurant', NULL, '{business,product,brand}', 1);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('saglik-guzellik', 'Sağlık & Güzellik', 'Health & Beauty', 'heart', NULL, '{business,product,brand}', 2);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('moda', 'Moda', 'Fashion', 'shirt', NULL, '{business,product,brand}', 3);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('ev-yasam', 'Ev & Yaşam', 'Home & Living', 'home', NULL, '{business,product,brand}', 4);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('teknoloji', 'Teknoloji', 'Technology', 'laptop-outline', NULL, '{business,product,brand}', 5);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('otomotiv', 'Otomotiv', 'Automotive', 'car', NULL, '{business,product,brand}', 6);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('egitim', 'Eğitim', 'Education', 'school', NULL, '{business,product,brand}', 7);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('eglence', 'Eğlence', 'Entertainment', 'ticket', NULL, '{business,product,brand}', 8);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('spor-outdoor', 'Spor & Outdoor', 'Sports & Outdoor', 'barbell', NULL, '{business,product,brand}', 9);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('hizmetler', 'Hizmetler', 'Services', 'briefcase', NULL, '{business,brand}', 10);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('konaklama-seyahat', 'Konaklama & Seyahat', 'Accommodation & Travel', 'bed', NULL, '{business,brand}', 11);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('bebek-evcil', 'Bebek & Evcil Hayvan', 'Baby & Pets', 'paw', NULL, '{business,product,brand}', 12);


-- ============================================================
-- L2: Yiyecek & İçecek (13)
-- ============================================================

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('restoran-lokanta', 'Restoran & Lokanta', 'Restaurant', 'restaurant',
  (SELECT id FROM categories WHERE slug = 'yiyecek-icecek'),
  '{business,brand}', 1);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('kafe-bar', 'Kafe & Bar', 'Cafe & Bar', 'cafe',
  (SELECT id FROM categories WHERE slug = 'yiyecek-icecek'),
  '{business,brand}', 2);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('firin-pastane', 'Fırın & Pastane', 'Bakery & Pastry', 'storefront',
  (SELECT id FROM categories WHERE slug = 'yiyecek-icecek'),
  '{business,brand}', 3);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('market-bakkal', 'Market & Bakkal', 'Market & Grocery', 'cart',
  (SELECT id FROM categories WHERE slug = 'yiyecek-icecek'),
  '{business,brand}', 4);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('kasap', 'Kasap', 'Butcher', 'storefront-outline',
  (SELECT id FROM categories WHERE slug = 'yiyecek-icecek'),
  '{business}', 5);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('manav', 'Manav', 'Greengrocer', 'leaf',
  (SELECT id FROM categories WHERE slug = 'yiyecek-icecek'),
  '{business}', 6);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('balikci', 'Balıkçı', 'Fishmonger', 'fish',
  (SELECT id FROM categories WHERE slug = 'yiyecek-icecek'),
  '{business}', 7);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('sut-urunleri', 'Süt Ürünleri', 'Dairy Products', 'water',
  (SELECT id FROM categories WHERE slug = 'yiyecek-icecek'),
  '{product,brand}', 8);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('et-protein', 'Et & Protein', 'Meat & Protein', 'nutrition',
  (SELECT id FROM categories WHERE slug = 'yiyecek-icecek'),
  '{product,brand}', 9);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('temel-gida', 'Temel Gıda', 'Staple Foods', 'basket',
  (SELECT id FROM categories WHERE slug = 'yiyecek-icecek'),
  '{product,brand}', 10);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('kahvaltilik', 'Kahvaltılık', 'Breakfast Foods', 'sunny',
  (SELECT id FROM categories WHERE slug = 'yiyecek-icecek'),
  '{product,brand}', 11);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('tatli-atistirmalik', 'Tatlı & Atıştırmalık', 'Sweets & Snacks', 'ice-cream',
  (SELECT id FROM categories WHERE slug = 'yiyecek-icecek'),
  '{product,brand}', 12);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('icecek', 'İçecek', 'Beverages', 'beer',
  (SELECT id FROM categories WHERE slug = 'yiyecek-icecek'),
  '{product,brand}', 13);


-- ============================================================
-- L2: Sağlık & Güzellik (12)
-- ============================================================

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('hastane-klinik', 'Hastane & Klinik', 'Hospital & Clinic', 'medkit',
  (SELECT id FROM categories WHERE slug = 'saglik-guzellik'),
  '{business}', 1);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('doktor-uzman', 'Doktor & Uzman', 'Doctor & Specialist', 'person',
  (SELECT id FROM categories WHERE slug = 'saglik-guzellik'),
  '{business}', 2);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('eczane', 'Eczane', 'Pharmacy', 'medical',
  (SELECT id FROM categories WHERE slug = 'saglik-guzellik'),
  '{business}', 3);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('kuafor-berber', 'Kuaför & Berber', 'Hair Salon & Barber', 'cut',
  (SELECT id FROM categories WHERE slug = 'saglik-guzellik'),
  '{business}', 4);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('guzellik-salonu', 'Güzellik Salonu', 'Beauty Salon', 'sparkles',
  (SELECT id FROM categories WHERE slug = 'saglik-guzellik'),
  '{business}', 5);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('spa-masaj', 'Spa & Masaj', 'Spa & Massage', 'water-outline',
  (SELECT id FROM categories WHERE slug = 'saglik-guzellik'),
  '{business}', 6);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('spor-salonu', 'Spor Salonu', 'Gym', 'barbell-outline',
  (SELECT id FROM categories WHERE slug = 'saglik-guzellik'),
  '{business,brand}', 7);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('cilt-bakim-urunleri', 'Cilt Bakım Ürünleri', 'Skin Care Products', 'flower',
  (SELECT id FROM categories WHERE slug = 'saglik-guzellik'),
  '{product,brand}', 8);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('sac-bakim-urunleri', 'Saç Bakım Ürünleri', 'Hair Care Products', 'color-wand',
  (SELECT id FROM categories WHERE slug = 'saglik-guzellik'),
  '{product,brand}', 9);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('makyaj', 'Makyaj', 'Makeup', 'color-palette',
  (SELECT id FROM categories WHERE slug = 'saglik-guzellik'),
  '{product,brand}', 10);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('parfum-deodorant', 'Parfüm & Deodorant', 'Perfume & Deodorant', 'rose',
  (SELECT id FROM categories WHERE slug = 'saglik-guzellik'),
  '{product,brand}', 11);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('saglik-urunleri', 'Sağlık Ürünleri', 'Health Products', 'fitness',
  (SELECT id FROM categories WHERE slug = 'saglik-guzellik'),
  '{product,brand}', 12);


-- ============================================================
-- L2: Moda (9)
-- ============================================================

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('giyim-magazasi', 'Giyim Mağazası', 'Clothing Store', 'storefront',
  (SELECT id FROM categories WHERE slug = 'moda'),
  '{business,brand}', 1);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('kadin-giyim', 'Kadın Giyim', 'Women''s Clothing', 'woman',
  (SELECT id FROM categories WHERE slug = 'moda'),
  '{product,brand}', 2);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('erkek-giyim', 'Erkek Giyim', 'Men''s Clothing', 'man',
  (SELECT id FROM categories WHERE slug = 'moda'),
  '{product,brand}', 3);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('cocuk-giyim', 'Çocuk Giyim', 'Children''s Clothing', 'happy',
  (SELECT id FROM categories WHERE slug = 'moda'),
  '{product,brand}', 4);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('ayakkabi', 'Ayakkabı', 'Footwear', 'footsteps',
  (SELECT id FROM categories WHERE slug = 'moda'),
  '{business,product,brand}', 5);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('canta', 'Çanta', 'Bags', 'bag-handle',
  (SELECT id FROM categories WHERE slug = 'moda'),
  '{product,brand}', 6);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('saat-taki', 'Saat & Takı', 'Watches & Jewelry', 'watch',
  (SELECT id FROM categories WHERE slug = 'moda'),
  '{business,product,brand}', 7);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('gozluk', 'Gözlük', 'Eyewear', 'glasses',
  (SELECT id FROM categories WHERE slug = 'moda'),
  '{business,product,brand}', 8);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('terzi', 'Terzi', 'Tailor', 'cut-outline',
  (SELECT id FROM categories WHERE slug = 'moda'),
  '{business}', 9);


-- ============================================================
-- L2: Ev & Yaşam (12)
-- ============================================================

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('mobilya', 'Mobilya', 'Furniture', 'bed-outline',
  (SELECT id FROM categories WHERE slug = 'ev-yasam'),
  '{product,brand}', 1);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('mobilya-magazasi', 'Mobilya Mağazası', 'Furniture Store', 'storefront',
  (SELECT id FROM categories WHERE slug = 'ev-yasam'),
  '{business,brand}', 2);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('ev-tekstili', 'Ev Tekstili', 'Home Textiles', 'shirt-outline',
  (SELECT id FROM categories WHERE slug = 'ev-yasam'),
  '{product,brand}', 3);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('mutfak-gerecleri', 'Mutfak Gereçleri', 'Kitchen Utensils', 'restaurant-outline',
  (SELECT id FROM categories WHERE slug = 'ev-yasam'),
  '{product,brand}', 4);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('dekorasyon', 'Dekorasyon', 'Decoration', 'color-palette-outline',
  (SELECT id FROM categories WHERE slug = 'ev-yasam'),
  '{product,brand}', 5);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('aydinlatma', 'Aydınlatma', 'Lighting', 'bulb',
  (SELECT id FROM categories WHERE slug = 'ev-yasam'),
  '{product,brand}', 6);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('beyaz-esya', 'Beyaz Eşya', 'White Goods', 'cube',
  (SELECT id FROM categories WHERE slug = 'ev-yasam'),
  '{product,brand}', 7);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('kucuk-ev-aletleri', 'Küçük Ev Aletleri', 'Small Home Appliances', 'flash',
  (SELECT id FROM categories WHERE slug = 'ev-yasam'),
  '{product,brand}', 8);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('yapi-market', 'Yapı Market', 'Hardware Store', 'hammer',
  (SELECT id FROM categories WHERE slug = 'ev-yasam'),
  '{business,brand}', 9);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('temizlik-urunleri', 'Temizlik Ürünleri', 'Cleaning Products', 'sparkles-outline',
  (SELECT id FROM categories WHERE slug = 'ev-yasam'),
  '{product,brand}', 10);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('bahce', 'Bahçe', 'Garden', 'leaf-outline',
  (SELECT id FROM categories WHERE slug = 'ev-yasam'),
  '{product,brand}', 11);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('ev-tadilat', 'Ev Tadilat Hizmeti', 'Home Renovation', 'construct',
  (SELECT id FROM categories WHERE slug = 'ev-yasam'),
  '{business}', 12);


-- ============================================================
-- L2: Teknoloji (9)
-- ============================================================

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('telefon', 'Telefon', 'Phone', 'phone-portrait',
  (SELECT id FROM categories WHERE slug = 'teknoloji'),
  '{product,brand}', 1);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('bilgisayar', 'Bilgisayar', 'Computer', 'laptop-outline',
  (SELECT id FROM categories WHERE slug = 'teknoloji'),
  '{product,brand}', 2);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('tablet', 'Tablet', 'Tablet', 'tablet-portrait',
  (SELECT id FROM categories WHERE slug = 'teknoloji'),
  '{product,brand}', 3);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('televizyon', 'Televizyon', 'Television', 'tv',
  (SELECT id FROM categories WHERE slug = 'teknoloji'),
  '{product,brand}', 4);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('ses-goruntu', 'Ses & Görüntü', 'Audio & Video', 'headset',
  (SELECT id FROM categories WHERE slug = 'teknoloji'),
  '{product,brand}', 5);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('oyun-konsol', 'Oyun & Konsol', 'Gaming & Consoles', 'game-controller',
  (SELECT id FROM categories WHERE slug = 'teknoloji'),
  '{product,brand}', 6);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('aksesuar', 'Aksesuar', 'Accessories', 'watch-outline',
  (SELECT id FROM categories WHERE slug = 'teknoloji'),
  '{product,brand}', 7);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('elektronik-magazasi', 'Elektronik Mağazası', 'Electronics Store', 'storefront-outline',
  (SELECT id FROM categories WHERE slug = 'teknoloji'),
  '{business,brand}', 8);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('teknik-servis', 'Teknik Servis', 'Technical Service', 'build',
  (SELECT id FROM categories WHERE slug = 'teknoloji'),
  '{business}', 9);


-- ============================================================
-- L2: Otomotiv (10)
-- ============================================================

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('benzin-istasyonu', 'Benzin İstasyonu', 'Gas Station', 'flame',
  (SELECT id FROM categories WHERE slug = 'otomotiv'),
  '{business,brand}', 1);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('oto-yikama', 'Oto Yıkama', 'Car Wash', 'water',
  (SELECT id FROM categories WHERE slug = 'otomotiv'),
  '{business}', 2);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('oto-tamir', 'Oto Tamir', 'Auto Repair', 'build-outline',
  (SELECT id FROM categories WHERE slug = 'otomotiv'),
  '{business}', 3);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('lastikci', 'Lastikçi', 'Tire Shop', 'ellipse',
  (SELECT id FROM categories WHERE slug = 'otomotiv'),
  '{business}', 4);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('oto-galeri', 'Oto Galeri', 'Car Dealership', 'car-outline',
  (SELECT id FROM categories WHERE slug = 'otomotiv'),
  '{business}', 5);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('arac-kiralama', 'Araç Kiralama', 'Car Rental', 'key',
  (SELECT id FROM categories WHERE slug = 'otomotiv'),
  '{business,brand}', 6);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('otopark', 'Otopark', 'Parking', 'navigate',
  (SELECT id FROM categories WHERE slug = 'otomotiv'),
  '{business}', 7);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('yedek-parca', 'Yedek Parça', 'Spare Parts', 'settings',
  (SELECT id FROM categories WHERE slug = 'otomotiv'),
  '{business,product,brand}', 8);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('arac-bakim-urunleri', 'Araç Bakım Ürünleri', 'Car Care Products', 'color-fill',
  (SELECT id FROM categories WHERE slug = 'otomotiv'),
  '{product,brand}', 9);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('arac-aksesuari', 'Araç Aksesuarı', 'Car Accessories', 'options',
  (SELECT id FROM categories WHERE slug = 'otomotiv'),
  '{product,brand}', 10);


-- ============================================================
-- L2: Eğitim (6)
-- ============================================================

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('okul', 'Okul', 'School', 'school-outline',
  (SELECT id FROM categories WHERE slug = 'egitim'),
  '{business}', 1);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('kurs', 'Kurs', 'Course', 'book',
  (SELECT id FROM categories WHERE slug = 'egitim'),
  '{business}', 2);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('ozel-ders', 'Özel Ders', 'Private Tutoring', 'person-outline',
  (SELECT id FROM categories WHERE slug = 'egitim'),
  '{business}', 3);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('surucu-kursu', 'Sürücü Kursu', 'Driving School', 'car-sport',
  (SELECT id FROM categories WHERE slug = 'egitim'),
  '{business}', 4);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('kitap', 'Kitap', 'Books', 'book-outline',
  (SELECT id FROM categories WHERE slug = 'egitim'),
  '{product,brand}', 5);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('kirtasiye', 'Kırtasiye', 'Stationery', 'pencil',
  (SELECT id FROM categories WHERE slug = 'egitim'),
  '{business,product,brand}', 6);


-- ============================================================
-- L2: Eğlence (8)
-- ============================================================

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('sinema', 'Sinema', 'Cinema', 'film',
  (SELECT id FROM categories WHERE slug = 'eglence'),
  '{business,brand}', 1);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('tiyatro', 'Tiyatro', 'Theater', 'mic',
  (SELECT id FROM categories WHERE slug = 'eglence'),
  '{business}', 2);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('muze', 'Müze', 'Museum', 'business',
  (SELECT id FROM categories WHERE slug = 'eglence'),
  '{business}', 3);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('park-lunapark', 'Park & Lunapark', 'Park & Amusement Park', 'happy-outline',
  (SELECT id FROM categories WHERE slug = 'eglence'),
  '{business}', 4);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('gece-kulubu', 'Gece Kulübü', 'Night Club', 'moon',
  (SELECT id FROM categories WHERE slug = 'eglence'),
  '{business}', 5);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('oyun-salonu', 'Oyun Salonu', 'Arcade', 'game-controller-outline',
  (SELECT id FROM categories WHERE slug = 'eglence'),
  '{business}', 6);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('bowling', 'Bowling', 'Bowling', 'bowling-ball',
  (SELECT id FROM categories WHERE slug = 'eglence'),
  '{business}', 7);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('oyuncak', 'Oyuncak', 'Toys', 'cube-outline',
  (SELECT id FROM categories WHERE slug = 'eglence'),
  '{product,brand}', 8);


-- ============================================================
-- L2: Spor & Outdoor (6)
-- ============================================================

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('spor-salonu-tesis', 'Spor Salonu & Tesis', 'Gym & Sports Facility', 'barbell-outline',
  (SELECT id FROM categories WHERE slug = 'spor-outdoor'),
  '{business}', 1);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('fitness-ekipmani', 'Fitness Ekipmanı', 'Fitness Equipment', 'body',
  (SELECT id FROM categories WHERE slug = 'spor-outdoor'),
  '{product,brand}', 2);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('spor-giyim', 'Spor Giyim', 'Sports Clothing', 'shirt-outline',
  (SELECT id FROM categories WHERE slug = 'spor-outdoor'),
  '{product,brand}', 3);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('spor-ayakkabi', 'Spor Ayakkabı', 'Sports Footwear', 'footsteps-outline',
  (SELECT id FROM categories WHERE slug = 'spor-outdoor'),
  '{product,brand}', 4);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('outdoor-kamp', 'Outdoor & Kamp', 'Outdoor & Camping', 'compass',
  (SELECT id FROM categories WHERE slug = 'spor-outdoor'),
  '{product,brand}', 5);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('bisiklet', 'Bisiklet', 'Bicycle', 'bicycle',
  (SELECT id FROM categories WHERE slug = 'spor-outdoor'),
  '{product,brand}', 6);


-- ============================================================
-- L2: Hizmetler (10)
-- ============================================================

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('banka-finans', 'Banka & Finans', 'Banking & Finance', 'cash',
  (SELECT id FROM categories WHERE slug = 'hizmetler'),
  '{business,brand}', 1);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('sigorta', 'Sigorta', 'Insurance', 'shield-checkmark',
  (SELECT id FROM categories WHERE slug = 'hizmetler'),
  '{business,brand}', 2);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('avukat-hukuk', 'Avukat & Hukuk', 'Legal Services', 'document-text',
  (SELECT id FROM categories WHERE slug = 'hizmetler'),
  '{business}', 3);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('noter', 'Noter', 'Notary', 'reader',
  (SELECT id FROM categories WHERE slug = 'hizmetler'),
  '{business}', 4);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('emlak', 'Emlak', 'Real Estate', 'home-outline',
  (SELECT id FROM categories WHERE slug = 'hizmetler'),
  '{business,brand}', 5);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('nakliyat', 'Nakliyat', 'Moving & Transport', 'bus',
  (SELECT id FROM categories WHERE slug = 'hizmetler'),
  '{business}', 6);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('temizlik-hizmeti', 'Temizlik Hizmeti', 'Cleaning Service', 'sparkles',
  (SELECT id FROM categories WHERE slug = 'hizmetler'),
  '{business}', 7);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('kargo-kurye', 'Kargo & Kurye', 'Cargo & Courier', 'paper-plane',
  (SELECT id FROM categories WHERE slug = 'hizmetler'),
  '{business,brand}', 8);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('fotografci', 'Fotoğrafçı', 'Photographer', 'camera',
  (SELECT id FROM categories WHERE slug = 'hizmetler'),
  '{business}', 9);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('organizasyon', 'Organizasyon', 'Event Planning', 'calendar',
  (SELECT id FROM categories WHERE slug = 'hizmetler'),
  '{business}', 10);


-- ============================================================
-- L2: Konaklama & Seyahat (4)
-- ============================================================

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('otel', 'Otel', 'Hotel', 'bed-outline',
  (SELECT id FROM categories WHERE slug = 'konaklama-seyahat'),
  '{business,brand}', 1);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('pansiyon-hostel', 'Pansiyon & Hostel', 'Guesthouse & Hostel', 'home-outline',
  (SELECT id FROM categories WHERE slug = 'konaklama-seyahat'),
  '{business}', 2);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('apart-kiralik', 'Apart & Kiralık', 'Apartment & Rental', 'key-outline',
  (SELECT id FROM categories WHERE slug = 'konaklama-seyahat'),
  '{business}', 3);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('seyahat-acentesi', 'Seyahat Acentesi', 'Travel Agency', 'airplane',
  (SELECT id FROM categories WHERE slug = 'konaklama-seyahat'),
  '{business,brand}', 4);


-- ============================================================
-- L2: Bebek & Evcil Hayvan (5)
-- ============================================================

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('bebek-urunleri', 'Bebek Ürünleri', 'Baby Products', 'happy',
  (SELECT id FROM categories WHERE slug = 'bebek-evcil'),
  '{product,brand}', 1);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('bebek-magazasi', 'Bebek Mağazası', 'Baby Store', 'storefront',
  (SELECT id FROM categories WHERE slug = 'bebek-evcil'),
  '{business,brand}', 2);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('evcil-hayvan-urunleri', 'Evcil Hayvan Ürünleri', 'Pet Products', 'paw-outline',
  (SELECT id FROM categories WHERE slug = 'bebek-evcil'),
  '{product,brand}', 3);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('pet-shop', 'Pet Shop', 'Pet Shop', 'paw',
  (SELECT id FROM categories WHERE slug = 'bebek-evcil'),
  '{business}', 4);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('veteriner', 'Veteriner', 'Veterinarian', 'medkit-outline',
  (SELECT id FROM categories WHERE slug = 'bebek-evcil'),
  '{business}', 5);


-- ============================================================
-- L3: Süt Ürünleri (5)
-- ============================================================

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('peynir', 'Peynir', 'Cheese', NULL,
  (SELECT id FROM categories WHERE slug = 'sut-urunleri'),
  '{product,brand}', 1);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('yogurt', 'Yoğurt', 'Yogurt', NULL,
  (SELECT id FROM categories WHERE slug = 'sut-urunleri'),
  '{product,brand}', 2);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('sut', 'Süt', 'Milk', NULL,
  (SELECT id FROM categories WHERE slug = 'sut-urunleri'),
  '{product,brand}', 3);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('tereyagi', 'Tereyağı', 'Butter', NULL,
  (SELECT id FROM categories WHERE slug = 'sut-urunleri'),
  '{product,brand}', 4);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('ayran', 'Ayran', 'Ayran', NULL,
  (SELECT id FROM categories WHERE slug = 'sut-urunleri'),
  '{product,brand}', 5);


-- ============================================================
-- L3: Et & Protein (4)
-- ============================================================

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('kirmizi-et', 'Kırmızı Et', 'Red Meat', NULL,
  (SELECT id FROM categories WHERE slug = 'et-protein'),
  '{product,brand}', 1);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('tavuk', 'Tavuk', 'Chicken', NULL,
  (SELECT id FROM categories WHERE slug = 'et-protein'),
  '{product,brand}', 2);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('balik', 'Balık', 'Fish', NULL,
  (SELECT id FROM categories WHERE slug = 'et-protein'),
  '{product,brand}', 3);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('sarkuteri', 'Şarküteri', 'Deli Meats', NULL,
  (SELECT id FROM categories WHERE slug = 'et-protein'),
  '{product,brand}', 4);


-- ============================================================
-- L3: Temel Gıda (4)
-- ============================================================

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('tahil', 'Tahıl', 'Grains', NULL,
  (SELECT id FROM categories WHERE slug = 'temel-gida'),
  '{product,brand}', 1);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('baklagil', 'Baklagil', 'Legumes', NULL,
  (SELECT id FROM categories WHERE slug = 'temel-gida'),
  '{product,brand}', 2);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('makarna', 'Makarna', 'Pasta', NULL,
  (SELECT id FROM categories WHERE slug = 'temel-gida'),
  '{product,brand}', 3);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('yag', 'Yağ', 'Oil', NULL,
  (SELECT id FROM categories WHERE slug = 'temel-gida'),
  '{product,brand}', 4);


-- ============================================================
-- L3: Kahvaltılık (4)
-- ============================================================

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('bal', 'Bal', 'Honey', NULL,
  (SELECT id FROM categories WHERE slug = 'kahvaltilik'),
  '{product,brand}', 1);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('recel', 'Reçel', 'Jam', NULL,
  (SELECT id FROM categories WHERE slug = 'kahvaltilik'),
  '{product,brand}', 2);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('zeytin', 'Zeytin', 'Olives', NULL,
  (SELECT id FROM categories WHERE slug = 'kahvaltilik'),
  '{product,brand}', 3);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('tahin-pekmez', 'Tahin & Pekmez', 'Tahini & Molasses', NULL,
  (SELECT id FROM categories WHERE slug = 'kahvaltilik'),
  '{product,brand}', 4);


-- ============================================================
-- L3: İçecek (3)
-- ============================================================

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('sicak-icecek', 'Sıcak İçecek', 'Hot Beverages', NULL,
  (SELECT id FROM categories WHERE slug = 'icecek'),
  '{product,brand}', 1);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('soguk-icecek', 'Soğuk İçecek', 'Cold Beverages', NULL,
  (SELECT id FROM categories WHERE slug = 'icecek'),
  '{product,brand}', 2);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('alkol', 'Alkollü İçecek', 'Alcoholic Beverages', NULL,
  (SELECT id FROM categories WHERE slug = 'icecek'),
  '{product,brand}', 3);


-- ============================================================
-- L3: Sağlık Ürünleri (3)
-- ============================================================

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('vitamin-takviye', 'Vitamin & Takviye', 'Vitamins & Supplements', NULL,
  (SELECT id FROM categories WHERE slug = 'saglik-urunleri'),
  '{product,brand}', 1);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('tibbi-cihaz', 'Tıbbi Cihaz', 'Medical Devices', NULL,
  (SELECT id FROM categories WHERE slug = 'saglik-urunleri'),
  '{product,brand}', 2);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types, sort_order)
VALUES ('ilk-yardim', 'İlk Yardım', 'First Aid', NULL,
  (SELECT id FROM categories WHERE slug = 'saglik-urunleri'),
  '{product,brand}', 3);


-- ============================================================
-- Verification
-- ============================================================

DO $$
DECLARE
  l1_count INT;
  l2_count INT;
  l3_count INT;
BEGIN
  SELECT COUNT(*) INTO l1_count FROM categories WHERE parent_id IS NULL;
  SELECT COUNT(*) INTO l2_count FROM categories c
    WHERE c.parent_id IN (SELECT id FROM categories WHERE parent_id IS NULL);
  SELECT COUNT(*) INTO l3_count FROM categories c
    WHERE c.parent_id IN (
      SELECT id FROM categories WHERE parent_id IN (
        SELECT id FROM categories WHERE parent_id IS NULL
      )
    );

  RAISE NOTICE 'Category seed complete: L1=%, L2=%, L3=%, Total=%',
    l1_count, l2_count, l3_count, l1_count + l2_count + l3_count;
END $$;


-- ============================================================
-- Refresh materialized view
-- ============================================================

REFRESH MATERIALIZED VIEW category_stats;

COMMIT;
