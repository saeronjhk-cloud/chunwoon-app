// 천운 — 손금 프리미엄 풀스택 (페이월 + LLM + PDF)
// 의존: window.photoState, window.palmMeta, window.markPremiumPayment, showToast
// 호출: window.attachPalmPaywall(lineResults, features) — setupPalmResultContainer 끝에서

// ============================================================
//  1. 페이월 카드 부착
// ============================================================
function attachPalmPaywall(lineResults, features){
  const r = document.getElementById('palmResult');
  if(!r) return;
  // 이미 부착되었으면 skip
  if(document.getElementById('palmPaywall')) return;
  // 무료 결과 데이터 보존
  window._palmResultData = {
    lineResults: lineResults || [],
    features: features || {},
    gender: (window.palmMeta && window.palmMeta.gender) || 'male',
    hand: (window.palmMeta && window.palmMeta.hand) || 'left'
  };
  // 페이월 카드 생성 (결과 카드 뒤에 추가)
  const pw = document.createElement('div');
  pw.className = 'card';
  pw.id = 'palmPaywall';
  pw.style.cssText = 'position:relative;overflow:hidden;margin-top:14px';
  pw.innerHTML = _palmPaywallInnerHTML();
  r.appendChild(pw);
}

function _palmPaywallInnerHTML(){
  return '<div style="filter:blur(5px);pointer-events:none;opacity:.5">' +
    '<div class="card-title">🔮 프리미엄 손금 리포트</div>' +
    '<div style="font-size:13px;line-height:1.85">' +
      '<p>✦ 9구(九丘) 정밀 분석 — 목성·토성·태양·수성·금성·달·화성·명왕</p>' +
      '<p>✦ 보조선 5종 — 결혼선·자녀선·여행선·건강선·금성대</p>' +
      '<p>✦ 손 모양 분류 (방형·원추형·혼합형 등) + 의미</p>' +
      '<p>✦ 4영역 심층 — 직업·재물·연애·건강</p>' +
      '<p>✦ 시점별 흐름 — 10대~70대+ 인생 그래프</p>' +
      '<p>✦ 개운법 — 반지·시간대·방위·색·요일</p>' +
      '<p>✦ A4 PDF 영구 보관</p>' +
    '</div>' +
    '</div>' +
    '<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(0,0,0,.65);backdrop-filter:blur(3px);border-radius:12px;padding:24px">' +
      '<div style="font-size:28px;margin-bottom:8px">🔒</div>' +
      '<div style="font-size:16px;color:#fff;font-weight:700;margin-bottom:4px;font-family:\'Noto Serif KR\',serif">프리미엄 손금 리포트</div>' +
      '<div style="font-size:11px;color:rgba(255,255,255,.65);margin-bottom:14px;text-align:center;line-height:1.7">9구·보조선·손 모양<br>인생 흐름 + 개운 가이드 풀스택</div>' +
      '<button onclick="unlockPalmPremium()" style="background:linear-gradient(135deg,var(--gold),#d4a017);color:#000;border:none;padding:14px 32px;border-radius:24px;font-weight:700;font-size:15px;cursor:pointer;font-family:\'Noto Serif KR\',serif;box-shadow:0 4px 16px rgba(201,165,78,.4)">₩4,900 · 손금 풀스택 리포트</button>' +
      '<div style="font-size:10px;color:rgba(255,255,255,.5);margin-top:10px;text-align:center;line-height:1.6">한 번의 결제, 평생 손금 가이드<br>A4 PDF 영구 보관</div>' +
    '</div>';
}

