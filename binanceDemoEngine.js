/**
 * Binance Futures Pro 1:1 Live Terminal Engine
 * Synchronizes 100% real live positions, open SL/TP orders, and account balance directly from Binance Futures Testnet API.
 */

class BinanceDemoEngine {
    constructor() {
        this.initialBalance = 10000.00;
        this.balance = parseFloat(localStorage.getItem('demo_balance')) || this.initialBalance;
        this.leverage = parseInt(localStorage.getItem('demo_leverage')) || 10;
        this.marginType = localStorage.getItem('demo_margin_type') || 'ISOLATED';
        this.positionSizePct = parseFloat(localStorage.getItem('demo_position_size_pct')) || 10;
        this.maxPositions = 3;
        this.isAutoTraderEnabled = localStorage.getItem('demo_autotrader') === 'true';

        this.activePositions = JSON.parse(localStorage.getItem('demo_active_positions')) || [];
        // Legacy single position fallback
        if (this.activePositions.length === 0) {
            const legacyPos = JSON.parse(localStorage.getItem('demo_current_position'));
            if (legacyPos) this.activePositions.push(legacyPos);
        }

        this.openOrders = [];
        this.closedTrades = JSON.parse(localStorage.getItem('demo_closed_trades')) || [];

        // API Key Integration
        this.testnetApiKey = localStorage.getItem('demo_testnet_api_key') || '';
        this.testnetApiSecret = localStorage.getItem('demo_testnet_api_secret') || '';
        this.useTestnetApi = localStorage.getItem('demo_use_testnet_api') === 'true';

        this.startSyncLoop();
    }

    get currentPosition() {
        return this.activePositions.length > 0 ? this.activePositions[0] : null;
    }

    set currentPosition(val) {
        if (!val) {
            this.activePositions = [];
        } else {
            const idx = this.activePositions.findIndex(p => p.symbol === val.symbol);
            if (idx >= 0) this.activePositions[idx] = val;
            else this.activePositions.push(val);
        }
    }

    startSyncLoop() {
        if (this.syncInterval) clearInterval(this.syncInterval);
        this.syncInterval = setInterval(() => {
            if (this.useTestnetApi && this.testnetApiKey && this.testnetApiSecret) {
                this.syncTestnetAll();
            }
        }, 3000);
    }

    saveState() {
        localStorage.setItem('demo_balance', this.balance.toFixed(2));
        localStorage.setItem('demo_leverage', this.leverage);
        localStorage.setItem('demo_margin_type', this.marginType);
        localStorage.setItem('demo_position_size_pct', this.positionSizePct);
        localStorage.setItem('demo_autotrader', this.isAutoTraderEnabled);
        localStorage.setItem('demo_active_positions', JSON.stringify(this.activePositions));
        localStorage.setItem('demo_current_position', JSON.stringify(this.currentPosition));
        localStorage.setItem('demo_closed_trades', JSON.stringify(this.closedTrades));
        localStorage.setItem('demo_testnet_api_key', this.testnetApiKey);
        localStorage.setItem('demo_testnet_api_secret', this.testnetApiSecret);
        localStorage.setItem('demo_use_testnet_api', this.useTestnetApi);
    }

    setLeverage(lev) {
        this.leverage = Math.max(1, Math.min(100, lev));
        this.saveState();
        return this.leverage;
    }

    setMarginType(mType) {
        this.marginType = (mType === 'CROSSED' || mType === 'CROSS') ? 'CROSSED' : 'ISOLATED';
        this.saveState();
        return this.marginType;
    }

    setPositionSizePercent(pct) {
        this.positionSizePct = Math.max(5, Math.min(50, pct));
        this.saveState();
        return this.positionSizePct;
    }

    setAutoTrader(enabled) {
        this.isAutoTraderEnabled = !!enabled;
        this.saveState();
        return this.isAutoTraderEnabled;
    }

    resetWallet() {
        this.balance = this.initialBalance;
        this.activePositions = [];
        this.openOrders = [];
        this.closedTrades = [];
        this.saveState();
    }

