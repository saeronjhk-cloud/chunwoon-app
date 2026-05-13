// 천운 — 운세 채팅 풀스택 (선녀·도사·점성술사 + 사주 자동 컨텍스트)
// 의존: chatHistory(전역 let), CHAT_GREET, showToast, HS, HS_CH, EB, EL, HS_EL (index.html 전역)
// override: showTyping, addBotMsg, addUserMsg, sendChat, initChat

// ============================================================
//  데이터
// ============================================================
const CHAT_PERSONAS = [
  {k:'sun',n:'선녀',e:'🔮',tone:'한국 전통 무속·도교 점술가. 따뜻하고 신비로운 해요체. 정감 있고 격려 중심. 사주를 자연스럽게 인용',greet:'안녕하세요, 저는 천운의 점술가 **선녀**입니다. 🔮\n\n당신의 운명과 미래에 대해 물어보세요. 생년월일, 고민, 궁금한 점 무엇이든 좋습니다.'},
  {k:'do',n:'도사',e:'🧙‍♂️',tone:'자평진전·적천수 통달한 동양 도교 학자. 진중하고 정밀한 해요체. 사주 8글자 본질 풀이',greet:'어서 오십시오. 저는 자평진전과 적천수를 닦은 **도사**입니다. 🧙‍♂️\n\n사주 8글자에 깃든 본질과 흐름을 풀이해 드립니다. 생년월일시를 알려주시면 더 정밀합니다.'},
  {k:'astro',n:'점성술사',e:'✨',tone:'서양 점성술·타로·별자리 통합. 시적이고 영감 가득한 해요체. 우주적 관점',greet:'반가워요, 저는 별과 카드로 길을 안내하는 **점성술사**예요. ✨\n\n당신의 별자리·생일·꿈에 대해 들려주세요. 우주의 신호를 함께 읽어드릴게요.'}
];

const CHAT_CATEGORIES = [
  {k:'love',n:'사랑·연애',kw:['연애','사랑','썸','짝사랑','고백','이성','남친','여친','남자친구','여자친구','결혼','이별','헤어','만남','데이트','커플','애인']},
  {k:'work',n:'일·커리어',kw:['직장','이직','취업','승진','회사','업무','커리어','직업','진로','퇴사','면접','상사','동료','창업','사업']},
  {k:'money',n:'재물·돈',kw:['돈','재물','재산','투자','주식','복권','월급','대출','빚','수입','자산','부동산','코인','로또']},
  {k:'health',n:'건강',kw:['건강','아프','병','다이어트','운동','수면','스트레스','피곤','체력','병원','병환','수술']},
  {k:'study',n:'학업·시험',kw:['공부','학교','시험','대학','수능','자격증','합격','입시','학업','진학']},
  {k:'family',n:'가족·관계',kw:['가족','부모','자녀','자식','형제','자매','친구','인간관계','부부','시댁','처가']},
  {k:'general',n:'전반',kw:['오늘','이번주','이번달','올해','내년','운세','전반']}
];

const CHAT_SUGGEST_MAP = {
  start: ['오늘 운세가 궁금해요','연애운이 알고 싶어요','이직해도 될까요?','올해 재물운은 어때요?','건강 조심할 게 있나요?'],
  love: ['그 사람의 마음이 궁금해요','언제쯤 좋은 인연이 올까요?','이 사람과 잘 맞을까요?'],
  work: ['이번 결정이 옳을까요?','승진할 가능성이 있을까요?','이직 시기 추천해주세요'],
  money: ['올해 큰 돈 들어올까요?','투자해도 될까요?','이번 사업 잘 될까요?'],
  health: ['요즘 체력이 떨어져요','어떤 운동이 좋을까요?','조심할 시기 있나요?'],
  study: ['이번 시험 결과가 궁금해요','어느 길로 가야 할까요?','학업 잘 풀릴까요?'],
  family: ['부모님과 갈등이 있어요','자녀의 길이 궁금해요','관계 회복할 수 있을까요?'],
  general: ['이번 달 흐름은?','조심할 일이 있나요?','행운 시기는 언제일까요?']
};

const TYPING_MESSAGES = {
  sun: ['🔮 수정구슬을 바라봅니다...','🪷 향을 사르며 묻는 중...','✨ 별의 기운을 모으는 중...','📿 점괘를 헤아리는 중...'],
  do: ['📜 사주 8글자를 읽는 중...','⚖ 천간지지를 살피는 중...','🧿 음양오행을 가늠하는 중...','卦 괘를 펼치는 중...'],
  astro: ['✨ 별의 속삭임을 듣는 중...','🌙 달의 각도를 재는 중...','⭐ 별자리를 살피는 중...','🪐 행성의 위치를 보는 중...']
};

let chatPersona = 'sun';
let chatLastCategory = 'general';

