import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import PptxGenJS from 'pptxgenjs';
import QRCode from 'qrcode';

const root = path.dirname(fileURLToPath(import.meta.url));
const output = path.join(root, 'kongsem-kongsem-math-ai-tutor.pptx');
const appUrl = 'https://ndarmulf8g4z6s2q.jitda.io/';
const qrData = await QRCode.toDataURL(appUrl, { errorCorrectionLevel: 'H', margin: 1, width: 280, color: { dark: '#173B5B', light: '#FFFFFF' } });
const pptx = new PptxGenJS();
pptx.layout = 'LAYOUT_WIDE';
pptx.author = '초등 수학교사 · AI융합교육 실천';
pptx.subject = '초등 수학 AI 튜터 웹앱 개발과 교육적 활용';
pptx.title = '콩셈콩셈 | 초등 수학 AI 튜터';
pptx.company = '2026 한국형-AI 기반 교사개발자 연수 예선';
pptx.lang = 'ko-KR';
pptx.theme = {
  headFontFace: 'Malgun Gothic',
  bodyFontFace: 'Malgun Gothic',
  lang: 'ko-KR',
};
pptx.defineSlideMaster({
  title: 'MASTER',
  background: { color: 'F6FAF8' },
  objects: [
    { line: { x: 0.58, y: 7.08, w: 12.17, h: 0, line: { color: 'D9E7E2', width: 1 } } },
    { text: { text: '콩셈콩셈  ·  초등 수학 AI 튜터', options: { x: 0.6, y: 7.16, w: 5.5, h: 0.18, fontFace: 'Malgun Gothic', fontSize: 8, color: '617782', margin: 0 } } },
  ],
  slideNumber: { x: 12.28, y: 7.13, color: '617782', fontFace: 'Malgun Gothic', fontSize: 9, margin: 0 },
});

const C = {
  navy: '173B5B',
  blue: '3478A8',
  sky: 'EAF3F8',
  mint: 'DFF2E8',
  mintDeep: '3E8B68',
  green: '43835B',
  coral: 'E88969',
  adzuki: 'A94852',
  cream: 'F6FAF8',
  white: 'FFFFFF',
  ink: '233A4C',
  muted: '526877',
  line: 'D7E4E0',
  paleBlue: 'F0F6F9',
  paleMint: 'EFF8F2',
  paleRose: 'FBF0EE',
  gold: 'E8B858',
};
const FONT = 'Malgun Gothic';
const ST = pptx.ShapeType;

function text(slide, value, x, y, w, h, opts = {}) {
  slide.addText(value, {
    x, y, w, h, margin: 0,
    fontFace: FONT,
    fontSize: 16,
    color: C.ink,
    breakLine: false,
    fit: 'shrink',
    valign: 'mid',
    ...opts,
  });
}

function box(slide, x, y, w, h, fill, line = fill, radius = true) {
  slide.addShape(radius ? ST.roundRect : ST.rect, {
    x, y, w, h,
    rectRadius: 0.12,
    fill: { color: fill },
    line: { color: line, width: 1 },
  });
}

function circle(slide, x, y, d, fill, line = fill) {
  slide.addShape(ST.ellipse, { x, y, w: d, h: d, fill: { color: fill }, line: { color: line, width: 1 } });
}

function beanPair(slide, x, y, scale = 1) {
  slide.addShape(ST.ellipse, { x, y, w: 0.18 * scale, h: 0.28 * scale, rotate: 324, fill: { color: C.green }, line: { color: C.white, width: 1 } });
  slide.addShape(ST.ellipse, { x: x + 0.16 * scale, y: y + 0.13 * scale, w: 0.15 * scale, h: 0.23 * scale, rotate: 32, fill: { color: C.adzuki }, line: { color: C.white, width: 1 } });
}

function header(slide, eyebrow, title, subtitle, number) {
  text(slide, eyebrow.toUpperCase(), 0.62, 0.34, 8.4, 0.28, { fontSize: 10, bold: true, color: C.mintDeep, charSpacing: 1.2 });
  text(slide, title, 0.62, 0.73, 12.05, 0.68, { fontSize: 28, bold: true, color: C.navy });
  if (subtitle) text(slide, subtitle, 0.64, 1.43, 11.9, 0.4, { fontSize: 15, color: C.muted });
  circle(slide, 12.27, 0.35, 0.4, C.navy);
  text(slide, String(number).padStart(2, '0'), 12.27, 0.35, 0.4, 0.4, { fontSize: 10, bold: true, color: C.white, align: 'center' });
}