    /**
     * Auto-correct & normalize symbol strings for Binance Futures API
     */
    normalizeSymbol(symbol) {
        if (!symbol) return 'BTCUSDT';
        let clean = symbol.trim().toUpperCase().replace('/', '').replace('-', '');
        if (clean === 'PEPE') clean = '1000PEPEUSDT';
        else if (!clean.endsWith('USDT') && !clean.endsWith('BUSD')) clean += 'USDT';
        return clean;
    }

    calculateLiquidationPrice(entryPrice, direction, leverage) {
        const maintenanceMargin = 0.005;
        if (direction === 'LONG') {
            return entryPrice * (1 - (1 / leverage) + maintenanceMargin);
        } else {
            return entryPrice * (1 + (1 / leverage) - maintenanceMargin);
        }
    }

    /**
     * Format price precision & tickSize strictly for Binance Futures API
     */
    formatPricePrecision(symbol, price) {
        const p = parseFloat(price);
        if (isNaN(p)) return '0.00';

        if (symbol.includes('BTC')) return p.toFixed(1);
        if (symbol.includes('ETH')) return p.toFixed(2);
        if (symbol.includes('SOL')) return p.toFixed(2);
        if (symbol.includes('XAU')) return p.toFixed(2);

        if (p >= 1000) return p.toFixed(2);
        if (p >= 10) return p.toFixed(3);
        if (p >= 1) return p.toFixed(4);
        if (p >= 0.01) return p.toFixed(5);
        if (p >= 0.0001) return p.toFixed(6);
        return p.toFixed(8);
    }

    /**
     * Binance Testnet: Change Leverage (POST /fapi/v1/leverage)
     */
    async setBinanceLeverage(symbol, leverage) {
        if (!this.testnetApiKey || !this.testnetApiSecret || typeof CryptoJS === 'undefined') return null;

        try {
            const timestamp = Date.now();
            const params = `symbol=${symbol}&leverage=${leverage}&recvWindow=10000&timestamp=${timestamp}`;
            const signature = CryptoJS.HmacSHA256(params, this.testnetApiSecret).toString(CryptoJS.enc.Hex);

            const endpoints = [
                `/_testnet/fapi/v1/leverage?${params}&signature=${signature}`,
                `https://testnet.binancefuture.com/fapi/v1/leverage?${params}&signature=${signature}`
            ];

            for (const url of endpoints) {
                try {
                    const resp = await fetch(url, {
                        method: 'POST',
                        headers: { 'X-MBX-APIKEY': this.testnetApiKey }
                    });
                    if (resp.ok) {
                        const data = await resp.json();
                        console.log(`✅ Binance Testnet Leverage Updated (${symbol} -> ${leverage}x):`, data);
                        return data;
                    }
                } catch (e) {}
            }
        } catch (err) {
            console.error('Leverage exception:', err);
        }
        return null;
    }

    /**
     * Binance Testnet: Change Margin Type (POST /fapi/v1/marginType)
     */
    async setBinanceMarginType(symbol, marginType) {
        if (!this.testnetApiKey || !this.testnetApiSecret || typeof CryptoJS === 'undefined') return null;

        try {
            const timestamp = Date.now();
            const params = `symbol=${symbol}&marginType=${marginType}&recvWindow=10000&timestamp=${timestamp}`;
            const signature = CryptoJS.HmacSHA256(params, this.testnetApiSecret).toString(CryptoJS.enc.Hex);

            const endpoints = [
                `/_testnet/fapi/v1/marginType?${params}&signature=${signature}`,
                `https://testnet.binancefuture.com/fapi/v1/marginType?${params}&signature=${signature}`
            ];

            for (const url of endpoints) {
                try {
                    const resp = await fetch(url, {
                        method: 'POST',
                        headers: { 'X-MBX-APIKEY': this.testnetApiKey }
                    });
                    if (resp.ok) {
                        const data = await resp.json();
                        console.log(`✅ Binance Testnet Margin Type Updated (${symbol} -> ${marginType}):`, data);
                        return data;
                    }
                } catch (e) {}
            }
        } catch (err) {
            console.error('MarginType exception:', err);
        }
        return null;
    }

