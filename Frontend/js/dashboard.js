(function () {
  const { api, esc, icon } = Lib;
  
  if (!Lib.initLayout({ title: 'Tổng quan', active: 'dashboard.html' })) return;
  
  const page = document.getElementById('page');
  const fmt = (d) => (d ? d.split('-').reverse().join('/') : '—');
  
  const STATUS = { 
    BORROWING: ['info', 'Đang mượn'], 
    OVERDUE: ['danger', 'Quá hạn'], 
    RETURNED: ['success', 'Đã trả'] 
  };

  page.innerHTML = `
    <section class="hero">
      <div>
        <span class="eyebrow">The Quiet Archive</span>
        <h1>Mỗi ngày thêm một chút tri thức.</h1>
        <p>Chào mừng trở lại. Mọi cuốn sách đều có chỗ của nó, mọi câu chuyện rồi sẽ tìm thấy người đọc.</p>
        <span class="live" id="live" hidden><i></i>Kho lưu trữ · Trực tuyến</span>
      </div>
    </section>
    <div class="stat-cards" id="cards">
      ${'<div class="scard"><span class="skeleton"></span></div>'.repeat(4)}
    </div>
    <div class="grid-2">
      <section class="card panel">
        <span class="eyebrow">This month</span>
        <h2>Phiếu mượn gần đây</h2>
        <div id="recent"><span class="skeleton"></span></div>
      </section>
      <section class="card panel">
        <span class="eyebrow">Reading activity</span>
        <h2>Lượt mượn theo tháng</h2>
        <div id="trend"><span class="skeleton"></span></div>
      </section>
    </div>
  `;

  function area(data) {
    if (!data.length) {
      return '<div class="state"><b>Chưa có lượt mượn</b>Biểu đồ sẽ hiện sau phiếu mượn đầu tiên.</div>';
    }
    
    const W = 520, H = 210, L = 30, B = 26, T = 12;
    const ph = H - B - T;
    const max = Math.max(...data.map((d) => d.total_borrow));
    const top = max <= 4 ? 4 : Math.ceil(max / 4) * 4;
    const step = data.length > 1 ? (W - L - 10) / (data.length - 1) : 0;
    
    const pts = data.map((d, i) => [L + i * step, T + ph - (ph * d.total_borrow) / top]);
    const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('');
    
    let g = '';
    for (let i = 0; i <= 4; i++) { 
      const y = T + ph - (ph * i) / 4; 
      g += `<line x1="${L}" x2="${W}" y1="${y}" y2="${y}" stroke="#EAE2D2"/><text x="${L - 6}" y="${y + 4}" text-anchor="end">${Math.round((top * i) / 4)}</text>`; 
    }
    
    const lab = data.map((d, i) => `<text x="${pts[i][0]}" y="${H - 8}" text-anchor="middle">${d.month}/${String(d.year).slice(2)}</text>`).join('');
    
    const dots = pts.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="#2F9E8A"><title>${data[i].month}/${data[i].year}: ${data[i].total_borrow} phiếu</title></circle>`).join('');
    
    return `
      <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Số phiếu mượn theo tháng">
        <defs>
          <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#8ED6C3" stop-opacity=".55"/>
            <stop offset="1" stop-color="#8ED6C3" stop-opacity="0"/>
          </linearGradient>
        </defs>
        ${g}
        <path d="${line}L${pts[pts.length - 1][0]} ${T + ph}L${pts[0][0]} ${T + ph}Z" fill="url(#ag)"/>
        <path d="${line}" fill="none" stroke="#2F9E8A" stroke-width="2"/>
        ${dots}
        ${lab}
      </svg>
    `;
  }

  async function load() {
    try {
      const [sum, slips, month] = await Promise.all([
        api('/statistics/summary'), 
        api('/borrow'), 
        api('/statistics/borrow-month')
      ]);
      
      document.getElementById('live').hidden = false;
      
      const cards = [
        ['Tổng số sách', sum.total_books, 'book', `${sum.available_books} trên ${sum.total_quantity} bản còn trên kệ`, ''],
        ['Độc giả', sum.total_readers, 'users', 'Đã đăng ký', ''],
        ['Phiếu đang mượn', sum.borrowing_slips, 'clipboard', 'Chưa trả hết sách', ''],
        ['Phiếu quá hạn', sum.overdue_slips, 'alert', sum.overdue_slips ? 'Cần liên hệ độc giả' : 'Không có phiếu quá hạn', 'warn']
      ];
      
      document.getElementById('cards').innerHTML = cards.map(([l, v, ic, s, c]) => `
        <div class="scard ${c}">
          <span>${l}</span>
          <span class="ic">${icon(ic, 20)}</span>
          <b>${v}</b>
          <small>${s}</small>
        </div>
      `).join('');
      
      document.getElementById('recent').innerHTML = slips.length ? slips.slice(0, 5).map((r) => {
        const [c, t] = STATUS[r.status] || ['info', r.status];
        return `
          <div class="row">
            <span class="dot">${icon('clipboard', 15)}</span>
            <div class="grow">
              <b>${esc(r.slip_code)}</b> · ${esc(r.reader)}
              <small>${r.item_count} sách · mượn ${fmt(r.borrow_date)} · hạn ${fmt(r.due_date)}</small>
            </div>
            <span class="badge ${c}">${t}</span>
          </div>
        `;
      }).join('') : '<div class="state"><b>Chưa có phiếu mượn</b>Phiếu mới lập sẽ hiện ở đây.</div>';
      
      document.getElementById('trend').innerHTML = area(month.slice().reverse().slice(-12));
      
    } catch (e) {
      const err = `
        <div class="state">
          <b>Không tải được dữ liệu</b>${esc(e.message)}<br>
          <button class="btn btn-ghost" data-retry>Thử lại</button>
        </div>
      `;
      document.getElementById('cards').innerHTML = ''; 
      document.getElementById('recent').innerHTML = err; 
      document.getElementById('trend').innerHTML = '';
      document.querySelector('[data-retry]').onclick = load;
    }
  }
  
  load();
})();