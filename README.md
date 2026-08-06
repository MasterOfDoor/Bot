# EMA Crossover & RSI Finansal Takip & Sinyal Botu

Bu proje, finansal varlıklarda (Kripto, Hisse Senedi, Altın/Emtia) **EMA 50 / EMA 200 Golden Cross** trend filtresi ve **RSI(14) < 30** zamanlaması kullanarak Long (Alım) fırsatlarını tespit eden, **%40 Stop-Loss** ve **%80 Take-Profit** hedefleriyle otomatik backtest ve takip yapan web tabanlı bir finansal uygulamadır.

## Özellikler

- **Trend Karar Mekanizması:** EMA 50 > EMA 200 olduğu durumlarda Long (Alım) trendi aktifleşir. Short işlemler pasif durumdadır.
- **Zamanlama Tetikleyicisi:** Trend aktifken RSI(14) değeri 30 seviyesinin altına (aşırı satım dip seviyesi) düştüğünde **ALIM SİNYALİ (BUY)** verilir.
- **Risk Yönetimi:** Giriş fiyatına göre **%80 Kâr Al (Take Profit)** ve **%40 Zarar Kes (Stop Loss)** hedefleri otomatik olarak atanır ve takip edilir.
- **Canlı Veri Kaynağı:** Yahoo Finance (`yfinance` sembol formatları: `BTC-USD`, `ETH-USD`, `AAPL`, `NVDA`, `TSLA`, `GC=F` vb.) veritabanı.
- **Arayüz & Grafik:** Fiyat mumları, EMA 50 (Altın Sarısı), EMA 200 (Turkuaz), RSI(14) alt paneli, canlı sinyal kartları ve işlem geçmişi logu.

## Netlify İle Canlıya Dağıtım (Deployment)

Proje tamamen istemci taraflı (Client-Side HTML5 / Vanilla CSS / ES6 Javascript) olarak geliştirildiği için herhangi bir derleme (`npm run build`) gerektirmez.

### Yöntem 1: Drag & Drop (En Hızlı)
1. Netlify hesabınıza girin ([app.netlify.com](https://app.netlify.com)).
2. **"Sites"** sekmesinden **"Want to deploy a new site without Git? Drag and drop your site folder here"** alanına `financial-bot` klasörünü sürükleyip bırakın.
3. Web siteniz birkaç saniye içinde canlıya alınacaktır!

### Yöntem 2: GitHub Entegrasyonu
1. Bu projenin kodlarını GitHub reponuza yükleyin.
2. Netlify panelinden **"Import from Git"** seçin.
3. Publish directory olarak `/` (kök dizin) belirleyip **Deploy** butonuna basın.

## Dosya Yapısı

```
financial-bot/
├── index.html              # Ana HTML5 UI yapısı
├── style.css               # Modern karanlık cammorphism tema & CSS
├── app.js                  # Strateji motoru (EMA, RSI, TP/SL, Backtest, Grafik)
├── yahooFinanceService.js  # Yahoo Finance API & proxy veri çekme servisi
├── _redirects              # Netlify yönlendirme yapılandırması
└── README.md               # Kullanım ve yayınlama kılavuzu
```
