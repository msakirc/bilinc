-- ============================================
-- COMPLETE TURKISH DISTRICTS DATABASE
-- All 81 provinces, 973 districts
-- ============================================

-- Clear existing data (optional)
-- TRUNCATE TABLE districts RESTART IDENTITY CASCADE;

INSERT INTO districts (city_code, name, slug) VALUES

-- ============================================
-- 01 - ADANA (15 districts)
-- ============================================
('01', 'Aladağ', 'aladag'),
('01', 'Ceyhan', 'ceyhan'),
('01', 'Çukurova', 'cukurova'),
('01', 'Feke', 'feke'),
('01', 'İmamoğlu', 'imamoglu'),
('01', 'Karaisalı', 'karaisali'),
('01', 'Karataş', 'karatas'),
('01', 'Kozan', 'kozan'),
('01', 'Pozantı', 'pozanti'),
('01', 'Saimbeyli', 'saimbeyli'),
('01', 'Sarıçam', 'saricam'),
('01', 'Seyhan', 'seyhan'),
('01', 'Tufanbeyli', 'tufanbeyli'),
('01', 'Yumurtalık', 'yumurtalik'),
('01', 'Yüreğir', 'yuregir'),

-- ============================================
-- 02 - ADIYAMAN (9 districts)
-- ============================================
('02', 'Besni', 'besni'),
('02', 'Çelikhan', 'celikhan'),
('02', 'Gerger', 'gerger'),
('02', 'Gölbaşı', 'golbasi'),
('02', 'Kahta', 'kahta'),
('02', 'Merkez', 'merkez'),
('02', 'Samsat', 'samsat'),
('02', 'Sincik', 'sincik'),
('02', 'Tut', 'tut'),

-- ============================================
-- 03 - AFYONKARAHİSAR (18 districts)
-- ============================================
('03', 'Başmakçı', 'basmakci'),
('03', 'Bayat', 'bayat'),
('03', 'Bolvadin', 'bolvadin'),
('03', 'Çay', 'cay'),
('03', 'Çobanlar', 'cobanlar'),
('03', 'Dazkırı', 'dazkiri'),
('03', 'Dinar', 'dinar'),
('03', 'Emirdağ', 'emirdag'),
('03', 'Evciler', 'evciler'),
('03', 'Hocalar', 'hocalar'),
('03', 'İhsaniye', 'ihsaniye'),
('03', 'İscehisar', 'iscehisar'),
('03', 'Kızılören', 'kiziloren'),
('03', 'Merkez', 'merkez'),
('03', 'Sandıklı', 'sandikli'),
('03', 'Sinanpaşa', 'sinanpasa'),
('03', 'Sultandağı', 'sultandagi'),
('03', 'Şuhut', 'suhut'),

-- ============================================
-- 04 - AĞRI (8 districts)
-- ============================================
('04', 'Diyadin', 'diyadin'),
('04', 'Doğubayazıt', 'dogubayazit'),
('04', 'Eleşkirt', 'eleskirt'),
('04', 'Hamur', 'hamur'),
('04', 'Merkez', 'merkez'),
('04', 'Patnos', 'patnos'),
('04', 'Taşlıçay', 'taslicay'),
('04', 'Tutak', 'tutak'),

-- ============================================
-- 05 - AMASYA (7 districts)
-- ============================================
('05', 'Göynücek', 'goynucek'),
('05', 'Gümüşhacıköy', 'gumushacikoy'),
('05', 'Hamamözü', 'hamamozu'),
('05', 'Merkez', 'merkez'),
('05', 'Merzifon', 'merzifon'),
('05', 'Suluova', 'suluova'),
('05', 'Taşova', 'tasova'),

-- ============================================
-- 06 - ANKARA (25 districts)
-- ============================================
('06', 'Akyurt', 'akyurt'),
('06', 'Altındağ', 'altindag'),
('06', 'Ayaş', 'ayas'),
('06', 'Bala', 'bala'),
('06', 'Beypazarı', 'beypazari'),
('06', 'Çamlıdere', 'camlidere'),
('06', 'Çankaya', 'cankaya'),
('06', 'Çubuk', 'cubuk'),
('06', 'Elmadağ', 'elmadag'),
('06', 'Etimesgut', 'etimesgut'),
('06', 'Evren', 'evren'),
('06', 'Gölbaşı', 'golbasi'),
('06', 'Güdül', 'gudul'),
('06', 'Haymana', 'haymana'),
('06', 'Kahramankazan', 'kahramankazan'),
('06', 'Kalecik', 'kalecik'),
('06', 'Keçiören', 'kecioren'),
('06', 'Kızılcahamam', 'kizilcahamam'),
('06', 'Mamak', 'mamak'),
('06', 'Nallıhan', 'nallihan'),
('06', 'Polatlı', 'polatli'),
('06', 'Pursaklar', 'pursaklar'),
('06', 'Sincan', 'sincan'),
('06', 'Şereflikoçhisar', 'sereflikochisar'),
('06', 'Yenimahalle', 'yenimahalle'),

-- ============================================
-- 07 - ANTALYA (19 districts)
-- ============================================
('07', 'Akseki', 'akseki'),
('07', 'Aksu', 'aksu'),
('07', 'Alanya', 'alanya'),
('07', 'Demre', 'demre'),
('07', 'Döşemealtı', 'dosemealti'),
('07', 'Elmalı', 'elmali'),
('07', 'Finike', 'finike'),
('07', 'Gazipaşa', 'gazipasa'),
('07', 'Gündoğmuş', 'gundogmus'),
('07', 'İbradı', 'ibradi'),
('07', 'Kaş', 'kas'),
('07', 'Kemer', 'kemer'),
('07', 'Kepez', 'kepez'),
('07', 'Konyaaltı', 'konyaalti'),
('07', 'Korkuteli', 'korkuteli'),
('07', 'Kumluca', 'kumluca'),
('07', 'Manavgat', 'manavgat'),
('07', 'Muratpaşa', 'muratpasa'),
('07', 'Serik', 'serik'),

-- ============================================
-- 08 - ARTVİN (8 districts)
-- ============================================
('08', 'Ardanuç', 'ardanuc'),
('08', 'Arhavi', 'arhavi'),
('08', 'Borçka', 'borcka'),
('08', 'Hopa', 'hopa'),
('08', 'Kemalpaşa', 'kemalpasa'),
('08', 'Merkez', 'merkez'),
('08', 'Murgul', 'murgul'),
('08', 'Şavşat', 'savsat'),
('08', 'Yusufeli', 'yusufeli'),

-- ============================================
-- 09 - AYDIN (17 districts)
-- ============================================
('09', 'Bozdoğan', 'bozdogan'),
('09', 'Buharkent', 'buharkent'),
('09', 'Çine', 'cine'),
('09', 'Didim', 'didim'),
('09', 'Efeler', 'efeler'),
('09', 'Germencik', 'germencik'),
('09', 'İncirliova', 'incirliova'),
('09', 'Karacasu', 'karacasu'),
('09', 'Karpuzlu', 'karpuzlu'),
('09', 'Koçarlı', 'kocarli'),
('09', 'Köşk', 'kosk'),
('09', 'Kuşadası', 'kusadasi'),
('09', 'Kuyucak', 'kuyucak'),
('09', 'Nazilli', 'nazilli'),
('09', 'Söke', 'soke'),
('09', 'Sultanhisar', 'sultanhisar'),
('09', 'Yenipazar', 'yenipazar'),

