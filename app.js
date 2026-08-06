/**
 * Main Application Logic & Trading Strategy Engine
 * Exhaustive Multi-Indicator Parameter Optimization Engine
 * Optimizes EMA Fast/Slow, RSI Period, RSI Buy/Sell thresholds, ATR Period, ATR SL/TP Multipliers.
 */

class StrategyEngine {
    constructor() {
        this.activeParams = {
            emaShort: 9,
            emaLong: 21,
            rsiPeriod: 14,
            rsiBuy: 38,
            rsiSell: 62,
            atrPeriod: 14,
            slMult: 1.5,
            tpMult: 3.0,
            volumePeriod: 20,
            volumeMult: 1.15,
            adxPeriod: 14,
            adxThreshold: 20
        };
    }

    calculateEMA(data, period) {
        const ema = new Array(data.length).fill(null);
        if (!data || data.length < period) return ema;

        let sum = 0;
        for (let i = 0; i < period; i++) {
            sum += data[i].close;
        }
        let prevEma = sum / period;
        ema[period - 1] = prevEma;

        const multiplier = 2 / (period + 1);

        for (let i = period; i < data.length; i++) {
            const currentEma = (data[i].close - prevEma) * multiplier + prevEma;
            ema[i] = currentEma;
            prevEma = currentEma;
        }

        return ema;
    }

    calculateRSI(data, period = 14) {
        const rsi = new Array(data.length).fill(null);
        if (!data || data.length <= period) return rsi;

        let gains = 0;
        let losses = 0;

        for (let i = 1; i <= period; i++) {
            const change = data[i].close - data[i - 1].close;
            if (change >= 0) gains += change;
            else losses += Math.abs(change);
        }

        let avgGain = gains / period;
        let avgLoss = losses / period;

        if (avgLoss === 0) rsi[period] = 100;
        else {
            const rs = avgGain / avgLoss;
            rsi[period] = 100 - (100 / (1 + rs));
        }

        for (let i = period + 1; i < data.length; i++) {
            const change = data[i].close - data[i - 1].close;
            const currentGain = change > 0 ? change : 0;
            const currentLoss = change < 0 ? Math.abs(change) : 0;

            avgGain = (avgGain * (period - 1) + currentGain) / period;
            avgLoss = (avgLoss * (period - 1) + currentLoss) / period;

            if (avgLoss === 0) {
                rsi[i] = 100;
            } else {
                const rs = avgGain / avgLoss;
                rsi[i] = 100 - (100 / (1 + rs));
            }
        }

        return rsi;
    }

    calculateATR(candles, period = 14) {
        const atr = new Array(candles.length).fill(null);
        if (!candles || candles.length <= period) return atr;

        const tr = new Array(candles.length).fill(0);
        tr[0] = candles[0].high - candles[0].low;

        for (let i = 1; i < candles.length; i++) {
            const high = candles[i].high;
            const low = candles[i].low;
            const prevClose = candles[i - 1].close;

            const tr1 = high - low;
            const tr2 = Math.abs(high - prevClose);
            const tr3 = Math.abs(low - prevClose);

            tr[i] = Math.max(tr1, tr2, tr3);
        }

        let sum = 0;
        for (let i = 0; i < period; i++) {
            sum += tr[i];
        }
        let prevAtr = sum / period;
        atr[period - 1] = prevAtr;

        for (let i = period; i < candles.length; i++) {
            const currentAtr = (prevAtr * (period - 1) + tr[i]) / period;
            atr[i] = currentAtr;
            prevAtr = currentAtr;
        }

        return atr;
    }

    calculateVolumeMA(candles, period = 20) {
        const volMa = new Array(candles.length).fill(null);
        if (!candles || candles.length < period) return volMa;

        let sum = 0;
        for (let i = 0; i < period; i++) sum += candles[i].volume;
        volMa[period - 1] = sum / period;

        for (let i = period; i < candles.length; i++) {
            sum += candles[i].volume - candles[i - period].volume;
            volMa[i] = sum / period;
        }

        return volMa;
    }

    calculateADX(candles, period = 14) {
        const adx = new Array(candles.length).fill(null);
        if (!candles || candles.length <= period * 2) return adx;

        const tr = [];
        const plusDM = [];
        const minusDM = [];

        for (let i = 1; i < candles.length; i++) {
            const upMove = candles[i].high - candles[i - 1].high;
            const downMove = candles[i - 1].low - candles[i].low;

            const tr1 = candles[i].high - candles[i].low;
            const tr2 = Math.abs(candles[i].high - candles[i - 1].close);
            const tr3 = Math.abs(candles[i].low - candles[i - 1].close);
            tr.push(Math.max(tr1, tr2, tr3));

            if (upMove > downMove && upMove > 0) plusDM.push(upMove);
            else plusDM.push(0);

            if (downMove > upMove && downMove > 0) minusDM.push(downMove);
            else minusDM.push(0);
        }

        let smoothedTR = tr.slice(0, period).reduce((a, b) => a + b, 0);
        let smoothedPlusDM = plusDM.slice(0, period).reduce((a, b) => a + b, 0);
        let smoothedMinusDM = minusDM.slice(0, period).reduce((a, b) => a + b, 0);

        const dxList = [];

        for (let i = period; i < tr.length; i++) {
            smoothedTR = smoothedTR - (smoothedTR / period) + tr[i];
            smoothedPlusDM = smoothedPlusDM - (smoothedPlusDM / period) + plusDM[i];
            smoothedMinusDM = smoothedMinusDM - (smoothedMinusDM / period) + minusDM[i];

            const plusDI = (smoothedPlusDM / smoothedTR) * 100;
            const minusDI = (smoothedMinusDM / smoothedTR) * 100;

            const diDiff = Math.abs(plusDI - minusDI);
            const diSum = plusDI + minusDI;
            const dx = diSum === 0 ? 0 : (diDiff / diSum) * 100;

            dxList.push({ index: i + 1, dx });
        }

        if (dxList.length >= period) {
            let sumDX = 0;
            for (let i = 0; i < period; i++) sumDX += dxList[i].dx;
            let currentADX = sumDX / period;
            adx[dxList[period - 1].index] = currentADX;

            for (let i = period; i < dxList.length; i++) {
                currentADX = (currentADX * (period - 1) + dxList[i].dx) / period;
                adx[dxList[i].index] = currentADX;
            }
        }

        return adx;
    }

