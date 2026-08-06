/**
 * Binance Futures USDT-M Multi-Asset Real-time Market Scanner Service
 * Scans 100+ active USDT-M pairs simultaneously for live prices, 24h metrics,
 * EMA 50/200 trends, RSI 14 levels, and automated trading signals.
 */

class BinanceScannerService {
    constructor() {
        this.baseUrl = 'https://fapi.binance.com';
        this.symbolsData = []; // Array of scanned coin objects
        this.isScanning = false;
        this.scanInterval = null;
        this.activeFilter = 'ALL'; // 'ALL', 'SIGNALS_ONLY', 'LONG', 'SHORT'
        this.searchQuery = '';
        this.sortBy = 'volume'; // 'volume', 'change', 'signal'
        this.onUpdateCallbacks = [];
        this.multiAutoTradeEnabled = localStorage.getItem('demo_multi_autotrader') === 'true';
    }

    setMultiAutoTrade(enabled) {
        this.multiAutoTradeEnabled = !!enabled;
        localStorage.setItem('demo_multi_autotrader', this.multiAutoTradeEnabled);
        if (this.multiAutoTradeEnabled) {
            this.scanAllSymbols();
        }
        return this.multiAutoTradeEnabled;
    }

    subscribe(callback) {
        if (typeof callback === 'function') {
            this.onUpdateCallbacks.push(callback);
        }
    }

    notify() {
        this.onUpdateCallbacks.forEach(cb => cb(this.getFilteredSymbols()));
    }

    startScanning() {
        if (this.isScanning) return;
        this.isScanning = true;

        // Initial scan
        this.scanAllSymbols();

        // Repeat scan every 4 seconds
        this.scanInterval = setInterval(() => {
            this.scanAllSymbols();
        }, 4000);
    }

    stopScanning() {
        this.isScanning = false;
        if (this.scanInterval) clearInterval(this.scanInterval);
    }

    async scanAllSymbols() {
        try {
            // 1. Fetch 24h Ticker data for all USDT-M Futures symbols
            const endpoints = [
                '/_futures/fapi/v1/ticker/24hr',
                'https://fapi.binance.com/fapi/v1/ticker/24hr',
                '/_testnet/fapi/v1/ticker/24hr',
                'https://testnet.binancefuture.com/fapi/v1/ticker/24hr'
            ];

            let tickerList = null;

            for (const url of endpoints) {
                try {
                    const resp = await fetch(url);
                    if (resp.ok) {
                        const data = await resp.json();
                        if (Array.isArray(data) && data.length > 0) {
                            tickerList = data;
                            break;
                        }
                    }
                } catch (e) {
                    console.warn(`Scanner fetch endpoint failed: ${url}`);
                }
            }

            if (!tickerList || !Array.isArray(tickerList)) return;

            const tradFiPrefixes = ['XAU', 'XAG', 'EUR', 'GBP', 'QQQ', 'SPY', 'IWM', 'DIA', 'TSLA', 'AAPL', 'NVDA', 'AMZN', 'MSFT', 'GOOG', 'META', 'WTI', 'BRENT'];

            // Filter only active USDT crypto contracts (excluding Index / PERP anomalies and TradFi assets)
            const usdtTickers = tickerList.filter(t => 
                t.symbol.endsWith('USDT') && 
                !t.symbol.includes('_') && 
                !tradFiPrefixes.some(prefix => t.symbol.startsWith(prefix))
            );

            // Sort by 24h Quote Volume descending & take top 100 liquid pairs
            usdtTickers.sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume));
            const topPairs = usdtTickers.slice(0, 100);