    /**
     * Binance Testnet: Place Stop Loss Order (STOP_MARKET)
     */
    async sendTestnetStopLossOrder(symbol, side, slPrice, quantity = null) {
        if (!this.testnetApiKey || !this.testnetApiSecret || typeof CryptoJS === 'undefined') return null;

        try {
            const timestamp = Date.now();
            const formattedSl = this.formatPricePrecision(symbol, slPrice);
            const params = `symbol=${symbol}&side=${side}&type=STOP_MARKET&stopPrice=${formattedSl}&closePosition=true&workingType=MARK_PRICE&recvWindow=10000&timestamp=${timestamp}`;
            const signature = CryptoJS.HmacSHA256(params, this.testnetApiSecret).toString(CryptoJS.enc.Hex);

            const endpoints = [
                `/_testnet/fapi/v1/order?${params}&signature=${signature}`,
                `https://testnet.binancefuture.com/fapi/v1/order?${params}&signature=${signature}`
            ];

            for (const url of endpoints) {
                try {
                    const resp = await fetch(url, {
                        method: 'POST',
                        headers: { 'X-MBX-APIKEY': this.testnetApiKey }
                    });
                    const resData = await resp.json();
                    if (resp.ok) {
                        console.log(`🛡️ Binance Testnet Stop Loss Placed (${symbol} ${side} @ $${formattedSl}):`, resData);
                        return resData;
                    } else {
                        console.warn(`[Binance Stop Loss closePosition skip ${resData.code}]: ${resData.msg}`);
                    }
                } catch (e) {
                    console.warn(`Stop Loss order failed for ${url}:`, e);
                }
            }

            // Fallback: If closePosition failed, retry with quantity & reduceOnly=true
            if (quantity && quantity > 0) {
                console.log(`🛡️ Retrying Stop Loss with reduceOnly=true for ${symbol}...`);
                const fbTimestamp = Date.now();
                const fbParams = `symbol=${symbol}&side=${side}&type=STOP_MARKET&stopPrice=${formattedSl}&quantity=${quantity}&reduceOnly=true&workingType=MARK_PRICE&recvWindow=10000&timestamp=${fbTimestamp}`;
                const fbSig = CryptoJS.HmacSHA256(fbParams, this.testnetApiSecret).toString(CryptoJS.enc.Hex);

                const fbUrl = `/_testnet/fapi/v1/order?${fbParams}&signature=${fbSig}`;
                const resp = await fetch(fbUrl, {
                    method: 'POST',
                    headers: { 'X-MBX-APIKEY': this.testnetApiKey }
                });
                const resData = await resp.json();
                if (resp.ok) {
                    console.log(`🛡️ Binance Testnet Stop Loss Placed via reduceOnly (${symbol} ${side} @ $${formattedSl}):`, resData);
                    return resData;
                } else {
                    console.warn(`[Binance Stop Loss Fallback ${resData.code}]: ${resData.msg}`);
                }
            }
        } catch (err) {
            console.error('Stop Loss exception:', err);
        }
        return null;
    }

