'use strict';
// 전국 해안 일주 앱. 지리산 둘레길 앱의 3뷰 구조(홈 → 상세 → 부록, 뒤로가기 스택)를 그대로 따른다.

const $ = s => document.querySelector(s);
const view = $('#view');
const backBtn = $('#backBtn');
const sub = $('#sub');

const state = { trip: null, rest: null, region: '전체', stack: [] };
const CHK_KEY = 'coast2026-check';

const icon = {
  route: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="19" r="2.4"/><circle cx="18" cy="5" r="2.4"/><path d="M8 18h6a3 3 0 0 0 0-6H10a3 3 0 0 1 0-6h6"/></svg>',
  phone: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h3l2 5-2.5 1.5a11 11 0 0 0 5 5L17 12l5 2v3a2 2 0 0 1-2.2 2A17 17 0 0 1 4 5.2 2 2 0 0 1 6 3z"/></svg>',
  ext: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
  map: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/></svg>',
  check: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 12l3 3 5-6"/></svg>',
  fork: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3v6a3 3 0 0 0 6 0V3M9 12v9"/><path d="M17 3c-1.5 1-2 3-2 5s.5 3 2 4v9"/></svg>',
  photo: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.5"/><circle cx="9" cy="11" r="2"/><path d="M3 17l5-4 4 3 3-2 6 4"/></svg>',
  book: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2z"/><path d="M4 19a2 2 0 0 1 2-2h12"/></svg>',
};

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const mapUrl = q => 'https://map.naver.com/p/search/' + encodeURIComponent(q);
const dial = t => t.replace(/[^0-9]/g, '');
const rcolor = nm => (state.trip.regions.find(r => r.nm === nm) || {}).c || 'var(--sea)';

// 체크 상태는 기기에만 저장한다. 사파리 개인정보 모드 등에서 막히면 저장 없이 동작.
function loadChk() { try { return JSON.parse(localStorage.getItem(CHK_KEY)) || {}; } catch { return {}; } }
function saveChk(o) { try { localStorage.setItem(CHK_KEY, JSON.stringify(o)); } catch {} }
const MEMO_KEY = 'coast2026-memo';
function loadMemo() { try { return JSON.parse(localStorage.getItem(MEMO_KEY)) || {}; } catch { return {}; } }
function saveMemo(o) { try { localStorage.setItem(MEMO_KEY, JSON.stringify(o)); } catch {} }

// 오늘 날짜(기기 시간)를 YYYY-MM-DD로
function todayStr() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

