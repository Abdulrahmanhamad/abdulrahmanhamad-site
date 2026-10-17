/* Shared logic for the designs: data, Vimeo, player, editable texts, language and theme. */
(function () {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const saveData = !!(navigator.connection && navigator.connection.saveData);
  const canHover = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const TYPES = { 'commercial': ['Commercials', 'إعلانات'], 'music video': ['Music videos', 'فيديو كليب'], 'film': ['Film & series', 'أفلام ومسلسلات'], 'animation': ['Animation', 'رسوم متحركة'], 'ai': ['AI films', 'أفلام بالذكاء الاصطناعي'] };

  /* ---------- language ---------- */
  const AR = {
    'Work': 'الأعمال', 'About': 'نبذة', 'Contact': 'تواصل', 'Film Director.': 'مخرج سينمائي.', 'Watch work': 'شاهد الأعمال',
    'All': 'الكل', 'All work': 'كل الأعمال', 'Copy': 'نسخ', 'Copied': 'تم النسخ', 'Phone': 'الهاتف', 'WhatsApp': 'واتساب',
    'Back to top': 'إلى الأعلى', 'For commercials, music videos and drama projects.': 'للإعلانات والفيديو كليب والدراما.',
    'A film by': 'فيلم من إخراج', 'Client': 'العميل', 'Year': 'السنة', 'Length': 'المدة',
    'Abdulrahman Hamad': 'عبدالرحمن حمد', 'Abdulrahman': 'عبدالرحمن', 'Hamad': 'حمد',
    'Video not loading?': 'الفيديو لا يعمل؟', 'Open on Vimeo': 'شاهده على Vimeo', 'Cairo & Riyadh': 'القاهرة والرياض'
  };
  const lang = () => root.lang === 'ar' ? 'ar' : 'en';
  const tr = s => lang() === 'ar' ? (AR[s] || s) : s;
  const L = (en, ar) => `<span class="l-en">${en}</span><span class="l-ar" lang="ar">${ar || en}</span>`;
  let site = {};
  function applyLang() {
    $$('[data-t]').forEach(el => { if (!el.dataset.en) el.dataset.en = el.textContent.trim(); el.textContent = tr(el.dataset.en); });
    const role = $$('[data-k="role"]');
    role.forEach(el => { const v = lang() === 'ar' ? (site.role_ar || AR['Film Director.']) : (site.role || 'Film Director.'); el.textContent = v; });
    document.title = lang() === 'ar' ? 'عبدالرحمن حمد | مخرج سينمائي' : 'Abdulrahman Hamad | Film Director';
  }
  function setLang(l) {
    root.lang = l; root.dir = l === 'ar' ? 'rtl' : 'ltr';
    try { localStorage.setItem('lang', l); } catch (e) { }
    applyLang();
  }
  function setTheme(t) {
    const go = () => { root.dataset.theme = t; try { localStorage.setItem('theme', t); } catch (e) { } };
    (document.startViewTransition && !reduce) ? document.startViewTransition(go) : go();
  }

  /* ---------- works ---------- */
  function parseVimeo(u) {
    const m = String(u).match(/vimeo\.com\/(?:video\/|channels\/[\w-]+\/|manage\/videos\/)?(\d+)(?:\/([0-9a-f]{6,}))?/i);
    if (!m) return null;
    return { id: m[1], h: m[2] || (String(u).match(/[?&]h=([0-9a-f]+)/i) || [])[1] || '' };
  }
  const pageUrl = w => `https://vimeo.com/${w.id}${w.h ? '/' + w.h : ''}`;
  const fmt = s => s ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}` : '';
  const vsize = (u, big) => String(u || '').replace(/-d_\d+(x\d+)?/, big ? '-d_1280x720' : '-d_640x360');
  const thumb = (w, big) => {
    if (w.thumb) {
      const t = String(w.thumb).replace(/^\//, ''), m = t.match(/^(.*)-960\.webp$/);
      return m && !big ? m[1] + '-480.webp' : t;
    }
    return w.vthumb ? vsize(w.vthumb, big) : '';
  };
  const meta = {};
  const oembed = w => meta[w.id] || (meta[w.id] = fetch(`https://vimeo.com/api/oembed.json?width=1280&url=${encodeURIComponent(pageUrl(w))}`).then(r => r.ok ? r.json() : {}).catch(() => ({})));
  /* Every public video on the Vimeo account is pulled in automatically.
     works.json only adds or corrects details (title, Arabic title, client, category, year, custom thumbnail),
     sets the order, or hides a video ("hide": true). */
  const VIMEO_USER = () => (site.vimeo_user || 'abdulrahmanhamad').replace(/^.*vimeo\.com\//, '').replace(/\/.*$/, '');
  const guessType = t => /\bAI\b|A\.I\.|generated|ذكاء اصطناعي|الذكاء الاصطناعي/i.test(t) ? 'ai' : /animat|cartoon|كرتون|رسوم متحركة/i.test(t) ? 'animation' : /music|clip|كليب|song|أغنية|اغنية|feat\.?|ft\./i.test(t) ? 'music video'
    : /series|مسلسل|film|فيلم|trailer|teaser|episode|حلقة|short/i.test(t) ? 'film' : 'commercial';
  async function vimeoList() {
    const key = 'vimeo:' + VIMEO_USER();
    try { const c = JSON.parse(localStorage.getItem(key) || 'null'); if (c && Date.now() - c.t < 10 * 60e3) return c.v; } catch (e) { }
    const all = [];
    for (let p = 1; p <= 3; p++) {
      const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 5000);
      try {
        const r = await fetch(`https://vimeo.com/api/v2/${VIMEO_USER()}/videos.json?page=${p}`, { signal: ctl.signal });
        clearTimeout(tm); if (!r.ok) break;
        const d = await r.json(); if (!Array.isArray(d)) break;
        all.push(...d.map(v => ({ id: String(v.id), title: v.title, date: v.upload_date, dur: v.duration, thumb: v.thumbnail_large, w: v.width, h: v.height })));
        if (d.length < 20) break;
      } catch (e) { clearTimeout(tm); break; }
    }
    if (all.length) try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), v: all })); } catch (e) { }
    return all;
  }
  async function loadWorks() {
    let raw = [];
    try { if (location.protocol === 'file:') throw 0; const r = await fetch('works.json', { cache: 'no-cache' }); if (!r.ok) throw 0; raw = await r.json(); }
    catch (e) { try { raw = JSON.parse($('#works-data').textContent); } catch (_) { raw = []; } }
    let list = raw.map((w, k) => { const v = parseVimeo(w.vimeo); return v && { ...w, ...v, _k: k }; }).filter(Boolean);
    const V = await vimeoList(), byId = {};
    list.forEach(w => byId[w.id] = w);
    V.forEach(v => {
      let w = byId[v.id];
      if (!w) { w = byId[v.id] = { id: v.id, h: '', title: v.title, year: +String(v.date).slice(0, 4) || '', type: guessType(v.title), _k: -1, auto: true }; list.push(w); }
      w.vt = v.title; w.vthumb = w.vthumb || v.thumb; w.dur = w.dur || v.dur; w._d = v.date;
      if (!w.title) w.title = v.title;
      if (!w.year) w.year = +String(v.date).slice(0, 4) || '';
    });
    list = list.filter(w => !w.hide && !(w.hidden === true));
    /* order = the order of works.json (strongest first). New Vimeo uploads that are not in the list yet go on top, newest first. */
    list.sort((a, b) => (!!b.featured - !!a.featured) || ((b._k < 0) - (a._k < 0)) || (a._k - b._k) || String(b._d || '').localeCompare(String(a._d || '')));
    const W = list.map(w => ({ ...w, type: (w.type || 'film').toLowerCase() }));
    W.forEach((w, i) => w.i = i);
    return W;
  }
  const titleHTML = w => L(esc(w.title || ''), esc(w.arabic || w.title || ''));
  function fillFromVimeo(W) {
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return; io.unobserve(e.target);
      const i = +e.target.dataset.i, w = W[i];
      if (w.dur && w.vthumb) return;
      oembed(w).then(d => {
        w.dur = w.dur || d.duration; w.vt = w.vt || d.title; w.vthumb = w.vthumb || d.thumbnail_url;
        if (!w.title && d.title) w.title = d.title;
        $$(`[data-i="${i}"]`).forEach(a => {
          $$('.dur', a).forEach(x => x.textContent = fmt(w.dur));
          $$('.t', a).forEach(x => { if (!x.textContent.trim() && d.title) x.innerHTML = titleHTML(w); });
          $$('img', a).forEach(img => { if (!img.getAttribute('src') && w.vthumb) { img.onload = () => img.classList.remove('is-loading'); img.src = thumb(w); } });
        });
      });
    }), { rootMargin: '600px 0px' });
    $$('[data-i]').forEach(el => io.observe(el));
  }
  function filtersHTML(W, allLabel = 'All') {
    const c = {}; W.forEach(w => c[w.type] = (c[w.type] || 0) + 1);
    return `<button type="button" aria-pressed="true" data-f="all">${L(allLabel, AR[allLabel])}<sup>${W.length}</sup></button>` +
      Object.entries(TYPES).filter(([k]) => c[k]).map(([k, [en, ar]]) => `<button type="button" aria-pressed="false" data-f="${k}">${L(en, ar)}<sup>${c[k]}</sup></button>`).join('');
  }

  /* ---------- muted Vimeo preview ---------- */
  const previewOK = canHover && !reduce && !saveData;
  function mountPreview(box, w) {
    if (!box || box.dataset.id === w.id) return;
    box.dataset.id = w.id; box.classList.remove('is-on'); box.innerHTML = '';
    const f = document.createElement('iframe');
    f.src = `https://player.vimeo.com/video/${w.id}?background=1&muted=1&loop=1&quality=540p&dnt=1${w.h ? '&h=' + w.h : ''}`;
    f.allow = 'autoplay'; f.tabIndex = -1; f.title = '';
    f.onload = () => setTimeout(() => { if (box.dataset.id === w.id) box.classList.add('is-on'); }, 900);
    box.append(f);
  }
  function clearPreview(box) { if (!box) return; box.classList.remove('is-on'); delete box.dataset.id; setTimeout(() => { if (!box.dataset.id) box.innerHTML = ''; }, 700); }

  /* ---------- player ---------- */
  function player(W, visible, onOpen, onClose) {
    const dlg = $('#player'), frame = $('#pframe'), title = $('#ptitle'); let cur = -1;
    function open(i) {
      cur = i; const w = W[i];
      title.textContent = (lang() === 'ar' && w.arabic) ? w.arabic : (w.title || w.vt || '');
      const s = document.createElement('span'); s.textContent = [w.client, w.year].filter(Boolean).join(', '); title.append(s);
      frame.className = 'player__frame is-loading'; frame.innerHTML = '';
      const f = document.createElement('iframe');
      f.src = `https://player.vimeo.com/video/${w.id}?autoplay=1&title=0&byline=0&portrait=0&dnt=1${w.h ? '&h=' + w.h : ''}`;
      f.allow = 'autoplay; fullscreen; picture-in-picture'; f.allowFullscreen = true; f.title = w.title || 'Video';
      f.onload = () => frame.classList.remove('is-loading'); frame.append(f);
      setTimeout(() => { if (frame.classList.contains('is-loading')) { const p = document.createElement('p'); p.className = 'player__fallback'; p.innerHTML = `${tr('Video not loading?')} <a target="_blank" rel="noopener" href="${pageUrl(w)}">${tr('Open on Vimeo')}</a>`; frame.append(p); } }, 6000);
      if (!dlg.open) { dlg.showModal(); onOpen && onOpen(); }
    }
    const step = d => { const v = visible(); const k = v.indexOf(cur); open(v[(k + d + v.length) % v.length]); };
    dlg.addEventListener('close', () => { frame.innerHTML = ''; onClose && onClose(); });
    document.addEventListener('click', e => { const a = e.target.closest('a[data-i]'); if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); open(+a.dataset.i); });
    $('#pclose').onclick = () => dlg.close();
    $('#pprev').onclick = () => step(-1); $('#pnext').onclick = () => step(1);
    dlg.addEventListener('keydown', e => { if (e.key === 'ArrowRight') step(1); if (e.key === 'ArrowLeft') step(-1); });
    dlg.addEventListener('click', e => { if (e.target === dlg || e.target.classList.contains('player__stage')) dlg.close(); });
    return { open };
  }

  /* ---------- editable texts (site.json) ---------- */
  async function loadSite() {
    try {
      if (location.protocol === 'file:') return;
      const S = await (await fetch('site.json', { cache: 'no-cache' })).json(); site = S;
      const paras = a => a.map(p => `<p>${esc(p)}</p>`).join('');
      const facts = a => a.map(f => `<div><dt>${esc(f.label)}</dt><dd>${esc(f.value)}${f.note ? `<small>${esc(f.note)}</small>` : ''}</dd></div>`).join('');
      if (Array.isArray(S.about) && S.about.length) $$('#about-p .l-en').forEach(e => e.innerHTML = paras(S.about));
      if (Array.isArray(S.about_ar) && S.about_ar.length) $$('#about-p .l-ar').forEach(e => e.innerHTML = paras(S.about_ar));
      if (Array.isArray(S.facts) && S.facts.length) $$('#facts .l-en').forEach(e => e.innerHTML = facts(S.facts));
      if (Array.isArray(S.facts_ar) && S.facts_ar.length) $$('#facts .l-ar').forEach(e => e.innerHTML = facts(S.facts_ar));
      if (S.email) { $$('[data-k="email"]').forEach(a => { a.href = 'mailto:' + S.email; (a.querySelector('[data-v]') || a).textContent = S.email; }); $$('[data-copy]').forEach(b => b.dataset.copy = S.email); }
      if ('phone' in S) $$('[data-k="phone"]').forEach(a => { if (S.phone) { (a.querySelector('[data-v]') || a).textContent = S.phone; a.href = 'tel:' + S.phone.replace(/[^+\d]/g, ''); } else (a.closest('[data-wrap]') || a).hidden = true; });
      if ('whatsapp' in S) $$('[data-k="wa"]').forEach(a => { if (S.whatsapp) { (a.querySelector('[data-v]') || a.querySelector('span')).textContent = S.whatsapp; a.href = 'https://wa.me/' + S.whatsapp.replace(/\D/g, ''); } else (a.closest('[data-wrap]') || a).hidden = true; });
      if (S.links) Object.entries(S.links).forEach(([k, u]) => $$(`[data-s="${k}"]`).forEach(a => { const box = a.closest('li') || a; if (u) { a.href = u; box.hidden = false; } else box.hidden = true; }));
      applyLang();
    } catch (e) { }
  }

  function common() {
    root.classList.add('js');
    $$('#yr').forEach(y => y.textContent = new Date().getFullYear());
    applyLang();
    document.addEventListener('click', e => {
      const b = e.target.closest('[data-tog]'); if (!b) return;
      if (b.dataset.tog === 'lang') setLang(lang() === 'ar' ? 'en' : 'ar');
      else setTheme(root.dataset.theme === 'light' ? 'dark' : 'light');
    });
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } }), { threshold: .15 });
    $$('.rv').forEach(el => io.observe(el));
    $$('[data-copy]').forEach(b => b.addEventListener('click', async () => {
      const l = b.querySelector('span');
      try { await navigator.clipboard.writeText(b.dataset.copy); l.textContent = tr('Copied'); } catch { l.textContent = b.dataset.copy; }
      setTimeout(() => l.textContent = tr('Copy'), 2000);
    }));
  }

  function reel(video, section, onVisible) {
    let vis = true;
    const play = () => { if (reduce || saveData || !vis || document.querySelector('dialog[open]')) return; video.play().then(() => video.classList.add('is-on')).catch(() => { }); };
    if (!reduce && !saveData) video.preload = 'auto';
    new IntersectionObserver(([e]) => { vis = e.isIntersecting; onVisible && onVisible(vis); vis ? play() : video.pause(); }, { rootMargin: '-64px 0px 0px 0px' }).observe(section);
    return { play, pause: () => video.pause() };
  }

  window.Site = { getSite: () => site, $, $$, esc, fmt, thumb, pageUrl, TYPES, L, titleHTML, tr, lang, reduce, canHover, previewOK, loadWorks, fillFromVimeo, filtersHTML, mountPreview, clearPreview, player, loadSite, common, reel };
})();