// ============================================================
//  헬퍼
// ============================================================
function _detectChatCategory(text){
  for(const cat of CHAT_CATEGORIES){
    if(cat.kw.some(k => text.includes(k))) return cat.k;
  }
  return 'general';
}

function _gatherChatContext(){
  const ctx = {};
  if(window._sajuResultData){
    const s = window._sajuResultData;
    if(s.pillars){
      try {
        ctx.ilgan = (typeof HS_CH !== 'undefined' && HS_CH) ? HS_CH[s.pillars.day.stem] : ((typeof HS !== 'undefined' && HS) ? HS[s.pillars.day.stem] : '');
        ctx.ilganElement = s.ilganElement || (s.pillars.day && (typeof EL !== 'undefined' && EL) && (typeof HS_EL !== 'undefined' && HS_EL) ? EL[HS_EL[s.pillars.day.stem]] : '');
        ctx.dayPillar = (typeof HS !== 'undefined' && typeof EB !== 'undefined' && s.pillars.day) ? (HS[s.pillars.day.stem] + EB[s.pillars.day.branch]) : '';
      } catch(e) {}
    }
    ctx.dominant = s.dominant || '';
    ctx.lacking = s.lacking || '';
  }
  if(window._faceResultData){
    const f = window._faceResultData;
    ctx.faceSummary = (f.result && f.result.summary) ? String(f.result.summary).substring(0,150) : '';
  }
  if(window._tarotResultData){
    const t = window._tarotResultData;
    if(t.cards && t.cards.length){
      const cardNames = t.cards.map(c => c.n + (c.reversed?'(역)':'')).join(', ');
      const summary = (t.result && t.result.summary) ? String(t.result.summary).substring(0,80) : '';
      ctx.tarotSummary = cardNames + (summary ? ' — ' + summary : '');
    }
  }
  if(window._dreamResultData){
    ctx.dreamSummary = (window._dreamResultData.result && window._dreamResultData.result.summary) ? String(window._dreamResultData.result.summary).substring(0,150) : '';
  }
  if(window._compatResultData){
    ctx.compatSummary = (window._compatResultData.result && window._compatResultData.result.summary) ? String(window._compatResultData.result.summary).substring(0,150) : '';
  }
  if(window._tojeongResultData){
    ctx.tojeongSummary = (window._tojeongResultData.result && window._tojeongResultData.result.summary) ? String(window._tojeongResultData.result.summary).substring(0,150) : '';
  }
  return ctx;
}

function _scrollChatToBottom(){
  const c = document.getElementById('chatMessages');
  if(!c) return;
  c.scrollTop = c.scrollHeight;
  requestAnimationFrame(()=>{c.scrollTop = c.scrollHeight});
  setTimeout(()=>{c.scrollTop = c.scrollHeight}, 120);
}
function _scrollToMsgTop(el){
  const c = document.getElementById('chatMessages');
  if(!c || !el) return;
  const align = () => { const offset = el.offsetTop - c.offsetTop - 8; c.scrollTop = Math.max(0, offset); };
  align();
  requestAnimationFrame(align);
  setTimeout(align, 120);
}
function _autoResizeChatInput(){
  const t = document.getElementById('chatInput');
  if(!t) return;
  t.style.height = 'auto';
  t.style.height = Math.min(140, Math.max(24, t.scrollHeight)) + 'px';
}

// ============================================================
//  메시지 추가 / 타이핑 (기존 함수 override)
// ============================================================
function showTyping(){
  const c = document.getElementById('chatMessages');
  if(!c) return;
  const persona = chatPersona || 'sun';
  const avatar = persona==='do'?'🧙‍♂️':persona==='astro'?'✨':'🔮';
  const msgs = TYPING_MESSAGES[persona] || TYPING_MESSAGES.sun;
  const msg = msgs[Math.floor(Math.random()*msgs.length)];
  const d = document.createElement('div');
  d.className = 'chat-msg bot'; d.id = 'typing';
  d.innerHTML = `<div class="chat-avatar">${avatar}</div><div class="chat-bubble"><span style="font-size:12.5px;color:var(--gold);font-style:italic">${msg}</span> <span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></div>`;
  c.appendChild(d);
  _scrollChatToBottom();
}

function addBotMsg(text){
  const c = document.getElementById('chatMessages');
  if(!c) return;
  const persona = chatPersona || 'sun';
  const avatar = persona==='do'?'🧙‍♂️':persona==='astro'?'✨':'🔮';
  const d = document.createElement('div');
  d.className = 'chat-msg bot';
  d.innerHTML = `<div class="chat-avatar">${avatar}</div><div class="chat-bubble">${text.replace(/\n/g,'<br>').replace(/\*\*(.*?)\*\*/g,'<strong style="color:var(--gold)">$1</strong>')}</div>`;
  c.appendChild(d);
  _scrollToMsgTop(d);
}