// ============================================================
//  2. 프리미엄 흐름
// ============================================================
async function unlockPalmPremium(){
  const info = window._palmResultData;
  if(!info){
    if(typeof showToast==='function') showToast('먼저 손금 분석을 받아주세요');
    return;
  }
  if(!confirm('프리미엄 손금 리포트 (₩4,900)를 구매하시겠습니까?\n\n9구·보조선·손 모양 + 시점별 흐름 + 개운법 + A4 PDF.\n\n※ 현재 테스트 기간으로 무료 체험 가능합니다.\n⚠️ 본 AI 분석은 오락·자기 이해 목적이며 중요한 의사결정의 근거로 사용하지 마세요.')) return;
  if(window.markPremiumPayment) window.markPremiumPayment();

  const pw = document.getElementById('palmPaywall');
  let loadTimer = null;
  if(pw){
    pw.innerHTML = '<div style="padding:30px;text-align:center">' +
      '<div style="font-size:28px;margin-bottom:12px" class="spin-emoji">✋</div>' +
      '<div style="color:var(--gold);font-size:13px;font-family:\'Noto Serif KR\',serif" id="palmPremLoadMsg">손금 9구 정밀 측정 중...</div>' +
      '<div style="margin-top:10px;width:200px;height:3px;border-radius:2px;background:rgba(201,165,78,.2);overflow:hidden;display:inline-block"><div id="palmPremLoadBar" style="height:100%;width:0;background:linear-gradient(90deg,#c9a54e,#f5d78e);border-radius:2px;transition:width 0.5s"></div></div>' +
      '<div style="font-size:9px;color:var(--text2);opacity:.5;margin-top:8px">9구·보조선·4영역 분석 약 30~40초</div>' +
      '</div>';
    pw.style.position = 'relative'; pw.style.overflow = 'visible';
    const steps = ['손금 9구 정밀 측정 중...','목성·토성·태양구 분석 중...','금성·달구 정밀 풀이 중...','결혼·자녀·여행선 풀이 중...','건강선·금성대 분석 중...','손 모양 분류 중...','직업·재물 심층 분석 중...','연애·건강 심층 분석 중...','시점별 인생 흐름 매핑 중...','개운법 + 격려 메시지 완성 중...'];
    let s = 0;
    loadTimer = setInterval(function(){
      s++;
      const m = document.getElementById('palmPremLoadMsg');
      const bar = document.getElementById('palmPremLoadBar');
      if(m && s < steps.length) m.textContent = steps[s];
      if(bar) bar.style.width = Math.min(95, s*10) + '%';
      if(s >= steps.length) clearInterval(loadTimer);
    }, 2400);
  }

  try {
    // 1·2단계 분할 호출
    const doFetch = async function(apiType){
      const llmFeatures = {};
      (info.lineResults||[]).forEach(function(lr){
        const f = lr.features || {};
        llmFeatures[lr.key] = {
          name: lr.name, score: lr.score,
          length: ['짧음','중간','김','매우 김'][f.lenIdx],
          depth: ['희미','보통','뚜렷','매우 깊음'][f.depthIdx],
          curvature: ['직선','완만','큰 곡선','구불'][f.curveIdx],
          special: ['특이사항 없음','가지선 있음','끊어진 부분','이중선','섬 있음','쇠사슬형'][f.specialIdx]
        };
      });
      const resp = await fetch('/api/fortune', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({type: apiType, features: llmFeatures, context:{gender:info.gender, hand:info.hand}})
      });
      const txt = await resp.text();
      if(!resp.ok) throw new Error('HTTP ' + resp.status + ': ' + txt.substring(0,150));
      const d = JSON.parse(txt);
      if(!d.success || !d.result) throw new Error(d.error || '응답 형식 오류');
      if(d.result.raw && !d.result.handShape && !d.result.areasDeep) throw new Error('AI 응답 파싱 실패 (max_tokens 추정)');
      return d.result;
    };

    let merged = {};
    let apiError = null;

    try {
      const r1 = await doFetch('palm_premium_1');
      Object.assign(merged, r1);
      const m = document.getElementById('palmPremLoadMsg');
      if(m) m.textContent = '4영역 심층 + 시점별 흐름 + 개운법 생성 중...';
      const bar = document.getElementById('palmPremLoadBar');
      if(bar) bar.style.width = '55%';
    } catch(e1){ apiError = '1단계: ' + e1.message; console.error('Palm Premium 1:', e1); }

    try {
      const r2 = await doFetch('palm_premium_2');
      Object.assign(merged, r2);
    } catch(e2){ apiError = (apiError?apiError+' | ':'') + '2단계: ' + e2.message; console.error('Palm Premium 2:', e2); }

    if(loadTimer) clearInterval(loadTimer);
    const hasData = !!(merged.handShape || merged.nineMounts || merged.areasDeep || merged.timeline);
    console.log('Palm Premium:', hasData?'OK':'FAIL', Object.keys(merged));
    if(!hasData) throw new Error(apiError || '데이터 없음');

    window._palmPremiumData = Object.assign({}, info, {prem: merged});
    renderPalmPremium(merged, info);

    if(apiError && pw){
      const notice = document.createElement('div');
      notice.style.cssText = 'margin:14px 0;padding:12px;background:rgba(232,90,79,.08);border:1px solid rgba(232,90,79,.25);border-radius:10px;text-align:center';
      notice.innerHTML = '<div style="font-size:12px;color:#e85a4f;margin-bottom:6px">⚠️ 일부 분석 섹션 로딩 실패</div>' +
        '<div style="font-size:10px;color:var(--text2);line-height:1.6">' + apiError + '</div>' +
        '<button onclick="unlockPalmPremium()" style="margin-top:8px;background:linear-gradient(135deg,#c9a54e,#8b6914);color:white;border:none;padding:10px 24px;border-radius:20px;font-weight:600;font-size:12px;cursor:pointer">🔄 누락 섹션 다시 시도</button>';
      pw.appendChild(notice);
    }
  } catch(err){
    if(loadTimer) clearInterval(loadTimer);
    console.error('손금 프리미엄 오류:', err);
    if(pw){
      pw.innerHTML = '<div style="padding:24px;text-align:center;background:rgba(232,90,79,.06);border:1px solid rgba(232,90,79,.25);border-radius:10px">' +
        '<div style="font-size:32px;margin-bottom:8px">⚠️</div>' +
        '<div style="font-size:13px;color:#e85a4f;font-weight:600;margin-bottom:6px">프리미엄 손금 리포트를 불러오지 못했습니다</div>' +
        '<div style="font-size:11px;color:var(--text2);line-height:1.6;margin-bottom:8px">' + ((err.message||'').substring(0,200)) + '</div>' +
        '<button onclick="unlockPalmPremium()" style="margin-top:8px;background:linear-gradient(135deg,#c9a54e,#8b6914);color:white;border:none;padding:10px 24px;border-radius:20px;font-weight:600;font-size:12px;cursor:pointer">🔄 AI 분석 다시 시도</button>' +
        '</div>';
    }
  }
}

