// --- NOTIFICATION DATABASE ---
const notificationData = [
    { service: "SONG SHARE", title: "Simay shared a new song", details: "Theme: Minecraft", icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>', image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80" },
    { service: "SYSTEM", title: "Roadmap V2.0 Deployed", details: "Updates available", icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>', image: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=150&q=80" },
    { service: "COMMUNITY", title: "Metehan left a comment", details: "On your recent post", icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>', image: "https://raw.githubusercontent.com/onur02004/MainRoadmap/main/src/public/media/avatars/metehan/12.png" }
];

let currentNotifIndex = 0;

// --- CORE LOGIN LOGIC ---
function login(name) {
    const welcomeScreen = document.getElementById('welcome-screen');
    const dashboard = document.getElementById('dashboard');
    const usernameEl = document.getElementById('username');
    const bgWelcomeText = document.getElementById('bg-welcome-text'); 
    const notificationPanel = document.getElementById('notification-panel');
    const extendedUI = document.getElementById('extended-ui');
    const scrollIndicator = document.getElementById('scroll-indicator');

    welcomeScreen.style.transition = "opacity 0.6s ease, transform 0.6s ease";
    welcomeScreen.style.opacity = "0";
    welcomeScreen.style.transform = "scale(0.95)"; 

    setTimeout(() => {
        welcomeScreen.classList.add('hidden');
        dashboard.classList.remove('hidden');
        bgWelcomeText.classList.remove('hidden');

        dashboard.style.opacity = "0";
        dashboard.style.transform = "translateY(30px)";
        dashboard.style.transition = "opacity 0.8s ease, transform 0.8s cubic-bezier(0.2, 0.8, 0.2, 1)";
        
        void dashboard.offsetWidth;
        dashboard.style.opacity = "1";
        dashboard.style.transform = "translateY(0)";
        dashboard.classList.add('dashboard-active'); 

        updateNotificationContent(currentNotifIndex);
        setTimeout(() => notificationPanel.classList.remove('hidden-panel'), 800);

        setTimeout(() => {
            document.body.classList.add('scroll-enabled');
            extendedUI.classList.remove('hidden');
            scrollIndicator.classList.remove('hidden');
            initScrollObserver(); 
            
            // Initialize curved scrollbars ONLY AFTER UI is visible so math calculates correctly
            document.querySelectorAll('[data-scrollbar]').forEach(container => {
                initCurvedScrollbar(container);
            });

        }, 1200);

        usernameEl.textContent = "";
        let i = 0;
        const displayName = name.toLowerCase(); 
        
        function typeWriter() {
            if (i < displayName.length) {
                usernameEl.textContent += displayName.charAt(i);
                i++;
                setTimeout(typeWriter, 100);
            }
        }
        setTimeout(typeWriter, 700);

    }, 600); 
}
window.login = login;

// --- INTERACTIVE UI LOGIC ---
document.addEventListener('DOMContentLoaded', () => {
    
    document.getElementById('go-to-login-btn').addEventListener('click', () => {
        window.login("Onur"); 
    });

    // --- NEW: HOVER ENGINE FOR SPLIT MENU ---
    const menuOptions = document.querySelectorAll('.menu-option-btn');
    const viewerLayout = document.getElementById('viewer-container');
    const vImg = document.getElementById('explain-img');
    const vTag = document.getElementById('explain-tag');
    const vTitle = document.getElementById('explain-title');
    const vDesc = document.getElementById('explain-desc');

    menuOptions.forEach(btn => {
        btn.addEventListener('mouseenter', () => {
            // Manage Active State
            menuOptions.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Trigger Fade Animation
            viewerLayout.classList.add('fade-out');
            
            setTimeout(() => {
                // Populate new data
                vImg.src = btn.getAttribute('data-img');
                vTag.textContent = btn.getAttribute('data-tag');
                vTitle.textContent = btn.getAttribute('data-title');
                vDesc.textContent = btn.getAttribute('data-desc');
                
                // Fade back in
                viewerLayout.classList.remove('fade-out');
            }, 300); // Wait for CSS transition
        });
    });

    // --- Notification Setup ---
    const notifPanel = document.getElementById('notification-panel');
    const contentArea = document.getElementById('notif-content-area');
    const elIcon = document.getElementById('notif-icon');
    const elService = document.getElementById('notif-service');
    const elTitle = document.getElementById('notif-title');
    const elDetails = document.getElementById('notif-details');
    const elImage = document.getElementById('notif-image');

    window.updateNotificationContent = function(index) {
        contentArea.classList.add('fade-out'); 
        setTimeout(() => {
            const data = notificationData[index];
            elIcon.innerHTML = data.icon;
            elService.textContent = data.service;
            elTitle.textContent = data.title;
            elDetails.textContent = data.details;
            elImage.src = data.image;
            contentArea.classList.remove('fade-out'); 
        }, 300); 
    };

    document.getElementById('close-notif-btn').addEventListener('click', () => {
        notifPanel.classList.add('hidden-panel');
        notifPanel.style.pointerEvents = 'none'; 
    });
    document.getElementById('next-notif-btn').addEventListener('click', () => {
        currentNotifIndex = (currentNotifIndex + 1) % notificationData.length;
        updateNotificationContent(currentNotifIndex);
    });
    document.getElementById('prev-notif-btn').addEventListener('click', () => {
        currentNotifIndex = (currentNotifIndex - 1 + notificationData.length) % notificationData.length;
        updateNotificationContent(currentNotifIndex);
    });

    // --- 3D Hover Tilt Effects ---
    function apply3DTilt(element, intensity, popElements = false) {
        element.addEventListener('mousemove', (e) => {
            if(window.innerWidth > 768) { 
                const rect = element.getBoundingClientRect();
                const x = e.clientX - rect.left - rect.width / 2;
                const y = e.clientY - rect.top - rect.height / 2;
                const tiltX = -(y / rect.height) * intensity; 
                const tiltY = (x / rect.width) * intensity;
                element.style.transform = `perspective(1000px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale3d(1.02, 1.02, 1.02)`;

                if(popElements) {
                    const inners = element.querySelectorAll('.parallax-element');
                    inners.forEach((inner, index) => inner.style.transform = `translateZ(${(index + 1) * 20}px)`); 
                }
            }
        });

        element.addEventListener('mouseleave', () => {
            if(window.innerWidth > 768) {
                element.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;
                element.style.transition = `transform 0.5s ease-out`; 
                if(popElements) {
                    const inners = element.querySelectorAll('.parallax-element');
                    inners.forEach(inner => {
                        inner.style.transform = `translateZ(0px)`;
                        inner.style.transition = `transform 0.5s ease-out`;
                    });
                }
            }
        });

        element.addEventListener('mouseenter', () => {
            if(window.innerWidth > 768) {
                element.style.transition = `none`; 
                if(popElements) {
                    element.querySelectorAll('.parallax-element').forEach(inner => inner.style.transition = `none`);
                }
            }
        });
    }

    apply3DTilt(notifPanel, 15, false);
    apply3DTilt(document.getElementById('main-profile-card'), 20, true);
});

function initScrollObserver() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('in-view');
                document.getElementById('scroll-indicator').style.opacity = '0';
            } else {
                document.getElementById('scroll-indicator').style.opacity = '1';
            }
        });
    }, { threshold: 0.2 });

    document.querySelectorAll('.scroll-reveal').forEach(el => observer.observe(el));
}