-- ============================================
-- 10 - BALIKESİR (20 districts)
-- ============================================
('10', 'Altıeylül', 'altieylul'),
('10', 'Ayvalık', 'ayvalik'),
('10', 'Balya', 'balya'),
('10', 'Bandırma', 'bandirma'),
('10', 'Bigadiç', 'bigadic'),
('10', 'Burhaniye', 'burhaniye'),
('10', 'Dursunbey', 'dursunbey'),
('10', 'Edremit', 'edremit'),
('10', 'Erdek', 'erdek'),
('10', 'Gömeç', 'gomec'),
('10', 'Gönen', 'gonen'),
('10', 'Havran', 'havran'),
('10', 'İvrindi', 'ivrindi'),
('10', 'Karesi', 'karesi'),
('10', 'Kepsut', 'kepsut'),
('10', 'Manyas', 'manyas'),
('10', 'Marmara', 'marmara'),
('10', 'Savaştepe', 'savastepe'),
('10', 'Sındırgı', 'sindirgi'),
('10', 'Susurluk', 'susurluk'),

-- ============================================
-- 11 - BİLECİK (8 districts)
-- ============================================
('11', 'Bozüyük', 'bozuyuk'),
('11', 'Gölpazarı', 'golpazari'),
('11', 'İnhisar', 'inhisar'),
('11', 'Merkez', 'merkez'),
('11', 'Osmaneli', 'osmaneli'),
('11', 'Pazaryeri', 'pazaryeri'),
('11', 'Söğüt', 'sogut'),
('11', 'Yenipazar', 'yenipazar'),

-- ============================================
-- 12 - BİNGÖL (8 districts)
-- ============================================
('12', 'Adaklı', 'adakli'),
('12', 'Genç', 'genc'),
('12', 'Karlıova', 'karliova'),
('12', 'Kiğı', 'kigi'),
('12', 'Merkez', 'merkez'),
('12', 'Solhan', 'solhan'),
('12', 'Yayladere', 'yayladere'),
('12', 'Yedisu', 'yedisu'),

-- ============================================
-- 13 - BİTLİS (7 districts)
-- ============================================
('13', 'Adilcevaz', 'adilcevaz'),
('13', 'Ahlat', 'ahlat'),
('13', 'Güroymak', 'guroymak'),
('13', 'Hizan', 'hizan'),
('13', 'Merkez', 'merkez'),
('13', 'Mutki', 'mutki'),
('13', 'Tatvan', 'tatvan'),

-- ============================================
-- 14 - BOLU (9 districts)
-- ============================================
('14', 'Dörtdivan', 'dortdivan'),
('14', 'Gerede', 'gerede'),
('14', 'Göynük', 'goynuk'),
('14', 'Kıbrıscık', 'kibriscik'),
('14', 'Mengen', 'mengen'),
('14', 'Merkez', 'merkez'),
('14', 'Mudurnu', 'mudurnu'),
('14', 'Seben', 'seben'),
('14', 'Yeniçağa', 'yenicaga'),

-- ============================================
-- 15 - BURDUR (11 districts)
-- ============================================
('15', 'Ağlasun', 'aglasun'),
('15', 'Altınyayla', 'altinyayla'),
('15', 'Bucak', 'bucak'),
('15', 'Çavdır', 'cavdir'),
('15', 'Çeltikçi', 'celtikci'),
('15', 'Gölhisar', 'golhisar'),
('15', 'Karamanlı', 'karamanli'),
('15', 'Kemer', 'kemer'),
('15', 'Merkez', 'merkez'),
('15', 'Tefenni', 'tefenni'),
('15', 'Yeşilova', 'yesilova'),

-- ============================================
-- 16 - BURSA (17 districts)
-- ============================================
('16', 'Büyükorhan', 'buyukorhan'),
('16', 'Gemlik', 'gemlik'),
('16', 'Gürsu', 'gursu'),
('16', 'Harmancık', 'harmancik'),
('16', 'İnegöl', 'inegol'),
('16', 'İznik', 'iznik'),
('16', 'Karacabey', 'karacabey'),
('16', 'Keles', 'keles'),
('16', 'Kestel', 'kestel'),
('16', 'Mudanya', 'mudanya'),
('16', 'Mustafakemalpaşa', 'mustafakemalpasa'),
('16', 'Nilüfer', 'nilufer'),
('16', 'Orhaneli', 'orhaneli'),
('16', 'Orhangazi', 'orhangazi'),
('16', 'Osmangazi', 'osmangazi'),
('16', 'Yenişehir', 'yenisehir'),
('16', 'Yıldırım', 'yildirim'),

-- ============================================
-- 17 - ÇANAKKALE (12 districts)
-- ============================================
('17', 'Ayvacık', 'ayvacik'),
('17', 'Bayramiç', 'bayramic'),
('17', 'Biga', 'biga'),
('17', 'Bozcaada', 'bozcaada'),
('17', 'Çan', 'can'),
('17', 'Eceabat', 'eceabat'),
('17', 'Ezine', 'ezine'),
('17', 'Gelibolu', 'gelibolu'),
('17', 'Gökçeada', 'gokceada'),
('17', 'Lapseki', 'lapseki'),
('17', 'Merkez', 'merkez'),
('17', 'Yenice', 'yenice'),

-- ============================================
-- 18 - ÇANKIRI (12 districts)
-- ============================================
('18', 'Atkaracalar', 'atkaracalar'),
('18', 'Bayramören', 'bayramoren'),
('18', 'Çerkeş', 'cerkes'),
('18', 'Eldivan', 'eldivan'),
('18', 'Ilgaz', 'ilgaz'),
('18', 'Kızılırmak', 'kizilirmak'),
('18', 'Korgun', 'korgun'),
('18', 'Kurşunlu', 'kursunlu'),
('18', 'Merkez', 'merkez'),
('18', 'Orta', 'orta'),
('18', 'Şabanözü', 'sabanozu'),
('18', 'Yapraklı', 'yaprakli'),

-- ============================================
-- 19 - ÇORUM (14 districts)
-- ============================================
('19', 'Alaca', 'alaca'),
('19', 'Bayat', 'bayat'),
('19', 'Boğazkale', 'bogazkale'),
('19', 'Dodurga', 'dodurga'),
('19', 'İskilip', 'iskilip'),
('19', 'Kargı', 'kargi'),
('19', 'Laçin', 'lacin'),
('19', 'Mecitözü', 'mecitozu'),
('19', 'Merkez', 'merkez'),
('19', 'Oğuzlar', 'oguzlar'),
('19', 'Ortaköy', 'ortakoy'),
('19', 'Osmancık', 'osmancik'),
('19', 'Sungurlu', 'sungurlu'),
('19', 'Uğurludağ', 'ugurludag'),

