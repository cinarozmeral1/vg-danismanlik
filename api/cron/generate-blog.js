// Vercel Cron Job - Generate Blog Post Every 3 Days
// Schedule: "0 9 */3 * *" (Every 3 days at 09:00 UTC)
// 
// Bu endpoint external cron service (cron-job.org veya GitHub Actions) tarafından çağrılabilir
// Güvenlik için CRON_SECRET gereklidir

const { generateBlogPost } = require('../../services/blogAIService');

// CRON_SECRET for secure external access
const CRON_SECRET = process.env.CRON_SECRET;

module.exports = async (req, res) => {
    console.log('🔔🔔🔔 CRON ENDPOINT CALLED 🔔🔔🔔');
    console.log('⏰ Timestamp:', new Date().toISOString());
    console.log('📡 Method:', req.method);
    
    // Check authorization
    const isVercelCron = !!req.headers['x-vercel-cron'];
    const providedSecret = req.query.secret || req.headers['x-cron-secret'] || req.headers['authorization']?.replace('Bearer ', '');
    const isAuthorized = isVercelCron || (CRON_SECRET && providedSecret === CRON_SECRET);
    
    console.log('🔐 Authorization check:', {
        isVercelCron,
        hasSecret: !!CRON_SECRET,
        secretProvided: !!providedSecret,
        isAuthorized
    });
    
    // Allow GET for health check, POST for actual generation
    if (req.method === 'GET' && !providedSecret && !isVercelCron) {
        return res.status(200).json({
            success: true,
            message: 'Blog cron endpoint is active',
            timestamp: new Date().toISOString(),
            hint: 'Use POST with ?secret=YOUR_CRON_SECRET to generate a blog post'
        });
    }
    
    // Verify authorization for blog generation
    if (!isAuthorized) {
        console.warn('⛔ Unauthorized cron request');
        return res.status(401).json({
            success: false,
            error: 'Unauthorized. Provide valid CRON_SECRET.',
            timestamp: new Date().toISOString()
        });
    }
    
    console.log('📝 Starting scheduled blog generation...');
    
    try {
        const startTime = Date.now();
        
        // Generate new blog post
        const post = await generateBlogPost();
        
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        
        console.log('✅ Blog post generated successfully');
        console.log('📄 Title:', post.title_tr);
        console.log('🔗 Slug:', post.slug);
        console.log('⏱️ Duration:', duration, 'seconds');
        
        res.status(200).json({
            success: true,
            message: 'Blog post generated successfully',
            post: {
                id: post.id,
                title: post.title_tr,
                slug: post.slug,
                url: `/blog/${post.slug}`
            },
            duration: `${duration}s`,
            timestamp: new Date().toISOString(),
            source: isVercelCron ? 'vercel-cron' : 'external-cron'
        });
        
    } catch (error) {
        console.error('❌ Blog generation failed:', error);
        
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
};