async function boot() {
  try {
    // 단일 HTML 매뉴얼(build_single.py 산출물)은 데이터를 window.TRIP으로 품고 있다.
    state.trip = window.TRIP || await fetch('data/trip.json').then(r => r.json());
    state.rest = window.REST || await fetch('data/restaurants.json').then(r => r.json());
  } catch {
    view.innerHTML = '<div class="empty"><div class="ico">⚠</div><p>데이터를 불러오지 못했어요.<br>인터넷 연결을 확인해 주세요.</p></div>';
    return;
  }
  renderHome();
  if (!window.TRIP && 'serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}

// ── 홈 ──
function renderHome() {
  state.stack = ['home'];
  backBtn.hidden = true;
  setTab('home');
  sub.textContent = '7박 8일 일자별 가이드';
  const T = state.trip;
  const today = todayStr();
  const first = T.days[0].date, last = T.days[T.days.length - 1].date;

  // 여행 중이면 오늘 일정, 출발 전이면 D-day와 남은 예약
  let banner = '';
  const td = T.days.find(d => d.date === today);
  if (td) {
    banner = `<button class="today" data-d="${td.d}"><span class="tx"><span class="tt">오늘 ${td.d}일차 · ${esc(td.title)}</span>
      <span class="sx">${esc(td.brief || td.via)}</span></span><span class="arw">›</span></button>`;
  } else if (today < first) {
    const left = Math.round((new Date(first) - new Date(today)) / 86400000);
    const chk = loadChk();
    const todo = T.checklist.filter(c => c.g.includes('예약') && !chk[c.id]).length;
    banner = `<button class="today pre" id="preBtn"><span class="tx"><span class="tt">출발까지 ${left}일</span>
      <span class="sx">${todo ? `남은 예약 ${todo}건 · 눌러서 체크리스트 보기` : '예약 완료. 준비물만 확인하세요'}</span></span><span class="arw">›</span></button>`;
  }

  const counts = T.regions.map(r => [r.nm, T.days.filter(d => d.region === r.nm).length]);
  const chip = (nm, n, c) => `<button class="chip" data-r="${esc(nm)}" aria-pressed="${state.region === nm}">${c ? `<span class="dot" style="background:${c}"></span>` : ''}${esc(nm)}<span class="n">${n}</span></button>`;
  const chips = [chip('전체', T.days.length)].concat(counts.map(([nm, n]) => chip(nm, n, rcolor(nm)))).join('');

  view.innerHTML =
    `<section class="hero">
       ${routeSvg(null)}
       <div class="hero-tx">
         <h2>${T.totalKm.toLocaleString('ko-KR')}<small>km</small></h2>
         <p>${esc(T.periodShort || T.period)}</p>
       </div>
     </section>
     <p class="hero-sum">${esc(T.summary)}</p>
     ${banner}
     <div class="controls"><div class="chips" id="rChips">${chips}</div></div>
     <div id="results"></div>`;

  view.querySelectorAll('.hero [data-d]').forEach(g => g.addEventListener('click', () => openDay(+g.dataset.d)));
  const tb = view.querySelector('.today[data-d]');
  if (tb) tb.addEventListener('click', () => openDay(+tb.dataset.d));
  const pb = $('#preBtn');
  if (pb) pb.addEventListener('click', openCheck);

  $('#rChips').addEventListener('click', e => {
    const b = e.target.closest('.chip'); if (!b) return;
    state.region = b.dataset.r;
    $('#rChips').querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', c === b));
    renderList();
  });
  renderList();
  window.scrollTo(0, 0);
}

function renderList() {
  const T = state.trip, today = todayStr();
  const days = state.region === '전체' ? T.days : T.days.filter(d => d.region === state.region);
  const maxKm = Math.max(...T.days.map(x => x.km));
  const cards = days.map(d => {
    const hol = d.holiday ? `<em>${esc(d.holiday)}</em>` : '';
    const sl = d.home ? '집으로' : `${esc(d.sleep.type)}, ${esc(d.sleep.name)}`;
    return `<button class="day${d.date === today ? ' is-today' : ''}" data-d="${d.d}" style="--c:${rcolor(d.region)}">
        <span class="dn">${d.d}</span>
        <span class="dm"><span class="dl">${esc(d.label)}${hol}</span><span class="dt">${esc(d.title)}</span><span class="ds">${sl}</span></span>
        <span class="dk"><b>${d.km}</b>km<i style="--w:${Math.round(d.km / maxKm * 100)}%"></i>${d.heavy ? '<span class="hv">가장 먼 날</span>' : ''}</span>
      </button>`;
  }).join('');

  const tail = state.region === '전체' ? `<p class="foot-note">${T.notes.map(esc).join('<br>')}</p>` : '';

  $('#results').innerHTML = `<div class="log">${cards}</div>${tail}`;
  $('#results').querySelectorAll('.day').forEach(b => b.addEventListener('click', () => openDay(+b.dataset.d)));
}

// ── 일자 상세 ──
function openDay(n, replace) {
  const T = state.trip;
  const d = T.days.find(x => x.d === n); if (!d) return;
  if (replace) state.stack.pop(); else hpush();
  state.stack.push({ v: 'day', d: n }); setTab('home');
  backBtn.hidden = false;
  sub.textContent = `${d.d}일차 · ${d.label}${d.holiday ? ' ' + d.holiday : ''}`;

  const stat = (k, v) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`;
  const plan = d.plan.map(p => `<li><span class="t">${esc(p.t)}</span>
      <span class="x">${esc(p.x)}${p.ev ? '<span class="ev">충전</span>' : ''}</span>
      ${p.q ? `<a class="go" href="${mapUrl(p.q)}" target="_blank" rel="noopener" aria-label="${esc(p.q)} 지도">${icon.map}</a>` : ''}</li>`).join('');

  const s = d.sleep;
  const sleepBlock = d.home ? '' : `<div class="block stay"><h3>잘 곳 · ${esc(s.type)}</h3>
      <p><b>${esc(s.name)}</b>${s.fee ? ' · ' + esc(s.fee) : ''}</p>
      <p style="margin-top:6px">${esc(s.info)}</p>
      ${s.alt ? `<p class="alt">대안: ${esc(s.alt)}</p>` : ''}
      <textarea class="memo" data-memo="${d.d}" rows="2" placeholder="예약번호, 입실 시간 메모 (이 기기에만 저장)">${esc(loadMemo()[d.d] || '')}</textarea>
      <div class="btnrow">
        ${s.tel ? `<a class="act" href="tel:${dial(s.tel)}">${icon.phone}전화</a>` : ''}
        ${s.url ? `<a class="act" href="${esc(s.url)}" target="_blank" rel="noopener">${icon.ext}예약</a>` : ''}
        ${s.q ? `<a class="act pri" href="${mapUrl(s.q)}" target="_blank" rel="noopener">${icon.map}지도</a>` : ''}
      </div></div>`;

  view.innerHTML =
    `<div class="detail">
       <header class="dhero" style="--c:${rcolor(d.region)}">
         <div class="dh-tx"><p class="rgn">${d.d}일차, ${esc(d.region)}</p><h2>${esc(d.title)}</h2>${d.brief ? `<p class="brief">${esc(d.brief)}</p>` : ''}</div>
         ${routeSvg(d.d)}
       </header>
       <dl class="facts">
         ${stat('거리', d.km + 'km')}${stat('주행', d.drive)}${stat('잘 곳', d.home ? '집' : s.type)}${d.sun && d.sun !== '—' ? stat('해', d.sun) : ''}
       </dl>
       <div class="block"><h3>시간표</h3><ul class="tl">${plan}</ul></div>
       ${sleepBlock}
       <div class="block"><h3>충전</h3><p>${esc(d.ev)}</p>${d.evq ? `<div class="btnrow"><a class="act" href="${mapUrl(d.evq)}" target="_blank" rel="noopener">${icon.map}근처 급속 충전소 지도</a></div>` : ''}</div>
       ${picksBlock(d)}
       ${eatBlock(d)}
       ${d.warn && d.warn.length ? `<div class="block warnb"><h3>주의</h3><ul>${d.warn.map(w => `<li>${esc(w)}</li>`).join('')}</ul></div>` : ''}
       ${d.rain ? `<div class="block"><h3>비 오거나 바람 불면</h3><p>${esc(d.rain)}</p></div>` : ''}
       <div class="pager">
         <button id="prevD" ${n === 1 ? 'disabled' : ''}>‹ ${n > 1 ? n - 1 + '일차' : ''}</button>
         <button id="nextD" ${n === T.days.length ? 'disabled' : ''}>${n < T.days.length ? n + 1 + '일차' : ''} ›</button>
       </div>
     </div>`;
  const mm = view.querySelector('[data-memo]');
  if (mm) mm.addEventListener('input', () => { const o = loadMemo(); o[mm.dataset.memo] = mm.value; saveMemo(o); });
  view.querySelectorAll('[data-hub]').forEach(b => b.addEventListener('click', () => openRest(b.dataset.hub)));
  $('#prevD').addEventListener('click', () => openDay(n - 1, true));
  $('#nextD').addEventListener('click', () => openDay(n + 1, true));
  window.scrollTo(0, 0);
}

// 끼니별 추천(서브에이전트 조사, 다이닝코드 출처). 안심식당 목록 위에 둔다.
function picksBlock(d) {
  if (!d.picks || !d.picks.length) return '';
  return `<div class="block"><h3>끼니별 추천</h3>${d.picks.map(p => `<div class="pk">
      <span class="ml">${esc(p.meal)}</span><b>${esc(p.nm)}</b>
      <p>${esc(p.menu)}<br><small>${esc(p.ad)} · ${esc(p.hours)}</small></p>
      ${p.note ? `<p class="nt">${esc(p.note)}</p>` : ''}
      ${p.alt ? `<p class="nt">대안: ${esc(p.alt)}</p>` : ''}
      <div class="btnrow">
        <a class="act" href="${mapUrl(p.q)}" target="_blank" rel="noopener">${icon.map}지도</a>
        <a class="act" href="https://search.naver.com/search.naver?query=${encodeURIComponent(p.q)}" target="_blank" rel="noopener">${icon.ext}네이버</a>
        ${p.rid ? `<a class="act" href="https://www.diningcode.com/profile.php?rid=${encodeURIComponent(p.rid)}" target="_blank" rel="noopener">출처</a>` : ''}
      </div></div>`).join('')}
    <p class="alt">영업시간은 플랫폼 정보예요. 공휴일 영업은 확인하지 못했으니 가기 전에 네이버로 보세요.</p></div>`;
}

// ── 식당 (지리산 앱의 안심식당 카드 방식) ──
const PAGE = 60;
const hubOf = id => state.rest.hubs.find(h => h.id === id);
function eatBlock(d) {
  const hubs = (d.eat || []).map(hubOf).filter(Boolean);
  if (!hubs.length) return '';
  return `<div class="block"><h3>그 밖의 식당 · 안심식당</h3>
    <div class="hubs">${hubs.map(h => `<button class="hub" data-hub="${h.id}">${icon.fork}<span>${esc(h.label)}</span><b>${h.n}</b></button>`).join('')}</div></div>`;
}
// 네이버 검색은 상호 + 읍면/시 이름. 도로명까지 붙이면 빈 결과가 잦다.
const naverQ = (nm, ad) => encodeURIComponent(nm + ' ' + ad.split(' ').slice(1, 3).join(' '));
const rs = { hub: null, n: PAGE, q: '' };
function openRest(hub) {
  const h = hubOf(hub); if (!h) return;
  state.stack.push({ v: 'rest', hub }); hpush();
  backBtn.hidden = false;
  sub.textContent = h.label + ' 식당';
  rs.hub = hub; rs.n = PAGE; rs.q = '';
  view.innerHTML = `<div class="rhead"><h2>${esc(h.label)}</h2>
      <p>농식품부 안심식당 ${h.n}곳.${h.pick ? ` 상호에 ${esc(h.kw.join('·'))} 들어간 ${h.pick}곳을 위에 올렸어요.` : ''} 사진과 영업 정보는 네이버로 확인해요.</p></div>
    ${h.n > 20 ? '<input class="rq" id="rq" type="search" placeholder="상호, 업종, 도로명으로 찾기">' : ''}
    <div id="rlist"></div>`;
  const q = $('#rq');
  if (q) q.addEventListener('input', () => { rs.q = q.value.trim(); rs.n = PAGE; renderRest(); });
  renderRest();
  window.scrollTo(0, 0);
}
function renderRest() {
  let all = state.rest.items.filter(r => r[4] === rs.hub);
  if (rs.q) all = all.filter(r => (r[0] + ' ' + r[1] + ' ' + r[2]).includes(rs.q));
  const card = ([nm, gb, ad, tel, , pick]) => {
    const dl = tel && !tel.includes('*') ? dial(tel) : '';
    return `<article class="card"><div class="row1"><h3 class="name">${esc(nm)}</h3><span class="tag">${esc(gb || '음식점')}</span></div>
      ${pick ? `<p class="pick">일정 메뉴 · ${esc(pick)}</p>` : ''}
      <p class="addr"><span>${esc(ad)}</span></p>
      <div class="foot">
        ${dl.length >= 8 ? `<a class="act tel" href="tel:${dl}">${icon.phone}전화</a>` : ''}
        <a class="act photo" href="https://search.naver.com/search.naver?where=image&query=${naverQ(nm, ad)}" target="_blank" rel="noopener">${icon.photo}사진</a>
        <a class="act naver" href="https://search.naver.com/search.naver?query=${naverQ(nm, ad)}" target="_blank" rel="noopener">${icon.ext}네이버</a>
      </div></article>`;
  };
  let html = all.length ? `<div class="list">${all.slice(0, rs.n).map(card).join('')}</div>`
    : '<div class="empty"><p>찾는 식당이 없어요.</p></div>';
  if (rs.n < all.length) html += `<button class="more" id="more">${all.length - rs.n}곳 더 보기</button>`;
  html += `<p class="foot-note">자료 ${esc(state.rest.source)} · 기준일 ${esc(state.rest.updated)}<br>휴대폰 번호는 공공데이터에서 가려져 있어 전화 버튼이 없어요. 폐업했을 수 있으니 가기 전에 네이버로 확인하세요.</p>`;
  $('#rlist').innerHTML = html;
  const m = $('#more'); if (m) m.addEventListener('click', () => { rs.n += PAGE; renderRest(); });
}

// ── 체크리스트 ──
function openCheck() {
  state.stack.push('check'); hpush(); setTab('check');
  backBtn.hidden = false;
  sub.textContent = '체크리스트';
  const T = state.trip, chk = loadChk();
  const groups = [...new Set(T.checklist.map(c => c.g))];
  const sec = g => {
    const items = T.checklist.filter(c => c.g === g);
    const done = items.filter(c => chk[c.id]).length;
    return `<div class="sec"><h3>${esc(g)}<span class="prog">${done}/${items.length}</span></h3>
      ${items.map(c => `<label class="chk"><input type="checkbox" data-id="${c.id}" ${chk[c.id] ? 'checked' : ''}><span>${esc(c.x)}</span></label>`).join('')}</div>`;
  };
  view.innerHTML = `<div class="appx">${groups.map(sec).join('')}
    <p class="foot-note">체크 표시는 이 기기에만 저장돼요.</p></div>`;
  view.addEventListener('change', onChk);
  window.scrollTo(0, 0);
}
function onChk(e) {
  const i = e.target.closest('input[data-id]'); if (!i) return;
  const chk = loadChk(); chk[i.dataset.id] = i.checked; saveChk(chk);
  const sec = i.closest('.sec'), all = sec.querySelectorAll('input'), on = sec.querySelectorAll('input:checked');
  sec.querySelector('.prog').textContent = `${on.length}/${all.length}`;
}

// ── 부록 ──
function openAppendix() {
  state.stack.push('appendix'); hpush(); setTab('appx');
  backBtn.hidden = false;
  sub.textContent = '부록';
  const T = state.trip;
  const secs = T.appendix.map(a => `<div class="sec"><h3>${esc(a.title)}</h3>${a.paras.map(p => `<p>${esc(p)}</p>`).join('')}</div>`).join('');
  const contacts = `<div class="sec"><h3>연락처</h3>${T.contacts.map(c =>
    `<div class="ct${c.tel.length <= 3 ? ' sos' : ''}"><span class="nm">${esc(c.nm)}${c.note ? `<small>${esc(c.note)}</small>` : ''}</span><a href="tel:${dial(c.tel)}">${esc(c.tel)}</a></div>`).join('')}</div>`;
  const sources = `<div class="sec"><h3>출처와 확인 범위</h3>${T.sources.map(s =>
    `<div class="src"><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.x)}</a><span class="lv">${esc(s.lv)}</span></div>`).join('')}
    <p style="margin-top:10px">${esc(T.unverified)}</p></div>`;
  view.innerHTML = `<div class="appx">${secs}${contacts}${sources}
    <p class="foot-note">${T.notes.map(esc).join('<br>')}<br>기준일 ${esc(T.updated)}</p></div>`;
  window.scrollTo(0, 0);
}

// ── 뒤로가기 ──
// 뒤로 가서 이전 뷰를 다시 그릴 때는 히스토리를 쌓지 않는다.
let restoring = false;
function hpush() { if (!restoring) history.pushState(null, ''); }
function goBack() {
  restoring = true;
  try { back1(); } finally { restoring = false; }
}
function back1() {
  view.removeEventListener('change', onChk);
  state.stack.pop();
  const prev = state.stack[state.stack.length - 1];
  if (!prev || prev === 'home') return renderHome();
  state.stack.pop();
  if (prev === 'check') return openCheck();
  if (prev === 'appendix') return openAppendix();
  if (prev.v === 'rest') return openRest(prev.hub);
  if (prev.v === 'day') return openDay(prev.d);
  renderHome();
}

// 앱 ← 버튼과 폰의 뒤로가기(스와이프, 하드웨어 버튼)를 같은 경로로 처리한다.
// ── 항로 그림: 날짜별 실제 경유 좌표를 이은 선. hl이 있으면 그날만 밝게 ──
const PROJ = ([lat, lon]) => [((lon - 126.15) * 82).toFixed(1), ((38.05 - lat) * 100).toFixed(1)];
function routeSvg(hl) {
  const T = state.trip;
  const grid = [35, 36, 37].map(la => `<line x1="0" x2="300" y1="${PROJ([la, 126])[1]}" y2="${PROJ([la, 126])[1]}"/><text x="2" y="${PROJ([la, 126])[1] - 3}">${la}°N</text>`).join('')
    + [127, 128, 129].map(lo => `<line y1="0" y2="390" x1="${PROJ([36, lo])[0]}" x2="${PROJ([36, lo])[0]}"/><text x="${+PROJ([36, lo])[0] + 3}" y="386">${lo}°E</text>`).join('');
  const legs = T.days.map(d => {
    const pts = d.pts.map(PROJ).map(p => p.join(',')).join(' ');
    const dim = hl && hl !== d.d ? ' dim' : '';
    return `<polyline class="leg${dim}" points="${pts}" pathLength="1" style="--c:${rcolor(d.region)};--i:${d.d}"/>`;
  }).join('');
  const stops = T.days.map(d => {
    const [x, y] = PROJ(d.pts[d.pts.length - 1]);
    const on = hl === d.d ? ' on' : (hl ? ' dim' : '');
    return `<g class="stop${on}" data-d="${d.d}" transform="translate(${x} ${y})" style="--c:${rcolor(d.region)}" role="button" aria-label="${d.d}일차 ${esc(d.stop)}">
      <circle r="${hl === d.d ? 11 : 9}"/><text dy="3.6">${d.d}</text></g>`;
  }).join('');
  const [sx, sy] = PROJ(T.days[0].pts[0]);
  return `<svg class="route${hl ? ' mini' : ''}" viewBox="0 0 300 392" aria-hidden="${hl ? 'true' : 'false'}" role="img" aria-label="해안 일주 항로">
    <g class="grid">${grid}</g>${legs}
    <g class="start" transform="translate(${sx} ${sy})"><rect x="-4" y="-4" width="8" height="8"/><text x="8" y="4">거제</text></g>
    ${stops}</svg>`;
}

// ── 하단 탭 ──
function setTab(t) {
  document.querySelectorAll('.tabbar [data-tab]').forEach(b => b.dataset.tab === t ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'));
}
document.querySelector('.tabbar').addEventListener('click', e => {
  const b = e.target.closest('[data-tab]'); if (!b) return;
  view.removeEventListener('change', onChk);
  if (b.dataset.tab === 'home') return renderHome();
  state.stack = ['home'];
  b.dataset.tab === 'check' ? openCheck() : openAppendix();
});

backBtn.addEventListener('click', () => history.back());
window.addEventListener('popstate', () => { if (state.stack.length > 1) goBack(); });
boot();