    analyze(candles, customParams = null) {
        if (!candles || candles.length === 0) return null;

        const p = customParams || this.activeParams;

        const ema50 = this.calculateEMA(candles, p.emaShort);
        const ema200 = this.calculateEMA(candles, p.emaLong);
        const rsi = this.calculateRSI(candles, p.rsiPeriod);
        const atr = this.calculateATR(candles, p.atrPeriod);
        const volMa = this.calculateVolumeMA(candles, p.volumePeriod || 20);
        const adx = this.calculateADX(candles, p.adxPeriod || 14);

        const trades = [];
        const signals = new Array(candles.length).fill(null);

        let activePosition = null;

        for (let i = 0; i < candles.length; i++) {
            const candle = candles[i];
            const e50 = ema50[i];
            const e200 = ema200[i];
            const rVal = rsi[i];
            const atrVal = atr[i];
            const vMa = volMa[i];
            const adxVal = adx[i] !== null ? adx[i] : 25; // Default if warming up

            const isVolumeConfirmed = vMa ? (candle.volume >= vMa * (p.volumeMult || 1.15)) : true;
            const isTrendStrong = adxVal >= (p.adxThreshold || 20);

            if (activePosition) {
                if (activePosition.type === 'LONG') {
                    if (candle.high >= activePosition.tpPrice) {
                        const exitPrice = activePosition.tpPrice;
                        const pnlPct = ((exitPrice - activePosition.entryPrice) / activePosition.entryPrice) * 100;
                        trades.push({
                            id: trades.length + 1,
                            type: 'LONG',
                            entryIndex: activePosition.entryIndex,
                            entryDate: activePosition.entryDate,
                            entryPrice: activePosition.entryPrice,
                            exitIndex: i,
                            exitDate: candle.date,
                            exitPrice,
                            tpPrice: activePosition.tpPrice,
                            slPrice: activePosition.slPrice,
                            atr: activePosition.atr,
                            status: 'CLOSED_TP',
                            pnlPct
                        });
                        signals[i] = { type: 'TP_LONG', price: exitPrice };
                        activePosition = null;
                    } else if (candle.low <= activePosition.slPrice) {
                        const exitPrice = activePosition.slPrice;
                        const pnlPct = ((exitPrice - activePosition.entryPrice) / activePosition.entryPrice) * 100;
                        trades.push({
                            id: trades.length + 1,
                            type: 'LONG',
                            entryIndex: activePosition.entryIndex,
                            entryDate: activePosition.entryDate,
                            entryPrice: activePosition.entryPrice,
                            exitIndex: i,
                            exitDate: candle.date,
                            exitPrice,
                            tpPrice: activePosition.tpPrice,
                            slPrice: activePosition.slPrice,
                            atr: activePosition.atr,
                            status: 'CLOSED_SL',
                            pnlPct
                        });
                        signals[i] = { type: 'SL_LONG', price: exitPrice };
                        activePosition = null;
                    }
                } else if (activePosition.type === 'SHORT') {
                    if (candle.low <= activePosition.tpPrice) {
                        const exitPrice = activePosition.tpPrice;
                        const pnlPct = ((activePosition.entryPrice - exitPrice) / activePosition.entryPrice) * 100;
                        trades.push({
                            id: trades.length + 1,
                            type: 'SHORT',
                            entryIndex: activePosition.entryIndex,
                            entryDate: activePosition.entryDate,
                            entryPrice: activePosition.entryPrice,
                            exitIndex: i,
                            exitDate: candle.date,
                            exitPrice,
                            tpPrice: activePosition.tpPrice,
                            slPrice: activePosition.slPrice,
                            atr: activePosition.atr,
                            status: 'CLOSED_TP',
                            pnlPct
                        });
                        signals[i] = { type: 'TP_SHORT', price: exitPrice };
                        activePosition = null;
                    } else if (candle.high >= activePosition.slPrice) {
                        const exitPrice = activePosition.slPrice;
                        const pnlPct = ((activePosition.entryPrice - exitPrice) / activePosition.entryPrice) * 100;
                        trades.push({
                            id: trades.length + 1,
                            type: 'SHORT',
                            entryIndex: activePosition.entryIndex,
                            entryDate: activePosition.entryDate,
                            entryPrice: activePosition.entryPrice,
                            exitIndex: i,
                            exitDate: candle.date,
                            exitPrice,
                            tpPrice: activePosition.tpPrice,
                            slPrice: activePosition.slPrice,
                            atr: activePosition.atr,
                            status: 'CLOSED_SL',
                            pnlPct
                        });
                        signals[i] = { type: 'SL_SHORT', price: exitPrice };
                        activePosition = null;
                    }
                }
            }

            if (!activePosition && e50 !== null && e200 !== null && rVal !== null && atrVal !== null) {
                if (e50 > e200 && rVal < p.rsiBuy && isTrendStrong && isVolumeConfirmed) {
                    const entryPrice = candle.close;
                    const slPrice = entryPrice - (atrVal * p.slMult);
                    const tpPrice = entryPrice + (atrVal * p.tpMult);

                    activePosition = {
                        type: 'LONG',
                        entryIndex: i,
                        entryDate: candle.date,
                        entryPrice,
                        tpPrice,
                        slPrice,
                        atr: atrVal
                    };
                    signals[i] = { type: 'BUY_LONG', price: entryPrice };
                } else if (e50 < e200 && rVal > p.rsiSell && isTrendStrong && isVolumeConfirmed) {
                    const entryPrice = candle.close;
                    const slPrice = entryPrice + (atrVal * p.slMult);
                    const tpPrice = entryPrice - (atrVal * p.tpMult);

                    activePosition = {
                        type: 'SHORT',
                        entryIndex: i,
                        entryDate: candle.date,
                        entryPrice,
                        tpPrice,
                        slPrice,
                        atr: atrVal
                    };
                    signals[i] = { type: 'SELL_SHORT', price: entryPrice };
                }
            }
        }

        let totalPnlPct = 0;
        let winCount = 0;
        let lossCount = 0;

        trades.forEach(t => {
            totalPnlPct += t.pnlPct;
            if (t.pnlPct > 0) winCount++;
            else if (t.pnlPct < 0) lossCount++;
        });

        const winRate = trades.length > 0 ? (winCount / trades.length) * 100 : 0;

        const lastIdx = candles.length - 1;
        const lastE50 = ema50[lastIdx];
        const lastE200 = ema200[lastIdx];
        const lastRsi = rsi[lastIdx];

        let currentStatus = {
            state: 'NEUTRAL',
            title: 'Sinyal Bekleniyor',
            description: 'Long & Short trend ve RSI koşulları izleniyor.',
            badgeClass: 'badge-neutral'
        };

        if (activePosition) {
            const isLong = activePosition.type === 'LONG';
            currentStatus = {
                state: `IN_POSITION_${activePosition.type}`,
                title: `AÇIK POSİZYON (${activePosition.type})`,
                description: `Giriş: $${activePosition.entryPrice.toFixed(2)} | TP: $${activePosition.tpPrice.toFixed(2)} | Stop: $${activePosition.slPrice.toFixed(2)}`,
                badgeClass: isLong ? 'badge-success' : 'badge-warning'
            };
        } else if (lastE50 > lastE200 && lastRsi < p.rsiBuy) {
            currentStatus = {
                state: 'STRONG_BUY_LONG',
                title: 'GÜÇLÜ LONG SİNYALİ!',
                description: `EMA${p.emaShort} > EMA${p.emaLong} & RSI < ${p.rsiBuy} Dip seviyesinde!`,
                badgeClass: 'badge-buy'
            };
        } else if (lastE50 < lastE200 && lastRsi > p.rsiSell) {
            currentStatus = {
                state: 'STRONG_SELL_SHORT',
                title: 'GÜÇLÜ SHORT SİNYALİ!',
                description: `EMA${p.emaShort} < EMA${p.emaLong} & RSI > ${p.rsiSell} Zirve seviyesinde!`,
                badgeClass: 'badge-warning'
            };
        } else if (lastE50 > lastE200) {
            currentStatus = {
                state: 'LONG_TREND_ACTIVE',
                title: 'LONG TREND AKTİF',
                description: `EMA ${p.emaShort} ($${lastE50 ? lastE50.toFixed(2) : '-'}) > EMA ${p.emaLong} ($${lastE200 ? lastE200.toFixed(2) : '-'}). RSI (${lastRsi ? lastRsi.toFixed(1) : '-'}) ${p.rsiBuy} altına düşmesi bekleniyor.`,
                badgeClass: 'badge-info'
            };
        } else if (lastE50 < lastE200) {
            currentStatus = {
                state: 'SHORT_TREND_ACTIVE',
                title: 'SHORT TREND AKTİF',
                description: `EMA ${p.emaShort} ($${lastE50 ? lastE50.toFixed(2) : '-'}) < EMA ${p.emaLong} ($${lastE200 ? lastE200.toFixed(2) : '-'}). RSI (${lastRsi ? lastRsi.toFixed(1) : '-'}) ${p.rsiSell} üstüne çıkması bekleniyor.`,
                badgeClass: 'badge-warning'
            };
        }

        return {
            ema50,
            ema200,
            rsi,
            atr,
            signals,
            trades,
            activePosition,
            stats: {
                totalTrades: trades.length,
                winCount,
                lossCount,
                winRate,
                totalPnlPct
            },
            currentStatus,
            params: p
        };
    }

