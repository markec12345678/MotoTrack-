#!/usr/bin/env python3
"""MotoTrack Lightweight Server - Python"""
import http.server
import socketserver
import os
import json
import threading
import time

PORT = 3000
BASE = os.path.dirname(os.path.abspath(__file__))
INDEX = open(os.path.join(BASE, '.next', 'cached-index.html'), 'rb').read()

# Connection limiting
active_connections = 0
MAX_CONNECTIONS = 3
conn_lock = threading.Lock()

MIME_MAP = {
    'js': 'application/javascript', 'css': 'text/css', 'json': 'application/json',
    'png': 'image/png', 'jpg': 'image/jpeg', 'svg': 'image/svg+xml',
    'ico': 'image/x-icon', 'woff2': 'font/woff2', 'woff': 'font/woff',
    'webp': 'image/webp', 'wasm': 'application/wasm', 'map': 'application/json',
    'ttf': 'font/ttf', 'txt': 'text/plain', 'xml': 'application/xml',
}

class MotoTrackHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        global active_connections
        with conn_lock:
            if active_connections >= MAX_CONNECTIONS:
                self.send_response(503)
                self.send_header('Connection', 'close')
                self.end_headers()
                return
            active_connections += 1
        
        try:
            path = self.path.split('?')[0]
            self.close_connection = True
            
            if path == '/' or path == '':
                self._send_html(INDEX)
            elif path.startswith('/_next/static/'):
                fp = os.path.join(BASE, '.next', 'static', path.replace('/_next/static/', ''))
                self._send_file(fp, 31536000)
            elif path in ['/sw.js', '/manifest.json', '/robots.txt']:
                self._send_file(os.path.join(BASE, 'public', path.lstrip('/')), 0)
            elif path.startswith('/api/'):
                self._handle_api(path)
            else:
                fp = os.path.join(BASE, 'public', path.lstrip('/'))
                if os.path.isfile(fp):
                    self._send_file(fp, 3600)
                else:
                    self._send_html(INDEX)  # SPA fallback
        finally:
            with conn_lock:
                active_connections -= 1
    
    def do_POST(self):
        self.do_GET()  # Simplified
    
    def _send_html(self, data):
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Content-Length', len(data))
        self.send_header('Cache-Control', 'public, max-age=60')
        self.send_header('Connection', 'close')
        self.end_headers()
        self.wfile.write(data)
    
    def _send_file(self, fp, max_age):
        if not os.path.isfile(fp):
            self.send_response(404)
            self.send_header('Connection', 'close')
            self.end_headers()
            return
        ext = os.path.splitext(fp)[1].lstrip('.')
        ct = MIME_MAP.get(ext, 'application/octet-stream')
        data = open(fp, 'rb').read()
        self.send_response(200)
        self.send_header('Content-Type', ct)
        self.send_header('Content-Length', len(data))
        self.send_header('Cache-Control', f'public, max-age={max_age}')
        self.send_header('Connection', 'close')
        self.end_headers()
        self.wfile.write(data)
    
    def _handle_api(self, path):
        data = None
        if path == '/api/init':
            data = {
                'users': [{'id': 'demo1', 'name': 'Miran M.', 'email': 'miran@rever.si', 'avatar': None, 'bike': 'Yamaha MT-07', 'bio': 'Motociklistični navdušenec'}],
                'rides': [], 'routes': [],
                'defaultUser': {'id': 'demo1', 'name': 'Miran M.', 'email': 'miran@rever.si', 'avatar': None, 'bike': 'Yamaha MT-07', 'bio': 'Motociklistični navdušenec'},
                'needsSeed': True,
                'leaderboard': [{'id': 'demo1', 'name': 'Miran M.', 'totalDistance': 0, 'totalRides': 0}],
            }
        elif path == '/api/notifications':
            data = []
        elif path == '/api/weather':
            data = None
        elif path == '/api/achievements':
            data = {'earned': [], 'newlyEarned': []}
        elif path == '/api/sos':
            data = {'ok': True}
        elif path == '/api/seed':
            data = {'seeded': False}
        elif path == '/api/leaderboard':
            data = [{'id': 'demo1', 'name': 'Miran M.', 'totalDistance': 0, 'totalRides': 0}]
        elif path.startswith('/api/users/'):
            data = {'id': 'demo1', 'name': 'Miran M.'}
        elif path in ['/api/rides', '/api/routes', '/api/comments']:
            data = []
        elif path == '/api/settings':
            data = {}
        else:
            data = None
        
        body = json.dumps({'data': data}).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', len(body))
        self.send_header('Connection', 'close')
        self.end_headers()
        self.wfile.write(body)
    
    def log_message(self, *args):
        pass  # Silent logging

class SingleThreadServer(socketserver.TCPServer):
    allow_reuse_address = True
    # Single-threaded: handles one request at a time

if __name__ == '__main__':
    server = SingleThreadServer(('', PORT), MotoTrackHandler)
    print(f'> MotoTrack Python on :{PORT}')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.shutdown()
