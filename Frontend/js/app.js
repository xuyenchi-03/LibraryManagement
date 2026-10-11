(function () {
  const CONFIG = {
    BASE_URL: window.LIB_API_URL || 'http://localhost:5000/api',
    HOME: 'dashboard.html',
    LOGIN: 'signin.html'
  };

  const ICONS = {
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
    tag: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z"/><circle cx="7" cy="7" r="1.5"/>',
    clipboard: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M9 12h6M9 16h4"/>',
    chart: '<path d="M3 3v18h18M7 14v4M12 9v9M17 5v13"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    home: '<path d="M3 11 12 3l9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
    alert: '<path d="M12 3 2 21h20z"/><path d="M12 10v5M12 18h.01"/>'
  };

  const icon = (n, s = 18) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n]}</svg>`;
  
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const Auth = {
    get token() { 
      return localStorage.getItem('lib_token'); 
    },
    get user() { 
      try { 
        return JSON.parse(localStorage.getItem('lib_user')); 
      } catch { 
        return null; 
      } 
    },
    save(token, user) { 
      localStorage.setItem('lib_token', token); 
      localStorage.setItem('lib_user', JSON.stringify(user)); 
    },
    clear() { 
      localStorage.removeItem('lib_token'); 
      localStorage.removeItem('lib_user'); 
    },
    isAdmin() { 
      return (this.user || {}).role === 'ADMIN'; 
    },
    require() { 
      if (!this.token) { 
        location.replace(CONFIG.LOGIN); 
        return false; 
      } 
      return true; 
    },
    logout() { 
      this.clear(); 
      location.replace(CONFIG.LOGIN); 
    }
  };

  class ApiError extends Error { 
    constructor(message, status) { 
      super(message); 
      this.status = status; 
    } 
  }

  async function api(path, { method = 'GET', body } = {}) {
    const headers = {};
    if (Auth.token) headers.Authorization = 'Bearer ' + Auth.token;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    
    let res;
    try {
      res = await fetch(CONFIG.BASE_URL + path, { 
        method, 
        headers, 
        body: body !== undefined ? JSON.stringify(body) : undefined 
      });
    } catch {
      throw new ApiError('Không kết nối được máy chủ. Hãy kiểm tra Backend đã chạy chưa.', 0);
    }
    
    let data = null;
    try { 
      data = await res.json(); 
    } catch { }
    
    if (res.status === 401 && Auth.token) { 
      Auth.clear();
      location.replace(CONFIG.LOGIN + '?expired=1');
      throw new ApiError('Phiên đăng nhập đã hết hạn.', 401);
    }
    
    if (!res.ok) throw new ApiError((data && data.message) || `Có lỗi xảy ra (${res.status}).`, res.status);
    
    return data;
  }

  function toast(msg, type = 'success') {
    let box = document.getElementById('toasts');
    if (!box) { 
      box = document.createElement('div'); 
      box.id = 'toasts'; 
      box.className = 'toasts'; 
      box.setAttribute('aria-live', 'polite'); 
      document.body.appendChild(box); 
    }
    
    const t = document.createElement('div');
    t.className = 'toast ' + type; 
    t.textContent = msg; 
    box.appendChild(t);
    
    setTimeout(() => t.remove(), 4000);
  }

  function modal({ title, body, footer, onClose, wide }) {
    const bd = document.createElement('div');
    bd.className = 'backdrop';
    bd.innerHTML = `<div class="modal${wide ? ' wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="modal-head"><h2>${esc(title)}</h2><button class="btn-icon" data-close aria-label="Đóng">${icon('x')}</button></div><div class="modal-body"></div><div class="modal-foot"></div></div>`;
    
    const b = bd.querySelector('.modal-body');
    const f = bd.querySelector('.modal-foot');
    
    typeof body === 'string' ? (b.innerHTML = body) : b.appendChild(body);
    footer ? (typeof footer === 'string' ? (f.innerHTML = footer) : f.appendChild(footer)) : f.remove();
    
    const onKey = (e) => { 
      if (e.key === 'Escape') close(); 
    };
    
    function close() { 
      bd.remove(); 
      document.removeEventListener('keydown', onKey); 
      if (onClose) onClose(); 
    }
    
    bd.addEventListener('mousedown', (e) => { 
      if (e.target === bd) close(); 
    });
    
    bd.querySelector('[data-close]').onclick = close;
    document.addEventListener('keydown', onKey);
    document.body.appendChild(bd);
    
    const first = bd.querySelector('input,select,textarea'); 
    if (first) first.focus();
    
    return { close };
  }

  function confirmBox({ title, message, confirmText = 'Xóa', danger = true }) {
    return new Promise((resolve) => {
      const foot = document.createElement('div');
      foot.style.display = 'contents';
      foot.innerHTML = `<button class="btn btn-ghost" data-no>Hủy</button><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-yes>${esc(confirmText)}</button>`;
      
      const m = modal({ 
        title, 
        body: `<p class="muted-p">${esc(message)}</p>`, 
        footer: foot, 
        onClose: () => resolve(false) 
      });
      
      foot.querySelector('[data-no]').onclick = () => m.close();
      foot.querySelector('[data-yes]').onclick = () => { 
        resolve(true); 
        m.close(); 
      };
    });
  }

  const NAV = [
    { href: 'dashboard.html', label: 'Tổng quan', icon: 'home', ready: true },
    { href: 'books.html', label: 'Sách', icon: 'book', ready: true },
    { href: 'readers.html', label: 'Độc giả', icon: 'users', ready: true },
    { href: 'borrow.html', label: 'Mượn sách', icon: 'clipboard', ready: true },
    { href: 'returns.html', label: 'Trả sách', icon: 'undo', ready: true },
    { href: 'statistics.html', label: 'Thống kê', icon: 'chart', ready: true },
    { href: 'authors.html', label: 'Tác giả', icon: 'user', ready: true },
    { href: 'categories.html', label: 'Thể loại', icon: 'tag', ready: true },
    { href: 'accounts.html', label: 'Tài khoản', icon: 'shield', ready: true, admin: true }
  ];

  function initLayout({ title, active }) {
    if (!Auth.require()) return false;
    
    const u = Auth.user || {};
    const name = u.full_name || u.username || '';
    
    const links = NAV.filter((n) => n.ready && (!n.admin || Auth.isAdmin()))
      .map((n) => `<a href="${n.href}" class="${n.href === active ? 'active' : ''}"${n.href === active ? ' aria-current="page"' : ''}>${icon(n.icon)}<span>${n.label}</span></a>`)
      .join('');
      
    document.getElementById('sidebar').innerHTML = `<nav aria-label="Điều hướng chính">${links}</nav><div class="side-foot"><button class="navbtn" id="logout">${icon('logout')}<span>Đăng xuất</span></button></div>`;
    
    document.getElementById('topbar').innerHTML = `<a class="tb-brand" href="${CONFIG.HOME}"><span class="logo">${icon('book', 20)}</span><b>The Quiet Archive</b></a><form class="tb-search" id="gsearch" role="search">${icon('search', 15)}<input type="search" placeholder="Tìm sách, tác giả, thể loại…" aria-label="Tìm sách"></form><div class="account"><span class="avatar" aria-hidden="true">${esc(name.trim().split(/\s+/).slice(-2).map((w) => w[0]).join('').toUpperCase())}</span><div class="who"><b>${esc(name)}</b><small>${u.role === 'ADMIN' ? 'Quản trị viên' : 'Thủ thư'}</small></div></div>`;
    
    document.title = title + ' – The Quiet Archive';
    
    document.getElementById('gsearch').onsubmit = (e) => { 
      e.preventDefault(); 
      const v = e.target.querySelector('input').value.trim(); 
      location.href = 'books.html' + (v ? '?q=' + encodeURIComponent(v) : ''); 
    };
    
    document.getElementById('logout').onclick = () => api('/auth/logout', { method: 'POST' }).catch(() => {}).finally(() => Auth.logout());
    
    document.querySelectorAll('[data-icon]').forEach((el) => { 
      el.outerHTML = icon(el.dataset.icon, +el.dataset.size || 16); 
    });
    
    return true;
  }

  window.Lib = { CONFIG, Auth, api, ApiError, toast, modal, confirmBox, icon, esc, initLayout };
})();