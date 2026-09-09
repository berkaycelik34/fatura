# Fatura Başlık Düzenleyici

Yüklediğiniz faturanın sol üstündeki adres/başlık alanını, seçtiğiniz firma adı,
adres satırları ve logo ile değiştiren tek sayfalık React uygulaması.

Her şey tarayıcıda çalışır: fatura hiçbir sunucuya gönderilmez, hiçbir yerde
saklanmaz. Sayfayı yenilediğinizde uygulama sıfırdan başlar — kayıt, veritabanı
ya da geçmiş tutulmaz. Böylece her fatura için farklı firma/logo kullanabilirsiniz.

## Nasıl kullanılır

1. Şifreyi girin (varsayılan: `1234567890`).
2. Faturayı sürükleyip bırakın veya seçin — PDF, PNG ve JPG desteklenir.
3. Değiştirilecek alanı seçin:
    - **Bölüm seç** (varsayılan): imleci fatura üzerinde gezdirin, algılanan bölüm
      çerçevelenir, tıklayınca seçilir. Sağdaki listeden adıyla da seçebilirsiniz.
    - **Serbest çiz**: alanı sürükleyerek kendiniz çizin.
      Her iki durumda da köşelerden boyutlandırıp ortasından tutup taşıyabilirsiniz.
4. Sağdaki panelden firma adını, adres/iletişim satırlarını ve logoyu girin.
   Arka plan rengini faturadan damlalıkla alabilirsiniz ("Faturadan renk al").
5. **PDF indir** ile çıktıyı alın. **PNG** ilk sayfayı görüntü olarak verir.

## Bölüm algılama

Fatura yüklendiğinde sayfanın kendi içeriği çözümlenerek mantıksal bölümler
çıkarılır:

1. Yatay çizgiler bulunur — ölçüt satırdaki kesintisiz en uzun parçadır, bu
   yüzden yalnızca bir sütun genişliğindeki çizgiler de yakalanır.
2. Yazı satırları, aralarındaki dikey boşluğa göre kümelenir ve her küme geniş
   boşluklardan sütunlara ayrılır.
3. Aynı sütundaki parçalar, aralarında **o sütunu kesen** bir çizgi yoksa tek
   bloğa birleştirilir. Sağdaki bir tablonun kenar çizgisi, soldaki bloğu
   bölmez.
4. Bloğun üstünde/altında ona ait bir çizgi varsa kutuya dahil edilir; kalınlığı
   ve rengi faturadan ölçülür ve çıktıda birebir yeniden çizilir.

Algılama sabit koordinatlara dayanmaz; her faturayı kendi ölçeğinde inceler ve
sonuçları sayfa oranı olarak tutar. Bölümün boyutu, yeri ya da sayfanın ölçüsü
faturadan faturaya değişse de bulunur. Bölümler PDF metin katmanından
adlandırılır (örn. alıcı bloğu, satıcı bilgileri).

Bir faturada hiç bölüm bulunamazsa uyarı gösterilir ve doğrudan serbest çizime
geçilir — sonuç aynı şekilde çalışır.

### Aynı bölümü yeni faturada bulma

Bir bölüm seçtikten sonra başka bir fatura yüklerseniz, uygulama o bölümün
eşleniğini **içeriğinden** arar ve bulursa kendiliğinden seçer. Konum
hatırlanmaz: kendi firma bilgileriniz gibi değişmeyen bir blok sayfanın başka
bir yerine kaymış olsa da metni aynı olduğu için bulunur. Müşteri bloğu gibi her
faturada değişen alanlar eşleşmez — bu istenen davranıştır, o bölümü yeniden
seçersiniz.

## Kaçak önleme ve punto ölçüsü

Kapatılan alanın kenarında eski yazıdan iz kalmaması ("kaçak") için iki ölçüm
yapılır:

