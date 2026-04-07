#!/bin/bash
echo "Starting ZZTetris web server on http://localhost:8080..."
echo "Press Ctrl+C to stop."

# Run python server with wasm MIME type support
python3 -c '
import http.server
import socketserver

PORT = 8080
Handler = http.server.SimpleHTTPRequestHandler
Handler.extensions_map.update({
    ".wasm": "application/wasm",
})

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print("Serving at port", PORT)
    httpd.serve_forever()
'
