// 천운 — 타로 풀스택 (3~6단계)
// 의존: TAROT_MAJOR, TAROT_DECK, CELTIC_POS, TAROT_CATEGORIES, tarotSt, _collectSajuFromUI, addBotMsg, burstConfetti, showToast (index.html의 전역)

// ============================================================
//  ★I-84 — 뽑은 카드를 서버로 보낼 형상으로 만든다
// ============================================================
//   서버 프롬프트는 카드 이름을 `name` 으로 읽는데, 그 자리는 **대체값이 없는 단독
//   보간**이다. 클라 카드 원소는 표시용 이름을 `n` 으로만 실었기 때문에 프롬프트가
//   실제로는 「undefined(정방향) — 키워드: …」 로 나갔다 — LLM 이 키워드는 받고
//   **카드 이름을 못 받는** 상태가 타로 도입 이후 계속됐다(표면은 정상 · 값만 죽음).
//   ⟹ `n` 은 **그대로 둔다**(화면 렌더가 쓴다). `name` 을 **더하기만** 한다.
//   ★무료·프리미엄 두 적재 지점이 같은 변환을 하므로 여기 하나로 묶는다(사본 0).
function _tarotCardForApi(c, extra){
  return Object.assign({}, c, {name: c.n}, extra || {});
}

// ============================================================
//  ★★v7.84 — 사용자가 **직접 뽑는** 카드 픽커 (무료·프리미엄 공용)
// ============================================================
//  【무엇이 바뀌나】 종전에는 클라가 `sort(()=>Math.random()-.5).slice(0,N)` 으로
//    **혼자 정했다.** 사용자는 결과만 봤다. 이제 뒷면 덱을 펼쳐 놓고 사용자가 고른다.
//
//  ★★서버는 한 줄도 바뀌지 않는다 — 서버가 보는 것은 **몇 장이 왔는가**(`tarot:3` ·
//    `tarot_premium_1/2:10` · `api/fortune.js:1464`)와 각 원소의 **형상**뿐이고,
//    「누가 골랐는가」는 payload 에 나타나지 않는다. ⟹ 장수를 유지하는 한 게이트
//    `eval_naming_tarot_guard.js` 의 `T-0`(서버 상한 == 클라 `slice` 상한)도 무영향이다.
//    ★반대로 **장수를 바꾸면** 서버 상한과 클라 상한을 **함께** 고쳐야 하고 `T-0` 이 그것을
//      강제한다. 한쪽만 고치면 붉어진다 — 그것이 그 검사의 존재 이유다.
//
//  【설계 — 사본을 만들지 않는다(결정 99)】
//    무료(메이저 22 → 3장)와 프리미엄(풀덱 78 → 10장)이 **이 함수 하나**를 쓴다.
//    덱과 장수만 인자로 받는다. 두 벌로 나누면 반드시 갈린다.
//
//  【정/역방향은 여전히 무작위다 — 의도한 것】
//    ★사용자가 고르는 것은 **어느 카드인가**이지 **정방향인가 역방향인가**가 아니다.
//      실제 타로도 뒤집기 전까지 방향을 모른다. 방향까지 고르게 하면 점이 아니라
//      메뉴 선택이 된다. ⟹ 45% 역방향은 **뽑는 순간** 결정된다(종전과 동일).
//
//  【뒷면이라는 것이 핵심이다】
//    ★카드 앞면을 보여주고 고르게 하면 「운」이 사라진다. 그래서 픽커는 **정보를 0으로**
//      만든다 — 뒷면 문양만 있고, DOM 어디에도 어느 카드인지 적지 않는다.
//      셔플 결과는 클로저 안 `pool` 에만 있고 `data-*` 로 새지 않는다.
//
//  @param {Array}  deck  뽑을 덱 (TAROT_MAJOR | TAROT_DECK)
//  @param {number} need  뽑을 장수
//  @param {object} opts  {title, sub, cancelable}
//  @returns {Promise<Array|null>} 고른 카드 배열. 취소하면 null.
function _tarotPickCards(deck, need, opts){
  opts = opts || {};
  return new Promise((resolve) => {
    // ★셔플은 여기서 한 번만. 화면 순서 == 뒷면 순서이며 사용자는 알 수 없다.
    const pool = [...deck].sort(() => Math.random() - .5);
    const picked = [];                 // 선택한 pool 인덱스 (선택 순서 = 카드 순서)

    const ov = document.createElement('div');
    ov.id = 'cwTarotPicker';
    ov.className = 'cw-tp-ov';

    // ── 행 나누기 — 22장은 한 줄, 78장은 여러 줄. 모바일에서 카드가 뭉개지지 않게.
    const perRow = pool.length <= 26 ? pool.length : Math.ceil(pool.length / 4);
    const rows = [];
    for (let i = 0; i < pool.length; i += perRow) rows.push(pool.slice(i, i + perRow).map((_, j) => i + j));

    ov.innerHTML =
      '<div class="cw-tp-box" role="dialog" aria-modal="true" aria-label="타로 카드 선택">' +
        '<div class="cw-tp-title">' + (opts.title || '카드를 뽑아주세요') + '</div>' +
        '<div class="cw-tp-sub">' + (opts.sub || '') + '</div>' +
        '<div class="cw-tp-fans">' +
          rows.map(() => '<div class="cw-tp-fan"></div>').join('') +
        '</div>' +
        '<div class="cw-tp-count"><span class="cw-tp-n">0</span> / ' + need + '</div>' +
        '<div class="cw-tp-btns">' +
          (opts.cancelable ? '<button type="button" class="cw-tp-cancel">취소</button>' : '') +
          '<button type="button" class="cw-tp-ok" disabled>이 카드로 보기</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(ov);

    const fanEls = ov.querySelectorAll('.cw-tp-fan');
    const nEl = ov.querySelector('.cw-tp-n');
    const okBtn = ov.querySelector('.cw-tp-ok');
    const cardEls = new Map();         // poolIndex -> element

    // ── 부채꼴 배치 — 컨테이너 폭에서 간격을 **계산**한다(하드코딩하면 모바일에서 넘친다)
    const CARD_W = 54;
    function layout(){
      rows.forEach((idxs, r) => {
        const fan = fanEls[r];
        const w = fan.clientWidth || 320;
        const k = idxs.length;
        const gap = k > 1 ? Math.max(11, Math.min(30, (w - CARD_W - 12) / (k - 1))) : 0;
        const mid = (k - 1) / 2;
        idxs.forEach((pi, j) => {
          const el = cardEls.get(pi);
          if (!el) return;
          const off = j - mid;
          const rot = off * (k > 1 ? Math.min(2.4, 46 / k) : 0);
          const lift = Math.pow(Math.abs(off) / Math.max(1, mid), 2) * 12;
          el._base = 'translateX(' + (off * gap) + 'px) translateY(' + lift + 'px) rotate(' + rot + 'deg)';
          el.style.zIndex = String(100 + j);
          paint(pi);
        });
      });
    }
    function paint(pi){
      const el = cardEls.get(pi);
      if (!el) return;
      const at = picked.indexOf(pi);
      const on = at >= 0;
      el.classList.toggle('on', on);
      el.style.transform = el._base + (on ? ' translateY(-20px) scale(1.06)' : '');
      el.querySelector('.cw-tp-badge').textContent = on ? String(at + 1) : '';
      el.setAttribute('aria-pressed', on ? 'true' : 'false');
    }

    rows.forEach((idxs, r) => {
      idxs.forEach((pi) => {
        const el = document.createElement('button');
        el.type = 'button';
        el.className = 'cw-tp-card';
        // ★어느 카드인지 DOM 에 남기지 않는다 — 뒷면의 뜻이 그것이다.
        el.innerHTML = '<span class="cw-tp-badge"></span>';
        el.setAttribute('aria-label', '카드');
        el.onclick = () => {
          const at = picked.indexOf(pi);
          if (at >= 0) { picked.splice(at, 1); picked.forEach(paint); paint(pi); }
          else {
            if (picked.length >= need) { if (typeof showToast === 'function') showToast(need + '장을 이미 골랐습니다'); return; }
            picked.push(pi); paint(pi);
          }
          nEl.textContent = String(picked.length);
          okBtn.disabled = picked.length !== need;
        };
        cardEls.set(pi, el);
        fanEls[r].appendChild(el);
      });
    });

    const close = (val) => {
      window.removeEventListener('resize', layout);
      document.removeEventListener('keydown', onKey);
      ov.remove();
      resolve(val);
    };
    function onKey(e){ if (e.key === 'Escape' && opts.cancelable) close(null); }

    okBtn.onclick = () => {
      if (picked.length !== need) return;
      close(picked.map((pi) => pool[pi]));
    };
    const cancelBtn = ov.querySelector('.cw-tp-cancel');
    if (cancelBtn) cancelBtn.onclick = () => close(null);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', layout);
    // 레이아웃은 DOM 이 붙은 뒤에야 폭을 알 수 있다
    requestAnimationFrame(layout);
  });
}

