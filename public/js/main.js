// Venture Global - Optimized Main JavaScript File

// Performance optimizations
const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

const throttle = (func, limit) => {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
};

// Hero Background Image Rotation
class HeroBackgroundRotator {
    constructor() {
        this.currentIndex = 0;
        this.images = [];
        this.interval = null;
        this.rotationTime = 5000; // 5 seconds
    }
    
    init() {
        this.images = document.querySelectorAll('.hero-bg-img');
        console.log('Hero Background Rotator initialized with', this.images.length, 'images');
        if (this.images.length > 0) {
            // Set first image as active
            this.images[0].classList.add('active');
            console.log('First image set as active');
            this.startRotation();
        } else {
            console.log('No hero background images found');
        }
    }
    
    startRotation() {
        if (this.images.length <= 1) return;
        
        this.interval = setInterval(() => {
            this.rotateImage();
        }, this.rotationTime);
    }
    
    rotateImage() {
        // Remove active class from current image
        this.images[this.currentIndex].classList.remove('active');
        
        // Move to next image
        this.currentIndex = (this.currentIndex + 1) % this.images.length;
        
        // Add active class to new image
        this.images[this.currentIndex].classList.add('active');
    }
    
    stopRotation() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }
}

// Enhanced animation utilities
const AnimationUtils = {
    fadeIn: (element, duration = 300) => {
        element.style.opacity = '0';
        element.style.transform = 'translateY(20px)';
        element.style.transition = `all ${duration}ms cubic-bezier(0.4, 0, 0.2, 1)`;
        
        requestAnimationFrame(() => {
            element.style.opacity = '1';
            element.style.transform = 'translateY(0)';
        });
    },
    
    slideIn: (element, direction = 'left', duration = 300) => {
        const transform = direction === 'left' ? 'translateX(-30px)' : 'translateX(30px)';
        element.style.opacity = '0';
        element.style.transform = transform;
        element.style.transition = `all ${duration}ms cubic-bezier(0.4, 0, 0.2, 1)`;
        
        requestAnimationFrame(() => {
            element.style.opacity = '1';
            element.style.transform = 'translateX(0)';
        });
    },
    
    scaleIn: (element, duration = 300) => {
        element.style.opacity = '0';
        element.style.transform = 'scale(0.9)';
        element.style.transition = `all ${duration}ms cubic-bezier(0.4, 0, 0.2, 1)`;
        
        requestAnimationFrame(() => {
            element.style.opacity = '1';
            element.style.transform = 'scale(1)';
        });
    }
};

// Enhanced intersection observer for animations
class AnimationObserver {
    constructor() {
        this.observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        this.animateElement(entry.target);
                    }
                });
            },
            {
                threshold: 0.1,
                rootMargin: '0px 0px -50px 0px'
            }
        );
    }
    
    observe(elements) {
        if (Array.isArray(elements)) {
            elements.forEach(el => this.observer.observe(el));
        } else {
            this.observer.observe(elements);
        }
    }
    
    animateElement(element) {
        const animationType = element.dataset.animation || 'fadeIn';
        const delay = parseInt(element.dataset.delay) || 0;
        
        setTimeout(() => {
            switch (animationType) {
                case 'fadeIn':
                    AnimationUtils.fadeIn(element);
                    break;
                case 'slideInLeft':
                    AnimationUtils.slideIn(element, 'left');
                    break;
                case 'slideInRight':
                    AnimationUtils.slideIn(element, 'right');
                    break;
                case 'scaleIn':
                    AnimationUtils.scaleIn(element);
                    break;
            }
            element.classList.add('animated');
        }, delay);
    }
}

// Enhanced page transitions
class PageTransitions {
    constructor() {
        this.init();
    }
    
    init() {
        // Add page transition class to body
        document.body.classList.add('page-transition');
        
        // Handle page transitions
        this.handlePageTransitions();
    }
    
    handlePageTransitions() {
        // Show loading state for form submissions
        document.addEventListener('submit', (e) => {
            if (e.target.tagName === 'FORM') {
                document.body.classList.add('loading');
            }
        });
        
        // Remove loading state after form submission
        document.addEventListener('DOMContentLoaded', () => {
            document.body.classList.remove('loading');
        });
    }
}

// Enhanced smooth scrolling
class SmoothScroller {
    constructor() {
        this.init();
    }
    
    init() {
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', this.handleSmoothScroll.bind(this));
        });
    }
    
    handleSmoothScroll(e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            const offsetTop = target.offsetTop - 80; // Account for fixed navbar
            
            window.scrollTo({
                top: offsetTop,
                behavior: 'smooth'
            });
        }
    }
}

