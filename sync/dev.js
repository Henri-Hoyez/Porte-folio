'use strict';

// Développement uniquement : sert le site statique et le relais sur un
// seul port, pour tester la synchronisation sans nginx.
//   node sync/dev.js   →  http://localhost:8080/hydratation.html

const http = require('http');
const fs = require('fs');
const path = require('path');
const { handler } = require('./server');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT) || 8080;
const PREFIX = '/api/hydratation';

const TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml'
};

http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith(PREFIX + '/')) {
        req.url = url.pathname.slice(PREFIX.length) + url.search;
        return handler(req, res);
    }
    const rel = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const file = path.normalize(path.join(ROOT, rel));
    if (!file.startsWith(ROOT + path.sep)) {
        res.writeHead(403);
        return res.end();
    }
    fs.readFile(file, (err, data) => {
        if (err) {
            res.writeHead(404);
            return res.end();
        }
        res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
        res.end(data);
    });
}).listen(PORT, () => console.log('dev → http://localhost:' + PORT + '/hydratation.html'));
