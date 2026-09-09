# Fatura Başlık Düzenleyici

Yüklediğiniz faturanın sol üstündeki adres/başlık alanını, seçtiğiniz firma adı,
adres satırları ve logo ile değiştiren tek sayfalık React uygulaması.

Her şey tarayıcıda çalışır: fatura hiçbir sunucuya gönderilmez, hiçbir yerde
saklanmaz. Sayfayı yenilediğinizde uygulama sıfırdan başlar — kayıt, veritabanı
ya da geçmiş tutulmaz. Böylece her fatura için farklı firma/logo kullanabilirsiniz.

## Nasıl kullanılır

1. Şifreyi girin (varsayılan: `1234567890`).
2. Faturayı sürükleyip bırakın veya seçin — PDF, PNG ve JPG desteklenir.
3. Fatura üzerinde sürükleyerek değiştirilecek alanı çizin, köşelerden boyutlandırın,
   ortasından tutup taşıyın. Başlangıçta alan zaten sol üsttedir.
4. Sağdaki panelden firma adını, adres/iletişim satırlarını ve logoyu girin.
   Arka plan rengini faturadan damlalıkla alabilirsiniz ("Faturadan renk al").
5. **PDF indir** (veya **PNG indir**) ile çıktıyı alın.

Çok sayfalı faturalarda başlığın sadece görüntülenen sayfaya mı yoksa tüm
sayfalara mı uygulanacağını seçebilirsiniz.

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