// Enhanced form handlers with better UX
class FormHandler {
    constructor() {
        this.init();
    }
    
    init() {
        this.initAssessmentForm();
        this.initContactForm();
        this.initUniversityFilter();
    }
    
    initAssessmentForm() {
        const assessmentForm = document.getElementById('assessmentForm');
        const detailedAssessmentForm = document.getElementById('detailedAssessmentForm');
        
        if (assessmentForm) {
            assessmentForm.addEventListener('submit', this.handleAssessmentSubmit.bind(this));
        }
        
        if (detailedAssessmentForm) {
            detailedAssessmentForm.addEventListener('submit', this.handleDetailedAssessmentSubmit.bind(this));
        }
    }
    
    initContactForm() {
        const contactForm = document.getElementById('contactForm');
        
        if (contactForm) {
            contactForm.addEventListener('submit', this.handleContactSubmit.bind(this));
        }
    }
    
    initUniversityFilter() {
        const filterButton = document.querySelector('button[onclick="filterUniversities()"]');
        
        if (filterButton) {
            filterButton.addEventListener('click', (e) => {
                e.preventDefault();
                this.filterUniversities();
            });
        }
    }
    
    async handleAssessmentSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const formData = new FormData(form);
        const data = Object.fromEntries(formData);
        
        // Debug: Form verilerini console'a yazdır
        console.log('Form verileri:', data);
        
        // Enhanced loading state
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Gönderiliyor...';
        submitBtn.disabled = true;
        
        try {
            console.log('API\'ye gönderiliyor:', JSON.stringify(data));
            const response = await fetch('/api/assessment', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });
            
            console.log('API yanıtı:', response.status);
            const result = await response.json();
            console.log('API sonucu:', result);
            