function label(slide, value, x, y, w, fill, color = C.navy) {
  box(slide, x, y, w, 0.34, fill, fill, true);
  text(slide, value, x + 0.09, y + 0.02, w - 0.18, 0.28, { fontSize: 10, bold: true, color, align: 'center' });
}

function addContainedPng(slide, filename, x, y, w, h) {
  const imagePath = path.join(root, filename);
  const png = fs.readFileSync(imagePath);
  const imageW = png.readUInt32BE(16);
  const imageH = png.readUInt32BE(20);
  const scale = Math.min(w / imageW, h / imageH);
  const drawW = imageW * scale;
  const drawH = imageH * scale;
  slide.addImage({ path: imagePath, x: x + (w - drawW) / 2, y: y + (h - drawH) / 2, w: drawW, h: drawH });
}

function card(slide, x, y, w, h, fill = C.white, border = C.line) {
  box(slide, x, y, w, h, fill, border, true);
}

// Slide 1: classroom need and observed problem.
{
  const slide = pptx.addSlide('MASTER');
  text(slide, '초등학교 현직 교사의 AI융합교육 실천', 0.65, 0.38, 5.7, 0.32, { fontSize: 13, bold: true, color: C.mintDeep });
  label(slide, '4학년 2학기 수학', 9.92, 0.38, 2.72, C.sky, C.blue);
  text(slide, '콩셈콩셈', 0.65, 1.0, 6.55, 0.9, { fontSize: 52, bold: true, color: C.navy });
  text(slide, '초등학생 맞춤형 AI 수학 튜터', 0.68, 2.0, 6.35, 0.52, { fontSize: 23, bold: true, color: C.blue });
  text(slide, '학생의 생각을 키우고, 교사의 개별화 지도를 돕는 학습 환경', 0.68, 2.68, 6.25, 0.62, { fontSize: 17, color: C.muted, valign: 'top', breakLine: false });

  card(slide, 7.55, 0.96, 5.15, 2.82, C.white, C.line);
  label(slide, '실제 웹앱 · 로그인 화면', 7.8, 1.12, 2.45, C.mint, C.mintDeep);
  addContainedPng(slide, 'ppt-role-entry-main.png', 7.72, 1.55, 4.8, 2.08);

  const items = [
    ['01', '선수학습 수준', '같은 설명이 모두에게 맞지 않음', C.sky, C.blue],
    ['02', '풀이 속도', '빠른 학생과 막힌 학생이 함께 있음', C.paleMint, C.mintDeep],
    ['03', '즉각적 피드백', '교사 한 명이 모든 과정을 보기 어려움', C.paleRose, C.adzuki],
    ['04', '과정 데이터', '정오답만으로는 막힌 이유가 보이지 않음', 'F3F2EB', '8C7442'],
  ];
  const cardY = 4.08;
  const cardW = 2.96;
  items.forEach(([number, title, body, fill, accent], index) => {
    const x = 0.62 + index * 3.04;
    card(slide, x, cardY, cardW, 1.48, fill, fill);
    text(slide, number, x + 0.19, cardY + 0.16, 0.48, 0.28, { fontSize: 13, bold: true, color: accent });
    text(slide, title, x + 0.19, cardY + 0.49, cardW - 0.38, 0.36, { fontSize: 17, bold: true, color: C.navy });
    text(slide, body, x + 0.19, cardY + 0.91, cardW - 0.38, 0.4, { fontSize: 11, color: C.muted, valign: 'top' });
  });
  box(slide, 0.62, 5.92, 10.82, 0.74, C.navy, C.navy);
  text(slide, '웹앱 바로가기', 0.9, 6.08, 1.82, 0.32, { fontSize: 14, bold: true, color: 'BFE6D0' });
  slide.addText(appUrl, { x: 2.72, y: 6.04, w: 8.42, h: 0.42, margin: 0, fontFace: FONT, fontSize: 15, bold: true, color: C.white, underline: { color: C.white }, hyperlink: { url: appUrl }, fit: 'shrink', valign: 'mid' });
  box(slide, 11.7, 5.6, 1.0, 1.06, C.white, C.line);
  slide.addImage({ data: qrData, x: 11.78, y: 5.68, w: 0.84, h: 0.84 });
  text(slide, 'QR', 11.77, 6.67, 0.84, 0.17, { fontSize: 8, bold: true, color: C.muted, align: 'center' });

  slide.addNotes('콩셈콩셈은 초등학교 현직 교사의 수업 경험에서 출발한 AI 수학 튜터입니다. 학생마다 선수학습과 문제를 푸는 속도가 달라 한 가지 설명만으로는 모두를 돕기 어려웠습니다. 여러 학생의 풀이를 동시에 살피다 보면 피드백도 늦어지고, 정오답만으로는 어디서 막혔는지 알기 어렵습니다. 그래서 학생의 생각 과정에 더 가까이 다가갈 수 있는 학습 환경을 기획했습니다.');
}

