/**
 * Binance USDT-M Futures 100% Live Market Data Service
 * Quad-Tier Pipeline: Local Futures Proxy -> Direct Binance Futures API -> Edge CDN -> Spot Fallback
 */

class BinanceFuturesDataService {
    constructor() {
        this.symbolsSet = new Set();
        this.initSymbols();
    }

    /**
     * Pre-fetch all valid Binance USDT-M Futures contracts into a Set
     */
    async initSymbols() {
        const endpoints = [
            '/_futures/fapi/v1/ticker/price',
            'https://fapi.binance.com/fapi/v1/ticker/price',
            '/_spot/api/v3/ticker/price',
            'https://api.binance.com/api/v3/ticker/price'
        ];

        for (const url of endpoints) {
            try {
                const resp = await fetch(url);
                if (resp.ok) {
                    const data = await resp.json();
                    if (Array.isArray(data)) {
                        data.forEach(item => this.symbolsSet.add(item.symbol));
                        console.log(`BinanceFuturesDataService: Loaded ${this.symbolsSet.size} pairs from ${url}`);
                        return;
                    }
                }
            } catch (e) {
                console.warn(`Could not fetch ticker list from ${url}:`, e);
            }
        }
    }

    /**
     * Smart Futures Symbol Resolver
     * Maps user inputs (e.g. btc, xauusdt, xau, gold, pepe, shib, avax, sui) to valid Binance Futures contracts
     */
    formatSymbol(symbol) {
        if (!symbol) return 'BTCUSDT';
        const raw = symbol.trim().toUpperCase();

        if (raw.includes('XAU') || raw.includes('GOLD') || raw.includes('ALTIN') || raw.includes('PAXG') || raw === 'GC=F' || raw === 'GC') {
            return 'XAUUSDT';
        }

        const clean = raw.replace('/', '').replace('-', '').replace('=F', '');

        if (this.symbolsSet.size > 0) {
            if (this.symbolsSet.has(clean)) {
                return clean;
            }

            const base = clean.replace('USDT', '').replace('USD', '');

            if (this.symbolsSet.has(base + 'USDT')) return base + 'USDT';
            if (this.symbolsSet.has('1000' + base + 'USDT')) return '1000' + base + 'USDT';

            for (const sym of this.symbolsSet) {
                if (sym.startsWith(base) && sym.endsWith('USDT')) {
                    return sym;
                }
            }
        }

        if (clean.endsWith('USD') && !clean.endsWith('USDT')) {
            return clean.slice(0, -3) + 'USDT';
        }

        if (!clean.endsWith('USDT')) {
            return clean + 'USDT';
        }

        return clean;
    }

    /**
     * Fetch 100% real live market candles from Binance Futures API for 15m, 1h, 4h, 1d
     */
    async fetchChartData(symbol = 'BTCUSDT', interval = '1h') {
        if (this.symbolsSet.size === 0) {
            await this.initSymbols();
        }

        const binanceSymbol = this.formatSymbol(symbol);

        let binanceInterval = '1h';
        if (interval === '15m') binanceInterval = '15m';
        else if (interval === '1h') binanceInterval = '1h';
        else if (interval === '4h') binanceInterval = '4h';
        else if (interval === '1d') binanceInterval = '1d';

        let spotFallbackSymbol = binanceSymbol;
        if (binanceSymbol === 'XAUUSDT') spotFallbackSymbol = 'PAXGUSDT';
        else if (binanceSymbol.startsWith('1000')) spotFallbackSymbol = binanceSymbol.replace('1000', '');

        // Prioritize Binance Futures API endpoints first!
        const endpoints = [
            { url: `/_futures/fapi/v1/klines?symbol=${binanceSymbol}&interval=${binanceInterval}&limit=1000`, provider: `Binance Futures (${binanceInterval} Live)` },
            { url: `https://fapi.binance.com/fapi/v1/klines?symbol=${binanceSymbol}&interval=${binanceInterval}&limit=1000`, provider: `Binance Futures Direct (${binanceInterval} Live)` },
            { url: `/_spot/api/v3/klines?symbol=${spotFallbackSymbol}&interval=${binanceInterval}&limit=1000`, provider: `Binance Spot (${binanceInterval} Live)` },
            { url: `https://api.binance.com/api/v3/klines?symbol=${spotFallbackSymbol}&interval=${binanceInterval}&limit=1000`, provider: `Binance Spot Direct (${binanceInterval} Live)` }
        ];

        let klines = null;
        let activeProvider = `Binance Futures (${binanceInterval} Live)`;

        for (const ep of endpoints) {
            try {
                const response = await fetch(ep.url);
                if (response.ok) {
                    const data = await response.json();
                    if (Array.isArray(data) && data.length > 0) {
                        klines = data;
                        activeProvider = ep.provider;
                        break;
                    }
                }
            } catch (err) {
                console.warn(`Fetch failed for ${ep.url}:`, err);
            }
        }

        if (!klines || !Array.isArray(klines) || klines.length === 0) {
            throw new Error(`"${symbol.toUpperCase()}" (Futures: ${binanceSymbol}) Binance borsasında bulunamadı veya bağlantı kurulamadı! Lütfen internet bağlantınızı kontrol ediniz.`);
        }

        const candles = klines.map(k => ({
            time: k[0],
            date: new Date(k[0]),
            open: parseFloat(k[1]),
            high: parseFloat(k[2]),
            low: parseFloat(k[3]),
            close: parseFloat(k[4]),
            volume: parseFloat(k[5])
        }));

        const lastPrice = candles[candles.length - 1].close;

        return {
            symbol: binanceSymbol,
            currency: 'USDT',
            regularMarketPrice: lastPrice,
            candles: candles,
            isSimulated: false,
            provider: activeProvider
        };
    }
}

window.yahooFinanceService = new BinanceFuturesDataService();
