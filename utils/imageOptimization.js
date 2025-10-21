// Vercel Image Optimization utilities
const { ImageResponse } = require('@vercel/og');

// Image optimization helper
const optimizeImage = (src, width = 800, quality = 75) => {
    // Use Vercel's built-in image optimization
    return `/_vercel/image?url=${encodeURIComponent(src)}&w=${width}&q=${quality}`;
};

// Generate optimized image URLs
const getOptimizedImage = (src, options = {}) => {
    const {
        width = 800,
        height,
        quality = 75,
        format = 'webp'
    } = options;
    
    let url = `/_vercel/image?url=${encodeURIComponent(src)}&w=${width}&q=${quality}`;
    
    if (height) url += `&h=${height}`;
    if (format) url += `&f=${format}`;
    
    return url;
};

// Lazy loading image component
const createLazyImage = (src, alt, className = '', options = {}) => {
    const optimizedSrc = getOptimizedImage(src, options);
    const placeholder = getOptimizedImage(src, { ...options, quality: 10, width: 50 });
    
    return `
        <img 
            src="${placeholder}" 
            data-src="${optimizedSrc}" 
            alt="${alt}" 
            class="lazy-load ${className}"
            loading="lazy"
            style="transition: opacity 0.3s ease;"
        />
    `;
};

module.exports = {
    optimizeImage,
    getOptimizedImage,
    createLazyImage
};
