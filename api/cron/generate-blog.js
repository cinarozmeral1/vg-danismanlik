// Vercel Cron Job - Generate Blog Post Every 3 Days
// Schedule: "0 9 */3 * *" (Every 3 days at 09:00 UTC)

const { generateBlogPost } = require('../../services/blogAIService');

module.exports = async function handler(req, res) {
    // Verify this is a legitimate cron request
    const authHeader = req.headers.authorization;
    
    // Check for Vercel cron secret (optional but recommended)
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        // Also allow direct calls for testing
        if (req.query.secret !== process.env.CRON_SECRET && !req.query.test) {
            console.log('⚠️ Unauthorized cron attempt');
            return res.status(401).json({ error: 'Unauthorized' });
        }
    }
    
    console.log('📝 Starting scheduled blog generation...');
    console.log('⏰ Timestamp:', new Date().toISOString());
    
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
            timestamp: new Date().toISOString()
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

