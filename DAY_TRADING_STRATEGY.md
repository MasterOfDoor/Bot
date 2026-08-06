# 🚀 Day Trading Stratejisi & Mimarisi Dokümanı

Bu doküman, finansal al-sat botunun **Day Trading (Gün İçi Hızlı İşlemler)** modunda kullanılan tüm indikatör, risk yönetimi ve veri mimarisi kurallarını içerir.

---

## 1. Veri Mimarisi (Data Architecture) — ✅ TAMAMLANDI

* **Veri Kaynağı:** Binance Futures REST API (`/fapi/v1/klines`).
* **Bağlantı Hattı (Quad-Pipeline):** Local Proxy (`server.py`) ➔ Direct Binance Futures ➔ Binance Spot Fallback.
* **Desteklenen Zaman Dilimleri:** `5m` (Scalp), `15m` (Day Trading - Varsayılan), `1h` (Intraday Trend).
* **Güncelleme Hızı:** 4 saniyelik mikro döngüler ile sıfır gecikmeli veri akışı.

---

## 2. Strateji & İndikatör Kuralları (Strategy Engine) — ✅ TAMAMLANDI

Bir coin üzerinde işlem açılması için **4 ana şartın aynı anda sağlanması** gerekmektedir:

### 📈 LONG (Yükseliş / Alım) Şartları:
1. **Trend Onayı:** Hızlı `EMA(9)` > Yavaş `EMA(21)` (Yükseliş Trendi).
2. **Trend Gücü (ADX):** `ADX(14)` ≥ 20 (Piyasa yatay değil, gerçek trend var).
3. **Zamanlama (RSI):** `RSI(14)` < 38 (Yükselen trend içinde dip geri çekilmesi).
4. **Hacim Onayı:** Mum Hacmi ≥ `Volume_MA(20)` * 1.15 (Hacimsiz sahte kırılımları eler).

### 📉 SHORT (Düşüş / Satım) Şartları:
1. **Trend Onayı:** Hızlı `EMA(9)` < Yavaş `EMA(21)` (Düşüş Trendi).
2. **Trend Gücü (ADX):** `ADX(14)` ≥ 20 (Piyasa yatay değil, güçlü düşüş trendi).
3. **Zamanlama (RSI):** `RSI(14)` > 62 (Düşen trend içinde tepe düzeltmesi).
4. **Hacim Onayı:** Mum Hacmi ≥ `Volume_MA(20)` * 1.15 (Hacimsiz sahte hareketleri eler).

### 🛡️ Risk & Ödül Oranı (Dynamic Risk Management):
* **Stop-Loss (SL):** Giriş Fiyatı ∓ `(1.5 × ATR(14))`
* **Take-Profit (TP):** Giriş Fiyatı ± `(3.0 × ATR(14))`
* **Risk / Ödül Oranı:** 1 : 2 (Risk 1 birim, Hedef 2 birim)

---

## 3. Risk Yönetimi & Pozisyon Motoru (Order Engine) — ✅ TAMAMLANDI

* **Maksimum Pozisyon Limiti:** Aynı anda en fazla **3 aktif pozisyon** eşzamanlı açık tutulabilir (`maxPositions = 3`).
* **Akıllı Marjin Yönetimi:** İşlem başı bakiye kullanımı **%10 marjin** (Geride kalan %70 bakiye hesabı likidasyondan korur).
* **Bağımsız Pozisyon Takibi:** Her pozisyon kendi PnL, SL (%1.5 ATR) ve TP (%3.0 ATR) hedeflerini bağımsız yönetir.
* **Binance İletimi:** Market Giriş Emri ➔ 600ms Gecikme ➔ `reduceOnly` Destekli Hassas SL & TP Emirleri.

---

## 4. Çoklu Varlık Canlı Tarayıcısı (Scanner Service) — ✅ TAMAMLANDI

* **100+ Vadeli İşlem Çifti Taraması:** Hacmi en yüksek 100 USDT vadeli işlem çifti 4 saniyede bir taranır.
* **Tam Sinyal Filtresi Entegrasyonu:** `EMA 9/21` + `ADX ≥ 20` + `RSI < 42 / > 58` + `Hacim Onayı` 4'lü şartı sağlayan coinler önceliklendirilir.
* **Otomatik Pozisyon Havuzu:** Sinyal veren coinler kasayı koruyarak sırasıyla 3'lü aktif pozisyon havuzuna aktarılır.
* **Canlı Arayüz Göstergeleri:** Aktif açılan tüm pozisyonlar ve Binance borsa emirleri (Bekleyen SL/TP) arayüzde dinamik rozet ve kartlarla canlı güncellenir.