    /**
     * Binance Testnet: Place Take Profit Order (TAKE_PROFIT_MARKET)
     */
    async sendTestnetTakeProfitOrder(symbol, side, tpPrice, quantity = null) {
        if (!this.testnetApiKey || !this.testnetApiSecret || typeof CryptoJS === 'undefined') return null;

        try {
            const timestamp = Date.now();
            const formattedTp = this.formatPricePrecision(symbol, tpPrice);
            const params = `symbol=${symbol}&side=${side}&type=TAKE_PROFIT_MARKET&stopPrice=${formattedTp}&closePosition=true&workingType=MARK_PRICE&recvWindow=10000&timestamp=${timestamp}`;
            const signature = CryptoJS.HmacSHA256(params, this.testnetApiSecret).toString(CryptoJS.enc.Hex);

            const endpoints = [
                `/_testnet/fapi/v1/order?${params}&signature=${signature}`,
                `https://testnet.binancefuture.com/fapi/v1/order?${params}&signature=${signature}`
            ];

            for (const url of endpoints) {
                try {
                    const resp = await fetch(url, {
                        method: 'POST',
                        headers: { 'X-MBX-APIKEY': this.testnetApiKey }
                    });
                    const resData = await resp.json();
                    if (resp.ok) {
                        console.log(`🎯 Binance Testnet Take Profit Placed (${symbol} ${side} @ $${formattedTp}):`, resData);
                        return resData;
                    } else {
                        console.warn(`[Binance Take Profit closePosition skip ${resData.code}]: ${resData.msg}`);
                    }
                } catch (e) {
                    console.warn(`Take Profit order failed for ${url}:`, e);
                }
            }

            // Fallback: If closePosition failed, retry with quantity & reduceOnly=true
            if (quantity && quantity > 0) {
                console.log(`🎯 Retrying Take Profit with reduceOnly=true for ${symbol}...`);
                const fbTimestamp = Date.now();
                const fbParams = `symbol=${symbol}&side=${side}&type=TAKE_PROFIT_MARKET&stopPrice=${formattedTp}&quantity=${quantity}&reduceOnly=true&workingType=MARK_PRICE&recvWindow=10000&timestamp=${fbTimestamp}`;
                const fbSig = CryptoJS.HmacSHA256(fbParams, this.testnetApiSecret).toString(CryptoJS.enc.Hex);

                const fbUrl = `/_testnet/fapi/v1/order?${fbParams}&signature=${fbSig}`;
                const resp = await fetch(fbUrl, {
                    method: 'POST',
                    headers: { 'X-MBX-APIKEY': this.testnetApiKey }
                });
                const resData = await resp.json();
                if (resp.ok) {
                    console.log(`🎯 Binance Testnet Take Profit Placed via reduceOnly (${symbol} ${side} @ $${formattedTp}):`, resData);
                    return resData;
                } else {
                    console.warn(`[Binance Take Profit Fallback ${resData.code}]: ${resData.msg}`);
                }
            }
        } catch (err) {
            console.error('Take Profit exception:', err);
        }
        return null;
    }

    /**
     * Binance Testnet: Cancel All Open Orders (DELETE /fapi/v1/allOpenOrders)
     */
    async cancelAllTestnetOrders(symbol) {
        if (!this.testnetApiKey || !this.testnetApiSecret || typeof CryptoJS === 'undefined') return null;

        try {
            const timestamp = Date.now();
            const params = `symbol=${symbol}&recvWindow=10000&timestamp=${timestamp}`;
            const signature = CryptoJS.HmacSHA256(params, this.testnetApiSecret).toString(CryptoJS.enc.Hex);

            const endpoints = [
                `/_testnet/fapi/v1/allOpenOrders?${params}&signature=${signature}`,
                `https://testnet.binancefuture.com/fapi/v1/allOpenOrders?${params}&signature=${signature}`
            ];

            for (const url of endpoints) {
                try {
                    const resp = await fetch(url, {
                        method: 'DELETE',
                        headers: { 'X-MBX-APIKEY': this.testnetApiKey }
                    });
                    if (resp.ok) {
                        const data = await resp.json();
                        console.log(`🧹 Binance Testnet Cancelled All Open Orders (${symbol}):`, data);
                        return data;
                    }
                } catch (e) {
                    console.warn(`Cancel all orders failed for ${url}:`, e);
                }
            }
        } catch (err) {
            console.error('Cancel orders exception:', err);
        }
        return null;
    }