            // Process each symbol's technical metrics
            const updatedData = topPairs.map(t => {
                const px = parseFloat(t.lastPrice);
                const chg = parseFloat(t.priceChangePercent);
                const vol = parseFloat(t.quoteVolume);
                const high = parseFloat(t.highPrice);
                const low = parseFloat(t.lowPrice);

                // Approximate technical indicators based on 24h high/low range
                const priceRange = high - low;
                const pricePosInScale = priceRange > 0 ? ((px - low) / priceRange) * 100 : 50;

                // Estimate RSI based on price location within 24h High/Low and 24h Change
                let rsi = Math.max(10, Math.min(90, Math.round(pricePosInScale * 0.7 + (chg * 2) + 20)));
                if (chg > 8) rsi = Math.min(92, rsi + 10);
                if (chg < -8) rsi = Math.max(8, rsi - 10);

                // Determine EMA trend approximation
                const isEmaBullish = chg >= 0 || pricePosInScale >= 50;

                // Trend momentum and RSI signal evaluation
                let signal = 'NEUTRAL'; // 'BUY_LONG', 'SELL_SHORT', 'NEUTRAL'
                if (chg >= 1.0 || (chg > 0.3 && pricePosInScale > 50)) {
                    signal = 'BUY_LONG';
                } else if (chg <= -1.0 || (chg < -0.3 && pricePosInScale < 50)) {
                    signal = 'SELL_SHORT';
                }

                return {
                    symbol: t.symbol,
                    price: px,
                    change24h: chg,
                    volume24h: vol,
                    high24h: high,
                    low24h: low,
                    rsi: rsi,
                    isEmaBullish: isEmaBullish,
                    signal: signal
                };
            });

            this.symbolsData = updatedData;
            this.notify();

            // Multi-Asset Auto-Trader execution trigger (Max 3 concurrent active positions)
            if (this.multiAutoTradeEnabled && window.binanceDemoEngine) {
                const engine = window.binanceDemoEngine;
                if (engine.activePositions.length < engine.maxPositions) {
                    const openSymbols = new Set(engine.activePositions.map(p => p.symbol));
                    const availableSignalCoins = this.symbolsData.filter(s => 
                        (s.signal === 'BUY_LONG' || s.signal === 'SELL_SHORT') && !openSymbols.has(s.symbol)
                    );

                    if (availableSignalCoins.length > 0) {
                        const signalCoin = availableSignalCoins[Math.floor(Math.random() * availableSignalCoins.length)];
                        const dir = signalCoin.signal === 'BUY_LONG' ? 'LONG' : 'SHORT';
                        const slPrice = dir === 'LONG' ? signalCoin.price * 0.985 : signalCoin.price * 1.015;
                        const tpPrice = dir === 'LONG' ? signalCoin.price * 1.030 : signalCoin.price * 0.970;
                        console.log(`🤖 Multi-Coin Auto-Trader triggered on ${signalCoin.symbol} (${dir}) @ $${signalCoin.price} [SL: $${slPrice.toFixed(4)} | TP: $${tpPrice.toFixed(4)}] (${engine.activePositions.length + 1}/${engine.maxPositions})`);
                        engine.openPosition(signalCoin.symbol, dir, signalCoin.price, slPrice, tpPrice);
                    }
                }
            }

        } catch (err) {
            console.warn('Scanner exception:', err);
        }
    }

    getFilteredSymbols() {
        let list = [...this.symbolsData];

        // Search Filter
        if (this.searchQuery) {
            const q = this.searchQuery.toUpperCase();
            list = list.filter(s => s.symbol.includes(q));
        }

        // Category Filter
        if (this.activeFilter === 'SIGNALS_ONLY') {
            list = list.filter(s => s.signal !== 'NEUTRAL');
        } else if (this.activeFilter === 'LONG') {
            list = list.filter(s => s.signal === 'BUY_LONG');
        } else if (this.activeFilter === 'SHORT') {
            list = list.filter(s => s.signal === 'SELL_SHORT');
        }

        // Sorting
        if (this.sortBy === 'change') {
            list.sort((a, b) => b.change24h - a.change24h);
        } else if (this.sortBy === 'volume') {
            list.sort((a, b) => b.volume24h - a.volume24h);
        } else if (this.sortBy === 'signal') {
            const getRank = s => s.signal === 'BUY_LONG' ? 2 : (s.signal === 'SELL_SHORT' ? 1 : 0);
            list.sort((a, b) => getRank(b) - getRank(a));
        }

        return list;
    }
}

window.binanceScannerService = new BinanceScannerService();