// Slide 2: pedagogical design and implemented scope.
{
  const slide = pptx.addSlide('MASTER');
  header(slide, '개발 목표와 학습 환경', '정답 대신, 다음 한 걸음을 돕는 AI', '교사가 학습 문제를 정의하고 생성형 AI로 화면을 구현해 반복 점검했습니다.', 2);

  card(slide, 0.62, 1.95, 4.25, 4.95, C.white, C.line);
  text(slide, '학생의 학습 흐름', 0.92, 2.2, 3.6, 0.4, { fontSize: 20, bold: true, color: C.navy });
  const flow = [
    ['질문', '계산식이나 막힌 자리'],
    ['힌트', '정답 전에 한 단계 도움'],
    ['직접 해보기', '10칸 모형·스마트 공책'],
    ['다시 확인', '답과 풀이를 돌아보기'],
  ];
  flow.forEach(([title, desc], i) => {
    const y = 2.92 + i * 0.76;
    circle(slide, 0.96, y + 0.04, 0.28, i === 2 ? C.mintDeep : C.blue);
    text(slide, String(i + 1), 0.96, y + 0.04, 0.28, 0.28, { fontSize: 9, bold: true, color: C.white, align: 'center' });
    text(slide, title, 1.42, y, 2.95, 0.28, { fontSize: 16, bold: true, color: C.navy });
    text(slide, desc, 1.42, y + 0.31, 2.95, 0.3, { fontSize: 12, color: C.muted });
    if (i < flow.length - 1) slide.addShape(ST.line, { x: 1.1, y: y + 0.34, w: 0, h: 0.48, line: { color: '9EB7C2', width: 2, beginArrowType: 'none', endArrowType: 'none' } });
  });
  text(slide, '현재 구현', 0.95, 6.16, 1.25, 0.3, { fontSize: 12, bold: true, color: C.mintDeep });
  text(slide, '설명 · 힌트 · 필기 · 도전', 2.1, 6.16, 2.45, 0.3, { fontSize: 12, bold: true, color: C.ink });

  card(slide, 5.05, 1.95, 7.65, 4.95, C.white, C.line);
  addContainedPng(slide, 'ppt-student-home-final.png', 5.18, 2.08, 7.39, 4.35);
  text(slide, '학생 첫 화면 · 큰 답 버튼으로 바로 시작', 5.42, 6.52, 6.9, 0.25, { fontSize: 13, bold: true, color: C.navy, align: 'center' });

  slide.addNotes('이 웹앱은 AI가 답을 대신 말하는 구조가 아니라 학생이 다음에 무엇을 생각하면 좋을지 돕도록 설계했습니다. 학생은 설명, 힌트, 답 확인 중 도움을 고르고, 10칸 모형이나 스마트 공책으로 직접 계산합니다. 이 범위와 말투, 힌트 원칙은 교사가 정했고, 생성형 AI를 활용해 실제 화면을 구현한 뒤 수업 맥락에 맞게 계속 점검했습니다.');
}

