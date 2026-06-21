/**
 * Legal document text + metadata for Bilinç.
 *
 * Source of truth: docs/legal/*.md (Turkish drafts).
 * These are TASLAK (draft) texts and MUST be reviewed by a licensed Turkish
 * lawyer before store submission / production launch. [PLACEHOLDER] fields and
 * the cross-border-transfer (KVKK m.9) consent wording must be finalized.
 *
 * The text is embedded here (rather than imported from docs/legal/*.md) because
 * React Native / Metro does not bundle markdown files from outside the app dir.
 * If these docs change, re-sync from docs/legal/.
 *
 * NOTE: PLACEHOLDER hosted URLs — these point to pages that do NOT exist yet.
 * Before store submission, publish the legal pages and update these constants
 * (and mobile/app.json) to the real published URLs.
 */

// ---------------------------------------------------------------------------
// PLACEHOLDER hosted URLs — NOT LIVE. Update before store submission.
// ---------------------------------------------------------------------------
export const LEGAL_URLS = {
  terms: 'https://bilinc.app/kosullar', // PLACEHOLDER — not published yet
  privacy: 'https://bilinc.app/gizlilik', // PLACEHOLDER — not published yet
  kvkk: 'https://bilinc.app/kvkk', // PLACEHOLDER — not published yet
  isletmeDogrulama: 'https://bilinc.app/isletme-dogrulama', // PLACEHOLDER — not published yet
} as const;

export type LegalDocKey = 'kosullar' | 'gizlilik' | 'kvkk' | 'isletme-dogrulama';

export interface LegalDoc {
  key: LegalDocKey;
  title: string;
  body: string;
}

const DRAFT_BANNER =
  'TASLAK — Bu metin yayınlanmadan önce bir avukat tarafından incelenmelidir. ' +
  'Hukuki tavsiye değildir. [PLACEHOLDER] alanları doldurulacaktır.\n\n';

// Exact Turkish consent + disclosure copy surfaced on the register screen.
// Sourced from docs/legal/kvkk-aydinlatma-metni.md ("Açık Rıza Metni").
export const KVKK_CONSENT_TEXT =
  'Hesabımı oluşturmak ve hizmeti kullanmak için kişisel verilerimin ' +
  '(kullanıcı adı, içerik, görseller ve işlem kayıtları dâhil), Bilinç’in ' +
  'kullandığı Supabase altyapısı kapsamında yurt dışındaki sunucularda ' +
  'işlenip saklanmasına ve bu kapsamda yurt dışına aktarılmasına (KVKK m. 9) ' +
  'açık rıza veriyorum.';

