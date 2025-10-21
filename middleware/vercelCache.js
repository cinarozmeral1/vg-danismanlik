// Vercel Edge Caching middleware
const { NextRequest, NextResponse } = require('next/server');

const vercelCacheMiddleware = (req, res, next) => {
    // Set Vercel-specific cache headers
    if (req.url.startsWith('/css/') || req.url.startsWith('/js/') || req.url.startsWith('/images/')) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.setHeader('Vercel-CDN-Cache-Control', 'public, max-age=31536000, immutable');
        res.setHeader('Vercel-Cache-Tag', 'static-assets');
    }
    
    // API routes caching
    if (req.url.startsWith('/api/')) {
        res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
        res.setHeader('Vercel-CDN-Cache-Control', 'public, max-age=300, s-maxage=300');
    }
    
    // HTML pages caching
    if (req.url === '/' || req.url.startsWith('/about') || req.url.startsWith('/services')) {
        res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
        res.setHeader('Vercel-CDN-Cache-Control', 'public, max-age=3600, s-maxage=3600');
    }
    
    next();
};

module.exports = vercelCacheMiddleware;
