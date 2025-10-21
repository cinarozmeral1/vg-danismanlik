const { minify } = require('html-minifier-terser');

const minifyOptions = {
    removeComments: true,
    removeCommentsFromCDATA: true,
    removeCDATASectionsFromCDATA: true,
    collapseWhitespace: true,
    collapseBooleanAttributes: true,
    removeAttributeQuotes: true,
    removeRedundantAttributes: true,
    useShortDoctype: true,
    removeEmptyAttributes: true,
    removeOptionalTags: true,
    removeEmptyElements: false,
    lint: false,
    keepClosingSlash: true,
    caseSensitive: true,
    minifyURLs: false,
    minifyCSS: true,
    minifyJS: true,
    minifyConditionalComments: true,
    removeScriptTypeAttributes: true,
    removeStyleLinkTypeAttributes: true,
    sortAttributes: true,
    sortClassName: true
};

const htmlMinifier = (req, res, next) => {
    // Only minify in production
    if (process.env.NODE_ENV !== 'production') {
        return next();
    }

    const originalSend = res.send;
    
    res.send = function(data) {
        if (typeof data === 'string' && data.includes('<!DOCTYPE html>')) {
            minify(data, minifyOptions)
                .then(minified => {
                    originalSend.call(this, minified);
                })
                .catch(err => {
                    console.error('HTML minification error:', err);
                    originalSend.call(this, data);
                });
        } else {
            originalSend.call(this, data);
        }
    };
    
    next();
};

module.exports = htmlMinifier;
