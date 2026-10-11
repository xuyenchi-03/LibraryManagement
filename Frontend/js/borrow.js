(function () {
  const { api, toast, modal, icon, esc } = Lib;
  const RET = window.LIB_MODE === 'returns';
  
  if (!Lib.initLayout({ title: RET ? 'Trả sách' : 'Phiếu mượn', active: RET ? 'returns.html' : 'borrow.html' })) return;
  
  const PAGE_SIZE = 10;
  const S = { slips: [], q: '', status: '', page: 1 };
  
  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const fmt = (d) => (d ? d.split('-').reverse().join('/') : '—');
  const fold = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase();
  
  const STATUS = { 
    BORROWING: ['info', 'Đang mượn'], 
    OVERDUE: ['danger', 'Quá hạn'], 
    RETURNED: ['success', 'Đã trả'] 
  };
  
  const badge = (s) => { 
    const [c, t] = STATUS[s] || ['info', s]; 
    return `<span class="badge ${c}">${t}</span>`; 
  };
  
  const itemBadge = (i) => i.status === 'RETURNED'
    ? (i.is_late ? '<span class="badge warning">Trả trễ</span>' : '<span class="badge success">Đã trả</span>')
    : (i.is_overdue ? '<span class="badge danger">Quá hạn</span>' : '<span class="badge info">Đang mượn</span>');

  const page = document.getElementById('page');
  page.innerHTML = `
    <div class="page-head">
      <div>
        <h1>Phiếu mượn và trả sách</h1>
        <p>Lập phiếu, theo dõi hạn trả và ghi nhận sách được trả.</p>
      </div>
      <button class="btn btn-primary" id="add"><i data-icon="plus"></i>Lập phiếu mượn</button>
    </div>
    <div class="card">
      <div class="toolbar">
        <label class="search">
          <i data-icon="search"></i>
          <input class="input" id="q" placeholder="Tìm theo mã phiếu hoặc độc giả" aria-label="Tìm phiếu">
        </label>
        <select class="input" id="status" style="width:170px" aria-label="Lọc theo trạng thái">
          <option value="">Mọi trạng thái</option>
          <option value="BORROWING">Đang mượn</option>
          <option value="OVERDUE">Quá hạn</option>
          <option value="RETURNED">Đã trả</option>
        </select>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Mã phiếu</th>
              <th>Độc giả</th>
              <th>Ngày mượn</th>
              <th>Hạn trả</th>
              <th class="num">Số sách</th>
              <th>Trạng thái</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="rows"></tbody>
        </table>
      </div>
      <div class="pager" id="pager"></div>
    </div>
  `;
  
  page.querySelectorAll('[data-icon]').forEach((el) => { 
    el.outerHTML = icon(el.dataset.icon, 16); 
  });
  
  if (RET) {
    page.querySelector('h1').textContent = 'Trả sách';
    page.querySelector('.page-head p').textContent = 'Xử lý trả sách cho các phiếu đang mượn hoặc quá hạn.';
    document.getElementById('add').remove();
    document.querySelector('#status option[value="RETURNED"]').remove();
  }
  
  const rows = document.getElementById('rows');
  const pager = document.getElementById('pager');
  const stateRow = (h) => `<tr><td colspan="7"><div class="state">${h}</div></td></tr>`;

  async function load() {
    rows.innerHTML = Array(5).fill('<tr><td colspan="7"><span class="skeleton"></span></td></tr>').join('');
    pager.innerHTML = '';
    try { 
      S.slips = await api('/borrow' + (S.status ? '?status=' + S.status : ''));
      if (RET) S.slips = S.slips.filter((x) => x.status !== 'RETURNED');
      render(); 
    } catch (e) { 
      rows.innerHTML = stateRow(`<b>Không tải được danh sách phiếu</b>${esc(e.message)}<br><button class="btn btn-ghost" data-act="retry">Thử lại</button>`); 
    }
  }

  function render() {
    const q = fold(S.q);
    const list = q ? S.slips.filter((r) => fold(r.slip_code + ' ' + r.reader + ' ' + r.reader_code).includes(q)) : S.slips;
    const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    
    S.page = Math.min(S.page, pages);
    const start = (S.page - 1) * PAGE_SIZE;
    
    if (!list.length) {
      rows.innerHTML = stateRow(S.q || S.status ? '<b>Không có phiếu phù hợp</b>Thử đổi từ khóa hoặc bộ lọc.' : '<b>Chưa có phiếu mượn nào</b>Bấm Lập phiếu mượn để tạo phiếu đầu tiên.');
      pager.innerHTML = ''; 
      return;
    }
    
    rows.innerHTML = list.slice(start, start + PAGE_SIZE).map((r) => `
      <tr>
        <td><b>${esc(r.slip_code)}</b></td>
        <td>${esc(r.reader)}<div class="sub">${esc(r.reader_code)}</div></td>
        <td>${fmt(r.borrow_date)}</td>
        <td>${fmt(r.due_date)}</td>
        <td class="num">${r.item_count}</td>
        <td>${badge(r.status)}</td>
        <td class="actions">
          ${RET ? `<button class="btn btn-ghost" data-act="detail" data-id="${r.id}">Trả sách</button>` : `<button class="btn-icon" data-act="detail" data-id="${r.id}" title="Xem chi tiết và trả sách" aria-label="Xem chi tiết và trả sách">${icon('eye')}</button>`}
        </td>
      </tr>
    `).join('');
    
    pager.innerHTML = `
      <span>Hiển thị ${start + 1}–${Math.min(start + PAGE_SIZE, list.length)} trên ${list.length} phiếu</span>
      <div>
        <button class="btn btn-ghost" data-act="prev" ${S.page === 1 ? 'disabled' : ''}>Trước</button>
        <button class="btn btn-ghost" data-act="next" ${S.page === pages ? 'disabled' : ''}>Sau</button>
      </div>
    `;
  }

  async function detail(id) {
    let s;
    try { 
      s = await api('/borrow/' + id); 
    } catch (e) { 
      return toast(e.message, 'error'); 
    }
    
    const open = s.items.filter((i) => i.status === 'BORROWING');
    const body = document.createElement('div');
    
    body.innerHTML = `
      <dl class="details" style="margin-bottom:16px">
        <dt>Độc giả</dt><dd>${esc(s.reader)} (${esc(s.reader_code)})</dd>
        <dt>Thủ thư lập phiếu</dt><dd>${esc(s.librarian)}</dd>
        <dt>Ngày mượn</dt><dd>${fmt(s.borrow_date)}</dd>
        <dt>Hạn trả</dt><dd>${fmt(s.due_date)}</dd>
        <dt>Trạng thái</dt><dd>${badge(s.status)}</dd>
      </dl>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th style="width:36px"></th>
              <th>Sách</th>
              <th class="num">SL</th>
              <th>Ngày trả</th>
              <th>Tình trạng</th>
            </tr>
          </thead>
          <tbody>
            ${s.items.map((i) => `
              <tr>
                <td>${i.status === 'BORROWING' ? `<input type="checkbox" class="pick" value="${i.detail_id}" aria-label="Chọn trả ${esc(i.title)}">` : ''}</td>
                <td>${esc(i.title)}</td>
                <td class="num">${i.quantity}</td>
                <td>${fmt(i.return_date)}</td>
                <td>${itemBadge(i)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
    
    let foot = null;
    if (open.length) {
      foot = document.createElement('div'); 
      foot.style.display = 'contents';
      foot.innerHTML = `
        <button class="btn btn-ghost" data-sel>Trả sách đã chọn</button>
        <button class="btn btn-primary" data-all>Trả tất cả</button>
      `;
    }
    
    const m = modal({ title: 'Phiếu ' + s.slip_code, body, footer: foot, wide: true });
    
    if (!foot) return;
    
    async function giveBack(ids) {
      foot.querySelectorAll('button').forEach((b) => (b.disabled = true));
      try {
        const r = await api('/borrow/' + id + '/return', { 
          method: 'PUT', 
          body: ids ? { detail_ids: ids } : undefined 
        });
        toast(r.is_late ? `Đã trả ${r.returned_items} sách (trả trễ hạn).` : `Đã trả ${r.returned_items} sách.`, r.is_late ? 'warning' : 'success');
        m.close(); 
        load();
      } catch (e) { 
        toast(e.message, 'error'); 
        foot.querySelectorAll('button').forEach((b) => (b.disabled = false)); 
      }
    }
    
    foot.querySelector('[data-all]').onclick = () => giveBack();
    foot.querySelector('[data-sel]').onclick = () => {
      const ids = [...body.querySelectorAll('.pick:checked')].map((x) => +x.value);
      ids.length ? giveBack(ids) : toast('Chọn ít nhất một sách để trả.', 'warning');
    };
  }

  async function create() {
    let readers, books;
    try { 
      [readers, books] = await Promise.all([api('/readers'), api('/books')]); 
    } catch (e) { 
      return toast(e.message, 'error'); 
    }
    
    books = books.filter((b) => b.available_quantity > 0);
    
    if (!readers.length) return toast('Chưa có độc giả. Hãy thêm độc giả trước.', 'warning');
    if (!books.length) return toast('Hiện không còn sách nào để mượn.', 'warning');
    
    const today = new Date();
    const due = new Date(today.getTime() + 14 * 864e5);
    const todayStr = ymd(today);
    const stock = Object.fromEntries(books.map((b) => [b.id, b]));
    const bookOpts = books.map((b) => `<option value="${b.id}">${esc(b.title)} (còn ${b.available_quantity})</option>`).join('');

    const form = document.createElement('form');
    form.id = 'slip-form'; 
    form.noValidate = true;
    
    form.innerHTML = `
      <div class="grid2">
        <div class="field">
          <label for="reader">Độc giả</label>
          <select class="input" id="reader">
            <option value="">Chọn độc giả</option>
            ${readers.map((r) => `<option value="${r.id}">${esc(r.reader_code)} –${esc(r.full_name)}</option>`).join('')}
          </select>
          <div class="err"></div>
        </div>
        <div class="field">
          <label for="due">Hạn trả</label>
          <input class="input" id="due" type="date" min="${todayStr}" value="${ymd(due)}">
          <div class="hint">Ngày mượn là hôm nay (${fmt(todayStr)}), hệ thống tự ghi.</div>
          <div class="err"></div>
        </div>
      </div>
      <div class="field" style="margin-bottom:8px">
        <label>Sách mượn</label>
      </div>
      <div id="items"></div>
      <div class="err" id="items-err" style="margin:-2px 0 8px"></div>
      <button type="button" class="btn btn-ghost" id="more">${icon('plus', 16)}Thêm sách</button>
    `;
    
    function addRow() {
      const r = document.createElement('div'); 
      r.className = 'book-row';
      r.innerHTML = `
        <select class="input" aria-label="Sách">
          <option value="">Chọn sách</option>
          ${bookOpts}
        </select>
        <input class="input" type="number" min="1" value="1" aria-label="Số lượng">
        <button type="button" class="btn-icon danger" aria-label="Bỏ dòng này">${icon('x')}</button>
      `;
      r.querySelector('button').onclick = () => { 
        if (form.querySelectorAll('.book-row').length > 1) r.remove(); 
      };
      form.querySelector('#items').appendChild(r);
    }
    
    addRow();
    form.querySelector('#more').onclick = addRow;

    const foot = document.createElement('div'); 
    foot.style.display = 'contents';
    foot.innerHTML = `
      <button type="button" class="btn btn-ghost" data-cancel>Hủy</button>
      <button type="submit" form="slip-form" class="btn btn-primary">Lập phiếu</button>
    `;
    
    const m = modal({ title: 'Lập phiếu mượn', body: form, footer: foot, wide: true });
    foot.querySelector('[data-cancel]').onclick = m.close;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const setErr = (el, t) => { 
        const f = el.closest('.field'); 
        if (f) f.classList.toggle('invalid', !!t); 
        (f ? f.querySelector('.err') : el).textContent = t || ''; 
      };
      
      const reader = form.querySelector('#reader');
      const dueEl = form.querySelector('#due');
      const itemsErr = form.querySelector('#items-err');
      let ok = true;
      
      setErr(reader, reader.value ? '' : 'Chọn độc giả.'); 
      if (!reader.value) ok = false;
      
      const dueMsg = !dueEl.value ? 'Chọn hạn trả.' : dueEl.value < todayStr ? 'Hạn trả không được ở trong quá khứ.' : '';
      setErr(dueEl, dueMsg); 
      if (dueMsg) ok = false;
      
      const items = []; 
      let itemMsg = '';
      
      form.querySelectorAll('.book-row').forEach((r) => {
        const id = r.querySelector('select').value;
        const qty = r.querySelector('input').value.trim();
        
        if (!id) {
          itemMsg = 'Chọn sách cho mỗi dòng hoặc bỏ dòng trống.';
        } else if (!/^\d+$/.test(qty) || +qty < 1) {
          itemMsg = 'Số lượng phải là số nguyên từ 1.';
        } else if (+qty > stock[id].available_quantity) {
          itemMsg = `"${stock[id].title}" chỉ còn ${stock[id].available_quantity} bản.`;
        } else {
          items.push({ book_id: +id, quantity: +qty });
        }
      });
      
      itemsErr.textContent = itemMsg; 
      if (itemMsg) ok = false;
      
      if (!ok) return;
      
      const btn = foot.querySelector('[type=submit]'); 
      btn.disabled = true;
      
      try {
        const r = await api('/borrow', { 
          method: 'POST', 
          body: { reader_id: +reader.value, due_date: dueEl.value, items } 
        });
        toast(`Đã lập phiếu ${r.slip_code}.`); 
        m.close(); 
        load();
      } catch (er) { 
        toast(er.message, 'error'); 
        btn.disabled = false; 
      }
    });
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'); 
    if (!b) return;
    
    ({ 
      retry: load, 
      detail: () => detail(b.dataset.id), 
      prev: () => { S.page--; render(); }, 
      next: () => { S.page++; render(); } 
    })[b.dataset.act]();
  });

  const addBtn = document.getElementById('add'); 
  if (addBtn) addBtn.onclick = create;
  
  document.getElementById('status').onchange = (e) => { 
    S.status = e.target.value; 
    S.page = 1; 
    load(); 
  };
  
  let timer;
  document.getElementById('q').addEventListener('input', (e) => { 
    clearTimeout(timer); 
    timer = setTimeout(() => { 
      S.q = e.target.value.trim(); 
      S.page = 1; 
      render(); 
    }, 200); 
  });
  
  load();
})();