# v788 P-786-B — index.html 결속 패치 (멱등 · 앵커 4곳 · 하나라도 못 찾으면 아무것도 쓰지 않는다)
import io, sys, re
P = 'index.html'
s = io.open(P, encoding='utf-8').read()
orig = s

def once(anchor, insert_after=True, new=None, must=1):
    global s
    n = s.count(anchor)
    if n != must:
        print('ANCHOR x%d (need %d): %r' % (n, must, anchor[:60])); sys.exit(2)
    s = s.replace(anchor, (anchor + new) if insert_after else (new + anchor))

if 'js/dream_engine.js' in s:
    print('already patched'); sys.exit(0)

# ① 스크립트 적재 — tarot.js 앞 (센서 3종과 같은 자리 · index.html 함수보다 먼저 정의돼야 한다)
once('<script src="js/sensor_flatten.js"></script>\n', True,
     '<script src="js/dream_engine.js"></script>\n')

# ② analyzeDream — 엔진 히트 산출 (emoName 줄 뒤)
once("  const emoName=DREAM_EMOTIONS.find(e=>e.k===emo)?.n||'';\n", True,
"""
  // ★v788 P-786-B — 꿈 모티브 엔진(js/dream_engine.js). DREAM_KEYS 12항목을 줄거리에 대조한다.
  //   엔진이 잡은 것은 LLM 성패와 **무관하게** 화면에 실린다(플레이북 ⑤ · 엔진 우선 · AI 는 보강/폴백).
  //   히트 0 이면 빈 배열 — 지어내지 않는다. 정답률은 _v788_work/p11_dream_engine_eval.js 가 못박는다.
  //   ★서버로 보내지 않는다 — ctx 키를 늘리면 eval_ctx_key_surface K-2·eval_dream_daily_guard C-2 가 붉어진다.
  const engineHits=(window.CW_DREAM_ENGINE&&typeof window.CW_DREAM_ENGINE.matchDreamKeys==='function')?window.CW_DREAM_ENGINE.matchDreamKeys(story,DREAM_KEYS):[];
""")

# ③ info 객체에 engineHits 운반 (프리미엄·저장 경로가 같은 값을 쓴다)
old = "const info={time,timeName,cats,catNames,emo,emoName,story,sajuLinked,ilgan,ilganElement,dayPillar,dominantElement,weakElement,birthKeys:_bkDr,pillarKeys:_pkDr};"
if s.count(old) != 1: print('ANCHOR info'); sys.exit(2)
s = s.replace(old, "const info={time,timeName,cats,catNames,emo,emoName,story,sajuLinked,ilgan,ilganElement,dayPillar,dominantElement,weakElement,birthKeys:_bkDr,pillarKeys:_pkDr,engineHits};")

# ④ renderDreamResult — 핵심 상징 블록 뒤에 엔진 블록
once("""    <!-- 감정 상태 -->
    ${result.emotionalState?""", False,
"""    <!-- ★v788 엔진 풀이 (DREAM_KEYS · LLM 과 독립) -->
    ${_cwDreamEngineBlock(info.engineHits,false)}

""")

# ⑤ renderDreamFallback — 오류 박스 앞에 엔진 블록(있으면 주 풀이가 된다)
once("""    <div style="padding:12px;background:rgba(232,90,79,.06);border:1px solid rgba(232,90,79,.2);border-radius:8px;font-size:11px;color:var(--text2);text-align:center">⚠️ AI 풀이를 불러오지 못했습니다.""", False,
"""    ${_cwDreamEngineBlock(info.engineHits,true)}
""")

# ⑥ 블록 렌더러 — renderDreamFallback 정의 앞에 둔다
once("function renderDreamFallback(info,errMsg){", False,
"""/** ★v788 P-786-B — 엔진 히트 블록. hits 가 비면 '' (아무것도 그리지 않는다).
 *  primary=true(LLM 실패 폴백)면 「AI 없이 전통 해몽 사전으로 풀이했다」고 밝힌다.
 *  msg·num 은 DREAM_KEYS 의 값 그대로 — 여기서 문구를 만들지 않는다. */
function _cwDreamEngineBlock(hits,primary){
  if(!Array.isArray(hits)||!hits.length)return '';
  const E=window.CW_DREAM_ENGINE;
  const sum=(E&&E.summarize)?E.summarize(hits):{fortuneType:null,numbers:[]};
  const fcolor=sum.fortuneType==='길몽'?'#1a7a4a':sum.fortuneType==='흉몽'?'#c9443a':'#8b6914';
  const rows=hits.map(h=>`<div style="padding:10px 12px;margin-bottom:8px;background:rgba(201,165,78,.04);border-radius:8px;border-left:3px solid ${h.good===true?'#1a7a4a':h.good===false?'#c9443a':'var(--gold)'}">
      <div style="font-size:13px;font-weight:600;color:var(--gold);margin-bottom:4px">${h.e||''} ${h.k}${h.good===true?' <span style="font-size:10px;color:#1a7a4a">길</span>':h.good===false?' <span style="font-size:10px;color:#c9443a">흉</span>':''}</div>
      <div style="font-size:12px;color:var(--text1);line-height:1.7">${h.msg||''}</div>
    </div>`).join('');
  return `<div style="margin-bottom:14px">
      <div style="font-size:13px;color:var(--gold);font-family:'Noto Serif KR',serif;font-weight:600;margin-bottom:8px">📖 전통 해몽 사전 풀이${primary?' <span style="font-size:10px;color:var(--text2);font-weight:400">(AI 없이 사전 대조)</span>':''}${sum.fortuneType?` <span style="display:inline-block;padding:1px 8px;border-radius:10px;border:1px solid ${fcolor};color:${fcolor};font-size:10px;font-weight:700;margin-left:4px">${sum.fortuneType}</span>`:''}</div>
      ${rows}
      ${sum.numbers&&sum.numbers.length?`<div style="display:flex;justify-content:center;gap:8px;margin-top:6px;flex-wrap:wrap">${sum.numbers.map(n=>`<span style="display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;border:1px solid var(--gold);color:var(--gold);font-size:12px;font-weight:600">${n}</span>`).join('')}</div>`:''}
      <div style="font-size:10px;color:var(--text2);margin-top:6px;text-align:center">줄거리에서 찾은 모티브를 전통 해몽 사전에 대조한 결과입니다.</div>
    </div>`;
}

""")

if s == orig: print('no change'); sys.exit(2)
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('patched bytes', len(orig), '->', len(s))
