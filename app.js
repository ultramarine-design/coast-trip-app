'use strict';
// 전국 해안 일주 앱. 지리산 둘레길 앱의 3뷰 구조(홈 → 상세 → 부록, 뒤로가기 스택)를 그대로 따른다.

const $ = s => document.querySelector(s);
const view = $('#view');
const backBtn = $('#backBtn');
const sub = $('#sub');

const state = { trip: null, region: '전체', stack: [] };
const CHK_KEY = 'coast2026-check';

const icon = {
  route: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="19" r="2.4"/><circle cx="18" cy="5" r="2.4"/><path d="M8 18h6a3 3 0 0 0 0-6H10a3 3 0 0 1 0-6h6"/></svg>',
  phone: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h3l2 5-2.5 1.5a11 11 0 0 0 5 5L17 12l5 2v3a2 2 0 0 1-2.2 2A17 17 0 0 1 4 5.2 2 2 0 0 1 6 3z"/></svg>',
  ext: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
  map: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/></svg>',
  check: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 12l3 3 5-6"/></svg>',
  book: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2z"/><path d="M4 19a2 2 0 0 1 2-2h12"/></svg>',
};

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const mapUrl = q => 'https://map.naver.com/p/search/' + encodeURIComponent(q);
const dial = t => t.replace(/[^0-9]/g, '');
const rcolor = nm => (state.trip.regions.find(r => r.nm === nm) || {}).c || 'var(--moss)';

// 체크 상태는 기기에만 저장한다. 사파리 개인정보 모드 등에서 막히면 저장 없이 동작.
function loadChk() { try { return JSON.parse(localStorage.getItem(CHK_KEY)) || {}; } catch { return {}; } }
function saveChk(o) { try { localStorage.setItem(CHK_KEY, JSON.stringify(o)); } catch {} }

// 오늘 날짜(기기 시간)를 YYYY-MM-DD로
function todayStr() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

