import urllib.request
import urllib.parse
import hmac
import hashlib
import time

secret = 'test_secret'
apiKey = 'dummy_key'

def test_sl(symbol, side, stop_price):
    params = {
        'symbol': symbol,
        'side': side,
        'type': 'STOP_MARKET',
        'stopPrice': stop_price,
        'closePosition': 'true',
        'workingType': 'MARK_PRICE',
        'timeInForce': 'GTC',
        'recvWindow': 10000,
        'timestamp': int(time.time() * 1000)
    }
    q = urllib.parse.urlencode(params)
    sig = hmac.new(secret.encode('utf-8'), q.encode('utf-8'), hashlib.sha256).hexdigest()
    url = f'https://testnet.binancefuture.com/fapi/v1/order?{q}&signature={sig}'
    
    req = urllib.request.Request(url, method='POST', headers={'X-MBX-APIKEY': apiKey})
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            print('SUCCESS:', resp.read().decode())
    except urllib.error.HTTPError as e:
        print('HTTP ERROR:', e.code, e.read().decode())

test_sl('BTCUSDT', 'SELL', '62000.20')
