// public/authGuard.js

export async function verifyPageSecurity() {
  const token = localStorage.getItem('token');
  const isProtectedPage = document.documentElement.hasAttribute('data-protected');
  const path = window.location.pathname;
  const isLoginPage = path === '/login' || path.endsWith('login.html');

  // 1. Korumalı sayfa ve token yok -> Login sayfasına git
  if (isProtectedPage && !token) {
    window.location.href = '/login';
    return null;
  }

  // 2. Token var ve kullanıcı login sayfasına girmeye çalışıyor -> Hesaba gönder
  if (isLoginPage && token) {
    window.location.href = '/account';
    return null;
  }

  // 3. Korumalı sayfada token varsa Backend ile teyit et
  if (isProtectedPage && token) {
    try {
      const res = await fetch('/api/users/profile', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const result = await res.json();

      if (!res.ok || result.status !== 'success') {
        console.error('Doğrulama başarısız:', result);
        localStorage.removeItem('token');
        window.location.href = '/login';
        return null;
      }

      return result.data.user;
    } catch (err) {
      console.error('Ağ hatası veya geçersiz token:', err);
      localStorage.removeItem('token');
      window.location.href = '/login';
      return null;
    }
  }

  return null;
}