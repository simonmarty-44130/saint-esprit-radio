#!/usr/bin/env python3
import http.server
import socketserver
import os

os.chdir('/Users/directionradiofidelite/saint-esprit-aws/frontend')

PORT = 8080

Handler = http.server.SimpleHTTPRequestHandler

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print(f"🚀 Serveur de test démarré sur http://localhost:{PORT}")
    print("👉 Ouvrez votre navigateur et testez l'application")
    print("⚠️  Appuyez sur Ctrl+C pour arrêter le serveur")
    httpd.serve_forever()