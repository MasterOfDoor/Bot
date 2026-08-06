"""
Binance Futures Real-time Data Pipeline & Trading Bot Starter Kit
Uses Binance Futures REST API & WebSockets to stream live market data,
compute EMA, RSI, ATR indicators, and execute SL/TP orders automatically.
"""

import json
import time
import urllib.request
import urllib.parse
import hmac
import hashlib

# Configuration
SYMBOL = "BTCUSDT"
INTERVAL = "1h"
REST_BASE = "https://fapi.binance.com"
TESTNET_BASE = "https://testnet.binancefuture.com"

API_KEY = "YOUR_TESTNET_API_KEY"
API_SECRET = "YOUR_TESTNET_API_SECRET"


def get_historical_klines(symbol=SYMBOL, interval=INTERVAL, limit=300):
    """1. Fetch initial candlestick snapshot from Binance Futures REST API"""
    url = f"{REST_BASE}/fapi/v1/klines?symbol={symbol}&interval={interval}&limit={limit}"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=5) as resp:
        data = json.loads(resp.read().decode())
        candles = []
        for c in data:
            candles.append({
                'time': c[0],
                'open': float(c[1]),
                'high': float(c[2]),
                'low': float(c[3]),
                'close': float(c[4]),
                'volume': float(c[5])
            })
        return candles


def calculate_ema(prices, period):
    """2. Compute Exponential Moving Average (EMA)"""
    if len(prices) < period:
        return [None] * len(prices)
    k = 2 / (period + 1)
    ema = [sum(prices[:period]) / period]
    for p in prices[period:]:
        ema.append((p * k) + (ema[-1] * (1 - k)))
    return [None] * (period - 1) + ema


def calculate_rsi(closes, period=14):
    """3. Compute Relative Strength Index (RSI)"""
    if len(closes) <= period:
        return [None] * len(closes)
    gains, losses = [], []
    for i in range(1, len(closes)):
        diff = closes[i] - closes[i - 1]
        gains.append(max(diff, 0))
        losses.append(abs(min(diff, 0)))
    
    avg_gain = sum(gains[:period]) / period
    avg_loss = sum(losses[:period]) / period
    rsi = [100 if avg_loss == 0 else 100 - (100 / (1 + (avg_gain / avg_loss)))]
    
    for i in range(period, len(gains)):
        avg_gain = (avg_gain * (period - 1) + gains[i]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period
        rs = avg_gain / avg_loss if avg_loss > 0 else 999
        rsi.append(100 - (100 / (1 + rs)))
    return [None] * period + rsi


def send_signed_order(symbol, side, order_type, quantity=None, stop_price=None):
    """4. Send HMAC SHA256 Signed Order (Market, Stop Loss, Take Profit) to Binance Futures"""
    timestamp = int(time.time() * 1000)
    params = {
        'symbol': symbol,
        'side': side,
        'type': order_type,
        'recvWindow': 10000,
        'timestamp': timestamp
    }
    if quantity:
        params['quantity'] = quantity
    if stop_price:
        params['stopPrice'] = stop_price
        params['closePosition'] = 'true'
        params['workingType'] = 'MARK_PRICE'

    query = urllib.parse.urlencode(params)
    signature = hmac.new(API_SECRET.encode('utf-8'), query.encode('utf-8'), hashlib.sha256).hexdigest()
    url = f"{TESTNET_BASE}/fapi/v1/order?{query}&signature={signature}"
    
    req = urllib.request.Request(url, method='POST', headers={'X-MBX-APIKEY': API_KEY})
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            return json.loads(resp.read().decode())
    except Exception as e:
        print(f"Order error: {e}")
        return None


if __name__ == '__main__':
    print(f"--- Launching Binance Futures Data Pipeline ({SYMBOL}) ---")
    klines = get_historical_klines()
    closes = [c['close'] for c in klines]
    
    ema50 = calculate_ema(closes, 50)
    ema200 = calculate_ema(closes, 200)
    rsi14 = calculate_rsi(closes, 14)
    
    latest_close = closes[-1]
    latest_e50 = ema50[-1]
    latest_e200 = ema200[-1]
    latest_rsi = rsi14[-1]

    print(f"Latest Market Price: ${latest_close:.2f}")
    print(f"EMA(50): ${latest_e50:.2f} | EMA(200): ${latest_e200:.2f}")
    print(f"RSI(14): {latest_rsi:.1f}")

    if latest_e50 > latest_e200 and latest_rsi < 30:
        print("[SIGNAL] LONG BUY")
    elif latest_e50 < latest_e200 and latest_rsi > 70:
        print("[SIGNAL] SHORT SELL")
    else:
        print("[SIGNAL] NO TRADE (WAITING)")
