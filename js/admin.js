// 천운 — ★관리자 패널 (v7.83 신설 · 제이 전용)
// ═══════════════════════════════════════════════════════════════════════════
// 【★★이 파일에는 비밀이 없습니다 — 그것이 설계의 전부입니다】
//   이 소스를 통째로 읽어도 프리미엄 권한을 얻을 수 없습니다.
//   패널이 하는 일은 「**이미 서명된 토큰을 받아 저장소에 넣는 것**」뿐이고,
//   토큰을 **만들지 않습니다.** 서명에는 `CW_PREMIUM_HMAC_SECRET` 이 필요하고
//   그 값은 서버(Vercel 환경변수)에만 있습니다.
//
// 【★서버에 새 경로가 0 입니다】
//   관리자 토큰은 결제 토큰과 **바이트 구조가 같고**, 서버는 둘을 구별하지 않습니다.
//   ⟹ v7.81 B-4 가 확인한 「테스트 우회로 0건 · 뒷문 없음」이 그대로 유지됩니다.
//   ★`NODE_ENV`·`bypass`·`debug`·`allowFree` 같은 분기를 **추가하지 마십시오.**
//     그 순간 이 설계의 유일한 장점이 사라집니다.
//
// 【★★은닉은 방어가 아닙니다】
//   로고 5회 탭으로 패널을 여는 것은 **일반 사용자의 오조작을 막는 UX 장치**일 뿐입니다.
//   누가 패널을 열어도 유효 토큰 없이는 아무 일도 일어나지 않습니다.
//   ⟹ 「아무도 모를 것이다」에 기대는 부분이 이 설계에 **한 군데도 없습니다.**
//     (security through obscurity 가 아니라는 뜻입니다.)
//
// 【패널이 검증하는 것 / 못 하는 것】
//   · 검증함: 토큰의 **형상**(`cwp1.<b64u>.<b64u>`) · payload 파싱 · `pk`/`exp` 표시
//   · ★못 함: **서명 검증** — 시크릿이 없으므로 원리적으로 불가능합니다.
//     ⟹ 패널이 「저장됨」이라 해도 **서버가 거부하면 끝**입니다. 그 사실을 화면에 적습니다.
//       「저장 성공」을 「권한 획득」으로 표시하지 않습니다.
// ═══════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  var PANEL_ID = 'cwAdminPanel';
  var TOKEN_PREFIX = 'cwp1';
  // ★상품 목록은 `js/toss-pay.js` 의 `CW_PREMIUM_TYPE_TO_PRODUCT` 값 집합과 같아야 한다.
  //   여기서 열거하는 이유: 패널은 「무엇이 열려 있는가」를 **보여주는** 것이 일이므로
  //   목록이 필요하다. 판정은 열거가 아니라 저장소 실측으로 한다(아래 readState).
  var PRODUCTS = ['saju', 'compat', 'tojeong', 'dream', 'face', 'tarot',
                  'naming', 'naming_company', 'naming_product'];
  var LABEL = {
    saju: '사주', compat: '궁합', tojeong: '토정비결', dream: '꿈해몽',
    face: '관상', tarot: '타로', naming: '작명',
    naming_company: '회사 작명', naming_product: '제품 작명'
  };
  var TOKEN_STORE = 'cw_premium_tokens';      // js/toss-pay.js CW_PREMIUM_TOKEN_STORE
  var ENT_STORE = 'cw_entitlements';          // js/chat.js
  var LAST_PAY = 'cw_premium_last_payment';   // js/chat.js

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function b64uDecode(s) {
    var t = String(s).replace(/-/g, '+').replace(/_/g, '/');
    t = t + '='.repeat((4 - (t.length % 4)) % 4);
    try { return decodeURIComponent(escape(atob(t))); } catch (e) { return null; }
  }

  // ★토큰의 **형상**만 본다. 서명은 서버가 본다(시크릿이 없으므로 여기서 불가능).
  function parseToken(tok) {
    if (typeof tok !== 'string') return null;
    var parts = tok.split('.');
    if (parts.length !== 3 || parts[0] !== TOKEN_PREFIX || !parts[1] || !parts[2]) return null;
    var raw = b64uDecode(parts[1]);
    if (raw === null) return null;
    var p;
    try { p = JSON.parse(raw); } catch (e) { return null; }
    if (!p || typeof p !== 'object' || Array.isArray(p)) return null;
    if (typeof p.pk !== 'string' || typeof p.exp !== 'number') return null;
    return p;
  }

  function readJson(key) {
    try {
      var v = JSON.parse(localStorage.getItem(key) || '{}');
      return (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};
    } catch (e) { return {}; }
  }

  // ★현재 권한 상태를 **저장소 실측**으로 만든다(패널이 기억하는 값이 아니다).
  function readState() {
    var store = readJson(TOKEN_STORE);
    var ent = readJson(ENT_STORE);
    var now = Date.now();
    return PRODUCTS.map(function (k) {
      var e = store[k];
      var hasTok = !!(e && typeof e.t === 'string' && e.t);
      var expOk = hasTok && (typeof e.exp !== 'number' || e.exp <= 0 || now < e.exp);
      var entOk = typeof ent[k] === 'number' && (now - ent[k]) < 30 * 24 * 60 * 60 * 1000;
      var p = hasTok ? parseToken(e.t) : null;
      return {
        key: k, label: LABEL[k] || k,
        ok: expOk && entOk,
        exp: (e && typeof e.exp === 'number') ? e.exp : 0,
        src: (p && typeof p.src === 'string') ? p.src : ''
      };
    });
  }

  function fmtExp(ms) {
    if (!ms) return '-';
    var d = new Date(ms), pad = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  // ── 저장 — ★`js/toss-pay.js` 가 공개한 저장기를 쓴다(저장소 소유자를 하나로 유지) ──
  function saveOne(productKey, token, exp) {
    if (typeof window.cwSavePremiumToken === 'function') {
      window.cwSavePremiumToken(productKey, token, exp);
    } else {
      // toss-pay.js 미적재 환경(부분 로드)에서의 최소 폴백. 형태는 동일하다.
      var s = readJson(TOKEN_STORE);
      s[productKey] = { t: token, exp: (typeof exp === 'number' ? exp : 0) };
      try { localStorage.setItem(TOKEN_STORE, JSON.stringify(s)); } catch (e) {}
    }
    // 언락 게이트(`isPremiumActiveFor`)가 보는 것은 `cw_entitlements` 다. 함께 세운다.
    if (typeof window.markPremiumPayment === 'function') {
      window.markPremiumPayment(productKey);
    }
  }

  // 붙여넣은 값 → { 저장건수, 오류목록 }
  //   ⑴ 묶음 JSON  {"saju":{"t":"cwp1...","exp":123}, ...}
  //   ⑵ 단일 토큰  cwp1.<payload>.<sig>
  function applyInput(text) {
    var raw = String(text || '').trim();
    if (!raw) return { n: 0, errs: ['입력이 비어 있습니다'] };
    var errs = [], n = 0;

    if (raw.charAt(0) === '{') {
      var obj;
      try { obj = JSON.parse(raw); } catch (e) { return { n: 0, errs: ['묶음 JSON 을 읽지 못했습니다 — 한 줄 전체를 복사하셨는지 확인하십시오'] }; }
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { n: 0, errs: ['묶음 형식이 아닙니다'] };
      Object.keys(obj).forEach(function (k) {
        var e = obj[k];
        var tok = (e && typeof e === 'object') ? e.t : e;
        var p = parseToken(tok);
        if (!p) { errs.push(k + ': 토큰 형상 오류'); return; }
        if (p.pk !== k) { errs.push(k + ': 토큰의 상품(' + p.pk + ')이 키와 다릅니다'); return; }
        if (p.exp <= Date.now()) { errs.push(k + ': 이미 만료된 토큰입니다'); return; }
        saveOne(k, tok, (e && typeof e.exp === 'number') ? e.exp : p.exp);
        n++;
      });
      return { n: n, errs: errs };
    }

    var p1 = parseToken(raw);
    if (!p1) return { n: 0, errs: ['토큰 형상이 올바르지 않습니다 (cwp1.… 형태여야 합니다)'] };
    if (p1.exp <= Date.now()) return { n: 0, errs: ['이미 만료된 토큰입니다'] };
    if (PRODUCTS.indexOf(p1.pk) === -1) return { n: 0, errs: ['알 수 없는 상품키: ' + p1.pk] };
    saveOne(p1.pk, raw, p1.exp);
    return { n: 1, errs: [] };
  }

  function clearAll() {
    try {
      localStorage.removeItem(TOKEN_STORE);
      localStorage.removeItem(ENT_STORE);
      localStorage.removeItem(LAST_PAY);
    } catch (e) {}
  }

  // ★무료 기능의 일일 제한은 `localStorage` 카운터다(서버 방어가 아니다).
  //   `js/chat.js` 가 `cw_daily_msg_<YYYY-M-D>` 형태로 쓴다. 접두어로 전부 지운다.
  function resetDaily() {
    var kill = [];
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf('cw_daily_msg_') === 0) kill.push(k);
      }
      kill.forEach(function (k) { localStorage.removeItem(k); });
    } catch (e) {}
    return kill.length;
  }

  function render() {
    var panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    var st = readState();
    var open = st.filter(function (x) { return x.ok; }).length;
    var rows = st.map(function (x) {
      return '<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.05)">'
        + '<span style="color:' + (x.ok ? '#7ec98a' : 'rgba(154,152,144,.6)') + '">'
        + (x.ok ? '●' : '○') + ' ' + esc(x.label)
        + (x.src === 'admin' ? '<span style="font-size:9px;color:rgba(201,165,78,.6);margin-left:5px">ADMIN</span>' : '')
        + '</span>'
        + '<span style="font-size:10px;color:rgba(154,152,144,.5)">' + (x.ok ? esc(fmtExp(x.exp)) : '미개방') + '</span>'
        + '</div>';
    }).join('');
    panel.querySelector('#cwAdmState').innerHTML =
      '<div style="font-size:11px;color:rgba(201,165,78,.7);margin-bottom:6px">현재 권한 ' + open + ' / ' + st.length + '</div>' + rows;
  }

  function openPanel() {
    var prev = document.getElementById(PANEL_ID);
    if (prev) prev.remove();
    var ov = document.createElement('div');
    ov.id = PANEL_ID;
    ov.style.cssText = 'position:fixed;inset:0;z-index:10002;background:rgba(0,0,0,.8);display:flex;align-items:center;justify-content:center;padding:16px';
    ov.onclick = function (e) { if (e.target === ov) ov.remove(); };
    ov.innerHTML =
      '<div style="width:100%;max-width:420px;max-height:88vh;overflow-y:auto;background:#12121e;border:1px solid rgba(201,165,78,.28);border-radius:14px;padding:20px">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">'
      +   '<div style="font-size:14px;color:#c9a54e;font-family:\'Noto Serif KR\',serif">관리자</div>'
      +   '<button type="button" id="cwAdmClose" style="background:none;border:none;color:#9a9890;font-size:19px;cursor:pointer;line-height:1">✕</button>'
      + '</div>'
      + '<div id="cwAdmState" style="background:rgba(255,255,255,.03);border-radius:9px;padding:11px;margin-bottom:13px"></div>'
      + '<textarea id="cwAdmInput" rows="4" placeholder="발급기가 출력한 묶음 한 줄 또는 개별 토큰(cwp1.…)을 붙여넣으세요" '
      +   'style="width:100%;box-sizing:border-box;padding:9px;background:#0a0a12;border:1px solid rgba(201,165,78,.2);border-radius:8px;color:#e8e6e0;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:10.5px;line-height:1.5;resize:vertical"></textarea>'
      + '<div id="cwAdmMsg" style="font-size:11px;line-height:1.6;margin:9px 0;min-height:16px"></div>'
      + '<button type="button" id="cwAdmApply" style="width:100%;padding:11px;background:rgba(201,165,78,.9);border:none;border-radius:9px;color:#12121e;font-size:13px;font-weight:600;font-family:inherit;cursor:pointer">권한 적용</button>'
      + '<div style="display:flex;gap:7px;margin-top:7px">'
      +   '<button type="button" id="cwAdmDaily" style="flex:1;padding:9px;background:none;border:1px solid rgba(201,165,78,.22);border-radius:8px;color:rgba(201,165,78,.8);font-size:11px;font-family:inherit;cursor:pointer">일일 카운터 리셋</button>'
      +   '<button type="button" id="cwAdmClear" style="flex:1;padding:9px;background:none;border:1px solid rgba(232,90,79,.3);border-radius:8px;color:rgba(232,90,79,.85);font-size:11px;font-family:inherit;cursor:pointer">권한 전체 해제</button>'
      + '</div>'
      + '<div style="font-size:10px;line-height:1.7;color:rgba(154,152,144,.5);margin-top:12px;border-top:1px solid rgba(255,255,255,.06);padding-top:10px">'
      +   '★이 패널은 토큰을 <strong>저장할 뿐 만들지 않습니다.</strong> 서명은 서버 시크릿으로만 가능합니다.<br>'
      +   '★따라서 <strong>저장됨 ≠ 권한 획득</strong>입니다. 서명이 틀린 토큰은 첫 사용 시 서버가 403 으로 거부합니다.<br>'
      +   '★서버에는 관리자용 분기가 없습니다 — 이 토큰은 결제 토큰과 구조가 같습니다.'
      + '</div>'
      + '</div>';
    document.body.appendChild(ov);
    render();

    var msg = ov.querySelector('#cwAdmMsg');
    var say = function (html, color) { msg.innerHTML = html; msg.style.color = color || 'rgba(154,152,144,.8)'; };

    ov.querySelector('#cwAdmClose').addEventListener('click', function () { ov.remove(); });
    ov.querySelector('#cwAdmApply').addEventListener('click', function () {
      var r = applyInput(ov.querySelector('#cwAdmInput').value);
      render();
      if (r.n > 0 && r.errs.length === 0) {
        say('✓ ' + r.n + '개 상품 저장 완료. <strong>실제 개방 여부는 첫 프리미엄 요청에서 서버가 판정</strong>합니다.', '#7ec98a');
      } else if (r.n > 0) {
        say('△ ' + r.n + '개 저장 · ' + r.errs.length + '건 실패<br>' + esc(r.errs.join(' / ')), '#c9a54e');
      } else {
        say('★ 저장하지 못했습니다<br>' + esc(r.errs.join(' / ')), '#e85a4f');
      }
    });
    ov.querySelector('#cwAdmDaily').addEventListener('click', function () {
      var n = resetDaily();
      say('일일 카운터 ' + n + '건을 지웠습니다.', '#7ec98a');
    });
    ov.querySelector('#cwAdmClear').addEventListener('click', function () {
      clearAll(); render();
      say('권한을 전부 해제했습니다. (결제 내역 <code>cw_receipts</code> 는 남아 있습니다)', '#c9a54e');
    });
  }

  // ── 여는 방법: 헤더 로고 5회 연속 탭 ──────────────────────────────────────
  //   ★2초 안에 5회여야 한다. 일반 사용자가 우연히 열 확률을 낮추는 UX 장치이며,
  //     ★**보안 장치가 아니다**(위 주석 참조). 열어도 유효 토큰 없이는 아무 일도 없다.
  //
  // 【★★첫 구현이 왜 틀렸나 — 실측으로 잡았다】
  //   처음에는 `document.querySelector('.header-symbol')` 로 요소를 찾아 리스너를 붙이고,
  //   `readyState === 'loading'` 이면 `DOMContentLoaded` 를 기다렸다.
  //   ★jsdom 실측에서 `readyState` 가 `loading` 인 채로 `DOMContentLoaded` 가 오지 않아
  //     **리스너가 영영 안 붙었다.** 그런데 `wire()` 는 `return false` 만 하고 끝나므로
  //     ★**실패가 아무 데도 드러나지 않는다.** 패널이 안 열려도 「내가 잘못 탭했나」로 읽힌다.
  //   ⟹ 이것은 v7.81 이 말한 **「관측 없는 방어」**와 같은 형태다. 미봉책(재시도 루프)이
  //     아니라 **요소 존재 타이밍에 의존하지 않는 구조**로 바꾼다.
  //
  // 【수리 — 문서 레벨 위임(delegation)】
  //   ★`document` 에 한 번만 붙이고 클릭이 로고에서 났는지를 **그때** 판정한다.
  //     · DOM 이 언제 그려지든 동작한다 (`readyState` 분기 자체가 사라진다)
  //     · 헤더가 나중에 교체·재생성돼도 동작한다
  //     · 캡처 단계라 중간에서 `stopPropagation` 해도 도달한다
  var taps = 0, timer = null;
  function onDocClick(e) {
    var el = e && e.target;
    if (!el) return;
    // `closest` 미지원 환경 폴백 — 조상을 직접 거슬러 올라간다.
    var hit = null;
    if (el.closest) {
      hit = el.closest('.header-symbol');
    } else {
      for (var n = el; n && n.classList; n = n.parentNode) {
        if (n.classList.contains && n.classList.contains('header-symbol')) { hit = n; break; }
      }
    }
    if (!hit) return;
    taps++;
    if (timer) clearTimeout(timer);
    timer = setTimeout(function () { taps = 0; }, 2000);
    if (taps >= 5) { taps = 0; clearTimeout(timer); openPanel(); }
  }
  document.addEventListener('click', onDocClick, true);

  // ★결속 여부를 **관측 가능하게** 노출한다. 패널이 안 열릴 때
  //   「리스너가 안 붙은 것」과 「탭이 모자란 것」을 콘솔에서 구별할 수 있어야 한다.
  window.cwAdminWired = true;

  // ★테스트·재현용 공개 진입점. 비밀이 아니므로 공개해도 권한이 열리지 않는다.
  window.cwOpenAdmin = openPanel;
})();