const KVKK_BODY =
  DRAFT_BANNER +
  'Bilinç — KVKK Aydınlatma Metni\n\n' +
  'Kişisel Verilerinizin Korunması Hakkında Bilgilendirme\n\n' +
  '6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") m. 10 uyarınca ' +
  'sizi bilgilendirmek isteriz.\n\n' +
  'Veri Sorumlusu: [PLACEHOLDER: Şirket yasal unvanı] ("Bilinç")\n' +
  'İletişim: [PLACEHOLDER: e-posta/adres] — VERBİS No: [PLACEHOLDER]\n\n' +
  'Hangi verilerinizi işliyoruz?\n' +
  '• Kullanıcı adınız ve (geri döndürülemez biçimde saklanan) şifreniz;\n' +
  '• Güvenlik sorularınız ve cevaplarınız;\n' +
  '• İtibar puanınız ve güvenilirlik seviyeniz;\n' +
  '• Paylaştığınız değerlendirmeler, gerçek bildirimleri, oylar ve görseller;\n' +
  '• IP adresiniz ve işlem/erişim kayıtlarınız.\n\n' +
  'Not: Kayıt sırasında e-posta adresinizi zorunlu olarak toplamıyoruz.\n\n' +
  'Verilerinizi neden işliyoruz?\n' +
  '• Hesabınızı oluşturmak ve hizmeti sunmak;\n' +
  '• Değerlendirme/gerçek/oylama özelliklerini çalıştırmak;\n' +
  '• İtibar sistemini işletmek ve kötüye kullanımı önlemek;\n' +
  '• Yasal yükümlülükleri (ör. 5651 sayılı Kanun) yerine getirmek.\n\n' +
  'Hukuki sebep\n' +
  'Verileriniz; sözleşmenin ifası, hukuki yükümlülük ve meşru menfaat ' +
  '(KVKK m. 5/2) sebeplerine dayanılarak; yurt dışına aktarım ve varsa ' +
  'pazarlama için ise açık rızanıza dayanılarak işlenir.\n\n' +
  'Verileriniz nereye aktarılıyor?\n' +
  'Hizmetlerimiz Supabase altyapısı üzerinde çalışır ve verileriniz yurt ' +
  'dışındaki sunucularda işlenebilir/saklanabilir. Bu aktarım, Açık Rıza ' +
  'Metni kapsamında onayınıza tabidir (KVKK m. 9). Ayrıca yasal yükümlülük ' +
  'hâlinde yetkili kamu kurumlarına aktarım yapılabilir.\n\n' +
  'Haklarınız (KVKK m. 11)\n' +
  'Kişisel verilerinize erişme, düzeltilmesini, silinmesini isteme ve ' +
  'işlemeye itiraz etme dahil haklarınızı [PLACEHOLDER: başvuru e-postası] ' +
  'üzerinden kullanabilirsiniz. Talepleriniz en geç 30 gün içinde yanıtlanır.\n\n' +
  '— Açık Rıza Metni —\n\n' +
  'Yurt dışı veri aktarımına açık rıza:\n' +
  KVKK_CONSENT_TEXT +
  '\n\nDetaylı bilgi için Gizlilik Politikası metnimizi inceleyebilirsiniz.';