function addUserMsg(text){
  const c = document.getElementById('chatMessages');
  if(!c) return;
  const d = document.createElement('div');
  d.className = 'chat-msg user';
  d.innerHTML = `<div class="chat-avatar">👤</div><div class="chat-bubble">${text}</div>`;
  c.appendChild(d);
  _scrollChatToBottom();
}

// ============================================================
//  sendChat (LLM 실시간 호출)
// ============================================================
async function sendChat(){
  const input = document.getElementById('chatInput');
  if(!input) return;
  const text = input.value.trim();
  if(!text) return;
  input.value = '';
  input.style.height = 'auto';
  addUserMsg(text);
  const sg = document.getElementById('chatSuggest');
  if(sg) sg.innerHTML = '';
  showTyping();

  const category = _detectChatCategory(text);
  chatLastCategory = category;
  const persona = CHAT_PERSONAS.find(p => p.k === chatPersona) || CHAT_PERSONAS[0];
  const ctxData = _gatherChatContext();
  const ctx = Object.assign({}, ctxData, {
    personaName: persona.n,
    personaTone: persona.tone,
    category: (CHAT_CATEGORIES.find(c => c.k === category) || {n:'전반'}).n,
    question: text,
    history: chatHistory.slice(-10).map(h => ({role: h.role==='bot'?'assistant':'user', text: h.text}))
  });

  try {
    const resp = await fetch('/api/fortune', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'chat',context:ctx})});
    const data = await resp.json();
    if(!data.success || !data.result) throw new Error(data.error || 'API 응답 오류');
    let answer = data.result.text || data.result.raw || '응답을 가져오지 못했어요. 잠시 후 다시 시도해주세요.';
    const wantTarot = answer.includes('★TAROT_DRAW★');
    answer = answer.replace(/★TAROT_DRAW★/g, '').trim();
    const tEl = document.getElementById('typing'); if(tEl) tEl.remove();
    addBotMsg(answer);
    chatHistory.push({role:'user', text});
    chatHistory.push({role:'bot', text:answer});
    if(chatHistory.length > 20) chatHistory.splice(0, chatHistory.length - 20);
    if(wantTarot) setTimeout(() => _chatDrawTarot(), 600);
    if(sg){
      const suggests = CHAT_SUGGEST_MAP[category] || CHAT_SUGGEST_MAP.general;
      suggests.forEach(s => {
        const ch = document.createElement('span');
        ch.className = 'chat-chip'; ch.textContent = s;
        ch.onclick = () => { input.value = s; sendChat(); };
        sg.appendChild(ch);
      });
    }
  } catch(err) {
    console.error('Chat error:', err);
    const tEl = document.getElementById('typing'); if(tEl) tEl.remove();
    addBotMsg(`죄송해요, 잠시 연결이 어려워요. 다시 한 번 말씀해 주실래요? (${(err.message||'').substring(0,80)})`);
  }
}

// 채팅 도중 타로 1장 인라인 뽑기
function _chatDrawTarot(){
  if(typeof TAROT_MAJOR === 'undefined' || !TAROT_MAJOR) return;
  const c = TAROT_MAJOR[Math.floor(Math.random() * TAROT_MAJOR.length)];
  const reversed = Math.random() < 0.45;
  const meaning = reversed ? c.rev : c.up;
  const msg = `🎴 **${c.e} ${c.n}** ${reversed ? '(역방향)' : '(정방향)'}\n\n키워드: ${meaning}\n\n이 카드의 메시지를 마음에 새겨두세요.`;
  addBotMsg(msg);
  chatHistory.push({role:'bot', text:`타로 카드: ${c.n}${reversed?'(역)':''} — ${meaning}`});
}

// ============================================================
//  페르소나 전환 + initChat override
// ============================================================
function changeChatPersona(){
  const sel = document.getElementById('chatPersonaSelect');
  if(!sel) return;
  chatPersona = sel.value;
  const persona = CHAT_PERSONAS.find(p => p.k === chatPersona) || CHAT_PERSONAS[0];
  const title = document.getElementById('chatTitle');
  if(title) title.textContent = `${persona.e} ${persona.n}와의 대화`;
  const msgs = document.getElementById('chatMessages');
  if(msgs) msgs.innerHTML = '';
  chatHistory.length = 0;
  addBotMsg(persona.greet);
  _showStartSuggests();
}

function _showStartSuggests(){
  const sg = document.getElementById('chatSuggest');
  const input = document.getElementById('chatInput');
  if(!sg) return;
  sg.innerHTML = '';
  (CHAT_SUGGEST_MAP.start || []).forEach(s => {
    const ch = document.createElement('span');
    ch.className = 'chat-chip'; ch.textContent = s;
    ch.onclick = () => { if(input){ input.value = s; sendChat(); } };
    sg.appendChild(ch);
  });
}

function initChat(){
  const persona = CHAT_PERSONAS.find(p => p.k === chatPersona) || CHAT_PERSONAS[0];
  addBotMsg(persona.greet);
  _showStartSuggests();
}
