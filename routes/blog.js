// Blog Routes - SEO Optimized Blog with AI-Generated Content
const express = require('express');
const router = express.Router();
const { getBlogPosts, getBlogPostBySlug, getBlogPostCount, getRelatedPosts, generateBlogPost } = require('../services/blogAIService');

/**
 * GET /blog - Blog listing page
 */
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 12;
        const offset = (page - 1) * limit;
        const lang = res.locals.currentLanguage || 'tr';
        
        const posts = await getBlogPosts(limit, offset);
        const totalCount = await getBlogPostCount();
        const totalPages = Math.ceil(totalCount / limit);
        
        // Prepare posts for display
        const displayPosts = posts.map(post => ({
            id: post.id,
            title: lang === 'tr' ? post.title_tr : post.title_en,
            excerpt: lang === 'tr' ? post.excerpt_tr : post.excerpt_en,
            slug: post.slug,
            image: post.featured_image_url || 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=400&q=80',
            topic: post.topic_type,
            country: post.related_country,
            date: formatDate(post.published_at, lang),
            views: post.view_count || 0
        }));
        
        res.render('blog/index', {
            title: lang === 'tr' ? 'Blog | Venture Global' : 'Blog | Venture Global',
            metaDescription: lang === 'tr' 
                ? 'Yurtdışı eğitim, Avrupa üniversiteleri ve kariyer fırsatları hakkında güncel makaleler. Venture Global Eğitim Danışmanlığı blog sayfası.'
                : 'Latest articles about studying abroad, European universities and career opportunities. Venture Global Education Consultancy blog.',
            posts: displayPosts,
            currentPage: page,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
            lang
        });
        
    } catch (error) {
        console.error('Blog list error:', error);
        res.status(500).render('error', {
            title: 'Hata',
            message: 'Blog yüklenirken bir hata oluştu'
        });
    }
});

/**
 * GET /blog/:slug - Single blog post
 */
router.get('/:slug', async (req, res) => {
    try {
        const { slug } = req.params;
        const lang = res.locals.currentLanguage || 'tr';
        
        const post = await getBlogPostBySlug(slug);
        
        if (!post) {
            return res.status(404).render('error', {
                title: '404',
                message: lang === 'tr' ? 'Makale bulunamadı' : 'Article not found'
            });
        }
        
        // Get related posts
        const relatedPosts = await getRelatedPosts(post, 3);
        
        // Prepare display data
        const displayPost = {
            id: post.id,
            title: lang === 'tr' ? post.title_tr : post.title_en,
            content: lang === 'tr' ? post.content_tr : post.content_en,
            excerpt: lang === 'tr' ? post.excerpt_tr : post.excerpt_en,
            slug: post.slug,
            image: post.featured_image_url,
            topic: post.topic_type,
            country: post.related_country,
            date: formatDate(post.published_at, lang),
            views: post.view_count || 0,
            metaDescription: lang === 'tr' ? post.meta_description_tr : post.meta_description_en,
            keywords: post.keywords
        };
        
        const displayRelated = relatedPosts.map(p => ({
            title: lang === 'tr' ? p.title_tr : p.title_en,
            excerpt: lang === 'tr' ? p.excerpt_tr : p.excerpt_en,
            slug: p.slug,
            image: p.featured_image_url || 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=400&q=80'
        }));
        
        // Structured data for SEO (JSON-LD)
        const structuredData = {
            "@context": "https://schema.org",
            "@type": "Article",
            "headline": displayPost.title,
            "description": displayPost.metaDescription,
            "image": displayPost.image,
            "datePublished": post.published_at,
            "dateModified": post.updated_at || post.published_at,
            "author": {
                "@type": "Organization",
                "name": "Venture Global Eğitim Danışmanlığı",
                "url": "https://ventureglobal.com.tr"
            },
            "publisher": {
                "@type": "Organization",
                "name": "Venture Global",
                "logo": {
                    "@type": "ImageObject",
                    "url": "https://ventureglobal.com.tr/images/logos/venture-global-logo.png"
                }
            },
            "mainEntityOfPage": {
                "@type": "WebPage",
                "@id": `https://ventureglobal.com.tr/blog/${slug}`
            }
        };
        
        res.render('blog/article', {
            title: `${displayPost.title} | Venture Global`,
            metaDescription: displayPost.metaDescription,
            metaKeywords: displayPost.keywords,
            canonicalUrl: `https://ventureglobal.com.tr/blog/${slug}`,
            ogImage: displayPost.image,
            structuredData: JSON.stringify(structuredData),
            post: displayPost,
            relatedPosts: displayRelated,
            lang
        });
        
    } catch (error) {
        console.error('Blog post error:', error);
        res.status(500).render('error', {
            title: 'Hata',
            message: 'Makale yüklenirken bir hata oluştu'
        });
    }
});

/**
 * POST /blog/generate - Manual trigger for blog generation (admin only)
 */
router.post('/generate', async (req, res) => {
    // Check if user is admin
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    
    try {
        console.log('📝 Manual blog generation triggered by admin');
        const post = await generateBlogPost();
        
        res.json({
            success: true,
            message: 'Blog post generated',
            post: {
                id: post.id,
                title: post.title_tr,
                slug: post.slug,
                url: `/blog/${post.slug}`
            }
        });
    } catch (error) {
        console.error('Manual blog generation failed:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Format date for display
 */
function formatDate(date, lang) {
    if (!date) return '';
    
    const d = new Date(date);
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    
    return d.toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US', options);
}

module.exports = router;