// ============================================================
//  3. 프리미엄 렌더링
// ============================================================
function renderPalmPremium(prem, info){
  const pw = document.getElementById('palmPaywall');
  if(!pw) return;

  let handShapeHTML = '';
  if(prem.handShape){
    handShapeHTML = '<div style="margin-bottom:14px;padding:14px;background:rgba(201,165,78,.05);border-radius:10px;border:1px solid rgba(201,165,78,.15)">' +
      '<div style="font-size:13px;color:var(--gold);font-family:\'Noto Serif KR\',serif;font-weight:700;margin-bottom:6px">✋ 손 모양 — ' + (prem.handShape.type||'') + ' <span style="font-size:11px;color:var(--text2)">(' + (prem.handShape.element||'') + ')</span></div>' +
      '<div style="font-size:12.5px;line-height:1.85">' + (prem.handShape.meaning||'') + '</div>' +
      '</div>';
  }

  let mountsHTML = '';
  if(prem.nineMounts && Array.isArray(prem.nineMounts)){
    mountsHTML = '<div style="margin-bottom:14px;padding:14px;background:rgba(173,216,230,.05);border:1px solid rgba(173,216,230,.15);border-radius:10px">' +
      '<div style="font-size:13px;color:#7ab8d4;font-family:\'Noto Serif KR\',serif;font-weight:700;margin-bottom:10px">⭐ 9구(九丘) 정밀 분석</div>';
    prem.nineMounts.forEach(function(mt){
      mountsHTML += '<div style="margin-bottom:8px;padding:10px 12px;background:rgba(0,0,0,.15);border-radius:8px">' +
        '<div style="font-size:12px;color:#7ab8d4;font-weight:600;margin-bottom:2px">' + (mt.name||'') + ' <span style="font-size:10px;color:var(--text2);font-weight:400">· ' + (mt.position||'') + '</span></div>' +
        '<div style="font-size:11.5px;line-height:1.75;color:var(--text1);margin-bottom:3px"><strong>특징:</strong> ' + (mt.trait||'') + '</div>' +
        '<div style="font-size:11.5px;line-height:1.75;color:var(--text2)"><strong>영향:</strong> ' + (mt.fortune||'') + '</div>' +
        '</div>';
    });
    mountsHTML += '</div>';
  }

  let auxHTML = '';
  if(prem.auxLines && Array.isArray(prem.auxLines)){
    auxHTML = '<div style="margin-bottom:14px;padding:14px;background:rgba(232,90,79,.05);border:1px solid rgba(232,90,79,.15);border-radius:10px">' +
      '<div style="font-size:13px;color:#e85a4f;font-family:\'Noto Serif KR\',serif;font-weight:700;margin-bottom:10px">📌 보조선 5종</div>';
    prem.auxLines.forEach(function(al){
      auxHTML += '<div style="margin-bottom:8px;padding:10px 12px;background:rgba(0,0,0,.15);border-radius:8px">' +
        '<div style="font-size:12px;color:#e85a4f;font-weight:600;margin-bottom:2px">' + (al.name||'') + '</div>' +
        '<div style="font-size:11px;line-height:1.7;color:var(--text2);margin-bottom:3px;font-style:italic">' + (al.description||'') + '</div>' +
        '<div style="font-size:12px;line-height:1.8;color:var(--text1)">' + (al.reading||'') + '</div>' +
        '</div>';
    });
    auxHTML += '</div>';
  }

  let areasHTML = '';
  if(prem.areasDeep){
    const areas = [
      {k:'career', label:'💼 직업·소명', color:'#c9a54e'},
      {k:'wealth', label:'💰 재물', color:'#1a7a4a'},
      {k:'love', label:'💕 연애·결혼', color:'#e85a4f'},
      {k:'health', label:'🌿 건강', color:'#7ab8d4'}
    ];
    areasHTML = '<div style="margin-bottom:14px"><div style="font-size:13px;color:var(--gold);font-family:\'Noto Serif KR\',serif;font-weight:700;margin-bottom:10px">📖 4영역 심층 분석</div>';
    areas.forEach(function(a){
      if(prem.areasDeep[a.k]){
        areasHTML += '<div style="margin-bottom:10px;padding:12px;background:rgba(0,0,0,.15);border-radius:8px;border-left:3px solid ' + a.color + '">' +
          '<div style="font-size:12px;color:' + a.color + ';font-weight:600;margin-bottom:6px">' + a.label + '</div>' +
          '<div style="font-size:12px;line-height:1.85">' + prem.areasDeep[a.k] + '</div>' +
          '</div>';
      }
    });
    areasHTML += '</div>';
  }

  let timelineHTML = '';
  if(prem.timeline && Array.isArray(prem.timeline)){
    timelineHTML = '<div style="margin-bottom:14px;padding:14px;background:rgba(167,139,250,.05);border:1px solid rgba(167,139,250,.15);border-radius:10px">' +
      '<div style="font-size:13px;color:#a78bfa;font-family:\'Noto Serif KR\',serif;font-weight:700;margin-bottom:10px">⏳ 인생 그래프 (10대~70대+)</div>';
    prem.timeline.forEach(function(t){
      timelineHTML += '<div style="margin-bottom:8px;padding:10px 12px;background:rgba(0,0,0,.15);border-radius:8px">' +
        '<div style="font-size:11px;color:#a78bfa;font-weight:600;margin-bottom:3px">' + (t.age||'') + '</div>' +
        '<div style="font-size:12px;line-height:1.8;color:var(--text1)">' + (t.trait||'') + '</div>' +
        (t.fortune ? '<div style="font-size:11px;color:var(--gold);margin-top:3px;font-style:italic">· ' + t.fortune + '</div>' : '') +
        '</div>';
    });
    timelineHTML += '</div>';
  }

  let gaeunHTML = '';
  if(prem.gaeunbup){
    const g = prem.gaeunbup;
    gaeunHTML = '<div style="margin-bottom:14px;padding:14px;background:linear-gradient(135deg,rgba(201,165,78,.08),rgba(245,215,142,.05));border:1px solid rgba(201,165,78,.25);border-radius:10px">' +
      '<div style="font-size:13px;color:var(--gold);font-family:\'Noto Serif KR\',serif;font-weight:700;margin-bottom:10px">🔮 개운법</div>' +
      (g.ringFinger ? '<div style="margin-bottom:6px;font-size:12px;line-height:1.8"><strong style="color:var(--gold)">💍 길운 반지:</strong> ' + g.ringFinger + '</div>' : '') +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px">' +
        (g.luckyTime ? '<div style="padding:8px;background:rgba(0,0,0,.15);border-radius:6px;font-size:11px"><strong style="color:var(--gold)">⏰ 시간:</strong> ' + g.luckyTime + '</div>' : '') +
        (g.luckyDirection ? '<div style="padding:8px;background:rgba(0,0,0,.15);border-radius:6px;font-size:11px"><strong style="color:var(--gold)">🧭 방위:</strong> ' + g.luckyDirection + '</div>' : '') +
        (g.luckyColor ? '<div style="padding:8px;background:rgba(0,0,0,.15);border-radius:6px;font-size:11px"><strong style="color:var(--gold)">🎨 색:</strong> ' + g.luckyColor + '</div>' : '') +
        (g.luckyDay ? '<div style="padding:8px;background:rgba(0,0,0,.15);border-radius:6px;font-size:11px"><strong style="color:var(--gold)">📅 요일:</strong> ' + g.luckyDay + '</div>' : '') +
      '</div>' +
      (g.practice ? '<div style="font-size:12px;line-height:1.85;color:var(--text1)"><strong style="color:var(--gold)">📿 실천 가이드:</strong> ' + g.practice + '</div>' : '') +
      '</div>';
  }

  pw.innerHTML =
    '<div class="card-title" style="text-align:center;margin-bottom:14px">🔮 프리미엄 손금 리포트</div>' +
    '<div style="text-align:center;margin-bottom:14px;padding:10px;background:rgba(201,165,78,.05);border-radius:8px;font-size:12px;color:var(--text2)">' +
      '<strong style="color:var(--gold)">' + (info.hand==='left'?'🤚 왼손':'✋ 오른손') + '</strong> · ' + (info.gender==='male'?'남성':'여성') +
    '</div>' +
    handShapeHTML + mountsHTML + auxHTML + areasHTML + timelineHTML + gaeunHTML +
    (prem.blessing ? '<div style="margin:14px 0;padding:18px;background:linear-gradient(180deg,rgba(201,165,78,.08) 0%,rgba(201,165,78,.03) 100%);border-radius:12px;border:1.5px solid rgba(201,165,78,.3);text-align:center"><div style="font-size:13.5px;line-height:1.95;font-family:\'Noto Serif KR\',serif;font-style:italic">"' + prem.blessing + '"</div></div>' : '') +
    '<div style="display:flex;gap:10px;justify-content:center;margin-top:18px;flex-wrap:wrap">' +
      '<button class="share-btn" onclick="savePremiumPalmPDF()" style="flex:1;max-width:180px;display:flex;align-items:center;justify-content:center;gap:6px">📄 리포트 저장</button>' +
    '</div>';
  pw.style.position = 'relative'; pw.style.overflow = 'visible';
}

