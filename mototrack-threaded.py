#!/usr/bin/env python3
"""MotoTrack Threaded Server - handles Caddy connections better"""
import http.server
import socketserver
import os
import json
import threading

PORT = 3000
BASE = os.path.dirname(os.path.abspath(__file__))

# Load HTML
try:
    with open(os.path.join(BASE, '.next', 'cached-index.html'), 'rb') as f:
        INDEX_HTML = f.read()
except:
    INDEX_HTML = b'<html><body><h1>MotoTrack</h1></body></html>'

MIME = {
    '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff',
    '.webp': 'image/webp', '.wasm': 'application/wasm', '.map': 'application/json',
    '.txt': 'text/plain',
}

_cache = {}
_cache_lock = threading.Lock()

def load_file(path):
    with _cache_lock:
        if path in _cache:
            return _cache[path]
    try:
        if not os.path.isfile(path):
            return None
        with open(path, 'rb') as f:
            data = f.read()
        ext = os.path.splitext(path)[1].lower()
        ct = MIME.get(ext, 'application/octet-stream')
        with _cache_lock:
            _cache[path] = (data, ct)
        return (data, ct)
    except:
        return None

def preload():
    count = 0
    for root, dirs, files in os.walk(os.path.join(BASE, '.next', 'static')):
        for f in files:
            load_file(os.path.join(root, f))
            count += 1
    for root, dirs, files in os.walk(os.path.join(BASE, 'public')):
        for f in files:
            load_file(os.path.join(root, f))
            count += 1
    return count

MOCK_USER = {'id': 'demo1', 'name': 'Miran M.', 'email': 'miran@rever.si', 'avatar': None, 'bike': 'Yamaha MT-07', 'bio': 'Motociklistični navdušenec'}
API = {
    '/api/init': lambda: {'users': [MOCK_USER], 'rides': [], 'routes': [], 'defaultUser': MOCK_USER, 'needsSeed': False, 'leaderboard': [{'id': 'demo1', 'name': 'Miran M.', 'totalDistance': 0, 'totalRides': 0}]},
    '/api/notifications': lambda: [], '/api/achievements': lambda: {'earned': [], 'newlyEarned': []},
    '/api/sos': lambda: {'ok': True}, '/api/seed': lambda: {'seeded': False},
    '/api/leaderboard': lambda: [], '/api/rides': lambda: [], '/api/routes': lambda: [],
    '/api/comments': lambda: [], '/api/settings': lambda: {'unitSystem': 'metric', 'autoPauseEnabled': True, 'autoPauseSpeedThreshold': 5, 'wakelockEnabled': True, 'hideStartEnd': False},
    '/api/stats': lambda: {'totalRides': 0, 'totalDistance': 0, 'totalDuration': 0, 'avgSpeed': 0, 'maxSpeed': 0},
    '/api/weather': lambda: None, '/api/fuel': lambda: [], '/api/fuel-prices': lambda: [],
    '/api/balkan-roads': lambda: [], '/api/events': lambda: [], '/api/challenges': lambda: [],
    '/api/favorites': lambda: [], '/api/friends': lambda: [],
    '/api/ride-score': lambda: {'score': 0, 'breakdown': {}}, '/api/curvy-roads': lambda: [],
    '/api/map-styles': lambda: [], '/api/camps': lambda: [], '/api/expenses': lambda: [],
    '/api/videos': lambda: [], '/api/subscription': lambda: {'plan': 'free'},
}

class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        path = self.path.split('?')[0]
        try:
            if path in ('/', ''):
                self._send(200, INDEX_HTML, 'text/html; charset=utf-8', 60)
            elif path.startswith('/_next/static/'):
                fp = os.path.join(BASE, '.next', 'static', path.replace('/_next/static/', ''))
                r = load_file(fp)
                if r: self._send(200, r[0], r[1], 31536000)
                else: self._send(404, b'Not Found', 'text/plain', 0)
            elif path.startswith('/api/'):
                h = API.get(path)
                d = h() if h else None
                self._send(200, json.dumps({'data': d}).encode(), 'application/json', 0)
            elif path == '/sw.js':
                r = load_file(os.path.join(BASE, 'public', 'sw.js'))
                if r: self._send(200, r[0], 'application/javascript', 0)
                else: self._send(200, b'self.addEventListener("fetch",function(){});', 'application/javascript', 0)
            else:
                fp = os.path.join(BASE, 'public', path.lstrip('/'))
                r = load_file(fp)
                if r: self._send(200, r[0], r[1], 3600)
                else: self._send(200, INDEX_HTML, 'text/html; charset=utf-8', 60)
        except Exception as e:
            try: self._send(500, b'Error', 'text/plain', 0)
            except: pass
    
    def do_POST(self):
        path = self.path.split('?')[0]
        try:
            if path.startswith('/api/'):
                h = API.get(path)
                d = h() if h else None
                self._send(200, json.dumps({'data': d}).encode(), 'application/json', 0)
            else:
                self._send(200, b'{"data":null}', 'application/json', 0)
        except: pass
    
    def _send(self, code, data, ct, max_age):
        try:
            self.send_response(code)
            self.send_header('Content-Type', ct)
            self.send_header('Content-Length', str(len(data)))
            self.send_header('Cache-Control', f'public, max-age={max_age}')
            self.send_header('Connection', 'close')
            self.end_headers()
            self.wfile.write(data)
        except: pass
    
    def log_message(self, *a): pass

class ThreadedServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True
    daemon_threads = True
    request_queue_size = 10

if __name__ == '__main__':
    count = preload()
    print(f'> MotoTrack Threaded on :{PORT} | {count} files')
    server = ThreadedServer(('', PORT), Handler)
    server.serve_forever()