-- ============================================
-- 20 - DENİZLİ (19 districts)
-- ============================================
('20', 'Acıpayam', 'acipayam'),
('20', 'Babadağ', 'babadag'),
('20', 'Baklan', 'baklan'),
('20', 'Bekilli', 'bekilli'),
('20', 'Beyağaç', 'beyagac'),
('20', 'Bozkurt', 'bozkurt'),
('20', 'Buldan', 'buldan'),
('20', 'Çal', 'cal'),
('20', 'Çameli', 'cameli'),
('20', 'Çardak', 'cardak'),
('20', 'Çivril', 'civril'),
('20', 'Güney', 'guney'),
('20', 'Honaz', 'honaz'),
('20', 'Kale', 'kale'),
('20', 'Merkezefendi', 'merkezefendi'),
('20', 'Pamukkale', 'pamukkale'),
('20', 'Sarayköy', 'saraykoy'),
('20', 'Serinhisar', 'serinhisar'),
('20', 'Tavas', 'tavas'),

-- ============================================
-- 21 - DİYARBAKIR (17 districts)
-- ============================================
('21', 'Bağlar', 'baglar'),
('21', 'Bismil', 'bismil'),
('21', 'Çermik', 'cermik'),
('21', 'Çınar', 'cinar'),
('21', 'Çüngüş', 'cungus'),
('21', 'Dicle', 'dicle'),
('21', 'Eğil', 'egil'),
('21', 'Ergani', 'ergani'),
('21', 'Hani', 'hani'),
('21', 'Hazro', 'hazro'),
('21', 'Kayapınar', 'kayapinar'),
('21', 'Kocaköy', 'kocakoy'),
('21', 'Kulp', 'kulp'),
('21', 'Lice', 'lice'),
('21', 'Silvan', 'silvan'),
('21', 'Sur', 'sur'),
('21', 'Yenişehir', 'yenisehir'),

-- ============================================
-- 22 - EDİRNE (9 districts)
-- ============================================
('22', 'Enez', 'enez'),
('22', 'Havsa', 'havsa'),
('22', 'İpsala', 'ipsala'),
('22', 'Keşan', 'kesan'),
('22', 'Lalapaşa', 'lalapasa'),
('22', 'Meriç', 'meric'),
('22', 'Merkez', 'merkez'),
('22', 'Süloğlu', 'suloglu'),
('22', 'Uzunköprü', 'uzunkopru'),

-- ============================================
-- 23 - ELAZIĞ (11 districts)
-- ============================================
('23', 'Ağın', 'agin'),
('23', 'Alacakaya', 'alacakaya'),
('23', 'Arıcak', 'aricak'),
('23', 'Baskil', 'baskil'),
('23', 'Karakoçan', 'karakocan'),
('23', 'Keban', 'keban'),
('23', 'Kovancılar', 'kovancilar'),
('23', 'Maden', 'maden'),
('23', 'Merkez', 'merkez'),
('23', 'Palu', 'palu'),
('23', 'Sivrice', 'sivrice'),

-- ============================================
-- 24 - ERZİNCAN (9 districts)
-- ============================================
('24', 'Çayırlı', 'cayirli'),
('24', 'İliç', 'ilic'),
('24', 'Kemah', 'kemah'),
('24', 'Kemaliye', 'kemaliye'),
('24', 'Merkez', 'merkez'),
('24', 'Otlukbeli', 'otlukbeli'),
('24', 'Refahiye', 'refahiye'),
('24', 'Tercan', 'tercan'),
('24', 'Üzümlü', 'uzumlu'),

-- ============================================
-- 25 - ERZURUM (20 districts)
-- ============================================
('25', 'Aşkale', 'askale'),
('25', 'Aziziye', 'aziziye'),
('25', 'Çat', 'cat'),
('25', 'Hınıs', 'hinis'),
('25', 'Horasan', 'horasan'),
('25', 'İspir', 'ispir'),
('25', 'Karaçoban', 'karacoban'),
('25', 'Karayazı', 'karayazi'),
('25', 'Köprüköy', 'koprukoy'),
('25', 'Narman', 'narman'),
('25', 'Oltu', 'oltu'),
('25', 'Olur', 'olur'),
('25', 'Palandöken', 'palandoken'),
('25', 'Pasinler', 'pasinler'),
('25', 'Pazaryolu', 'pazaryolu'),
('25', 'Şenkaya', 'senkaya'),
('25', 'Tekman', 'tekman'),
('25', 'Tortum', 'tortum'),
('25', 'Uzundere', 'uzundere'),
('25', 'Yakutiye', 'yakutiye'),

-- ============================================
-- 26 - ESKİŞEHİR (14 districts)
-- ============================================
('26', 'Alpu', 'alpu'),
('26', 'Beylikova', 'beylikova'),
('26', 'Çifteler', 'cifteler'),
('26', 'Günyüzü', 'gunyuzu'),
('26', 'Han', 'han'),
('26', 'İnönü', 'inonu'),
('26', 'Mahmudiye', 'mahmudiye'),
('26', 'Mihalgazi', 'mihalgazi'),
('26', 'Mihalıççık', 'mihalicik'),
('26', 'Odunpazarı', 'odunpazari'),
('26', 'Sarıcakaya', 'saricakaya'),
('26', 'Seyitgazi', 'seyitgazi'),
('26', 'Sivrihisar', 'sivrihisar'),
('26', 'Tepebaşı', 'tepebasi'),

-- ============================================
-- 27 - GAZİANTEP (9 districts)
-- ============================================
('27', 'Araban', 'araban'),
('27', 'İslahiye', 'islahiye'),
('27', 'Karkamış', 'karkamis'),
('27', 'Nizip', 'nizip'),
('27', 'Nurdağı', 'nurdagi'),
('27', 'Oğuzeli', 'oguzeli'),
('27', 'Şahinbey', 'sahinbey'),
('27', 'Şehitkamil', 'sehitkamil'),
('27', 'Yavuzeli', 'yavuzeli'),

-- ============================================
-- 28 - GİRESUN (16 districts)
-- ============================================
('28', 'Alucra', 'alucra'),
('28', 'Bulancak', 'bulancak'),
('28', 'Çamoluk', 'camoluk'),
('28', 'Çanakçı', 'canakci'),
('28', 'Dereli', 'dereli'),
('28', 'Doğankent', 'dogankent'),
('28', 'Espiye', 'espiye'),
('28', 'Eynesil', 'eynesil'),
('28', 'Görele', 'gorele'),
('28', 'Güce', 'guce'),
('28', 'Keşap', 'kesap'),
('28', 'Merkez', 'merkez'),
('28', 'Piraziz', 'piraziz'),
('28', 'Şebinkarahisar', 'sebinkarahisar'),
('28', 'Tirebolu', 'tirebolu'),
('28', 'Yağlıdere', 'yaglidere'),