// ============================================================
//  타로 무료 — 입력 검증 + 메이저 3장 + 정/역방향 결정
// ============================================================
async function analyzeTarot(){
  const category = (typeof tarotSt !== 'undefined' && tarotSt.category) || 'general';
  const question = document.getElementById('tarotQuestion').value.trim();
  // 사주 정보 (선택, 토글 열린 경우만)
  let saju = null;
  const sajuFields = document.getElementById('tarotSajuFields');
  if(sajuFields && sajuFields.style.display !== 'none'){
    saju = _collectSajuFromUI('tarotBirth','tarotHour','tarotGender');
  }
  // ★★v7.84 — 메이저 22장을 **뒷면으로 펼쳐** 사용자가 3장 고른다(종전: 클라 무작위 3장).
  //   ★장수 3 은 그대로다 — 서버 상한(`api/fortune.js:1464` `tarot:3`)과 게이트 `T-0` 이
  //     그 숫자로 묶여 있다. 여기를 바꾸려면 서버도 함께 바꿔야 한다.
  //   ★취소 가능 — 무료이므로 되돌아가도 잃는 것이 없다(프리미엄은 결제 뒤라 불가).
  const picked = await _tarotPickCards(TAROT_MAJOR, 3, {
    title: '세 장을 뽑아주세요',
    sub: '마음을 비우고 끌리는 카드를 고르세요 · 과거 · 현재 · 미래',
    cancelable: true
  });
  if(!picked) return;                     // 취소 — 아무것도 바꾸지 않는다
  // 정/역방향은 **뽑는 순간** 무작위로 정해진다(45%). 사용자는 방향을 고르지 않는다.
  const cards = picked.map(c => _tarotCardForApi(c, {reversed: Math.random() < 0.45, kind:'major'}));
  tarotSt.cards = cards;
  tarotSt.rev = 0;
  tarotSt.category = category;
  tarotSt.question = question;
  tarotSt.saju = saju;
  // 카드 UI 갱신
  cards.forEach((c, i) => {
    const el = document.getElementById(`tc-${i}`);
    if(!el) return;
    el.querySelector('.t-emoji').textContent = c.e;
    el.querySelector('.t-name').textContent = c.n + (c.reversed ? ' (역)' : '');
    el.classList.remove('flipped');
    el.classList.add('glow');
    const front = el.querySelector('.tarot-front');
    if(front) front.style.transform = c.reversed ? 'rotateY(180deg) rotate(180deg)' : 'rotateY(180deg)';
    el.onclick = () => revealTarot(i);
  });
  document.getElementById('tarotBtn').style.display = 'none';
  document.getElementById('tarotStatus').textContent = '카드를 터치하여 한 장씩 뒤집으세요';
  document.getElementById('tarotReading').style.display = 'none';
  document.getElementById('tarotReset').style.display = 'none';
}

