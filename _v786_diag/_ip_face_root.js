/* ★v788 P-786-H — 관상 IP 정본(IP_face) 위치 해석기. 8개 스크립트가 전부 이 한 곳을 쓴다.
   우선순위:
     ① CHUNWOON_IP_FACE 환경변수
     ② <리포>/../ChunWoon_IP/face  = D:\ChunWoon_IP\face  (★정본 · 플레이북 ③ IP 분리 · git 밖)
     ③ <리포>/_v786_diag/IP_face   (v786~v787 구 위치 · 이관 후엔 없다)
   판정 기준: doctrines.json 이 있는 첫 후보. 없으면 예외(조용히 빈 규칙으로 돌지 않는다 · fail-closed). */
'use strict';
const fs = require('fs');
const path = require('path');
module.exports = function ipFaceRoot() {
  const cands = [
    process.env.CHUNWOON_IP_FACE,
    path.join(__dirname, '..', '..', 'ChunWoon_IP', 'face'),
    path.join(__dirname, 'IP_face'),
  ].filter(Boolean);
  for (const c of cands) if (fs.existsSync(path.join(c, 'doctrines.json'))) return path.resolve(c);
  throw new Error('[ip_face_root] 관상 IP 정본을 찾지 못했다 — D:\\ChunWoon_IP\\face 마운트 또는 CHUNWOON_IP_FACE 지정 필요. 후보: ' + cands.join(' | '));
};