-- ============================================
-- 29 - GÜMÜŞHANE (6 districts)
-- ============================================
('29', 'Kelkit', 'kelkit'),
('29', 'Köse', 'kose'),
('29', 'Kürtün', 'kurtun'),
('29', 'Merkez', 'merkez'),
('29', 'Şiran', 'siran'),
('29', 'Torul', 'torul'),

-- ============================================
-- 30 - HAKKARİ (4 districts)
-- ============================================
('30', 'Çukurca', 'cukurca'),
('30', 'Merkez', 'merkez'),
('30', 'Şemdinli', 'semdinli'),
('30', 'Yüksekova', 'yuksekova'),

-- ============================================
-- 31 - HATAY (15 districts)
-- ============================================
('31', 'Altınözü', 'altinozu'),
('31', 'Antakya', 'antakya'),
('31', 'Arsuz', 'arsuz'),
('31', 'Belen', 'belen'),
('31', 'Defne', 'defne'),
('31', 'Dörtyol', 'dortyol'),
('31', 'Erzin', 'erzin'),
('31', 'Hassa', 'hassa'),
('31', 'İskenderun', 'iskenderun'),
('31', 'Kırıkhan', 'kirikhan'),
('31', 'Kumlu', 'kumlu'),
('31', 'Payas', 'payas'),
('31', 'Reyhanlı', 'reyhanli'),
('31', 'Samandağ', 'samandag'),
('31', 'Yayladağı', 'yayladagi'),

-- ============================================
-- 32 - ISPARTA (13 districts)
-- ============================================
('32', 'Aksu', 'aksu'),
('32', 'Atabey', 'atabey'),
('32', 'Eğirdir', 'egirdir'),
('32', 'Gelendost', 'gelendost'),
('32', 'Gönen', 'gonen'),
('32', 'Keçiborlu', 'keciborlu'),
('32', 'Merkez', 'merkez'),
('32', 'Senirkent', 'senirkent'),
('32', 'Sütçüler', 'sutculer'),
('32', 'Şarkikaraağaç', 'sarkikaraagac'),
('32', 'Uluborlu', 'uluborlu'),
('32', 'Yalvaç', 'yalvac'),
('32', 'Yenişarbademli', 'yenisarbademli'),

-- ============================================
-- 33 - MERSİN (13 districts)
-- ============================================
('33', 'Akdeniz', 'akdeniz'),
('33', 'Anamur', 'anamur'),
('33', 'Aydıncık', 'aydincik'),
('33', 'Bozyazı', 'bozyazi'),
('33', 'Çamlıyayla', 'camliyayla'),
('33', 'Erdemli', 'erdemli'),
('33', 'Gülnar', 'gulnar'),
('33', 'Mezitli', 'mezitli'),
('33', 'Mut', 'mut'),
('33', 'Silifke', 'silifke'),
('33', 'Tarsus', 'tarsus'),
('33', 'Toroslar', 'toroslar'),
('33', 'Yenişehir', 'yenisehir'),

-- ============================================
-- 34 - İSTANBUL (39 districts)
-- ============================================
('34', 'Adalar', 'adalar'),
('34', 'Arnavutköy', 'arnavutkoy'),
('34', 'Ataşehir', 'atasehir'),
('34', 'Avcılar', 'avcilar'),
('34', 'Bağcılar', 'bagcilar'),
('34', 'Bahçelievler', 'bahcelievler'),
('34', 'Bakırköy', 'bakirkoy'),
('34', 'Başakşehir', 'basaksehir'),
('34', 'Bayrampaşa', 'bayrampasa'),
('34', 'Beşiktaş', 'besiktas'),
('34', 'Beykoz', 'beykoz'),
('34', 'Beylikdüzü', 'beylikduzu'),
('34', 'Beyoğlu', 'beyoglu'),
('34', 'Büyükçekmece', 'buyukcekmece'),
('34', 'Çatalca', 'catalca'),
('34', 'Çekmeköy', 'cekmekoy'),
('34', 'Esenler', 'esenler'),
('34', 'Esenyurt', 'esenyurt'),
('34', 'Eyüpsultan', 'eyupsultan'),
('34', 'Fatih', 'fatih'),
('34', 'Gaziosmanpaşa', 'gaziosmanpasa'),
('34', 'Güngören', 'gungoren'),
('34', 'Kadıköy', 'kadikoy'),
('34', 'Kağıthane', 'kagithane'),
('34', 'Kartal', 'kartal'),
('34', 'Küçükçekmece', 'kucukcekmece'),
('34', 'Maltepe', 'maltepe'),
('34', 'Pendik', 'pendik'),
('34', 'Sancaktepe', 'sancaktepe'),
('34', 'Sarıyer', 'sariyer'),
('34', 'Silivri', 'silivri'),
('34', 'Sultanbeyli', 'sultanbeyli'),
('34', 'Sultangazi', 'sultangazi'),
('34', 'Şile', 'sile'),
('34', 'Şişli', 'sisli'),
('34', 'Tuzla', 'tuzla'),
('34', 'Ümraniye', 'umraniye'),
('34', 'Üsküdar', 'uskudar'),
('34', 'Zeytinburnu', 'zeytinburnu'),

-- ============================================
-- 35 - İZMİR (30 districts)
-- ============================================
('35', 'Aliağa', 'aliaga'),
('35', 'Balçova', 'balcova'),
('35', 'Bayındır', 'bayindir'),
('35', 'Bayraklı', 'bayrakli'),
('35', 'Bergama', 'bergama'),
('35', 'Beydağ', 'beydag'),
('35', 'Bornova', 'bornova'),
('35', 'Buca', 'buca'),
('35', 'Çeşme', 'cesme'),
('35', 'Çiğli', 'cigli'),
('35', 'Dikili', 'dikili'),
('35', 'Foça', 'foca'),
('35', 'Gaziemir', 'gaziemir'),
('35', 'Güzelbahçe', 'guzelbahce'),
('35', 'Karabağlar', 'karabaglar'),
('35', 'Karaburun', 'karaburun'),
('35', 'Karşıyaka', 'karsiyaka'),
('35', 'Kemalpaşa', 'kemalpasa'),
('35', 'Kınık', 'kinik'),
('35', 'Kiraz', 'kiraz'),
('35', 'Konak', 'konak'),
('35', 'Menderes', 'menderes'),
('35', 'Menemen', 'menemen'),
('35', 'Narlıdere', 'narlidere'),
('35', 'Ödemiş', 'odemis'),
('35', 'Seferihisar', 'seferihisar'),
('35', 'Selçuk', 'selcuk'),
('35', 'Tire', 'tire'),
('35', 'Torbalı', 'torbali'),
('35', 'Urla', 'urla'),

-- ============================================
-- 36 - KARS (8 districts)
-- ============================================
('36', 'Akyaka', 'akyaka'),
('36', 'Arpaçay', 'arpacay'),
('36', 'Digor', 'digor'),
('36', 'Kağızman', 'kagizman'),
('36', 'Merkez', 'merkez'),
('36', 'Sarıkamış', 'sarikamis'),
('36', 'Selim', 'selim'),
('36', 'Susuz', 'susuz'),