// 카드 3장 펼친 후 LLM 호출
async function showTarotReading(){
  const r = document.getElementById('tarotReading');
  r.innerHTML = `<div class="card pulse-card" style="text-align:center;padding:40px 20px">
    <div style="font-size:40px;margin-bottom:12px" class="spin-emoji">✧</div>
    <div style="font-size:14px;color:var(--gold);font-family:'Noto Serif KR',serif;margin-bottom:16px">카드의 메시지를 해석하는 중...</div>
    <div class="loading-bar"><div class="loading-fill"></div></div>
    <div style="font-size:11px;color:var(--text2);margin-top:10px">3장의 카드 위치·정역방향을 사주와 연계하여 풀이 중</div>
  </div>`;
  r.style.display = 'block';
  r.scrollIntoView({behavior:'smooth',block:'start'});
  const ctx = {
    category: tarotSt.category || 'general',
    question: tarotSt.question || '',
    cards: tarotSt.cards
  };
  if(tarotSt.saju){
    // ★v7.79 계약 §2-1 — 생년월일 **원본 6키**. `tarotSt.saju` 는 `_collectSajuFromUI` 의
    //   반환이며 6키를 이미 들고 있다. 산출식은 `cwBirthKeys` 한 곳뿐이다(결정 99·113).
    //   ★타로는 `_sajuResultData` 폴백이 **없다** — 사주 토글을 안 열면 6키도 없고
    //     서버는 `mode:'legacy'` 로 아무것도 바꾸지 않는다(§6).
    const _bk = cwBirthKeys(tarotSt.saju.cal, tarotSt.saju.y, tarotSt.saju.m, tarotSt.saju.d, tarotSt.saju.h, tarotSt.saju.leap) || {};
    Object.assign(ctx, {
      ilgan: tarotSt.saju.ilgan || '',
      ilganElement: tarotSt.saju.ilganElement || '',
      dominant: tarotSt.saju.dominant || '',
      lacking: tarotSt.saju.lacking || '',
      cal:_bk.cal,y:_bk.y,m:_bk.m,d:_bk.d,h:_bk.h,leap:_bk.leap
    });
  }
  try {
    const resp = await fetch('/api/fortune', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'tarot',context:ctx})});
    const data = await resp.json();
    if(!data.success || !data.result) throw new Error(data.error || 'API 응답 오류');
    if(data.result.raw && !data.result.reading) throw new Error('AI 응답 파싱 실패');
    renderTarotResult(data.result);
  } catch(err) {
    console.error('타로 LLM 오류:', err);
    console.log('apiType: tarot, ctx:', ctx);
    renderTarotFallback(err.message);
  }
}

