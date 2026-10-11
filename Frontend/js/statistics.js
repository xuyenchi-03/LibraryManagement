(function () {
  const { api, esc } = Lib;
  
  if (!Lib.initLayout({ title: 'Thống kê', active: 'statistics.html' })) return;
  
  const page = document.getElementById('page');
  const fmt = (d) => (d ? d.split('-').reverse().join('/') : '—');
  let monthly = [];
  
  page.innerHTML = `
    <div class="page-head">
      <div>
        <h1>Thống kê thư viện</h1>
        <p>Số liệu thật từ kho sách và phiếu mượn.</p>
      </div>
      <select class="input" id="year" style="width:120px" aria-label="Chọn năm"></select>
    </div>
    <div class="grid-3">
      <section class="card panel">
        <h2>Lượt mượn theo tháng</h2>
        <div id="chart"><span class="skeleton"></span></div>
      </section>
      <section class="card panel">
        <h2>Phiếu quá hạn</h2>
        <div id="donut"><span class="skeleton"></span></div>
      </section>
      <section class="card panel">
        <h2>Thể loại có nhiều đầu sách</h2>
        <div id="cats"><span class="skeleton"></span></div>
      </section>
    </div>
    <div class="card" style="margin-top:14px">
      <div class="panel" style="padding-bottom:4px">
        <h2>Sách đang quá hạn</h2>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Mã phiếu</th>
              <th>Độc giả</th>
              <th>Điện thoại</th>
              <th>Sách</th>
              <th class="num">SL</th>
              <th>Hạn trả</th>
              <th>Quá hạn</th>
            </tr>
          </thead>
          <tbody id="overdue">
            <tr><td colspan="7"><span class="skeleton"></span></td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  function bars() {
    const year = +document.getElementById('year').value;
    const vals = Array(12).fill(0);
    
    monthly.filter((r) => r.year === year).forEach((r) => { 
      vals[r.month - 1] = r.total_borrow; 
    });
    
    const max = Math.max(...vals);
    const top = max <= 5 ? 5 : Math.ceil(max / 5) * 5;
    const L = 30, W = 560, H = 230, B = 26, T = 14;
    const ph = H - B - T;
    const step = (W - L) / 12;
    
    let g = '';
    for (let i = 0; i <= 4; i++) { 
      const y = T + ph - (ph * i) / 4; 
      g += `<line x1="${L}" x2="${W}" y1="${y}" y2="${y}" stroke="#EAE2D2"/>
            <text x="${L - 6}" y="${y + 4}" text-anchor="end">${Math.round((top * i) / 4)}</text>`; 
    }
    
    vals.forEach((v, i) => {
      const h = (ph * v) / top;
      const x = L + i * step + step * 0.22;
      
      g += `<rect x="${x}" y="${T + ph - h}" width="${step * 0.56}" height="${h}" rx="2" fill="url(#bar)">
              <title>Tháng ${i + 1}: ${v} phiếu</title>
            </rect>`;
            
      if (v) {
        g += `<text x="${x + step * 0.28}" y="${T + ph - h - 5}" text-anchor="middle" style="fill:#4A3B30">${v}</text>`;
      }
      g += `<text x="${x + step * 0.28}" y="${H - 8}" text-anchor="middle">T${i + 1}</text>`;
    });
    
    document.getElementById('chart').innerHTML = `
      <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Số phiếu mượn theo tháng năm ${year}">
        <defs>
          <linearGradient id="bar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#8CC5EE"/>
            <stop offset="1" stop-color="#8ED6C3"/>
          </linearGradient>
        </defs>
        ${g}
      </svg>
    ` + (max ? '' : `<p class="muted-p" style="text-align:center">Chưa có lượt mượn trong năm ${year}.</p>`);
  }

  function donut(sum) {
    const over = sum.overdue_slips;
    const ok = Math.max(0, sum.borrowing_slips - over);
    const total = over + ok;
    const R = 52;
    const C = 2 * Math.PI * R;
    
    return `
      <svg viewBox="0 0 140 140" class="donut" role="img" aria-label="${over} phiếu quá hạn, ${ok} phiếu trong hạn">
        <circle cx="70" cy="70" r="${R}" fill="none" stroke="#8CC5EE" stroke-opacity=".7" stroke-width="12"/>
        <circle cx="70" cy="70" r="${R}" fill="none" stroke="#EE7B63" stroke-width="12" stroke-dasharray="${total ? (C * over) / total : 0} ${C}" transform="rotate(-90 70 70)"/>
        <text x="70" y="70" text-anchor="middle" class="big">${over}</text>
        <text x="70" y="88" text-anchor="middle">Quá hạn</text>
      </svg>
      <div class="legend">
        <span><i class="sw" style="background:#EE7B63"></i>Quá hạn<b>${over}</b></span>
        <span><i class="sw" style="background:#8CC5EE"></i>Trong hạn<b>${ok}</b></span>
      </div>
    `;
  }

  function cats(books) {
    if (!books.length) return '<div class="state"><b>Chưa có sách</b></div>';
    
    const m = {}; 
    books.forEach((b) => { m[b.category] = (m[b.category] || 0) + 1; });
    
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([n, c]) => {
      const p = Math.round((c * 100) / books.length);
      return `
        <div style="margin-bottom:14px">
          <div class="row" style="border:0;padding:0">
            <span class="grow">${esc(n)}<small>${c} đầu sách</small></span>
            <b>${p}%</b>
          </div>
          <div class="bar"><i style="width:${p}%"></i></div>
        </div>
      `;
    }).join('');
  }

  async function load() {
    try {
      const [sum, month, over, books] = await Promise.all([
        api('/statistics/summary'), 
        api('/statistics/borrow-month'), 
        api('/statistics/overdue'), 
        api('/books')
      ]);
      
      monthly = month;
      
      const years = [...new Set(month.map((r) => r.year))].sort((a, b) => b - a);
      if (!years.length) years.push(new Date().getFullYear());
      
      const sel = document.getElementById('year'); 
      sel.innerHTML = years.map((y) => `<option>${y}</option>`).join(''); 
      sel.onchange = bars; 
      bars();
      
      document.getElementById('donut').innerHTML = donut(sum);
      document.getElementById('cats').innerHTML = cats(books);
      
      document.getElementById('overdue').innerHTML = over.length ? over.map((r) => `
        <tr>
          <td><b>${esc(r.slip_code)}</b></td>
          <td>${esc(r.reader)}<div class="sub">${esc(r.reader_code)}</div></td>
          <td>${esc(r.phone || '—')}</td>
          <td>${esc(r.title)}</td>
          <td class="num">${r.quantity}</td>
          <td>${fmt(r.due_date)}</td>
          <td><span class="badge ${r.overdue_days >= 7 ? 'danger' : 'warning'}">${r.overdue_days} ngày</span></td>
        </tr>
      `).join('') : '<tr><td colspan="7"><div class="state"><b>Không có sách quá hạn</b>Mọi sách đang mượn vẫn trong hạn.</div></td></tr>';
      
    } catch (e) {
      ['chart', 'donut', 'cats'].forEach((id) => { 
        document.getElementById(id).innerHTML = ''; 
      });
      document.getElementById('chart').innerHTML = `
        <div class="state">
          <b>Không tải được thống kê</b>${esc(e.message)}<br>
          <button class="btn btn-ghost" data-retry>Thử lại</button>
        </div>
      `;
      document.getElementById('overdue').innerHTML = '';
      document.querySelector('[data-retry]').onclick = load;
    }
  }
  
  load();
})();