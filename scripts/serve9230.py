# Tiny CORS server on :9230 — the only port range the Figma bridge plugin may reach.
# GET serves the project (public assets, src/data/grid.json, scripts, tmp); POST saves a file under tmp/.
import http.server, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()
    def do_OPTIONS(self):
        self.send_response(204); self.end_headers()
    def do_POST(self):
        n = int(self.headers.get('Content-Length', 0))
        data = self.rfile.read(n)
        path = os.path.join(ROOT, 'tmp', os.path.basename(self.path))
        open(path, 'wb').write(data)
        self.send_response(200); self.end_headers(); self.wfile.write(b'ok')
    def log_message(self, *a): pass
http.server.ThreadingHTTPServer(('localhost', 9230), H).serve_forever()