// ============================================================
//  결과 렌더링 (무료)
// ============================================================
function renderTarotResult(result){
  const r = document.getElementById('tarotReading');
  const cards = tarotSt.cards || [];
  const reading = result.reading || [];
  const score = result.fortuneScore || 0;
  const scoreColor = score>=75?'#1a7a4a':score>=50?'#b8860b':'#c9443a';

  let cardsHTML = '';
  reading.forEach((rd, i) => {
    const c = cards[i] || {};
    const posColor = ['#7ab8d4','#c9a54e','#a78bfa'][i] || '#c9a54e';
    cardsHTML += `<div style="padding:14px;margin-bottom:12px;background:rgba(201,165,78,.05);border-radius:12px;border-left:3px solid ${posColor}">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
        <div style="font-size:32px;${rd.reversed?'transform:rotate(180deg);':''}">${c.e||''}</div>
        <div style="flex:1">
          <div style="font-size:11px;color:${posColor};font-weight:600;font-family:'Noto Serif KR',serif">${rd.position || ['과거','현재','미래'][i]}</div>
          <div style="font-size:15px;color:var(--gold);font-weight:700;font-family:'Noto Serif KR',serif">${rd.cardName||c.n}${rd.reversed?' <span style="font-size:10px;color:#c9443a">(역방향)</span>':' <span style="font-size:10px;color:#1a7a4a">(정방향)</span>'}</div>
        </div>
      </div>
      <div style="font-size:12.5px;line-height:1.85;color:var(--text1);margin-bottom:6px;padding:8px 10px;background:rgba(0,0,0,.15);border-radius:6px">${rd.meaning||''}</div>
      ${rd.advice?`<div style="font-size:11.5px;color:#1a7a4a;line-height:1.7;padding:6px 10px;background:rgba(26,122,74,.06);border-radius:6px"><strong>💡 조언:</strong> ${rd.advice}</div>`:''}
    </div>`;
  });

  r.innerHTML = `<div class="card pulse-card">
    <div class="card-title">✧ 타로 해석</div>
    <div style="text-align:center;margin-bottom:14px;padding:10px;background:rgba(201,165,78,.05);border-radius:8px">
      <div style="font-size:24px;color:${scoreColor};font-weight:900;font-family:'Noto Serif KR',serif">${score}<span style="font-size:13px;color:var(--text2)">점</span></div>
      ${result.luckyKeyword?`<div style="font-size:11px;color:var(--text2);margin-top:2px">행운 키워드: <strong style="color:var(--gold)">${result.luckyKeyword}</strong></div>`:''}
    </div>
    ${result.summary?`<div class="reading" style="margin-bottom:14px">${result.summary}</div>`:''}
    <div style="font-size:13px;color:var(--gold);font-family:'Noto Serif KR',serif;font-weight:600;margin-bottom:10px">🎴 3장 카드 풀이</div>
    ${cardsHTML}
    ${result.keyMessage?`<div style="margin-top:14px;padding:14px;background:rgba(167,139,250,.06);border:1px solid rgba(167,139,250,.2);border-radius:10px;font-size:13px;line-height:1.85"><strong style="color:#a78bfa">🌟 핵심 메시지:</strong> ${result.keyMessage}</div>`:''}
    ${result.actionTip?`<div style="margin-top:10px;padding:12px;background:rgba(201,165,78,.06);border-radius:8px;font-size:12.5px;line-height:1.8"><strong style="color:var(--gold)">✦ 실천 조언:</strong> ${result.actionTip}</div>`:''}
    ${result.sajuLink?`<div style="margin-top:10px;padding:12px;background:rgba(26,122,74,.06);border:1px solid rgba(26,122,74,.15);border-radius:8px;font-size:12.5px;line-height:1.8"><strong style="color:#1a7a4a">⚯ 사주 연계:</strong> ${result.sajuLink}</div>`:''}
    <div style="display:flex;gap:10px;justify-content:center;margin-top:14px">
      <button class="share-btn" onclick="saveResult('tarot')" style="flex:1;max-width:140px;display:flex;align-items:center;justify-content:center;gap:6px">💾 결과 저장</button>
      <button class="share-btn" onclick="shareResult('tarot')" style="flex:1;max-width:140px;display:flex;align-items:center;justify-content:center;gap:6px">📤 결과 공유</button>
    </div>
  </div>
  ${_renderTarotPaywall()}`;
  r.style.display = 'block';
  document.getElementById('tarotReset').style.display = 'block';
  if(typeof burstConfetti === 'function') burstConfetti();
  window._tarotResultData = {...tarotSt, result};
  r.scrollIntoView({behavior:'smooth',block:'start'});
}

function renderTarotFallback(errMsg){
  const r = document.getElementById('tarotReading');
  r.innerHTML = `<div class="card pulse-card">
    <div class="card-title">✧ 타로 해석</div>
    <div style="margin:14px 0;padding:14px;background:rgba(232,90,79,.06);border:1px solid rgba(232,90,79,.2);border-radius:8px;text-align:center">
      <div style="font-size:32px;margin-bottom:8px">⚠️</div>
      <div style="font-size:13px;color:#e85a4f;font-weight:600;margin-bottom:6px">AI 타로 해석을 불러오지 못했습니다</div>
      <div style="font-size:11px;color:var(--text2);line-height:1.6">서버가 잠시 응답하지 않습니다. 잠시 후 다시 시도해주세요.</div>
      <div style="font-size:9px;color:var(--text2);opacity:.5;margin:6px 0">${(errMsg||'').substring(0,150)}</div>
      <button class="share-btn" onclick="showTarotReading()" style="margin-top:8px">🔄 다시 시도</button>
    </div>
  </div>
  ${_renderTarotPaywall()}`;
  r.style.display = 'block';
  document.getElementById('tarotReset').style.display = 'block';
}

function _renderTarotPaywall(){
  return `<div class="card" id="tarotPaywall" style="position:relative;overflow:hidden">
    <div style="filter:blur(5px);pointer-events:none;opacity:.5">
      <div class="card-title">🔮 프리미엄 타로 리포트</div>
      <div style="font-size:13px;line-height:1.85">
        <p>✦ 78장 풀덱 — 메이저 22장 + 마이너 56장</p>
        <p>✦ 켈틱 크로스 10장 스프레드 — 타로의 가장 깊은 풀이법</p>
        <p>✦ 각 카드 위치별 의미 + 정/역방향 통합 풀이</p>
        <p>✦ 마이너 아르카나 수트(완드·컵·소드·펜타클) 분석</p>
        <p>✦ 코트 카드(시종·기사·여왕·왕) 인물 상징</p>
        <p>✦ 사주 일간·오행 연계 깊이 있는 통찰</p>
        <p>✦ 시점별 흐름 — 1주·1개월·3개월 후</p>
        <p>✦ 구체적 실천 계획 + 행운 정보 (색·숫자·방위·요일)</p>
        <p>✦ A4 PDF 영구 보관</p>
      </div>
    </div>
    <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(0,0,0,.65);backdrop-filter:blur(3px);border-radius:12px;padding:24px">
      <div style="font-size:28px;margin-bottom:8px">🔒</div>
      <div style="font-size:16px;color:#fff;font-weight:700;margin-bottom:4px;font-family:'Noto Serif KR',serif">프리미엄 타로 리포트</div>
      <div style="font-size:11px;color:rgba(255,255,255,.65);margin-bottom:14px;text-align:center;line-height:1.7">전문 타로 리더 수준의 깊이를<br>천운에선 <span style="color:#f5d78e;font-weight:600">합리적인 가격</span>으로</div>
      <button onclick="unlockTarotPremium()" style="background:linear-gradient(135deg,var(--gold),#d4a017);color:#000;border:none;padding:14px 32px;border-radius:24px;font-weight:700;font-size:15px;cursor:pointer;font-family:'Noto Serif KR',serif;box-shadow:0 4px 16px rgba(201,165,78,.4)">₩4,900 · 켈틱 크로스 풀스택 리포트</button>
      <div style="font-size:10px;color:rgba(255,255,255,.5);margin-top:10px;text-align:center;line-height:1.6">78장 풀덱 + 10장 스프레드 + 사주 연계<br>A4 PDF 영구 보관</div>
    </div>
  </div>`;
}