// --- CUSTOM CURVED SCROLLBAR IMPLEMENTATION ---
function initCurvedScrollbar(container) {
    const content = container.querySelector('.scroll-content');
    if (!content) return;
    
    // Configuration
    const OFFSET = 7; 
    const EXTRA_INSET = 2;
    const MIN_START_RATIO = 0.8;
    const MIN_THUMB = 20;
    const SEGMENTS = 50;
    
    // SVG Creation
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.classList.add('scrollbar-svg');
    svg.setAttribute('aria-hidden', 'true');

    const trackPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    trackPath.classList.add('scrollbar-track');

    const thumbPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    thumbPath.classList.add('scrollbar-thumb');

    svg.appendChild(trackPath);
    svg.appendChild(thumbPath);
    container.appendChild(svg);
    
    // State
    let pathLength = 0;
    let thumbLength = 50;
    let dragging = false;
    let pointerId = null;

    function updatePath() {
        const w = container.clientWidth;
        const h = container.clientHeight;
        const r = parseFloat(getComputedStyle(container).borderRadius) || 40; // Defaulting to our 40px radius

        const effectiveRadius = Math.max(r - OFFSET, 0);
        const trackX = w - OFFSET;
        const topY = OFFSET;
        const bottomY = h - OFFSET;
        const cornerX = trackX - effectiveRadius;

        const minStartX = w * MIN_START_RATIO;
        let startX = trackX - effectiveRadius * EXTRA_INSET;
        if (startX < minStartX) startX = minStartX;
        if (startX > cornerX) startX = cornerX;

        const d = `
            M ${startX} ${topY}
            L ${cornerX} ${topY}                     
            A ${effectiveRadius} ${effectiveRadius} 0 0 1 ${trackX} ${topY + effectiveRadius} 
            L ${trackX} ${bottomY - effectiveRadius} 
            A ${effectiveRadius} ${effectiveRadius} 0 0 1 ${cornerX} ${bottomY} 
            L ${startX} ${bottomY}
        `;
        trackPath.setAttribute('d', d);

        pathLength = trackPath.getTotalLength();
        const ratio = content.clientHeight / content.scrollHeight;
        
        // Hide scrollbar if content doesn't overflow
        if (ratio >= 1) {
            svg.style.opacity = '0';
        } else {
            svg.style.opacity = '1';
        }

        thumbLength = Math.max(MIN_THUMB, pathLength * ratio);
        updateThumb();
    }

    function updateThumb() {
        const scrollableHeight = content.scrollHeight - content.clientHeight || 1;
        const scrollRatio = content.scrollTop / scrollableHeight;
        const startOffset = (pathLength - thumbLength) * scrollRatio;
        const endOffset = startOffset + thumbLength;

        const points = [];
        for (let i = 0; i <= SEGMENTS; i++) {
            const t = startOffset + ((endOffset - startOffset) / SEGMENTS) * i;
            const p = trackPath.getPointAtLength(t);
            points.push(`${p.x} ${p.y}`);
        }
        
        const segmentD = `M ${points[0]} ${points.slice(1).map(pt => `L ${pt}`).join(' ')}`;
        thumbPath.setAttribute('d', segmentD);
    }

    thumbPath.addEventListener('pointerdown', e => {
        e.preventDefault();
        dragging = true;
        pointerId = e.pointerId;
        thumbPath.setPointerCapture(pointerId);
    });
    
    window.addEventListener('pointermove', e => {
        if (!dragging || e.pointerId !== pointerId) return;
        const rect = container.getBoundingClientRect();
        let ratio = (e.clientY - rect.top) / rect.height;
        ratio = Math.max(0, Math.min(1, ratio));
        content.scrollTop = ratio * (content.scrollHeight - content.clientHeight);
        updateThumb();
    });
    
    window.addEventListener('pointerup', e => {
        if (!dragging || e.pointerId !== pointerId) return;
        dragging = false;
        try { thumbPath.releasePointerCapture(pointerId); } catch {}
        pointerId = null;
    });

    content.addEventListener('scroll', updateThumb);
    window.addEventListener('resize', updatePath);

    // Initial call
    updatePath();
}

console.log("%c UI Loaded. Use window.login('Name') to start manually. ", "background: #c8e01d; color: black; font-weight: bold; padding: 5px;");