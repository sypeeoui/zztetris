#!/bin/bash
echo "Starting ZZTetris web server on http://localhost:8080..."
echo "Press Ctrl+C to stop."

python3 - <<'PY'
import http.server
import socketserver

PORT = 8080

class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".wasm": "application/wasm",
    }

class ReusableTCPServer(socketserver.TCPServer):
    allow_reuse_address = True  # allows immediate port reuse after Ctrl+C

httpd = ReusableTCPServer(("", PORT), Handler)

try:
    print(f"Serving at port {PORT}")
    httpd.serve_forever()
except KeyboardInterrupt:
    print("\nStopping server...")
finally:
    httpd.shutdown()
    httpd.server_close()
    print("Server stopped.")
PY