// ============================================================
//  프리미엄 — 78장 + 켈틱 크로스 + 2단계 LLM
// ============================================================
async function unlockTarotPremium(){
  const info = window._tarotResultData;
  if(!info){showToast('먼저 타로를 받아주세요');return}
  if(window.payWithToss){
    const paid = await window.payWithToss('tarot');
    if(!paid) return;
  } else {
    if(!confirm('프리미엄 타로 리포트 (₩4,900)를 구매하시겠습니까?'))return;
    if(window.markPremiumPayment) window.markPremiumPayment('tarot');
  }

  // ★★v7.84 — 풀덱 78장을 **뒷면으로 펼쳐** 사용자가 10장 고른다(종전: 클라 무작위 10장).
  //   ★★취소를 열지 않는다 — 결제가 **이미 끝난** 지점이다. 여기서 빠져나갈 문을 만들면
  //     「돈은 나갔는데 받은 것이 없는」 상태가 생긴다. 10장을 다 골라야만 진행된다.
  //   ★따라서 이 호출은 결제 **직후·로딩 전**에 있어야 한다. 로딩 뒤로 옮기면
  //     사용자가 카드를 고르는 동안 진행바가 혼자 돌아가고, 앞으로 옮기면 결제 전에
  //     78장을 펼치게 된다(안 살 사람에게도).
  const premPicked = await _tarotPickCards(TAROT_DECK, 10, {
    title: '열 장을 뽑아주세요',
    sub: '켈틱 크로스 · 뽑은 순서대로 위치가 정해집니다 (현재 상황 → 장애 → …)',
    cancelable: false
  });
  if(!premPicked) return;                 // 방어 — cancelable:false 이므로 도달하지 않는다

  const pw = document.getElementById('tarotPaywall');
  let loadTimer = null;
  if(pw){
    pw.innerHTML = `<div style="padding:30px;text-align:center">
      <div style="font-size:28px;margin-bottom:12px" class="spin-emoji">✧</div>
      <div style="color:var(--gold);font-size:13px;font-family:'Noto Serif KR',serif" id="tarotPremLoadMsg">78장 풀덱 셔플 중...</div>
      <div style="margin-top:10px;width:200px;height:3px;border-radius:2px;background:rgba(201,165,78,.2);overflow:hidden;display:inline-block"><div id="tarotPremLoadBar" style="height:100%;width:0;background:linear-gradient(90deg,#c9a54e,#f5d78e);border-radius:2px;transition:width 0.5s"></div></div>
      <div style="font-size:9px;color:var(--text2);opacity:.5;margin-top:8px">10장 카드 위치별 풀이 + 사주 연계 약 30~40초</div>
    </div>`;
    pw.style.position='relative';pw.style.overflow='visible';
    const loadSteps=['78장 풀덱 셔플 중...','켈틱 크로스 10장 위치 매핑 중...','메이저·마이너 의미 분석 중...','정/역방향 통합 풀이 중...','수트·코트 카드 상징 분석 중...','사주 일간·오행 연계 중...','시점별 흐름(1주·1달·3달) 매핑 중...','실천 계획·행운 정보 정리 중...','최종 메시지 다듬는 중...'];
    let loadStep=0;
    loadTimer=setInterval(()=>{
      loadStep++;
      const m=document.getElementById('tarotPremLoadMsg');
      const bar=document.getElementById('tarotPremLoadBar');
      if(m&&loadStep<loadSteps.length)m.textContent=loadSteps[loadStep];
      if(bar)bar.style.width=Math.min(95,loadStep*11)+'%';
      if(loadStep>=loadSteps.length)clearInterval(loadTimer);
    },2400);
  }

  // ★v7.84 — 사용자가 고른 10장. 정/역방향은 **뽑는 순간** 무작위(45%)로 정해진다.
  //   ★장수 10 은 그대로다 — 서버 상한(`tarot_premium_1/2:10`)·켈틱 크로스 10 포지션·
  //     게이트 `T-0` 이 그 숫자에 묶여 있다.
  const cards = premPicked.map(c => _tarotCardForApi(c, {reversed: Math.random() < 0.45}));
  info.premCards = cards;

  const ctx = {
    category: info.category || 'general',
    question: info.question || '',
    cards: cards
  };
  if(info.saju){
    // ★v7.79 계약 §2-1 — 프리미엄(1·2단계 2회 호출 · 재시도 경로 포함)도 같은 6키를 싣는다(결정 90).
    const _bk = cwBirthKeys(info.saju.cal, info.saju.y, info.saju.m, info.saju.d, info.saju.h, info.saju.leap) || {};
    Object.assign(ctx, {
      ilgan: info.saju.ilgan || '',
      ilganElement: info.saju.ilganElement || '',
      dominant: info.saju.dominant || '',
      lacking: info.saju.lacking || '',
      cal:_bk.cal,y:_bk.y,m:_bk.m,d:_bk.d,h:_bk.h,leap:_bk.leap
    });
  }

  try{
    const doFetch = async (apiType) => {
      const resp = await fetch('/api/fortune',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:apiType,context:ctx})});
      const txt = await resp.text();
      if(!resp.ok) throw new Error(`HTTP ${resp.status}: ${txt.substring(0,150)}`);
      const d = JSON.parse(txt);
      if(!d.success || !d.result) throw new Error(d.error || '응답 형식 오류');
      if(d.result.raw && !d.result.readings && !d.result.deepAnalysis) throw new Error('AI 응답 파싱 실패');
      return d.result;
    };
    let merged = {};
    let apiError = null;
    try{
      Object.assign(merged, await doFetch('tarot_premium_1'));
      const m=document.getElementById('tarotPremLoadMsg');
      if(m) m.textContent = '6~10번 카드 + 사주 연계 풀이 중...';
      const bar=document.getElementById('tarotPremLoadBar');if(bar)bar.style.width='55%';
    }catch(e){apiError = '1단계: ' + e.message; console.error('Tarot Premium 1:', e)}
    try{
      const r2 = await doFetch('tarot_premium_2');
      const r2Readings = r2.readings || [];
      if(merged.readings) merged.readings = [...(merged.readings||[]), ...r2Readings];
      else merged.readings = r2Readings;
      Object.assign(merged, {sajuLink:r2.sajuLink, timeline:r2.timeline, actionPlan:r2.actionPlan, luckyInfo:r2.luckyInfo, blessing:r2.blessing});
    }catch(e){apiError = (apiError?apiError+' | ':'') + '2단계: ' + e.message; console.error('Tarot Premium 2:', e)}

    if(loadTimer) clearInterval(loadTimer);
    const hasData = !!(merged.readings && merged.readings.length);
    if(!hasData) throw new Error(apiError || '데이터 없음');

    window._tarotPremiumData = {...info, prem: merged, cards: cards};
    renderTarotPremium(merged, info, cards);

    if(apiError && pw){
      const notice = document.createElement('div');
      notice.style.cssText='margin:14px 0;padding:12px;background:rgba(232,90,79,.08);border:1px solid rgba(232,90,79,.25);border-radius:10px;text-align:center';
      notice.innerHTML=`<div style="font-size:12px;color:#e85a4f;margin-bottom:6px">⚠️ 일부 분석 섹션 로딩 실패</div>
        <div style="font-size:10px;color:var(--text2);line-height:1.6">${apiError}</div>
        <button onclick="retryTarotPremiumAPI()" style="margin-top:8px;background:linear-gradient(135deg,#c9a54e,#8b6914);color:white;border:none;padding:10px 24px;border-radius:20px;font-weight:600;font-size:12px;cursor:pointer">🔄 다시 시도</button>`;
      pw.appendChild(notice);
    }
  }catch(err){
    if(loadTimer) clearInterval(loadTimer);
    console.error('타로 프리미엄 오류:', err);
    if(pw){
      pw.innerHTML = `<div style="padding:24px;text-align:center;background:rgba(232,90,79,.06);border:1px solid rgba(232,90,79,.25);border-radius:10px">
        <div style="font-size:32px;margin-bottom:8px">⚠️</div>
        <div style="font-size:13px;color:#e85a4f;font-weight:600;margin-bottom:6px">프리미엄 타로를 불러오지 못했습니다</div>
        <div style="font-size:11px;color:var(--text2);line-height:1.6;margin-bottom:8px">${(err.message||'').substring(0,200)}</div>
        <button onclick="retryTarotPremiumAPI()" style="margin-top:8px;background:linear-gradient(135deg,#c9a54e,#8b6914);color:white;border:none;padding:10px 24px;border-radius:20px;font-weight:600;font-size:12px;cursor:pointer">🔄 AI 분석 다시 시도</button>
      </div>`;
    }
  }
}