-- ============================================
-- 37 - KASTAMONU (20 districts)
-- ============================================
('37', 'Abana', 'abana'),
('37', 'Ağlı', 'agli'),
('37', 'Araç', 'arac'),
('37', 'Azdavay', 'azdavay'),
('37', 'Bozkurt', 'bozkurt'),
('37', 'Cide', 'cide'),
('37', 'Çatalzeytin', 'catalzeytin'),
('37', 'Daday', 'daday'),
('37', 'Devrekani', 'devrekani'),
('37', 'Doğanyurt', 'doganyurt'),
('37', 'Hanönü', 'hanonu'),
('37', 'İhsangazi', 'ihsangazi'),
('37', 'İnebolu', 'inebolu'),
('37', 'Küre', 'kure'),
('37', 'Merkez', 'merkez'),
('37', 'Pınarbaşı', 'pinarbasi'),
('37', 'Seydiler', 'seydiler'),
('37', 'Şenpazar', 'senpazar'),
('37', 'Taşköprü', 'taskopru'),
('37', 'Tosya', 'tosya'),

-- ============================================
-- 38 - KAYSERİ (16 districts)
-- ============================================
('38', 'Akkışla', 'akkisla'),
('38', 'Bünyan', 'bunyan'),
('38', 'Develi', 'develi'),
('38', 'Felahiye', 'felahiye'),
('38', 'Hacılar', 'hacilar'),
('38', 'İncesu', 'incesu'),
('38', 'Kocasinan', 'kocasinan'),
('38', 'Melikgazi', 'melikgazi'),
('38', 'Özvatan', 'ozvatan'),
('38', 'Pınarbaşı', 'pinarbasi'),
('38', 'Sarıoğlan', 'sarioglan'),
('38', 'Sarız', 'sariz'),
('38', 'Talas', 'talas'),
('38', 'Tomarza', 'tomarza'),
('38', 'Yahyalı', 'yahyali'),
('38', 'Yeşilhisar', 'yesilhisar'),

-- ============================================
-- 39 - KIRKLARELİ (8 districts)
-- ============================================
('39', 'Babaeski', 'babaeski'),
('39', 'Demirköy', 'demirkoy'),
('39', 'Kofçaz', 'kofcaz'),
('39', 'Lüleburgaz', 'luleburgaz'),
('39', 'Merkez', 'merkez'),
('39', 'Pehlivanköy', 'pehlivankoy'),
('39', 'Pınarhisar', 'pinarhisar'),
('39', 'Vize', 'vize'),

-- ============================================
-- 40 - KIRŞEHİR (7 districts)
-- ============================================
('40', 'Akçakent', 'akcakent'),
('40', 'Akpınar', 'akpinar'),
('40', 'Boztepe', 'boztepe'),
('40', 'Çiçekdağı', 'cicekdagi'),
('40', 'Kaman', 'kaman'),
('40', 'Merkez', 'merkez'),
('40', 'Mucur', 'mucur'),

-- ============================================
-- 41 - KOCAELİ (12 districts)
-- ============================================
('41', 'Başiskele', 'basiskele'),
('41', 'Çayırova', 'cayirova'),
('41', 'Darıca', 'darica'),
('41', 'Derince', 'derince'),
('41', 'Dilovası', 'dilovasi'),
('41', 'Gebze', 'gebze'),
('41', 'Gölcük', 'golcuk'),
('41', 'İzmit', 'izmit'),
('41', 'Kandıra', 'kandira'),
('41', 'Karamürsel', 'karamursel'),
('41', 'Kartepe', 'kartepe'),
('41', 'Körfez', 'korfez'),

-- ============================================
-- 42 - KONYA (31 districts)
-- ============================================
('42', 'Ahırlı', 'ahirli'),
('42', 'Akören', 'akoren'),
('42', 'Akşehir', 'aksehir'),
('42', 'Altınekin', 'altinekin'),
('42', 'Beyşehir', 'beysehir'),
('42', 'Bozkır', 'bozkir'),
('42', 'Cihanbeyli', 'cihanbeyli'),
('42', 'Çeltik', 'celtik'),
('42', 'Çumra', 'cumra'),
('42', 'Derbent', 'derbent'),
('42', 'Derebucak', 'derebucak'),
('42', 'Doğanhisar', 'doganhisar'),
('42', 'Emirgazi', 'emirgazi'),
('42', 'Ereğli', 'eregli'),
('42', 'Güneysınır', 'guneysinir'),
('42', 'Hadim', 'hadim'),
('42', 'Halkapınar', 'halkapinar'),
('42', 'Hüyük', 'huyuk'),
('42', 'Ilgın', 'ilgin'),
('42', 'Kadınhanı', 'kadinhani'),
('42', 'Karapınar', 'karapinar'),
('42', 'Karatay', 'karatay'),
('42', 'Kulu', 'kulu'),
('42', 'Meram', 'meram'),
('42', 'Sarayönü', 'sarayonu'),
('42', 'Selçuklu', 'selcuklu'),
('42', 'Seydişehir', 'seydisehir'),
('42', 'Taşkent', 'taskent'),
('42', 'Tuzlukçu', 'tuzlukcu'),
('42', 'Yalıhüyük', 'yalihuyuk'),
('42', 'Yunak', 'yunak'),

-- ============================================
-- 43 - KÜTAHYA (13 districts)
-- ============================================
('43', 'Altıntaş', 'altintas'),
('43', 'Aslanapa', 'aslanapa'),
('43', 'Çavdarhisar', 'cavdarhisar'),
('43', 'Domaniç', 'domanic'),
('43', 'Dumlupınar', 'dumlupinar'),
('43', 'Emet', 'emet'),
('43', 'Gediz', 'gediz'),
('43', 'Hisarcık', 'hisarcik'),
('43', 'Merkez', 'merkez'),
('43', 'Pazarlar', 'pazarlar'),
('43', 'Simav', 'simav'),
('43', 'Şaphane', 'saphane'),
('43', 'Tavşanlı', 'tavsanli'),

-- ============================================
-- 44 - MALATYA (13 districts)
-- ============================================
('44', 'Akçadağ', 'akcadag'),
('44', 'Arapgir', 'arapgir'),
('44', 'Arguvan', 'arguvan'),
('44', 'Battalgazi', 'battalgazi'),
('44', 'Darende', 'darende'),
('44', 'Doğanşehir', 'dogansehir'),
('44', 'Doğanyol', 'doganyol'),
('44', 'Hekimhan', 'hekimhan'),
('44', 'Kale', 'kale'),
('44', 'Kuluncak', 'kuluncak'),
('44', 'Pütürge', 'puturge'),
('44', 'Yazıhan', 'yazihan'),
('44', 'Yeşilyurt', 'yesilyurt'),