const TERMS_BODY =
  DRAFT_BANNER +
  'Bilinç — Kullanım Koşulları (Kullanıcı Sözleşmesi)\n\n' +
  '1. Taraflar ve Tanımlar\n' +
  'Bu Kullanım Koşulları, Bilinç ("Platform") ile Platform’u kullanan kişi ' +
  '("Kullanıcı") arasında akdedilmiştir. Platform; öznel değerlendirmeleri, ' +
  'nesnel ve doğrulanabilir gerçek bildirimlerinden ayıran bir inceleme ' +
  'platformudur.\n\n' +
  '2. Sözleşmenin Kabulü\n' +
  'Platform’a kayıt olarak bu Koşulları okuduğunuzu, anladığınızı ve kabul ' +
  'ettiğinizi beyan edersiniz. Koşullar 6502 ve 6098 sayılı Kanunlara tabidir.\n\n' +
  '3. Üyelik Koşulları\n' +
  'Platform’u kullanmak için 18 yaşını doldurmuş olmanız gerekir. Kayıt ' +
  'yalnızca kullanıcı adı ve şifre ile yapılır; e-posta zorunlu değildir. ' +
  'Hesap güvenliğinizden siz sorumlusunuz.\n\n' +
  '4. Platform’un Rolü — Yer Sağlayıcı (5651 sayılı Kanun)\n' +
  'Bilinç, kullanıcı içeriğine yer sağlayan bir aracıdır. İçeriği yayımdan ' +
  'önce genel olarak denetlemekle yükümlü değildir; hukuka aykırılığı ' +
  'bildirilen içeriği "uyar-kaldır" usulüyle kaldırır. İçerikten içeriği ' +
  'oluşturan Kullanıcı sorumludur.\n\n' +
  '5. Kabul Edilebilir Kullanım\n' +
  'Hukuka, ahlaka ve kamu düzenine aykırı içerik; hakaret, tehdit, taciz, ' +
  'nefret söylemi; spam/bot/scraping; oy manipülasyonu ve üçüncü kişilerin ' +
  'kişisel verilerini izinsiz yayımlamak yasaktır.\n\n' +
  '6. Değerlendirmeler ve Gerçekler\n' +
  'Değerlendirmeler öznel görüşlerdir; yine de hakaret (TCK m. 125) ve ' +
  'asılsız beyanlardan sorumlu olursunuz. Gerçek bildirimi, nesnel ve ' +
  'doğrulanabilir olgulara ilişkindir, 100+ itibar puanı gerektirir. Asılsız ' +
  'bir "gerçek" bildirmek iftira (TCK m. 267), hakaret (TCK m. 125) ve haksız ' +
  'fiil/manevi tazminat (TBK m. 49 vd., m. 58) sorumluluğu doğurabilir.\n\n' +
  '7. Kullanıcı Sorumluluğu ve Tazminat\n' +
  'Paylaştığınız içerikten tek başınıza sorumlusunuz ve üçüncü kişilerin ' +
  'taleplerine karşı Platform’u tazmin etmeyi kabul edersiniz.\n\n' +
  '8. Topluluk Doğrulama ve Oylama\n' +
  'Gerçekler topluluk oylarıyla değerlendirilir; oylama bir doğruluk ' +
  'garantisi değildir. Kendi içeriğinize oy veremezsiniz.\n\n' +
  '9. İşletme Sahiplerinin Hakları\n' +
  'İşletmeler, listelemeyi sahiplenerek ve abone olarak yanıt verebilir ve ' +
  'gerçeklere itiraz edebilir.\n\n' +
  '10. Abonelik ve Ödeme\n' +
  'İşletme sahipleri için abonelik paketleri (Temel/Pro/Kurumsal) sunulabilir. ' +
  'Abonelikler mesafeli sözleşme niteliğindedir; cayma hakkı ve ödeme ' +
  'koşulları mevzuata tabidir. [PLACEHOLDER: fiyatlar]\n\n' +
  '11. Fikri Mülkiyet ve Üçüncü Taraf Verileri\n' +
  'Bazı işletme/konum verileri OpenStreetMap kaynaklıdır ve ODbL altında ' +
  '"© OpenStreetMap katkıda bulunanları" atfıyla kullanılır. Tağşiş verileri ' +
  'ilgili kamu kurumlarının açık listelerinden alınır.\n\n' +
  '12. Hesabın Askıya Alınması ve Fesih\n' +
  'Koşulları ihlal eden hesaplar askıya alınabilir veya kapatılabilir. ' +
  'Kullanıcı dilediği zaman hesabını kapatabilir.\n\n' +
  '13. Sorumluluğun Sınırlandırılması\n' +
  'Platform içeriği "olduğu gibi" sunar; içeriğin doğruluğunu garanti etmez. ' +
  'Emredici tüketici koruma hükümleri saklıdır.\n\n' +
  '14. Uygulanacak Hukuk\n' +
  'Bu Koşullar Türkiye Cumhuriyeti hukukuna tabidir. [PLACEHOLDER: yetkili ' +
  'mahkeme] ve Tüketici Hakem Heyetleri/Mahkemeleri yetkilidir.\n\n' +
  '15. İletişim\n' +
  '[PLACEHOLDER: iletişim e-postası / adres]';