async function boot() {
  try {
    // 단일 HTML 매뉴얼(build_single.py 산출물)은 데이터를 window.TRIP으로 품고 있다.
    state.trip = window.TRIP || await fetch('data/trip.json').then(r => r.json());
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
  sub.textContent = '7박 8일 일자별 가이드';
  const T = state.trip;
  const today = todayStr();
  const first = T.days[0].date, last = T.days[T.days.length - 1].date;

  // 여행 중이면 오늘 일정, 출발 전이면 D-day와 남은 예약
  let banner = '';
  const td = T.days.find(d => d.date === today);
  if (td) {
    banner = `<button class="today" data-d="${td.d}"><span class="tx"><span class="tt">오늘 ${td.d}일차 · ${esc(td.title)}</span>
      <span class="sx">${esc(td.via)} · 잘 곳 ${esc(td.sleep.name)}</span></span><span class="arw">›</span></button>`;
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
    `<section class="lede fade">
       <span class="kicker">${esc(T.period)}</span>
       <h2>해안선 <em>${T.totalKm.toLocaleString('ko-KR')}km</em>를<br>하루씩 펼쳐 봐요</h2>
       <p>${esc(T.summary)}</p>
     </section>
     ${banner}
     <div class="controls"><div class="chips" id="rChips">${chips}</div></div>
     <div id="results"></div>`;

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
  const cards = days.map(d => {
    const hol = d.holiday ? `<span class="b hol">${esc(d.holiday)}</span>` : '';
    const heavy = d.heavy ? '<span class="b heavy">가장 먼 날</span>' : '';
    const sl = d.home ? '<span class="b">귀가</span>' : `<span class="b">${esc(d.sleep.type)}</span>`;
    return `<button class="seg${d.date === today ? ' is-today' : ''}" data-d="${d.d}" style="--c:${rcolor(d.region)}">
        <div class="head"><span class="no">${esc(d.label)}</span><span class="nm">${esc(d.title)}</span><span class="arw">›</span></div>
        <div class="badges"><span class="b km">${d.km}km · ${esc(d.drive)}</span>${sl}${hol}${heavy}</div>
        <p class="route">${icon.route}<span>${esc(d.via)}${d.home ? '' : ' · 잘 곳 ' + esc(d.sleep.name)}</span></p>
      </button>`;
  }).join('');

  const tail = state.region === '전체'
    ? `<button class="tile" id="chkBtn"><span class="ic">${icon.check}</span>
         <span class="tx"><span class="tt">체크리스트</span><span class="sx">예약, 전화 확인, 준비물</span></span><span class="arw">›</span></button>
       <button class="tile" id="appxBtn"><span class="ic">${icon.book}</span>
         <span class="tx"><span class="tt">부록</span><span class="sx">충전, 차박, 날씨, 연락처, 출처</span></span><span class="arw">›</span></button>
       <p class="foot-note">${T.notes.map(esc).join('<br>')}</p>`
    : '';

  $('#results').innerHTML = `<div class="list stagger">${cards}</div>${tail}`;
  $('#results').querySelectorAll('.seg').forEach(b => b.addEventListener('click', () => openDay(+b.dataset.d)));
  const cb = $('#chkBtn'); if (cb) cb.addEventListener('click', openCheck);
  const ab = $('#appxBtn'); if (ab) ab.addEventListener('click', openAppendix);
}

// ── 일자 상세 ──
function openDay(n, replace) {
  const T = state.trip;
  const d = T.days.find(x => x.d === n); if (!d) return;
  if (replace) state.stack.pop(); else hpush();
  state.stack.push({ v: 'day', d: n });
  backBtn.hidden = false;
  sub.textContent = `${d.d}일차 · ${d.label}${d.holiday ? ' ' + d.holiday : ''}`;

  const stat = (k, v, accent) => `<div class="stat${accent ? ' accent' : ''}"><div class="k">${k}</div><div class="v">${esc(v)}</div></div>`;
  const plan = d.plan.map(p => `<li><span class="t">${esc(p.t)}</span>
      <span class="x">${esc(p.x)}${p.ev ? '<span class="ev">충전</span>' : ''}</span>
      ${p.q ? `<a class="go" href="${mapUrl(p.q)}" target="_blank" rel="noopener" aria-label="${esc(p.q)} 지도">${icon.map}</a>` : ''}</li>`).join('');

  const s = d.sleep;
  const sleepBlock = d.home ? '' : `<div class="block"><h3>잘 곳 · ${esc(s.type)}</h3>
      <p><b>${esc(s.name)}</b>${s.fee ? ' · ' + esc(s.fee) : ''}</p>
      <p style="margin-top:6px">${esc(s.info)}</p>
      ${s.alt ? `<p class="alt">대안: ${esc(s.alt)}</p>` : ''}
      <div class="btnrow">
        ${s.tel ? `<a class="act" href="tel:${dial(s.tel)}">${icon.phone}전화</a>` : ''}
        ${s.url ? `<a class="act" href="${esc(s.url)}" target="_blank" rel="noopener">${icon.ext}예약</a>` : ''}
        ${s.q ? `<a class="act pri" href="${mapUrl(s.q)}" target="_blank" rel="noopener">${icon.map}지도</a>` : ''}
      </div></div>`;

  view.innerHTML =
    `<div class="detail">
       <div class="dhead"><span class="rgn" style="--c:${rcolor(d.region)}">${esc(d.region)} · ${d.d}일차</span><h2>${esc(d.title)}</h2></div>
       <div class="statgrid">
         ${stat('거리', d.km + 'km', true)}${stat('주행', d.drive)}
         ${stat('잘 곳', d.home ? '집' : s.type)}${stat('해', d.sun)}
       </div>
       <div class="block"><h3>일정</h3><ul class="tl">${plan}</ul></div>
       ${sleepBlock}
       <div class="block"><h3>충전</h3><p>${esc(d.ev)}</p></div>
       ${d.warn && d.warn.length ? `<div class="block warnb"><h3>주의</h3><ul>${d.warn.map(w => `<li>${esc(w)}</li>`).join('')}</ul></div>` : ''}
       <div class="pager">
         <button id="prevD" ${n === 1 ? 'disabled' : ''}>‹ ${n > 1 ? n - 1 + '일차' : ''}</button>
         <button id="nextD" ${n === T.days.length ? 'disabled' : ''}>${n < T.days.length ? n + 1 + '일차' : ''} ›</button>
       </div>
     </div>`;
  $('#prevD').addEventListener('click', () => openDay(n - 1, true));
  $('#nextD').addEventListener('click', () => openDay(n + 1, true));
  window.scrollTo(0, 0);
}

// ── 체크리스트 ──
function openCheck() {
  state.stack.push('check'); hpush();
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
  state.stack.push('appendix'); hpush();
  backBtn.hidden = false;
  sub.textContent = '부록';
  const T = state.trip;
  const secs = T.appendix.map(a => `<div class="sec"><h3>${esc(a.title)}</h3>${a.paras.map(p => `<p>${esc(p)}</p>`).join('')}</div>`).join('');
  const contacts = `<div class="sec"><h3>연락처</h3>${T.contacts.map(c =>
    `<div class="ct"><span class="nm">${esc(c.nm)}${c.note ? `<small>${esc(c.note)}</small>` : ''}</span><a href="tel:${dial(c.tel)}">${esc(c.tel)}</a></div>`).join('')}</div>`;
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
  if (prev.v === 'day') return openDay(prev.d);
  renderHome();
}

// 앱 ← 버튼과 폰의 뒤로가기(스와이프, 하드웨어 버튼)를 같은 경로로 처리한다.
backBtn.addEventListener('click', () => history.back());
window.addEventListener('popstate', () => { if (state.stack.length > 1) goBack(); });
boot();