    /**
     * Send Real Signed Order to Binance Futures Testnet
     */
    async sendTestnetOrder(symbol, side, quantity, reduceOnly = false) {
        symbol = this.normalizeSymbol(symbol);
        if (!this.testnetApiKey || !this.testnetApiSecret || typeof CryptoJS === 'undefined') {
            console.warn('Testnet API Key / Secret missing or CryptoJS library not loaded.');
            return null;
        }

        try {
            const timestamp = Date.now();
            let params = `symbol=${symbol}&side=${side}&type=MARKET&quantity=${quantity}&recvWindow=10000&timestamp=${timestamp}`;
            if (reduceOnly) {
                params += `&reduceOnly=true`;
            }

            const signature = CryptoJS.HmacSHA256(params, this.testnetApiSecret).toString(CryptoJS.enc.Hex);
            const endpoints = [
                `/_testnet/fapi/v1/order?${params}&signature=${signature}`,
                `https://testnet.binancefuture.com/fapi/v1/order?${params}&signature=${signature}`
            ];

            let lastErrData = null;

            for (const url of endpoints) {
                try {
                    const response = await fetch(url, {
                        method: 'POST',
                        headers: {
                            'X-MBX-APIKEY': this.testnetApiKey
                        }
                    });

                    const resData = await response.json();
                    if (response.ok) {
                        console.log(`✅ Binance Testnet Order Success [${side} ${quantity} ${symbol}]:`, resData);
                        return resData;
                    } else {
                        lastErrData = resData;
                    }
                } catch (e) {
                    console.warn(`Testnet fetch failed for ${url}:`, e);
                }
            }

            if (lastErrData) {
                console.warn(`[Binance Order Skip ${lastErrData.code || ''}]: ${lastErrData.msg || JSON.stringify(lastErrData)}`);
            }
            return null;

        } catch (err) {
            console.error('Testnet order exception:', err);
            alert(`Binance Testnet Bağlantı Hatası: ${err.message}`);
            return null;
        }
    }

    /**
     * 100% Live Synchronization: Balance, Positions & Open Orders from Binance Futures Testnet
     */
    async syncTestnetAll() {
        if (!this.testnetApiKey || !this.testnetApiSecret || typeof CryptoJS === 'undefined') return;

        try {
            const timestamp = Date.now();
            const params = `recvWindow=10000&timestamp=${timestamp}`;
            const signature = CryptoJS.HmacSHA256(params, this.testnetApiSecret).toString(CryptoJS.enc.Hex);

            // 1. Sync Wallet Balance (GET /fapi/v2/account)
            const accUrl = `/_testnet/fapi/v2/account?${params}&signature=${signature}`;
            const accResp = await fetch(accUrl, { headers: { 'X-MBX-APIKEY': this.testnetApiKey } });
            if (accResp.ok) {
                const acc = await accResp.json();
                if (acc) {
                    const bal = parseFloat(acc.totalMarginBalance || acc.totalWalletBalance || acc.availableBalance);
                    if (!isNaN(bal)) {
                        this.balance = bal;
                    }
                }
            }

            // 2. Sync Real Live Positions (GET /fapi/v2/positionRisk)
            const posUrl = `/_testnet/fapi/v2/positionRisk?${params}&signature=${signature}`;
            const posResp = await fetch(posUrl, { headers: { 'X-MBX-APIKEY': this.testnetApiKey } });
            if (posResp.ok) {
                const positions = await posResp.json();
                if (Array.isArray(positions)) {
                    const activeOnBinance = positions.filter(p => parseFloat(p.positionAmt) !== 0);
                    
                    this.activePositions = activeOnBinance.map(activePos => {
                        const posAmt = parseFloat(activePos.positionAmt);
                        const dir = posAmt > 0 ? 'LONG' : 'SHORT';
                        const absQty = Math.abs(posAmt);
                        const entryPx = parseFloat(activePos.entryPrice);
                        const markPx = parseFloat(activePos.markPrice);
                        const lev = parseInt(activePos.leverage) || 10;
                        const mType = activePos.marginType ? activePos.marginType.toUpperCase() : 'ISOLATED';

                        const notional = absQty * markPx;
                        const margin = notional / lev;

                        const existing = this.activePositions.find(p => p.symbol === activePos.symbol);

                        return {
                            id: 'POS_LIVE_' + activePos.symbol,
                            symbol: activePos.symbol,
                            direction: dir,
                            entryPrice: entryPx,
                            markPrice: markPx,
                            quantity: absQty,
                            margin: margin,
                            notionalValue: notional,
                            leverage: lev,
                            marginType: mType,
                            slPrice: existing ? existing.slPrice : null,
                            tpPrice: existing ? existing.tpPrice : null,
                            liqPrice: parseFloat(activePos.liquidationPrice) || this.calculateLiquidationPrice(entryPx, dir, lev),
                            openedAt: existing ? existing.openedAt : new Date().toISOString(),
                            unrealizedPnl: parseFloat(activePos.unRealizedProfit) || 0,
                            unrealizedPnlPct: margin > 0 ? ((parseFloat(activePos.unRealizedProfit) || 0) / margin) * 100 : 0
                        };
                    });
                }
            }

            // 3. Sync Real Open SL/TP Orders (GET /fapi/v1/openOrders)
            const ordUrl = `/_testnet/fapi/v1/openOrders?${params}&signature=${signature}`;
            const ordResp = await fetch(ordUrl, { headers: { 'X-MBX-APIKEY': this.testnetApiKey } });
            if (ordResp.ok) {
                const orders = await ordResp.json();
                if (Array.isArray(orders)) {
                    this.openOrders = orders;

                    // Update SL/TP prices on active positions
                    this.activePositions.forEach(pos => {
                        const symOrders = orders.filter(o => o.symbol === pos.symbol);
                        const slOrd = symOrders.find(o => o.type === 'STOP_MARKET');
                        const tpOrd = symOrders.find(o => o.type === 'TAKE_PROFIT_MARKET');
                        if (slOrd) pos.slPrice = parseFloat(slOrd.stopPrice);
                        if (tpOrd) pos.tpPrice = parseFloat(tpOrd.stopPrice);
                    });
                }
            }

            this.saveState();
            if (window.app) window.app.updateDemoUI();

        } catch (e) {
            console.warn('Testnet Live All Sync exception:', e);
        }
    }