const PRIVACY_BODY =
  DRAFT_BANNER +
  'Bilinç — Gizlilik Politikası (KVKK Uyumlu)\n\n' +
  'Bu politika 6698 sayılı KVKK uyarınca hazırlanmıştır.\n\n' +
  '1. Veri Sorumlusu\n' +
  '[PLACEHOLDER: Şirket yasal unvanı], [PLACEHOLDER: adres], VERBİS No: ' +
  '[PLACEHOLDER], Başvuru e-posta: [PLACEHOLDER].\n\n' +
  '2. İşlenen Kişisel Veri Kategorileri\n' +
  '• Hesap: kullanıcı adı, hashlenmiş şifre, güvenlik soruları;\n' +
  '• İtibar/Profil: itibar puanı, güvenilirlik seviyesi;\n' +
  '• İçerik: değerlendirmeler, gerçek bildirimleri, oylar, görseller;\n' +
  '• Log: IP adresi, erişim/işlem kayıtları;\n' +
  '• Abonelik: işletme sahipleri için ödeme referansı (kart verisi saklanmaz).\n' +
  'Not: Kayıt sırasında e-posta zorunlu olarak toplanmaz.\n\n' +
  '3. İşleme Amaçları\n' +
  'Üyelik yönetimi, hizmetin sunulması, itibar sistemi, içerik moderasyonu, ' +
  'kötüye kullanım önleme, hukuki yükümlülükler (5651), abonelik yönetimi.\n\n' +
  '4. Hukuki Sebepler (KVKK m. 5)\n' +
  'Sözleşmenin ifası, hukuki yükümlülük, meşru menfaat; yurt dışı aktarım ve ' +
  'pazarlama için açık rıza.\n\n' +
  '5. Altyapı\n' +
  'Platform veritabanı, kimlik doğrulama ve depolama için Supabase kullanır.\n\n' +
  '6. Yurt Dışına Veri Aktarımı (KVKK m. 9)\n' +
  'Supabase altyapısı, verilerin Türkiye dışındaki sunucularda işlenmesine yol ' +
  'açabilir. Bu aktarım açık rızanıza (KVKK m. 9) tabidir. [PLACEHOLDER: ' +
  'Supabase bölgesi / aktarım mekanizması avukatça netleştirilmelidir.]\n\n' +
  '7. Aktarılan Taraflar\n' +
  'Veri işleyenler (Supabase, ödeme kuruluşu) ve hukuki yükümlülük hâlinde ' +
  'yetkili kamu kurumları.\n\n' +
  '8. Saklama Süreleri\n' +
  'Hesap aktif olduğu sürece ve yasal yükümlülükler kapsamında saklanır; ' +
  'trafik/log kayıtları 5651 sayılı Kanun uyarınca tutulur.\n\n' +
  '9. Haklarınız (KVKK m. 11)\n' +
  'Verilerinizin işlenip işlenmediğini öğrenme, düzeltilmesini/silinmesini ' +
  'isteme, işlemeye itiraz etme ve zararın giderilmesini talep etme.\n\n' +
  '10. Başvuru\n' +
  'Taleplerinizi [PLACEHOLDER: başvuru e-postası] üzerinden iletebilirsiniz; ' +
  'en geç 30 gün içinde sonuçlandırılır. KVK Kurulu’na şikâyet hakkı saklıdır.\n\n' +
  '11. Çerezler\n' +
  'Web sürümü oturum yönetimi için çerez kullanabilir. [PLACEHOLDER]\n\n' +
  '12. Veri Güvenliği (KVKK m. 12)\n' +
  'Şifrelerin hashlenmesi, RLS, TLS/SSL şifreleme ve erişim denetimi.\n\n' +
  '13. İletişim\n' +
  '[PLACEHOLDER: e-posta / adres]';

// ---------------------------------------------------------------------------
// Business ownership verification — video + VKN only
// ---------------------------------------------------------------------------

/**
 * Açık rıza metni shown in the rıza checkbox on the claim screen.
 *
 * Covers: video (işletme doğrulama videosu) + VKN.
 * Does NOT cover: telefon, e-posta/alan adı, ödeme/kart, vergi levhası/belge.
 */
export const BUSINESS_VERIFICATION_CONSENT_TEXT =
  'İşletme sahipliği başvurusu kapsamında; vergi kimlik numaram (VKN) ve ' +
  'işletme doğrulama videomu, Bilinç tarafından yalnızca sahiplik teyidi ' +
  'amacıyla işlenmesine ve karar sonrası ham videonun kalıcı olarak silinmesine ' +
  'açık rıza veriyorum (KVKK m. 5/1). Bu rızamı her zaman geri çekebileceğimi ' +
  'biliyorum.';