async function retryTarotPremiumAPI(){
  const info = window._tarotResultData;
  if(!info) return;
  return unlockTarotPremium();
}

function renderTarotPremium(prem, info, cards){
  const pw = document.getElementById('tarotPaywall');
  if(!pw) return;
  const posNames = ['현재 상황','장애·교차','기반·뿌리','과거','왕관·의식','가까운 미래','자신','환경','희망과 두려움','최종 결과'];
  const readings = prem.readings || [];
  let cardsHTML = '';
  readings.forEach((rd, i) => {
    const c = (cards||[])[i] || {};
    const isMajor = c.kind === 'major';
    const cardColor = isMajor ? '#c9a54e' : (c.suit==='wands'?'#e85a4f':c.suit==='cups'?'#7ab8d4':c.suit==='swords'?'#a78bfa':'#1a7a4a');
    cardsHTML += `<div style="padding:14px;margin-bottom:12px;background:rgba(201,165,78,.04);border-radius:10px;border-left:3px solid ${cardColor}">
      <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:8px">
        <div style="font-size:11px;color:${cardColor};font-weight:700;min-width:24px">${i+1}</div>
        <div style="font-size:28px;${rd.reversed?'transform:rotate(180deg);':''}">${c.e||''}</div>
        <div style="flex:1">
          <div style="font-size:10px;color:${cardColor};font-weight:600;font-family:'Noto Serif KR',serif">${rd.position || posNames[i]}</div>
          <div style="font-size:14px;color:var(--gold);font-weight:700;font-family:'Noto Serif KR',serif">${rd.cardName || c.n}${rd.reversed?' <span style="font-size:10px;color:#c9443a">(역)</span>':' <span style="font-size:10px;color:#1a7a4a">(정)</span>'}</div>
          ${c.kind==='minor'||c.kind==='court' ? `<div style="font-size:9.5px;color:var(--text2);margin-top:1px">수트: ${c.suitName||c.suit||''}${c.court?` · 코트: ${c.court}`:''} · 키워드: ${rd.reversed?(c.rev||c.theme||''):(c.up||c.theme||'')}</div>` : ''}
        </div>
      </div>
      <div style="font-size:12px;line-height:1.85;padding:8px 10px;background:rgba(0,0,0,.15);border-radius:6px;margin-bottom:5px">${rd.meaning||''}</div>
      ${rd.advice?`<div style="font-size:11px;color:#1a7a4a;padding:5px 10px;background:rgba(26,122,74,.06);border-radius:6px"><strong>💡</strong> ${rd.advice}</div>`:''}
    </div>`;
  });

  pw.innerHTML = `<div class="card-title" style="text-align:center;margin-bottom:14px">🔮 프리미엄 타로 리포트</div>
    ${prem.deepAnalysis?`<div style="margin-bottom:14px;padding:14px;background:rgba(201,165,78,.05);border-radius:10px;font-size:13px;line-height:1.85"><strong style="color:var(--gold)">✦ 종합 분석:</strong> ${prem.deepAnalysis}</div>`:''}
    <div style="font-size:13px;color:var(--gold);font-family:'Noto Serif KR',serif;font-weight:700;margin-bottom:10px;text-align:center">🎴 켈틱 크로스 10장 풀이</div>
    ${cardsHTML}
    ${prem.sajuLink?`<div style="margin:14px 0;padding:14px;background:rgba(26,122,74,.06);border:1px solid rgba(26,122,74,.2);border-radius:10px;font-size:12.5px;line-height:1.85"><strong style="color:#1a7a4a">⚯ 사주 연계:</strong> ${prem.sajuLink}</div>`:''}
    ${prem.timeline?`<div style="margin:14px 0;padding:14px;background:rgba(167,139,250,.06);border:1px solid rgba(167,139,250,.2);border-radius:10px">
      <div style="font-size:13px;color:#a78bfa;font-family:'Noto Serif KR',serif;font-weight:700;margin-bottom:8px">⏳ 시점별 흐름</div>
      ${prem.timeline.oneWeek?`<div style="margin-bottom:6px;padding:8px 10px;background:rgba(0,0,0,.15);border-radius:6px;font-size:12px;line-height:1.7"><strong style="color:#a78bfa">1주 후:</strong> ${prem.timeline.oneWeek}</div>`:''}
      ${prem.timeline.oneMonth?`<div style="margin-bottom:6px;padding:8px 10px;background:rgba(0,0,0,.15);border-radius:6px;font-size:12px;line-height:1.7"><strong style="color:#a78bfa">1개월 후:</strong> ${prem.timeline.oneMonth}</div>`:''}
      ${prem.timeline.threeMonths?`<div style="padding:8px 10px;background:rgba(0,0,0,.15);border-radius:6px;font-size:12px;line-height:1.7"><strong style="color:#a78bfa">3개월 후:</strong> ${prem.timeline.threeMonths}</div>`:''}
    </div>`:''}
    ${prem.actionPlan?`<div style="margin:14px 0;padding:14px;background:rgba(201,165,78,.06);border-radius:10px;font-size:12.5px;line-height:1.85"><strong style="color:var(--gold)">✦ 실천 계획:</strong> ${prem.actionPlan}</div>`:''}
    ${prem.luckyInfo?`<div style="margin:14px 0;padding:14px;background:rgba(232,90,79,.06);border:1px solid rgba(232,90,79,.2);border-radius:10px">
      <div style="font-size:13px;color:#e85a4f;font-family:'Noto Serif KR',serif;font-weight:700;margin-bottom:8px;text-align:center">🍀 행운 정보</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center">
        ${prem.luckyInfo.color?`<div style="flex:1;min-width:80px;padding:8px;background:rgba(0,0,0,.15);border-radius:6px;text-align:center;font-size:11px"><div style="color:var(--text2);font-size:9px">색</div><div style="color:var(--text1);font-weight:600;margin-top:2px">${prem.luckyInfo.color}</div></div>`:''}
        ${prem.luckyInfo.number!=null?`<div style="flex:1;min-width:80px;padding:8px;background:rgba(0,0,0,.15);border-radius:6px;text-align:center;font-size:11px"><div style="color:var(--text2);font-size:9px">숫자</div><div style="color:var(--text1);font-weight:600;margin-top:2px">${prem.luckyInfo.number}</div></div>`:''}
        ${prem.luckyInfo.direction?`<div style="flex:1;min-width:80px;padding:8px;background:rgba(0,0,0,.15);border-radius:6px;text-align:center;font-size:11px"><div style="color:var(--text2);font-size:9px">방위</div><div style="color:var(--text1);font-weight:600;margin-top:2px">${prem.luckyInfo.direction}</div></div>`:''}
        ${prem.luckyInfo.day?`<div style="flex:1;min-width:80px;padding:8px;background:rgba(0,0,0,.15);border-radius:6px;text-align:center;font-size:11px"><div style="color:var(--text2);font-size:9px">요일</div><div style="color:var(--text1);font-weight:600;margin-top:2px">${prem.luckyInfo.day}</div></div>`:''}
      </div>
    </div>`:''}
    ${prem.blessing?`<div style="margin:14px 0;padding:18px;background:linear-gradient(180deg,rgba(201,165,78,.08) 0%,rgba(201,165,78,.03) 100%);border-radius:12px;border:1.5px solid rgba(201,165,78,.3);text-align:center">
      <div style="font-size:13.5px;line-height:1.95;font-family:'Noto Serif KR',serif;color:var(--text1);font-style:italic">"${prem.blessing}"</div>
    </div>`:''}
    <div style="display:flex;gap:10px;justify-content:center;margin-top:18px;flex-wrap:wrap">
      <button class="share-btn" onclick="savePremiumTarotPDF()" style="flex:1;max-width:180px;display:flex;align-items:center;justify-content:center;gap:6px">📄 리포트 저장</button>
    </div>`;
  pw.style.position = 'relative'; pw.style.overflow = 'visible';
}

