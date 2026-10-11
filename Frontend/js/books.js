(function () {
  const { api, Auth, toast, modal, confirmBox, icon, esc } = Lib;
  
  if (!Lib.initLayout({ title: 'Sách', active: 'books.html' })) return;

  const PAGE_SIZE = 10;
  const S = { 
    books: [], 
    authors: [], 
    categories: [], 
    q: '', 
    cat: '', 
    avail: '', 
    page: 1, 
    sort: 'new', 
    view: localStorage.getItem('lib_view') || 'grid' 
  };
  
  const $ = (s) => document.querySelector(s);
  const rows = $('#rows');
  const pager = $('#pager');
  const admin = Auth.isAdmin();

  const stateRow = (html) => `<tr><td colspan="7"><div class="state">${html}</div></td></tr>`;

  async function load() {
    applyView(true);
    rows.innerHTML = Array(5).fill('<tr><td colspan="7"><span class="skeleton"></span></td></tr>').join('');
    pager.innerHTML = '';
    
    try {
      S.books = await api('/books/search' + (S.q ? '?keyword=' + encodeURIComponent(S.q) : ''));
      render();
    } catch (e) {
      rows.innerHTML = stateRow(`<b>Không tải được danh sách sách</b>${esc(e.message)}<br><button class="btn btn-ghost" data-act="retry">Thử lại</button>`);
    }
  }

  function filtered() {
    return S.books.filter((b) => 
      (!S.cat || String(b.category_id) === S.cat) &&
      (!S.avail || (S.avail === 'yes') === (b.available_quantity > 0))
    );
  }

  const wrap = document.querySelector('.table-wrap');
  wrap.insertAdjacentHTML('beforebegin', '<div class="cover-grid" id="grid" hidden></div>');
  const grid = $('#grid');
  
  $('.toolbar').insertAdjacentHTML('beforeend', `
    <select class="input" id="sort" style="width:170px" aria-label="Sắp xếp">
      <option value="new">Mới thêm trước</option>
      <option value="az">Tên A–Z</option>
      <option value="stock">Còn nhiều trước</option>
    </select>
    <div class="seg" role="group" aria-label="Chế độ xem">
      <button type="button" id="v-grid" title="Xem dạng bìa" aria-label="Xem dạng bìa" aria-pressed="false">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
          <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
        </svg>
      </button>
      <button type="button" id="v-list" title="Xem dạng bảng" aria-label="Xem dạng bảng" aria-pressed="false">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
          <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>
        </svg>
      </button>
    </div>
  `);

  function applyView(force) {
    const g = S.view === 'grid' && !force;
    wrap.hidden = g; 
    grid.hidden = !g;
    $('#v-grid').setAttribute('aria-pressed', S.view === 'grid'); 
    $('#v-list').setAttribute('aria-pressed', S.view !== 'grid');
  }

  function sorted(l) {
    const a = [...l];
    if (S.sort === 'az') {
      a.sort((x, y) => x.title.localeCompare(y.title, 'vi'));
    } else if (S.sort === 'stock') {
      a.sort((x, y) => y.available_quantity - x.available_quantity);
    }
    return a;
  }

  const card = (b) => `
    <article class="cover" style="--h:${[95,205,18,38,150,330][b.category_id % 6]}">
      <div class="plate">
        <span class="cid">№ ${String(b.id).padStart(4, '0')}</span>
        <h3>${esc(b.title)}</h3>
        <span class="au">${esc(b.author)}</span>
      </div>
      <div class="meta">
        <span>${esc(b.category)}</span>
        <span class="${b.available_quantity > 0 ? 'ok' : 'no'}">${b.available_quantity}/${b.quantity} còn</span>
      </div>
      <div class="ca">
        <button class="btn-icon" data-act="view" data-id="${b.id}" title="Xem chi tiết" aria-label="Xem chi tiết">${icon('eye')}</button>
        <button class="btn-icon" data-act="edit" data-id="${b.id}" title="Sửa" aria-label="Sửa">${icon('edit')}</button>
        ${admin ? `<button class="btn-icon danger" data-act="delete" data-id="${b.id}" title="Xóa" aria-label="Xóa">${icon('trash')}</button>` : ''}
      </div>
    </article>
  `;

  function render() {
    const list = sorted(filtered());
    if (!list.length) applyView(true);
    
    const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    S.page = Math.min(S.page, pages);
    const start = (S.page - 1) * PAGE_SIZE;
    
    if (!list.length) {
      rows.innerHTML = stateRow(S.q || S.cat || S.avail
        ? '<b>Không có sách phù hợp</b>Thử đổi từ khóa hoặc bỏ bộ lọc.'
        : '<b>Chưa có sách nào</b>Bấm Thêm sách để nhập đầu sách đầu tiên.');
      pager.innerHTML = '';
      return;
    }
    
    rows.innerHTML = list.slice(start, start + PAGE_SIZE).map((b) => `
      <tr>
        <td>
          <div class="cat">№ ${String(b.id).padStart(4, '0')}</div>
          <b>${esc(b.title)}</b>
          <div class="sub">${esc([b.publisher, b.publish_year].filter(Boolean).join(', '))}</div>
        </td>
        <td>${esc(b.author)}</td>
        <td>${esc(b.category)}</td>
        <td class="num">${b.quantity}</td>
        <td class="num">${b.available_quantity}</td>
        <td>${b.available_quantity > 0 ? '<span class="badge success">Còn sách</span>' : '<span class="badge danger">Hết sách</span>'}</td>
        <td class="actions">
          <button class="btn-icon" data-act="view" data-id="${b.id}" title="Xem chi tiết" aria-label="Xem chi tiết">${icon('eye')}</button>
          <button class="btn-icon" data-act="edit" data-id="${b.id}" title="Sửa" aria-label="Sửa">${icon('edit')}</button>
          ${admin ? `<button class="btn-icon danger" data-act="delete" data-id="${b.id}" title="Xóa" aria-label="Xóa">${icon('trash')}</button>` : ''}
        </td>
      </tr>
    `).join('');
    
    grid.innerHTML = list.slice(start, start + PAGE_SIZE).map(card).join('');
    applyView();
    
    pager.innerHTML = `
      <span>Hiển thị ${start + 1}–${Math.min(start + PAGE_SIZE, list.length)} trên ${list.length} sách</span>
      <div>
        <button class="btn btn-ghost" data-act="prev" ${S.page === 1 ? 'disabled' : ''}>Trước</button>
        <button class="btn btn-ghost" data-act="next" ${S.page === pages ? 'disabled' : ''}>Sau</button>
      </div>
    `;
  }

  async function view(id) {
    try {
      const b = await api('/books/' + id);
      const row = (k, v) => `<dt>${k}</dt><dd>${esc(v || '—')}</dd>`;
      
      modal({
        title: b.title,
        body: `<dl class="details">${row('Tác giả', b.author)}${row('Thể loại', b.category)}${row('Nhà xuất bản', b.publisher)}${row('Năm xuất bản', b.publish_year)}${row('Tổng số bản', b.quantity)}${row('Còn lại', b.available_quantity)}${row('Đang cho mượn', b.quantity - b.available_quantity)}${row('Tình trạng', b.available_quantity > 0 ? 'Còn sách' : 'Hết sách')}</dl>`
      });
    } catch (e) { 
      toast(e.message, 'error'); 
    }
  }

  const fold = (t) => String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase().trim();
  
  async function ensure(endpoint, arr, name) {
    const hit = arr.find((x) => fold(x.name) === fold(name));
    if (hit) return hit.id;
    
    const r = await api(endpoint, { method: 'POST', body: { name } });
    arr.push({ id: r.id, name });
    
    if (endpoint === '/categories') {
      $('#cat').insertAdjacentHTML('beforeend', `<option value="${r.id}">${esc(name)}</option>`);
    }
    return r.id;
  }

  function openForm(book) {
    const edit = !!book;
    const borrowed = edit ? book.quantity - book.available_quantity : 0;
    
    const opts = (arr, sel) => arr.map((x) => `<option value="${x.id}"${x.id === sel ? ' selected' : ''}>${esc(x.name)}</option>`).join('');
    
    const field = (label, name, html, hint) => `
      <div class="field">
        <label for="f-${name}">${label}</label>
        ${html}
        ${hint ? `<div class="hint">${hint}</div>` : ''}
        <div class="err"></div>
      </div>
    `;
    
    const input = (name, val, ph, extra = '') => `<input class="input" id="f-${name}" name="${name}" value="${esc(val ?? '')}" placeholder="${ph}" ${extra}>`;

    const combo = (label, name, arr, val) => field(label, name, `
      <input class="input" id="f-${name}" name="${name}" list="dl-${name}" value="${esc(val || '')}" placeholder="Gõ tên hoặc chọn" maxlength="100" autocomplete="off">
      <datalist id="dl-${name}">
        ${arr.map((x) => `<option value="${esc(x.name)}"></option>`).join('')}
      </datalist>
    `, `<span data-for="${name}"></span>`);

    const form = document.createElement('form');
    form.id = 'book-form'; 
    form.noValidate = true;
    
    form.innerHTML = 
      field('Tên sách', 'title', input('title', book && book.title, 'Ví dụ: Clean Code', 'maxlength="255"')) +
      `<div class="grid2">` +
      combo('Tác giả', 'author_name', S.authors, book && book.author) +
      combo('Thể loại', 'category_name', S.categories, book && book.category) +
      field('Nhà xuất bản', 'publisher', input('publisher', book && book.publisher, 'Không bắt buộc', 'maxlength="150"')) +
      field('Năm xuất bản', 'publish_year', input('publish_year', book && book.publish_year, 'Ví dụ: 2020', 'inputmode="numeric"')) +
      `</div>` +
      field('Tổng số bản', 'quantity', input('quantity', edit ? book.quantity : '', '0', 'inputmode="numeric"'),
        edit ? `Đang cho mượn ${borrowed} bản, còn lại ${book.available_quantity} bản.` : 'Khi thêm mới, số bản còn lại bằng tổng số bản.');

    const foot = document.createElement('div');
    foot.style.display = 'contents';
    foot.innerHTML = `
      <button type="button" class="btn btn-ghost" data-cancel>Hủy</button>
      <button type="submit" form="book-form" class="btn btn-primary">${edit ? 'Lưu thay đổi' : 'Thêm sách'}</button>
    `;
    
    const m = modal({ title: edit ? 'Sửa sách' : 'Thêm sách', body: form, footer: foot });
    
    foot.querySelector('[data-cancel]').onclick = m.close;
    
    [['author_name', S.authors, 'tác giả'], ['category_name', S.categories, 'thể loại']].forEach(([name, arr, noun]) => {
      const inp = form.elements[name];
      const tip = form.querySelector(`[data-for="${name}"]`);
      
      const upd = () => {
        const t = inp.value.trim();
        const hit = arr.find((x) => fold(x.name) === fold(t));
        tip.textContent = !t ? 'Gõ tên hoặc chọn từ danh sách.' : hit ? `Dùng ${noun} có sẵn: ${hit.name}.` : `Chưa có trong danh sách. Sẽ tạo ${noun} mới "${t}" khi lưu.`;
      };
      
      inp.addEventListener('input', upd); 
      upd();
    });

    function validate() {
      const d = Object.fromEntries(new FormData(form).entries());
      Object.keys(d).forEach((k) => (d[k] = String(d[k]).trim()));
      const err = {};
      const maxYear = new Date().getFullYear() + 1;
      
      if (!d.title) err.title = 'Nhập tên sách.';
      if (!d.author_name) err.author_name = 'Nhập hoặc chọn tác giả.';
      if (!d.category_name) err.category_name = 'Nhập hoặc chọn thể loại.';
      if (d.publish_year && (!/^\d{4}$/.test(d.publish_year) || +d.publish_year < 1000 || +d.publish_year > maxYear)) {
        err.publish_year = `Năm từ 1000 đến ${maxYear}.`;
      }
      if (!/^\d+$/.test(d.quantity)) {
        err.quantity = 'Nhập số nguyên từ 0 trở lên.';
      } else if (edit && +d.quantity < borrowed) {
        err.quantity = `Không nhỏ hơn số đang mượn (${borrowed}).`;
      }
      return { d, err };
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const { d, err } = validate();
      
      form.querySelectorAll('.field').forEach((f) => { 
        f.classList.remove('invalid'); 
        f.querySelector('.err').textContent = ''; 
      });
      
      const names = Object.keys(err);
      if (names.length) {
        names.forEach((n) => { 
          const f = form.elements[n].closest('.field'); 
          f.classList.add('invalid'); 
          f.querySelector('.err').textContent = err[n]; 
        });
        form.elements[names[0]].focus();
        return;
      }
      
      const btn = foot.querySelector('[type=submit]'); 
      btn.disabled = true;
      
      try {
        const authorId = await ensure('/authors', S.authors, d.author_name);
        const categoryId = await ensure('/categories', S.categories, d.category_name);
        
        const body = { 
          title: d.title, 
          author_id: authorId, 
          category_id: categoryId, 
          publisher: d.publisher, 
          publish_year: d.publish_year ? +d.publish_year : '', 
          quantity: +d.quantity 
        };
        
        await api(edit ? '/books/' + book.id : '/books', { method: edit ? 'PUT' : 'POST', body });
        toast(edit ? 'Đã lưu thay đổi.' : 'Đã thêm sách.');
        m.close(); 
        load();
      } catch (er) { 
        toast(er.message, 'error'); 
        btn.disabled = false; 
      }
    });
  }

  async function remove(book) {
    const ok = await confirmBox({ 
      title: 'Xóa sách?', 
      message: `Sách "${book.title}" sẽ bị xóa vĩnh viễn. Sách đã có lịch sử mượn không xóa được.` 
    });
    if (!ok) return;
    
    try { 
      await api('/books/' + book.id, { method: 'DELETE' }); 
      toast('Đã xóa sách.'); 
      load(); 
    } catch (e) { 
      toast(e.message, 'error'); 
    }
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'); 
    if (!b) return;
    
    const book = S.books.find((x) => String(x.id) === b.dataset.id);
    ({ 
      retry: load, 
      view: () => view(b.dataset.id), 
      edit: () => ready.then(() => openForm(book)), 
      delete: () => remove(book),
      prev: () => { S.page--; render(); }, 
      next: () => { S.page++; render(); } 
    })[b.dataset.act]();
  });

  $('#add').onclick = () => ready.then(() => openForm());
  
  let timer;
  $('#q').addEventListener('input', (e) => { 
    clearTimeout(timer); 
    timer = setTimeout(() => { 
      S.q = e.target.value.trim(); 
      S.page = 1; 
      load(); 
    }, 300); 
  });
  
  $('#cat').onchange = (e) => { S.cat = e.target.value; S.page = 1; render(); };
  $('#avail').onchange = (e) => { S.avail = e.target.value; S.page = 1; render(); };
  $('#sort').onchange = (e) => { S.sort = e.target.value; S.page = 1; render(); };
  
  $('#v-grid').onclick = () => { 
    S.view = 'grid'; 
    localStorage.setItem('lib_view', 'grid'); 
    render(); 
  };
  
  $('#v-list').onclick = () => { 
    S.view = 'list'; 
    localStorage.setItem('lib_view', 'list'); 
    render(); 
  };

  const ready = Promise.all([api('/authors'), api('/categories')]).then(([a, c]) => {
    S.authors = a; 
    S.categories = c;
    $('#cat').insertAdjacentHTML('beforeend', c.map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join(''));
  }).catch((e) => toast(e.message, 'error'));
  
  S.q = new URLSearchParams(location.search).get('q') || '';
  $('#q').value = S.q;
  
  load();
})();