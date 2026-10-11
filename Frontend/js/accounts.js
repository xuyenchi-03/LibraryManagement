(function () {
  const { api, Auth, esc, icon } = Lib;
  
  if (!Lib.initLayout({ title: 'Tài khoản', active: 'accounts.html' })) return;
  
  const page = document.getElementById('page');
  
  if (!Auth.isAdmin()) {
    page.innerHTML = '<div class="card state"><b>Chỉ quản trị viên được tạo tài khoản</b>Hãy liên hệ quản trị viên để được cấp tài khoản thủ thư.</div>';
    return;
  }
  
  const f = (id, label, type, ph, hint) => `
    <div class="field">
      <label for="${id}">${label}</label>
      <input class="input" id="${id}" type="${type}" placeholder="${ph}" ${type === 'password' ? 'autocomplete="new-password"' : 'autocomplete="off"'}>
      ${hint ? `<div class="hint">${hint}</div>` : ''}
      <div class="err"></div>
    </div>`;
    
  page.innerHTML = `
    <div class="page-head">
      <div>
        <h1>Tài khoản thủ thư</h1>
        <p>Tạo tài khoản đăng nhập cho nhân viên thư viện.</p>
      </div>
    </div>
    <div class="card section" style="max-width:520px">
      <form id="form" novalidate>
        <div class="alert info" id="msg" hidden></div>
        ${f('full_name', 'Họ tên', 'text', 'Ví dụ: Nguyễn Thị Lan')}
        ${f('username', 'Tên đăng nhập', 'text', 'Từ 3 ký tự', '')}
        ${f('password', 'Mật khẩu', 'password', 'Từ 6 ký tự', 'Hãy gửi mật khẩu cho thủ thư và nhắc họ giữ bí mật.')}
        <button class="btn btn-primary" type="submit" id="submit">
          ${icon('plus', 16)}Tạo tài khoản
        </button>
        <p class="hint" style="margin-top:12px">
          Tài khoản mới có quyền Thủ thư: thêm, sửa sách và độc giả, lập phiếu mượn và trả sách. Chỉ quản trị viên mới được xóa dữ liệu.
        </p>
      </form>
    </div>`;
    
  const form = document.getElementById('form');
  const msg = document.getElementById('msg');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const v = (id) => document.getElementById(id).value;
    const d = { 
      full_name: v('full_name').trim(), 
      username: v('username').trim(), 
      password: v('password') 
    };
    const err = {};
    
    if (!d.full_name) err.full_name = 'Nhập họ tên.';
    if (d.username.length < 3) err.username = 'Tên đăng nhập cần ít nhất 3 ký tự.';
    if (d.password.length < 6) err.password = 'Mật khẩu cần ít nhất 6 ký tự.';
    
    form.querySelectorAll('.field').forEach((x) => { 
      const id = x.querySelector('input').id; 
      x.classList.toggle('invalid', !!err[id]); 
      x.querySelector('.err').textContent = err[id] || ''; 
    });
    
    msg.hidden = true;
    
    if (Object.keys(err).length) return;
    
    const btn = document.getElementById('submit'); 
    btn.disabled = true;
    
    try {
      const r = await api('/auth/register', { method: 'POST', body: d });
      msg.textContent = `Đã tạo tài khoản "${r.user.username}" (${r.user.full_name}). Hãy gửi mật khẩu cho thủ thư.`;
      msg.className = 'alert info'; 
      msg.hidden = false; 
      form.reset();
    } catch (er) { 
      msg.textContent = er.message; 
      msg.className = 'alert error'; 
      msg.hidden = false; 
    }
    
    btn.disabled = false;
  });
})();