// Slide 3: actual student-facing screens captured from the running web app.
{
  const slide = pptx.addSlide('MASTER');
  header(slide, '실제 구현 화면', '한 문제를 조작하고, 쓰고, 다시 도전', '4학년 2학기 3단원 · 소수의 덧셈과 뺄셈', 3);

  const cards = [
    { x: 0.62, file: 'ppt-current-mission.png', title: '10칸으로 받아올림을 눈으로', desc: '0.8 + 0.5 → 0.1을 다섯 번 더해 1.3으로 묶기' },
    { x: 6.83, file: 'ppt-smart-notebook-panel.png', title: '필요할 때 펼치는 공책', desc: '스마트펜·손가락 필기 · 문제 적기 · 되돌리기' },
  ];
  cards.forEach((item) => {
    card(slide, item.x, 1.72, 5.88, 4.98, C.white, C.line);
    addContainedPng(slide, item.file, item.x + 0.16, 1.88, 5.56, 4.05);
    text(slide, item.title, item.x + 0.22, 6.02, 5.44, 0.32, { fontSize: 16, bold: true, color: C.navy });
    text(slide, item.desc, item.x + 0.22, 6.38, 5.44, 0.22, { fontSize: 10, color: C.muted });
  });
  box(slide, 0.62, 6.76, 12.08, 0.24, C.paleBlue, C.paleBlue);
  text(slide, '콩이 대결: 몸풀기·도전 난이도 조절  ·  교사 실데이터는 Supabase 계정·SQL 설정 후 활성화', 0.78, 6.79, 11.76, 0.16, { fontSize: 9, bold: true, color: C.blue, align: 'center' });

  slide.addNotes('실제 웹앱 화면에서 한 문제를 시도해 볼 수 있습니다. 0.8과 0.5를 0.1 조각으로 생각하고, 열 조각을 한 묶음으로 바꾸어 1.3이 되는 모습을 확인합니다. 계산이 필요하면 별도 화면으로 이동하지 않고 콩이 공책을 펼쳐 필기하고 되돌릴 수 있습니다. AI 대결은 더 높은 단계도 선택할 수 있지만, 상대 풀이 시간은 브라우저에서 흉내 내는 체험용입니다. 교사 대시보드 화면과 Supabase 연동 코드는 준비되어 있으나, 실제 학급 데이터는 스키마와 계정을 설정해야 연결됩니다.');
}

// Slide 4: expected educational value, explicitly not a measured outcome.
{
  const slide = pptx.addSlide('MASTER');
  header(slide, '교육적 기대효과', '학생에게는 다시 시도할 여유, 교사에게는 관찰 단서', '성과를 단정하지 않고, 수업에서 검증할 기대효과로 제시합니다.', 4);

  card(slide, 0.62, 1.9, 4.65, 4.62, C.paleMint, 'CFE4D5');
  text(slide, '학생에게 기대하는 변화', 0.91, 2.18, 4.05, 0.42, { fontSize: 19, bold: true, color: C.navy });
  const studentBenefits = [
    ['시작 부담 낮추기', '큰 선택지와 한 문제 미션'],
    ['개념을 눈으로 보기', '0.1 조각을 묶어 자리값 탐색'],
    ['막혀도 다시 시도', '힌트·공책·확인 문제 활용'],
    ['더 배우고 싶은 학생', '도전 난이도로 확장'],
  ];
  studentBenefits.forEach(([title, desc], i) => {
    const y = 2.88 + i * 0.82;
    circle(slide, 0.96, y + 0.05, 0.22, C.mintDeep);
    text(slide, String(i + 1), 0.96, y + 0.05, 0.22, 0.22, { fontSize: 8, bold: true, color: C.white, align: 'center' });
    text(slide, title, 1.32, y, 3.6, 0.28, { fontSize: 14, bold: true, color: C.navy });
    text(slide, desc, 1.32, y + 0.32, 3.6, 0.3, { fontSize: 11, color: C.muted });
  });

  card(slide, 5.52, 1.9, 7.18, 4.62, C.white, C.line);
  text(slide, '교사 대시보드 화면 · 현재 수치는 샘플', 5.8, 2.12, 6.7, 0.32, { fontSize: 16, bold: true, color: C.navy });
  addContainedPng(slide, 'ppt-teacher-insights-grid.png', 5.78, 2.53, 6.65, 2.46);
  text(slide, '반복해서 막힌 개념과 학생별 질문을 살펴보는 화면', 5.83, 5.06, 6.5, 0.26, { fontSize: 12, bold: true, color: C.blue, align: 'center' });
  text(slide, '질문 기록 확인  ·  도움이 필요한 개념 파악  ·  후속 지도 계획', 5.83, 5.48, 6.5, 0.35, { fontSize: 11, color: C.muted, align: 'center' });
  label(slide, '대시보드 지표는 Supabase 설정 뒤 실제 학급 데이터로 연결', 6.02, 6.03, 6.12, C.paleRose, C.adzuki);
  box(slide, 1.18, 6.72, 10.97, 0.34, 'FBF1EF', 'FBF1EF');
  text(slide, '모든 내용은 교육적 기대효과이며, 학습 성취 향상은 실제 수업 적용과 평가로 검증해야 합니다.', 1.34, 6.78, 10.65, 0.2, { fontSize: 10, bold: true, color: C.adzuki, align: 'center' });

  slide.addNotes('학생에게는 점수나 속도를 재촉하기보다 다시 생각할 기회를 주는 것이 목표입니다. 짧은 힌트와 조작형 모형, 필기는 어려운 개념을 붙잡는 수단이 될 수 있습니다. 수학을 좋아하는 학생도 도전 난이도를 선택할 수 있습니다. 교사 대시보드 화면은 반복해서 막힌 개념과 학생별 질문을 살펴보도록 설계했지만, 여기 표시된 지표와 학생은 샘플입니다. Supabase 학급 설정 이후 실제 기록이 연결됩니다. 성취 향상은 아직 입증되지 않았으므로 수업에서 검증해야 합니다.');
}

