// 천운 — 면책·동의 안내 모듈 (Gemini 평가 ⑤번 대응)
// 1. 첫 진입 시 동의 banner (1회만)
// 2. 작명 결과(회사·제품) 자동 경고 박스 삽입
// 3. 글로벌 면책 헬퍼

// ============================================================
//  1. 첫 진입 동의 banner
// ============================================================
function _showDisclaimerBannerIfNeeded(){
  try {
    if(localStorage.getItem('cw_disclaimer_accepted') === '1') return;
  } catch(e){}
  // splash 끝난 후 (약 3초)
  setTimeout(_renderDisclaimerBanner, 3200);
}

function _renderDisclaimerBanner(){
  if(document.getElementById('cwDisclaimerBanner')) return;
  const wrap = document.createElement('div');
  wrap.id = 'cwDisclaimerBanner';
  wrap.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:10002;background:rgba(10,10,18,.98);border-top:2px solid var(--gold);padding:14px 16px;backdrop-filter:blur(10px);box-shadow:0 -4px 20px rgba(0,0,0,.6);animation:slideUp .4s ease-out';
  wrap.innerHTML =
    '<div style="max-width:480px;margin:0 auto">' +
      '<div style="font-size:12px;color:var(--gold);font-weight:600;margin-bottom:6px">⚠️ 천운(天運) 이용 전 확인</div>' +
      '<div style="font-size:11px;color:var(--text2);line-height:1.65;margin-bottom:10px">' +
        '본 앱의 모든 AI 분석(사주·관상·타로·꿈·궁합·작명·토정 등)은 <strong style="color:var(--gold)">오락 및 자기 이해 목적</strong>이며, ' +
        '과학적·법적 효력을 보장하지 않습니다. <strong style="color:#e85a4f">의료·법률(상표/등기)·금융·결혼 등 중요한 결정의 근거로 사용을 금지</strong>합니다. ' +
        '작명·상표 등록 가능성 평가는 AI 추정이며 실제 등록은 KIPRIS·인터넷등기소·변리사 확인이 필수입니다.' +
      '</div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end">' +
        '<button onclick="_acceptDisclaimer()" style="padding:8px 18px;background:linear-gradient(135deg,var(--gold),#d4a017);color:#000;border:none;border-radius:18px;font-weight:700;font-size:12px;cursor:pointer;font-family:\'Noto Sans KR\',sans-serif">동의하고 시작</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(wrap);
}

function _acceptDisclaimer(){
  try { localStorage.setItem('cw_disclaimer_accepted', '1'); } catch(e){}
  const wrap = document.getElementById('cwDisclaimerBanner');
  if(wrap) {
    wrap.style.transition = 'transform .3s, opacity .3s';
    wrap.style.transform = 'translateY(100%)';
    wrap.style.opacity = '0';
    setTimeout(function(){ wrap.remove(); }, 300);
  }
}

// ============================================================
//  2. 작명 결과(회사·제품) 자동 경고 박스 삽입
// ============================================================
function _renderTrademarkWarning(ntype){
  const isCompany = ntype === 'company';
  const isProduct = ntype === 'product';
  if(!isCompany && !isProduct) return '';
  const links = isCompany
    ? '<a href="https://www.iros.go.kr" target="_blank" rel="noopener" style="color:var(--gold);font-size:11px;margin-right:10px;text-decoration:underline">→ 대법원 인터넷등기소 (상호 검색)</a>'
    : '<a href="https://www.kipris.or.kr" target="_blank" rel="noopener" style="color:var(--gold);font-size:11px;margin-right:10px;text-decoration:underline">→ KIPRIS (한국 상표)</a>' +
      '<a href="https://tmsearch.uspto.gov" target="_blank" rel="noopener" style="color:var(--gold);font-size:11px;margin-right:10px;text-decoration:underline">→ USPTO TESS (미국)</a>' +
      '<a href="https://www.tmview.europa.eu" target="_blank" rel="noopener" style="color:var(--gold);font-size:11px;text-decoration:underline">→ EU TMview</a>';
  const noun = isCompany ? '상호' : '상표';
  return '<div style="margin:14px 0;padding:14px;background:rgba(232,90,79,.08);border:2px solid rgba(232,90,79,.3);border-radius:10px">' +
    '<div style="font-size:13px;color:#e85a4f;font-weight:700;margin-bottom:8px">⚠️ ' + noun + ' 등록 가능성 평가에 대한 중요 안내</div>' +
    '<div style="font-size:11.5px;color:var(--text1);line-height:1.85">' +
    '• 본 AI 평가는 <strong>참고용</strong>이며 <strong>법적 효력이 없습니다</strong>.<br>' +
    '• 실시간 ' + noun + ' DB 조회가 아니라 AI의 패턴 추정입니다.<br>' +
    '• 실제 ' + (isCompany ? '법인 등기·상호 등록' : '상표 등록') + ' 가능 여부는 반드시 <strong>아래 공식 검색 + ' + (isCompany ? '법무사' : '변리사') + ' 자문</strong>으로 확인하세요.<br>' +
    '• 본 AI 분석을 근거로 한 ' + (isCompany ? '등기 거절·상호 분쟁' : '등록 거절·상표 침해 분쟁') + '에 대해 천운은 책임지지 않습니다.' +
    '</div>' +
    '<div style="margin-top:10px;padding-top:10px;border-top:1px dashed rgba(232,90,79,.2)">' + links + '</div>' +
    '</div>';
}

// MutationObserver로 작명 결과 자동 감지 → 경고 박스 삽입
function _watchNamingResult(){
  const target = document.getElementById('namingResult');
  if(!target) {
    // DOM 아직 안 만들어졌으면 잠깐 후 재시도
    setTimeout(_watchNamingResult, 500);
    return;
  }
  const observer = new MutationObserver(function(){
    // 중복 삽입 방지
    if(target.querySelector('.cw-trademark-warning')) return;
    // 현재 표시된 작명 종류 추정 (window._namingResultData 또는 카드 타이틀)
    const info = window._namingResultData;
    if(!info) return;
    const ntype = info.ntype;
    if(ntype !== 'company' && ntype !== 'product') return;
    // 경고 박스 생성 + 카드 안 상단에 삽입
    const warning = document.createElement('div');
    warning.className = 'cw-trademark-warning';
    warning.innerHTML = _renderTrademarkWarning(ntype);
    // .card.pulse-card 안 가장 위에 삽입 (card-title 직후)
    const card = target.querySelector('.card.pulse-card');
    if(card){
      const title = card.querySelector('.card-title');
      if(title && title.nextSibling) card.insertBefore(warning, title.nextSibling);
      else card.insertBefore(warning, card.firstChild);
    }
  });
  observer.observe(target, {childList: true, subtree: false});
}

// ============================================================
//  자동 시작
// ============================================================
if(typeof window !== 'undefined'){
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){
      _showDisclaimerBannerIfNeeded();
      _watchNamingResult();
    });
  } else {
    _showDisclaimerBannerIfNeeded();
    _watchNamingResult();
  }
  // 전역 노출 (콘솔에서도 호출 가능)
  window.showDisclaimer = _renderDisclaimerBanner;
}