            if (result.success) {
                this.showSuccessMessage(result.message || 'Değerlendirmeniz başarıyla alındı!');
                form.reset(); // Formu temizle
            } else {
                this.showErrorMessage(result.error || 'Bir hata oluştu.');
            }
        } catch (error) {
            console.error('Form gönderme hatası:', error);
            this.showErrorMessage('Bağlantı hatası. Lütfen tekrar deneyin.');
        } finally {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    }
    
    async handleDetailedAssessmentSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const formData = new FormData(form);
        const data = Object.fromEntries(formData);
        
        // Enhanced loading state with animation
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Değerlendiriliyor...';
        submitBtn.disabled = true;
        submitBtn.classList.add('loading');
        
        try {
            // Kullanıcının seçtiği dili al
            const userLanguage = document.cookie.split('; ').find(row => row.startsWith('language='))?.split('=')[1] || 'tr';
            
            console.log('API\'ye gönderiliyor:', JSON.stringify(data));
            const response = await fetch('/api/assessment', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });
            
            console.log('API yanıtı:', response.status);
            const result = await response.json();
            console.log('API sonucu:', result);
            
            if (result.success) {
                this.showSuccessMessage(result.message || 'Değerlendirmeniz başarıyla alındı!');
                form.reset(); // Formu temizle
            } else {
                this.showErrorMessage(result.error || 'Bir hata oluştu.');
            }
        } catch (error) {
            console.error('Form gönderme hatası:', error);
            this.showErrorMessage('Bağlantı hatası. Lütfen tekrar deneyin.');
        } finally {
            // Reset button with smooth transition
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
            submitBtn.classList.remove('loading');
            
            // Smooth scroll to results
            const resultsSection = document.getElementById('assessmentResults');
            if (resultsSection) {
                resultsSection.style.display = 'block';
                resultsSection.scrollIntoView({ 
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        }, 2000);
    }
    
    async handleContactSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const formData = new FormData(form);
        const data = Object.fromEntries(formData);
        
        // Enhanced loading state
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Gönderiliyor...';
        submitBtn.disabled = true;
        
        try {
            const response = await fetch('/api/contact', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showSuccessMessage('Mesajınız başarıyla gönderildi!');
                form.reset();
            } else {
                this.showErrorMessage(result.error || 'Bir hata oluştu.');
            }
        } catch (error) {
            this.showErrorMessage('Bağlantı hatası. Lütfen tekrar deneyin.');
        } finally {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    }
    
    displayAssessmentResults(recommendations) {
        const container = document.getElementById('assessmentResults');
        if (!container) return;
        
        container.innerHTML = `
            <div class="row">
                <div class="col-lg-4 mb-4">
                    <div class="card h-100 shadow scale-in">
                        <div class="card-header bg-primary text-white">
                            <h5 class="mb-0"><i class="fas fa-university me-2"></i>Önerilen Üniversiteler</h5>
                        </div>
                        <div class="card-body">
                            <ul class="list-unstyled">
                                ${recommendations.universities.map(uni => `<li><i class="fas fa-check text-success me-2"></i>${uni}</li>`).join('')}
                            </ul>
                        </div>
                    </div>
                </div>
                <div class="col-lg-4 mb-4">
                    <div class="card h-100 shadow scale-in" style="animation-delay: 0.2s;">
                        <div class="card-header bg-success text-white">
                            <h5 class="mb-0"><i class="fas fa-file-alt me-2"></i>Gerekli Belgeler</h5>
                        </div>
                        <div class="card-body">
                            <ul class="list-unstyled">
                                ${recommendations.documents.map(doc => `<li><i class="fas fa-check text-success me-2"></i>${doc}</li>`).join('')}
                            </ul>
                        </div>
                    </div>
                </div>
                <div class="col-lg-4 mb-4">
                    <div class="card h-100 shadow scale-in" style="animation-delay: 0.4s;">
                        <div class="card-header bg-info text-white">
                            <h5 class="mb-0"><i class="fas fa-euro-sign me-2"></i>Tahmini Maliyetler</h5>
                        </div>
                        <div class="card-body">
                            <p><strong>Öğrenim Ücreti:</strong> ${recommendations.estimatedCosts.tuition}</p>
                            <p><strong>Yaşam Maliyeti:</strong> ${recommendations.estimatedCosts.living}</p>
                            <p><strong>Toplam:</strong> ${recommendations.estimatedCosts.total}</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        container.style.display = 'block';
    }
    
    displayDetailedAssessmentResults(recommendations) {
        const container = document.getElementById('recommendationsContainer');
        if (!container) return;
        
        container.innerHTML = `
            <div class="col-lg-4 mb-4">
                <div class="card h-100 shadow scale-in">
                    <div class="card-header bg-primary text-white">
                        <h5 class="mb-0"><i class="fas fa-university me-2"></i>Önerilen Üniversiteler</h5>
                    </div>
                    <div class="card-body">
                        <ul class="list-unstyled">
                            ${recommendations.universities.map(uni => `<li><i class="fas fa-check text-success me-2"></i>${uni}</li>`).join('')}
                        </ul>
                    </div>
                </div>
            </div>
            <div class="col-lg-4 mb-4">
                <div class="card h-100 shadow scale-in" style="animation-delay: 0.2s;">
                    <div class="card-header bg-success text-white">
                        <h5 class="mb-0"><i class="fas fa-file-alt me-2"></i>Gerekli Belgeler</h5>
                    </div>
                    <div class="card-body">
                        <ul class="list-unstyled">
                            ${recommendations.documents.map(doc => `<li><i class="fas fa-check text-success me-2"></i>${doc}</li>`).join('')}
                        </ul>
                    </div>
                </div>
            </div>
            <div class="col-lg-4 mb-4">
                <div class="card h-100 shadow scale-in" style="animation-delay: 0.4s;">
                    <div class="card-header bg-info text-white">
                        <h5 class="mb-0"><i class="fas fa-euro-sign me-2"></i>Tahmini Maliyetler</h5>
                    </div>
                    <div class="card-body">
                        <p><strong>Öğrenim Ücreti:</strong> ${recommendations.estimatedCosts.tuition}</p>
                        <p><strong>Yaşam Maliyeti:</strong> ${recommendations.estimatedCosts.living}</p>
                        <p><strong>Toplam:</strong> ${recommendations.estimatedCosts.total}</p>
                    </div>
                </div>
            </div>
            <div class="col-12">
                <div class="card shadow scale-in" style="animation-delay: 0.6s;">
                    <div class="card-header bg-warning text-white">
                        <h5 class="mb-0"><i class="fas fa-calendar-alt me-2"></i>Zaman Çizelgesi</h5>
                    </div>
                    <div class="card-body">
                        <div class="row">
                            ${recommendations.timeline.map((step, index) => `
                                <div class="col-md-6 mb-2">
                                    <div class="d-flex align-items-center">
                                        <span class="badge bg-primary me-2">${index + 1}</span>
                                        <span>${step}</span>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    generateDetailedRecommendations(data) {
        const recommendations = {
            universities: [],
            languageSchools: [],
            documents: [],
            timeline: [],
            estimatedCosts: {}
        };
        
        // Generate recommendations based on form data
        if (data.targetCountry === 'germany') {
            recommendations.universities = [
                'Technical University of Munich',
                'Ludwig Maximilian University of Munich',
                'University of Heidelberg'
            ];
            recommendations.estimatedCosts = {
                tuition: '1,500€/yıl',
                living: '8,000-12,000€/yıl',
                total: '9,500-13,500€/yıl'
            };
        } else if (data.targetCountry === 'austria') {
            recommendations.universities = [
                'Vienna University of Technology',
                'University of Vienna',
                'TU Graz'
            ];
            recommendations.estimatedCosts = {
                tuition: '1,200€/yıl',
                living: '7,000-10,000€/yıl',
                total: '8,200-11,000€/yıl'
            };
        } else if (data.targetCountry === 'uk') {
            recommendations.universities = [
                'University of Oxford',
                'University of Cambridge',
                'Imperial College London'
            ];
            recommendations.estimatedCosts = {
                tuition: '20,000-30,000£/yıl',
                living: '15,000-20,000£/yıl',
                total: '35,000-50,000£/yıl'
            };
        } else if (data.targetCountry === 'italy') {
            recommendations.universities = [
                'University of Milan',
                'University of Rome "Tor Vergata"',
                'University of Turin'
            ];
            recommendations.estimatedCosts = {
                tuition: '1,000-1,500€/yıl',
                living: '6,000-8,000€/yıl',
                total: '7,000-9,500€/yıl'
            };
        }
        
        recommendations.documents = [
            'Pasaport kopyası',
            'Diploma ve transkript',
            'Dil yeterlilik belgesi',
            'Motivasyon mektubu',
            'Referans mektupları',
            'Finansal garanti belgesi'
        ];
        
        recommendations.timeline = [
            '3-6 ay önce: Dil sınavına hazırlık',
            '6 ay önce: Üniversite başvurusu',
            '3 ay önce: Vize başvurusu',
            '1 ay önce: Konaklama ayarlama',
            '1 hafta önce: Seyahat hazırlığı'
        ];
        
        return recommendations;
    }
    
    filterUniversities() {
        const educationLevel = document.getElementById('educationLevel').value;
        const country = document.getElementById('country').value;
        const program = document.getElementById('program').value;
        const budget = document.getElementById('budget').value;
        
        const cards = document.querySelectorAll('.university-card');
        
        cards.forEach(card => {
            const cardEducation = card.dataset.education;
            const cardCountry = card.dataset.country;
            const cardProgram = card.dataset.program;
            const cardBudget = card.dataset.budget;
            
            const educationMatch = !educationLevel || cardEducation.includes(educationLevel);
            const countryMatch = !country || cardCountry.includes(country);
            const programMatch = !program || cardProgram.includes(program);
            const budgetMatch = !budget || cardBudget.includes(budget);
            
            if (educationMatch && countryMatch && programMatch && budgetMatch) {
                card.style.display = 'block';
                AnimationUtils.fadeIn(card);
            } else {
                card.style.display = 'none';
            }
        });
    }
    
    showSuccessMessage(message) {
        const alertDiv = document.createElement('div');
        alertDiv.className = 'alert alert-success alert-dismissible fade show position-fixed';
        alertDiv.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
        alertDiv.innerHTML = `
            <i class="fas fa-check-circle me-2"></i>
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        document.body.appendChild(alertDiv);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.remove();
            }
        }, 5000);
    }
    
    showErrorMessage(message) {
        const alertDiv = document.createElement('div');
        alertDiv.className = 'alert alert-danger alert-dismissible fade show position-fixed';
        alertDiv.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
        alertDiv.innerHTML = `
            <i class="fas fa-exclamation-triangle me-2"></i>
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        document.body.appendChild(alertDiv);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.remove();
            }
        }, 5000);
    }
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize all enhanced components
    new PageTransitions();
    new SmoothScroller();
    new FormHandler();
    
    // Initialize hero background rotator
    const heroBackgroundRotator = new HeroBackgroundRotator();
    heroBackgroundRotator.init();
    
    // Initialize animation observer
    const animationObserver = new AnimationObserver();
    
    // Observe all cards and animated elements
    const animatedElements = document.querySelectorAll('.card, .animate-on-scroll');
    animationObserver.observe(animatedElements);
    
    // Add animation classes to cards
    document.querySelectorAll('.card').forEach((card, index) => {
        card.dataset.animation = 'fadeIn';
        card.dataset.delay = index * 100;
    });
    
    // Enhanced scroll performance
    let ticking = false;
    function updateScroll() {
        ticking = false;
        // Add any scroll-based animations here
    }
    
    function requestTick() {
        if (!ticking) {
            requestAnimationFrame(updateScroll);
            ticking = true;
        }
    }
    
    window.addEventListener('scroll', requestTick, { passive: true });
});

// Utility functions
function formatCurrency(amount, currency = '€') {
    return `${currency}${amount}`;
}

function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function validatePhone(phone) {
    const re = /^[\+]?[1-9][\d]{0,15}$/;
    return re.test(phone);
} 