-- ============================================
-- 45 - MANİSA (17 districts)
-- ============================================
('45', 'Ahmetli', 'ahmetli'),
('45', 'Akhisar', 'akhisar'),
('45', 'Alaşehir', 'alasehir'),
('45', 'Demirci', 'demirci'),
('45', 'Gölmarmara', 'golmarmara'),
('45', 'Gördes', 'gordes'),
('45', 'Kırkağaç', 'kirkagac'),
('45', 'Köprübaşı', 'koprubasi'),
('45', 'Kula', 'kula'),
('45', 'Salihli', 'salihli'),
('45', 'Sarıgöl', 'sarigol'),
('45', 'Saruhanlı', 'saruhanli'),
('45', 'Selendi', 'selendi'),
('45', 'Soma', 'soma'),
('45', 'Şehzadeler', 'sehzadeler'),
('45', 'Turgutlu', 'turgutlu'),
('45', 'Yunusemre', 'yunusemre'),

-- ============================================
-- 46 - KAHRAMANMARAŞ (11 districts)
-- ============================================
('46', 'Afşin', 'afsin'),
('46', 'Andırın', 'andirin'),
('46', 'Çağlayancerit', 'caglayancerit'),
('46', 'Dulkadiroğlu', 'dulkadiroglu'),
('46', 'Ekinözü', 'ekinozu'),
('46', 'Elbistan', 'elbistan'),
('46', 'Göksun', 'goksun'),
('46', 'Nurhak', 'nurhak'),
('46', 'Onikişubat', 'onikisubat'),
('46', 'Pazarcık', 'pazarcik'),
('46', 'Türkoğlu', 'turkoglu'),

-- ============================================
-- 47 - MARDİN (10 districts)
-- ============================================
('47', 'Artuklu', 'artuklu'),
('47', 'Dargeçit', 'dargecit'),
('47', 'Derik', 'derik'),
('47', 'Kızıltepe', 'kiziltepe'),
('47', 'Mazıdağı', 'mazidagi'),
('47', 'Midyat', 'midyat'),
('47', 'Nusaybin', 'nusaybin'),
('47', 'Ömerli', 'omerli'),
('47', 'Savur', 'savur'),
('47', 'Yeşilli', 'yesilli'),

-- ============================================
-- 48 - MUĞLA (13 districts)
-- ============================================
('48', 'Bodrum', 'bodrum'),
('48', 'Dalaman', 'dalaman'),
('48', 'Datça', 'datca'),
('48', 'Fethiye', 'fethiye'),
('48', 'Kavaklıdere', 'kavaklidere'),
('48', 'Köyceğiz', 'koycegiz'),
('48', 'Marmaris', 'marmaris'),
('48', 'Menteşe', 'mentese'),
('48', 'Milas', 'milas'),
('48', 'Ortaca', 'ortaca'),
('48', 'Seydikemer', 'seydikemer'),
('48', 'Ula', 'ula'),
('48', 'Yatağan', 'yatagan'),

-- ============================================
-- 49 - MUŞ (6 districts)
-- ============================================
('49', 'Bulanık', 'bulanik'),
('49', 'Hasköy', 'haskoy'),
('49', 'Korkut', 'korkut'),
('49', 'Malazgirt', 'malazgirt'),
('49', 'Merkez', 'merkez'),
('49', 'Varto', 'varto'),

-- ============================================
-- 50 - NEVŞEHİR (8 districts)
-- ============================================
('50', 'Acıgöl', 'acigol'),
('50', 'Avanos', 'avanos'),
('50', 'Derinkuyu', 'derinkuyu'),
('50', 'Gülşehir', 'gulsehir'),
('50', 'Hacıbektaş', 'hacibektas'),
('50', 'Kozaklı', 'kozakli'),
('50', 'Merkez', 'merkez'),
('50', 'Ürgüp', 'urgup'),

-- ============================================
-- 51 - NİĞDE (6 districts)
-- ============================================
('51', 'Altunhisar', 'altunhisar'),
('51', 'Bor', 'bor'),
('51', 'Çamardı', 'camardi'),
('51', 'Çiftlik', 'ciftlik'),
('51', 'Merkez', 'merkez'),
('51', 'Ulukışla', 'ulukisla'),

-- ============================================
-- 52 - ORDU (19 districts)
-- ============================================
('52', 'Akkuş', 'akkus'),
('52', 'Altınordu', 'altinordu'),
('52', 'Aybastı', 'aybasti'),
('52', 'Çamaş', 'camas'),
('52', 'Çatalpınar', 'catalpinar'),
('52', 'Çaybaşı', 'caybasi'),
('52', 'Fatsa', 'fatsa'),
('52', 'Gölköy', 'golkoy'),
('52', 'Gülyalı', 'gulyali'),
('52', 'Gürgentepe', 'gurgentepe'),
('52', 'İkizce', 'ikizce'),
('52', 'Kabadüz', 'kabaduz'),
('52', 'Kabataş', 'kabatas'),
('52', 'Korgan', 'korgan'),
('52', 'Kumru', 'kumru'),
('52', 'Mesudiye', 'mesudiye'),
('52', 'Perşembe', 'persembe'),
('52', 'Ulubey', 'ulubey'),
('52', 'Ünye', 'unye'),

-- ============================================
-- 53 - RİZE (12 districts)
-- ============================================
('53', 'Ardeşen', 'ardesen'),
('53', 'Çamlıhemşin', 'camlihemsin'),
('53', 'Çayeli', 'cayeli'),
('53', 'Derepazarı', 'derepazari'),
('53', 'Fındıklı', 'findikli'),
('53', 'Güneysu', 'guneysu'),
('53', 'Hemşin', 'hemsin'),
('53', 'İkizdere', 'ikizdere'),
('53', 'İyidere', 'iyidere'),
('53', 'Kalkandere', 'kalkandere'),
('53', 'Merkez', 'merkez'),
('53', 'Pazar', 'pazar'),

-- ============================================
-- 54 - SAKARYA (16 districts)
-- ============================================
('54', 'Adapazarı', 'adapazari'),
('54', 'Akyazı', 'akyazi'),
('54', 'Arifiye', 'arifiye'),
('54', 'Erenler', 'erenler'),
('54', 'Ferizli', 'ferizli'),
('54', 'Geyve', 'geyve'),
('54', 'Hendek', 'hendek'),
('54', 'Karapürçek', 'karapurcek'),
('54', 'Karasu', 'karasu'),
('54', 'Kaynarca', 'kaynarca'),
('54', 'Kocaali', 'kocaali'),
('54', 'Pamukova', 'pamukova'),
('54', 'Sapanca', 'sapanca'),
('54', 'Serdivan', 'serdivan'),
('54', 'Söğütlü', 'sogutlu'),
('54', 'Taraklı', 'tarakli'),