// Slide 5: staged development path and the requested closing statement.
{
  const slide = pptx.addSlide('MASTER');
  header(slide, '발전 가능성', '문제 풀이 지원에서, 학습 과정을 이해하는 튜터로', '기능 확장과 함께 계정·데이터 보안, 실제 수업 검증을 단계적으로 진행합니다.', 5);

  const steps = [
    { x: 0.68, n: '01', title: '실계정·학급 연동', color: C.blue, fill: C.sky, lines: ['Supabase SQL·Auth 설정', '관리자 사전 등록과 RLS 확인', '학생 로그인·교사 실시간 화면 검증'] },
    { x: 4.78, n: '02', title: '교실 파일럿', color: C.mintDeep, fill: C.paleMint, lines: ['학생별 질문·힌트·오류 관찰', '교사 알림의 정확성과 부담 점검', '보관 기간·개인정보 기준 마련'] },
    { x: 8.88, n: '03', title: '개별화 확장', color: C.adzuki, fill: C.paleRose, lines: ['기초부터 심화까지 학습 경로', '학생 이력에 따른 문제 추천', '도형·그래프 조작 활동으로 확대'] },
  ];
  steps.forEach((step, index) => {
    card(slide, step.x, 1.95, 3.78, 3.55, step.fill, step.fill);
    circle(slide, step.x + 0.24, 2.2, 0.56, step.color);
    text(slide, step.n, step.x + 0.24, 2.2, 0.56, 0.56, { fontSize: 14, bold: true, color: C.white, align: 'center' });
    text(slide, step.title, step.x + 0.24, 2.98, 3.25, 0.52, { fontSize: 20, bold: true, color: C.navy });
    step.lines.forEach((line, i) => {
      circle(slide, step.x + 0.27, 3.78 + i * 0.48, 0.12, step.color);
      text(slide, line, step.x + 0.5, 3.72 + i * 0.48, 2.98, 0.35, { fontSize: 12, color: C.ink });
    });
    if (index < steps.length - 1) text(slide, '→', step.x + 3.8, 3.3, 0.33, 0.45, { fontSize: 25, bold: true, color: '8CA99C', align: 'center' });
  });
  text(slide, '“AI는 교사를 대신하는 것이 아니라, 모든 학생의 배움에 더 가까이 다가갈 수 있도록 돕는 도구이다.”', 0.85, 5.95, 11.7, 0.8, { fontSize: 21, bold: true, color: C.navy, align: 'center', valign: 'mid', breakLine: false });
  beanPair(slide, 0.25, 6.55, 0.72);

  slide.addNotes('다음 단계는 Supabase 스키마를 실행하고 관리자 계정과 학급 프로필을 등록해 실제 로그인과 학급별 RLS를 검증하는 일입니다. 그 다음에는 실제 수업에서 질문, 힌트, 풀이 시간, 반복 오류가 교사 지도에 도움이 되는지 확인해야 합니다. 장기적으로는 누적된 학습 이력에 따라 난이도와 학습 경로를 추천하고, 도형이나 그래프를 직접 조작하는 활동으로 확장할 수 있습니다. 이 과정에서도 교육적 판단과 학생을 이해하는 역할은 교사에게 있습니다.');
}

await pptx.writeFile({ fileName: output });
console.log(`Created ${output}`);
