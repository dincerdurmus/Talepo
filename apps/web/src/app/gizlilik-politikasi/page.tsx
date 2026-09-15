import type { Metadata } from "next";

import { Field, LegalShell, Section } from "@/components/legal/LegalDocument";

export const metadata: Metadata = {
  title: "KVKK Aydınlatma Metni",
};

/**
 * KVKK AYDINLATMA METNİ (2026-09-15).
 *
 * Önceki sürüm dört paragraflık bir özetti ve kendi içinde "KVKK kapsamında
 * tam aydınlatma metni yakında yayımlanacaktır" yazıyordu. Ad, e-posta,
 * telefon ve firma verisi işleyip ücretli abonelik satan bir pazar yerinde
 * bu tek başına lansmanı durdurur.
 *
 * Metindeki her veri kategorisi ve her üçüncü taraf, uydurma değil, KODDAN
 * ÖLÇÜLEREK yazıldı: şema alanları, sağlayıcı entegrasyonları, dışarı çağrı
 * yapan modüller. Ölçülmeyen hiçbir işleme faaliyeti yazılmadı.
 *
 * Bu metin bir avukat tarafından hazırlanmamıştır; hukuki denetime hazır bir
 * taslaktır ve yayına alınmadan önce incelenmelidir.
 */
export default function KvkkAydinlatmaPage() {
  return (
    <LegalShell
      title="KVKK Aydınlatma Metni"
      intro={
        <p>
          6698 sayılı Kişisel Verilerin Korunması Kanunu (&ldquo;KVKK&rdquo;)
          md. 10 uyarınca, Talepo platformunda kişisel verilerinizin nasıl
          işlendiğini bu metinle açıklıyoruz.
        </p>
      }
    >
      <Section title="1. Veri sorumlusunun kimliği">
        <ul className="space-y-1.5">
          <li>Unvan: <Field name="legalName" /></li>
          <li>Adres: <Field name="address" /></li>
          <li>MERSİS No: <Field name="mersis" /></li>
          <li>Vergi dairesi / no: <Field name="taxOffice" /></li>
          <li>KEP adresi: <Field name="kep" /></li>
          <li>VERBİS kaydı: <Field name="verbis" /></li>
        </ul>
        <p>(bundan sonra &ldquo;Talepo&rdquo; veya &ldquo;Platform&rdquo;)</p>
      </Section>

      <Section title="2. Platformun rolü">
        <p>
          Talepo, alıcıların ihtiyaç (&ldquo;talep&rdquo;) yayımladığı ve
          tedarikçi firmaların bu taleplere teklif verdiği bir aracı
          platformdur. Talepo, teklife konu mal veya hizmetin satıcısı,
          üreticisi, ithalatçısı veya sağlayıcısı değildir; alıcı ile tedarikçi
          arasında kurulan sözleşmenin tarafı değildir. Bu metin, Talepo&rsquo;nun
          kendi veri sorumlusu sıfatıyla işlediği kişisel verileri konu alır.
        </p>
      </Section>

      <Section title="3. İşlenen kişisel veri kategorileri">
        <p><strong>a) Kimlik verisi:</strong> ad-soyad, üyelik numarası, profil görseli.</p>
        <p><strong>b) İletişim verisi:</strong> e-posta adresi, telefon numarası, ülke/şehir/ilçe bilgisi.</p>
        <p>
          <strong>c) Firma ve ticari sicil verisi</strong> (firma profili
          oluşturulduğunda): firma unvanı, yasal unvan, firma telefonu ve
          e-postası, vergi numarası ve vergi dairesi, açık adres, posta kodu,
          ülke/şehir/ilçe/mahalle, web sitesi adresi, logo ve kapak görseli.
        </p>
        <p>
          <strong>d) Kullanıcı işlem verisi:</strong> oluşturduğunuz talepler
          (başlık, açıklama, yazdığınız ham serbest metin, konum, bütçe
          aralığı), verdiğiniz teklifler (açıklama, tutar, teslim süresi,
          geçerlilik tarihi), teklif görselleri, mesajlaşma içerikleri ve
          mesaja eklenen görseller, bildirimler, işlem sonucu kayıtları
          (anlaşılan fiyat), değerlendirme puanı ve yorumları, üyelik planı ve
          teklif kredisi bakiyesi.
        </p>
        <p>
          <strong>e) İşlem güvenliği verisi:</strong> şifre özeti (şifreniz düz
          metin olarak saklanmaz), oturum kayıtları ve oturum çerezleri, sosyal
          giriş sağlayıcısından gelen hesap eşleştirme bilgileri, son giriş
          zamanı, yönetici hesaplarında şifrelenmiş iki adımlı doğrulama sırrı.
          Yönetici işlem kayıtlarında IP adresi açık biçimde değil,
          özetlenmiş (hash) olarak tutulur.
        </p>
        <p>
          <strong>f) Talep/şikâyet ve moderasyon verisi:</strong> şikâyet ve
          destek kayıtları, ekleri, moderasyon değerlendirme notları, içerik
          gizleme gerekçeleri, hesap kısıtlama kayıtları.
        </p>
        <p>
          <strong>g) Ödeme ve abonelik verisi:</strong> abonelik planı, dönem
          tarihleri, abonelik durumu, ödeme sağlayıcısındaki müşteri ve
          abonelik referans numaraları, kredi hareket kayıtları.{" "}
          <strong>
            Kredi kartı numarası, son kullanma tarihi ve CVC/CVV bilgisi Talepo
            tarafından hiçbir şekilde toplanmaz, görülmez ve saklanmaz.
          </strong>{" "}
          Bu veriler doğrudan ödeme kuruluşunun kendi ödeme formuna girilir.
        </p>
        <p>
          <strong>Toplanmayan veriler:</strong> Talepo, T.C. kimlik numarası ve
          IBAN/banka hesap bilgisi için ayrı bir alan tutmaz. Mesaj ve teklif
          metinlerinde tespit edilen telefon, e-posta ve IBAN benzeri iletişim
          bilgileri otomatik olarak maskelenir.
        </p>
      </Section>

      <Section title="4. İşlenme amaçları">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Üyelik kaydı, kimlik doğrulama, oturum yönetimi ve hesap güvenliği</li>
          <li>Talep ve teklif süreçlerinin yürütülmesi; taleplerin ilgili kategori ve konumdaki tedarikçilerle eşleştirilmesi</li>
          <li>Platform içi mesajlaşma ve bildirimlerin iletilmesi</li>
          <li>İşlem sonrası anlaşma teyidi ve karşılıklı değerlendirme</li>
          <li>Üyelik planlarının satışı, abonelik yönetimi, faturalandırma</li>
          <li>İçerik moderasyonu, şikâyet yönetimi, sahte talep/spam/kötüye kullanım tespiti</li>
          <li>Hizmetin sürdürülmesi, hata teşhisi, güvenlik olaylarının izlenmesi</li>
          <li>Kişiyle ilişkilendirilmeyen toplu kullanım ölçümlerinin üretilmesi</li>
          <li>Yasal yükümlülüklerin yerine getirilmesi ve yetkili kurum taleplerinin karşılanması</li>
          <li>Uyuşmazlık hâlinde hakkın tesisi, kullanılması ve korunması</li>
        </ul>
        <p>
          <strong>Otomatik işleme:</strong> Talebiniz yayımlandığında metin
          otomatik olarak sınıflandırılır; sistem bir özet ve düzenlenmiş
          açıklama üretebilir, kategori ve konuma göre tedarikçi eşleştirme
          puanı hesaplanabilir. Bu işlemler talebinizin görünürlüğünü ve
          eşleştirme sırasını etkiler; hakkınızda hukuki sonuç doğuran bir karar
          yalnızca otomatik sistemlere dayanılarak verilmez. KVKK md. 11/(g)
          kapsamındaki itiraz hakkınız saklıdır.
        </p>
      </Section>

      <Section title="5. Hukuki sebepler (KVKK md. 5)">
        <p>
          <strong>md. 5/2-(c) sözleşmenin ifası:</strong> üyelik kaydı, kimlik
          doğrulama, oturum yönetimi, talep/teklif/mesajlaşma süreçleri,
          abonelik ve ödeme süreçleri.
        </p>
        <p>
          <strong>md. 5/2-(ç) hukuki yükümlülük ve md. 5/2-(a) kanunda açıkça
          öngörülme:</strong> fatura ve belge düzenleme, vergi ve ticaret
          mevzuatı kayıt yükümlülükleri, 6563 sayılı Kanun kapsamındaki
          yükümlülükler, yetkili kurum talepleri.
        </p>
        <p>
          <strong>md. 5/2-(f) meşru menfaat:</strong> sahtecilik/spam/kötüye
          kullanım tespiti, güvenlik kayıtları, moderasyon, platform
          bütünlüğünün korunması, kişiyle ilişkilendirilmeyen toplu ölçüm.
        </p>
        <p>
          <strong>md. 5/2-(e) hakkın tesisi:</strong> uyuşmazlık, dava, icra ve
          savunma süreçlerinde saklama ve kullanım.
        </p>
        <p>
          <strong>md. 5/1 açık rıza:</strong> ticari elektronik ileti ve
          pazarlama faaliyetleri ile zorunlu olmayan çerezler — bunlar ayrıca
          açık rızanıza tabidir ve rıza vermemeniz hizmete erişiminizi
          etkilemez.
        </p>
      </Section>

      <Section title="6. Aktarılan taraflar">
        <p>
          Verileriniz aşağıdaki taraflara yalnız hizmetin gerektirdiği ölçüde
          aktarılır. Talepo kişisel verilerinizi pazarlama amacıyla üçüncü
          taraflara satmaz.
        </p>
        <p>
          <strong>a) Diğer kullanıcılar:</strong> yayımladığınız talebin
          içeriği, konumu ve bütçe aralığı eşleşen tedarikçi firmalara; verdiğiniz
          teklifin içeriği talep sahibine gösterilir. Profil bilgileriniz
          yalnızca aynı teklif konuşmasının aktif katılımcısı olan karşı tarafa
          açılır. Değerlendirme puanı ve yorumunuz, değerlendirilen kullanıcı ile
          ilişkilendirilerek gösterilir.
        </p>
        <p>
          <strong>b) Ödeme kuruluşu:</strong> ödemeler iyzico altyapısı
          üzerinden alınır. Ödeme kuruluşuna ad-soyad, e-posta, telefon, fatura
          adresi, firma vergi numarası ve işlem anındaki IP adresiniz iletilir.
          Ödeme kuruluşu bu veriler bakımından kendi mevzuatı kapsamında ayrıca
          veri sorumlusudur.
        </p>
        <p>
          <strong>c) Barındırma ve veritabanı:</strong>{" "}
          <Field name="hostingProvider" /> ve <Field name="databaseProvider" />.
        </p>
        <p>
          <strong>d) Kimlik doğrulama sağlayıcıları:</strong> Google ile giriş
          seçeneğini kullanmanız hâlinde Google; etkinleştirilmişse Facebook veya
          X (Twitter). Bu akış yalnızca sizin başlatmanızla gerçekleşir.
        </p>
        <p>
          <strong>e) İçerik moderasyonu:</strong> mesajlaşmaya eklediğiniz
          görseller ve varsa açıklaması, uygunsuz içerik denetimi amacıyla
          OpenAI moderasyon hizmetine iletilir. Bu denetim kapsamında adınız,
          e-postanız veya hesap kimliğiniz iletilmez.
        </p>
        <p>
          <strong>f) Fiyat ve görsel kaynakları:</strong> fiyat karşılaştırması
          için DataForSEO ve talep kapak görseli önerisi için Wikimedia Commons
          hizmetlerine yalnızca ürün/kategori anahtar kelimeleri gönderilir;
          kimlik bilgileriniz gönderilmez.
        </p>
        <p>
          <strong>g) E-posta bildirim sağlayıcısı:</strong>{" "}
          <Field name="emailProvider" /> — kritik bildirimlerin (hesap/güvenlik,
          firma daveti, teklif kabulü, ödeme/abonelik) iletilmesi amacıyla.
        </p>
        <p>
          <strong>h) Yetkili kurumlar ve danışmanlar:</strong> kanunen yetkili
          kamu kurum ve kuruluşları, adli merciler; talep hâlinde ve mevzuatın
          izin verdiği ölçüde avukat ve mali müşavirler.
        </p>
      </Section>

      <Section title="7. Yurt dışına aktarım (KVKK md. 9)">
        <p>
          Yukarıda sayılan sağlayıcılardan bir kısmı yurt dışında yerleşiktir
          veya işleme faaliyetini yurt dışında gerçekleştirebilir. Bu
          kapsamdaki aktarımlar KVKK md. 9 çerçevesinde; Kurul tarafından
          yeterlilik kararı verilmiş bir ülkeye yapılıyorsa buna dayanılarak,
          aksi hâlde md. 9/3&rsquo;te sayılan uygun güvencelerden biri —
          özellikle Kurul tarafından ilan edilen standart sözleşme — temin
          edilerek ve gerekli bildirim yapılarak gerçekleştirilir.
          Aktarımın hangi ülkeye, hangi hukuki mekanizmayla yapıldığını
          aşağıdaki başvuru yolundan öğrenebilirsiniz.
        </p>
      </Section>

      <Section title="8. Çerezler">
        <p>
          Platform; oturumun sürdürülmesi, güvenlik ve seçtiğiniz çalışma
          alanının (bireysel / firma) hatırlanması için zorunlu çerezler
          kullanır. Zorunlu çerezler hizmetin verilebilmesi için gereklidir.
          Platformda üçüncü taraf reklam veya analitik izleyicisi
          kullanılmamaktadır. İleride zorunlu olmayan çerez kullanılması hâlinde
          bunlar yalnızca açık rızanızla çalıştırılacaktır.
        </p>
      </Section>

      <Section title="9. Toplanma yöntemi">
        <p>
          Kişisel verileriniz tamamen veya kısmen otomatik yollarla; kayıt,
          giriş, profil ve firma profili formları, talep oluşturma, teklif verme,
          mesajlaşma ve dosya yükleme ekranları, şikâyet ve değerlendirme
          formları, ödeme/abonelik akışı ve ödeme kuruluşundan dönen işlem
          bildirimleri, sosyal giriş sağlayıcıları ile oturum ve güvenlik
          çerezleri üzerinden toplanır.
        </p>
      </Section>

      <Section title="10. Saklama süresi">
        <p>
          Kişisel verileriniz, işlendikleri amaç için gerekli olan süre boyunca
          ve her hâlde ilgili mevzuatta öngörülen zamanaşımı ve saklama süreleri
          boyunca saklanır. Ödeme, abonelik ve fatura kayıtları vergi ve ticaret
          mevzuatı uyarınca on yıl saklanır. Süre sonunda verileriniz ilgili
          yönetmelik ve Talepo&rsquo;nun Kişisel Veri Saklama ve İmha Politikası
          uyarınca silinir, yok edilir veya anonim hâle getirilir.
        </p>
        <p>
          Hesabınızı kapatma talebinizde hesabınız kullanıma kapatılır ve
          profiliniz diğer kullanıcılara gösterilmez; buna karşılık tamamlanmış
          işlemlere, ödeme kayıtlarına ve uyuşmazlık ihtimaline ilişkin veriler
          yukarıdaki süreler boyunca saklanmaya devam eder.
        </p>
      </Section>

      <Section title="11. Haklarınız ve başvuru (KVKK md. 11)">
        <p>
          KVKK md. 11 uyarınca; kişisel verinizin işlenip işlenmediğini öğrenme,
          işlenmişse bilgi talep etme, işlenme amacını ve amacına uygun
          kullanılıp kullanılmadığını öğrenme, aktarıldığı üçüncü kişileri bilme,
          eksik veya yanlış işlenmişse düzeltilmesini isteme, KVKK md. 7
          çerçevesinde silinmesini veya yok edilmesini isteme, bu işlemlerin
          verilerin aktarıldığı üçüncü kişilere bildirilmesini isteme, münhasıran
          otomatik sistemlerle analiz edilmesi suretiyle aleyhinize bir sonuç
          çıkmasına itiraz etme ve kanuna aykırı işleme nedeniyle zarara
          uğramanız hâlinde zararın giderilmesini talep etme haklarına sahipsiniz.
        </p>
        <p>
          <strong>Başvuru:</strong> taleplerinizi Veri Sorumlusuna Başvuru Usul
          ve Esasları Hakkında Tebliğ&rsquo;e uygun olarak e-posta ile{" "}
          <Field name="kvkkEmail" />, KEP ile <Field name="kep" /> veya yazılı
          olarak <Field name="address" /> adresine iletebilirsiniz. Başvurunuz en
          geç otuz (30) gün içinde ücretsiz olarak sonuçlandırılır; işlemin
          ayrıca maliyet gerektirmesi hâlinde Kurulca belirlenen tarifedeki ücret
          alınabilir. Başvurunuzun reddedilmesi veya süresinde cevap verilmemesi
          hâlinde Kişisel Verileri Koruma Kurulu&rsquo;na şikâyette bulunabilirsiniz.
        </p>
      </Section>

      <Section title="12. Değişiklikler">
        <p>
          Bu aydınlatma metni, mevzuat değişiklikleri veya Platformdaki veri
          işleme faaliyetlerindeki değişiklikler nedeniyle güncellenebilir.
          Güncel metin bu sayfada yayımlanır; esaslı değişikliklerde kullanıcılar
          ayrıca bilgilendirilir.
        </p>
      </Section>
    </LegalShell>
  );
}
