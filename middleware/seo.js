/**
 * SEO Middleware
 * Injects SEO metadata into request for rendering
 */

const getBaseUrl = (req) => {
    if (process.env.BASE_URL) {
        return process.env.BASE_URL;
    }
    
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const host = req.headers['host'] || req.get('host') || 'ventureglobal.com';
    
    return `${protocol}://${host}`;
};

const seoMiddleware = (req, res, next) => {
    const baseUrl = getBaseUrl(req);
    const currentPath = req.originalUrl || req.path || '/';
    
    // Set default SEO values
    res.locals.baseUrl = baseUrl;
    res.locals.currentPath = currentPath;
    res.locals.seoTitle = null; // Will be set per page
    res.locals.seoDescription = null; // Will be set per page
    res.locals.seoKeywords = null; // Will be set per page
    res.locals.canonicalUrl = baseUrl + currentPath;
    res.locals.ogUrl = baseUrl + currentPath;
    res.locals.ogTitle = null;
    res.locals.ogDescription = null;
    res.locals.ogImage = baseUrl + '/images/logos/venture-global-logo.png';
    res.locals.ogType = 'website';
    res.locals.schemaType = 'EducationalOrganization';
    
    next();
};

module.exports = seoMiddleware;