// ============================================================
//  4. PDF 저장 (DOM 직접 인쇄)
// ============================================================
function savePremiumPalmPDF(){
  const D = window._palmPremiumData;
  if(!D || !D.prem){
    if(typeof showToast==='function') showToast('프리미엄 손금 데이터가 없습니다');
    return;
  }
  if(typeof showToast==='function') showToast('리포트를 준비하고 있습니다...');
  const today = new Date().toLocaleDateString('ko-KR', {year:'numeric',month:'long',day:'numeric'});
  const title = '손금 프리미엄 리포트 — ' + (D.gender==='male'?'남성':'여성') + ' · ' + (D.hand==='left'?'왼손':'오른손');
  const target = document.getElementById('palmPaywall');
  if(!target) return;
  let html = target.innerHTML
    .replace(/var\(--gold\)/g,'#c9a54e').replace(/var\(--text1\)/g,'#222').replace(/var\(--text2\)/g,'#666')
    .replace(/rgba\(201,165,78,\.0[1-9]\)/g,'#fdf8e8').replace(/rgba\(232,90,79,\.0[1-9]\)/g,'#fbe9e7')
    .replace(/rgba\(26,122,74,\.0[1-9]\)/g,'#e8f5ed').replace(/rgba\(173,216,230,\.0[1-9]\)/g,'#e7f1f8')
    .replace(/rgba\(167,139,250,\.0[1-9]\)/g,'#f0eaff').replace(/rgba\(245,215,142,\.0[1-9]\)/g,'#fff6dd')
    .replace(/rgba\(0,0,0,\.[0-9]+\)/g,'#f5f5f5');
  const w = window.open('','_blank');
  if(!w){
    if(typeof showToast==='function') showToast('팝업이 차단되어 새 창을 열 수 없습니다');
    return;
  }
  w.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + title + ' - ' + today + '</title>' +
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@300;400;600;700&family=Noto+Sans+KR:wght@300;400;500;700&display=swap">' +
    '<style>@page{size:A4;margin:15mm}*{box-sizing:border-box}body{font-family:"Noto Sans KR",sans-serif;background:#fff;color:#222;font-size:10.5pt;line-height:1.7;margin:0}' +
    '.header{text-align:center;border-bottom:2px solid #c9a54e;padding-bottom:10px;margin-bottom:18px}' +
    '.header h1{font-family:"Noto Serif KR",serif;font-size:20pt;color:#c9a54e;margin:0 0 6px;font-weight:700}' +
    '.header .date{color:#666;font-size:10pt}.content > div{break-inside:auto;page-break-inside:auto}' +
    '.content button{display:none !important}.content .card-title{font-family:"Noto Serif KR",serif;font-size:14pt;color:#c9a54e;font-weight:700;margin-bottom:10px}' +
    '.foot{text-align:center;color:#999;font-size:8pt;margin-top:18px;padding-top:10px;border-top:1px solid #ddd}' +
    '.no-print{position:fixed;top:10px;right:10px;background:#c9a54e;color:#000;border:none;padding:10px 18px;border-radius:6px;font-weight:600;cursor:pointer;font-family:"Noto Sans KR",sans-serif;z-index:9999;font-size:13px}' +
    '@media print{.no-print{display:none}}</style></head><body>' +
    '<div class="header"><h1>' + title + '</h1><div class="date">' + today + '</div></div>' +
    '<div class="content">' + html + '</div>' +
    '<div class="foot">天運 (chunwoon.app) — 본 리포트는 오락 목적이며 과학적 근거를 보장하지 않습니다.</div>' +
    '<button class="no-print" onclick="window.print()">📄 PDF 저장 / 인쇄</button>' +
    '</body></html>');
  w.document.close();
  setTimeout(function(){ if(w.print) w.print(); }, 800);
}

// ============================================================
//  전역 노출
// ============================================================
if(typeof window !== 'undefined'){
  window.attachPalmPaywall = attachPalmPaywall;
  window.unlockPalmPremium = unlockPalmPremium;
  window.renderPalmPremium = renderPalmPremium;
  window.savePremiumPalmPDF = savePremiumPalmPDF;
}
