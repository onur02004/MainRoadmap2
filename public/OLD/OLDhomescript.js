export const setToken = (token) => localStorage.setItem('jwt_token', token);
export const getToken = () => localStorage.getItem('jwt_token');
export const isAuthenticated = () => !!getToken();
export const logout = () => {
    localStorage.removeItem('jwt_token');
    window.location.href = '/login.html';
};

// --- GÜNCEL BİLDİRİM VERİ TABANI ---
const notificationData = [
    { 
        id: 1, type: "system", title: "Pi5 Server Status", 
        details: "Crontab internet bağlantısını kopardığını tespit etti ve Node.js backend ile Cloudflare tünellerini yeniden başlattı.", 
        time: "10 dk önce", icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.59-10.45l-5.25 5.25"></path></svg>',
        actions: [{ label: "Logları İncele", type: "primary" }, { label: "Kapat", type: "default" }]
    },
    { 
        id: 2, type: "collab", title: "Maja Schweier", 
        details: "Chat-Server-Projekt için yeni bir commit paylaştı. Gözden geçirmen bekleniyor.", 
        time: "1 saat önce", icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5c-2.2 0-4 1.8-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>',
        actions: [{ label: "Değişiklikleri Gör", type: "primary" }]
    },
    { 
        id: 3, type: "project", title: "Matrix Portal S3", 
        details: "Şarkı sözü gösterme devre dışı bırakıldı. Şu an aktif mod: Tam Ekran Albüm Kapağı / Bekleme: Büyük Dijital Saat.", 
        time: "Dün", icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="12" cy="12" r="3"></circle></svg>',
        actions: [{ label: "Arayüzü Değiştir", type: "primary" }]
    }
];

// --- BİLDİRİMLERİ EKRANA BASMA MANTIĞI ---
function renderNotifications() {
    const feedContainer = document.getElementById('notif-feed');
    if (!feedContainer) return;
    
    feedContainer.innerHTML = ''; 

    notificationData.forEach(notif => {
        const item = document.createElement('div');
        item.className = 'notif-item';
        
        let actionsHTML = '';
        if (notif.actions && notif.actions.length > 0) {
            actionsHTML = '<div class="notif-item-actions">';
            notif.actions.forEach(btn => {
                actionsHTML += `<button class="notif-btn ${btn.type}">${btn.label}</button>`;
            });
            actionsHTML += '</div>';
        }

        item.innerHTML = `
            <div class="notif-item-icon">${notif.icon}</div>
            <div class="notif-item-content">
                <div class="notif-item-header">
                    <span class="notif-item-title">${notif.title}</span>
                    <span class="notif-item-time">${notif.time}</span>
                </div>
                <div class="notif-item-desc">${notif.details}</div>
                ${actionsHTML}
            </div>
        `;
        feedContainer.appendChild(item);
    });
}

// --- AMBIENT ACRYLIC ALBUMS ---
const placeholderAlbums = [
    { 
        src: "https://i.scdn.co/image/ab67616d0000b273c8b444df094279e70d0ed856", 
        title: "Starboy", by: "Simay", privacy: "Public",
        lyrics: "I'm tryna put you in the worst mood, ah<br>P1 cleaner than your church shoes, ah<br>Milli point two just to hurt you, ah<br>All red Lamb' just to tease you, ah<br>None of these toys on lease too, ah<br>Made your whole year in a week too, yeah<br>Main b**ch out your league too, ah<br>Side b**ch out of your league too, ah"
    },
    { 
        src: "https://i.scdn.co/image/ab67616d0000b273e3f1ba3de4659708c25d0f39", 
        title: "After Hours", by: "Metehan", privacy: "Private",
        lyrics: "Thought I almost died in my dream again<br>(Baby, almost died in my dream again)<br>Fightin' for my life, I couldn't breathe again<br>Fallin' into an empty space<br>Darkness ruling all around<br>Where is the light I used to know?"
    },
    { 
        src: "https://i.scdn.co/image/ab67616d0000b2735e15b58fc1a36684183da40a", 
        title: "Dawn FM", by: "Onur", privacy: "Public",
        lyrics: "You are now listening to 103.5 Dawn FM<br>You've been in the dark for way too long<br>It's time to walk into the light<br>And accept your fate with open arms<br>Scared? Don't worry<br>We'll be there to hold your hand and guide you through this painless transition."
    },
    { 
        src: "https://upload.wikimedia.org/wikipedia/en/thumb/a/ab/The_Dark_Side_of_the_Moon_cover.svg/1280px-The_Dark_Side_of_the_Moon_cover.svg.png", 
        title: "Dark Side of the Moon", by: "System", privacy: "Public",
        lyrics: "Ticking away the moments that make up a dull day<br>Fritter and waste the hours in an offhand way.<br>Kicking around on a piece of ground in your home town<br>Waiting for someone or something to show you the way."
    },
    { 
        src: "https://upload.wikimedia.org/wikipedia/en/7/70/Graduation_%28album%29.jpg", 
        title: "Graduation", by: "Simay", privacy: "Private",
        lyrics: "And I wonder if you know<br>What it means, what it means<br>And I wonder if you know<br>What it means, what it means<br>And I wonder if you know<br>What it means to find your dreams come true"
    },
    { 
        src: "https://i.scdn.co/image/ab67616d0000b2739164bafe9aaa168d93f4816a", 
        title: "Utopia", by: "Metehan", privacy: "Public",
        lyrics: "Greetings from Utopia<br>Before the show starts, open your minds<br>Let the frequencies enter your soul<br>We are ascending tonight<br>Leave the gravity behind<br>Welcome to the other side."
    }
];