// ============================================================
//  PDF 저장 (DOM 직접 인쇄)
// ============================================================
function savePremiumTarotPDF(){
  const D = window._tarotPremiumData;
  if(!D || !D.prem){ showToast('프리미엄 타로 데이터가 없습니다'); return }
  showToast('타로 리포트를 준비하고 있습니다...');
  const today = new Date().toLocaleDateString('ko-KR',{year:'numeric',month:'long',day:'numeric'});
  const catName = {love:'사랑·연애',work:'일·커리어',money:'재물·돈',health:'건강',general:'전반적 운',free:'자유 질문'}[D.category]||'타로';
  const title = `타로 프리미엄 — ${catName}`;
  const target = document.getElementById('tarotPaywall');
  if(!target){ showToast('리포트 영역을 찾지 못했습니다'); return }
  let html = target.innerHTML
    .replace(/var\(--gold\)/g,'#c9a54e')
    .replace(/var\(--text1\)/g,'#222')
    .replace(/var\(--text2\)/g,'#666')
    .replace(/var\(--card\)/g,'#f8f8f8')
    .replace(/var\(--border\)/g,'#ddd')
    .replace(/rgba\(201,165,78,\.0[1-9]\)/g,'#fdf8e8')
    .replace(/rgba\(232,90,79,\.0[1-9]\)/g,'#fbe9e7')
    .replace(/rgba\(26,122,74,\.0[1-9]\)/g,'#e8f5ed')
    .replace(/rgba\(173,216,230,\.0[1-9]\)/g,'#e7f1f8')
    .replace(/rgba\(167,139,250,\.0[1-9]\)/g,'#f0eaff')
    .replace(/rgba\(0,0,0,\.[0-9]+\)/g,'#f5f5f5');
  const w = window.open('','_blank');
  if(!w){ showToast('팝업이 차단되어 새 창을 열 수 없습니다'); return }
  w.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${title} - ${today}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@300;400;600;700&family=Noto+Sans+KR:wght@300;400;500;700&display=swap">
<style>
@page{size:A4;margin:15mm}
*{box-sizing:border-box}
body{font-family:'Noto Sans KR',sans-serif;background:#fff;color:#222;font-size:10.5pt;line-height:1.7;margin:0}
.header{text-align:center;border-bottom:2px solid #c9a54e;padding-bottom:10px;margin-bottom:18px}
.header h1{font-family:'Noto Serif KR',serif;font-size:20pt;color:#c9a54e;margin:0 0 6px;font-weight:700}
.header .date{color:#666;font-size:10pt}
.content > div{break-inside:auto;page-break-inside:auto}
.content button{display:none !important}
.content .card-title{font-family:'Noto Serif KR',serif;font-size:14pt;color:#c9a54e;font-weight:700;margin-bottom:10px}
.foot{text-align:center;color:#999;font-size:8pt;margin-top:18px;padding-top:10px;border-top:1px solid #ddd}
.no-print{position:fixed;top:10px;right:10px;background:#c9a54e;color:#000;border:none;padding:10px 18px;border-radius:6px;font-weight:600;cursor:pointer;font-family:'Noto Sans KR',sans-serif;z-index:9999;font-size:13px}
@media print{.no-print{display:none}}
</style>
</head><body>
<div class="header">
  <h1>${title}</h1>
  <div class="date">${today}${D.question?` · "${D.question}"`:''}</div>
</div>
<div class="content">${html}</div>
<div class="foot">天運 (chunwoon.app) — 본 리포트는 오락 목적이며 과학적 근거를 보장하지 않습니다.</div>
<button class="no-print" onclick="window.print()">📄 PDF 저장 / 인쇄</button>
</body></html>`);
  setTimeout(function(){ if(w.print) w.print(); }, 800);
}