    /**
     * Open a new Position (1:1 Synchronized with Binance Futures Testnet)
     * Max 3 concurrent positions, 10% balance margin allocation per trade.
     */
    async openPosition(symbol, direction, entryPrice, slPrice = null, tpPrice = null) {
        symbol = this.normalizeSymbol(symbol);

        if (this.activePositions.length >= this.maxPositions) {
            console.warn(`DemoEngine: Maximum active position limit reached (${this.maxPositions}). Cannot open ${symbol}.`);
            return false;
        }

        if (this.activePositions.some(p => p.symbol === symbol)) {
            console.warn(`DemoEngine: Active position already exists for ${symbol}.`);
            return false;
        }

        const margin = (this.balance * (this.positionSizePct / 100));
        let notionalValue = margin * this.leverage;

        // Clamp maximum test notional to $15,000 USDT
        const maxTestNotional = 15000;
        if (notionalValue > maxTestNotional) {
            notionalValue = maxTestNotional;
        }

        let quantity = (notionalValue / entryPrice);

        // Precision and Max Quantity Clamping per Symbol
        if (symbol.includes('BTC')) {
            quantity = parseFloat(quantity.toFixed(3));
            quantity = Math.min(quantity, 0.2);
        } else if (symbol.includes('ETH')) {
            quantity = parseFloat(quantity.toFixed(2));
            quantity = Math.min(quantity, 2.0);
        } else if (symbol.includes('XAU')) {
            quantity = parseFloat(quantity.toFixed(2));
            quantity = Math.min(quantity, 2.0);
        } else {
            quantity = parseFloat(quantity.toFixed(1));
            quantity = Math.min(quantity, 100.0);
        }

        if (quantity <= 0) quantity = 0.001;

        const side = direction === 'LONG' ? 'BUY' : 'SELL';
        const reverseSide = direction === 'LONG' ? 'SELL' : 'BUY';

        // Auto-calculate SL & TP if omitted (1.5x ATR SL / 3.0x ATR TP approximation)
        if (!slPrice) {
            slPrice = direction === 'LONG' ? entryPrice * 0.985 : entryPrice * 1.015;
        }
        if (!tpPrice) {
            tpPrice = direction === 'LONG' ? entryPrice * 1.030 : entryPrice * 0.970;
        }

        // If Testnet API Keys active, sync 1:1 with Binance Futures Testnet
        if (this.useTestnetApi && this.testnetApiKey && this.testnetApiSecret) {
            // Step 1: Set Leverage on Binance
            await this.setBinanceLeverage(symbol, this.leverage);

            // Step 2: Set Margin Type (ISOLATED/CROSSED) on Binance
            await this.setBinanceMarginType(symbol, this.marginType);

            // Step 3: Send Main Market Order to Binance
            const testnetRes = await this.sendTestnetOrder(symbol, side, quantity);
            if (!testnetRes) return false;

            // Wait 600ms for Binance position execution to register on testnet
            await new Promise(resolve => setTimeout(resolve, 600));

            // Step 4: Send Stop Loss Order (STOP_MARKET)
            await this.sendTestnetStopLossOrder(symbol, reverseSide, slPrice, quantity);

            // Step 5: Send Take Profit Order (TAKE_PROFIT_MARKET)
            await this.sendTestnetTakeProfitOrder(symbol, reverseSide, tpPrice, quantity);

            // Perform immediate live sync
            setTimeout(() => this.syncTestnetAll(), 800);
        }

        const liqPrice = this.calculateLiquidationPrice(entryPrice, direction, this.leverage);

        const newPosition = {
            id: 'POS_' + Date.now() + '_' + symbol,
            symbol: symbol,
            direction: direction, // 'LONG' or 'SHORT'
            entryPrice: entryPrice,
            quantity: quantity,
            margin: margin,
            notionalValue: notionalValue,
            leverage: this.leverage,
            marginType: this.marginType,
            slPrice: slPrice,
            tpPrice: tpPrice,
            liqPrice: liqPrice,
            openedAt: new Date().toISOString(),
            unrealizedPnl: 0,
            unrealizedPnlPct: 0
        };

        this.activePositions.push(newPosition);

        this.saveState();
        console.log(`DemoEngine: Opened ${this.leverage}x ${this.marginType} ${direction} on ${symbol} @ $${entryPrice.toFixed(2)} [SL: $${slPrice ? slPrice.toFixed(2) : '-'} | TP: $${tpPrice ? tpPrice.toFixed(2) : '-'}] (Active: ${this.activePositions.length}/${this.maxPositions})`);
        return newPosition;
    }

