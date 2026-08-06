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

## 4. Çoklu Varlık Canlı Tarayıcısı (Scanner Service) — 🔮 GELECEK ADIM

* Hacmi en yüksek 100 USDT vadeli işlem çiftinin 15m grafiklerini arka planda anlık tarayarak en yüksek sinyal puanı alan coinlerde otomatik pozisyon başlatma.
