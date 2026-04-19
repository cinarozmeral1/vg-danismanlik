#!/usr/bin/env node
require('dotenv').config();

const { generateBlogPost } = require('../services/blogAIService');

(async () => {
    try {
        console.log('Generating test draft blog post with internal links...\n');
        const post = await generateBlogPost({ draft: true });
        
        console.log('\n========== TEST DRAFT BLOG POST ==========');
        console.log('ID:', post.id);
        console.log('Title TR:', post.title_tr);
        console.log('Title EN:', post.title_en);
        console.log('Slug:', post.slug);
        console.log('Published:', post.is_published);
        console.log('Country:', post.related_country);
        console.log('University ID:', post.related_university_id);
        
        console.log('\n--- Turkish Content (first 1000 chars) ---');
        console.log(post.content_tr?.substring(0, 1000));
        
        console.log('\n--- English Content (first 1000 chars) ---');
        console.log(post.content_en?.substring(0, 1000));
        
        // Check for internal links
        const trHasStudentLife = post.content_tr?.includes('/ogrenci-yasami/');
        const trHasUniDetail = post.content_tr?.includes('/universities/') || post.content_tr?.includes('/c/');
        const enHasStudentLife = post.content_en?.includes('/ogrenci-yasami/');
        const enHasUniDetail = post.content_en?.includes('/universities/') || post.content_en?.includes('/c/');
        
        console.log('\n--- Internal Links Check ---');
        console.log('TR - Student Life link:', trHasStudentLife ? 'FOUND' : 'MISSING');
        console.log('TR - University Detail link:', trHasUniDetail ? 'FOUND' : 'MISSING');
        console.log('EN - Student Life link:', enHasStudentLife ? 'FOUND' : 'MISSING');
        console.log('EN - University Detail link:', enHasUniDetail ? 'FOUND' : 'MISSING');
        
        console.log('\n==========================================');
        console.log('Draft saved with ID:', post.id, '(not published)');
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
})();