    /**
     * Evaluate live market price tick against all active positions for SL/TP/Liquidation
     */
    onPriceTick(currentPrice, targetSymbol = null) {
        if (this.activePositions.length === 0) return null;

        const closedThisTick = [];

        for (let i = this.activePositions.length - 1; i >= 0; i--) {
            const pos = this.activePositions[i];
            if (targetSymbol && targetSymbol !== pos.symbol) continue;

            let pnl = 0;
            if (pos.direction === 'LONG') {
                pnl = (currentPrice - pos.entryPrice) * pos.quantity;
            } else {
                pnl = (pos.entryPrice - currentPrice) * pos.quantity;
            }

            pos.unrealizedPnl = pnl;
            pos.unrealizedPnlPct = (pnl / pos.margin) * 100;

            // In Paper Simulation mode, evaluate SL/TP/Liquidation
            if (!this.useTestnetApi) {
                // Check Liquidation
                if ((pos.direction === 'LONG' && currentPrice <= pos.liqPrice) || (pos.direction === 'SHORT' && currentPrice >= pos.liqPrice)) {
                    closedThisTick.push(this.closeCurrentPosition(pos.symbol, pos.liqPrice, 'LİKİDASYON (SL)'));
                    continue;
                }

                // Check Take Profit (TP)
                if (pos.tpPrice) {
                    if ((pos.direction === 'LONG' && currentPrice >= pos.tpPrice) || (pos.direction === 'SHORT' && currentPrice <= pos.tpPrice)) {
                        closedThisTick.push(this.closeCurrentPosition(pos.symbol, pos.tpPrice, 'TAKE PROFİT (TP)'));
                        continue;
                    }
                }

                // Check Stop Loss (SL)
                if (pos.slPrice) {
                    if ((pos.direction === 'LONG' && currentPrice <= pos.slPrice) || (pos.direction === 'SHORT' && currentPrice >= pos.slPrice)) {
                        closedThisTick.push(this.closeCurrentPosition(pos.symbol, pos.slPrice, 'STOP LOSS (SL)'));
                        continue;
                    }
                }
            }
        }

        return this.activePositions;
    }