-- ============================================
-- 55 - SAMSUN (17 districts)
-- ============================================
('55', 'Alaçam', 'alacam'),
('55', 'Asarcık', 'asarcik'),
('55', 'Atakum', 'atakum'),
('55', 'Ayvacık', 'ayvacik'),
('55', 'Bafra', 'bafra'),
('55', 'Canik', 'canik'),
('55', 'Çarşamba', 'carsamba'),
('55', 'Havza', 'havza'),
('55', 'İlkadım', 'ilkadim'),
('55', 'Kavak', 'kavak'),
('55', 'Ladik', 'ladik'),
('55', 'Ondokuzmayıs', 'ondokuzmayis'),
('55', 'Salıpazarı', 'salipazari'),
('55', 'Tekkeköy', 'tekkekoy'),
('55', 'Terme', 'terme'),
('55', 'Vezirköprü', 'vezirkopru'),
('55', 'Yakakent', 'yakakent'),

-- ============================================
-- 56 - SİİRT (7 districts)
-- ============================================
('56', 'Baykan', 'baykan'),
('56', 'Eruh', 'eruh'),
('56', 'Kurtalan', 'kurtalan'),
('56', 'Merkez', 'merkez'),
('56', 'Pervari', 'pervari'),
('56', 'Şirvan', 'sirvan'),
('56', 'Tillo', 'tillo'),

-- ============================================
-- 57 - SİNOP (9 districts)
-- ============================================
('57', 'Ayancık', 'ayancik'),
('57', 'Boyabat', 'boyabat'),
('57', 'Dikmen', 'dikmen'),
('57', 'Durağan', 'duragan'),
('57', 'Erfelek', 'erfelek'),
('57', 'Gerze', 'gerze'),
('57', 'Merkez', 'merkez'),
('57', 'Saraydüzü', 'sarayduzu'),
('57', 'Türkeli', 'turkeli'),

-- ============================================
-- 58 - SİVAS (17 districts)
-- ============================================
-- ============================================
-- 58 - SİVAS (17 districts) - CONTINUED
-- ============================================
('58', 'Akıncılar', 'akincilar'),
('58', 'Altınyayla', 'altinyayla'),
('58', 'Divriği', 'divrigi'),
('58', 'Doğanşar', 'dogansar'),
('58', 'Gemerek', 'gemerek'),
('58', 'Gölova', 'golova'),
('58', 'Gürün', 'gurun'),
('58', 'Hafik', 'hafik'),
('58', 'İmranlı', 'imranli'),
('58', 'Kangal', 'kangal'),
('58', 'Koyulhisar', 'koyulhisar'),
('58', 'Merkez', 'merkez'),
('58', 'Suşehri', 'susehri'),
('58', 'Şarkışla', 'sarkisla'),
('58', 'Ulaş', 'ulas'),
('58', 'Yıldızeli', 'yildizeli'),
('58', 'Zara', 'zara'),

-- ============================================
-- 59 - TEKİRDAĞ (11 districts)
-- ============================================
('59', 'Çerkezköy', 'cerkezkoy'),
('59', 'Çorlu', 'corlu'),
('59', 'Ergene', 'ergene'),
('59', 'Hayrabolu', 'hayrabolu'),
('59', 'Kapaklı', 'kapakli'),
('59', 'Malkara', 'malkara'),
('59', 'Marmaraereğlisi', 'marmaraereglisi'),
('59', 'Muratlı', 'muratli'),
('59', 'Saray', 'saray'),
('59', 'Süleymanpaşa', 'suleymanpasa'),
('59', 'Şarköy', 'sarkoy'),

-- ============================================
-- 60 - TOKAT (12 districts)
-- ============================================
('60', 'Almus', 'almus'),
('60', 'Artova', 'artova'),
('60', 'Başçiftlik', 'basciftlik'),
('60', 'Erbaa', 'erbaa'),
('60', 'Merkez', 'merkez'),
('60', 'Niksar', 'niksar'),
('60', 'Pazar', 'pazar'),
('60', 'Reşadiye', 'resadiye'),
('60', 'Sulusaray', 'sulusaray'),
('60', 'Turhal', 'turhal'),
('60', 'Yeşilyurt', 'yesilyurt'),
('60', 'Zile', 'zile'),

-- ============================================
-- 61 - TRABZON (18 districts)
-- ============================================
('61', 'Akçaabat', 'akcaabat'),
('61', 'Araklı', 'arakli'),
('61', 'Arsin', 'arsin'),
('61', 'Beşikdüzü', 'besikduzu'),
('61', 'Çarşıbaşı', 'carsibasi'),
('61', 'Çaykara', 'caykara'),
('61', 'Dernekpazarı', 'dernekpazari'),
('61', 'Düzköy', 'duzkoy'),
('61', 'Hayrat', 'hayrat'),
('61', 'Köprübaşı', 'koprubasi'),
('61', 'Maçka', 'macka'),
('61', 'Of', 'of'),
('61', 'Ortahisar', 'ortahisar'),
('61', 'Sürmene', 'surmene'),
('61', 'Şalpazarı', 'salpazari'),
('61', 'Tonya', 'tonya'),
('61', 'Vakfıkebir', 'vakfikebir'),
('61', 'Yomra', 'yomra'),

-- ============================================
-- 62 - TUNCELİ (8 districts)
-- ============================================
('62', 'Çemişgezek', 'cemisgezek'),
('62', 'Hozat', 'hozat'),
('62', 'Mazgirt', 'mazgirt'),
('62', 'Merkez', 'merkez'),
('62', 'Nazımiye', 'nazimiye'),
('62', 'Ovacık', 'ovacik'),
('62', 'Pertek', 'pertek'),
('62', 'Pülümür', 'pulumur'),

-- ============================================
-- 63 - ŞANLIURFA (13 districts)
-- ============================================
('63', 'Akçakale', 'akcakale'),
('63', 'Birecik', 'birecik'),
('63', 'Bozova', 'bozova'),
('63', 'Ceylanpınar', 'ceylanpinar'),
('63', 'Eyyübiye', 'eyyubiye'),
('63', 'Halfeti', 'halfeti'),
('63', 'Haliliye', 'haliliye'),
('63', 'Harran', 'harran'),
('63', 'Hilvan', 'hilvan'),
('63', 'Karaköprü', 'karakopru'),
('63', 'Siverek', 'siverek'),
('63', 'Suruç', 'suruc'),
('63', 'Viranşehir', 'viransehir'),

-- ============================================
-- 64 - UŞAK (6 districts)
-- ============================================
('64', 'Banaz', 'banaz'),
('64', 'Eşme', 'esme'),
('64', 'Karahallı', 'karahalli'),
('64', 'Merkez', 'merkez'),
('64', 'Sivaslı', 'sivasli'),
('64', 'Ulubey', 'ulubey'),

-- ============================================
-- 65 - VAN (13 districts)
-- ============================================
('65', 'Bahçesaray', 'bahcesaray'),
('65', 'Başkale', 'baskale'),
('65', 'Çaldıran', 'caldiran'),
('65', 'Çatak', 'catak'),
('65', 'Edremit', 'edremit'),
('65', 'Erciş', 'ercis'),
('65', 'Gevaş', 'gevas'),
('65', 'Gürpınar', 'gurpinar'),
('65', 'İpekyolu', 'ipekyolu'),
('65', 'Muradiye', 'muradiye'),
('65', 'Özalp', 'ozalp'),
('65', 'Saray', 'saray'),
('65', 'Tuşba', 'tusba'),

