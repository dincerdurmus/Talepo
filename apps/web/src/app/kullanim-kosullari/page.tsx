import type { Metadata } from "next";

import { Field, LegalShell, Section } from "@/components/legal/LegalDocument";

export const metadata: Metadata = {
  title: "Kullanım koşulları",
};

/**
 * KULLANIM KOŞULLARI (2026-09-15).
 *
 * Önceki sürüm "Ödeme altyapısı bağlanana kadar ücretli plan yükseltmeleri
 * henüz aktif değildir" diyordu. Ücretli abonelik satışa açıldığı gün bu
 * cümle, para tahsil edilen sözleşmenin tahsilatı reddetmesi anlamına
 * geliyordu.
 *
 * İPTAL POLİTİKASI kurucu kararıdır (2026-09-15) ve koddaki davranışla
 * birebir aynıdır: iptal dönem sonunda geçerli olur, tahsil edilmiş dönem
 * iade edilmez, kullanıcı dönem sonuna kadar erişmeye devam eder, sonraki
 * dönem tahsilat yapılmaz. Metin ile kod arasında fark kalırsa metin yalan
 * söylüyor demektir; ikisi birlikte değişir.
 *
 * Bu metin bir avukat tarafından hazırlanmamıştır.
 */
export default function KullanimKosullariPage() {
  return (
    <LegalShell
      title="Kullanım koşulları"
      intro={
        <p>
          Bu koşullar, Talepo platformunu kullanımınızı düzenler. Hesap
          oluşturarak veya Platformu kullanmaya devam ederek bu koşulları ve
          KVKK Aydınlatma Metni&rsquo;ni okuduğunuzu kabul edersiniz.
        </p>
      }
    >
      <Section title="1. Taraflar ve tanımlar">
        <p>
          <strong>Platform / Talepo:</strong> <Field name="legalName" /> (MERSİS:{" "}
          <Field name="mersis" />, adres: <Field name="address" />) tarafından
          işletilen çevrim içi hizmet.
        </p>
        <p>
          <strong>Kullanıcı:</strong> Platforma üye olan gerçek veya tüzel kişi.{" "}
          <strong>Alıcı:</strong> ihtiyacını talep olarak yayımlayan Kullanıcı.{" "}
          <strong>Tedarikçi:</strong> bir talebe teklif veren Kullanıcı veya
          yetkili olduğu firma hesabı.
        </p>
      </Section>

      <Section title="2. Platformun rolü">
        <p>
          <strong>2.1.</strong> Talepo, Alıcı ile Tedarikçi&rsquo;yi buluşturan
          bir aracı platformdur. Talepo; teklife konu mal veya hizmetin satıcısı,
          üreticisi, ithalatçısı veya sağlayıcısı değildir, taraflar arasında
          kurulan sözleşmenin tarafı değildir, mal veya hizmet bedelini tahsil
          etmez, emanet hizmeti vermez ve işlem üzerinden komisyon almaz.
        </p>
        <p>
          <strong>2.2.</strong> Alıcı ile Tedarikçi arasındaki sözleşme, ifa,
          bedel, teslim, montaj, garanti, ayıp, iade ve her türlü ihtilaf
          doğrudan bu iki taraf arasındadır.
        </p>
        <p>
          <strong>2.3.</strong> Talepo, yayımlanan içeriğin doğruluğunu önceden
          denetlemekle yükümlü değildir; §7 ve §8 uyarınca moderasyon hakkını
          saklı tutar. 6563 sayılı Elektronik Ticaret Kanunu kapsamındaki aracı
          hizmet sağlayıcı yükümlülükleri saklıdır.
        </p>
      </Section>

      <Section title="3. Üyelik">
        <p>
          <strong>3.1.</strong> Üyelik, e-posta ve şifre ile veya desteklenen
          sosyal giriş sağlayıcıları üzerinden oluşturulur.
        </p>
        <p>
          <strong>3.2.</strong> Kullanıcı, verdiği bilgilerin doğru ve kendisine
          ait olduğunu; firma hesabı açıyorsa o firmayı temsile yetkili olduğunu
          beyan eder.
        </p>
        <p>
          <strong>3.3.</strong> Hesap ve şifre güvenliği Kullanıcı&rsquo;nın
          sorumluluğundadır. Yetkisiz erişim şüphesinde derhâl{" "}
          <Field name="supportEmail" /> adresine bildirim yapılmalıdır.
        </p>
        <p>
          <strong>3.4.</strong> Platform 18 yaşından küçükler tarafından
          kullanılamaz.
        </p>
        <p>
          <strong>3.5.</strong> Kullanıcı, hesabını kapatmayı{" "}
          <Field name="supportEmail" /> adresine başvurarak talep edebilir.
        </p>
      </Section>

      <Section title="4. Ücretlendirme ve ödeme">
        <p>
          <strong>4.1.</strong> Platformun temel kullanımı ücretsizdir. Ücretsiz
          planda aylık teklif verme sayısı sınırlıdır ve bazı özellikler
          kapalıdır.
        </p>
        <p>
          <strong>4.2.</strong> Ücretli Profesyonel üyelik aylık dönemli olarak
          sunulur. Güncel plan ve fiyatlar üyelik sayfasında yayımlanır; ilan
          edilen fiyatlar Türk Lirası cinsinden ve <Field name="vatIncluded" />
          &rsquo;dir.
        </p>
        <p>
          <strong>4.3.</strong> Üyelik dışında tek seferlik satın alınabilen ek
          paketler sunulur (ek teklif hakkı, talep öne çıkarma). Bu paketler
          abonelik değildir ve otomatik yenilenmez.
        </p>
        <p>
          <strong>4.4.</strong> Ödemeler lisanslı ödeme kuruluşu iyzico
          altyapısı üzerinden alınır.{" "}
          <strong>Kart bilgileriniz Talepo tarafından görülmez ve saklanmaz.</strong>
        </p>
        <p>
          <strong>4.5.</strong> Ücretli üyelik, ödemenin ödeme kuruluşu
          tarafından onaylandığı anda başlar ve her dönem sonunda otomatik
          olarak yenilenir. Fiyat değişikliği yürürlükten önce bildirilir ve
          yalnızca bildirimi izleyen dönemden itibaren uygulanır.
        </p>
        <p>
          <strong>4.6.</strong> Ödemenin alınamaması hâlinde üyelik geçici
          olarak &ldquo;ödeme alınamadı&rdquo; durumuna geçer; ödeme yine
          alınamazsa üyelik ücretsiz plana düşürülür.
        </p>
      </Section>

      <Section title="5. Abonelik iptali">
        <p>
          <strong>5.1.</strong> Kullanıcı ücretli üyeliğini dilediği zaman,
          üyelik yönetimi ekranından veya <Field name="supportEmail" /> adresine
          bildirim göndererek iptal edebilir. Gerekçe bildirmek zorunda değildir.
        </p>
        <p>
          <strong>5.2. İptal, içinde bulunulan ödeme döneminin sonunda geçerli
          olur.</strong>
        </p>
        <p>
          <strong>5.3. Tahsil edilmiş bulunan dönem ücreti için iade yapılmaz.</strong>
        </p>
        <p>
          <strong>5.4.</strong> Kullanıcı, iptal ettiği dönemin sonuna kadar
          ücretli üyeliğin tüm özelliklerine erişmeye devam eder. İptal, erişimi
          anında sonlandırmaz.
        </p>
        <p>
          <strong>5.5.</strong> Dönem sonunda üyelik otomatik olarak ücretsiz
          plana döner ve sonraki dönem için herhangi bir tahsilat yapılmaz.
        </p>
        <p>
          <strong>5.6.</strong> Tek seferlik satın alınan ek teklif hakkı ve öne
          çıkarma paketleri satın alındıkları anda kullanıma açılır; bu paketler
          için §5.2&ndash;5.5 uygulanmaz ve bedelleri iade edilmez. Talepo&rsquo;dan
          kaynaklanan teknik bir nedenle paketin hiç kullanılamamış olması
          hâlinde Talepo paketi yeniden tanımlar veya bedeli iade eder.
        </p>
      </Section>

      <Section title="6. Cayma hakkı ve tüketici hakları">
        <p>
          <strong>6.1.</strong> Bu madde yalnızca 6502 sayılı Tüketicinin
          Korunması Hakkında Kanun anlamında tüketici sıfatıyla, yani ticari veya
          mesleki olmayan amaçla hareket eden gerçek kişi Kullanıcılar için
          geçerlidir. Ticari veya mesleki amaçla hareket eden Kullanıcılar
          (firma hesapları ve tacirler) tüketici sayılmaz; onlar için §5&rsquo;teki
          iptal politikası geçerlidir.
        </p>
        <p>
          <strong>6.2.</strong> Tüketici sıfatındaki Kullanıcı, kural olarak
          mesafeli sözleşmelerde on dört (14) gün içinde gerekçe göstermeksizin
          cayma hakkına sahiptir.
        </p>
        <p>
          <strong>6.3.</strong> Bununla birlikte Mesafeli Sözleşmeler
          Yönetmeliği, elektronik ortamda anında ifa edilen hizmetlere ilişkin
          sözleşmeleri cayma hakkının istisnaları arasında saymaktadır. Ücretli
          üyelik, satın alma onaylanır onaylanmaz ücretli özelliklerin anında
          açılması suretiyle anında ifa edilen bir dijital hizmettir.
        </p>
        <p>
          <strong>6.4.</strong> Bu nedenle Talepo, satın alma akışında
          Kullanıcı&rsquo;dan hizmetin cayma süresi dolmadan ifasına başlanmasına
          açık onay vermesini ve bu onayla cayma hakkını kaybedeceğini kabul
          ettiğini teyit etmesini ister. Kullanıcı bu onayı vermezse hizmet,
          cayma süresi dolmadan ifa edilmeye başlanmaz.
        </p>
        <p>
          <strong>6.5.</strong> Kullanıcı somut olayda cayma hakkının varlığını
          tartışmalı görüyorsa <Field name="supportEmail" /> adresine
          başvurabilir; Talepo başvuruyu iyi niyetle değerlendirir ve mevzuat
          gereği cayma hakkının bulunduğu hâllerde bedeli mevzuatta öngörülen
          süre içinde iade eder.
        </p>
        <p>
          <strong>6.6.</strong> Tüketici sıfatındaki Kullanıcı, uyuşmazlık
          hâlinde parasal sınırlara göre Tüketici Hakem Heyetleri&rsquo;ne veya
          Tüketici Mahkemeleri&rsquo;ne başvurabilir. Bu hak §12&rsquo;deki yetki
          hükmünden etkilenmez.
        </p>
      </Section>

      <Section title="7. Yasaklı kullanım">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Gerçek bir ihtiyaca dayanmayan sahte talep yayımlamak; fiyat veya rakip bilgisi toplamak amacıyla yanıltıcı talep açmak</li>
          <li>Toplu, otomatik, alakasız veya tekrarlayan teklif göndermek; teklif sistemini manipüle etmek</li>
          <li>Teklif metinlerinde ve değerlendirmelerde telefon, e-posta, IBAN ve harici mesajlaşma/sosyal medya bağlantısı paylaşmak — Platform bu bilgileri otomatik maskeler, tekrarlayan ihlal §8 kapsamında yaptırıma tabidir</li>
          <li>Başkasının kimliğini, firmasını veya markasını izinsiz kullanmak</li>
          <li>Hukuka aykırı, hakaret içeren, ayrımcı, tehditkâr, müstehcen veya üçüncü kişilerin haklarını ihlal eden içerik yayımlamak</li>
          <li>Satışı yasak veya izne tabi olduğu hâlde izni bulunmayan mal ve hizmetlere ilişkin talep veya teklif yayımlamak</li>
          <li>Tersine mühendislik, izinsiz veri kazıma, güvenlik testi veya aşırı yük oluşturma</li>
          <li>Platformda elde edilen iletişim bilgilerini pazarlama veya üçüncü kişilere aktarım amacıyla kullanmak</li>
        </ul>
      </Section>

      <Section title="8. İçerik sorumluluğu ve moderasyon">
        <p>
          <strong>8.1.</strong> Yayımlanan her içeriğin hukuka uygunluğundan
          içeriği yükleyen Kullanıcı sorumludur.
        </p>
        <p>
          <strong>8.2.</strong> Kullanıcı, yüklediği içerik üzerinde gerekli
          haklara sahip olduğunu beyan eder ve Talepo&rsquo;ya bu içeriği yalnızca
          Platform hizmetinin sunulması amacıyla barındırma, çoğaltma ve ilgili
          taraflara gösterme konusunda bedelsiz, sınırlı bir kullanım hakkı verir.
        </p>
        <p>
          <strong>8.3.</strong> Talepo; bildirim üzerine veya kendi tespitiyle
          hukuka aykırı, yanıltıcı veya bu koşullara aykırı içeriği gizleyebilir
          ya da yayından kaldırabilir.
        </p>
        <p>
          <strong>8.4.</strong> İhlal hâlinde Talepo; uyarı, içerik kaldırma,
          teklif verme kısıtlaması, hesabı geçici askıya alma veya kapatma
          yaptırımlarını uygulayabilir. Kullanıcı bu karara{" "}
          <Field name="supportEmail" /> adresinden itiraz edebilir.
        </p>
      </Section>

      <Section title="9. Hizmetin sunumu">
        <p>
          <strong>9.1.</strong> Talepo, hizmeti kesintisiz ve hatasız sunacağını
          taahhüt etmez. Bakım, güncelleme, altyapı arızası veya mücbir sebep
          nedeniyle geçici kesintiler yaşanabilir.
        </p>
        <p>
          <strong>9.2.</strong> Talepo özellik setini geliştirebilir,
          değiştirebilir veya bir özelliği kaldırabilir. Ücretli planın temel
          içeriğini esaslı biçimde azaltan bir değişiklik hâlinde Kullanıcı,
          değişiklik yürürlüğe girmeden önce üyeliğini §5 uyarınca iptal edebilir.
        </p>
        <p>
          <strong>9.3.</strong> Platform üzerinden sunulan fiyat karşılaştırma,
          talep özeti, kategori önerisi ve eşleştirme çıktıları bilgilendirme
          amaçlıdır; bağlayıcı bir fiyat, ekspertiz veya danışmanlık değildir.
        </p>
      </Section>

      <Section title="10. Sorumluluğun sınırı">
        <p>
          <strong>10.1.</strong> Talepo, §2&rsquo;de tanımlanan aracı rolü
          çerçevesinde, Alıcı ile Tedarikçi arasındaki sözleşmeden doğan hiçbir
          borçtan sorumlu değildir.
        </p>
        <p>
          <strong>10.2.</strong> Talepo; kâr kaybı, iş kaybı, veri kaybı ve
          itibar zararı gibi dolaylı zararlardan sorumlu değildir.
        </p>
        <p>
          <strong>10.3.</strong> Bu sınırlamalar; Talepo&rsquo;nun kastı veya ağır
          kusuru, kişilik haklarına yönelik ihlaller ve emredici tüketici
          mevzuatı ile sınırlandırılamayacak sorumluluk hâlleri bakımından
          uygulanmaz.
        </p>
      </Section>

      <Section title="11. Kişisel verilerin korunması">
        <p>
          Kişisel verilerinizin işlenmesine ilişkin ayrıntılı bilgi{" "}
          <a
            href="/gizlilik-politikasi"
            className="font-medium text-teal-800 underline underline-offset-4"
          >
            KVKK Aydınlatma Metni
          </a>
          &rsquo;nde yer alır ve bu koşulların ayrılmaz parçasıdır.
        </p>
      </Section>

      <Section title="12. Uygulanacak hukuk ve uyuşmazlık">
        <p>
          Bu koşullara Türk hukuku uygulanır. Uyuşmazlıklarda{" "}
          <Field name="jurisdictionCity" /> Mahkemeleri ve İcra Daireleri
          yetkilidir. Tüketici sıfatındaki Kullanıcılar bakımından Tüketici Hakem
          Heyetleri ve Kullanıcı&rsquo;nın yerleşim yerindeki Tüketici
          Mahkemeleri&rsquo;nin yetkisi saklıdır.
        </p>
      </Section>

      <Section title="13. Yürürlük ve değişiklik">
        <p>
          <strong>13.1.</strong> Bu koşullar, Kullanıcı&rsquo;nın hesap
          oluşturması veya Platformu kullanmaya devam etmesiyle yürürlüğe girer.
        </p>
        <p>
          <strong>13.2.</strong> Talepo bu koşulları değiştirebilir. Esaslı
          değişiklikler yürürlüğe girmeden önce e-posta ve Platform içi
          bildirimle duyurulur. Değişiklik, ücretli üyeliğin içinde bulunulan
          döneminin koşullarını Kullanıcı aleyhine değiştirmez.
        </p>
        <p>
          <strong>13.3.</strong> Hükümlerden birinin geçersiz sayılması
          diğerlerinin geçerliliğini etkilemez.
        </p>
      </Section>
    </LegalShell>
  );
}
