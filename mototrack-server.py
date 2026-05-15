#!/usr/bin/env python3
"""MotoTrack Server - Request-serialized with minimum delay between requests"""
import http.server
import socketserver
import os
import json
import time
import threading

PORT = 3000
BASE = os.path.dirname(os.path.abspath(__file__))

# Load pre-rendered HTML
try:
    with open(os.path.join(BASE, '.next', 'cached-index.html'), 'rb') as f:
        INDEX = f.read()
except:
    INDEX = b'<!DOCTYPE html><html><head><title>MotoTrack</title></head><body><h1>Loading...</h1></body></html>'

# Request serialization
request_lock = threading.Lock()
last_request_time = 0
MIN_INTERVAL = 1.5  # Minimum seconds between requests

MIME_MAP = {
    'js': 'application/javascript', 'css': 'text/css', 'json': 'application/json',
    'png': 'image/png', 'jpg': 'image/jpeg', 'svg': 'image/svg+xml',
    'ico': 'image/x-icon', 'woff2': 'font/woff2', 'woff': 'font/woff',
    'webp': 'image/webp', 'wasm': 'application/wasm', 'map': 'application/json',
    'ttf': 'font/ttf', 'txt': 'text/plain', 'xml': 'application/xml',
    'html': 'text/html; charset=utf-8',
}

# File cache for static files
file_cache = {}
def get_file(path):
    if path in file_cache:
        return file_cache[path]
    try:
        if os.path.isfile(path):
            with open(path, 'rb') as f:
                data = f.read()
            file_cache[path] = data
            return data
    except:
        pass
    return None

class MotoTrackHandler(http.server.BaseHTTPRequestHandler):
    def handle(self):
        global last_request_time
        with request_lock:
            now = time.time()
            elapsed = now - last_request_time
            if elapsed < MIN_INTERVAL:
                time.sleep(MIN_INTERVAL - elapsed)
            last_request_time = time.time()
            super().handle()
    
    def do_GET(self):
        path = self.path.split('?')[0]
        self.close_connection = True
        
        if path == '/' or path == '':
            self._send(INDEX, 'text/html; charset=utf-8', 60)
        elif path.startswith('/_next/static/'):
            fp = os.path.join(BASE, '.next', 'static', path.replace('/_next/static/', ''))
            data = get_file(fp)
            if data is not None:
                ext = os.path.splitext(fp)[1].lstrip('.')
                ct = MIME_MAP.get(ext, 'application/octet-stream')
                self._send(data, ct, 31536000)
            else:
                self._send(INDEX, 'text/html; charset=utf-8', 60)
        elif path in ['/sw.js', '/manifest.json', '/robots.txt']:
            data = get_file(os.path.join(BASE, 'public', path.lstrip('/')))
            if data is not None:
                ext = os.path.splitext(path)[1].lstrip('.')
                ct = MIME_MAP.get(ext, 'application/octet-stream')
                self._send(data, ct, 0)
            else:
                self._notfound()
        elif path.startswith('/api/'):
            self._handle_api(path)
        else:
            fp = os.path.join(BASE, 'public', path.lstrip('/'))
            data = get_file(fp)
            if data is not None:
                ext = os.path.splitext(fp)[1].lstrip('.')
                ct = MIME_MAP.get(ext, 'application/octet-stream')
                self._send(data, ct, 3600)
            else:
                # SPA fallback
                self._send(INDEX, 'text/html; charset=utf-8', 60)
    
    def do_POST(self):
        self.do_GET()
    
    def _send(self, data, ct, max_age):
        self.send_response(200)
        self.send_header('Content-Type', ct)
        self.send_header('Content-Length', len(data))
        self.send_header('Cache-Control', f'public, max-age={max_age}')
        self.send_header('Connection', 'close')
        self.end_headers()
        self.wfile.write(data)
    
    def _notfound(self):
        self.send_response(404)
        self.send_header('Connection', 'close')
        self.end_headers()
    
    def _handle_api(self, path):
        data = None
        if path == '/api/init':
            data = {
                'users': [{'id': 'demo1', 'name': 'Miran M.', 'email': 'miran@rever.si', 'avatar': None, 'bike': 'Yamaha MT-07', 'bio': 'Motociklistični navdušenec'}],
                'rides': [], 'routes': [],
                'defaultUser': {'id': 'demo1', 'name': 'Miran M.', 'email': 'miran@rever.si', 'avatar': None, 'bike': 'Yamaha MT-07', 'bio': 'Motociklistični navdušenec'},
                'needsSeed': False,
                'leaderboard': [{'id': 'demo1', 'name': 'Miran M.', 'totalDistance': 0, 'totalRides': 0}],
            }
        elif path == '/api/notifications':
            data = []
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
        elif path == '/api/stats':
            data = {'totalRides': 0, 'totalDistance': 0, 'totalDuration': 0, 'avgSpeed': 0, 'maxSpeed': 0}
        else:
            data = None
        
        body = json.dumps({'data': data}).encode()
        self._send(body, 'application/json', 0)
    
    def log_message(self, *args):
        pass

class Server(socketserver.TCPServer):
    allow_reuse_address = True

if __name__ == '__main__':
    # Pre-cache commonly requested files
    static_dir = os.path.join(BASE, '.next', 'static', 'chunks')
    if os.path.isdir(static_dir):
        for f in os.listdir(static_dir):
            fp = os.path.join(static_dir, f)
            if os.path.isfile(fp):
                get_file(fp)
        print(f'[CACHE] Pre-cached {len(file_cache)} files')
    
    server = Server(('', PORT), MotoTrackHandler)
    print(f'> MotoTrack on :{PORT} (serialized, min interval: {MIN_INTERVAL}s)')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.shutdown()
