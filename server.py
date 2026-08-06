import http.server
import socketserver
import urllib.request
import urllib.parse
import ssl
import socket
import os
import mimetypes

PORT = 8080
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

ssl_ctx = ssl.create_default_context()
ssl_ctx.check_hostname = False
ssl_ctx.verify_mode = ssl.CERT_NONE

class IndestructibleProxyHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_GET(self):
        self.handle_proxy_or_static('GET')

    def do_POST(self):
        self.handle_proxy_or_static('POST')

    def do_DELETE(self):
        self.handle_proxy_or_static('DELETE')

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'X-MBX-APIKEY, Content-Type')
        self.end_headers()

    def handle_proxy_or_static(self, method):
        try:
            if self.path.startswith('/_testnet/'):
                raw_path = self.path[len('/_testnet/'):]
                unquoted_path = urllib.parse.unquote(raw_path)
                target_url = 'https://testnet.binancefuture.com/' + unquoted_path
                self.proxy_request(target_url, method)
                return

            if self.path.startswith('/_futures/'):
                raw_path = self.path[len('/_futures/'):]
                unquoted_path = urllib.parse.unquote(raw_path)
                target_url = 'https://fapi.binance.com/' + unquoted_path
                self.proxy_request(target_url, method)
                return

            if self.path.startswith('/_spot/'):
                raw_path = self.path[len('/_spot/'):]
                unquoted_path = urllib.parse.unquote(raw_path)
                target_url = 'https://api.binance.com/' + unquoted_path
                self.proxy_request(target_url, method)
                return

            if method == 'GET':
                req_path = self.path.split('?')[0]
                if req_path == '/': req_path = '/index.html'
                file_path = os.path.join(DIRECTORY, req_path.lstrip('/'))

                if os.path.isfile(file_path):
                    ctype, _ = mimetypes.guess_type(file_path)
                    ctype = ctype or 'application/octet-stream'
                    with open(file_path, 'rb') as f:
                        content = f.read()
                        self.send_response(200)
                        self.send_header('Content-Type', ctype)
                        self.send_header('Content-Length', str(len(content)))
                        self.send_header('Access-Control-Allow-Origin', '*')
                        self.end_headers()
                        self.wfile.write(content)
                        self.wfile.flush()
                        return

            super().do_GET()
        except Exception as e:
            print("HANDLE PROXY EXCEPTION:", e, flush=True)

    def proxy_request(self, target_url, method='GET'):
        try:
            body_bytes = None
            if method in ['POST', 'DELETE']:
                content_len = int(self.headers.get('Content-Length', 0))
                if content_len > 0:
                    body_bytes = self.rfile.read(content_len)

            req_headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Encoding': 'identity'
            }

            if 'X-MBX-APIKEY' in self.headers:
                req_headers['X-MBX-APIKEY'] = self.headers['X-MBX-APIKEY']
            if 'x-mbx-apikey' in self.headers:
                req_headers['X-MBX-APIKEY'] = self.headers['x-mbx-apikey']

            req = urllib.request.Request(
                target_url,
                data=body_bytes,
                method=method,
                headers=req_headers
            )

            try:
                with urllib.request.urlopen(req, context=ssl_ctx, timeout=10) as resp:
                    data = resp.read()
                    self.send_response(resp.status)
                    self.send_header('Content-Type', 'application/json')
                    self.send_header('Content-Length', str(len(data)))
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    self.wfile.write(data)
                    self.wfile.flush()
                    return
            except urllib.error.HTTPError as http_err:
                err_data = http_err.read()
                self.send_response(http_err.code)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Content-Length', str(len(err_data)))
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(err_data)
                self.wfile.flush()
                return

        except Exception as proxy_e:
            print("PROXY REQUEST ERROR:", proxy_e, flush=True)
            err_bytes = ('{"error": "' + str(proxy_e) + '"}').encode('utf-8')
            try:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Content-Length', str(len(err_bytes)))
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(err_bytes)
                self.wfile.flush()
            except Exception:
                pass
            return

    def log_message(self, format, *args):
        pass

class IPv4MultiThreadedServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    address_family = socket.AF_INET
    daemon_threads = True
    allow_reuse_address = True

if __name__ == '__main__':
    while True:
        try:
            with IPv4MultiThreadedServer(("0.0.0.0", PORT), IndestructibleProxyHandler) as httpd:
                print(f"Server active on http://127.0.0.1:{PORT}", flush=True)
                httpd.serve_forever()
        except Exception as e:
            print("SERVER RESTART:", e, flush=True)