1. **Kenar izi genişletmesi** — algılanan kutu, komşu şeritte yalnızca _soluk_
   mürekkep (harf kuyruğu, yumuşatma izi) kaldığı sürece dışa büyütülür. Güçlü
   mürekkep görülürse büyüme hemen durur, yani yandaki tabloya veya yazıya
   taşınmaz.
2. **Otomatik taşma payı** — kutunun dört yönünde komşu içeriğe kadar olan
   boşluk ölçülür ve kapatma dikdörtgeni bu kadar (en fazla ~4 pt) dışa
   taşırılır. Böylece kenarda iz kalmaz, komşu içerik de örtülmez. Panelden
   ("Kapatma taşma payı") elle de ayarlanabilir.

Yazı boyutları **sayfa yüksekliğine** oranlıdır, seçilen kutuya değil: büyük bir
alan seçmek yazıyı devasa yapmaz. Bir bölüm seçtiğinizde uygulama o bölümdeki
**özgün yazının puntosunu ölçer** ve yeni başlığı aynı ölçüye kurar (firma adı
bir tık büyük). Artan yer, yazı gerilmeden boş bırakılır. Panelde tüm ölçüler
punto (pt) olarak gösterilir.

## Yazı tipleri

Başlık için beş yazı tipi vardır; hepsi Türkçe karakterlerin tümünü kapsar,
PDF'e gömülür ve önizlemeyle birebir aynı görünür:

| Seçenek               | Karakter                                              |
| --------------------- | ----------------------------------------------------- |
| Inter · Modern        | Ferah ve çağdaş, nötr                                 |
| Montserrat · Kurumsal | Geniş, geometrik; firma adı büyük yazıldığında etkili |
| Roboto · Nötr         | Klasik fatura çıktılarına en yakın                    |
| Open Sans · Okunur    | Küçük puntoda rahat okunur, uzun adresler için        |
| PT Serif · Klasik     | Tırnaklı, resmî görünüm                               |

Yalnızca seçtiğiniz yazı tipi indirilir.

## İçerik ve konum ayarları

Sağdaki panel dört sekmeye ayrılmıştır:

- **İçerik** — firma adı ve adres satırları. Her satır ayrı bir alandır;
  sıralarını değiştirebilir, ekleyip silebilirsiniz. Logo da buradan seçilir.
- **Konum** — alanın X/Y/genişlik/yükseklik değerleri (% olarak), yatay ve dikey
  hizalama, iç boşluk, firma adı–adres arası boşluk, yazı ve logo için ince
  kaydırma, logonun yeri ve boyutu, çerçeve çizgileri (üst/alt, kalınlık, renk,
  yandan boşluk). Seçili alanı ok tuşlarıyla da kaydırabilirsiniz (Shift ile
  hızlı).
- **Stil** — yazı tipi, firma adı ve adres satırları için boyut/harf
  aralığı/renk, kalın ve BÜYÜK HARF, kapatma rengi (faturadan damlalıkla
  alınabilir).
- **Çıktı** — sayfa seçimi, PDF modu ve özet.

## Gereksiz sayfaları çıkarma

Çok sayfalı belgelerde her sayfa, GİB amblemi/QR kod (gömülü görsel) ve
e-fatura metin izleri (GİB, e-Arşiv, ETTN…) için incelenir. İkisi de bulunmayan
sayfalar "işaret yok" olarak işaretlenir.

"QR kod / GİB işareti olmayan sayfaları çıkar" anahtarını açarsanız bu sayfalar
PDF çıktısından tamamen çıkarılır. Anahtar kapalıyken uyarı gösterilir ve
sayfaları listeden tek tek seçebilirsiniz — hiçbir sayfa sessizce silinmez.

## Çok sayfalı faturalar

Yeni başlık, tüm sayfalara tek seferde aynı alana uygulanır. Önizlemede yalnızca
ilk sayfayı görürsünüz; seçtiğiniz alan ve girdiğiniz bilgiler diğer sayfalarda
da aynı yere yerleşir. Sadece ilk sayfanın değişmesini isterseniz "Sayfalar"
kartındaki anahtarı açın.

