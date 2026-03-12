// Blog Routes - SEO Optimized Blog with AI-Generated Content
const express = require('express');
const router = express.Router();
const { getBlogPosts, getBlogPostBySlug, getBlogPostCount, getRelatedPosts, generateBlogPost } = require('../services/blogAIService');

const COUNTRY_SIDEBAR_DATA = {
    'Czech Republic': { slug: 'czech', tr: 'Çek Cumhuriyeti', en: 'Czech Republic', flag: '🇨🇿' },
    'Italy': { slug: 'italy', tr: 'İtalya', en: 'Italy', flag: '🇮🇹' },
    'UK': { slug: 'uk', tr: 'İngiltere', en: 'United Kingdom', flag: '🇬🇧' },
    'Germany': { slug: 'germany', tr: 'Almanya', en: 'Germany', flag: '🇩🇪' },
    'Austria': { slug: 'austria', tr: 'Avusturya', en: 'Austria', flag: '🇦🇹' },
    'Hungary': { slug: 'hungary', tr: 'Macaristan', en: 'Hungary', flag: '🇭🇺' },
    'Poland': { slug: 'poland', tr: 'Polonya', en: 'Poland', flag: '🇵🇱' },
    'Netherlands': { slug: 'netherlands', tr: 'Hollanda', en: 'Netherlands', flag: '🇳🇱' }
};

async function buildSidebarLinks(post, lang) {
    const countryData = COUNTRY_SIDEBAR_DATA[post.related_country];
    const links = {};
    if (countryData) {
        const countryName = lang === 'tr' ? countryData.tr : countryData.en;
        links.studentLife = {
            url: `/student-life/${countryData.slug}`,
            label: lang === 'tr' ? `${countryName}'de Öğrenci Hayatı` : `Student Life in ${countryName}`,
            icon: 'fas fa-globe-europe',
            flag: countryData.flag
        };
    }
    if (post.related_university_id) {
        let uniUrl = `/c/${post.related_university_id}`;
        try {
            const slugResult = await pool.query('SELECT slug FROM universities WHERE id = $1', [post.related_university_id]);
            if (slugResult.rows.length > 0 && slugResult.rows[0].slug) {
                uniUrl = `/universities/${slugResult.rows[0].slug}`;
            }
        } catch (e) { /* fallback to /c/ */ }
        links.universityDetail = {
            url: uniUrl,
            label: lang === 'tr' ? 'Üniversite Detayları' : 'University Details',
            icon: 'fas fa-university'
        };
    }
    return links;
}

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
        
        const sidebarLinks = await buildSidebarLinks(post, lang);

        res.render('blog/article', {
            title: `${displayPost.title} | Venture Global`,
            metaDescription: displayPost.metaDescription,
            metaKeywords: displayPost.keywords,
            canonicalUrl: `https://ventureglobal.com.tr/blog/${slug}`,
            ogImage: displayPost.image,
            structuredData: JSON.stringify(structuredData),
            post: displayPost,
            relatedPosts: displayRelated,
            sidebarLinks,
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
 * GET /blog/preview/:id - Admin-only preview for draft/unpublished posts
 */
router.get('/preview/:id', async (req, res) => {
    if (!res.locals.isLoggedIn || !res.locals.isAdmin) {
        return res.status(403).send('Yetkiniz yok.');
    }

    try {
        const { Pool } = require('pg');
        const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });
        const result = await pool.query('SELECT * FROM blog_posts WHERE id = $1', [req.params.id]);

        if (result.rows.length === 0) {
            return res.status(404).send('Makale bulunamadı.');
        }

        const post = result.rows[0];
        const lang = res.locals.currentLanguage || 'tr';

        const displayPost = {
            id: post.id,
            title: lang === 'tr' ? post.title_tr : post.title_en,
            content: lang === 'tr' ? post.content_tr : post.content_en,
            excerpt: lang === 'tr' ? post.excerpt_tr : post.excerpt_en,
            slug: post.slug,
            image: post.featured_image_url,
            topic: post.topic_type,
            country: post.related_country,
            date: post.published_at ? formatDate(post.published_at, lang) : 'TASLAK',
            views: post.view_count || 0,
            metaDescription: lang === 'tr' ? post.meta_description_tr : post.meta_description_en,
            keywords: post.keywords
        };

        const sidebarLinks = await buildSidebarLinks(post, lang);

        res.render('blog/article', {
            title: `[ÖNIZLEME] ${displayPost.title}`,
            metaDescription: displayPost.metaDescription,
            metaKeywords: displayPost.keywords,
            canonicalUrl: '',
            ogImage: displayPost.image,
            structuredData: '{}',
            post: displayPost,
            relatedPosts: [],
            sidebarLinks,
            lang
        });
    } catch (error) {
        console.error('Preview error:', error);
        res.status(500).send('Önizleme yüklenemedi: ' + error.message);
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
        const isDraft = req.body && req.body.draft === true;
        console.log(`📝 Manual blog generation triggered by admin (draft: ${isDraft})`);
        const post = await generateBlogPost({ draft: isDraft });
        
        res.json({
            success: true,
            message: isDraft ? 'Draft blog post generated (not published)' : 'Blog post generated',
            post: {
                id: post.id,
                title: post.title_tr,
                slug: post.slug,
                is_published: post.is_published,
                url: post.is_published ? `/blog/${post.slug}` : null,
                content_tr_preview: post.content_tr ? post.content_tr.substring(0, 500) : '',
                content_en_preview: post.content_en ? post.content_en.substring(0, 500) : ''
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