const VERIFICATION_BODY =
  DRAFT_BANNER +
  'Bilinç — İşletme Sahipliği Doğrulama Aydınlatma Metni\n\n' +
  'Neden doğrulama istiyoruz?\n' +
  'Bilinç platformunda işletme adına yanıt verme ve profil düzenleme hakkı ' +
  '(reply-as-business), yalnızca kimliği doğrulanmış işletme sahibi veya ' +
  'yetkililere tanınır. Bu doğrulama, platformun güvenilirliğini korumak için ' +
  'zorunludur.\n\n' +
  'Ne istiyoruz?\n' +
  '• İşletme doğrulama videosu — canlılık ve sahiplik kanıtı olarak;\n' +
  '• Vergi Kimlik Numarası (VKN) — işletme sahipliğini teyit etmek için.\n' +
  'Telefon numarası, e-posta adresi, alan adı, ödeme/kart bilgisi veya ' +
  'vergi levhası/belge bu başvuru kapsamında talep edilmemektedir.\n\n' +
  'Videoda üçüncü kişiler görünebilir (bystander notu)\n' +
  'Çektiğiniz videoda çalışan veya müşteri gibi üçüncü kişiler arka planda ' +
  'görünebilir. Bu görüntüler yalnızca sahiplik doğrulaması amacıyla işlenir ' +
  've silinir. Videoda T.C. kimlik kartı ya da başka bir kimlik belgesi ' +
  'görünüyorsa lütfen görüntüyü çekmeden önce belgeyi maskeleyin/kapatın.\n\n' +
  'Verilerinizin işlenmesi\n' +
  'İşleme amacı doğrulama kararıyla sınırlıdır (amaç-sınırlı işleme). Karar ' +
  '(onay veya ret) tamamlandığında ham doğrulama videosu kalıcı olarak silinir; ' +
  'yalnızca minimal denetim kaydı ve VKN saklanmaya devam eder.\n' +
  'VKN saklama: Doğrulamanın tamamlanmasının ardından VKN, işletme hesabıyla ' +
  'ilişkilendirilmiş biçimde denetim amacıyla saklanır.\n\n' +
  'Hukuki sebep\n' +
  'Verileriniz; platformun meşru menfaatine (KVKK m. 5/2-f) ve aşağıdaki açık ' +
  'rızanıza (KVKK m. 5/1) dayanılarak işlenir.\n\n' +
  'Haklarınız (KVKK m. 11)\n' +
  'Kişisel verilerinize erişme, düzeltilmesini ve silinmesini isteme ile ' +
  'işlemeye itiraz etme dahil haklarınızı [PLACEHOLDER: başvuru e-postası] ' +
  'üzerinden kullanabilirsiniz. Talepleriniz en geç 30 gün içinde yanıtlanır.\n\n' +
  '— Açık Rıza Metni —\n\n' +
  BUSINESS_VERIFICATION_CONSENT_TEXT;

export const LEGAL_DOCS: Record<LegalDocKey, LegalDoc> = {
  kosullar: { key: 'kosullar', title: 'Kullanım Koşulları', body: TERMS_BODY },
  gizlilik: { key: 'gizlilik', title: 'Gizlilik Politikası', body: PRIVACY_BODY },
  kvkk: { key: 'kvkk', title: 'KVKK Aydınlatma Metni', body: KVKK_BODY },
  'isletme-dogrulama': {
    key: 'isletme-dogrulama',
    title: 'İşletme Doğrulama Aydınlatma Metni',
    body: VERIFICATION_BODY,
  },
};

export function getLegalDoc(key: string | undefined): LegalDoc | null {
  if (key && key in LEGAL_DOCS) return LEGAL_DOCS[key as LegalDocKey];
  return null;
}
