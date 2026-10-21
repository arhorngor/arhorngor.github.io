/* Shared, side-effect-free scoring and legacy reader. Original records are never mutated. */
(function (root) {
  'use strict';
  const clone = x => JSON.parse(JSON.stringify(x));
  const uid = () => root.crypto?.randomUUID?.() || `r-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const penalty = x => x?.penalty === 'OB 前方補球' ? 2 : (x?.penalty || x?.club === '罰' ? 1 : 0);
  const strokes = shots => shots.reduce((n, x) => n + (penalty(x) || 1), 0);
  const validPar = p => Number.isInteger(p) && p >= 3 && p <= 6;
  const scoringMode = r => r?.scoringMode === 'bogey' ? 'bogey' : 'standard';
  const scoringPar = (officialPar, mode) => validPar(officialPar) ? officialPar + (mode === 'bogey' ? 1 : 0) : null;
  const completed = s => s.status === 'completed' || s.status === 'legacy_completed';
  const longClub = c => /^(?:\d+W|\d+H|\d+U|[1-6]I)$/.test(c);
  const wedge = c => /^(?:[PAGSL]W?|\d+°)$/i.test(String(c).trim());
  function order(r) {
    if (Array.isArray(r.playOrder) && r.playOrder.length === 18) return [...r.playOrder];
    const count = r.courseHoles || 18, start = r.startHole || 1;
    if (count > 18) {
      const section = Math.floor((start - 1) / 9), n = Math.ceil(count / 9);
      return (r.playSections || [section, (section + 1) % n]).slice(0, 2).flatMap(s => Array.from({length: 9}, (_, i) => s * 9 + i + 1));
    }
    return Array.from({length: 18}, (_, i) => (start - 1 + i) % count + 1);
  }
  function slot(hole, index, r) {
    return {id: `slot-${index + 1}`, courseHoleId: hole, par: validPar(r.pars?.[hole - 1]) ? r.pars[hole - 1] : null, shots: [], status: 'not_started'};
  }
  function create(meta) {
    const r = {...clone(meta), scoringMode:scoringMode(meta), id: uid(), schemaVersion: 2, createdAt: new Date().toISOString(), status: 'in_progress'};
    r.roundSlots = order(r).map((h, i) => slot(h, i, r));
    r.currentSlotId = r.roundSlots[0].id;
    r.unassignedHoles = [];
    delete r.holes;
    return r;
  }
  function normalize(raw) {
    if (raw.schemaVersion === 2) return clone(raw);
    const r = {...clone(raw), schemaVersion: 2, legacy: true, legacyWarnings: [], unassignedHoles: []};
    const used = new Set(), hs = raw.holes || {};
    r.roundSlots = order(raw).map((n, i) => {
      const s = slot(n, i, raw), h = hs[n];
      if (used.has(n)) {
        r.legacyWarnings.push(`球場第${n}洞重複出現；舊格式只有一份紀錄，未複製成兩份成績。`);
        return s;
      }
      used.add(n);
      if (h) {
        s.shots = clone(h.shots || []);
        s.par = validPar(h.par) ? h.par : s.par;
        s.status = s.shots.length ? (raw.status === 'finished' ? 'legacy_completed' : 'unconfirmed') : 'not_started';
      }
      return s;
    });
    for (const [hole, h] of Object.entries(hs)) if (!used.has(Number(hole)) && h.shots?.length) r.unassignedHoles.push({courseHoleId: Number(hole), ...clone(h)});
    if (r.unassignedHoles.length) r.legacyWarnings.push(`${r.unassignedHoles.length}洞未能確定記分位置，原紀錄保留於待確認區，未併入18洞成績。`);
    if (raw.status === 'finished') r.legacyWarnings.push('舊格式沒有逐洞完成標記；有紀錄的洞依當時「完成本局」狀態計算。');
    else if (r.roundSlots.some(s => s.shots.length)) r.legacyWarnings.push('舊局已有桿數的洞須確認完成，才納入完成洞統計。');
    r.currentSlotId = r.roundSlots.find(s => s.courseHoleId === (raw.currentHole || raw.startHole || 1))?.id || r.roundSlots[0].id;
    delete r.holes;
    return r;
  }
  function validateRound(r) {
    if (!r || typeof r !== 'object' || Array.isArray(r) || typeof r.course !== 'string') throw Error('球局格式不正確');
    if (r.schemaVersion != null && r.schemaVersion !== 1 && r.schemaVersion !== 2) throw Error('不支援的球局版本');
    if (r.scoringMode != null && !['standard','bogey'].includes(r.scoringMode)) throw Error('不支援的計分模式');
    if (!Number.isInteger(r.courseHoles) || r.courseHoles < 18 || r.courseHoles > 72) throw Error('球場洞數不正確');
    const checkShots = shots => {
      if (!Array.isArray(shots) || shots.length > 1000) throw Error('逐桿資料不正確');
      for (const x of shots) if (!x || typeof x.club !== 'string' || (x.penalty != null && typeof x.penalty !== 'string') || (x.putt != null && typeof x.putt !== 'string')) throw Error('逐桿事件格式不正確');
    };
    if (r.schemaVersion === 2) {
      if (!Array.isArray(r.roundSlots) || r.roundSlots.length !== 18) throw Error('必須保留18個記分位置');
      const ids = new Set();
      r.roundSlots.forEach(s => {
        if (!s || typeof s.id !== 'string' || !s.id || ids.has(s.id)) throw Error('記分位置ID重複或無效');
        ids.add(s.id);
        if (!Number.isInteger(s.courseHoleId) || s.courseHoleId < 1 || s.courseHoleId > r.courseHoles) throw Error('球場洞號無效');
        if (!['not_started','in_progress','completed','legacy_completed','unconfirmed'].includes(s.status)) throw Error('完成狀態無效');
        if (s.par != null && !validPar(s.par)) throw Error('Par格式不正確');
        checkShots(s.shots);
        if (completed(s) && !s.shots.length) throw Error('空白洞不能標記完成');
      });
      if (!ids.has(r.currentSlotId)) throw Error('目前記分位置不存在');
      if (r.unassignedHoles != null && !Array.isArray(r.unassignedHoles)) throw Error('待確認紀錄格式不正確');
      (r.unassignedHoles || []).forEach(h => checkShots(h.shots));
    } else {
      if (!r.holes || typeof r.holes !== 'object' || Array.isArray(r.holes)) throw Error('舊球局缺少逐洞紀錄');
      for (const [n,h] of Object.entries(r.holes)) {
        if (!Number.isInteger(+n) || +n < 1 || +n > r.courseHoles || !h) throw Error('舊球局洞號無效');
        checkShots(h.shots || []);
      }
      if (r.playOrder != null && (!Array.isArray(r.playOrder) || r.playOrder.length !== 18 || r.playOrder.some(n => !Number.isInteger(n) || n < 1 || n > r.courseHoles))) throw Error('舊球局順序無效');
    }
    return true;
  }
  function stats(raw, mode = scoringMode(raw)) {
    const r = normalize(raw), slots = r.roundSlots;
    const tally = list => {
      let score = 0, putts = 0, penalties = 0, shortShots = 0, recorded = 0, done = 0, par = 0, relativeScore = 0, relativeN = 0, gir = 0, girN = 0;
      for (const s of list) {
        if (s.shots.length) recorded++;
        score += strokes(s.shots);
        putts += s.shots.filter(x => x.club === 'PT').length;
        penalties += s.shots.reduce((n,x) => n + penalty(x), 0);
        shortShots += s.shots.filter(x => wedge(x.club)).length;
        if (!completed(s)) continue;
        done++;
        if (!validPar(s.par)) continue;
        const targetPar=scoringPar(s.par,mode);
        relativeN++; par += targetPar; relativeScore += strokes(s.shots);
        const firstPT = s.shots.findIndex(x => x.club === 'PT');
        if (firstPT >= 0) { girN++; if (strokes(s.shots.slice(0, firstPT)) <= targetPar - 2) gir++; }
      }
      const knownPars=list.map(s=>scoringPar(s.par,mode)).filter(p=>p!==null);
      return {score, putts, penalties, shortShots, recorded, done, relativeN, relative: relativeN ? relativeScore - par : null, gir, girN, targetPar:knownPars.length===list.length?knownPars.reduce((a,b)=>a+b,0):null, knownParCount:knownPars.length};
    };
    return {...tally(slots), halves: [tally(slots.slice(0,9)), tally(slots.slice(9))], slots};
  }
  function replaceHole(r, slotId, courseHoleId) {
    const next = clone(r), s = next.roundSlots.find(x => x.id === slotId);
    if (!s || s.shots.length || s.status !== 'not_started') throw Error('只能更換尚未開始的位置');
    if (!Number.isInteger(courseHoleId) || courseHoleId < 1 || courseHoleId > r.courseHoles) throw Error('洞號不正確');
    s.courseHoleId = courseHoleId;
    s.par = validPar(r.pars?.[courseHoleId - 1]) ? r.pars[courseHoleId - 1] : null;
    return next;
  }
  function holeLabel(r, n) {
    return r.courseHoles > 18 || r.sections?.length === 2 ? `${r.sections?.[Math.floor((n - 1) / 9)] || '區' + (Math.floor((n - 1) / 9) + 1)} 第${(n - 1) % 9 + 1}洞` : `第${n}洞`;
  }
  function replaceSection(r, firstSlotId, section) {
    const index=r.roundSlots.findIndex(s=>s.id===firstSlotId);
    if(index<0||index+9>18||!Number.isInteger(section)||section<0||(section+1)*9>r.courseHoles)throw Error('這個位置無法排入完整九洞');
    let next=clone(r);
    for(let i=0;i<9;i++)next=replaceHole(next,next.roundSlots[index+i].id,section*9+i+1);
    return next;
  }
  const api = {clone, uid, penalty, strokes, validPar, scoringMode, scoringPar, completed, longClub, wedge, order, create, normalize, validateRound, stats, replaceHole, replaceSection, holeLabel};
  root.RoundCore = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);
