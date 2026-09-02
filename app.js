/* ============================================================
   Gradio Pipelines Directory — main app
   Vanilla JS, no build step. Loads featured.json + content.json
   ============================================================ */

(() => {
  'use strict';

  // ---------- State ----------
  const state = {
    tools: [],
    content: null,
    categories: null,
    filteredTools: [],
    search: '',
    sort: 'stars',
    activeDomain: 'all',
    activeCategories: new Set(),
    activeTab: 'directory',
    theme: localStorage.getItem('theme') || 'dark',
  };

  // ---------- Tiny DOM helpers ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const el = (tag, props = {}, ...children) => {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'class') node.className = v;
      else if (k === 'html') node.innerHTML = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'dataset') Object.assign(node.dataset, v);
      else if (v != null) node.setAttribute(k, v);
    }
    for (const c of children.flat()) {
      if (c == null || c === false) continue;
      if (c instanceof Node) {
        node.appendChild(c);
      } else {
        // Coerce primitives (number, boolean, bigint) to string for createTextNode
        node.appendChild(document.createTextNode(String(c)));
      }
    }
    return node;
  };
  const fmt = (n) => {
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k';
    return String(n);
  };
  const escapeHTML = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- Toast ----------
  let toastTimer = null;
  const toast = (msg) => {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('is-visible'), 1800);
  };

  // ---------- Theme ----------
  const applyTheme = () => {
    document.documentElement.dataset.theme = state.theme;
    localStorage.setItem('theme', state.theme);
  };
  const toggleTheme = () => {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    applyTheme();
  };
  applyTheme();
  $('#theme-toggle').addEventListener('click', toggleTheme);

  // ---------- Footer date ----------
  const updateFooterDate = () => {
    const now = new Date();
    const opts = { year: 'numeric', month: 'short', day: 'numeric' };
    $('#footer-date').textContent = now.toLocaleDateString('en-US', opts);
  };
  updateFooterDate();
  setInterval(updateFooterDate, 60_000);

  // ---------- URL state ----------
  const readURL = () => {
    const params = new URLSearchParams(location.search);
    const hash = (location.hash || '').replace(/^#/, '');
    if (hash && document.querySelector(`[data-tab="${hash}"]`)) {
      state.activeTab = hash;
    }
    if (params.has('q')) state.search = params.get('q');
    if (params.has('sort')) state.sort = params.get('sort');
    if (params.has('domain')) state.activeDomain = params.get('domain');
    if (params.has('cat')) {
      params.get('cat').split(',').filter(Boolean).forEach((c) => state.activeCategories.add(c));
    }
  };
  const writeURL = () => {
    const params = new URLSearchParams();
    if (state.search) params.set('q', state.search);
    if (state.sort && state.sort !== 'stars') params.set('sort', state.sort);
    if (state.activeDomain && state.activeDomain !== 'all') params.set('domain', state.activeDomain);
    if (state.activeCategories.size > 0) params.set('cat', Array.from(state.activeCategories).join(','));
    const qs = params.toString();
    const hash = state.activeTab && state.activeTab !== 'directory' ? `#${state.activeTab}` : '';
    const newURL = `${location.pathname}${qs ? '?' + qs : ''}${hash}`;
    if (newURL !== location.pathname + location.search + location.hash) {
      history.replaceState(null, '', newURL);
    }
  };

  // ---------- Filter + sort tools ----------
  const computeFiltered = () => {
    const q = state.search.trim().toLowerCase();
    let list = state.tools.filter((t) => {
      if (state.activeDomain !== 'all' && t.subcategory !== state.activeDomain) return false;
      if (state.activeCategories.size > 0 && !state.activeCategories.has(t.category)) return false;
      if (q) {
        const hay = [t.name, t.author, t.description, t.longDescription, ...(t.topics || []), t.category, t.subcategory]
          .join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    if (state.sort === 'stars') list.sort((a, b) => (b.stars || 0) - (a.stars || 0));
    else if (state.sort === 'updated') list.sort((a, b) => (b.updated || '').localeCompare(a.updated || ''));
    else if (state.sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  };

  // ---------- Render: sidebar filters ----------
  const renderFilters = () => {
    const cat = state.categories;
    if (!cat) return;

    // Domain (single-select)
    const domainGroup = $('#filter-domain');
    domainGroup.innerHTML = '';
    for (const g of cat.groups) {
      if (g.id !== 'domain') continue;
      for (const opt of g.options) {
        const isActive = state.activeDomain === opt.id;
        const filterEl = el('label', {
          class: `filter${isActive ? ' is-active' : ''}`,
          'data-domain': opt.id,
        },
          el('input', {
            type: 'radio',
            name: 'domain',
            value: opt.id,
            checked: isActive,
            style: 'accent-color: var(--accent); margin: 0; flex-shrink: 0;',
            onchange: () => {
              state.activeDomain = opt.id;
              renderFilters();
              renderDirectory();
              writeURL();
            },
          }),
          el('span', { class: 'filter__label' }, opt.label),
          el('span', { class: 'filter__count' }, opt.count),
        );
        domainGroup.appendChild(filterEl);
      }
    }

    // Category (multi-select checkboxes)
    const catGroup = $('#filter-category');
    catGroup.innerHTML = '';
    for (const g of cat.groups) {
      if (g.id !== 'category') continue;
      for (const opt of g.options) {
        const isActive = state.activeCategories.has(opt.id);
        const filterEl = el('label', {
          class: `filter${isActive ? ' is-active' : ''}`,
          'data-cat': opt.id,
        },
          el('input', {
            type: 'checkbox',
            value: opt.id,
            checked: isActive,
            onchange: (e) => {
              if (e.target.checked) state.activeCategories.add(opt.id);
              else state.activeCategories.delete(opt.id);
              renderFilters();
              renderDirectory();
              writeURL();
            },
          }),
          el('span', { class: 'filter__label' }, opt.label),
          el('span', { class: 'filter__count' }, opt.count),
        );
        catGroup.appendChild(filterEl);
      }
    }

    // Sort
    const sortEl = $('#sort');
    sortEl.value = state.sort;
    sortEl.onchange = (e) => {
      state.sort = e.target.value;
      renderDirectory();
      writeURL();
    };

    // Clear
    $('#filter-clear').onclick = () => {
      state.activeCategories.clear();
      state.activeDomain = 'all';
      state.search = '';
      $('#search').value = '';
      renderFilters();
      renderDirectory();
      writeURL();
    };
  };

  // ---------- Render: directory cards ----------
  const renderDirectory = () => {
    state.filteredTools = computeFiltered();
    const grid = $('#card-grid');
    const empty = $('#empty');
    const resultCount = $('#result-count');

    resultCount.textContent = `${state.filteredTools.length} tool${state.filteredTools.length === 1 ? '' : 's'}`;

    if (state.filteredTools.length === 0) {
      grid.innerHTML = '';
      grid.classList.add('hidden');
      empty.classList.remove('hidden');
      return;
    }
    grid.classList.remove('hidden');
    empty.classList.add('hidden');

    // Update title/sub with current filter context
    const titleEl = $('#content-title');
    const subEl = $('#content-sub');
    if (state.search) {
      titleEl.textContent = `Results for "${state.search}"`;
      subEl.textContent = `Filtered from 24 tools. Click any card for the deploy command.`;
    } else if (state.activeDomain !== 'all' || state.activeCategories.size > 0) {
      const parts = [];
      if (state.activeDomain !== 'all') parts.push(state.activeDomain);
      if (state.activeCategories.size > 0) {
        parts.push(Array.from(state.activeCategories).join(', '));
      }
      titleEl.textContent = parts.join(' · ');
      subEl.textContent = `Filtered from 24 tools. Click any card for the deploy command.`;
    } else {
      titleEl.textContent = 'All Gradio audio & video tools';
      subEl.textContent = 'Hand-curated, fully working, deployable to a public Space with one command.';
    }

    grid.innerHTML = '';
    for (const tool of state.filteredTools) {
      grid.appendChild(renderCard(tool));
    }
  };

  // ---------- Render: single card ----------
  const renderCard = (tool) => {
    const initials = (tool.author || '?').slice(0, 2).toUpperCase();
    const icon = el('div', {
      class: 'card__icon',
      style: { background: `linear-gradient(135deg, ${tool.iconColor || '#7dd3c0'} 0%, var(--surface-2) 140%)`, color: '#fff' },
      'aria-hidden': 'true',
    }, initials);

    const verified = tool.huggingface
      ? el('span', { class: 'card__verified', title: 'Has a Hugging Face Space' },
          el('span', { html: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>' }),
        )
      : null;

    const title = el('div', { class: 'card__name' },
      el('span', {}, tool.name),
      verified,
    );

    const badgeClass = tool.badge === 'space' ? 'card__badge--space' : tool.badge === 'lib' ? 'card__badge--lib' : 'card__badge--tool';
    const badge = el('span', { class: `card__badge ${badgeClass}` }, tool.badge);

    const head = el('div', { class: 'card__head' },
      icon,
      el('div', { class: 'card__title-wrap' },
        title,
        el('p', { class: 'card__author' }, tool.author),
      ),
      badge,
    );

    const desc = el('p', { class: 'card__desc' }, tool.description);

    const chips = el('div', { class: 'card__chips' },
      ...(tool.topics || []).slice(0, 3).map((t) => el('span', { class: 'chip' }, t)),
    );

    const stats = el('div', { class: 'card__stats' },
      el('span', { class: 'card__stat' },
        el('span', { html: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.123 2.123 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.123 2.123 0 0 0 1.597-1.16z"/></svg>' }),
        fmt(tool.stars || 0),
      ),
      el('span', { class: 'card__stat' },
        el('span', { class: 'dot mono', style: 'display:inline-block;width:7px;height:7px;border-radius:50%;background:#3572A5;' }),
        tool.language || 'Python',
      ),
      el('span', { class: 'card__stat', style: 'margin-left: auto; color: var(--text-faint);' }, '⏱ ' + (tool.updated || '').slice(0, 7)),
    );

    const deployBadge = el('span', { class: 'card__deploy' }, '⤴ Deploy');

    const card = el('button', {
      class: 'card',
      type: 'button',
      'data-id': tool.id,
      'aria-label': `${tool.name} by ${tool.author}. Open deploy command.`,
      onclick: () => openModal(tool),
    },
      deployBadge,
      head,
      desc,
      chips,
      stats,
    );
    return card;
  };

  // ---------- Modal ----------
  const openModal = (tool) => {
    const modal = $('#modal');
    const initials = (tool.author || '?').slice(0, 2).toUpperCase();
    $('#modal-icon').innerHTML = '';
    $('#modal-icon').appendChild(el('span', { style: { background: `linear-gradient(135deg, ${tool.iconColor || '#7dd3c0'}, var(--surface-2))`, width: '100%', height: '100%', display: 'grid', placeItems: 'center', color: '#fff' } }, initials));
    $('#modal-name').textContent = tool.name;
    $('#modal-author').textContent = `${tool.author} · ${tool.badge} · ${tool.license || 'see repo'}`;

    // Long desc (markdown-ish: bold via **)
    const descEl = $('#modal-desc');
    descEl.innerHTML = (tool.longDescription || tool.description || '').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n\n/g, '<br><br>');

    // Deploy command
    const cmd = `gradio deploy --token YOUR_HF_TOKEN --repo ${tool.repo || `https://github.com/${tool.author}/${tool.name.toLowerCase().replace(/\s+/g, '-')}`}`;
    const cmdEl = $('#deploy-cmd');
    cmdEl.innerHTML = `gradio deploy <span class="deploy__token">--token YOUR_HF_TOKEN</span> --repo ${escapeHTML(tool.repo || '')}`;

    // Copy
    const copyBtn = $('#deploy-copy');
    copyBtn.classList.remove('is-copied');
    copyBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="13" height="13" x="9" y="9" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy';
    copyBtn.onclick = async () => {
      try {
        await navigator.clipboard.writeText(cmd);
        copyBtn.classList.add('is-copied');
        copyBtn.innerHTML = '✓ Copied!';
        toast('Deploy command copied to clipboard');
        setTimeout(() => {
          copyBtn.classList.remove('is-copied');
          copyBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="13" height="13" x="9" y="9" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy';
        }, 1500);
      } catch (e) {
        // Fallback
        const ta = document.createElement('textarea');
        ta.value = cmd;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch {}
        document.body.removeChild(ta);
        toast('Copied (fallback)');
      }
    };

    // Links
    const linksEl = $('#modal-links');
    linksEl.innerHTML = '';
    if (tool.repo) {
      linksEl.appendChild(makeLink('GitHub repo', tool.repo, 'M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22'));
    }
    if (tool.space) {
      linksEl.appendChild(makeLink('HF Space', tool.space, 'M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5'));
    }
    linksEl.appendChild(makeLink('HF token', 'https://huggingface.co/settings/tokens', 'M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4'));
    if (tool.huggingface) {
      linksEl.appendChild(makeLink('Try the deploy tester', 'tester.html', 'M5 12h14M12 5l7 7-7 7'));
    }

    // Metadata
    const metaEl = $('#modal-meta');
    metaEl.innerHTML = '';
    const metaItems = [
      { label: 'License', value: tool.license || 'see repo' },
      { label: 'Language', value: tool.language || 'Python' },
      { label: 'Stars', value: fmt(tool.stars || 0) },
      { label: 'Updated', value: tool.updated || '—' },
      { label: 'Domain', value: tool.subcategory || '—' },
      { label: 'Category', value: tool.category || '—' },
    ];
    for (const m of metaItems) {
      metaEl.appendChild(el('div', { class: 'meta__item' },
        el('p', { class: 'meta__label' }, m.label),
        el('p', { class: 'meta__value' }, m.value),
      ));
    }

    // Topics
    const topicsEl = $('#modal-topics');
    topicsEl.innerHTML = '';
    if (tool.topics && tool.topics.length) {
      $('#modal-topics-section').classList.remove('hidden');
      for (const t of tool.topics) {
        topicsEl.appendChild(el('span', { class: 'chip chip--accent' }, t));
      }
    } else {
      $('#modal-topics-section').classList.add('hidden');
    }

    modal.hidden = false;
    modal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  };

  const makeLink = (label, href, svgPath) => {
    return el('a', {
      class: 'modal__link',
      href,
      target: '_blank',
      rel: 'noopener',
    },
      el('span', { html: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${svgPath}"/></svg>` }),
      label,
      el('span', { html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="width:11px;height:11px;opacity:0.5;"><path d="M7 17 17 7M7 7h10v10"/></svg>' }),
    );
  };

  const closeModal = () => {
    const modal = $('#modal');
    modal.classList.remove('is-open');
    setTimeout(() => { modal.hidden = true; }, 200);
    document.body.style.overflow = '';
  };

  $('#modal-close').addEventListener('click', closeModal);
  $('#modal').addEventListener('click', (e) => {
    if (e.target.id === 'modal') closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!$('#modal').hidden) closeModal();
    }
  });

  // ---------- Search ----------
  const searchInput = $('#search');
  searchInput.addEventListener('input', (e) => {
    state.search = e.target.value;
    renderDirectory();
    writeURL();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== searchInput) {
      e.preventDefault();
      searchInput.focus();
    }
  });

  // ---------- Tabs ----------
  const switchTab = (tabName) => {
    state.activeTab = tabName;
    $$('.tab').forEach((t) => {
      t.classList.toggle('is-active', t.dataset.tab === tabName);
    });
    $$('[data-pane]').forEach((p) => {
      p.hidden = p.dataset.pane !== tabName;
    });
    writeURL();
    if (tabName !== 'directory') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };
  $$('.tab').forEach((t) => {
    t.addEventListener('click', (e) => {
      // Tester is a real link
      if (t.getAttribute('href') === 'tester.html') return;
      e.preventDefault();
      switchTab(t.dataset.tab);
    });
  });
  window.addEventListener('hashchange', () => {
    const hash = (location.hash || '').replace(/^#/, '');
    if (hash && document.querySelector(`[data-tab="${hash}"]`)) {
      switchTab(hash);
    }
  });

  // ---------- Render: non-directory sections ----------
  const renderToday = () => {
    const c = state.content.todaysFocus;
    $('#today-date').textContent = c.date;
    $('#today-headline').textContent = c.headline;
    const list = $('#today-list');
    list.innerHTML = '';
    for (const item of c.items) {
      list.appendChild(el('div', { class: 'daily' },
        el('span', { class: 'daily__time' }, item.time),
        el('h3', { class: 'daily__title' }, item.title),
        el('p', { class: 'daily__desc' }, item.description),
      ));
    }
  };

  const renderPapers = () => {
    const list = $('#papers-list');
    list.innerHTML = '';
    for (const p of state.content.latestPapers) {
      list.appendChild(makeRow({
        icon: 'arXiv',
        iconColor: '#b31b1b',
        title: p.title,
        titleLink: p.arxiv,
        meta: [
          `${p.authors}`,
          `${p.venue} · ${p.date}`,
          p.code ? `<a href="${p.code}" target="_blank" rel="noopener">code</a>` : '',
        ].filter(Boolean).join(' · '),
        desc: p.summary,
        tags: p.tags,
      }));
    }
  };

  const renderGithub = () => {
    const list = $('#github-list');
    list.innerHTML = '';
    for (const r of state.content.trendingRepos) {
      list.appendChild(makeRow({
        icon: '⭐',
        iconColor: '#fbbf24',
        title: `${r.owner}/${r.repo}`,
        titleLink: r.url,
        meta: [
          el('span', { class: 'row__stars' },
            el('span', { html: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.123 2.123 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.123 2.123 0 0 0 1.597-1.16z"/></svg>' }),
            fmt(r.stars),
          ),
          `+${fmt(r.delta7d)} this week`,
          r.language,
        ],
        desc: r.description,
      }));
    }
  };

  const renderGroups = () => {
    const list = $('#groups-list');
    list.innerHTML = '';
    for (const g of state.content.researchGroups) {
      list.appendChild(makeRow({
        icon: g.institution.slice(0, 2).toUpperCase(),
        iconColor: '#7B2CBF',
        title: g.name,
        titleLink: g.url,
        meta: `${g.institution} · ${g.papers2026} papers in 2026`,
        desc: `<strong>Focus:</strong> ${g.focus}<br><strong>Latest:</strong> ${g.highlight}`,
      }));
    }
  };

  const renderAgents = () => {
    const list = $('#agents-list');
    list.innerHTML = '';
    for (const a of state.content.agentFrameworks) {
      list.appendChild(makeRow({
        icon: a.name.slice(0, 2).toUpperCase(),
        iconColor: '#1877F2',
        title: a.name,
        titleLink: a.url,
        meta: [
          `⭐ ${fmt(a.stars)}`,
          a.audioSupport ? el('span', { style: 'color: var(--status-ok-fg);' }, '✓ Audio support') : 'No native audio',
        ],
        desc: `${a.description}<br><strong>Latest:</strong> ${a.highlight}`,
      }));
    }
  };

  const renderDatasets = () => {
    const list = $('#datasets-list');
    list.innerHTML = '';
    for (const d of state.content.datasets) {
      list.appendChild(makeRow({
        icon: '📊',
        iconColor: '#10A37F',
        title: d.name,
        titleLink: d.url,
        meta: `${d.size} · ${d.license} · ${d.domain}`,
        desc: d.description,
      }));
    }
  };

  const renderBenchmarks = () => {
    const list = $('#benchmarks-list');
    list.innerHTML = '';
    for (const b of state.content.benchmarks) {
      list.appendChild(makeRow({
        icon: '📈',
        iconColor: '#FF6B6B',
        title: b.name,
        titleLink: b.url,
        meta: [
          b.leaderboard ? el('span', { class: 'pill pill--ok' }, 'leaderboard') : '',
          b.domain,
        ],
        desc: b.description,
      }));
    }
  };

  const renderTutorials = () => {
    const list = $('#tutorials-list');
    list.innerHTML = '';
    for (const t of state.content.tutorials) {
      list.appendChild(makeRow({
        icon: '📘',
        iconColor: '#7dd3c0',
        title: t.title,
        titleLink: t.url,
        meta: `${t.level} · ${t.duration}`,
        desc: t.summary,
        tags: t.tags,
      }));
    }
  };

  const renderVideos = () => {
    const list = $('#videos-list');
    list.innerHTML = '';
    for (const v of state.content.videos) {
      list.appendChild(makeRow({
        icon: v.thumbnail,
        iconColor: '#FF3D00',
        title: v.title,
        titleLink: v.url,
        meta: `${v.channel} · ${v.duration} · ${v.date}`,
        desc: v.summary,
      }));
    }
  };

  const renderProjects = () => {
    const list = $('#projects-list');
    list.innerHTML = '';
    for (const p of state.content.yourProjects) {
      const statusPill = p.status === 'live'
        ? el('span', { class: 'pill pill--ok' }, 'live')
        : p.status === 'in development'
          ? el('span', { class: 'pill pill--warn' }, 'in dev')
          : el('span', { class: 'pill pill--pending' }, p.status);
      list.appendChild(makeRow({
        icon: p.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase(),
        iconColor: '#fbbf24',
        title: p.name,
        titleLink: p.url,
        meta: `${p.stack} · ${statusPill.outerHTML}`,
        desc: p.description,
      }));
    }
  };

  const renderIdeas = () => {
    const list = $('#ideas-list');
    list.innerHTML = '';
    for (const idea of state.content.ideasInbox) {
      const tags = el('div', { class: 'idea__tags' },
        ...(idea.tags || []).map((t) => el('span', { class: 'chip' }, t)),
      );
      list.appendChild(el('div', { class: 'idea' },
        el('h3', { class: 'idea__title' }, idea.title),
        el('p', { class: 'idea__body' }, idea.description),
        tags,
      ));
    }
  };

  const renderChecklist = () => {
    const list = $('#checklist-list');
    const storageKey = 'gradio-pipelines:checklist';
    const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
    list.innerHTML = '';
    let done = 0;
    state.content.checklist.forEach((item, i) => {
      const isDone = !!saved[i];
      if (isDone) done++;
      const check = el('div', { class: `check${isDone ? ' is-done' : ''}` },
        el('div', { class: 'check__box', role: 'checkbox', 'aria-checked': isDone, tabindex: '0',
          onclick: () => toggleChecklist(i, !isDone),
          onkeydown: (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleChecklist(i, !isDone); } },
        },
          el('span', { html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>' }),
        ),
        el('div', { class: 'check__body' },
          el('p', { class: 'check__title' }, item.title),
          el('p', { class: 'check__desc' }, item.description),
        ),
      );
      list.appendChild(check);
    });
    $('#checklist-progress').textContent = String(done);
    $('#checklist-total').textContent = String(state.content.checklist.length);
  };

  const toggleChecklist = (i, value) => {
    const storageKey = 'gradio-pipelines:checklist';
    const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
    if (value) saved[i] = true;
    else delete saved[i];
    localStorage.setItem(storageKey, JSON.stringify(saved));
    renderChecklist();
  };

  // Helper: build a "row" item
  const makeRow = ({ icon, iconColor, title, titleLink, meta, desc, tags }) => {
    const iconEl = el('div', { class: 'row__icon', style: { background: iconColor + '22', color: iconColor, border: `1px solid ${iconColor}44` } }, icon);

    const titleEl = titleLink
      ? el('a', { href: titleLink, target: '_blank', rel: 'noopener' }, title)
      : document.createTextNode(title);

    const metaItems = Array.isArray(meta) ? meta : [meta];
    const metaEl = el('div', { class: 'row__meta' });
    metaItems.forEach((m, idx) => {
      if (typeof m === 'string') {
        metaEl.appendChild(el('span', { html: m }));
      } else if (m instanceof Node) {
        metaEl.appendChild(m);
      }
      if (idx < metaItems.length - 1) {
        metaEl.appendChild(el('span', { class: 'row__meta-sep' }, '·'));
      }
    });

    const titleP = el('h3', { class: 'row__title' }, titleEl);
    const body = el('div', { class: 'row__body' }, titleP, metaEl);
    if (desc) {
      const descEl = el('p', { class: 'row__desc', html: desc });
      body.appendChild(descEl);
    }
    if (tags && tags.length) {
      const tagsEl = el('div', { style: 'margin-top: 6px; display: flex; flex-wrap: wrap; gap: 4px;' },
        ...tags.map((t) => el('span', { class: 'chip' }, t)),
      );
      body.appendChild(tagsEl);
    }

    return el('div', { class: 'row' }, iconEl, body);
  };

  // ---------- Init ----------
  const init = async () => {
    try {
      const [featuredRes, contentRes, catRes] = await Promise.all([
        fetch('featured.json'),
        fetch('content.json'),
        fetch('categories.json'),
      ]);
      if (!featuredRes.ok) throw new Error('featured.json failed');
      if (!contentRes.ok) throw new Error('content.json failed');
      if (!catRes.ok) throw new Error('categories.json failed');

      const [featured, content, categories] = await Promise.all([
        featuredRes.json(),
        contentRes.json(),
        catRes.json(),
      ]);

      state.tools = featured.tools;
      state.content = content;
      state.categories = categories;

      readURL();
      searchInput.value = state.search;

      renderFilters();
      renderDirectory();

      renderToday();
      renderPapers();
      renderGithub();
      renderGroups();
      renderAgents();
      renderDatasets();
      renderBenchmarks();
      renderTutorials();
      renderVideos();
      renderProjects();
      renderIdeas();
      renderChecklist();

      if (state.activeTab && state.activeTab !== 'directory') {
        switchTab(state.activeTab);
      }
    } catch (e) {
      console.error('Init failed:', e, e.stack);
      $('#card-grid').innerHTML = `
        <div class="empty" style="grid-column: 1 / -1;">
          <div class="empty__icon">⚠</div>
          <h3 class="empty__title">Failed to load directory data</h3>
          <p class="empty__sub">${escapeHTML(e.message)}. Make sure you're serving this via HTTP (e.g. <code>python3 -m http.server</code>), not opening as file://.</p>
        </div>`;
    }
  };

  init();
})();