    /**
     * Close specific position by symbol and 1:1 cancel open SL/TP orders on Binance Futures Testnet
     */
    async closeCurrentPosition(symbolOrExitPrice, exitPrice = null, reason = 'MANUEL') {
        if (this.activePositions.length === 0) return null;

        let targetSymbol = null;
        let actualExitPrice = exitPrice;

        if (typeof symbolOrExitPrice === 'string') {
            targetSymbol = this.normalizeSymbol(symbolOrExitPrice);
        } else {
            actualExitPrice = symbolOrExitPrice;
            targetSymbol = this.activePositions[0].symbol;
        }

        const posIdx = this.activePositions.findIndex(p => p.symbol === targetSymbol);
        if (posIdx < 0) return null;

        const pos = this.activePositions[posIdx];
        if (!actualExitPrice) actualExitPrice = pos.entryPrice;

        // Synchronize closing order on Binance Testnet
        if (this.useTestnetApi && this.testnetApiKey && this.testnetApiSecret) {
            // Cancel all open SL/TP orders on Binance first
            await this.cancelAllTestnetOrders(pos.symbol);

            // Send Market Close Order
            const reverseSide = pos.direction === 'LONG' ? 'SELL' : 'BUY';
            await this.sendTestnetOrder(pos.symbol, reverseSide, pos.quantity, true);
        }

        let realizedPnl = 0;
        if (pos.direction === 'LONG') {
            realizedPnl = (actualExitPrice - pos.entryPrice) * pos.quantity;
        } else {
            realizedPnl = (pos.entryPrice - actualExitPrice) * pos.quantity;
        }

        const realizedPnlPct = (realizedPnl / pos.margin) * 100;

        // Update Wallet Balance
        this.balance += realizedPnl;

        const closedTrade = {
            id: pos.id,
            symbol: pos.symbol,
            direction: pos.direction,
            entryPrice: pos.entryPrice,
            exitPrice: actualExitPrice,
            quantity: pos.quantity,
            margin: pos.margin,
            leverage: pos.leverage,
            pnl: realizedPnl,
            pnlPct: realizedPnlPct,
            reason: reason,
            closedAt: new Date().toISOString()
        };

        this.closedTrades.unshift(closedTrade);
        if (this.closedTrades.length > 50) this.closedTrades.pop();
        this.activePositions.splice(posIdx, 1);

        this.saveState();
        if (this.useTestnetApi) {
            setTimeout(() => this.syncTestnetAll(), 800);
        }

        console.log(`DemoEngine: Closed ${pos.direction} on ${pos.symbol} @ $${exitPrice.toFixed(2)} [PnL: $${realizedPnl.toFixed(2)} (${realizedPnlPct.toFixed(2)}%)]`);
        return closedTrade;
    }

    getMetrics() {
        const totalTrades = this.closedTrades.length;
        const winTrades = this.closedTrades.filter(t => (t.pnl !== undefined ? t.pnl : (t.realizedPnl || 0)) > 0).length;
        const winRate = totalTrades > 0 ? (winTrades / totalTrades) * 100 : 0;
        const totalRealizedPnl = this.closedTrades.reduce((acc, t) => acc + (t.pnl !== undefined ? t.pnl : (t.realizedPnl || 0)), 0);

        return {
            balance: this.balance,
            initialBalance: this.initialBalance,
            totalReturnPct: ((this.balance - this.initialBalance) / this.initialBalance) * 100,
            totalTrades: totalTrades,
            winTrades: winTrades,
            winRate: winRate,
            totalRealizedPnl: totalRealizedPnl
        };
    }
}

window.binanceDemoEngine = new BinanceDemoEngine();
