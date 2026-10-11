window.Crud = function (cfg) {
  const { api, Auth, toast, modal, confirmBox, icon, esc } = Lib;
  if (!Lib.initLayout({ title: cfg.title, active: cfg.active })) return;
  
  const PAGE_SIZE = 10;
  const admin = Auth.isAdmin();
  const span = cfg.columns.length + 1;
  const S = { items: [], q: '', page: 1 };
  
  const fold = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase();

  const page = document.getElementById('page');
  page.innerHTML = `
    <div class="page-head">
      <div>
        <h1>${esc(cfg.title)}</h1>
        <p>${esc(cfg.subtitle)}</p>
      </div>
      <button class="btn btn-primary" id="add">
        <i data-icon="plus"></i>${esc(cfg.addLabel)}
      </button>
    </div>
    <div class="card">
      <div class="toolbar">
        <label class="search">
          <i data-icon="search"></i>
          <input class="input" id="q" placeholder="${esc(cfg.searchPlaceholder)}" aria-label="Tìm kiếm">
        </label>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              ${cfg.columns.map((c) => `<th>${esc(c.label)}</th>`).join('')}
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
  
  const rows = document.getElementById('rows');
  const pager = document.getElementById('pager');
  const stateRow = (h) => `<tr><td colspan="${span}"><div class="state">${h}</div></td></tr>`;

  async function load() {
    rows.innerHTML = Array(5).fill(`<tr><td colspan="${span}"><span class="skeleton"></span></td></tr>`).join('');
    pager.innerHTML = '';
    try { 
      S.items = await api(cfg.endpoint); 
      render(); 
    } catch (e) { 
      rows.innerHTML = stateRow(`<b>Không tải được dữ liệu</b>${esc(e.message)}<br><button class="btn btn-ghost" data-act="retry">Thử lại</button>`); 
    }
  }

  function render() {
    const q = fold(S.q);
    const list = q ? S.items.filter((r) => fold(cfg.searchKeys.map((k) => r[k]).join(' ')).includes(q)) : S.items;
    const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    
    S.page = Math.min(S.page, pages);
    const start = (S.page - 1) * PAGE_SIZE;
    
    if (!list.length) {
      rows.innerHTML = stateRow(S.q ? '<b>Không có kết quả phù hợp</b>Thử từ khóa khác.' : `<b>Chưa có ${esc(cfg.noun)} nào</b>Bấm ${esc(cfg.addLabel)} để tạo mới.`);
      pager.innerHTML = ''; 
      return;
    }
    
    const extra = (cfg.extra || []);
    
    rows.innerHTML = list.slice(start, start + PAGE_SIZE).map((r) => `
      <tr>
        ${cfg.columns.map((c) => `<td>${c.render ? c.render(r) : esc(r[c.key] || '—')}</td>`).join('')}
        <td class="actions">
          ${extra.map((a) => `<button class="btn-icon" data-act="${a.act}" data-id="${r.id}" title="${esc(a.title)}" aria-label="${esc(a.title)}">${icon(a.icon)}</button>`).join('')}
          <button class="btn-icon" data-act="edit" data-id="${r.id}" title="Sửa" aria-label="Sửa">${icon('edit')}</button>
          ${admin ? `<button class="btn-icon danger" data-act="delete" data-id="${r.id}" title="Xóa" aria-label="Xóa">${icon('trash')}</button>` : ''}
        </td>
      </tr>
    `).join('');
    
    pager.innerHTML = `
      <span>Hiển thị ${start + 1}–${Math.min(start + PAGE_SIZE, list.length)} trên ${list.length} ${esc(cfg.noun)}</span>
      <div>
        <button class="btn btn-ghost" data-act="prev" ${S.page === 1 ? 'disabled' : ''}>Trước</button>
        <button class="btn btn-ghost" data-act="next" ${S.page === pages ? 'disabled' : ''}>Sau</button>
      </div>
    `;
  }

  function openForm(item) {
    const edit = !!item;
    const form = document.createElement('form');
    form.id = 'crud-form'; 
    form.noValidate = true;
    
    form.innerHTML = cfg.fields.map((f) => {
      const attrs = `id="f-${f.name}" name="${f.name}" ${f.max ? `maxlength="${f.max}"` : ''} placeholder="${esc(f.placeholder || '')}"`;
      const val = esc((item && item[f.name]) || '');
      return `
        <div class="field">
          <label for="f-${f.name}">${esc(f.label)}</label>
          ${f.type === 'textarea' ? `<textarea class="input" rows="3" ${attrs}>${val}</textarea>` : `<input class="input" ${attrs} value="${val}">`}
          <div class="err"></div>
        </div>
      `;
    }).join('');
    
    const foot = document.createElement('div');
    foot.style.display = 'contents';
    foot.innerHTML = `
      <button type="button" class="btn btn-ghost" data-cancel>Hủy</button>
      <button type="submit" form="crud-form" class="btn btn-primary">${edit ? 'Lưu thay đổi' : esc(cfg.addLabel)}</button>
    `;
    
    const m = modal({ title: edit ? 'Sửa ' + cfg.noun : cfg.addLabel, body: form, footer: foot });
    foot.querySelector('[data-cancel]').onclick = m.close;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const d = {};
      const err = {};
      
      cfg.fields.forEach((f) => {
        const v = form.elements[f.name].value.trim(); 
        d[f.name] = v;
        if (f.required && !v) {
          err[f.name] = `Nhập ${f.label.toLowerCase()}.`;
        } else if (v && f.pattern && !f.pattern.test(v)) {
          err[f.name] = f.patternMsg;
        }
      });
      
      form.querySelectorAll('.field').forEach((x) => { 
        x.classList.remove('invalid'); 
        x.querySelector('.err').textContent = ''; 
      });
      
      const names = Object.keys(err);
      if (names.length) {
        names.forEach((n) => { 
          const x = form.elements[n].closest('.field'); 
          x.classList.add('invalid'); 
          x.querySelector('.err').textContent = err[n]; 
        });
        form.elements[names[0]].focus(); 
        return;
      }
      
      const btn = foot.querySelector('[type=submit]'); 
      btn.disabled = true;
      
      try {
        await api(cfg.endpoint + (edit ? '/' + item.id : ''), { 
          method: edit ? 'PUT' : 'POST', 
          body: d 
        });
        toast(edit ? 'Đã lưu thay đổi.' : `Đã thêm ${cfg.noun}.`);
        m.close(); 
        load();
      } catch (er) { 
        toast(er.message, 'error'); 
        btn.disabled = false; 
      }
    });
  }

  async function remove(item) {
    const ok = await confirmBox({ 
      title: `Xóa ${cfg.noun}?`, 
      message: `"${item[cfg.nameKey]}" sẽ bị xóa vĩnh viễn. ${cfg.deleteWarn}` 
    });
    if (!ok) return;
    
    try { 
      await api(cfg.endpoint + '/' + item.id, { method: 'DELETE' }); 
      toast(`Đã xóa ${cfg.noun}.`); 
      load(); 
    } catch (e) { 
      toast(e.message, 'error'); 
    }
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'); 
    if (!b) return;
    
    const item = S.items.find((x) => String(x.id) === b.dataset.id);
    const act = b.dataset.act;
    const extra = (cfg.extra || []).find((a) => a.act === act);
    
    if (extra) return extra.run(item);
    
    ({ 
      retry: load, 
      edit: () => openForm(item), 
      delete: () => remove(item), 
      prev: () => { S.page--; render(); }, 
      next: () => { S.page++; render(); } 
    })[act]();
  });

  document.getElementById('add').onclick = () => openForm();
  
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
};