    /**
     * Exhaustive Deep Optimization Engine:
     * Sweeps across ALL indicator parameters (EMA Fast/Slow, RSI Period, RSI Thresholds, ATR Period, SL/TP Multipliers)
     * across the entire historical candle dataset.
     */
    optimizeParameters(candles) {
        if (!candles || candles.length < 50) return null;

        const grid = {
            emaShort: [15, 20, 25, 30, 40, 50],
            emaLong: [80, 100, 120, 150, 180, 200],
            rsiPeriod: [10, 14, 21],
            rsiBuy: [25, 30, 35],
            rsiSell: [65, 70, 75],
            atrPeriod: [10, 14, 21],
            slMult: [1.5, 2.0, 2.5],
            tpMult: [3.0, 4.0, 5.0]
        };

        let bestScore = -Infinity;
        let bestParams = null;
        let bestResult = null;

        const baselineResult = this.analyze(candles, this.activeParams);

        grid.emaShort.forEach(eShort => {
            grid.emaLong.forEach(eLong => {
                if (eShort >= eLong) return; // Fast EMA must be smaller than Slow EMA

                grid.rsiPeriod.forEach(rPeriod => {
                    grid.rsiBuy.forEach(rBuy => {
                        grid.rsiSell.forEach(rSell => {
                            grid.atrPeriod.forEach(aPeriod => {
                                grid.slMult.forEach(sM => {
                                    grid.tpMult.forEach(tM => {
                                        const p = {
                                            emaShort: eShort,
                                            emaLong: eLong,
                                            rsiPeriod: rPeriod,
                                            rsiBuy: rBuy,
                                            rsiSell: rSell,
                                            atrPeriod: aPeriod,
                                            slMult: sM,
                                            tpMult: tM
                                        };

                                        const res = this.analyze(candles, p);
                                        if (res && res.stats) {
                                            const trades = res.stats.totalTrades;
                                            const winRate = res.stats.winRate;
                                            const pnl = res.stats.totalPnlPct;

                                            // Score function balancing PnL %, Win Rate %, and minimal trade count
                                            const score = pnl * (winRate / 100) * Math.log(trades + 1);

                                            if (score > bestScore) {
                                                bestScore = score;
                                                bestParams = p;
                                                bestResult = res;
                                            }
                                        }
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });

        if (!bestParams) {
            bestParams = { ...this.activeParams };
            bestResult = baselineResult;
        }

        return {
            bestParams,
            bestResult,
            baselineResult
        };
    }
}

// Global UI Application Controller
class App {
    constructor() {
        this.strategy = new StrategyEngine();
        this.currentSymbol = 'BTCUSDT';
        this.currentInterval = '1h';
        this.rawChartData = null;
        this.rawAnalysisResult = null;
        this.displayData = null;
        this.hoverIndex = null;
        this.optimalParams = null;

        this.initUI();
        this.initDemoUI();
    }

    initUI() {
        this.symbolInput = document.getElementById('symbolInput');
        this.searchBtn = document.getElementById('searchBtn');
        this.intervalSelect = document.getElementById('intervalSelect');
        this.optimizeBtn = document.getElementById('optimizeBtn');
        this.popularChips = document.querySelectorAll('.chip');
        this.refreshBtn = document.getElementById('refreshBtn');

        this.modal = document.getElementById('optimizationModal');
        this.closeModalBtn = document.getElementById('closeModalBtn');
        this.applyOptBtn = document.getElementById('applyOptBtn');

        this.mainCanvas = document.getElementById('tradingChart');
        this.rsiCanvas = document.getElementById('rsiChartCanvas');

        // Main Navigation Workspace Tabs
        this.tabSignalBtn = document.getElementById('tabSignalBtn');
        this.tabDemoBtn = document.getElementById('tabDemoBtn');
        this.tabScannerBtn = document.getElementById('tabScannerBtn');
        this.tabSignalContent = document.getElementById('tabSignalContent');
        this.tabDemoContent = document.getElementById('tabDemoContent');
        this.tabScannerContent = document.getElementById('tabScannerContent');
        this.tabPosBadge = document.getElementById('tabPosBadge');

        const switchTab = (activeBtn, activeContent) => {
            [this.tabSignalBtn, this.tabDemoBtn, this.tabScannerBtn].forEach(btn => {
                if (btn) btn.classList.remove('active');
            });
            [this.tabSignalContent, this.tabDemoContent, this.tabScannerContent].forEach(cnt => {
                if (cnt) {
                    cnt.classList.remove('active');
                    cnt.style.display = 'none';
                }
            });
            if (activeBtn) activeBtn.classList.add('active');
            if (activeContent) {
                activeContent.classList.add('active');
                activeContent.style.display = 'block';
            }
        };

        if (this.tabSignalBtn) {
            this.tabSignalBtn.addEventListener('click', () => {
                switchTab(this.tabSignalBtn, this.tabSignalContent);
                this.renderCharts();
            });
        }

        if (this.tabDemoBtn) {
            this.tabDemoBtn.addEventListener('click', () => {
                switchTab(this.tabDemoBtn, this.tabDemoContent);
            });
        }

        if (this.tabScannerBtn) {
            this.tabScannerBtn.addEventListener('click', () => {
                switchTab(this.tabScannerBtn, this.tabScannerContent);
            });
        }

        this.initScannerUI();

        if (this.searchBtn) this.searchBtn.addEventListener('click', () => this.handleSearch());
        if (this.symbolInput) {
            this.symbolInput.addEventListener('keyup', (e) => {
                if (e.key === 'Enter') this.handleSearch();
            });
        }

        if (this.intervalSelect) {
            this.intervalSelect.addEventListener('change', (e) => {
                this.currentInterval = e.target.value;
                this.loadData();
            });
        }

        if (this.refreshBtn) this.refreshBtn.addEventListener('click', () => this.loadData());
        if (this.optimizeBtn) this.optimizeBtn.addEventListener('click', () => this.runOptimization());

        if (this.closeModalBtn) {
            this.closeModalBtn.addEventListener('click', () => {
                this.modal.style.display = 'none';
            });
        }

        if (this.applyOptBtn) {
            this.applyOptBtn.addEventListener('click', () => {
                if (this.optimalParams) {
                    // Update active strategy parameters
                    this.strategy.activeParams = { ...this.optimalParams };
                    this.modal.style.display = 'none';

                    // Re-run analysis with optimal parameters
                    this.rawAnalysisResult = this.strategy.analyze(this.rawChartData.candles, this.strategy.activeParams);
                    this.updateDisplaySlice();
                }
            });
        }

        this.popularChips.forEach(chip => {
            chip.addEventListener('click', () => {
                const sym = chip.dataset.symbol;
                if (sym) {
                    this.symbolInput.value = sym;
                    this.currentSymbol = sym;
                    this.loadData();
                }
            });
        });

        this.setupCanvasInteractivity();
        this.loadData();

        window.addEventListener('resize', () => {
            this.renderCharts();
        });
    }

    handleSearch() {
        const val = this.symbolInput ? this.symbolInput.value.trim() : '';
        if (val) {
            this.currentSymbol = val.toUpperCase();
            this.loadData();
        }
    }

    async loadData() {
        this.showLoading(true, 'Binance Vadeli Piyasalar (Futures) Verileri Çekiliyor...');
        try {
            this.rawChartData = await window.yahooFinanceService.fetchChartData(
                this.currentSymbol,
                this.currentInterval
            );

            if (!this.rawChartData || this.rawChartData.candles.length === 0) {
                alert(`"${this.currentSymbol}" sembolü Binance Vadeli Piyasasında (Futures) bulunamadı!`);
                this.showLoading(false);
                return;
            }

            // Run analysis using current active parameters
            this.rawAnalysisResult = this.strategy.analyze(this.rawChartData.candles, this.strategy.activeParams);
            this.updateDisplaySlice();
            this.startLivePricePolling();

        } catch (err) {
            console.error('Data load error:', err);
            alert(err.message || 'Binance Futures verisi yüklenirken bir hata oluştu.');
        } finally {
            this.showLoading(false);
        }
    }

    startLivePricePolling() {
        if (this.pricePollInterval) clearInterval(this.pricePollInterval);
        this.pricePollInterval = setInterval(async () => {
            if (!this.displayData || !this.displayData.symbol) return;

            const sym = this.displayData.symbol;
            const endpoints = [
                `/_futures/fapi/v1/ticker/price?symbol=${sym}`,
                `https://fapi.binance.com/fapi/v1/ticker/price?symbol=${sym}`
            ];

            for (const url of endpoints) {
                try {
                    const resp = await fetch(url);
                    if (resp.ok) {
                        const data = await resp.json();
                        const livePrice = parseFloat(data.price);
                        if (!isNaN(livePrice) && livePrice > 0) {
                            if (this.displayPriceText) {
                                this.displayPriceText.innerText = `$${livePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                            }
                            if (this.displayData.candles && this.displayData.candles.length > 0) {
                                const last = this.displayData.candles[this.displayData.candles.length - 1];
                                last.close = livePrice;
                                if (livePrice > last.high) last.high = livePrice;
                                if (livePrice < last.low) last.low = livePrice;
                            }
                            this.updateDemoUI(livePrice);
                            return;
                        }
                    }
                } catch (e) {}
            }
        }, 2000);
    }

    runOptimization() {
        if (!this.rawChartData || !this.rawChartData.candles) return;

        this.showLoading(true, 'Tüm İndikatörler Üzerinde Derin Optimizasyon Hesaplanıyor...');

        setTimeout(() => {
            try {
                const optResult = this.strategy.optimizeParameters(this.rawChartData.candles);
                if (!optResult) return;

                this.optimalParams = optResult.bestParams;

                const baseStats = optResult.baselineResult ? optResult.baselineResult.stats : { winRate: 0, totalPnlPct: 0 };
                const optStats = optResult.bestResult ? optResult.bestResult.stats : { winRate: 0, totalPnlPct: 0 };
                const p = this.optimalParams;

                const optEmaFast = document.getElementById('optEmaFast');
                if (optEmaFast) optEmaFast.innerText = `EMA ${p.emaShort}`;

                const optEmaSlow = document.getElementById('optEmaSlow');
                if (optEmaSlow) optEmaSlow.innerText = `EMA ${p.emaLong}`;

                const optRsiPeriod = document.getElementById('optRsiPeriod');
                if (optRsiPeriod) optRsiPeriod.innerText = `${p.rsiPeriod}`;

                const optRsiBuy = document.getElementById('optRsiBuy');
                if (optRsiBuy) optRsiBuy.innerText = `${p.rsiBuy}`;

                const optRsiSell = document.getElementById('optRsiSell');
                if (optRsiSell) optRsiSell.innerText = `${p.rsiSell}`;

                const optAtrRisk = document.getElementById('optAtrRisk');
                if (optAtrRisk) optAtrRisk.innerText = `${p.slMult}x SL / ${p.tpMult}x TP (${p.atrPeriod})`;

                const optNetReturn = document.getElementById('optNetReturn');
                if (optNetReturn) {
                    optNetReturn.innerText = `${optStats.totalPnlPct >= 0 ? '+' : ''}${optStats.totalPnlPct.toFixed(1)}%`;
                    optNetReturn.className = optStats.totalPnlPct >= 0 ? 'positive' : 'negative';
                }

                const optWinRate = document.getElementById('optWinRate');
                if (optWinRate) optWinRate.innerText = `${optStats.winRate.toFixed(1)}%`;

                if (this.modal) this.modal.style.display = 'flex';
            } catch (err) {
                console.error('Optimization error:', err);
                alert('Optimizasyon sırasında hata oluştu.');
            } finally {
                this.showLoading(false);
            }
        }, 120);
    }

    updateDisplaySlice() {
        if (!this.rawChartData || !this.rawAnalysisResult) return;

        const fullCandles = this.rawChartData.candles;
        const count = 365;
        const startIdx = Math.max(0, fullCandles.length - count);

        this.displayData = {
            symbol: this.rawChartData.symbol,
            currency: this.rawChartData.currency,
            regularMarketPrice: this.rawChartData.regularMarketPrice,
            isSimulated: this.rawChartData.isSimulated,
            provider: this.rawChartData.provider,
            candles: fullCandles.slice(startIdx),
            ema50: this.rawAnalysisResult.ema50.slice(startIdx),
            ema200: this.rawAnalysisResult.ema200.slice(startIdx),
            rsi: this.rawAnalysisResult.rsi.slice(startIdx),
            atr: this.rawAnalysisResult.atr.slice(startIdx),
            signals: this.rawAnalysisResult.signals.slice(startIdx),
            trades: this.rawAnalysisResult.trades,
            stats: this.rawAnalysisResult.stats,
            currentStatus: this.rawAnalysisResult.currentStatus,
            params: this.rawAnalysisResult.params
        };

        this.updateHeaderAndCards();
        this.updateTradeTable();
        this.renderCharts();
    }

    showLoading(isLoading, text = 'Yükleniyor...') {
        const loader = document.getElementById('loadingOverlay');
        const loadingText = document.getElementById('loadingText');
        if (loadingText) loadingText.innerText = text;
        if (loader) {
            loader.style.display = isLoading ? 'flex' : 'none';
        }
    }

    updateHeaderAndCards() {
        if (!this.displayData) return;

        const candles = this.displayData.candles;
        const lastCandle = candles[candles.length - 1];
        const prevCandle = candles.length > 1 ? candles[candles.length - 2] : lastCandle;
        const changePct = ((lastCandle.close - prevCandle.close) / prevCandle.close) * 100;
        const p = this.displayData.params || {};

        const displaySymbol = document.getElementById('displaySymbol');
        if (displaySymbol) displaySymbol.innerText = this.displayData.symbol;

        const displayPrice = document.getElementById('displayPrice');
        if (displayPrice) displayPrice.innerText = `$${lastCandle.close.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
        
        const priceChangeEl = document.getElementById('displayChange');
        if (priceChangeEl) {
            priceChangeEl.innerText = `${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%`;
            priceChangeEl.className = `asset-change ${changePct >= 0 ? 'text-success' : 'text-danger'}`;
        }

        const providerEl = document.getElementById('providerText');
        if (providerEl) {
            providerEl.innerText = `${this.displayData.provider || 'Binance Live'} (${this.displayData.currency || 'USDT'})`;
        }

        // Update Demo Engine Live PnL & Check Auto-Trader Signals
        this.updateDemoUI(lastCandle.close);
        this.checkAutoTraderSignals(lastCandle);

        // Update Rules Card Text Dynamically
        const ruleLongEl = document.getElementById('ruleLongText');
        if (ruleLongEl) ruleLongEl.innerText = `EMA${p.emaShort} > EMA${p.emaLong} & RSI < ${p.rsiBuy}`;

        const ruleShortEl = document.getElementById('ruleShortText');
        if (ruleShortEl) ruleShortEl.innerText = `EMA${p.emaShort} < EMA${p.emaLong} & RSI > ${p.rsiSell}`;

        const ruleSlEl = document.getElementById('ruleSlText');
        if (ruleSlEl) ruleSlEl.innerText = `${p.slMult}x ATR (${p.atrPeriod})`;

        const ruleTpEl = document.getElementById('ruleTpText');
        if (ruleTpEl) ruleTpEl.innerText = `${p.tpMult}x ATR (${p.atrPeriod})`;

        // Update Chart Legend Labels Dynamically
        const legendShortEl = document.getElementById('legendEmaShort');
        if (legendShortEl) legendShortEl.innerText = `EMA ${p.emaShort}`;

        const legendLongEl = document.getElementById('legendEmaLong');
        if (legendLongEl) legendLongEl.innerText = `EMA ${p.emaLong}`;

        const status = this.displayData.currentStatus;
        const statusBadge = document.getElementById('signalBadge');
        const statusTitle = document.getElementById('signalHeadline');
        const statusDesc = document.getElementById('signalDescription');

        if (statusBadge) {
            statusBadge.className = `status-pill ${status.badgeClass}`;
            statusBadge.innerText = status.state.replace(/_/g, ' ');
        }
        if (statusTitle) statusTitle.innerText = status.title;
        if (statusDesc) statusDesc.innerText = status.description;

        const stats = this.displayData.stats;
        
        const returnEl = document.getElementById('metricReturn');
        if (returnEl) {
            returnEl.innerText = `${stats.totalPnlPct >= 0 ? '+' : ''}${stats.totalPnlPct.toFixed(1)}%`;
            returnEl.className = `metric-value ${stats.totalPnlPct >= 0 ? 'positive' : 'negative'}`;
        }

        const winRateEl = document.getElementById('metricWinRate');
        if (winRateEl) winRateEl.innerText = `${stats.winRate.toFixed(1)}%`;

        const tradeCountEl = document.getElementById('metricTradeCount');
        if (tradeCountEl) tradeCountEl.innerText = `${stats.totalTrades}`;

        const winCountEl = document.getElementById('metricWinCount');
        if (winCountEl) winCountEl.innerText = `${stats.winCount} Kâr / ${stats.lossCount} Zarar`;

        const barsEl = document.getElementById('metricBars');
        if (barsEl) barsEl.innerText = `${candles.length} Mum`;
    }

    updateTradeTable() {
        const tbody = document.getElementById('tradesTableBody');
        const countBadge = document.getElementById('tradesCountBadge');

        const trades = this.displayData ? this.displayData.trades : [];

        if (countBadge) {
            countBadge.innerText = `${trades.length} İşlem`;
        }

        if (!tbody) return;
        tbody.innerHTML = '';

        if (trades.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">Bu zaman diliminde strateji sinyali bulunamadı.</td></tr>`;
            return;
        }

        [...trades].reverse().forEach(t => {
            const tr = document.createElement('tr');
            const pnlClass = t.pnlPct >= 0 ? 'text-success font-bold' : 'text-danger font-bold';
            const directionBadge = t.type === 'LONG'
                ? '<span class="badge-sm badge-buy">LONG</span>'
                : '<span class="badge-sm badge-warning">SHORT</span>';
                
            const statusBadge = t.status === 'CLOSED_TP' 
                ? '<span class="badge-sm badge-success">TAKE PROFIT (ATR)</span>' 
                : '<span class="badge-sm badge-danger">STOP LOSS (ATR)</span>';

            tr.innerHTML = `
                <td>${new Date(t.entryDate).toLocaleDateString()} ${new Date(t.entryDate).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</td>
                <td>${directionBadge}</td>
                <td>$${t.entryPrice.toFixed(2)}</td>
                <td>$${t.exitPrice.toFixed(2)}</td>
                <td>${statusBadge}</td>
                <td>${t.status === 'CLOSED_TP' ? 'Kar Hedefi Ulaşıldı' : 'Stop Loss Kesildi'}</td>
                <td class="${pnlClass}">${t.pnlPct >= 0 ? '+' : ''}${t.pnlPct.toFixed(1)}%</td>
            `;
            tbody.appendChild(tr);
        });
    }

    setupCanvasInteractivity() {
        const handleMouseMove = (e) => {
            if (!this.displayData) return;
            const rect = this.mainCanvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const candles = this.displayData.candles;
            
            const paddingRight = 60;
            const paddingLeft = 10;
            const chartWidth = this.mainCanvas.width - paddingLeft - paddingRight;

            const index = Math.round(((mouseX - paddingLeft) / chartWidth) * (candles.length - 1));
            if (index >= 0 && index < candles.length) {
                this.hoverIndex = index;
                this.renderCharts();
                this.updateTooltip(index, e.clientX, e.clientY);
            }
        };

        const handleMouseLeave = () => {
            this.hoverIndex = null;
            this.renderCharts();
            this.hideTooltip();
        };

        this.mainCanvas.addEventListener('mousemove', handleMouseMove);
        this.mainCanvas.addEventListener('mouseleave', handleMouseLeave);
        this.rsiCanvas.addEventListener('mousemove', handleMouseMove);
        this.rsiCanvas.addEventListener('mouseleave', handleMouseLeave);
    }

    updateTooltip(index, screenX, screenY) {
        const tooltip = document.getElementById('chartTooltip');
        if (!tooltip || !this.displayData) return;

        const candle = this.displayData.candles[index];
        const e50 = this.displayData.ema50[index];
        const e200 = this.displayData.ema200[index];
        const rsi = this.displayData.rsi[index];
        const atr = this.displayData.atr[index];
        const sig = this.displayData.signals[index];
        const params = this.displayData.params || {};

        let signalText = 'Yok';
        if (sig) {
            if (sig.type === 'BUY_LONG') signalText = '<span class="text-success font-bold">ALIM SİNYALİ (LONG)</span>';
            else if (sig.type === 'SELL_SHORT') signalText = '<span class="text-danger font-bold">SATIM SİNYALİ (SHORT)</span>';
            else if (sig.type.startsWith('TP')) signalText = '<span class="text-success font-bold">TAKE PROFIT (ATR)</span>';
            else if (sig.type.startsWith('SL')) signalText = '<span class="text-danger font-bold">STOP LOSS (ATR)</span>';
        }

        tooltip.innerHTML = `
            <div class="tooltip-header">${new Date(candle.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
            <div class="tooltip-row"><span>Kapanış:</span> <b>$${candle.close.toFixed(2)}</b></div>
            <div class="tooltip-row"><span>Yüksek / Düşük:</span> <span>$${candle.high.toFixed(2)} / $${candle.low.toFixed(2)}</span></div>
            <div class="tooltip-row"><span style="color:#fbbf24">EMA ${params.emaShort || 50}:</span> <span>${e50 ? '$' + e50.toFixed(2) : '-'}</span></div>
            <div class="tooltip-row"><span style="color:#38bdf8">EMA ${params.emaLong || 200}:</span> <span>${e200 ? '$' + e200.toFixed(2) : '-'}</span></div>
            <div class="tooltip-row"><span style="color:#c084fc">RSI (${params.rsiPeriod || 14}):</span> <span>${rsi ? rsi.toFixed(1) : '-'}</span></div>
            <div class="tooltip-row"><span style="color:#f59e0b">ATR (${params.atrPeriod || 14}):</span> <span>${atr ? '$' + atr.toFixed(2) : '-'}</span></div>
            <div class="tooltip-row"><span>Sinyal:</span> ${signalText}</div>
        `;

        tooltip.style.display = 'block';
        tooltip.style.left = `${screenX + 15}px`;
        tooltip.style.top = `${screenY - 20}px`;
    }

    hideTooltip() {
        const tooltip = document.getElementById('chartTooltip');
        if (tooltip) tooltip.style.display = 'none';
    }

    renderCharts() {
        if (!this.displayData) return;

        this.renderMainChart();
        this.renderRsiChart();
    }

    renderMainChart() {
        const canvas = this.mainCanvas;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const container = canvas.parentElement;

        const width = container.clientWidth;
        const height = 420;
        canvas.width = width;
        canvas.height = height;

        ctx.clearRect(0, 0, width, height);

        const candles = this.displayData.candles;
        const ema50 = this.displayData.ema50;
        const ema200 = this.displayData.ema200;
        const signals = this.displayData.signals;

        const paddingLeft = 15;
        const paddingRight = 65;
        const paddingTop = 25;
        const paddingBottom = 25;

        const chartWidth = width - paddingLeft - paddingRight;
        const chartHeight = height - paddingTop - paddingBottom;

        let minPrice = Infinity;
        let maxPrice = -Infinity;

        candles.forEach((c, idx) => {
            if (c.low < minPrice) minPrice = c.low;
            if (c.high > maxPrice) maxPrice = c.high;
            if (ema50[idx] !== null && ema50[idx] < minPrice) minPrice = ema50[idx];
            if (ema50[idx] !== null && ema50[idx] > maxPrice) maxPrice = ema50[idx];
            if (ema200[idx] !== null && ema200[idx] < minPrice) minPrice = ema200[idx];
            if (ema200[idx] !== null && ema200[idx] > maxPrice) maxPrice = ema200[idx];
        });

        const priceMargin = (maxPrice - minPrice) * 0.04 || 1;
        minPrice -= priceMargin;
        maxPrice += priceMargin;

        const getX = (i) => paddingLeft + (i / (candles.length - 1)) * chartWidth;
        const getY = (price) => paddingTop + chartHeight - ((price - minPrice) / (maxPrice - minPrice)) * chartHeight;

        // Grid
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1;
        ctx.fillStyle = '#64748b';
        ctx.font = '11px Inter, sans-serif';

        const gridSteps = 5;
        for (let i = 0; i <= gridSteps; i++) {
            const p = minPrice + (i / gridSteps) * (maxPrice - minPrice);
            const y = getY(p);
            
            ctx.beginPath();
            ctx.moveTo(paddingLeft, y);
            ctx.lineTo(width - paddingRight, y);
            ctx.stroke();

            ctx.fillText(`$${p.toFixed(p > 1000 ? 0 : 2)}`, width - paddingRight + 8, y + 4);
        }

        // Candles
        const stepWidth = chartWidth / candles.length;
        const candleWidth = Math.max(stepWidth * 0.65, 2);

        candles.forEach((c, i) => {
            const x = getX(i);
            const openY = getY(c.open);
            const closeY = getY(c.close);
            const highY = getY(c.high);
            const lowY = getY(c.low);

            const isUp = c.close >= c.open;
            const color = isUp ? '#10b981' : '#ef4444';

            ctx.strokeStyle = color;
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(x, highY);
            ctx.lineTo(x, lowY);
            ctx.stroke();

            ctx.fillStyle = color;
            const bodyTop = Math.min(openY, closeY);
            const bodyHeight = Math.max(Math.abs(closeY - openY), 2);
            ctx.fillRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight);
        });

        // EMA Slow Line (Cyan Blue)
        this.drawLineSeries(ctx, candles.length, getX, getY, ema200, '#38bdf8', 2.5);

        // EMA Fast Line (Golden Amber)
        this.drawLineSeries(ctx, candles.length, getX, getY, ema50, '#fbbf24', 2.5);

        // Signal Markers
        signals.forEach((sig, i) => {
            if (!sig) return;
            const x = getX(i);

            if (sig.type === 'BUY_LONG') {
                const y = getY(candles[i].low) + 15;
                ctx.fillStyle = '#10b981';
                ctx.beginPath();
                ctx.moveTo(x, y - 10);
                ctx.lineTo(x - 7, y + 4);
                ctx.lineTo(x + 7, y + 4);
                ctx.closePath();
                ctx.fill();

                ctx.fillStyle = '#10b981';
                ctx.font = 'bold 10px Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('LONG (AL)', x, y + 16);
            } else if (sig.type === 'SELL_SHORT') {
                const y = getY(candles[i].high) - 15;
                ctx.fillStyle = '#f97316';
                ctx.beginPath();
                ctx.moveTo(x, y + 10);
                ctx.lineTo(x - 7, y - 4);
                ctx.lineTo(x + 7, y - 4);
                ctx.closePath();
                ctx.fill();

                ctx.fillStyle = '#f97316';
                ctx.font = 'bold 10px Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('SHORT (SAT)', x, y - 10);
            } else if (sig.type.startsWith('TP')) {
                const y = sig.type === 'TP_LONG' ? getY(candles[i].high) - 12 : getY(candles[i].low) + 12;
                ctx.fillStyle = '#34d399';
                ctx.beginPath();
                ctx.arc(x, y, 6, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = '#34d399';
                ctx.font = 'bold 10px Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('TP (ATR)', x, sig.type === 'TP_LONG' ? y - 10 : y + 14);
            } else if (sig.type.startsWith('SL')) {
                const y = sig.type === 'SL_LONG' ? getY(candles[i].low) + 12 : getY(candles[i].high) - 12;
                ctx.fillStyle = '#f87171';
                ctx.beginPath();
                ctx.arc(x, y, 6, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = '#f87171';
                ctx.font = 'bold 10px Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('SL (ATR)', x, sig.type === 'SL_LONG' ? y + 14 : y - 10);
            }
        });

        // Hover Crosshair
        if (this.hoverIndex !== null) {
            const hX = getX(this.hoverIndex);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(hX, paddingTop);
            ctx.lineTo(hX, height - paddingBottom);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }

    drawLineSeries(ctx, totalLength, getX, getY, series, color, lineWidth) {
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.beginPath();
        let started = false;

        for (let i = 0; i < totalLength; i++) {
            const val = series[i];
            if (val !== null && val !== undefined) {
                const x = getX(i);
                const y = getY(val);
                if (!started) {
                    ctx.moveTo(x, y);
                    started = true;
                } else {
                    ctx.lineTo(x, y);
                }
            }
        }
        ctx.stroke();
    }

    renderRsiChart() {
        const canvas = this.rsiCanvas;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const container = canvas.parentElement;

        const width = container.clientWidth;
        const height = 130;
        canvas.width = width;
        canvas.height = height;

        ctx.clearRect(0, 0, width, height);

        const rsi = this.displayData.rsi;
        const candles = this.displayData.candles;
        const params = this.displayData.params || {};

        const rBuy = params.rsiBuy || 30;
        const rSell = params.rsiSell || 70;

        const paddingLeft = 15;
        const paddingRight = 65;
        const paddingTop = 15;
        const paddingBottom = 15;

        const chartWidth = width - paddingLeft - paddingRight;
        const chartHeight = height - paddingTop - paddingBottom;

        const getX = (i) => paddingLeft + (i / (candles.length - 1)) * chartWidth;
        const getY = (val) => paddingTop + chartHeight - (val / 100) * chartHeight;

        const ySell = getY(rSell);
        const yBuy = getY(rBuy);

        ctx.fillStyle = 'rgba(249, 115, 22, 0.12)';
        ctx.fillRect(paddingLeft, paddingTop, chartWidth, ySell - paddingTop);

        ctx.fillStyle = 'rgba(16, 185, 129, 0.12)';
        ctx.fillRect(paddingLeft, yBuy, chartWidth, height - paddingBottom - yBuy);

        ctx.strokeStyle = '#f97316';
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(paddingLeft, ySell);
        ctx.lineTo(width - paddingRight, ySell);
        ctx.stroke();

        ctx.strokeStyle = '#10b981';
        ctx.beginPath();
        ctx.moveTo(paddingLeft, yBuy);
        ctx.lineTo(width - paddingRight, yBuy);
        ctx.stroke();

        ctx.setLineDash([]);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px Inter, sans-serif';
        ctx.fillText(`${rSell} (Short)`, width - paddingRight + 8, ySell + 3);
        ctx.fillText(`${rBuy} (Long)`, width - paddingRight + 8, yBuy + 3);

        this.drawLineSeries(ctx, candles.length, getX, getY, rsi, '#c084fc', 2);

        if (this.hoverIndex !== null) {
            const hX = getX(this.hoverIndex);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(hX, 0);
            ctx.lineTo(hX, height);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }

    initDemoUI() {
        this.demoEngine = window.binanceDemoEngine;

        this.demoBalanceText = document.getElementById('demoBalanceText');
        this.demoTotalReturnText = document.getElementById('demoTotalReturnText');
        this.autoTradeToggle = document.getElementById('autoTradeToggle');
        this.autoTradeStatusText = document.getElementById('autoTradeStatusText');
        this.resetWalletBtn = document.getElementById('resetWalletBtn');

        this.openTestnetModalBtn = document.getElementById('openTestnetModalBtn');
        this.closeTestnetModalBtn = document.getElementById('closeTestnetModalBtn');
        this.testnetModal = document.getElementById('testnetModal');
        this.saveTestnetKeysBtn = document.getElementById('saveTestnetKeysBtn');
        this.testnetApiKeyInput = document.getElementById('testnetApiKeyInput');
        this.testnetApiSecretInput = document.getElementById('testnetApiSecretInput');

        this.openTestLongBtn = document.getElementById('openTestLongBtn');
        this.openTestShortBtn = document.getElementById('openTestShortBtn');
        this.closePositionBtn = document.getElementById('closePositionBtn');

        this.activePositionCard = document.getElementById('activePositionCard');
        this.noPositionView = document.getElementById('noPositionView');
        this.hasPositionView = document.getElementById('hasPositionView');

        this.posBadge = document.getElementById('posBadge');
        this.posSymbol = document.getElementById('posSymbol');
        this.posEntryPrice = document.getElementById('posEntryPrice');
        this.posMarkPrice = document.getElementById('posMarkPrice');
        this.posMargin = document.getElementById('posMargin');
        this.posNotional = document.getElementById('posNotional');
        this.posPnlText = document.getElementById('posPnlText');
        this.posSlText = document.getElementById('posSlText');
        this.posTpText = document.getElementById('posTpText');
        this.posLiqText = document.getElementById('posLiqText');

        // Margin Type Segmented Buttons (ISOLATED/CROSSED)
        const marginBtns = document.querySelectorAll('.btn-seg-margin');
        marginBtns.forEach(btn => {
            if (btn.dataset.margin === this.demoEngine.marginType) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
            btn.addEventListener('click', () => {
                marginBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.demoEngine.setMarginType(btn.dataset.margin);
                this.updateDemoUI();
            });
        });

        // Leverage Segmented Buttons
        const levBtns = document.querySelectorAll('.btn-seg');
        levBtns.forEach(btn => {
            if (parseInt(btn.dataset.lev) === this.demoEngine.leverage) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
            btn.addEventListener('click', () => {
                levBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.demoEngine.setLeverage(parseInt(btn.dataset.lev));
                this.updateDemoUI();
            });
        });

        // Position Size Segmented Buttons
        const sizeBtns = document.querySelectorAll('.btn-seg-size');
        sizeBtns.forEach(btn => {
            if (parseFloat(btn.dataset.pct) === this.demoEngine.positionSizePct) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
            btn.addEventListener('click', () => {
                sizeBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.demoEngine.setPositionSizePercent(parseFloat(btn.dataset.pct));
                this.updateDemoUI();
            });
        });

        // Auto Trader Toggle
        if (this.autoTradeToggle) {
            this.autoTradeToggle.checked = this.demoEngine.isAutoTraderEnabled;
            this.autoTradeToggle.addEventListener('change', (e) => {
                const state = this.demoEngine.setAutoTrader(e.target.checked);
                if (this.autoTradeStatusText) {
                    this.autoTradeStatusText.innerText = state ? 'AÇIK (Otomatik Emirler Aktif)' : 'KAPALI (Sinyaller Beklemede)';
                    this.autoTradeStatusText.style.color = state ? 'var(--accent-emerald)' : 'var(--text-muted)';
                }
            });
        }

        if (this.resetWalletBtn) {
            this.resetWalletBtn.addEventListener('click', () => {
                if (confirm('Sanal demo cüzdanınızı $10,000 USDT seviyesine sıfırlamak istediğinize emin misiniz?')) {
                    this.demoEngine.resetWallet();
                    this.updateDemoUI();
                }
            });
        }

        // Custom SL & TP Input Elements
        this.customSlInput = document.getElementById('customSlInput');
        this.customTpInput = document.getElementById('customTpInput');

        // Manual Test Positions
        if (this.openTestLongBtn) {
            this.openTestLongBtn.addEventListener('click', () => {
                if (this.displayData && this.displayData.candles.length > 0) {
                    const last = this.displayData.candles[this.displayData.candles.length - 1];
                    const atr = this.displayData.atr[this.displayData.atr.length - 1] || (last.close * 0.015);
                    
                    let sl = this.customSlInput && this.customSlInput.value ? parseFloat(this.customSlInput.value) : (last.close - (atr * 2.0));
                    let tp = this.customTpInput && this.customTpInput.value ? parseFloat(this.customTpInput.value) : (last.close + (atr * 4.0));

                    this.demoEngine.openPosition(this.displayData.symbol, 'LONG', last.close, sl, tp);
                    this.updateDemoUI();
                }
            });
        }

        if (this.openTestShortBtn) {
            this.openTestShortBtn.addEventListener('click', () => {
                if (this.displayData && this.displayData.candles.length > 0) {
                    const last = this.displayData.candles[this.displayData.candles.length - 1];
                    const atr = this.displayData.atr[this.displayData.atr.length - 1] || (last.close * 0.015);
                    
                    let sl = this.customSlInput && this.customSlInput.value ? parseFloat(this.customSlInput.value) : (last.close + (atr * 2.0));
                    let tp = this.customTpInput && this.customTpInput.value ? parseFloat(this.customTpInput.value) : (last.close - (atr * 4.0));

                    this.demoEngine.openPosition(this.displayData.symbol, 'SHORT', last.close, sl, tp);
                    this.updateDemoUI();
                }
            });
        }

        if (this.closePositionBtn) {
            this.closePositionBtn.addEventListener('click', () => {
                if (this.displayData && this.displayData.candles.length > 0) {
                    const last = this.displayData.candles[this.displayData.candles.length - 1];
                    this.demoEngine.closeCurrentPosition(last.close, 'MANUEL');
                    this.updateDemoUI();
                }
            });
        }

        // Testnet Modal
        const closeTestnetModal = () => {
            if (this.testnetModal) {
                this.testnetModal.style.display = 'none';
                this.testnetModal.classList.remove('active');
            }
        };

        if (this.openTestnetModalBtn) {
            this.openTestnetModalBtn.addEventListener('click', () => {
                if (this.testnetModal) {
                    this.testnetModal.style.display = 'flex';
                    this.testnetModal.classList.add('active');
                }
                if (this.testnetApiKeyInput) this.testnetApiKeyInput.value = this.demoEngine.testnetApiKey;
                if (this.testnetApiSecretInput) this.testnetApiSecretInput.value = this.demoEngine.testnetApiSecret;
            });
        }

        if (this.closeTestnetModalBtn) {
            this.closeTestnetModalBtn.addEventListener('click', closeTestnetModal);
        }

        if (this.saveTestnetKeysBtn) {
            this.saveTestnetKeysBtn.addEventListener('click', () => {
                const keyVal = this.testnetApiKeyInput ? this.testnetApiKeyInput.value.trim() : '';
                const secretVal = this.testnetApiSecretInput ? this.testnetApiSecretInput.value.trim() : '';

                this.demoEngine.testnetApiKey = keyVal;
                this.demoEngine.testnetApiSecret = secretVal;
                this.demoEngine.useTestnetApi = !!(keyVal && secretVal);
                this.demoEngine.saveState();

                closeTestnetModal();

                if (this.demoEngine.useTestnetApi) {
                    this.demoEngine.syncTestnetAll();
                }
                this.updateDemoUI();
            });
        }

        if (this.testnetModal) {
            this.testnetModal.addEventListener('click', (e) => {
                if (e.target === this.testnetModal) {
                    closeTestnetModal();
                }
            });
        }

        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeTestnetModal();
                if (this.modal) this.modal.style.display = 'none';
            }
        });

        this.updateDemoUI();
    }

    checkAutoTraderSignals(lastCandle) {
        if (!this.demoEngine || !this.demoEngine.isAutoTraderEnabled || !this.displayData) return;
        if (this.demoEngine.currentPosition) return; // Position already open

        const status = this.displayData.currentStatus;
        if (!status || status.type === 'NEUTRAL') return;

        const atr = this.displayData.atr[this.displayData.atr.length - 1] || (lastCandle.close * 0.015);
        let sl = null;
        let tp = null;

        if (status.type === 'BUY') {
            sl = lastCandle.close - (atr * 2.0);
            tp = lastCandle.close + (atr * 4.0);
            this.demoEngine.openPosition(this.displayData.symbol, 'LONG', lastCandle.close, sl, tp);
        } else if (status.type === 'SELL') {
            sl = lastCandle.close + (atr * 2.0);
            tp = lastCandle.close - (atr * 4.0);
            this.demoEngine.openPosition(this.displayData.symbol, 'SHORT', lastCandle.close, sl, tp);
        }

        this.updateDemoUI();
    }

    updateDemoUI(currentPrice = null) {
        if (!this.demoEngine) return;

        if (currentPrice) {
            this.demoEngine.onPriceTick(currentPrice);
        }

        const metrics = this.demoEngine.getMetrics();

        if (this.demoBalanceText) {
            this.demoBalanceText.innerText = `$${metrics.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`;
        }

        if (this.demoTotalReturnText) {
            const relPnl = metrics.totalRealizedPnl;
            const retPct = metrics.totalReturnPct;
            this.demoTotalReturnText.innerText = `Gerçekleşmiş Kâr: ${relPnl >= 0 ? '+' : ''}$${relPnl.toFixed(2)} (${retPct >= 0 ? '+' : ''}${retPct.toFixed(2)}%)`;
            this.demoTotalReturnText.className = `demo-stat-sub ${relPnl >= 0 ? 'text-success' : 'text-danger'}`;
        }

        const activePositions = this.demoEngine.activePositions || [];

        if (this.tabPosBadge) {
            if (activePositions.length > 0) {
                this.tabPosBadge.innerText = `${activePositions.length}/${this.demoEngine.maxPositions} Açık Pozisyon`;
                this.tabPosBadge.style.display = 'inline-block';
            } else {
                this.tabPosBadge.style.display = 'none';
            }
        }

        if (activePositions.length === 0) {
            if (this.noPositionView) this.noPositionView.style.display = 'flex';
            if (this.hasPositionView) this.hasPositionView.style.display = 'none';
        } else {
            if (this.noPositionView) this.noPositionView.style.display = 'none';
            if (this.hasPositionView) {
                this.hasPositionView.style.display = 'block';

                const firstPos = activePositions[0];
                if (this.posBadge) {
                    this.posBadge.innerText = `${firstPos.direction} ${firstPos.leverage}x (${activePositions.length}/${this.demoEngine.maxPositions})`;
                    this.posBadge.className = `status-pill ${firstPos.direction === 'LONG' ? 'buy' : 'sell'}`;
                }

                if (this.posSymbol) this.posSymbol.innerText = firstPos.symbol;
                if (this.posEntryPrice) this.posEntryPrice.innerText = `$${firstPos.entryPrice.toFixed(2)}`;
                
                const livePx = currentPrice || firstPos.entryPrice;
                if (this.posMarkPrice) this.posMarkPrice.innerText = `$${livePx.toFixed(2)}`;

                if (this.posMargin) this.posMargin.innerText = `$${firstPos.margin.toFixed(2)} USDT`;
                if (this.posNotional) this.posNotional.innerText = `$${firstPos.notionalValue.toFixed(2)} USDT`;

                if (this.posPnlText) {
                    this.posPnlText.innerText = `${firstPos.unrealizedPnl >= 0 ? '+' : ''}$${firstPos.unrealizedPnl.toFixed(2)} (${firstPos.unrealizedPnlPct >= 0 ? '+' : ''}${firstPos.unrealizedPnlPct.toFixed(2)}%)`;
                    this.posPnlText.className = `pos-val ${firstPos.unrealizedPnl >= 0 ? 'text-success' : 'text-danger'}`;
                }

                if (this.posSlText) this.posSlText.innerText = firstPos.slPrice ? `$${firstPos.slPrice.toFixed(2)}` : '-';
                if (this.posTpText) this.posTpText.innerText = firstPos.tpPrice ? `$${firstPos.tpPrice.toFixed(2)}` : '-';
                if (this.posLiqText) this.posLiqText.innerText = `$${firstPos.liqPrice.toFixed(2)}`;
            }

            // Render Live Binance Open SL/TP Orders
            const openOrdersBadge = document.getElementById('openOrdersBadge');
            const openOrdersList = document.getElementById('openOrdersList');
            const orders = this.demoEngine.openOrders || [];

            if (openOrdersBadge) {
                openOrdersBadge.innerText = `${orders.length} Bekleyen Emir`;
            }

            if (openOrdersList) {
                if (orders.length === 0) {
                    openOrdersList.innerHTML = `<div class="text-muted" style="font-size:0.82rem;">Binance borsasında bekleyen aktif emriniz bulunmuyor.</div>`;
                } else {
                    let html = `<div style="display:flex; flex-direction:column; gap:6px;">`;
                    orders.forEach(o => {
                        const isSl = o.type === 'STOP_MARKET';
                        const badgeClass = isSl ? 'status-pill sell' : 'status-pill buy';
                        const typeLabel = isSl ? '🛡️ STOP LOSS (Borsa Emri)' : '🎯 TAKE PROFIT (Borsa Emri)';
                        html += `
                            <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.25); padding:8px 12px; border-radius:6px;">
                                <div style="display:flex; align-items:center; gap:8px;">
                                    <span class="${badgeClass}" style="font-size:0.7rem;">${o.symbol} ${o.side}</span>
                                    <span style="font-weight:600; font-size:0.85rem;">${typeLabel}</span>
                                </div>
                                <div style="font-weight:700; color:${isSl ? 'var(--accent-rose)' : 'var(--accent-emerald)'}; font-size:0.9rem;">
                                    Tetiklenme Fiyatı: $${parseFloat(o.stopPrice || o.price).toFixed(2)}
                                </div>
                            </div>
                        `;
                    });
                    html += `</div>`;
                    openOrdersList.innerHTML = html;
                }
            }
        }
    }

    initScannerUI() {
        if (!window.binanceScannerService) return;

        this.multiAutoTradeToggle = document.getElementById('multiAutoTradeToggle');
        this.scannerSearchInput = document.getElementById('scannerSearchInput');
        this.scannerSortSelect = document.getElementById('scannerSortSelect');
        this.scannerFilterBtns = document.querySelectorAll('.btn-scanner-filter');
        this.scannerTableBody = document.getElementById('scannerTableBody');

        if (this.multiAutoTradeToggle) {
            this.multiAutoTradeToggle.checked = window.binanceScannerService.multiAutoTradeEnabled;
            this.multiAutoTradeToggle.addEventListener('change', (e) => {
                window.binanceScannerService.setMultiAutoTrade(e.target.checked);
            });
        }

        if (this.scannerSearchInput) {
            this.scannerSearchInput.addEventListener('input', (e) => {
                window.binanceScannerService.searchQuery = e.target.value.trim();
                this.renderScannerTable(window.binanceScannerService.getFilteredSymbols());
            });
        }

        if (this.scannerSortSelect) {
            this.scannerSortSelect.addEventListener('change', (e) => {
                window.binanceScannerService.sortBy = e.target.value;
                this.renderScannerTable(window.binanceScannerService.getFilteredSymbols());
            });
        }

        this.scannerFilterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.scannerFilterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                window.binanceScannerService.activeFilter = btn.dataset.filter || 'ALL';
                this.renderScannerTable(window.binanceScannerService.getFilteredSymbols());
            });
        });

        // Subscribe to live scanner updates
        window.binanceScannerService.subscribe(symbols => {
            this.renderScannerTable(symbols);
        });

        window.binanceScannerService.startScanning();
    }

    renderScannerTable(symbols) {
        if (!this.scannerTableBody) return;

        if (!symbols || symbols.length === 0) {
            this.scannerTableBody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center text-muted" style="padding: 32px;">Aranan kriterlere uygun koin bulunamadı.</td>
                </tr>
            `;
            return;
        }

        let html = '';
        symbols.forEach(s => {
            const isPos = s.change24h >= 0;
            const chgText = `${isPos ? '+' : ''}${s.change24h.toFixed(2)}%`;
            const chgClass = isPos ? 'text-success' : 'text-danger';
            const volText = `$${(s.volume24h / 1000000).toFixed(1)}M`;

            let rsiClass = 'text-muted';
            if (s.rsi < 35) rsiClass = 'text-success font-bold';
            if (s.rsi > 65) rsiClass = 'text-danger font-bold';

            let sigBadge = `<span class="status-pill neutral" style="font-size:0.75rem;">BEKLEMEDE</span>`;
            if (s.signal === 'BUY_LONG') {
                sigBadge = `<span class="status-pill buy" style="font-size:0.75rem;">🟢 LONG ALIM</span>`;
            } else if (s.signal === 'SELL_SHORT') {
                sigBadge = `<span class="status-pill sell" style="font-size:0.75rem;">🔴 SHORT SATIM</span>`;
            }

            html += `
                <tr>
                    <td><strong style="color:#fff;">${s.symbol}</strong></td>
                    <td>$${s.price.toFixed(s.price < 1 ? 4 : 2)}</td>
                    <td class="${chgClass} font-bold">${chgText}</td>
                    <td>${volText}</td>
                    <td>${s.isEmaBullish ? '<span class="text-success">EMA Yükseliş</span>' : '<span class="text-danger">EMA Düşüş</span>'}</td>
                    <td class="${rsiClass}">${s.rsi}</td>
                    <td>${sigBadge}</td>
                    <td>
                        <button class="btn btn-outline-sm btn-select-symbol" data-symbol="${s.symbol}" style="font-size:0.78rem; padding:4px 10px;">
                            ⚡ Analiz Et
                        </button>
                    </td>
                </tr>
            `;
        });

        this.scannerTableBody.innerHTML = html;

        // Attach click listeners for "Analiz Et" button
        const selectBtns = this.scannerTableBody.querySelectorAll('.btn-select-symbol');
        selectBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const sym = btn.dataset.symbol;
                if (sym) {
                    this.currentSymbol = sym;
                    if (this.symbolInput) this.symbolInput.value = sym;
                    this.loadData();
                    // Switch to Signal Desk tab
                    if (this.tabSignalBtn) this.tabSignalBtn.click();
                }
            });
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
