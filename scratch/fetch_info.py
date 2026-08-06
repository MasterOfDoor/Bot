import urllib.request
import json

url = 'https://fapi.binance.com/fapi/v1/exchangeInfo'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req, timeout=5) as resp:
        info = json.loads(resp.read().decode())
        target_symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XAUUSDT', 'AVAXUSDT', '1000PEPEUSDT', 'NEARUSDT', 'SUIUSDT']
        for s in info['symbols']:
            if s['symbol'] in target_symbols:
                pf = next(f for f in s['filters'] if f['filterType'] == 'PRICE_FILTER')
                lf = next(f for f in s['filters'] if f['filterType'] == 'LOT_SIZE')
                print(f"{s['symbol']}: pricePrecision={s['pricePrecision']}, quantityPrecision={s['quantityPrecision']}, tickSize={pf['tickSize']}, stepSize={lf['stepSize']}")
except Exception as e:
    print('Failed:', e)