Kalın faturalar anında açılır: önizleme için yalnızca ilk sayfa çizilir, diğer
sayfalar gerektiğinde işlenir.

## PDF çıktı modları

| Mod                             | Ne yapar                                                                                                                                                                             | Ne zaman                                        |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| **Orijinali koru** (varsayılan) | Orijinal PDF yeniden çizilmez; metin ve çizgiler vektörel kalır, sadece seçtiğiniz alan yeni başlıkla kapatılır. Dosya küçük, kalite kayıpsız.                                       | Normal kullanım                                 |
| **Eski yazıyı tamamen sil**     | Değiştirilen sayfa görüntüye çevrilir, böylece eski adres PDF içinde metin olarak da kalmaz (kopyalanamaz, aranamaz). Diğer sayfalara dokunulmaz; yeni başlık yine vektörel yazılır. | Eski firma bilgisinin hiç kalmaması gerekiyorsa |

"Orijinali koru" modunda eski adres ekranda görünmez ama PDF'in metin katmanında
durmaya devam eder; metni seçip kopyalayan biri görebilir. Bu önemliyse ikinci
modu kullanın.

Yeni başlık her iki modda da gerçek (seçilebilir, aranabilir) metin olarak
gömülür ve Türkçe karakterler için Roboto yazı tipi kullanılır.

## Geliştirme

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # dist/
```

## Belge künyesi (isteğe bağlı)

PDF'te EXIF yoktur; karşılığı belge künyesidir. "Çıktı" sekmesindeki
**Düzenleyen cihazın künyesini yaz** anahtarı açılırsa, düzenlemeyi yapan
cihazın bilgileri PDF'in künyesine (Creator/Producer/Subject/Keywords) yazılır:
tarih, saat dilimi, dil, işletim sistemi ve sürümü, cihaz modeli, mimari, CPU
çekirdek sayısı, bellek ipucu, ekran çözünürlüğü ve tarayıcı bilgisi.

- Anahtar **varsayılan olarak kapalıdır** ve kapalıyken orijinal PDF'in künyesi
  olduğu gibi korunur.
- Açıkken, yazılacak satırların tamamı indirmeden önce panelde gösterilir.
- Bu bilgiler gizli değildir: her PDF okuyucunun "belge özellikleri" ekranında
  görünür, yani dosyayı alan herkes okuyabilir.
- **Genel IP adresini de ekle** ayrı bir anahtardır. IP tarayıcıda bilinmediği
  için `api.ipify.org` adresine istek gönderilir; bu anahtar açıkken "hiçbir
  veri cihazınızdan çıkmaz" garantisi geçerli değildir.

Tarayıcı; donanım seri numarası, MAC adresi veya disk kimliği vermez. Cihaz
modeli yalnızca bazı platformlarda (ör. Android) bildirilir, masaüstünde boş
kalır.

## Vercel'e yükleme

Uygulama bu deponun alt klasöründe olduğu için Vercel'de **Root Directory**
ayarlanmalıdır:

1. Vercel'de **Add New → Project** ile bu depoyu içe aktarın.
2. **Root Directory** olarak `fatura-editor` seçin.
3. Framework otomatik **Vite** algılanır (Build: `npm run build`, Output: `dist`).
4. Deploy edin.

CLI ile:

```bash
cd fatura-editor
npx vercel --prod
```

### Şifre

Varsayılan şifre `1234567890`. Değiştirmek için Vercel'de
`VITE_APP_PASSWORD` ortam değişkenini tanımlayıp yeniden deploy edin.

Şifre kontrolü tarayıcıda yapılır; kolay bir kapı kilidi sağlar ama gerçek bir
güvenlik katmanı değildir — uygulamanın kodunu inceleyen biri şifreyi görebilir.
Erişimi gerçekten kısıtlamak isterseniz Vercel'in
[Deployment Protection](https://vercel.com/docs/deployment-protection) özelliğini
(Password Protection / Vercel Authentication) açmanız gerekir.