function spawnFloatingAlbums() {
    const container = document.getElementById('floating-albums');
    if (!container) return;
    
    container.innerHTML = ''; 

    const shuffledAlbums = [...placeholderAlbums].sort(() => 0.5 - Math.random());
    const selectedAlbums = shuffledAlbums.slice(0, 3);

    selectedAlbums.forEach((album, index) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'ambient-wrapper';
        
        const size = Math.random() * 60 + 180; 
        const top = Math.random() * 40 + 25; 
        
        const isLeft = index % 2 === 0; 
        const left = isLeft 
            ? Math.random() * 10 + 5   
            : Math.random() * 10 + 75; 
            
        wrapper.classList.add(isLeft ? 'pop-right' : 'pop-left');
        
        wrapper.innerHTML = `
            <img src="${album.src}" class="ambient-cover" alt="${album.title}">
            <div class="ambient-details">
                <div class="ambient-meta">
                    <h4>${album.title}</h4>
                    <p>Suggested by: ${album.by}</p>
                    <span class="privacy-tag ${album.privacy.toLowerCase()}">${album.privacy}</span>
                </div>
                <div class="ambient-lyrics">
                    ${album.lyrics}
                </div>
            </div>
        `;
        
        const animDuration = Math.random() * 15 + 25; 
        const animDelay = Math.random() * -30; 
        
        wrapper.style.width = `${size}px`;
        wrapper.style.height = `${size}px`;
        wrapper.style.top = `${top}%`;
        wrapper.style.left = `${left}%`;
        wrapper.style.animationDuration = `${animDuration}s`;
        wrapper.style.animationDelay = `${animDelay}s`;
        
        container.appendChild(wrapper);
    });
}

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

        spawnFloatingAlbums(); 
        renderNotifications(); // Bildirimleri Renderla

        dashboard.style.opacity = "0";
        dashboard.style.transform = "translateY(30px)";
        dashboard.style.transition = "opacity 0.8s ease, transform 0.8s cubic-bezier(0.2, 0.8, 0.2, 1)";
        
        void dashboard.offsetWidth;
        dashboard.style.opacity = "1";
        dashboard.style.transform = "translateY(0)";
        dashboard.classList.add('dashboard-active'); 

        // Bildirim çekmecesini aç
        setTimeout(() => notificationPanel.classList.remove('hidden-panel'), 800);

        setTimeout(() => {
            document.body.classList.add('scroll-enabled');
            extendedUI.classList.remove('hidden');
            scrollIndicator.classList.remove('hidden');
            initScrollObserver(); 
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

    if (isAuthenticated()) {
        const welcomeScreen = document.getElementById('welcome-screen');
        const dashboard = document.getElementById('dashboard');
        const bgWelcomeText = document.getElementById('bg-welcome-text'); 
        const notificationPanel = document.getElementById('notification-panel');
        const extendedUI = document.getElementById('extended-ui');
        const scrollIndicator = document.getElementById('scroll-indicator');

        if(welcomeScreen) welcomeScreen.classList.add('hidden');
        if(dashboard) dashboard.classList.remove('hidden');
        if(bgWelcomeText) bgWelcomeText.classList.remove('hidden');
        
        spawnFloatingAlbums(); 
        renderNotifications();
        
        dashboard.style.opacity = "1";
        dashboard.classList.add('dashboard-active'); 

        const usernameEl = document.getElementById('username');
        if (usernameEl) usernameEl.textContent = "onur";

        if(notificationPanel) notificationPanel.classList.remove('hidden-panel');
        if(extendedUI) {
            document.body.classList.add('scroll-enabled');
            extendedUI.classList.remove('hidden');
            if(scrollIndicator) scrollIndicator.classList.remove('hidden');
            initScrollObserver(); 
        }
    }

    const accountBtn = document.querySelector('.follow-btn');
    if (accountBtn) {
        accountBtn.addEventListener('click', () => {
            window.location.href = '/account.html';
        });
    }
    
    document.getElementById('go-to-login-btn').addEventListener('click', () => {
        window.login("Onur"); 
    });

    // --- Bildirim Panelini Kapatma ---
    const notifPanel = document.getElementById('notification-panel');
    document.getElementById('close-notif-btn').addEventListener('click', () => {
        notifPanel.classList.add('hidden-panel');
    });

    // --- 3D Hover Tilt Effects ---
    function apply3DTilt(element, intensity) {
        element.addEventListener('mousemove', (e) => {
            if(window.innerWidth > 768) { 
                const rect = element.getBoundingClientRect();
                const x = e.clientX - rect.left - rect.width / 2;
                const y = e.clientY - rect.top - rect.height / 2;
                const tiltX = -(y / rect.height) * intensity; 
                const tiltY = (x / rect.width) * intensity;
                element.style.transform = `perspective(1000px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale3d(1.02, 1.02, 1.02)`;
            }
        });

        element.addEventListener('mouseleave', () => {
            if(window.innerWidth > 768) {
                element.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;
                element.style.transition = `transform 0.5s ease-out`; 
            }
        });

        element.addEventListener('mouseenter', () => {
            if(window.innerWidth > 768) {
                element.style.transition = `none`; 
            }
        });
    }

    apply3DTilt(document.getElementById('main-profile-card'), 20);
    document.querySelectorAll('.tilt-element').forEach(card => {
        apply3DTilt(card, 15);
    });
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

console.log("%c UI Loaded. Use window.login('Name') to start manually. ", "background: #c8e01d; color: black; font-weight: bold; padding: 5px;");