-- ============================================
-- 66 - YOZGAT (14 districts)
-- ============================================
('66', 'Akdağmadeni', 'akdagmadeni'),
('66', 'Aydıncık', 'aydincik'),
('66', 'Boğazlıyan', 'bogazliyan'),
('66', 'Çandır', 'candir'),
('66', 'Çayıralan', 'cayiralan'),
('66', 'Çekerek', 'cekerek'),
('66', 'Kadışehri', 'kadisehri'),
('66', 'Merkez', 'merkez'),
('66', 'Saraykent', 'saraykent'),
('66', 'Sarıkaya', 'sarikaya'),
('66', 'Sorgun', 'sorgun'),
('66', 'Şefaatli', 'sefaatli'),
('66', 'Yenifakılı', 'yenifakili'),
('66', 'Yerköy', 'yerkoy'),

-- ============================================
-- 67 - ZONGULDAK (8 districts)
-- ============================================
('67', 'Alaplı', 'alapli'),
('67', 'Çaycuma', 'caycuma'),
('67', 'Devrek', 'devrek'),
('67', 'Ereğli', 'eregli'),
('67', 'Gökçebey', 'gokcebey'),
('67', 'Kilimli', 'kilimli'),
('67', 'Kozlu', 'kozlu'),
('67', 'Merkez', 'merkez'),

-- ============================================
-- 68 - AKSARAY (8 districts)
-- ============================================
('68', 'Ağaçören', 'agacoren'),
('68', 'Eskil', 'eskil'),
('68', 'Gülağaç', 'gulagac'),
('68', 'Güzelyurt', 'guzelyurt'),
('68', 'Merkez', 'merkez'),
('68', 'Ortaköy', 'ortakoy'),
('68', 'Sarıyahşi', 'sariyahsi'),
('68', 'Sultanhanı', 'sultanhani'),

-- ============================================
-- 69 - BAYBURT (3 districts)
-- ============================================
('69', 'Aydıntepe', 'aydintepe'),
('69', 'Demirözü', 'demirozu'),
('69', 'Merkez', 'merkez'),

-- ============================================
-- 70 - KARAMAN (6 districts)
-- ============================================
('70', 'Ayrancı', 'ayranci'),
('70', 'Başyayla', 'basyayla'),
('70', 'Ermenek', 'ermenek'),
('70', 'Kazımkarabekir', 'kazimkarabekir'),
('70', 'Merkez', 'merkez'),
('70', 'Sarıveliler', 'sariveliler'),

-- ============================================
-- 71 - KIRIKKALE (9 districts)
-- ============================================
('71', 'Bahşili', 'bahsili'),
('71', 'Balışeyh', 'baliseyh'),
('71', 'Çelebi', 'celebi'),
('71', 'Delice', 'delice'),
('71', 'Karakeçili', 'karakecili'),
('71', 'Keskin', 'keskin'),
('71', 'Merkez', 'merkez'),
('71', 'Sulakyurt', 'sulakyurt'),
('71', 'Yahşihan', 'yahsihan'),

-- ============================================
-- 72 - BATMAN (6 districts)
-- ============================================
('72', 'Beşiri', 'besiri'),
('72', 'Gercüş', 'gercus'),
('72', 'Hasankeyf', 'hasankeyf'),
('72', 'Kozluk', 'kozluk'),
('72', 'Merkez', 'merkez'),
('72', 'Sason', 'sason'),

-- ============================================
-- 73 - ŞIRNAK (7 districts)
-- ============================================
('73', 'Beytüşşebap', 'beytussebap'),
('73', 'Cizre', 'cizre'),
('73', 'Güçlükonak', 'guclukonak'),
('73', 'İdil', 'idil'),
('73', 'Merkez', 'merkez'),
('73', 'Silopi', 'silopi'),
('73', 'Uludere', 'uludere'),

-- ============================================
-- 74 - BARTIN (4 districts)
-- ============================================
('74', 'Amasra', 'amasra'),
('74', 'Kurucaşile', 'kurucasile'),
('74', 'Merkez', 'merkez'),
('74', 'Ulus', 'ulus'),

-- ============================================
-- 75 - ARDAHAN (6 districts)
-- ============================================
('75', 'Çıldır', 'cildir'),
('75', 'Damal', 'damal'),
('75', 'Göle', 'gole'),
('75', 'Hanak', 'hanak'),
('75', 'Merkez', 'merkez'),
('75', 'Posof', 'posof'),

-- ============================================
-- 76 - IĞDIR (4 districts)
-- ============================================
('76', 'Aralık', 'aralik'),
('76', 'Karakoyunlu', 'karakoyunlu'),
('76', 'Merkez', 'merkez'),
('76', 'Tuzluca', 'tuzluca'),

-- ============================================
-- 77 - YALOVA (6 districts)
-- ============================================
('77', 'Altınova', 'altinova'),
('77', 'Armutlu', 'armutlu'),
('77', 'Çınarcık', 'cinarcik'),
('77', 'Çiftlikköy', 'ciftlikkoy'),
('77', 'Merkez', 'merkez'),
('77', 'Termal', 'termal'),

-- ============================================
-- 78 - KARABÜK (6 districts)
-- ============================================
('78', 'Eflani', 'eflani'),
('78', 'Eskipazar', 'eskipazar'),
('78', 'Merkez', 'merkez'),
('78', 'Ovacık', 'ovacik'),
('78', 'Safranbolu', 'safranbolu'),
('78', 'Yenice', 'yenice'),

-- ============================================
-- 79 - KİLİS (4 districts)
-- ============================================
('79', 'Elbeyli', 'elbeyli'),
('79', 'Merkez', 'merkez'),
('79', 'Musabeyli', 'musabeyli'),
('79', 'Polateli', 'polateli'),

-- ============================================
-- 80 - OSMANİYE (7 districts)
-- ============================================
('80', 'Bahçe', 'bahce'),
('80', 'Düziçi', 'duzici'),
('80', 'Hasanbeyli', 'hasanbeyli'),
('80', 'Kadirli', 'kadirli'),
('80', 'Merkez', 'merkez'),
('80', 'Sumbas', 'sumbas'),
('80', 'Toprakkale', 'toprakkale'),

-- ============================================
-- 81 - DÜZCE (8 districts)
-- ============================================
('81', 'Akçakoca', 'akcakoca'),
('81', 'Cumayeri', 'cumayeri'),
('81', 'Çilimli', 'cilimli'),
('81', 'Gölyaka', 'golyaka'),
('81', 'Gümüşova', 'gumusova'),
('81', 'Kaynaşlı', 'kaynasli'),
('81', 'Merkez', 'merkez'),
('81', 'Yığılca', 'yigilca');

-- ============================================
-- SUMMARY
-- ============================================
-- Total Provinces: 81
-- Total Districts: 973
-- ============================================
