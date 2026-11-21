import { createClient } from '@supabase/supabase-js';
import curriculum3 from './curriculum-grade3-2.json';
import curriculum4 from './curriculum.json';
import curriculum5 from './curriculum-grade5-2.json';
import curriculum6 from './curriculum-grade6-2.json';
import dailyMissions3 from './missions-grade3-2.json';
import dailyMissions5 from './missions-grade5-2.json';
import dailyMissions6 from './missions-grade6-2.json';
import battleQuestions3 from './battle-questions-grade3-2.json';
import battleQuestions5 from './battle-questions-grade5-2.json';
import battleQuestions6 from './battle-questions-grade6-2.json';
import lineGraphSets from './graph-data.json';
import { getTutorGraphData, graphTutorReply } from './graph-answer.mjs';

const STORAGE_KEY = 'math-step-grade4-2-decimals-v1';
const modes = {
  concept: { label: '개념 질문', placeholder: '소수 계산이 궁금해요...' },
  stuck: { label: '막힌 문제', placeholder: '계산식과 막힌 자리를 적어보세요...' },
  check: { label: '풀이 확인', placeholder: '계산식과 내 답을 함께 적어보세요...' },
  teach: { label: '콩이에게 가르치기', placeholder: '내가 이해한 방법을 콩이에게 설명해 봐요...' },
  battle: { label: 'AI 대결', placeholder: '콩이와 계산 대결을 해봐요...' },
};

const elements = {
  form: document.querySelector('#question-form'),
  input: document.querySelector('#question-input'),
  messages: document.querySelector('#chat-messages'),
  quickPrompts: document.querySelector('#quick-prompts'),
  charCount: document.querySelector('#char-count'),
  historyCount: document.querySelector('#history-count'),
  historyList: document.querySelector('#history-list'),
  clearHistory: document.querySelector('#clear-history'),
  toast: document.querySelector('#toast'),
};

let activeMode = 'concept';
let hintCount = 0;
let lastQuestion = '';
const attachedQuestionFractions = [];
let questionFractionKind = 'fraction';
let toastTimer;
let conversation = [];
let tutorBusy = false;
let notebookCurrentPrompt = '2/7 + 3/7 = ?';
let currentStudentActivity = '오늘 미션';
let activeDataStudentId = null;
let data = loadData();
const activityChannel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('kongsem-classroom') : null;
let supabaseClient = null;
let currentAuthUser = null;
let teacherRealtimeChannel = null;
let studentSkillProgress = {};
let activeGrade = 4;
let activeStudyUnitId = 'fractions';

const curriculaByGrade = { 3: curriculum3, 4: curriculum4, 5: curriculum5, 6: curriculum6 };
let curriculumUnits = curriculum4.units;
let curriculumUnitById = Object.fromEntries(curriculumUnits.map((unit) => [unit.id, unit]));
let learningSkillLabels = Object.fromEntries(curriculumUnits.flatMap((unit) => unit.skills.map((skill) => [skill.id, skill.label])));
const geometryPlans = {
  3: {
    unit: '선분과 각 · 삼각형 · 사각형 · 원',
    description: '선분과 반직선을 그려 보고, 각과 여러 가지 평면도형을 만들어 봐요.',
    note: '선분·반직선·각·직각과 삼각형, 사각형, 원을 살펴봐요.',
    defaultMode: '2d',
    defaultTool: 'lines',
    modes: ['2d'],
    tools: { '2d': ['lines', 'angles', 'triangles', 'quadrilaterals', 'circle'] },
  },
  4: {
    unit: '삼각형 · 사각형 · 다각형',
    description: '삼각형과 사각형의 성질을 비교하고, 다각형을 직접 만들어 봐요.',
    note: '삼각형의 변과 각, 사각형의 성질, 다각형의 변과 꼭짓점을 살펴봐요.',
    defaultMode: '2d',
    defaultTool: 'triangles',
    modes: ['2d'],
    tools: { '2d': ['triangles', 'quadrilaterals', 'polygon'] },
  },
  5: {
    unit: '합동과 대칭 · 직육면체',
    description: '도형을 포개어 합동을 확인하고, 대칭축과 직육면체를 살펴봐요.',
    note: '합동인 도형과 대칭축을 비교하고 직육면체의 면·모서리·꼭짓점을 살펴봐요.',
    defaultMode: '2d',
    defaultTool: 'symmetry',
    modes: ['2d', '3d'],
    tools: { '2d': ['congruence', 'symmetry'], '3d': ['prism'] },
    preview3d: false,
  },
  6: {
    unit: '공간과 입체 · 원의 넓이 · 원기둥·원뿔·구',
    description: '쌓기나무를 여러 방향에서 보고 원의 넓이와 입체도형을 탐구해요.',
    note: '원의 넓이를 어림하고, 쌓기나무와 원기둥·원뿔·구의 모양을 살펴봐요.',
    defaultMode: '2d',
    defaultTool: 'circleArea',
    modes: ['2d', '3d'],
    tools: { '2d': ['circleArea'], '3d': ['blocks', 'solids'] },
    preview3d: false,
  },
};
const geometryToolLabels = {
  lines: '선분과 반직선',
  angles: '각과 직각',
  triangles: '삼각형 만들기',
  quadrilaterals: '사각형 만들기',
  polygon: '다각형 만들기',
  circle: '원과 반지름',
  congruence: '합동인 도형',
  symmetry: '대칭축 찾기',
  circleArea: '원의 넓이',
  blocks: '쌓기나무',
  prism: '직육면체',
  solids: '원기둥·원뿔·구',
};
const geometryState = {
  mode: '2d',
  tool: 'polygon',
  sides: 5,
  rotation: 0,
  radius: 5,
  showMeasurements: true,
  symmetryShape: 'square',
  symmetryAxes: true,
  blocks: [[1, 2, 1], [2, 3, 1], [1, 1, 2]],
  blockView: 'iso',
  solid: 'prism',
  solidNet: false,
  solidTurn: 0,
  lineKind: 'segment',
  angleKind: 'right',
  triangleKind: 'right',
  quadrilateralKind: 'square',
  congruenceShape: 'triangle',
  drawings: {
    lines: [[78, 126], [242, 126]],
    angles: [[150, 168], [252, 168], [196, 62]],
    triangles: [[76, 198], [244, 198], [76, 54]],
    quadrilaterals: [[82, 48], [238, 48], [238, 204], [82, 204]],
    polygon: [[160, 45], [238, 100], [208, 190], [112, 190], [82, 100]],
    circle: [[160, 126], [208, 126]],
    circleArea: [[160, 126], [205, 126]],
    congruence: [[48, 126], [112, 62], [126, 190]],
    symmetry: [[160, 45], [238, 100], [208, 190], [112, 190], [82, 100]],
  },
  constrainedShapes: { triangles: null, quadrilaterals: null },
  drawingComplete: true,
  activeDragPoint: null,
  dragOrigin: null,
};
const geometryShapeLabels = { triangle: '정삼각형', square: '정사각형', rectangle: '직사각형', pentagon: '정오각형' };
const geometrySolidLabels = { prism: '직육면체', cylinder: '원기둥', cone: '원뿔', sphere: '구' };
const geometrySolidFacts = {
  prism: [['면', '6개'], ['모서리', '12개'], ['꼭짓점', '8개']],
  cylinder: [['밑면', '2개'], ['곡면', '1개'], ['꼭짓점', '0개']],
  cone: [['밑면', '1개'], ['곡면', '1개'], ['꼭짓점', '1개']],
  sphere: [['평평한 면', '0개'], ['곡면', '1개'], ['꼭짓점', '0개']],
};
function createSampleMachineParts() {
  return [{ id: 'part-1', type: 'ramp', x: -2, y: 1, z: 0, width: 3.2, height: 0.12, depth: 0.8, angle: -12, yaw: 0, speed: 0, leverArm: 0.55, phase: 0, leverOmega: 0 }];
}
const machineBoard = { width: 7.2, depth: 4.5, height: 3.6 };
const machinePartLabels = { ramp: '경사로', block: '블록', turntable: '회전판', lever: '지렛대' };
let machineLabOpen = false;
let machineLabAccessChecked = false;
let machineLabAccessError = '';
let machineLoadedShare = '';
let machineShareImportValid = false;
let machineAnimationId = 0;
let machineLastFrameTime = 0;
let machineSettleTime = 0;
let machineDragState = null;
let machineThree = null;
let machineThreeLoader = null;
let machineResizeObserver = null;
let machinePlacementHeight = 0.8;
const machine = {
  title: '첫 번째 경사로',
  parts: createSampleMachineParts(),
  nextId: 2,
  selectedId: null,
  tool: 'ramp',
  running: false,
  ball: { x: -3.04, y: 1.42, z: 0, vx: 0.85, vy: 0, vz: 0, rotation: 0, rotationX: 0, spin: 0 },
  elapsed: 0,
  result: '미리 놓인 경사로에서 구슬을 굴려 보고, 부품을 더해 길을 바꿔 보세요.',
};

const dailyMissions4 = [
  {
    unitId: 'fractions',
    title: '진분수의 덧셈',
    questionTitle: '2/7 + 3/7은 얼마일까요?',
    question: '일곱 조각 중 색칠한 조각을 함께 세어봐요.',
    hint: '분모가 같은 분수는 같은 크기 조각이에요. 분모는 그대로 두고 분자끼리 더해요.',
    visual: 'fraction-bars',
    fractionBars: [{ numerator: 2, denominator: 7 }, { numerator: 3, denominator: 7 }],
    skill: 'fraction_add',
    choices: ['5/7', '5/14', '1/7'],
    answer: '5/7',
    correctText: '맞아요! 같은 크기인 1/7 조각 2개와 3개를 모으면 1/7 조각 5개, 즉 5/7이에요.',
    retryText: '한 조각의 크기는 모두 1/7이에요. 조각 수 2와 3을 더해 5/7이에요.',
    retry: { questionTitle: '1/6 + 4/6은 얼마일까요?', question: '같은 크기 조각을 모아 봐요.', hint: '1/6 조각 한 개와 네 개를 합쳐요.', visual: 'fraction-bars', fractionBars: [{ numerator: 1, denominator: 6 }, { numerator: 4, denominator: 6 }], skill: 'fraction_add', choices: ['5/6', '5/12', '3/6'], answer: '5/6', correctText: '맞아요! 1/6 조각이 모두 5개여서 5/6이에요.', retryText: '분모 6은 조각 크기라 그대로 두고, 조각 수 1+4를 더해 5/6이에요.' },
  },
  {
    unitId: 'fractions',
    title: '대분수의 덧셈',
    questionTitle: '1과 2/5 + 2와 1/5는 얼마일까요?',
    question: '자연수 부분과 분수 부분을 따로 모아 봐요.',
    hint: '1+2와 2/5+1/5를 각각 계산해요.',
    visual: 'fraction-bars',
    fractionBars: [{ numerator: 2, denominator: 5 }, { numerator: 1, denominator: 5 }],
    skill: 'fraction_add',
    choices: ['3과 3/5', '3과 3/10', '4과 1/5'],
    answer: '3과 3/5',
    correctText: '맞아요! 자연수는 1+2=3, 분수는 2/5+1/5=3/5라서 3과 3/5예요.',
    retryText: '자연수끼리 1+2=3, 같은 분모 분수끼리 2/5+1/5=3/5예요. 합치면 3과 3/5예요.',
    retry: { questionTitle: '2와 1/6 + 1과 3/6은 얼마일까요?', question: '자연수와 같은 크기 분수 조각을 각각 모아봐요.', hint: '자연수끼리, 분자끼리 따로 더해요.', visual: 'fraction-bars', fractionBars: [{ numerator: 1, denominator: 6 }, { numerator: 3, denominator: 6 }], skill: 'fraction_add', choices: ['3과 4/6', '3과 4/12', '4과 2/6'], answer: '3과 4/6', correctText: '맞아요! 2+1=3이고 1/6 조각은 4개라서 3과 4/6이에요.', retryText: '분모 6은 그대로 두고 분자 1+3을 더해요. 자연수 부분 2+1과 합치면 3과 4/6이에요.' },
  },
  {
    unitId: 'fractions',
    title: '진분수의 뺄셈',
    questionTitle: '5/8 - 2/8은 얼마일까요?',
    question: '색칠한 여덟 조각 중 두 조각을 빼봐요.',
    hint: '같은 크기 조각이므로 분모는 그대로 두고 조각 수를 빼요.',
    visual: 'fraction-bars',
    fractionBars: [{ numerator: 5, denominator: 8 }, { numerator: 2, denominator: 8 }],
    skill: 'fraction_subtract',
    choices: ['3/8', '3/16', '7/8'],
    answer: '3/8',
    correctText: '맞아요! 1/8 조각 5개에서 2개를 빼면 3개가 남아 3/8이에요.',
    retryText: '조각 크기 1/8은 그대로예요. 색칠한 조각 수 5개에서 2개를 빼면 3/8이에요.',
    retry: { questionTitle: '7/9 - 4/9는 얼마일까요?', question: '아홉 조각 중 남는 조각 수를 세어봐요.', hint: '7개에서 4개를 빼요.', visual: 'fraction-bars', fractionBars: [{ numerator: 7, denominator: 9 }, { numerator: 4, denominator: 9 }], skill: 'fraction_subtract', choices: ['3/9', '3/5', '11/9'], answer: '3/9', correctText: '맞아요! 1/9 조각 7개에서 4개를 빼면 3/9예요.', retryText: '분모는 그대로 9, 분자는 7-4=3이므로 3/9예요.' },
  },
  {
    unitId: 'fractions',
    title: '대분수의 뺄셈',
    questionTitle: '4와 1/5 - 1과 3/5는 얼마일까요?',
    question: '1/5가 부족하면 자연수 1을 분수 조각으로 바꿔봐요.',
    hint: '1은 5/5와 같아요. 4와 1/5를 3과 6/5로 다시 나타낼 수 있어요.',
    visual: 'fraction-bars',
    fractionBars: [{ numerator: 1, denominator: 5 }, { numerator: 3, denominator: 5 }],
    skill: 'fraction_regroup',
    choices: ['2와 3/5', '3와 2/5', '2와 2/5'],
    answer: '2와 3/5',
    correctText: '맞아요! 4와 1/5는 3과 6/5예요. 6/5-3/5=3/5, 자연수는 3-1=2라서 2와 3/5예요.',
    retryText: '1/5에서 3/5를 바로 뺄 수 없어요. 자연수 1을 5/5로 바꾸면 4와 1/5는 3과 6/5가 돼요. 이제 빼면 2와 3/5예요.',
    retry: { questionTitle: '3과 1/6 - 1과 4/6은 얼마일까요?', question: '자연수 1을 6/6으로 바꾸어 생각해요.', hint: '3과 1/6은 2와 7/6으로 나타낼 수 있어요.', visual: 'fraction-bars', fractionBars: [{ numerator: 1, denominator: 6 }, { numerator: 4, denominator: 6 }], skill: 'fraction_regroup', choices: ['1과 3/6', '2와 3/6', '1과 5/6'], answer: '1과 3/6', correctText: '맞아요! 3과 1/6=2와 7/6이고, 7/6-4/6=3/6이므로 1과 3/6이에요.', retryText: '자연수 1을 6/6으로 가르면 3과 1/6은 2와 7/6이 돼요. 거기서 1과 4/6을 빼면 1과 3/6이에요.' },
  },
  {
    unitId: 'triangles',
    title: '변의 길이에 따른 삼각형 분류',
    questionTitle: '두 변의 길이가 같은 삼각형은 무엇일까요?',
    question: '그림에서 길이가 같은 변 표시를 살펴봐요.',
    hint: '힌트: ‘이등변’은 두 변의 길이가 같다는 뜻이에요.',
    visual: 'triangle',
    triangleKind: 'isosceles',
    skill: 'triangle_sides',
    choices: ['이등변삼각형', '정삼각형', '둔각삼각형'],
    answer: '이등변삼각형',
    correctText: '맞아요! 두 변의 길이가 같은 삼각형을 이등변삼각형이라고 해요.',
    retryText: '두 변의 길이가 같은 표시가 있어요. 이런 삼각형은 이등변삼각형이에요.',
    retry: { questionTitle: '세 변의 길이가 모두 같은 삼각형은?', question: '세 변의 표시가 같은지 그림으로 살펴봐요.', hint: '세 변 모두 길이가 같으면 정삼각형이에요.', visual: 'triangle', triangleKind: 'equilateral', skill: 'triangle_sides', choices: ['정삼각형', '이등변삼각형만', '둔각삼각형'], answer: '정삼각형', correctText: '맞아요! 세 변의 길이가 모두 같은 삼각형은 정삼각형이에요.', retryText: '세 변의 길이가 모두 같으면 정삼각형이에요. 정삼각형은 이등변삼각형의 조건도 만족해요.' },
  },
  {
    unitId: 'triangles',
    title: '각의 크기에 따른 삼각형 분류',
    questionTitle: '한 각이 직각보다 큰 삼각형은 무엇일까요?',
    question: '세 각 중 직각보다 큰 각이 하나 있는지 살펴봐요.',
    hint: '힌트: 직각보다 큰 각은 둔각이에요.',
    visual: 'triangle',
    triangleKind: 'obtuse',
    skill: 'triangle_angles',
    choices: ['둔각삼각형', '예각삼각형', '정삼각형'],
    answer: '둔각삼각형',
    correctText: '맞아요! 한 각이 둔각인 삼각형을 둔각삼각형이라고 해요.',
    retryText: '직각보다 큰 각은 둔각이에요. 둔각이 하나 있는 삼각형은 둔각삼각형이에요.',
    retry: { questionTitle: '세 각이 모두 직각보다 작은 삼각형은?', question: '세 각이 모두 예각인지 살펴봐요.', hint: '세 각이 모두 90도보다 작아요.', visual: 'triangle', triangleKind: 'acute', skill: 'triangle_angles', choices: ['예각삼각형', '직각삼각형', '둔각삼각형'], answer: '예각삼각형', correctText: '맞아요! 세 각이 모두 예각이면 예각삼각형이에요.', retryText: '세 각이 모두 90도보다 작으므로 예각삼각형이에요.' },
  },
  {
    unitId: 'triangles',
    title: '삼각형을 두 가지 기준으로 분류',
    questionTitle: '두 변의 길이가 같고 한 각이 직각인 삼각형은?',
    question: '변과 각, 두 가지 기준을 함께 살펴봐요.',
    hint: '힌트: 변으로는 이등변, 각으로는 직각삼각형인지 따로 판단해요.',
    visual: 'triangle',
    triangleKind: 'right-isosceles',
    skill: 'triangle_properties',
    choices: ['이등변삼각형이면서 직각삼각형', '정삼각형이면서 예각삼각형', '둔각삼각형'],
    answer: '이등변삼각형이면서 직각삼각형',
    correctText: '맞아요! 한 삼각형은 변의 길이와 각의 크기 기준으로 각각 분류할 수 있어요.',
    retryText: '두 변의 길이가 같다는 기준은 이등변삼각형, 한 각이 직각이라는 기준은 직각삼각형이에요.',
    retry: { questionTitle: '세 변이 모두 같고 세 각이 모두 예각인 삼각형은?', question: '변과 각의 두 가지 성질을 함께 골라봐요.', hint: '정삼각형의 세 변은 같고, 세 각은 모두 예각이에요.', visual: 'triangle', triangleKind: 'equilateral', skill: 'triangle_properties', choices: ['정삼각형이면서 예각삼각형', '이등변삼각형이면서 둔각삼각형', '직각삼각형'], answer: '정삼각형이면서 예각삼각형', correctText: '맞아요! 정삼각형은 세 변이 같고, 세 각이 모두 예각이에요.', retryText: '세 변이 모두 같아 정삼각형이고, 세 각은 모두 90도보다 작아요.' },
  },
  {
    unitId: 'decimals',
    title: '소수 두 자리 알아보기',
    questionTitle: '100칸 중 37칸을 색칠했어요.',
    question: '어떤 소수를 나타낼까요?',
    hint: '힌트: 10칸을 모으면 0.1이에요. 37칸은 0.01이 몇 개일까요?',
    visual: 'hundredths',
    skill: 'decimal_place_value',
    choices: ['0.307', '0.37', '3.7'],
    answer: '0.37',
    correctText: '맞았어요! 100칸 중 37칸은 0.01이 37개예요. 10개씩 묶으면 0.1이 3개와 0.01이 7개라서 0.37이에요.',
    retryText: '괜찮아요. 색칠한 칸 하나는 0.01이에요. 37칸을 10칸씩 묶으면 0.1이 3개 남고, 0.01이 7개 남아요. 그래서 0.37이에요.',
    retry: { questionTitle: '0.46은 0.01이 몇 개일까요?', question: '100칸 그림에서 46칸을 세어봐요.', hint: '힌트: 색칠한 칸 하나는 0.01이에요.', visual: 'hundredths', visualValue: '0.46', choices: ['4.6', '46', '406'], answer: '46', correctText: '맞아요! 0.46은 0.01이 46개예요.', retryText: '0.46은 0.01이 46개예요. 4개의 0.1은 40개의 0.01, 그리고 6개의 0.01이 더 있어요.' },
  },
  {
    unitId: 'decimals',
    title: '소수 세 자리 알아보기',
    questionTitle: '0.426은 0.001이 몇 개일까요?',
    question: '자릿값 표를 보고 골라봐요.',
    hint: '힌트: 0.001이 10개 모이면 0.01이에요. 0.426을 0.001 단위로 세어봐요.',
    visual: 'place-value',
    skill: 'decimal_place_value',
    choices: ['42.6', '426', '4.26'],
    answer: '426',
    correctText: '맞았어요! 0.426은 0.001이 426개인 수예요. 4개의 0.1, 2개의 0.01, 6개의 0.001을 모았어요.',
    retryText: '괜찮아요. 자릿값 표에서 4는 0.1, 2는 0.01, 6은 0.001 자리예요. 모두 0.001 단위로 바꾸면 400개, 20개, 6개라서 426개예요.',
    retry: { questionTitle: '0.315는 0.001이 몇 개일까요?', question: '자릿값 표를 보고 다시 세어봐요.', hint: '힌트: 0.3은 0.001이 300개예요.', visual: 'place-value', visualValue: '0.315', choices: ['31.5', '315', '3.15'], answer: '315', correctText: '맞아요! 0.315는 0.001이 315개예요.', retryText: '0.315는 300개의 0.001, 10개의 0.001, 5개의 0.001을 모은 수라서 모두 315개예요.' },
  },
  {
    unitId: 'decimals',
    title: '소수의 크기 비교하기',
    questionTitle: '0.5와 0.48 중 더 큰 수는 무엇일까요?',
    question: '소수점을 맞춰 자릿수끼리 비교해 봐요.',
    hint: '힌트: 0.5는 0.50과 같아요. 소수 둘째 자리까지 맞춰 비교해 봐요.',
    visual: 'comparison',
    skill: 'decimal_place_value',
    choices: ['0.48', '같아요', '0.5'],
    answer: '0.5',
    correctText: '맞았어요! 0.5는 0.50과 같아요. 0.50에는 0.1이 5개, 0.48에는 0.1이 4개 있으므로 0.5가 더 커요.',
    retryText: '0.5를 0.50으로 바꾸어 비교해요. 소수 첫째 자리에서 5와 4를 비교하면 5가 더 크므로 0.5가 더 커요.',
    retry: { questionTitle: '0.6과 0.58 중 더 큰 수는 무엇일까요?', question: '두 수를 소수 둘째 자리까지 맞춰 비교해 봐요.', hint: '힌트: 0.6은 0.60과 같아요.', visual: 'comparison', comparisonValues: ['0.6', '0.58'], choices: ['0.58', '같아요', '0.6'], answer: '0.6', correctText: '맞아요! 0.60은 0.58보다 커요.', retryText: '0.6을 0.60으로 써요. 소수 첫째 자리의 6은 5보다 크므로 0.6이 더 커요.' },
  },
  {
    unitId: 'decimals',
    title: '소수 사이의 관계 알아보기',
    questionTitle: '0.4는 0.01이 몇 개 모인 수일까요?',
    question: '0.1 한 개를 0.01 조각으로 바꾸어 생각해 봐요.',
    hint: '힌트: 0.1은 0.01이 10개예요. 0.4에는 0.1이 몇 개 있나요?',
    visual: 'relationships',
    skill: 'decimal_place_value',
    choices: ['4개', '40개', '400개'],
    answer: '40개',
    correctText: '맞았어요! 0.4는 0.1이 4개이고, 0.1 하나는 0.01이 10개예요. 그래서 0.4는 0.01이 40개예요.',
    retryText: '0.4에는 0.1이 4개 있어요. 0.1 하나를 0.01 열 개로 바꾸면, 0.01은 4×10=40개예요.',
    retry: { questionTitle: '0.7은 0.01이 몇 개일까요?', question: '0.1 일곱 묶음에 0.01 조각은 모두 몇 개일까요?', hint: '힌트: 각 0.1 묶음에는 0.01이 10개 있어요.', visual: 'relationships', relationshipTenths: 7, choices: ['7개', '70개', '700개'], answer: '70개', correctText: '맞아요! 0.7은 0.1이 7개이고, 0.01은 70개예요.', retryText: '0.1이 7개예요. 0.1 하나는 0.01 열 개이므로 7×10=70개의 0.01이에요.' },
  },
  {
    unitId: 'decimals',
    title: '소수 한 자리 수의 덧셈',
    questionTitle: '0.8 + 0.5는 얼마일까요?',
    question: '0.1 조각을 모아 계산해 봐요.',
    hint: '힌트: 0.1 조각 8개와 5개를 합치면 10개씩 묶을 수 있어요.',
    visual: 'vertical',
    expression: '0.8 + 0.5',
    skill: 'decimal_regrouping',
    choices: ['1.3', '0.13', '1.2'],
    answer: '1.3',
    correctText: '맞았어요! 0.1 조각 13개는 10개를 1로 묶고 3개가 남아 1.3이에요.',
    retryText: '0.1 조각은 8개와 5개를 합쳐 13개예요. 10개는 1로 묶고 3개가 남으므로 1.3이에요.',
    retry: { questionTitle: '0.6 + 0.7은 얼마일까요?', question: '0.1 조각을 모아 세로셈으로 풀어봐요.', hint: '힌트: 0.1 조각이 10개 모이면 1이에요.', visual: 'vertical', expression: '0.6 + 0.7', skill: 'decimal_regrouping', choices: ['1.3', '0.13', '1.2'], answer: '1.3', correctText: '맞아요! 0.1 조각 13개는 1.3이에요.', retryText: '0.1 조각 6개와 7개를 합치면 13개예요. 10개를 1로 묶어 1.3이 돼요.' },
  },
  {
    unitId: 'decimals',
    title: '소수 두 자리 수의 덧셈',
    questionTitle: '2.78 + 3.6은 얼마일까요?',
    question: '먼저 소수점을 세로로 맞춰 써봐요.',
    hint: '힌트: 3.6은 3.60과 같아요. 같은 자리끼리 더해요.',
    visual: 'vertical',
    expression: '2.78 + 3.6',
    skill: 'decimal_alignment',
    choices: ['6.38', '6.14', '5.38'],
    answer: '6.38',
    correctText: '맞았어요! 3.6을 3.60으로 맞춰 쓰면 2.78 + 3.60 = 6.38이에요.',
    retryText: '3.6의 오른쪽에 0을 붙여 3.60으로 써요. 소수점끼리 맞추어 더하면 2.78 + 3.60 = 6.38이에요.',
    retry: { questionTitle: '1.46 + 2.3은 얼마일까요?', question: '소수점을 세로로 맞춰 계산해 봐요.', hint: '힌트: 2.3은 2.30으로 써도 같은 수예요.', visual: 'vertical', expression: '1.46 + 2.3', skill: 'decimal_alignment', choices: ['3.76', '3.49', '3.66'], answer: '3.76', correctText: '맞아요! 1.46 + 2.30 = 3.76이에요.', retryText: '2.3을 2.30으로 쓰고 소수점끼리 맞춰 더하면 3.76이에요.' },
  },
  {
    unitId: 'decimals',
    title: '소수 한 자리 수의 뺄셈',
    questionTitle: '7.3 - 2.4는 얼마일까요?',
    question: '소수점을 맞춰 쓰고 받아내림이 필요한지 살펴봐요.',
    hint: '힌트: 0.1 자리에서 3개로 4개를 뺄 수 있을까요?',
    visual: 'vertical',
    expression: '7.3 - 2.4',
    skill: 'decimal_regrouping',
    choices: ['4.9', '5.1', '4.8'],
    answer: '4.9',
    correctText: '맞았어요! 7.3에서 1을 받아내려 6과 13개의 0.1로 생각하면 13개에서 4개를 빼 9개가 남아요. 답은 4.9예요.',
    retryText: '0.1 자리에서 3개로 4개를 뺄 수 없어요. 1을 받아내려 7.3을 6과 13개의 0.1로 생각하면 13-4=9라서 4.9예요.',
    retry: { questionTitle: '5.2 - 1.6은 얼마일까요?', question: '0.1 자리에서 받아내림이 필요한지 살펴봐요.', hint: '힌트: 0.2에서 0.6을 바로 뺄 수 있을까요?', visual: 'vertical', expression: '5.2 - 1.6', skill: 'decimal_regrouping', choices: ['3.6', '4.4', '3.4'], answer: '3.6', correctText: '맞아요! 5.2에서 1을 받아내려 4와 12개의 0.1로 생각하면 12-6=6이라서 3.6이에요.', retryText: '0.2에서 0.6을 뺄 수 없어서 1을 받아내려요. 5.2는 4와 12개의 0.1로 볼 수 있으므로 답은 3.6이에요.' },
  },
  {
    unitId: 'decimals',
    title: '소수 두 자리 수의 뺄셈',
    questionTitle: '9.2 - 5.29는 얼마일까요?',
    question: '소수점을 맞추고 같은 자리끼리 빼봐요.',
    hint: '힌트: 9.2는 9.20과 같아요. 소수 둘째 자리에서 받아내림이 필요한지 봐요.',
    visual: 'vertical',
    expression: '9.2 - 5.29',
    skill: 'decimal_alignment',
    choices: ['3.91', '4.09', '3.99'],
    answer: '3.91',
    correctText: '맞았어요! 9.2를 9.20으로 쓰고 소수점을 맞추면 9.20 - 5.29 = 3.91이에요.',
    retryText: '9.2를 9.20으로 바꾸어 소수점을 맞춰요. 9.20 - 5.29를 세로로 계산하면 3.91이에요.',
    retry: { questionTitle: '6.4 - 2.78은 얼마일까요?', question: '6.4를 6.40으로 써서 세로로 계산해 봐요.', hint: '힌트: 소수점을 맞춘 뒤 6.40 - 2.78을 계산해요.', visual: 'vertical', expression: '6.4 - 2.78', skill: 'decimal_alignment', choices: ['3.62', '4.38', '3.72'], answer: '3.62', correctText: '맞아요! 6.40 - 2.78 = 3.62예요.', retryText: '6.4를 6.40으로 바꾸어 계산해요. 소수점끼리 맞추고 받아내림하면 3.62예요.' },
  },
  {
    unitId: 'quadrilaterals',
    title: '수직과 평행',
    questionTitle: '두 직선이 직각으로 만나는 관계는 무엇일까요?',
    question: '그림에서 만나는 선의 방향을 살펴봐요.',
    hint: '힌트: 두 선이 90도 각도로 만나면 수직이에요.',
    visual: 'line-relations',
    lineRelation: 'perpendicular',
    skill: 'quad_perpendicular_parallel',
    choices: ['수직', '평행', '같은 길이'],
    answer: '수직',
    correctText: '맞아요! 두 직선이 직각으로 만나면 서로 수직이라고 해요.',
    retryText: '모서리처럼 90도 각으로 만나면 수직이에요. 평행한 선은 아무리 길게 늘여도 만나지 않아요.',
    retry: { questionTitle: '나란히 뻗어도 만나지 않는 두 직선은?', question: '철길처럼 일정한 간격으로 나란한 선을 떠올려봐요.', hint: '힌트: 두 직선이 만나지 않고 나란해요.', visual: 'line-relations', lineRelation: 'parallel', skill: 'quad_perpendicular_parallel', choices: ['수직', '평행', '대각선'], answer: '평행', correctText: '맞아요! 만나지 않고 나란한 두 직선은 평행해요.', retryText: '평행선은 아무리 늘여도 만나지 않고, 두 선 사이의 간격이 같아요.' },
  },
  {
    unitId: 'quadrilaterals',
    title: '사다리꼴',
    questionTitle: '마주 보는 변 한 쌍이 평행한 사각형은?',
    question: '사각형에서 평행한 변이 몇 쌍인지 세어봐요.',
    hint: '힌트: 사다리꼴은 마주 보는 변 한 쌍이 평행해요.',
    visual: 'quadrilateral',
    shapeKind: 'trapezoid',
    skill: 'quad_trapezoid',
    choices: ['사다리꼴', '삼각형', '원'],
    answer: '사다리꼴',
    correctText: '맞아요! 마주 보는 변 한 쌍이 평행한 사각형을 사다리꼴이라고 해요.',
    retryText: '위아래처럼 마주 보는 변 한 쌍이 평행한 사각형이 사다리꼴이에요.',
    retry: { questionTitle: '사다리꼴에는 평행한 변이 몇 쌍 있을까요?', question: '그림의 표시를 보고 골라봐요.', hint: '마주 보는 변 한 쌍이 평행해요.', visual: 'quadrilateral', shapeKind: 'trapezoid', skill: 'quad_trapezoid', choices: ['한 쌍', '두 쌍', '없어요'], answer: '한 쌍', correctText: '맞아요! 사다리꼴에는 평행한 변이 한 쌍 있어요.', retryText: '사다리꼴은 마주 보는 변 한 쌍이 평행한 사각형이에요.' },
  },
  {
    unitId: 'quadrilaterals',
    title: '평행사변형',
    questionTitle: '마주 보는 두 쌍의 변이 모두 평행한 사각형은?',
    question: '두 쌍의 마주 보는 변을 찾아봐요.',
    hint: '힌트: 한 쌍이 아니라 두 쌍 모두 평행해요.',
    visual: 'quadrilateral',
    shapeKind: 'parallelogram',
    skill: 'quad_parallelogram',
    choices: ['평행사변형', '사다리꼴', '오각형'],
    answer: '평행사변형',
    correctText: '맞아요! 마주 보는 두 쌍의 변이 모두 평행한 사각형은 평행사변형이에요.',
    retryText: '위와 아래, 왼쪽과 오른쪽 변이 각각 평행하므로 평행사변형이에요.',
    retry: { questionTitle: '평행사변형의 마주 보는 변은 어떤 관계일까요?', question: '그림의 양쪽 변을 짝지어 봐요.', hint: '마주 보는 두 쌍을 살펴봐요.', visual: 'quadrilateral', shapeKind: 'parallelogram', skill: 'quad_parallelogram', choices: ['두 쌍 모두 평행', '한 쌍만 평행', '모두 수직'], answer: '두 쌍 모두 평행', correctText: '맞아요! 평행사변형은 마주 보는 두 쌍의 변이 평행해요.', retryText: '평행사변형의 마주 보는 변 두 쌍은 각각 평행해요.' },
  },
  {
    unitId: 'quadrilaterals',
    title: '마름모',
    questionTitle: '네 변의 길이가 모두 같은 사각형은?',
    question: '변의 길이를 나타내는 표시를 살펴봐요.',
    hint: '힌트: 네 변이 모두 같은 길이예요.',
    visual: 'quadrilateral',
    shapeKind: 'rhombus',
    skill: 'quad_rhombus',
    choices: ['마름모', '사다리꼴', '직사각형'],
    answer: '마름모',
    correctText: '맞아요! 네 변의 길이가 모두 같은 사각형은 마름모예요.',
    retryText: '기울어져 있어도 네 변의 길이가 모두 같으면 마름모예요.',
  },
  {
    unitId: 'quadrilaterals',
    title: '여러 가지 사각형의 관계',
    questionTitle: '정사각형은 어떤 성질을 모두 가지고 있을까요?',
    question: '네 변의 길이가 같고 네 각이 모두 직각이에요.',
    hint: '힌트: 직사각형의 성질과 마름모의 성질을 함께 생각해요.',
    visual: 'quadrilateral',
    shapeKind: 'square',
    skill: 'quad_relations',
    choices: ['직사각형과 마름모', '사다리꼴만', '삼각형과 마름모'],
    answer: '직사각형과 마름모',
    correctText: '맞아요! 정사각형은 네 각이 직각이라 직사각형이고, 네 변이 같아 마름모의 성질도 가져요.',
    retryText: '정사각형은 직사각형처럼 네 각이 직각이고, 마름모처럼 네 변의 길이가 모두 같아요.',
    retry: { questionTitle: '직사각형의 네 각은 어떤가요?', question: '정사각형은 직사각형의 성질도 가지고 있어요.', hint: '네 각이 모두 같은 크기의 직각이에요.', visual: 'quadrilateral', shapeKind: 'square', skill: 'quad_relations', choices: ['모두 직각', '모두 둔각', '두 개만 직각'], answer: '모두 직각', correctText: '맞아요! 직사각형과 정사각형은 네 각이 모두 직각이에요.', retryText: '정사각형은 네 변이 같고 네 각이 직각이므로 직사각형의 성질을 가져요.' },
  },
  {
    unitId: 'line_graphs',
    title: '꺾은선그래프 읽기',
    questionTitle: '월별 기온 중 5월의 기온은 몇 도일까요?',
    question: '그래프에서 5월 점과 세로 눈금을 따라가 봐요.',
    hint: '힌트: 가로축에서 5월을 찾고, 점에서 세로축으로 읽어요.',
    visual: 'line-graph',
    graphId: 'monthlyTemperatures',
    skill: 'graph_read',
    choices: ['4도', '5도', '7도'],
    answer: '4도',
    correctText: '맞아요! 5월 점의 높이가 4를 가리키므로 4도예요.',
    retryText: '가로축에서 5월을 찾고 그 점에서 왼쪽으로 가로선을 따라가면 세로축 값 4를 읽을 수 있어요.',
    retry: { questionTitle: '4월에서 6월까지 기온은 어떻게 변했을까요?', question: '그래프의 4월 점과 6월 점을 비교해요.', hint: '4월은 5도, 6월은 7도예요.', visual: 'line-graph', graphId: 'monthlyTemperatures', skill: 'graph_change', choices: ['2도 올랐어요', '2도 내렸어요', '변화 없어요'], answer: '2도 올랐어요', correctText: '맞아요! 7-5=2이므로 2도 올랐어요.', retryText: '6월 7도에서 4월 5도를 빼면 2도 차이이고, 기온이 올랐어요.' },
  },
  {
    unitId: 'line_graphs',
    title: '꺾은선그래프의 변화 해석',
    questionTitle: '그래프에서 가장 많이 오른 구간은 어디일까요?',
    question: '이웃한 점 사이의 높이 차이를 비교해봐요.',
    hint: '힌트: 각 구간의 시작과 끝 값을 빼서 변화량을 비교해요.',
    visual: 'line-graph',
    graphId: 'weekdayTemperatures',
    skill: 'graph_change',
    choices: ['월-화', '화-수', '수-목'],
    answer: '화-수',
    correctText: '맞아요! 화요일 3에서 수요일 7로 4만큼 올라 가장 크게 변했어요.',
    retryText: '각 구간을 비교하면 월-화는 1, 화-수는 4, 수-목은 1만큼 변해요. 화-수가 가장 커요.',
    retry: { questionTitle: '기온이 가장 많이 내려간 구간은?', question: '내려가는 선분을 찾아봐요.', hint: '수요일 7도에서 목요일 6도로 내려가요.', visual: 'line-graph', graphId: 'weekdayTemperatures', skill: 'graph_change', choices: ['월-화', '화-수', '수-목'], answer: '수-목', correctText: '맞아요! 수요일에서 목요일로 1도 내려갔어요.', retryText: '수요일 7도에서 목요일 6도로 1도 내려가요.' },
  },
  {
    unitId: 'line_graphs',
    title: '꺾은선그래프 그리기',
    questionTitle: '그래프의 점을 어떤 순서로 이어야 할까요?',
    question: '시간이 흐르는 순서대로 자료를 연결해요.',
    hint: '힌트: 가로축의 왼쪽에서 오른쪽 순서로 점을 이어요.',
    visual: 'line-graph',
    graphId: 'hourlyCounts',
    skill: 'graph_draw',
    choices: ['시간 순서대로 이웃한 점 연결', '가장 높은 점만 연결', '점 대신 막대 그리기'],
    answer: '시간 순서대로 이웃한 점 연결',
    correctText: '맞아요! 시간 순서대로 이웃한 점을 선분으로 이어 변화 모습을 나타내요.',
    retryText: '꺾은선그래프는 시간이나 순서에 따른 변화를 보므로 가로축 순서대로 이웃한 점을 이어요.',
  },
  {
    unitId: 'line_graphs',
    title: '그래프의 눈금 정하기',
    questionTitle: '자료의 값이 0에서 20까지라면 세로 눈금은 어떻게 정할까요?',
    question: '모든 값을 표시할 수 있는 알맞은 눈금 간격을 골라봐요.',
    hint: '힌트: 세로축의 눈금은 가장 큰 값까지 나타낼 수 있어야 해요.',
    visual: 'line-graph',
    graphId: 'scale20',
    skill: 'graph_scale',
    choices: ['0부터 20까지 2씩', '0부터 10까지만', '눈금 없이 점만'],
    answer: '0부터 20까지 2씩',
    correctText: '맞아요! 0부터 20까지 2씩 표시하면 모든 자료 값을 읽고 나타낼 수 있어요.',
    retryText: '가장 큰 값 20을 포함해야 하고, 자료 사이의 차이도 알아볼 수 있도록 일정한 간격으로 눈금을 만들어요.',
    retry: { questionTitle: '자료의 값이 0에서 12까지라면 어떤 눈금이 알맞을까요?', question: '가장 큰 값까지 일정한 간격으로 나타내 봐요.', hint: '세로축이 12까지 도달하고 읽기 쉬운 간격인지 확인해요.', visual: 'line-graph', graphId: 'scale12', skill: 'graph_scale', choices: ['0부터 12까지 2씩', '0부터 8까지만', '눈금 간격을 매번 다르게'], answer: '0부터 12까지 2씩', correctText: '맞아요! 0부터 12까지 같은 간격으로 표시하면 모든 자료 값을 나타낼 수 있어요.', retryText: '모든 값을 담고 눈금 간격을 일정하게 정하는 것이 중요해요.' },
  },
  {
    unitId: 'polygons',
    title: '다각형 알아보기',
    questionTitle: '곧은 선분으로 둘러싸인 닫힌 도형은?',
    question: '끝이 서로 이어져 닫혀 있는지 살펴봐요.',
    hint: '힌트: 곡선이 아니라 선분으로 둘러싸여 있어야 해요.',
    visual: 'polygon',
    polygonKind: 'pentagon',
    skill: 'polygon_definition',
    choices: ['다각형', '원', '열린 꺾은선'],
    answer: '다각형',
    correctText: '맞아요! 여러 개의 선분으로 둘러싸인 닫힌 도형을 다각형이라고 해요.',
    retryText: '다각형은 곧은 선분으로만 둘러싸여 있고, 선들이 이어져 닫혀 있어요.',
    retry: { questionTitle: '변이 6개인 다각형은 무엇일까요?', question: '변의 수를 세고 이름을 골라봐요.', hint: '다섯 개는 오각형, 여섯 개는 육각형이에요.', visual: 'polygon', polygonKind: 'hexagon', skill: 'polygon_definition', choices: ['오각형', '육각형', '칠각형'], answer: '육각형', correctText: '맞아요! 변이 6개인 다각형은 육각형이에요.', retryText: '다각형의 이름은 변의 수로 정해요. 변이 여섯 개이므로 육각형이에요.' },
  },
  {
    unitId: 'polygons',
    title: '정다각형',
    questionTitle: '정다각형이 되려면 어떤 조건이 필요할까요?',
    question: '변의 길이와 각의 크기를 함께 살펴봐요.',
    hint: '힌트: ‘정’다각형은 변과 각이 모두 고르게 같아요.',
    visual: 'polygon',
    polygonKind: 'regular-hexagon',
    skill: 'polygon_regular',
    choices: ['변의 길이와 각의 크기가 모두 같아요', '변의 개수가 다 달라요', '한 변만 길이가 같아요'],
    answer: '변의 길이와 각의 크기가 모두 같아요',
    correctText: '맞아요! 모든 변의 길이와 모든 각의 크기가 같은 다각형이 정다각형이에요.',
    retryText: '정다각형은 변의 길이도 같고 각의 크기도 모두 같아야 해요.',
    retry: { questionTitle: '정오각형은 어떤 도형일까요?', question: '다섯 변과 다섯 각을 살펴봐요.', hint: '정다각형은 모든 변과 각이 같아요.', visual: 'polygon', polygonKind: 'regular-pentagon', skill: 'polygon_regular', choices: ['모든 변과 각이 같은 오각형', '변이 다섯 개인 아무 도형', '모든 변만 같은 사각형'], answer: '모든 변과 각이 같은 오각형', correctText: '맞아요! 정오각형은 다섯 변의 길이와 다섯 각의 크기가 모두 같아요.', retryText: '‘정’다각형은 변뿐 아니라 각의 크기도 모두 같아야 해요.' },
  },
  {
    unitId: 'polygons',
    title: '대각선',
    questionTitle: '사각형의 대각선은 몇 개일까요?',
    question: '서로 이웃하지 않은 꼭짓점을 이어봐요.',
    hint: '힌트: 한 꼭짓점에서 맞은편 꼭짓점으로 선을 그어요.',
    visual: 'polygon',
    polygonKind: 'quadrilateral-diagonals',
    skill: 'polygon_diagonal',
    choices: ['1개', '2개', '4개'],
    answer: '2개',
    correctText: '맞아요! 사각형은 서로 이웃하지 않은 꼭짓점 쌍이 두 개라 대각선이 2개예요.',
    retryText: '네 꼭짓점 중 이웃하지 않은 꼭짓점 쌍을 연결하면 두 대각선이 생겨요.',
    retry: { questionTitle: '오각형에는 대각선이 몇 개 있을까요?', question: '서로 이웃하지 않은 꼭짓점을 연결해 세어봐요.', hint: '대각선은 변이 아니라 마주 보거나 떨어진 꼭짓점을 이어요.', visual: 'polygon', polygonKind: 'pentagon-diagonals', skill: 'polygon_diagonal', choices: ['3개', '5개', '10개'], answer: '5개', correctText: '맞아요! 오각형에는 대각선이 5개 있어요.', retryText: '오각형에서 서로 이웃하지 않은 꼭짓점 쌍을 모두 이어 중복 없이 세면 5개예요.' },
  },
  {
    unitId: 'polygons',
    title: '다각형으로 모양 만들기',
    questionTitle: '다각형 조각으로 빈틈없이 채우려면?',
    question: '모서리와 변이 서로 맞닿게 놓아봐요.',
    hint: '힌트: 조각 사이에 빈틈이나 겹치는 부분이 없는지 살펴봐요.',
    visual: 'polygon-tiling',
    skill: 'polygon_composition',
    choices: ['빈틈과 겹침 없이 이어 붙여요', '도형을 겹쳐 쌓아요', '곡선을 사이에 넣어요'],
    answer: '빈틈과 겹침 없이 이어 붙여요',
    correctText: '맞아요! 다각형 조각의 변을 맞대어 빈틈과 겹침 없이 모양을 만들어요.',
    retryText: '모양을 채울 때는 조각 사이에 빈틈이 남거나 서로 겹치지 않게 변을 맞춰요.',
    retry: { questionTitle: '모양 조각으로 바닥을 채울 때 무엇을 확인할까요?', question: '조각들이 서로 어떻게 놓였는지 살펴봐요.', hint: '변이 맞닿고 빈 공간이 남지 않아야 해요.', visual: 'polygon-tiling', skill: 'polygon_composition', choices: ['빈틈과 겹침이 없는지', '색이 모두 같은지', '도형이 모두 같은 방향인지'], answer: '빈틈과 겹침이 없는지', correctText: '맞아요! 모양을 채울 때는 빈틈과 겹침이 없는지 확인해요.', retryText: '조각의 색이나 방향보다 변이 잘 맞닿아 빈 공간을 채우는지가 중요해요.' },
  },
];
const dailyMissionsByGrade = { 3: dailyMissions3, 4: dailyMissions4, 5: dailyMissions5, 6: dailyMissions6 };
let dailyMissions = dailyMissions4;
const supplementalBattleQuestions4 = {
  fractions: [
    { title: '3/8 + 2/8은 얼마일까요?', prompt: '같은 크기의 조각을 더해요.', skill: 'fraction_add', choices: ['5/8', '5/16', '1/8'], answer: '5/8' },
    { title: '7/10 - 3/10은 얼마일까요?', prompt: '분모가 같은 분수끼리 빼요.', skill: 'fraction_subtract', choices: ['4/10', '4/7', '10/10'], answer: '4/10' },
    { title: '2와 3/9 + 1과 2/9는 얼마일까요?', prompt: '자연수끼리, 분수끼리 더해요.', skill: 'fraction_add', choices: ['3과 5/9', '3과 5/18', '4과 5/9'], answer: '3과 5/9' },
    { title: '5/6 - 1/6은 얼마일까요?', prompt: '같은 크기의 조각 1개를 덜어내요.', skill: 'fraction_subtract', choices: ['4/6', '4/5', '6/6'], answer: '4/6' },
  ],
  triangles: [
    { title: '두 변만 길이가 같고 나머지 한 변은 다른 삼각형은?', prompt: '변의 길이 표시를 떠올려 봐요.', skill: 'triangle_sides', choices: ['이등변삼각형', '둔각삼각형', '직각삼각형'], answer: '이등변삼각형' },
    { title: '한 각이 120도인 삼각형은?', prompt: '120도는 직각보다 큰 각이에요.', skill: 'triangle_angles', choices: ['둔각삼각형', '예각삼각형', '직각삼각형'], answer: '둔각삼각형' },
    { title: '한 각이 90도인 삼각형은?', prompt: '직각이 있는지 살펴봐요.', skill: 'triangle_angles', choices: ['직각삼각형', '예각삼각형', '둔각삼각형'], answer: '직각삼각형' },
    { title: '세 각이 모두 60도인 삼각형은?', prompt: '세 변의 길이도 모두 같아요.', skill: 'triangle_properties', choices: ['정삼각형', '직각삼각형', '둔각삼각형'], answer: '정삼각형' },
  ],
  decimals: [
    { title: '2.4 + 1.8은 얼마일까요?', prompt: '소수점을 맞추어 더해요.', skill: 'decimal_regrouping', choices: ['4.2', '3.12', '4.12'], answer: '4.2' },
    { title: '7.02 - 3.6은 얼마일까요?', prompt: '3.6을 3.60으로 맞춰 계산해요.', skill: 'decimal_alignment', choices: ['3.42', '4.58', '3.62'], answer: '3.42' },
    { title: '0.406은 0.001이 몇 개일까요?', prompt: '소수 셋째 자리까지 살펴봐요.', skill: 'decimal_place_value', choices: ['46개', '406개', '4.06개'], answer: '406개' },
    { title: '5.3 + 0.09는 얼마일까요?', prompt: '5.3을 5.30으로 바꾸어 더해요.', skill: 'decimal_alignment', choices: ['5.39', '5.12', '5.93'], answer: '5.39' },
  ],
  quadrilaterals: [
    { title: '직사각형의 네 각은 모두 어떤 각일까요?', prompt: '직사각형의 네 모서리를 살펴봐요.', skill: 'quad_relations', choices: ['직각', '둔각', '예각'], answer: '직각' },
    { title: '평행사변형의 마주 보는 변은 몇 쌍이 평행할까요?', prompt: '마주 보는 변 두 쌍을 확인해요.', skill: 'quad_parallelogram', choices: ['두 쌍', '한 쌍', '없어요'], answer: '두 쌍' },
    { title: '마주 보는 변 한 쌍만 평행한 사각형은?', prompt: '평행한 변이 한 쌍만 있는지 찾아요.', skill: 'quad_trapezoid', choices: ['사다리꼴', '마름모', '직사각형'], answer: '사다리꼴' },
    { title: '정사각형은 어떤 두 사각형의 성질을 모두 가질까요?', prompt: '네 변과 네 각을 함께 살펴봐요.', skill: 'quad_relations', choices: ['직사각형과 마름모', '사다리꼴과 삼각형', '평행사변형만'], answer: '직사각형과 마름모' },
  ],
  polygons: [
    { title: '변이 6개인 다각형은?', prompt: '변의 수에 맞는 이름을 골라요.', skill: 'polygon_definition', choices: ['육각형', '오각형', '칠각형'], answer: '육각형' },
    { title: '오각형의 변은 몇 개일까요?', prompt: '도형의 변을 하나씩 세어봐요.', skill: 'polygon_definition', choices: ['5개', '4개', '6개'], answer: '5개' },
    { title: '사각형의 대각선은 모두 몇 개일까요?', prompt: '서로 이웃하지 않은 꼭짓점을 모두 이어요.', skill: 'polygon_diagonal', choices: ['2개', '1개', '4개'], answer: '2개' },
    { title: '사각형의 한 꼭짓점에서 그을 수 있는 대각선은 몇 개일까요?', prompt: '이웃한 두 꼭짓점은 변으로 이어져 있어요.', skill: 'polygon_diagonal', choices: ['1개', '2개', '3개'], answer: '1개' },
  ],
};
const supplementalBattleQuestionsByGrade = { 3: battleQuestions3, 4: supplementalBattleQuestions4, 5: battleQuestions5, 6: battleQuestions6 };
let supplementalBattleQuestions = supplementalBattleQuestions4;
let missionProgress = { lesson_index: 0, completed_at: null, completed_correctly: null };
let missionAnswerPending = false;
let missionFeedbackState = null;
let classMissionsPerSession = 1;
let teacherMissionsPerSession = 1;
let teacherPacingAvailable = true;
let teacherPacingWarning = '';
let missionPacingNoticeShown = false;

async function getSupabaseClient() {
  if (supabaseClient) return supabaseClient;
  const response = await fetch('/api/supabase-config', { cache: 'no-store' });
  const config = await response.json().catch(() => ({}));
  if (!response.ok || !config.url || !config.anonKey) throw new Error(config.error || 'Supabase 설정이 필요해요.');
  supabaseClient = createClient(config.url, config.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
  return supabaseClient;
}

async function signInAndLoadProfile(role, grade, classNumber, studentNumber, displayName, password, email) {
  const client = await getSupabaseClient();
  const response = await fetch('/api/supabase-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role, grade, classNumber, studentNumber, displayName, password, email }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || '로그인 정보가 맞지 않아요.');
  const { error } = await client.auth.setSession({ access_token: result.access_token, refresh_token: result.refresh_token });
  if (error || !result.profile) throw new Error('로그인 세션을 시작하지 못했어요.');
  currentAuthUser = { id: result.profile.id };
  return result.profile;
}

async function createStudentAccount(grade, classNumber, studentNumber, displayName, password, activationCode) {
  const client = await getSupabaseClient();
  const response = await fetch('/api/student/first-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grade, classNumber, studentNumber, displayName, password, activationCode }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || '첫 로그인 정보를 확인해 주세요.');
  const { error } = await client.auth.setSession({ access_token: result.access_token, refresh_token: result.refresh_token });
  if (error || !result.profile) throw new Error('계정을 만들었지만 로그인하지 못했어요. 다시 로그인해 주세요.');
  currentAuthUser = { id: result.profile.id };
  return result.profile;
}

function getSkillStatus(progress) {
  if (!progress || progress.attempts < 2) return 'unknown';
  const accuracy = progress.correct / progress.attempts;
  if (progress.attempts >= 4 && accuracy >= 0.8 && progress.consecutive_correct >= 2
    && progress.hint_count <= Math.floor(progress.attempts / 2)) return 'secure';
  if (accuracy < 0.5) return 'support';
  return 'practice';
}

function renderLearningProfile() {
  const list = document.querySelector('#learning-skill-list');
  if (!list) return;
  list.replaceChildren();
  const unit = curriculumUnitById[activeStudyUnitId] || curriculumUnits[0];
  const progressRows = unit.skills;
  progressRows.forEach(({ id: skill, label }) => {
    const progress = studentSkillProgress[skill];
    const status = getSkillStatus(progress);
    const chip = document.createElement('span');
    chip.className = `learning-skill-chip ${status}`;
    const name = document.createElement('strong');
    name.textContent = label;
    const state = document.createElement('small');
    state.textContent = status === 'secure' ? '익숙해요' : status === 'support' ? '그림으로 더 연습해요' : status === 'practice' ? '연습 중' : '함께 알아가는 중';
    chip.append(name, state);
    list.append(chip);
  });
  const unknown = progressRows.some(({ id }) => getSkillStatus(studentSkillProgress[id]) === 'unknown');
  const support = progressRows.some(({ id }) => getSkillStatus(studentSkillProgress[id]) === 'support');
  document.querySelector('#learning-mode-summary').textContent = support
    ? '어려웠던 개념은 그림과 한 단계씩 보는 설명을 먼저 보여줄게요. 편해지면 설명을 간결하게 바꿔요.'
    : unknown
      ? '아직 함께 알아가는 중이에요. 기록이 적은 개념은 그림과 세로셈부터 보여줄게요.'
      : '익숙한 개념은 간결하게, 새롭거나 헷갈리는 개념은 그림과 세로셈으로 설명할게요.';
}

function tutorModeGuide(unit, mode) {
  const guides = {
    concept: {
      label: '쉽게 설명 모드', symbol: '개념', title: `${unit.title}을 차근차근 살펴봐요`,
      description: '콩이가 쉬운 말과 단원에 맞는 그림으로 먼저 설명해요.',
      steps: ['쉬운 말', '예시', '그림'],
      welcome: `${unit.title}을 함께 살펴봐요. 쉬운 말과 그림으로 먼저 설명할게요. 아래 방법 카드에서 안내 순서를 보고, 궁금한 부분을 골라 말해줘요.`,
      prompts: unit.prompts,
      placeholder: `${unit.title}에서 궁금한 점을 적어봐요...`,
    },
    stuck: {
      label: '힌트 하나 모드', symbol: '힌트', title: '정답 대신 다음 한 걸음만',
      description: '막힌 곳을 말하면, 바로 풀 수 있는 작은 힌트 하나를 줘요.',
      steps: ['막힌 곳 찾기', '힌트 하나', '다시 생각'],
      welcome: `${unit.title}에서 막힌 부분을 알려줘요. 정답은 말하지 않고, 아래 방법 카드처럼 막힌 곳을 찾는 작은 힌트 하나를 같이 볼게요.`,
      prompts: ['어디부터 시작하면 좋을까요?', '한 단계 힌트만 주세요.', '그림에서 먼저 볼 곳을 알려주세요.'],
      placeholder: '막힌 곳이나 궁금한 한 부분을 적어봐요...',
    },
    check: {
      label: '내 풀이 확인 모드', symbol: '확인', title: '내 풀이와 답을 함께 점검해요',
      description: '풀이 과정과 답을 적으면 맞는 부분과 다시 볼 부분을 확인해요.',
      steps: ['내 풀이 적기', '답 확인', '이유 찾기'],
      welcome: `풀이를 적어주면 ${unit.title}에서 생각한 순서와 답을 함께 확인할게요. 아래 확인 순서처럼 내가 한 풀이부터 보여줘요. 다 풀지 못했어도 괜찮아요.`,
      prompts: ['내 풀이가 맞는지 확인해 주세요.', '이 계산의 답과 이유를 확인해 주세요.', '여기까지 풀었는데 다음이 맞나요?'],
      placeholder: '계산식과 내가 생각한 답을 함께 적어봐요...',
    },
    teach: {
      label: '학생이 선생님 모드', symbol: '내가 설명', title: '이번엔 네가 콩이의 선생님이에요',
      description: '먼저 네 방법을 설명하면 콩이가 잘 이해했는지 질문해요.',
      steps: ['네가 설명', '콩이가 질문', '함께 다듬기'],
      welcome: `${unit.title}을 네가 콩이에게 가르쳐 주세요. 위의 가르치기 순서처럼 네가 생각한 방법을 먼저 설명하면, 콩이가 잘 이해했는지 질문하고 함께 빠진 생각을 찾아볼게요.`,
      prompts: ['내가 이 개념을 이해한 방법은...', '내 풀이 순서를 콩이에게 설명해 볼게.', '먼저 내가 생각한 것을 말해볼게.'],
      placeholder: '콩이에게 네 풀이와 생각을 설명해 봐요...',
    },
  };
  return guides[mode] || guides.concept;
}

function renderStudyQuickPrompts(unit, mode = activeMode) {
  elements.quickPrompts.replaceChildren();
  const intro = document.createElement('span');
  intro.textContent = mode === 'teach' ? '문장 시작을 골라 설명해도 좋아요' : mode === 'stuck' ? '막힌 곳을 찾기 어려우면 하나 골라요' : mode === 'check' ? '풀이를 어떻게 보여줄지 골라요' : `${unit.title}에서 하나 골라 시작해요`;
  elements.quickPrompts.append(intro);
  tutorModeGuide(unit, mode).prompts.forEach((prompt) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.prompt = prompt;
    button.dataset.promptMode = mode;
    button.innerHTML = formatFractionText(prompt);
    const arrow = document.createElement('span');
    arrow.textContent = '→';
    button.append(arrow);
    elements.quickPrompts.append(button);
  });
}

function renderTutorModeExperience({ announce = false, previousMode = activeMode } = {}) {
  const unit = curriculumUnitById[activeStudyUnitId] || curriculumUnits[0];
  const guide = tutorModeGuide(unit, activeMode);
  const guidePanel = document.querySelector('#tutor-mode-brief');
  guidePanel.dataset.mode = activeMode;
  document.querySelector('#tutor-mode-symbol').textContent = guide.symbol;
  document.querySelector('#tutor-mode-label').textContent = guide.label;
  document.querySelector('#tutor-mode-title').textContent = guide.title;
  document.querySelector('#tutor-mode-description').textContent = guide.description;
  const steps = document.querySelector('#tutor-mode-steps');
  steps.replaceChildren();
  guide.steps.forEach((text, index) => {
    const step = document.createElement('span');
    const number = document.createElement('b');
    number.textContent = String(index + 1);
    const label = document.createElement('strong');
    label.textContent = text;
    step.append(number, label);
    steps.append(step);
  });
  if (!conversation.length) document.querySelector('#tutor-welcome').textContent = guide.welcome;
  elements.input.placeholder = guide.placeholder;
  renderStudyQuickPrompts(unit, activeMode);

  const teaching = activeMode === 'teach';
  document.querySelector('#modes').hidden = teaching;
  const teachCard = document.querySelector('#teach-entry-card');
  teachCard.classList.toggle('is-active', teaching);
  teachCard.querySelector('#teach-mode-steps').hidden = !teaching;
  const teachButton = teachCard.querySelector('#teach-mode-toggle');
  teachButton.textContent = teaching ? '설명 모드 나가기' : '콩이에게 설명하기';
  teachButton.setAttribute('aria-pressed', String(teaching));
  renderTutorModeContextCard(guide);

  if (announce && previousMode !== activeMode && conversation.length) {
    const notice = document.createElement('div');
    notice.className = 'mode-switch-note';
    notice.textContent = `도움 방식을 ‘${guide.label}’로 바꿨어요. 다음 질문부터 이 방식으로 함께할게요.`;
    elements.messages.insertBefore(notice, elements.quickPrompts);
    elements.messages.scrollTop = elements.messages.scrollHeight;
  }
}

function renderTutorModeContextCard(guide) {
  let card = elements.messages.querySelector('.mode-context-card');
  if (!card) {
    card = document.createElement('article');
    card.className = 'mode-context-card';
    card.setAttribute('aria-live', 'polite');
  }
  card.dataset.mode = activeMode;
  card.replaceChildren();
  const marker = document.createElement('span');
  marker.className = 'mode-context-marker';
  marker.textContent = guide.symbol;
  const copy = document.createElement('div');
  copy.className = 'mode-context-copy';
  const label = document.createElement('small');
  label.textContent = `${guide.label} · 이번 질문은 이렇게 살펴봐요`;
  const title = document.createElement('strong');
  title.textContent = guide.title;
  const description = document.createElement('p');
  description.textContent = guide.description;
  const steps = document.createElement('div');
  steps.className = 'mode-context-steps';
  guide.steps.forEach((text, index) => {
    const step = document.createElement('span');
    step.textContent = `${index + 1}. ${text}`;
    steps.append(step);
  });
  copy.append(label, title, description, steps);
  card.append(marker, copy);
  elements.messages.append(elements.quickPrompts);
  elements.messages.insertBefore(card, elements.quickPrompts);
}

function setActiveStudyUnit(unitId, resetConversationOnChange = false) {
  const unit = curriculumUnitById[unitId];
  if (!unit) return;
  const changed = activeStudyUnitId !== unit.id;
  activeStudyUnitId = unit.id;
  const select = document.querySelector('#study-unit-select');
  if (select) select.value = unit.id;
  const battleSelect = document.querySelector('#battle-unit-select');
  if (battleSelect) battleSelect.value = unit.id;
  const fractionTools = document.querySelector('.fraction-question-tools');
  if (fractionTools) fractionTools.hidden = unit.id !== 'fractions';
  if (unit.id !== 'fractions') {
    resetQuestionFractionBuilder();
  }
  document.querySelector('#tutor-unit-label').textContent = `${unit.title} 공부 친구`;
  document.querySelector('#battle-unit-label').textContent = `${unit.title} · 대결 결과에 따라 난이도 조절`;
  renderLearningProfile();
  if (changed && resetConversationOnChange && conversation.length) {
    activeMode = 'concept';
    resetChat();
  }
  renderTutorModeExperience();
}

let studyUnitsInitialized = false;

function populateStudyUnitSelectors() {
  const selects = [document.querySelector('#study-unit-select'), document.querySelector('#battle-unit-select')];
  selects.forEach((select) => {
    select.replaceChildren();
    curriculumUnits.forEach((unit) => {
      const option = document.createElement('option');
      option.value = unit.id;
      option.textContent = unit.title;
      select.append(option);
    });
    select.value = activeStudyUnitId;
  });
}

function initializeStudyUnits() {
  const selects = [document.querySelector('#study-unit-select'), document.querySelector('#battle-unit-select')];
  populateStudyUnitSelectors();
  selects.forEach((select) => {
    select.addEventListener('change', () => setActiveStudyUnit(select.value, true));
  });
  studyUnitsInitialized = true;
  setActiveStudyUnit(activeStudyUnitId);
}

function setCurriculumGrade(grade) {
  const selectedGrade = Number(grade);
  const selectedCurriculum = curriculaByGrade[selectedGrade];
  if (!selectedCurriculum) return false;
  const changed = selectedGrade !== activeGrade;
  activeGrade = selectedGrade;
  curriculumUnits = selectedCurriculum.units;
  curriculumUnitById = Object.fromEntries(curriculumUnits.map((unit) => [unit.id, unit]));
  learningSkillLabels = Object.fromEntries(curriculumUnits.flatMap((unit) => unit.skills.map((skill) => [skill.id, skill.label])));
  dailyMissions = dailyMissionsByGrade[activeGrade];
  supplementalBattleQuestions = supplementalBattleQuestionsByGrade[activeGrade];
  if (changed) {
    activeStudyUnitId = dailyMissions[0].unitId;
    studentSkillProgress = {};
    missionProgress = { lesson_index: 0, completed_at: null, completed_correctly: null };
    classMissionsPerSession = 1;
    missionAnswerPending = false;
    missionFeedbackState = null;
    geometryState.mode = geometryPlans[activeGrade].defaultMode;
    geometryState.tool = geometryPlans[activeGrade].defaultTool;
    geometryState.solid = activeGrade === 5 ? 'prism' : 'cylinder';
    geometryState.solidNet = false;
    geometryState.blockView = 'iso';
    machineLabOpen = false;
    machineLabAccessChecked = false;
    machineLabAccessError = '';
    machineLoadedShare = '';
    machineShareImportValid = false;
    machine.title = '첫 번째 경사로';
    machine.parts = createSampleMachineParts();
    machine.selectedId = null;
    machine.nextId = 2;
    machine.tool = 'ramp';
    resetMachineBall();
    machine.result = '미리 놓인 경사로에서 구슬을 굴려 보고, 부품을 더해 길을 바꿔 보세요.';
  }
  if (import.meta.env.DEV) validateActiveQuestionBank();
  studentGradeSelect.value = String(activeGrade);
  teacherGradeSelect.value = String(activeGrade);
  document.title = `콩셈콩셈 | ${activeGrade}학년 2학기 수학`;
  const courseLabel = `${activeGrade}학년 2학기`;
  ['#portal-grade-badge', '#student-login-grade-badge', '#student-app-grade-badge', '#teacher-dashboard-grade-badge'].forEach((selector) => {
    const badge = document.querySelector(selector);
    if (badge) badge.textContent = courseLabel;
  });
  document.querySelector('#portal-course-label').textContent = `${courseLabel} 수학`;
  const togetherTitle = document.querySelector('#together-grade-title');
  if (togetherTitle) togetherTitle.textContent = `${activeGrade}학년 2학기 수학,`;
  const teacherEmail = document.querySelector('#teacher-email');
  if (teacherEmail) teacherEmail.placeholder = `teacher-${activeGrade}-1@kongsem.invalid`;
  const teacherEmailHint = document.querySelector('#teacher-email-hint');
  if (teacherEmailHint) teacherEmailHint.textContent = `예: ${activeGrade}학년 1반은 teacher-${activeGrade}-1@kongsem.invalid`;
  if (studyUnitsInitialized && changed) {
    populateStudyUnitSelectors();
    setActiveStudyUnit(activeStudyUnitId, true);
    renderMission();
    updateBattleProgress();
  }
  renderGeometryLab();
  return true;
}

function geometryPointList(count, cx = 160, cy = 126, radius = 82, rotation = -90) {
  return Array.from({ length: count }, (_, index) => {
    const angle = (rotation + index * 360 / count) * Math.PI / 180;
    return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
  });
}

function geometryPolygonSvg(count, rotation = 0, showLabels = true) {
  const points = geometryPointList(count, 160, 126, 82, -90 + rotation);
  const pointString = points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
  const dots = points.map((point, index) => `<circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="5" fill="#fff" stroke="#425b89" stroke-width="2"/><text x="${(point.x * 1.12 + 160 * -.12).toFixed(1)}" y="${(point.y * 1.12 + 126 * -.12 + 4).toFixed(1)}" text-anchor="middle" class="geometry-vertex-label">${showLabels ? index + 1 : ''}</text>`).join('');
  return `<svg class="geometry-svg" viewBox="0 0 320 252" role="img" aria-label="변이 ${count}개인 정다각형"><polygon points="${pointString}" fill="#e6efd9" stroke="#536b99" stroke-width="4" stroke-linejoin="round"/>${dots}</svg>`;
}

function geometryCircleSvg(radius, showMeasurements = true) {
  const drawingRadius = radius * 10;
  const measurements = showMeasurements
    ? `<path d="M${160 - drawingRadius} 126H${160 + drawingRadius}" class="geometry-diameter-line"/><path d="M160 126L${160 + drawingRadius} 126" class="geometry-radius-line"/><circle cx="160" cy="126" r="5" class="geometry-center-dot"/><text x="166" y="145" class="geometry-svg-label">중심</text><text x="${160 + drawingRadius / 2}" y="119" text-anchor="middle" class="geometry-svg-label">${radius}칸</text><text x="160" y="${139 + drawingRadius}" text-anchor="middle" class="geometry-svg-label">가로지르는 길이 ${radius * 2}칸</text>`
    : '<circle cx="160" cy="126" r="5" class="geometry-center-dot"/>';
  return `<svg class="geometry-svg" viewBox="0 0 320 252" role="img" aria-label="원의 중심에서 원까지 ${radius}칸, 원을 가로지르는 길이 ${radius * 2}칸인 그림"><circle cx="160" cy="126" r="${drawingRadius}" fill="#f6e9c8" stroke="#536b99" stroke-width="4"/>${measurements}</svg>`;
}

function geometryLinesSvg(kind) {
  const line = kind === 'line';
  const ray = kind === 'ray';
  const start = line ? 42 : 78;
  const end = line ? 278 : 242;
  const leftArrow = line ? '<path d="M52 119L42 126L52 133" class="geometry-arrow"/>' : '';
  const rightArrow = line || ray ? '<path d="M268 119L278 126L268 133" class="geometry-arrow"/>' : '';
  const endpoints = line ? '' : `<circle cx="78" cy="126" r="6" class="geometry-vertex-dot"/><text x="78" y="158" text-anchor="middle" class="geometry-svg-label">시작점</text>${ray ? '' : '<circle cx="242" cy="126" r="6" class="geometry-vertex-dot"/><text x="242" y="158" text-anchor="middle" class="geometry-svg-label">끝점</text>'}`;
  const label = line ? '직선' : ray ? '반직선' : '선분';
  return `<svg class="geometry-svg" viewBox="0 0 320 252" role="img" aria-label="${label} 그림"><path d="M${start} 126H${end}" class="geometry-shape-line"/>${leftArrow}${rightArrow}${endpoints}</svg>`;
}

function geometryAngleSvg(kind) {
  const angle = { acute: 45, right: 90, obtuse: 135, straight: 180 }[kind];
  const point = (degrees, radius) => ({ x: 160 + Math.cos(-degrees * Math.PI / 180) * radius, y: 184 + Math.sin(-degrees * Math.PI / 180) * radius });
  const first = point(0, 105);
  const second = point(angle, 105);
  const arcStart = point(0, 35);
  const arcEnd = point(angle, 35);
  const arc = angle === 180 ? `M${arcStart.x} ${arcStart.y}A35 35 0 0 0 ${arcEnd.x} ${arcEnd.y}` : `M${arcStart.x} ${arcStart.y}A35 35 0 0 0 ${arcEnd.x} ${arcEnd.y}`;
  const rightMarker = kind === 'right' ? '<path d="M160 166H178V184" class="geometry-right-angle-mark"/>' : '';
  const label = { acute: '예각', right: '직각', obtuse: '둔각', straight: '평각' }[kind];
  return `<svg class="geometry-svg" viewBox="0 0 320 252" role="img" aria-label="${label}을 이루는 두 변"><path d="M160 184L${first.x} ${first.y}M160 184L${second.x} ${second.y}" class="geometry-shape-line"/><path d="${arc}" class="geometry-angle-arc"/>${rightMarker}<circle cx="160" cy="184" r="5" class="geometry-vertex-dot"/><text x="160" y="226" text-anchor="middle" class="geometry-svg-label">꼭짓점</text></svg>`;
}

function geometryTriangleSvg(kind) {
  const specs = {
    right: { points: [[76, 198], [244, 198], [76, 54]], marks: '<path d="M76 178H96V198" class="geometry-right-angle-mark"/>', label: '직각삼각형', equal: '한 각이 직각' },
    equilateral: { points: [[160, 50], [76, 198], [244, 198]], marks: '<path d="M113 124L124 130M196 130L207 124M160 189V207" class="geometry-side-mark"/>', label: '정삼각형', equal: '세 변의 길이가 같아요' },
    isosceles: { points: [[160, 50], [76, 198], [244, 198]], marks: '<path d="M111 125L122 131M198 131L209 125" class="geometry-side-mark"/>', label: '이등변삼각형', equal: '두 변의 길이가 같아요' },
  }[kind];
  const pointString = specs.points.map(([x, y]) => `${x},${y}`).join(' ');
  return `<svg class="geometry-svg" viewBox="0 0 320 252" role="img" aria-label="${specs.label}, ${specs.equal}"><polygon points="${pointString}" fill="#e6efd9" stroke="#536b99" stroke-width="4" stroke-linejoin="round"/>${specs.marks}${specs.points.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4" class="geometry-vertex-dot"/>`).join('')}</svg>`;
}

function geometryQuadrilateralSvg(kind) {
  const specs = {
    square: { points: [[82, 48], [238, 48], [238, 204], [82, 204]], label: '정사각형', facts: [['변', '4개'], ['같은 길이', '네 변'], ['각', '모두 직각']] },
    rectangle: { points: [[56, 72], [264, 72], [264, 180], [56, 180]], label: '직사각형', facts: [['변', '4개'], ['같은 길이', '마주 보는 변'], ['각', '모두 직각']] },
    parallelogram: { points: [[100, 56], [264, 56], [220, 196], [56, 196]], label: '평행사변형', facts: [['변', '4개'], ['평행한 변', '두 쌍'], ['마주 보는 변', '길이가 같아요']] },
    trapezoid: { points: [[104, 58], [216, 58], [264, 198], [56, 198]], label: '사다리꼴', facts: [['변', '4개'], ['평행한 변', '한 쌍'], ['꼭짓점', '4개']] },
    rhombus: { points: [[160, 45], [258, 126], [160, 207], [62, 126]], label: '마름모', facts: [['변', '4개'], ['같은 길이', '네 변'], ['꼭짓점', '4개']] },
  }[kind];
  const points = specs.points.map(([x, y]) => `${x},${y}`).join(' ');
  const rightMarks = kind === 'square'
    ? '<path d="M82 66H100V48M220 48V66H238M238 186H220V204M100 204V186H82" class="geometry-right-angle-mark"/>'
    : kind === 'rectangle'
      ? '<path d="M56 90H74V72M246 72V90H264M264 162H246V180M74 180V162H56" class="geometry-right-angle-mark"/>'
      : '';
  const sideMarks = {
    square: '<path d="M155 48V58M238 126H228M155 204V194M82 126H92" class="geometry-side-mark"/>',
    rectangle: '<path d="M151 72V82M151 180V170" class="geometry-side-mark"/>',
    parallelogram: '<path d="M175 56V68M145 184V196M91 92L101 95M219 157L229 160" class="geometry-side-mark"/>',
    trapezoid: '<path d="M155 58V70M155 186V198" class="geometry-parallel-mark"/>',
    rhombus: '<path d="M155 82L165 94M204 121L214 131M155 158L165 170M106 121L116 131" class="geometry-side-mark"/>',
  }[kind];
  return `<svg class="geometry-svg" viewBox="0 0 320 252" role="img" aria-label="${specs.label}"><polygon points="${points}" fill="#e6efd9" stroke="#536b99" stroke-width="4" stroke-linejoin="round"/>${rightMarks}${sideMarks}${specs.points.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4" class="geometry-vertex-dot"/>`).join('')}</svg>`;
}

function geometryCongruenceSvg(shape) {
  const shapes = {
    triangle: '<polygon points="0,-55 -48,35 48,35"/>',
    square: '<rect x="-42" y="-42" width="84" height="84"/>',
    rectangle: '<rect x="-58" y="-34" width="116" height="68"/>',
  };
  const content = shapes[shape];
  return `<svg class="geometry-svg" viewBox="0 0 320 252" role="img" aria-label="같은 모양과 크기의 도형 두 개를 포개어 합동 확인"><g transform="translate(105 126)"><g class="geometry-congruence-first">${content}</g></g><g transform="translate(218 126) rotate(35)"><g class="geometry-congruence-second">${content}</g></g><text x="105" y="224" text-anchor="middle" class="geometry-svg-label">도형 1</text><text x="218" y="224" text-anchor="middle" class="geometry-svg-label">도형 2</text></svg>`;
}

function geometryEditablePoints(points, firstIndex = 0, xOffset = 0) {
  return points.map(([x, y], index) => `<circle cx="${x + xOffset}" cy="${y}" r="10" class="geometry-point-handle" data-geometry-point="${index + firstIndex}" tabindex="0" aria-label="점 ${index + 1}, 방향키로 움직이기"/>`).join('');
}

function geometryInteractiveSvg(tool) {
  const points = geometryState.drawings[tool] || [];
  const pointString = points.map(([x, y]) => `${x},${y}`).join(' ');
  const handles = geometryEditablePoints(points);
  let artwork = '';

  if (tool === 'lines' && points.length >= 2) {
    const [[x1, y1], [x2, y2]] = points;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const kind = geometryState.lineKind;
    const path = kind === 'line'
      ? `M${x1 - dx * 8} ${y1 - dy * 8}L${x2 + dx * 8} ${y2 + dy * 8}`
      : kind === 'ray' ? `M${x1} ${y1}L${x2 + dx * 8} ${y2 + dy * 8}` : `M${x1} ${y1}L${x2} ${y2}`;
    const arrows = kind === 'segment' ? '' : `<path d="M${x2 + dx * 6.8 - dy * .12} ${y2 + dy * 6.8 + dx * .12}L${x2 + dx * 8} ${y2 + dy * 8}L${x2 + dx * 6.8 + dy * .12} ${y2 + dy * 6.8 - dx * .12}" class="geometry-arrow"/>${kind === 'line' ? `<path d="M${x1 - dx * 6.8 - dy * .12} ${y1 - dy * 6.8 + dx * .12}L${x1 - dx * 8} ${y1 - dy * 8}L${x1 - dx * 6.8 + dy * .12} ${y1 - dy * 6.8 - dx * .12}" class="geometry-arrow"/>` : ''}`;
    artwork = `<path d="${path}" class="geometry-shape-line"/>${arrows}${kind === 'line' ? '' : `<circle cx="${x1}" cy="${y1}" r="4" class="geometry-vertex-dot"/>`}${handles}`;
  } else if (tool === 'angles' && points.length >= 3) {
    const [vertex, armOne, armTwo] = points;
    const angleOne = Math.atan2(armOne[1] - vertex[1], armOne[0] - vertex[0]);
    const angleTwo = Math.atan2(armTwo[1] - vertex[1], armTwo[0] - vertex[0]);
    const delta = Math.atan2(Math.sin(angleTwo - angleOne), Math.cos(angleTwo - angleOne));
    const degrees = Math.round(Math.abs(delta) * 180 / Math.PI);
    const radius = 28;
    const start = [vertex[0] + Math.cos(angleOne) * radius, vertex[1] + Math.sin(angleOne) * radius];
    const end = [vertex[0] + Math.cos(angleOne + delta) * radius, vertex[1] + Math.sin(angleOne + delta) * radius];
    const arc = `M${start[0]} ${start[1]}A${radius} ${radius} 0 0 ${delta > 0 ? 1 : 0} ${end[0]} ${end[1]}`;
    artwork = `<path d="M${armOne[0]} ${armOne[1]}L${vertex[0]} ${vertex[1]}L${armTwo[0]} ${armTwo[1]}" class="geometry-shape-line"/><path d="${arc}" class="geometry-angle-arc"/>${degrees === 90 ? `<path d="M${vertex[0] + Math.cos(angleOne) * 16} ${vertex[1] + Math.sin(angleOne) * 16}L${vertex[0] + Math.cos(angleOne) * 22 + Math.cos(angleOne + delta) * 6} ${vertex[1] + Math.sin(angleOne) * 22 + Math.sin(angleOne + delta) * 6}L${vertex[0] + Math.cos(angleOne + delta) * 16} ${vertex[1] + Math.sin(angleOne + delta) * 16}" class="geometry-right-angle-mark"/>` : ''}${handles}`;
  } else if (tool === 'angles' && points.length === 2) {
    artwork = `<path d="M${points[0][0]} ${points[0][1]}L${points[1][0]} ${points[1][1]}" class="geometry-shape-line"/>${handles}`;
  } else if (['triangles', 'quadrilaterals', 'polygon', 'symmetry'].includes(tool) && points.length >= 3) {
    const fill = tool === 'symmetry' ? '#dce9ce' : '#e6efd9';
    const axis = tool === 'symmetry' ? '<path d="M160 28V224" class="geometry-axis-line"/>' : '';
    const shape = geometryState.drawingComplete ? `<polygon points="${pointString}" fill="${fill}" class="geometry-editable-shape"/>` : `<polyline points="${pointString}" class="geometry-editable-line"/>`;
    const constrained = geometryState.constrainedShapes[tool];
    let marks = '';
    if (constrained?.kind === 'equilateral' || constrained?.kind === 'square') {
      marks = points.map((point, index) => {
        const next = points[(index + 1) % points.length];
        const dx = next[0] - point[0];
        const dy = next[1] - point[1];
        const length = Math.hypot(dx, dy) || 1;
        const mx = (point[0] + next[0]) / 2;
        const my = (point[1] + next[1]) / 2;
        const nx = -dy / length * 6;
        const ny = dx / length * 6;
        return `<path d="M${mx - nx} ${my - ny}L${mx + nx} ${my + ny}" class="geometry-side-mark"/>`;
      }).join('');
    }
    if (constrained?.kind === 'rightTriangle' || constrained?.kind === 'square') {
      const rightVertices = constrained.kind === 'rightTriangle' ? [0] : [0, 1, 2, 3];
      marks += rightVertices.map((index) => {
        const vertex = points[index];
        const before = points[(index - 1 + points.length) % points.length];
        const after = points[(index + 1) % points.length];
        const u = [before[0] - vertex[0], before[1] - vertex[1]];
        const v = [after[0] - vertex[0], after[1] - vertex[1]];
        const ul = Math.hypot(...u) || 1;
        const vl = Math.hypot(...v) || 1;
        const size = 11;
        return `<path d="M${vertex[0] + u[0] / ul * size} ${vertex[1] + u[1] / ul * size}L${vertex[0] + u[0] / ul * size + v[0] / vl * size} ${vertex[1] + u[1] / ul * size + v[1] / vl * size}L${vertex[0] + v[0] / vl * size} ${vertex[1] + v[1] / vl * size}" class="geometry-right-angle-mark"/>`;
      }).join('');
    }
    artwork = `${shape}${marks}${axis}${handles}`;
  } else if (tool === 'congruence' && points.length >= 3) {
    const shifted = points.map(([x, y]) => `${x + 145},${y}`).join(' ');
    const shape = geometryState.drawingComplete ? `<polygon points="${pointString}" class="geometry-congruence-first"/><polygon points="${shifted}" class="geometry-congruence-second"/>` : `<polyline points="${pointString}" class="geometry-congruence-first geometry-editable-line"/><polyline points="${shifted}" class="geometry-congruence-second geometry-editable-line"/>`;
    artwork = `${shape}${handles}`;
  } else if (['circle', 'circleArea'].includes(tool) && points.length >= 2) {
    const [[cx, cy], [rx, ry]] = points;
    const radius = Math.hypot(rx - cx, ry - cy);
    artwork = `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="#f6e9c8" class="geometry-editable-circle"/><path d="M${cx} ${cy}L${rx} ${ry}" class="geometry-radius-line"/><path d="M${cx - (rx - cx)} ${cy - (ry - cy)}L${rx} ${ry}" class="geometry-diameter-line"/><circle cx="${cx}" cy="${cy}" r="4" class="geometry-center-dot"/>${handles}`;
  }

  if (points.length && !handles) artwork += geometryEditablePoints(points);
  if (points.length && !(tool === 'lines' && points.length >= 2) && !(tool === 'angles' && points.length >= 3) && !(['triangles', 'quadrilaterals', 'polygon', 'symmetry', 'congruence'].includes(tool) && points.length >= 3) && !(['circle', 'circleArea'].includes(tool) && points.length >= 2)) artwork += geometryEditablePoints(points);
  return `<svg class="geometry-svg geometry-interactive-svg" viewBox="0 0 320 252" role="img" aria-label="점을 눌러 놓고 동그란 점을 끌어서 도형을 직접 그려요">${artwork}</svg>`;
}

function geometrySymmetrySvg(shape, showAxes) {
  const specs = {
    triangle: { points: geometryPointList(3, 160, 126, 84), axes: [[160, 42, 160, 210], [87, 168, 196, 105], [233, 168, 124, 105]] },
    square: { points: geometryPointList(4, 160, 126, 82, -45), axes: [[160, 34, 160, 218], [68, 126, 252, 126], [91, 57, 229, 195], [229, 57, 91, 195]] },
    rectangle: { points: [{ x: 83, y: 54 }, { x: 237, y: 54 }, { x: 237, y: 198 }, { x: 83, y: 198 }], axes: [[160, 54, 160, 198], [83, 126, 237, 126]] },
    pentagon: { points: geometryPointList(5, 160, 126, 82), axes: Array.from({ length: 5 }, (_, index) => { const point = geometryPointList(5, 160, 126, 82)[index]; const opposite = geometryPointList(5, 160, 126, 82)[(index + 2) % 5]; const midpoint = { x: (opposite.x + geometryPointList(5, 160, 126, 82)[(index + 3) % 5].x) / 2, y: (opposite.y + geometryPointList(5, 160, 126, 82)[(index + 3) % 5].y) / 2 }; return [point.x, point.y, midpoint.x, midpoint.y]; }) },
  }[shape];
  const points = specs.points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
  const axes = showAxes ? specs.axes.map((axis) => `<path d="M${axis[0]} ${axis[1]}L${axis[2]} ${axis[3]}" class="geometry-axis-line"/>`).join('') : '';
  const dots = specs.points.map((point) => `<circle cx="${point.x}" cy="${point.y}" r="4" class="geometry-vertex-dot"/>`).join('');
  return `<svg class="geometry-svg" viewBox="0 0 320 252" role="img" aria-label="${shape} 도형의 대칭축 ${showAxes ? specs.axes.length : 0}개"><polygon points="${points}" fill="#e6efd9" stroke="#536b99" stroke-width="4" stroke-linejoin="round"/>${axes}${dots}</svg>`;
}

function geometryIsoBlocksSvg(stacks) {
  const cellWidth = 42;
  const cellDepth = 23;
  const cellHeight = 27;
  const originX = 160;
  const originY = 118;
  const cubes = [];
  const order = [];
  for (let x = 0; x < stacks.length; x += 1) {
    for (let y = 0; y < stacks[x].length; y += 1) order.push({ x, y });
  }
  order.sort((a, b) => a.x + a.y - b.x - b.y);
  // Draw back columns first, then front columns, to keep the isometric stacks readable.
  order.forEach(({ x, y }) => {
    for (let z = 0; z < stacks[x][y]; z += 1) {
      const cx = originX + (x - y) * cellWidth / 2;
      const cy = originY + (x + y) * cellDepth / 2 - z * cellHeight;
      const top = `M${cx} ${cy}L${cx + cellWidth / 2} ${cy + cellDepth / 2}L${cx} ${cy + cellDepth}L${cx - cellWidth / 2} ${cy + cellDepth / 2}Z`;
      const left = `M${cx - cellWidth / 2} ${cy + cellDepth / 2}L${cx} ${cy + cellDepth}V${cy + cellDepth + cellHeight}L${cx - cellWidth / 2} ${cy + cellDepth / 2 + cellHeight}Z`;
      const right = `M${cx + cellWidth / 2} ${cy + cellDepth / 2}L${cx} ${cy + cellDepth}V${cy + cellDepth + cellHeight}L${cx + cellWidth / 2} ${cy + cellDepth / 2 + cellHeight}Z`;
      const visibleLeft = y === stacks[x].length - 1 || stacks[x][y + 1] <= z;
      const visibleRight = x === stacks.length - 1 || stacks[x + 1]?.[y] <= z;
      if (visibleLeft) cubes.push(`<path d="${left}" class="geometry-cube-left"/>`);
      if (visibleRight) cubes.push(`<path d="${right}" class="geometry-cube-right"/>`);
      if (z === stacks[x][y] - 1) cubes.push(`<path d="${top}" class="geometry-cube-top"/>`);
    }
  });
  return `<svg class="geometry-svg geometry-block-svg" viewBox="0 0 320 252" role="img" aria-label="쌓기나무를 비스듬한 입체 방향에서 본 모습"><path d="M55 225H265" class="geometry-ground-line"/>${cubes.join('')}</svg>`;
}

function geometryProjectionSvg(stacks, view) {
  const count = view === 'front' ? stacks.length : stacks[0].length;
  const heights = view === 'front'
    ? Array.from({ length: count }, (_, x) => Math.max(...stacks[x]))
    : Array.from({ length: count }, (_, y) => Math.max(...stacks.map((row) => row[y])));
  const cellWidth = Math.min(52, 220 / count);
  const cellHeight = 34;
  const startX = (320 - cellWidth * count) / 2;
  const startY = 205;
  const blocks = heights.map((height, index) => Array.from({ length: height }, (_, level) => {
    const x = startX + index * cellWidth;
    const y = startY - (level + 1) * cellHeight;
    return `<rect x="${x + 1}" y="${y + 1}" width="${cellWidth - 2}" height="${cellHeight - 2}" rx="3" class="geometry-projection-block"/>`;
  }).join('')).join('');
  const labels = heights.map((height, index) => `<text x="${startX + index * cellWidth + cellWidth / 2}" y="225" text-anchor="middle" class="geometry-svg-label">${height}</text>`).join('');
  const aria = view === 'front' ? '앞에서 본 쌓기나무 높이' : '옆에서 본 쌓기나무 높이';
  return `<svg class="geometry-svg" viewBox="0 0 320 252" role="img" aria-label="${aria}"><path d="M${startX} ${startY}H${startX + cellWidth * count}" class="geometry-ground-line"/>${blocks}${labels}</svg>`;
}

function geometryTopViewSvg(stacks) {
  const cell = 48;
  const cols = stacks[0].length;
  const rows = stacks.length;
  const startX = (320 - cols * cell) / 2;
  const startY = (252 - rows * cell) / 2;
  const cells = stacks.flatMap((row, x) => row.map((height, y) => `<rect x="${startX + y * cell + 2}" y="${startY + x * cell + 2}" width="${cell - 4}" height="${cell - 4}" rx="5" class="${height ? 'geometry-top-occupied' : 'geometry-top-empty'}"/><text x="${startX + y * cell + cell / 2}" y="${startY + x * cell + cell / 2 + 4}" text-anchor="middle" class="geometry-svg-label">${height || ''}</text>`)).join('');
  return `<svg class="geometry-svg" viewBox="0 0 320 252" role="img" aria-label="위에서 본 쌓기나무 바닥 자리와 각 칸의 높이">${cells}</svg>`;
}

function geometrySolidSvg(solid, showNet = false, turn = 0) {
  if (solid === 'prism' && showNet) {
    return '<svg class="geometry-svg" viewBox="0 0 320 252" role="img" aria-label="여섯 직사각형으로 된 직육면체 전개도"><g class="geometry-net"><rect x="110" y="20" width="64" height="46"/><rect x="46" y="66" width="64" height="92"/><rect x="110" y="66" width="64" height="92"/><rect x="174" y="66" width="64" height="92"/><rect x="238" y="66" width="40" height="92"/><rect x="110" y="158" width="64" height="46"/></g></svg>';
  }
  const common = 'fill="#e7eedb" stroke="#536b99" stroke-width="3" stroke-linejoin="round"';
  const turnGroup = (content) => `<g transform="rotate(${turn} 160 126)">${content}</g>`;
  const shapes = {
    prism: `<path d="M82 88H185V176H82Z" ${common}/><path d="M82 88L120 55H222V143L185 176" fill="#cdddbf" stroke="#536b99" stroke-width="3" stroke-linejoin="round"/><path d="M185 88L222 55V143L185 176Z" fill="#b7cba7" stroke="#536b99" stroke-width="3" stroke-linejoin="round"/><path d="M82 88L120 55H222M185 88L222 55" fill="none" stroke="#536b99" stroke-width="3"/>`,
    cylinder: `<ellipse cx="160" cy="76" rx="64" ry="22" fill="#dce9ce" stroke="#536b99" stroke-width="3"/><path d="M96 76V174C96 187 125 198 160 198S224 187 224 174V76" fill="#dce9ce" stroke="#536b99" stroke-width="3"/><path d="M96 174C96 187 125 198 160 198S224 187 224 174" fill="none" stroke="#536b99" stroke-width="3"/><path d="M96 76C96 89 125 100 160 100S224 89 224 76" fill="none" stroke="#536b99" stroke-width="2" stroke-dasharray="5 4"/>`,
    cone: `<ellipse cx="160" cy="184" rx="68" ry="22" fill="#e7e0c8" stroke="#536b99" stroke-width="3"/><path d="M160 42L92 184M160 42L228 184" fill="#e7eedb" stroke="#536b99" stroke-width="3"/><path d="M92 184C110 202 210 202 228 184" fill="none" stroke="#536b99" stroke-width="3"/>`,
    sphere: `<defs><radialGradient id="geo-sphere-shade" cx="34%" cy="30%"><stop offset="0" stop-color="#f3f6e9"/><stop offset="1" stop-color="#a9bf98"/></radialGradient></defs><circle cx="160" cy="126" r="78" fill="url(#geo-sphere-shade)" stroke="#536b99" stroke-width="3"/><ellipse cx="160" cy="126" rx="34" ry="78" fill="none" stroke="#7f94b2" stroke-width="2"/><path d="M84 126C105 101 215 101 236 126M84 126C105 151 215 151 236 126" fill="none" stroke="#7f94b2" stroke-width="2"/>`,
  }[solid];
  const aria = solid === 'prism' ? '직육면체 입체 보기' : solid === 'sphere' ? '구 입체 보기' : solid === 'cone' ? '원뿔 입체 보기' : '원기둥 입체 보기';
  return `<svg class="geometry-svg" viewBox="0 0 320 252" role="img" aria-label="${aria}">${turnGroup(shapes)}</svg>`;
}

function geometryReadouts(items) {
  return items.map(([label, value]) => `<div class="geometry-readout"><span>${label}</span><strong>${value}</strong></div>`).join('');
}

function geometryPolygonMeasurements(points) {
  const lengths = points.map((point, index) => {
    const next = points[(index + 1) % points.length];
    return Math.hypot(next[0] - point[0], next[1] - point[1]);
  });
  const angles = points.map((point, index) => {
    const previous = points[(index - 1 + points.length) % points.length];
    const next = points[(index + 1) % points.length];
    const a = [previous[0] - point[0], previous[1] - point[1]];
    const b = [next[0] - point[0], next[1] - point[1]];
    const denominator = Math.hypot(...a) * Math.hypot(...b);
    if (!denominator) return 0;
    const cosine = (a[0] * b[0] + a[1] * b[1]) / denominator;
    return Math.acos(Math.max(-1, Math.min(1, cosine))) * 180 / Math.PI;
  });
  return { lengths, angles };
}

function geometryPolygonName(points, grade = activeGrade) {
  if (points.length < 3) return '점 더 찍기';
  const { lengths, angles } = geometryPolygonMeasurements(points);
  const near = (value, target, tolerance = 6) => Math.abs(value - target) <= tolerance;
  const allEqual = lengths.every((length) => near(length, lengths[0]));
  const allRightAngles = angles.every((angle) => near(angle, 90, 5));
  const hasRightAngle = angles.some((angle) => near(angle, 90, 5));
  if (points.length === 3) {
    if (hasRightAngle) return '직각삼각형';
    const hasEqualSides = lengths.some((length, index) => lengths.some((other, otherIndex) => otherIndex !== index && near(length, other)));
    if (grade === 3) return allEqual ? '정삼각형에 가까워요' : '삼각형';
    return allEqual ? '정삼각형에 가까워요' : hasEqualSides ? '이등변삼각형에 가까워요' : '삼각형';
  }
  if (points.length === 4) {
    if (grade === 3) return allEqual && allRightAngles ? '정사각형에 가까워요' : '사각형';
    const parallel = (a, b) => {
      const cross = a[0] * b[1] - a[1] * b[0];
      return Math.abs(cross) / (Math.hypot(...a) * Math.hypot(...b)) < 0.06;
    };
    const firstPair = parallel([points[1][0] - points[0][0], points[1][1] - points[0][1]], [points[3][0] - points[2][0], points[3][1] - points[2][1]]);
    const secondPair = parallel([points[2][0] - points[1][0], points[2][1] - points[1][1]], [points[0][0] - points[3][0], points[0][1] - points[3][1]]);
    if (allEqual && allRightAngles) return '정사각형에 가까워요';
    if (allRightAngles) return '직사각형에 가까워요';
    if (allEqual) return '마름모에 가까워요';
    if (firstPair && secondPair) return '평행사변형에 가까워요';
    if (firstPair || secondPair) return '사다리꼴에 가까워요';
    return '사각형';
  }
  return allEqual ? `정${points.length}각형에 가까워요` : `${points.length}각형`;
}

const geometryShapeTemplates = {
  equilateral: [[0, -1], [Math.sqrt(3) / 2, 0.5], [-Math.sqrt(3) / 2, 0.5]],
  rightTriangle: [[-1 / 3, 1 / 3], [2 / 3, 1 / 3], [-1 / 3, -2 / 3]],
  square: [[-1, -1], [1, -1], [1, 1], [-1, 1]],
};

function geometryConstrainedPoints(model) {
  if (!model) return null;
  const template = geometryShapeTemplates[model.kind];
  if (!template) return null;
  geometryFitConstrainedModel(model);
  const angle = model.rotation;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return template.map(([x, y]) => [Math.round(model.center[0] + (x * cosine - y * sine) * model.size), Math.round(model.center[1] + (x * sine + y * cosine) * model.size)]);
}

function geometryConstrainedBounds(model) {
  const template = geometryShapeTemplates[model.kind];
  const cosine = Math.cos(model.rotation);
  const sine = Math.sin(model.rotation);
  const rotated = template.map(([x, y]) => [x * cosine - y * sine, x * sine + y * cosine]);
  return {
    x: Math.max(...rotated.map(([x]) => Math.abs(x))),
    y: Math.max(...rotated.map(([, y]) => Math.abs(y))),
  };
}

function geometryFitConstrainedModel(model) {
  const bounds = geometryConstrainedBounds(model);
  const maxSize = Math.min((304 - 16) / (2 * bounds.x), (236 - 16) / (2 * bounds.y));
  model.size = Math.min(model.size, maxSize);
  model.center = [
    Math.max(16 + bounds.x * model.size, Math.min(304 - bounds.x * model.size, model.center[0])),
    Math.max(16 + bounds.y * model.size, Math.min(236 - bounds.y * model.size, model.center[1])),
  ];
}

function geometryMakePreset(kind) {
  const tool = kind === 'square' ? 'quadrilaterals' : 'triangles';
  geometryState.tool = tool;
  geometryState.constrainedShapes[tool] = { kind, center: [160, 126], size: kind === 'square' ? 90 : 104, rotation: 0 };
  geometryState.drawings[tool] = geometryConstrainedPoints(geometryState.constrainedShapes[tool]);
  geometryState.drawingComplete = true;
  renderGeometryLab();
}

function geometryMoveConstrainedPoint(tool, index, point, origin) {
  const model = geometryState.constrainedShapes[tool];
  if (!model || !origin) return;
  if (index === 0) {
    model.center = [
      Math.max(32, Math.min(288, origin.center[0] + point[0] - origin.point[0])),
      Math.max(32, Math.min(220, origin.center[1] + point[1] - origin.point[1])),
    ];
  } else {
    const template = geometryShapeTemplates[model.kind];
    const base = template[index];
    const dx = point[0] - model.center[0];
    const dy = point[1] - model.center[1];
    const baseAngle = Math.atan2(base[1], base[0]);
    model.rotation = Math.atan2(dy, dx) - baseAngle;
    model.size = Math.max(28, Math.hypot(dx, dy) / Math.hypot(base[0], base[1]));
  }
  geometryFitConstrainedModel(model);
  geometryState.drawings[tool] = geometryConstrainedPoints(model);
}

function geometryToolButton(tool) {
  const selected = geometryState.tool === tool;
  const label = activeGrade === 3 && tool === 'triangles' ? '직각·정삼각형 만들기'
    : activeGrade === 3 && tool === 'quadrilaterals' ? '정사각형 만들기'
      : activeGrade === 4 && tool === 'triangles' ? '삼각형 분류하기'
        : activeGrade === 4 && tool === 'quadrilaterals' ? '사각형 분류하기'
          : geometryToolLabels[tool];
  return `<button type="button" class="geometry-tool-button${selected ? ' selected' : ''}" data-geometry-tool="${tool}" aria-pressed="${selected}">${label}</button>`;
}

function geometryBlockEditor() {
  return `<div class="block-editor-grid" role="group" aria-label="3 곱하기 3 블록 자리 조작">${geometryState.blocks.flatMap((row, x) => row.map((height, y) => `<div class="block-editor-cell"><span>자리 ${x + 1}-${y + 1}</span><strong>${height}층</strong><div><button type="button" data-geometry-action="block-down" data-x="${x}" data-y="${y}" aria-label="${x + 1}행 ${y + 1}열 블록 하나 빼기" ${height === 0 ? 'disabled' : ''}>−</button><button type="button" data-geometry-action="block-up" data-x="${x}" data-y="${y}" aria-label="${x + 1}행 ${y + 1}열에 블록 하나 쌓기" ${height >= 4 ? 'disabled' : ''}>+</button></div></div>`)).join('')}</div>`;
}

function geometryControlsMarkup() {
  if (geometryState.mode === '2d') {
    const pointCount = (geometryState.drawings[geometryState.tool] || []).length;
    const freePolygon = ['polygon', 'symmetry', 'congruence'].includes(geometryState.tool);
    const easyShapeButtons = activeGrade === 3 && geometryState.tool === 'triangles'
      ? `<div class="geometry-shape-presets" role="group" aria-label="쉽게 삼각형 만들기"><button type="button" class="geometry-secondary-button" data-geometry-preset-shape="rightTriangle">직각삼각형 바로 만들기</button><button type="button" class="geometry-secondary-button" data-geometry-preset-shape="equilateral">정삼각형 바로 만들기</button><button type="button" class="geometry-secondary-button" data-geometry-preset-shape="freeTriangle">점으로 자유롭게 그리기</button></div>`
      : activeGrade === 3 && geometryState.tool === 'quadrilaterals'
        ? `<div class="geometry-shape-presets" role="group" aria-label="쉽게 사각형 만들기"><button type="button" class="geometry-secondary-button" data-geometry-preset-shape="square">정사각형 바로 만들기</button><button type="button" class="geometry-secondary-button" data-geometry-preset-shape="freeSquare">점으로 자유롭게 그리기</button></div>`
        : '';
    const countLabel = { lines: '선의 두 점', angles: '각의 꼭짓점과 두 점', triangles: '삼각형의 세 꼭짓점', quadrilaterals: '사각형의 네 꼭짓점', circle: '원의 중심과 원 위의 점', circleArea: '원의 중심과 원 위의 점' }[geometryState.tool];
    const constrained = geometryState.constrainedShapes[geometryState.tool];
    const help = constrained
      ? '꼭짓점을 끌어도 같은 모양이 유지돼요. 첫 번째 꼭짓점을 움직이면 도형 전체를 옮길 수 있어요.'
      : geometryState.tool === 'circle' || geometryState.tool === 'circleArea'
      ? '그림판을 눌러 중심을 찍고, 원 위를 한 번 더 눌러 크기를 정해요. 점을 끌어 옮길 수도 있어요.'
      : geometryState.tool === 'angles'
        ? '꼭짓점을 먼저 찍고, 두 변이 뻗어 갈 점을 차례로 찍어요. 점을 끌어 각을 바꿔 보세요.'
              : geometryState.tool === 'triangles'
          ? activeGrade === 3 ? '세 꼭짓점을 차례로 찍어 직각삼각형이나 정삼각형을 만들어 봐요. 점을 움직여 모양을 비교해요.' : '세 꼭짓점을 차례로 찍어 삼각형을 만들어요. 꼭짓점을 끌면 변의 모양이 바뀌어요.'
            : geometryState.tool === 'quadrilaterals'
            ? activeGrade === 3 ? '네 꼭짓점을 찍어 정사각형을 만들고, 점을 움직여 네 변과 네 각을 살펴봐요.' : '네 꼭짓점을 차례로 찍어 사각형을 만들어요. 꼭짓점을 끌어 여러 모양을 만들어 보세요.'
            : geometryState.tool === 'polygon'
              ? '그림판을 눌러 꼭짓점을 차례로 찍어요. 점을 더 찍은 뒤 “그리기 마치기”를 눌러요.'
              : geometryState.tool === 'symmetry'
                ? '꼭짓점을 움직여 대칭축 양쪽의 모양이 서로 포개지는지 살펴봐요.'
                : geometryState.tool === 'congruence'
                  ? '파란 도형의 꼭짓점을 끌어 모양을 바꾸고, 같은 모양의 도형과 비교해요.'
                  : '그림판 두 곳을 차례로 눌러 점을 찍어요. 점을 끌어 선분·반직선·직선의 방향을 바꿔 보세요.';
    const drawButtons = `<div class="geometry-draw-actions"><button type="button" class="geometry-secondary-button" data-geometry-action="clear-drawing">모두 지우고 새로 그리기</button><button type="button" class="geometry-secondary-button" data-geometry-action="undo-point" ${pointCount ? '' : 'disabled'}>마지막 점 되돌리기</button>${freePolygon ? `<button type="button" class="geometry-secondary-button" data-geometry-action="continue-drawing">꼭짓점 더 찍기</button><button type="button" class="geometry-secondary-button" data-geometry-action="finish-drawing" ${pointCount < 3 ? 'disabled' : ''}>그리기 마치기</button>` : ''}</div>`;
    const linePicker = geometryState.tool === 'lines' ? `<label class="geometry-control"><span>그릴 선 고르기</span><select data-geometry-input="lineKind" aria-label="그릴 선 고르기"><option value="segment" ${geometryState.lineKind === 'segment' ? 'selected' : ''}>선분</option><option value="ray" ${geometryState.lineKind === 'ray' ? 'selected' : ''}>반직선</option><option value="line" ${geometryState.lineKind === 'line' ? 'selected' : ''}>직선</option></select></label>` : '';
    const areaHelp = geometryState.tool === 'circleArea' ? '<p class="geometry-formula">원의 넓이 = 반지름 × 반지름 × 3.14</p>' : '';
    return `${easyShapeButtons}${linePicker}<p class="geometry-control-hint">${help}</p>${drawButtons}${areaHelp}`;
  }
  if (geometryState.tool === 'blocks') return `<div class="geometry-control"><span>보는 방향</span><div class="geometry-view-buttons" role="group" aria-label="쌓기나무 보는 방향"><button data-geometry-view="iso" aria-pressed="${geometryState.blockView === 'iso'}">입체</button><button data-geometry-view="top" aria-pressed="${geometryState.blockView === 'top'}">위</button><button data-geometry-view="front" aria-pressed="${geometryState.blockView === 'front'}">앞</button><button data-geometry-view="side" aria-pressed="${geometryState.blockView === 'side'}">옆</button></div></div><div class="geometry-control"><span>블록 놓기·빼기 <small>최대 4층</small></span>${geometryBlockEditor()}</div><div class="geometry-preset-buttons"><button data-geometry-preset="stairs">계단</button><button data-geometry-preset="wall">벽</button><button data-geometry-preset="clear">모두 비우기</button></div><div class="geometry-rotate-buttons"><button data-geometry-action="rotate-left">↶ 왼쪽으로 돌리기</button><button data-geometry-action="rotate-right">오른쪽으로 돌리기 ↷</button></div>`;
  const selectMarkup = geometryState.tool === 'prism'
    ? '<option value="prism" selected>직육면체</option>'
    : `<option value="cylinder" ${geometryState.solid === 'cylinder' ? 'selected' : ''}>원기둥</option><option value="cone" ${geometryState.solid === 'cone' ? 'selected' : ''}>원뿔</option><option value="sphere" ${geometryState.solid === 'sphere' ? 'selected' : ''}>구</option>`;
  const canShowNet = geometryState.solid === 'prism';
  const facts = geometrySolidFacts[geometryState.solid] || geometrySolidFacts.prism;
  return `<label class="geometry-control"><span>입체도형</span><select data-geometry-input="solid" aria-label="입체도형 고르기">${selectMarkup}</select></label>${canShowNet ? `<button type="button" class="geometry-secondary-button" data-geometry-action="toggle-net">${geometryState.solidNet ? '입체 보기' : '전개도 보기'}</button>` : ''}<div class="geometry-solid-facts">${facts.map(([label, value]) => `<span><small>${label}</small><strong>${value}</strong></span>`).join('')}</div><div class="geometry-rotate-buttons"><button data-geometry-action="solid-turn-left">↶ 돌려 보기</button><button data-geometry-action="solid-turn-right">다른 쪽 보기 ↷</button></div><p class="geometry-control-hint">입체를 돌려 평평한 면, 곡면, 꼭짓점을 찾아봐요.</p>`;
}

function renderGeometryStage() {
  const stage = document.querySelector('#geometry-stage');
  const title = document.querySelector('#geometry-stage-title');
  const kind = document.querySelector('#geometry-stage-kind');
  const caption = document.querySelector('#geometry-stage-caption');
  const readouts = document.querySelector('#geometry-readouts');
  if (!stage || !title || !readouts) return;
  kind.textContent = geometryState.mode === '2d' ? '평면도형 살펴보기' : '입체도형 살펴보기';
  if (geometryState.mode === '2d') {
    const points = geometryState.drawings[geometryState.tool] || [];
    const titles = { lines: '선을 직접 그려요', angles: '각을 직접 만들어요', triangles: '삼각형을 직접 그려요', quadrilaterals: '사각형을 직접 그려요', polygon: '다각형을 직접 그려요', circle: '원을 직접 그려요', circleArea: '원을 그리고 넓이를 살펴봐요', symmetry: '대칭 모양을 직접 바꿔요', congruence: '합동 모양을 직접 바꿔요' };
    const constrained = geometryState.constrainedShapes[geometryState.tool];
    const constrainedTitle = constrained?.kind === 'equilateral' ? '정삼각형 만들기' : constrained?.kind === 'rightTriangle' ? '직각삼각형 만들기' : constrained?.kind === 'square' ? '정사각형 만들기' : '';
    title.textContent = constrainedTitle || titles[geometryState.tool] || '도형을 직접 그려요';
    stage.innerHTML = geometryInteractiveSvg(geometryState.tool);
    if (geometryState.tool === 'lines') {
      const segmentLength = points.length === 2 ? Math.round(Math.hypot(points[1][0] - points[0][0], points[1][1] - points[0][1]) / 10) : 0;
      readouts.innerHTML = geometryReadouts([['선의 종류', { segment: '선분', ray: '반직선', line: '직선' }[geometryState.lineKind]], ['찍은 점', `${points.length}개`], ['두 점 사이', points.length === 2 ? `${segmentLength}칸` : '점을 찍어 보세요']]);
    } else if (geometryState.tool === 'angles' && points.length === 3) {
      const a = Math.atan2(points[1][1] - points[0][1], points[1][0] - points[0][0]);
      const b = Math.atan2(points[2][1] - points[0][1], points[2][0] - points[0][0]);
      const degrees = Math.round(Math.abs(Math.atan2(Math.sin(b - a), Math.cos(b - a))) * 180 / Math.PI);
      const angleName = activeGrade === 3 ? degrees === 90 ? '직각이에요' : '직각이 아니에요' : degrees < 90 ? '예각' : degrees === 90 ? '직각' : degrees === 180 ? '평각' : '둔각';
      readouts.innerHTML = geometryReadouts([['벌어진 정도', `${degrees}°`], ['꼭짓점', '1개'], ['각의 종류', angleName]]);
    } else if (geometryState.tool === 'triangles' || geometryState.tool === 'quadrilaterals' || geometryState.tool === 'polygon' || geometryState.tool === 'symmetry' || geometryState.tool === 'congruence') {
      if (points.length >= 3) {
        const { lengths, angles } = geometryPolygonMeasurements(points);
        readouts.innerHTML = geometryReadouts([["이 모양은", geometryPolygonName(points)], ['변의 길이', lengths.map((length) => `${(length / 10).toFixed(1)}`).join(' · ')], ['꼭짓점의 각', angles.map((angle) => `${Math.round(angle)}°`).join(' · ')]]);
      } else {
        readouts.innerHTML = geometryReadouts([['찍은 꼭짓점', `${points.length}개`], ['이어지는 변', `${Math.max(0, points.length - 1)}개`], ['다음 단계', '점을 더 찍어요']]);
      }
    } else if ((geometryState.tool === 'circle' || geometryState.tool === 'circleArea') && points.length === 2) {
      const radius = Math.round(Math.hypot(points[1][0] - points[0][0], points[1][1] - points[0][1]) / 10 * 10) / 10;
      const diameter = Math.round(radius * 2 * 10) / 10;
      const items = [['반지름', `${radius}칸`], ['지름', `${diameter}칸`], ['중심', '첫 번째 점']];
      if (geometryState.tool === 'circleArea') items[2] = ['넓이', `${(radius * radius * 3.14).toFixed(1)}칸²`];
      readouts.innerHTML = geometryReadouts(items);
    } else {
      readouts.innerHTML = geometryReadouts([['찍은 점', `${points.length}개`], ['그림판', '점을 눌러 보세요'], ['조작', '점을 끌어 옮겨요']]);
    }
    caption.textContent = constrained ? '꼭짓점을 끌어도 같은 모양을 유지해요. 첫 번째 꼭짓점을 끌면 도형 전체가 움직여요.' : geometryState.tool === 'symmetry' ? '점선을 기준으로 양쪽 모양이 서로 포개지는지 점을 움직여 확인해요.' : geometryState.tool === 'congruence' ? '두 도형의 꼭짓점을 움직여 모양과 크기가 같을 때 포개지는지 살펴봐요.' : geometryState.tool === 'circle' || geometryState.tool === 'circleArea' ? '첫 점은 원의 중심, 두 번째 점은 원 위에 놓고 점을 끌어 크기를 바꿔요.' : geometryState.tool === 'angles' ? '첫 점이 꼭짓점이에요. 나머지 두 점을 움직여 각의 크기를 바꿔 보세요.' : '점은 꼭짓점이에요. 그림판을 눌러 점을 찍거나 이미 있는 점을 끌어 모양을 바꿔 보세요.';
    return;
  }
  if (geometryState.tool === 'blocks') {
    const total = geometryState.blocks.flat().reduce((sum, height) => sum + height, 0);
    const maxHeight = Math.max(0, ...geometryState.blocks.flat());
    title.textContent = geometryState.blockView === 'iso' ? '내가 쌓은 블록' : geometryState.blockView === 'top' ? '위에서 본 모양' : geometryState.blockView === 'front' ? '앞에서 본 모양' : '옆에서 본 모양';
    stage.innerHTML = geometryState.blockView === 'iso'
      ? geometryIsoBlocksSvg(geometryState.blocks)
      : geometryState.blockView === 'top'
        ? geometryTopViewSvg(geometryState.blocks)
        : geometryProjectionSvg(geometryState.blocks, geometryState.blockView);
    readouts.innerHTML = geometryReadouts([['블록 수', `${total}개`], ['가장 높은 곳', `${maxHeight}층`], ['바닥 자리', `${geometryState.blocks.flat().filter((height) => height > 0).length}칸`]]);
    caption.textContent = geometryState.blockView === 'top' ? '위에서 보면 블록의 높이가 아니라 바닥에 놓인 자리를 살펴봐요.' : geometryState.blockView === 'iso' ? '칸의 +와 −를 눌러 쌓고, 입체 그림을 돌려 보세요.' : '각 위치에서 보이는 가장 높은 층을 비교해요.';
  } else {
    const solid = geometryState.tool === 'prism' ? 'prism' : geometryState.solid;
    const facts = geometrySolidFacts[solid];
    title.textContent = geometryState.solidNet && solid === 'prism' ? '직육면체 전개도' : `${geometrySolidLabels[solid]} 살펴보기`;
    stage.innerHTML = geometrySolidSvg(solid, geometryState.solidNet, geometryState.solidTurn);
    readouts.innerHTML = geometryReadouts(facts);
    caption.textContent = geometryState.solidNet && solid === 'prism' ? '접히는 면이 어떻게 만나는지 선을 따라 살펴봐요.' : '돌려 보며 보이는 면의 모양과 꼭짓점 수를 확인해요.';
  }
}

function renderGeometryLab() {
  const plan = geometryPlans[activeGrade];
  const lab = document.querySelector('#geometry-view');
  if (!plan || !lab) return;
  if (!plan.modes.includes(geometryState.mode)) geometryState.mode = plan.modes[0];
  const tools = plan.tools[geometryState.mode];
  if (!tools.includes(geometryState.tool)) geometryState.tool = tools[0];
  if (geometryState.tool === 'prism') geometryState.solid = 'prism';
  if (geometryState.tool === 'solids' && geometryState.solid === 'prism') geometryState.solid = 'cylinder';
  document.querySelector('#geometry-grade-description').textContent = `${activeGrade}학년 눈높이에 맞춰 ${plan.description}`;
  document.querySelector('#geometry-course-note').textContent = `${activeGrade}학년 2학기 · ${plan.note}`;
  const isPreview = (plan.preview3d && geometryState.mode === '3d') || (activeGrade === 3 && geometryState.mode === '2d' && geometryState.tool === 'polygon');
  document.querySelector('#geometry-preview-tag').hidden = !isPreview;
  document.querySelector('#geometry-preview-tag').textContent = isPreview ? '미리 보기 활동' : '';
  document.querySelectorAll('[data-geometry-mode]').forEach((button) => {
    const selected = button.dataset.geometryMode === geometryState.mode;
    button.hidden = !plan.modes.includes(button.dataset.geometryMode);
    button.setAttribute('aria-pressed', String(selected));
  });
  document.querySelector('#geometry-tool-list').innerHTML = tools.map(geometryToolButton).join('');
  document.querySelector('#geometry-controls').innerHTML = geometryControlsMarkup();
  renderGeometryStage();
}

function encodeMachineLevel() {
  const payload = {
    v: 3,
    title: machine.title.slice(0, 40),
    parts: machine.parts.slice(0, 16).map(({ type, x, y, z, angle, yaw, width, height, depth, speed, leverArm }) => ({ type, x, y, z, angle, yaw, width, height, depth, speed, leverArm })),
  };
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeMachineLevel(value) {
  if (typeof value !== 'string' || value.length > 6000) return null;
  try {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const payload = JSON.parse(new TextDecoder().decode(bytes));
    if (![1, 2, 3].includes(payload?.v) || !Array.isArray(payload.parts) || payload.parts.length > 16) return null;
    const allowedTypes = new Set(['ramp', 'block', 'turntable', 'lever']);
    const parts = payload.parts.map((part, index) => {
      const number = (value, min, max, fallback) => Number.isFinite(Number(value)) ? Math.max(min, Math.min(max, Number(value))) : fallback;
      if (!allowedTypes.has(part?.type)) return null;
      const legacy2d = payload.v === 1;
      const width = legacy2d
        ? number(part.width, 42, 220, part.type === 'block' ? 64 : 150) / 100
        : number(part.width, 0.42, 2.2, part.type === 'block' ? 0.62 : 1.5);
      const height = legacy2d
        ? number(part.height, 12, 56, part.type === 'block' ? 28 : 14) / 100
        : number(part.height, 0.08, 0.56, part.type === 'block' ? 0.32 : 0.12);
      return {
        id: `shared-${index + 1}`,
        type: part.type,
        x: legacy2d ? number(part.x, 24, 696, 180) / 100 - machineBoard.width / 2 : number(part.x, -3.3, 3.3, 0),
        y: legacy2d ? Math.max(height / 2, (424 - number(part.y, 24, 414, 220)) / 100) : number(part.y, height / 2, machineBoard.height, height / 2),
        z: legacy2d ? 0 : number(part.z, -2, 2, 0),
        angle: number(part.angle, -75, 75, 0) * (legacy2d ? -1 : 1),
        yaw: number(part.yaw, 0, 360, 0),
        width,
        height,
        depth: legacy2d ? (part.type === 'block' ? 0.62 : part.type === 'turntable' ? 1.2 : part.type === 'lever' ? 0.18 : 0.45) : number(part.depth, 0.12, 2.2, 0.45),
        speed: number(part.speed, -3, 3, 1.4),
        leverArm: legacy2d ? number(part.leverArm, 18, 76, 55) / 100 : number(part.leverArm, 0.18, 0.76, 0.55),
        phase: 0,
        leverOmega: 0,
      };
    });
    if (parts.some((part) => !part)) return null;
    return { title: typeof payload.title === 'string' ? payload.title.slice(0, 40) : '친구가 공유한 굴림길', parts };
  } catch {
    return null;
  }
}

function loadSharedMachineIfPresent() {
  const sharedCode = new URLSearchParams(location.search).get('machine');
  if (!sharedCode || sharedCode === machineLoadedShare) return;
  machineLoadedShare = sharedCode;
  const sharedMachine = decodeMachineLevel(sharedCode);
  if (!sharedMachine) {
    machineShareImportValid = false;
    machine.result = '공유 장치 링크를 읽지 못했어요. 친구에게 새 링크를 받아보세요.';
    renderMachineLab();
    return;
  }
  machineShareImportValid = true;
  machine.title = sharedMachine.title;
  machine.parts = sharedMachine.parts;
  machine.nextId = machine.parts.length + 1;
  machine.selectedId = null;
  resetMachineRun();
  machine.result = '친구가 공유한 장치를 불러왔어요. 내 방식으로 바꾸어 실험해 보세요.';
  renderMachineLab();
  document.querySelector('#machine-share-import-notice').hidden = false;
}

async function refreshMachineLabAccess() {
  if (!studentSession) {
    machineLabOpen = false;
    machineLabAccessChecked = true;
    renderMachineLab();
    return false;
  }
  try {
    const previousOpen = machineLabOpen;
    const previousChecked = machineLabAccessChecked;
    const previousShare = machineLoadedShare;
    const client = await getSupabaseClient();
    const { data: { session } } = await client.auth.getSession();
    if (!session?.access_token) throw new Error('로그인을 다시 해주세요.');
    const response = await fetch('/api/student/machine-lab-access', { headers: { Authorization: `Bearer ${session.access_token}` }, signal: AbortSignal.timeout(12000) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || '활동 권한을 확인하지 못했어요.');
    machineLabOpen = Boolean(result.machineLabOpen);
    machineLabAccessError = '';
    machineLabAccessChecked = true;
    if (machineLabOpen) loadSharedMachineIfPresent();
    else if (machine.running) {
      stopMachineAnimation();
      setMachineResult('선생님이 장치 제작소를 잠갔어요.');
    }
    if (previousOpen !== machineLabOpen || !previousChecked || previousShare !== machineLoadedShare) renderMachineLab();
    return machineLabOpen;
  } catch (error) {
    machineLabAccessError = error.name === 'TimeoutError'
      ? '선생님 설정 응답이 늦어지고 있어요. 인터넷 연결을 확인한 뒤 다시 눌러주세요.'
      : error.message || '선생님 설정을 확인하지 못했어요.';
    machineLabAccessChecked = false;
    machineLabOpen = false;
    renderMachineLab();
    return false;
  }
}

async function teacherClassroomSettingsRequest(method = 'GET', body) {
  if (!supabaseClient) throw new Error('Supabase 설정을 확인해 주세요.');
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session?.access_token) throw new Error('교사 로그인을 다시 해주세요.');
  const response = await fetch('/api/teacher/classroom-settings', {
    method,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(12000),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || '학급 활동 설정을 저장하지 못했어요.');
  return result;
}

function renderTeacherMachineLabSetting() {
  const button = document.querySelector('#machine-lab-toggle');
  const status = document.querySelector('#machine-lab-teacher-status');
  const setupHelp = document.querySelector('#machine-lab-setup-help');
  if (!button || !status) return;
  button.disabled = !teacherSession || status.dataset.loading === 'true';
  button.setAttribute('aria-pressed', String(machineLabOpen));
  button.classList.toggle('is-open', machineLabOpen);
  button.textContent = status.dataset.loading === 'true' ? '설정 확인 중…' : status.dataset.error === 'true' ? '설정 다시 불러오기' : machineLabOpen ? '학급에서 잠그기' : '학급에 열기';
  if (status.dataset.loading === 'true') {
    status.textContent = '담당 학급의 제작소와 수업 진도 설정을 불러오고 있어요.';
  } else if (status.dataset.error !== 'true') {
    status.textContent = machineLabOpen
      ? `${teacherSession?.grade || activeGrade}학년 ${teacherSession?.classNumber || 1}반 학생이 장치를 만들고 친구와 공유할 수 있어요.`
      : '현재 이 학급 학생에게는 잠겨 있어요.';
  }
  if (setupHelp) setupHelp.hidden = status.dataset.setupSql !== 'true'
    && !(teacherPacingWarning && /schema\.sql|설정 SQL|최신 SQL/i.test(teacherPacingWarning));
  renderTeacherPacingSetting();
}

function renderTeacherPacingSetting(message = '', busy = false) {
  const select = document.querySelector('#teaching-pace-select');
  const button = document.querySelector('#save-teaching-pace');
  const status = document.querySelector('#teaching-pace-status');
  const setupHelp = document.querySelector('#teaching-pace-setup-help');
  if (!select || !button || !status) return;
  select.value = String(teacherMissionsPerSession);
  select.disabled = !teacherPacingAvailable;
  button.disabled = busy || !teacherSession || !teacherPacingAvailable;
  status.textContent = message || (teacherPacingAvailable
    ? `저장된 설정: 한 번의 수업에서 ${teacherMissionsPerSession}개 미션`
    : teacherPacingWarning || '미션 수 설정을 사용하려면 최신 supabase-schema.sql을 Supabase에서 실행해 주세요.');
  if (setupHelp) setupHelp.hidden = teacherPacingAvailable || !/schema\.sql|설정 SQL|최신 SQL/i.test(teacherPacingWarning);
}

async function loadTeacherMachineLabSetting() {
  if (!teacherSession) return;
  const status = document.querySelector('#machine-lab-teacher-status');
  const button = document.querySelector('#machine-lab-toggle');
  if (button) button.disabled = true;
  if (status) {
    status.dataset.loading = 'true';
    status.dataset.error = '';
    status.dataset.setupSql = 'false';
  }
  renderTeacherMachineLabSetting();
  try {
    const result = await teacherClassroomSettingsRequest();
    machineLabOpen = Boolean(result.machineLabOpen);
    teacherMissionsPerSession = Math.max(1, Math.min(4, Number(result.missionsPerSession) || 1));
    teacherPacingAvailable = result.pacingAvailable !== false;
    teacherPacingWarning = result.settingsWarning || '';
    if (status) {
      status.dataset.error = '';
      status.dataset.setupSql = 'false';
    }
  } catch (error) {
    machineLabOpen = false;
    teacherPacingAvailable = false;
    const timedOut = error.name === 'TimeoutError';
    teacherPacingWarning = timedOut
      ? '서버 응답 시간이 초과됐어요. 서버의 Supabase 연결과 네트워크를 관리자에게 확인해 주세요.'
      : error.message || '학급 설정을 읽지 못했어요.';
    if (status) {
      const missingSchema = /schema\.sql|설정 SQL|설정 테이블|classroom_learning_settings/i.test(teacherPacingWarning);
      status.dataset.loading = 'false';
      status.textContent = missingSchema
        ? `${teacherPacingWarning} 아래에서 Supabase 설정 SQL을 열어 최신 스키마를 실행해 주세요.`
        : teacherPacingWarning || 'Supabase 서버 설정을 확인하지 못했어요. 관리자에게 알려주세요.';
      status.dataset.error = 'true';
      status.dataset.setupSql = String(missingSchema);
    }
    renderTeacherPacingSetting(teacherPacingWarning);
  } finally {
    if (status) status.dataset.loading = 'false';
    renderTeacherMachineLabSetting();
  }
}

async function toggleTeacherMachineLab() {
  if (!teacherSession) return;
  const button = document.querySelector('#machine-lab-toggle');
  const status = document.querySelector('#machine-lab-teacher-status');
  if (status.dataset.error === 'true') {
    await loadTeacherMachineLabSetting();
    return;
  }
  button.disabled = true;
  try {
    const nextOpen = !machineLabOpen;
    const result = await teacherClassroomSettingsRequest('POST', { machineLabOpen: nextOpen });
    machineLabOpen = Boolean(result.machineLabOpen);
    teacherMissionsPerSession = Math.max(1, Math.min(4, Number(result.missionsPerSession) || teacherMissionsPerSession));
    teacherPacingAvailable = result.pacingAvailable !== false;
    teacherPacingWarning = result.settingsWarning || '';
    status.dataset.error = '';
    status.dataset.setupSql = 'false';
    renderTeacherMachineLabSetting();
    showToast(machineLabOpen ? '움직이는 장치 제작소를 학급에 열었어요.' : '움직이는 장치 제작소를 잠갔어요.');
  } catch (error) {
    status.textContent = error.message;
    status.dataset.error = 'true';
    status.dataset.setupSql = String(/schema\.sql|설정 SQL|설정 테이블|classroom_learning_settings/i.test(error.message || ''));
    renderTeacherMachineLabSetting();
  }
}

document.querySelector('#save-teaching-pace').addEventListener('click', async () => {
  if (!teacherSession || !teacherPacingAvailable) return;
  const select = document.querySelector('#teaching-pace-select');
  renderTeacherPacingSetting('수업 설정을 저장하고 있어요.', true);
  try {
    const result = await teacherClassroomSettingsRequest('POST', { missionsPerSession: Number(select.value) });
    teacherMissionsPerSession = Math.max(1, Math.min(4, Number(result.missionsPerSession) || 1));
    teacherPacingAvailable = result.pacingAvailable !== false;
    teacherPacingWarning = result.settingsWarning || '';
    renderTeacherPacingSetting(`저장했어요. 한 번의 수업에서 ${teacherMissionsPerSession}개 미션을 진행합니다.`);
    showToast('수업당 오늘 미션 개수를 저장했어요.');
  } catch (error) {
    renderTeacherPacingSetting(error.message || '수업 설정을 저장하지 못했어요.');
  } finally {
    renderTeacherPacingSetting(document.querySelector('#teaching-pace-status').textContent);
  }
});
document.querySelector('#teaching-pace-setup-help').addEventListener('click', () => document.querySelector('#open-supabase-setup').click());

function createMachinePart(type, x, z = 0) {
  const defaults = type === 'ramp'
    ? { width: 2.0, height: 0.12, depth: 0.48, angle: -16, yaw: 0, speed: 0 }
    : type === 'turntable'
      ? { width: 1.2, height: 0.12, depth: 1.2, angle: 0, yaw: 0, speed: 1.6 }
      : type === 'lever'
        ? { width: 1.6, height: 0.12, depth: 0.22, angle: 0, yaw: 0, speed: 0, leverArm: 0.55 }
        : { width: 0.62, height: 0.36, depth: 0.62, angle: 0, yaw: 0, speed: 0 };
  const elevation = Math.max(0, machinePlacementHeight);
  const y = type === 'turntable' ? elevation : type === 'lever' ? elevation + 0.42 : elevation + defaults.height / 2;
  return { id: `part-${machine.nextId++}`, type, x, y, z, ...defaults, phase: 0, leverOmega: 0 };
}

function resetMachineBall() {
  machine.ball = { x: -3.04, y: 1.42, z: 0, vx: 0.85, vy: 0, vz: 0, rotation: 0, rotationX: 0, spin: 0 };
  machine.elapsed = 0;
  machineSettleTime = 0;
  machine.parts.forEach((part) => { part.phase = 0; part.leverOmega = 0; });
}

function setMachineResult(message, resultClass = '') {
  const status = document.querySelector('#machine-run-status');
  if (!status) return;
  status.textContent = message;
  status.className = `machine-run-status${resultClass ? ` ${resultClass}` : ''}`;
  machine.result = message;
}

function drawMachine() {
  if (machineThree) machineThree.sync(machine.parts, machine.selectedId, machine.ball);
}

function renderMachinePieceSettings() {
  const part = machine.parts.find((item) => item.id === machine.selectedId);
  const heading = document.querySelector('#machine-selected-name');
  const panel = document.querySelector('#machine-piece-settings');
  if (!part) {
    heading.textContent = machine.tool === 'select' ? '부품을 선택해 보세요' : `${machinePartLabels[machine.tool]} 배치 중`;
    panel.innerHTML = `<p>${machine.tool === 'select' ? '3D 장치판에서 부품을 누르면 선택해요. 부품을 끌어 옆·앞·뒤로 옮길 수 있어요.' : '3D 장치판의 바닥을 눌러 부품을 놓고, 빈 공간을 드래그해 시점을 바꿔 보세요.'}</p>`;
    return;
  }
  heading.textContent = `${machinePartLabels[part.type]} 설정`;
  const turntableControls = part.type === 'turntable'
    ? `<label class="machine-setting-control"><span>회전 속도</span><strong>${Math.abs(part.speed).toFixed(1)} rad/s</strong><input type="range" min="0.4" max="3" step="0.2" value="${Math.abs(part.speed)}" data-machine-setting="speed" aria-label="회전판 각속도"></label><button class="machine-direction-button" type="button" data-machine-action="reverse">${part.speed >= 0 ? '↻ 시계 방향' : '↺ 반대 방향'}</button>`
    : '';
  const leverControls = part.type === 'lever'
    ? `<label class="machine-setting-control"><span>받침점에서 힘을 주는 거리</span><strong>${part.leverArm.toFixed(2)}m</strong><input type="range" min="0.18" max="0.76" step="0.02" value="${part.leverArm}" data-machine-setting="leverArm" aria-label="받침점에서 힘을 주는 거리"></label><p class="machine-lever-hint">받침점에서 멀수록 같은 힘으로도 더 크게 기울어요.</p><div class="machine-lever-buttons"><button type="button" data-machine-action="lever-left">왼쪽 누르기</button><button type="button" data-machine-action="lever-right">오른쪽 누르기</button></div>`
    : '';
  panel.innerHTML = `<label class="machine-setting-control"><span>기울기</span><strong>${Math.round(part.angle)}°</strong><input type="range" min="-55" max="55" step="5" value="${part.angle}" data-machine-setting="angle" aria-label="부품 기울기"></label><label class="machine-setting-control"><span>수평 방향 회전</span><strong>${Math.round(part.yaw)}°</strong><input type="range" min="0" max="345" step="15" value="${part.yaw}" data-machine-setting="yaw" aria-label="부품 수평 방향"></label><label class="machine-setting-control"><span>높이</span><strong>${part.y.toFixed(1)}m</strong><input type="range" min="${Math.max(part.height / 2, 0.06)}" max="3.1" step="0.1" value="${part.y}" data-machine-setting="height" aria-label="부품 높이"></label><label class="machine-setting-control"><span>길이 <strong>${part.width.toFixed(1)}m</strong></span><input type="range" min="0.4" max="2.4" step="0.1" value="${part.width}" data-machine-setting="width" aria-label="부품 길이"></label>${part.type !== 'block' ? `<label class="machine-setting-control"><span>깊이 <strong>${part.depth.toFixed(1)}m</strong></span><input type="range" min="0.12" max="1.8" step="0.1" value="${part.depth}" data-machine-setting="depth" aria-label="부품 깊이"></label>` : ''}${turntableControls}${leverControls}<button class="machine-remove-button" type="button" data-machine-action="delete">선택한 ${machinePartLabels[part.type]} 빼기</button>`;
}

function renderMachineLab() {
  const lockPanel = document.querySelector('#machine-lab-lock-panel');
  const workspace = document.querySelector('#machine-lab-workspace');
  const lockLabel = document.querySelector('#machine-tab-lock');
  if (!lockPanel || !workspace) return;
  const canUse = machineLabAccessChecked && machineLabOpen;
  lockPanel.hidden = canUse;
  workspace.hidden = !canUse;
  lockLabel.hidden = canUse;
  lockPanel.querySelector('#machine-lab-lock-message')?.replaceChildren(document.createTextNode(
    machineLabAccessError || !machineSessionAvailable()
      ? machineLabAccessError || '학생으로 로그인하면 선생님의 학급 설정을 확인할 수 있어요.'
      : machineLabAccessChecked ? '담당 선생님께 학급에서 이 활동을 열어달라고 부탁해 주세요.' : '선생님 설정을 확인하고 있어요.'
  ));
  const importNotice = document.querySelector('#machine-share-import-notice');
  if (importNotice) importNotice.hidden = !canUse || !machineShareImportValid;
  if (!canUse) {
    stopMachineAnimation();
    return;
  }
  document.querySelector('#machine-title').value = machine.title;
  document.querySelector('#machine-board-title').textContent = machine.title.trim() || '새로운 굴림길';
  document.querySelectorAll('[data-machine-part]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.machinePart === machine.tool));
  });
  document.querySelector('#machine-board-hint').textContent = machine.tool === 'select'
    ? '부품을 눌러 고른 뒤 끌어서 위치를 바꿔요.'
    : `${machinePartLabels[machine.tool]}을 골랐어요. 판을 눌러 설치하고, 부품을 끌어 움직여 보세요.`;
  setMachineResult(machine.result);
  renderMachinePieceSettings();
  machineThree?.resize();
  drawMachine();
}

function machineSessionAvailable() { return Boolean(studentSession?.id); }

function getMachineShareLink() {
  const url = new URL(location.href);
  url.searchParams.set('machine', encodeMachineLevel());
  return url.toString();
}

async function shareMachineLevel() {
  if (!await refreshMachineLabAccess() || machine.parts.length > 16) return;
  const url = getMachineShareLink();
  const input = document.querySelector('#machine-share-url');
  input.hidden = true;
  try {
    if (!navigator.clipboard?.writeText || !window.isSecureContext) throw new Error('클립보드 권한을 사용할 수 없어요.');
    await navigator.clipboard.writeText(url);
    setMachineResult('공유 링크를 복사했어요. 링크를 받은 친구도 선생님이 제작소를 열어준 뒤 이용할 수 있어요.', 'shared');
  } catch {
    input.hidden = false;
    input.value = url;
    input.focus();
    input.select();
    setMachineResult('공유 링크를 선택했어요. 복사해 친구에게 보내주세요.', 'shared');
  }
}

function machineCanvasPoint(event, height = 0) {
  return machineThree?.pointOnPlane(event, height) || null;
}

function machinePartAt(event) {
  return machineThree?.hitPart(event) || null;
}

function placeMachinePart(point) {
  if (machine.parts.length >= 16) {
    setMachineResult('한 장치에는 부품을 16개까지 놓을 수 있어요.');
    return;
  }
  const part = createMachinePart(machine.tool, point.x, point.z);
  part.x = Math.max(-machineBoard.width / 2 + part.width / 2, Math.min(machineBoard.width / 2 - part.width / 2, part.x));
  part.z = Math.max(-machineBoard.depth / 2 + part.depth / 2, Math.min(machineBoard.depth / 2 - part.depth / 2, part.z));
  machine.parts.push(part);
  machine.selectedId = part.id;
  machine.result = `${machinePartLabels[part.type]}을 3D 판에 놓았어요. 드래그해서 옆·앞·뒤로 옮겨 보세요.`;
  renderMachineLab();
}

function handleMachinePointerDown(event) {
  if (!machineLabOpen || machine.running || !machineThree) return;
  const part = machinePartAt(event);
  if (part) {
    event.preventDefault();
    event.stopImmediatePropagation();
    machine.selectedId = part.id;
    const point = machineCanvasPoint(event, part.y);
    machineDragState = { id: part.id, offsetX: point ? point.x - part.x : 0, offsetZ: point ? point.z - part.z : 0, planeY: part.y };
    event.currentTarget.setPointerCapture(event.pointerId);
    renderMachinePieceSettings();
    drawMachine();
    return;
  }
  machineDragState = { pendingTool: machine.tool, startX: event.clientX, startY: event.clientY };
}

function handleMachinePointerMove(event) {
  if (!machineDragState || machine.running || machineDragState.pendingTool) return;
  const part = machine.parts.find((item) => item.id === machineDragState.id);
  if (!part) return;
  const point = machineCanvasPoint(event, machineDragState.planeY);
  if (!point) return;
  part.x = Math.max(-machineBoard.width / 2 + part.width / 2, Math.min(machineBoard.width / 2 - part.width / 2, point.x - machineDragState.offsetX));
  part.z = Math.max(-machineBoard.depth / 2 + part.depth / 2, Math.min(machineBoard.depth / 2 - part.depth / 2, point.z - machineDragState.offsetZ));
  drawMachine();
}

function handleMachinePointerUp(event) {
  if (!machineDragState) return;
  if (machineDragState.pendingTool) {
    const movement = Math.hypot(event.clientX - machineDragState.startX, event.clientY - machineDragState.startY);
    if (movement < 7) {
      const point = machineCanvasPoint(event, 0);
      if (machineDragState.pendingTool === 'select') {
        machine.selectedId = null;
        machine.result = '부품을 골라 설정을 바꾸거나 이동해 보세요.';
        renderMachineLab();
      } else if (point && Math.abs(point.x) < machineBoard.width / 2 - 0.12 && Math.abs(point.z) < machineBoard.depth / 2 - 0.12) {
        placeMachinePart(point);
      }
    }
  }
  machineDragState = null;
}

function stepMachinePhysics(dt) {
  const outcome = machineThree?.step(machine.ball, machine.parts, dt);
  machine.elapsed += dt;
  if (outcome === 'won') {
    stopMachineAnimation();
    setMachineResult('도착했어요! 3D 공간에서 중력과 부품의 움직임을 이용해 구슬을 보냈어요.', 'won');
    return;
  }
  if (outcome === 'settled') machineSettleTime += dt;
  else machineSettleTime = 0;
  if (outcome === 'lost' || machine.elapsed > 35 || machineSettleTime > 3) {
    stopMachineAnimation();
    setMachineResult('구슬이 멈췄어요. 부품의 위치나 경사로 각도를 바꿔 다시 해보세요.', 'stopped');
  }
}

function machineAnimationFrame(timestamp) {
  if (!machine.running) return;
  const dt = machineLastFrameTime ? Math.min(0.04, (timestamp - machineLastFrameTime) / 1000) : 1 / 60;
  machineLastFrameTime = timestamp;
  const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
  for (let index = 0; index < steps && machine.running; index += 1) stepMachinePhysics(dt / steps);
  drawMachine();
  if (machine.running) machineAnimationId = requestAnimationFrame(machineAnimationFrame);
}

function stopMachineAnimation() {
  machine.running = false;
  if (machineThree) machineThree.running = false;
  machineLastFrameTime = 0;
  if (machineAnimationId) cancelAnimationFrame(machineAnimationId);
  machineAnimationId = 0;
  document.querySelector('#machine-run').textContent = '구슬 출발!';
  document.querySelector('#machine-run').disabled = !machineLabOpen;
  document.querySelectorAll('[data-machine-part]').forEach((button) => { button.disabled = false; });
  renderMachinePieceSettings();
  drawMachine();
}

function resetMachineRun() {
  stopMachineAnimation();
  resetMachineBall();
  machine.result = '준비됐어요. 구슬을 출발시켜 보세요.';
  renderMachineLab();
}

async function startMachineRun() {
  if (machine.running) {
    stopMachineAnimation();
    setMachineResult('실험을 멈췄어요. 부품을 바꾸고 다시 출발해 보세요.');
    return;
  }
  if (!await refreshMachineLabAccess()) return;
  if (!await ensureMachine3D()) return;
  resetMachineBall();
  machine.running = true;
  machineThree.running = true;
  machine.result = '구슬이 중력에 따라 움직이고 있어요…';
  setMachineResult(machine.result, 'running');
  document.querySelector('#machine-run').textContent = '실험 멈추기';
  document.querySelectorAll('[data-machine-part]').forEach((button) => { button.disabled = true; });
  machineAnimationId = requestAnimationFrame(machineAnimationFrame);
}

async function ensureMachine3D() {
  if (machineThree) return true;
  if (!machineThreeLoader) {
    machineThreeLoader = import('./machine-3d.mjs').then(({ Machine3D: ThreeMachine }) => {
      machineThree = new ThreeMachine(document.querySelector('#machine-canvas'));
      const surface = machineThree.renderer.domElement;
      surface.addEventListener('pointerdown', handleMachinePointerDown, true);
      surface.addEventListener('pointermove', handleMachinePointerMove);
      surface.addEventListener('pointerup', handleMachinePointerUp, true);
      surface.addEventListener('pointercancel', handleMachinePointerUp, true);
      machineThree.sync(machine.parts, machine.selectedId, machine.ball);
      renderMachineLab();
      return true;
    }).catch(() => {
      document.querySelector('#machine-canvas').innerHTML = '<p class="machine-webgl-fallback">3D 화면을 열지 못했어요. WebGL을 지원하는 최신 브라우저에서 다시 열어주세요.</p>';
      machineThree = null;
      machineThreeLoader = null;
      setMachineResult('3D 화면을 준비하지 못했어요. WebGL을 지원하는 최신 브라우저에서 다시 열어주세요.', 'stopped');
      return false;
    });
  }
  return machineThreeLoader;
}

async function openMachineLab() {
  if (!await refreshMachineLabAccess()) return;
  await ensureMachine3D();
}

function initializeMachineLab() {
  document.querySelectorAll('[data-machine-part]').forEach((button) => button.addEventListener('click', () => {
    machine.tool = button.dataset.machinePart;
    machine.selectedId = null;
    renderMachineLab();
  }));
  document.querySelector('#machine-title').addEventListener('input', (event) => {
    machine.title = event.currentTarget.value.slice(0, 40);
    document.querySelector('#machine-board-title').textContent = machine.title.trim() || '새로운 굴림길';
  });
  document.querySelector('#machine-placement-height').addEventListener('input', (event) => {
    machinePlacementHeight = Number(event.currentTarget.value);
    document.querySelector('#machine-placement-height-label').textContent = `${machinePlacementHeight.toFixed(1)}m`;
  });
  document.querySelector('#machine-camera-reset').addEventListener('click', () => machineThree?.resetCamera());
  document.querySelector('#machine-run').addEventListener('click', () => { void startMachineRun(); });
  document.querySelector('#machine-reset').addEventListener('click', resetMachineRun);
  document.querySelector('#machine-clear').addEventListener('click', () => {
    machine.parts = [];
    machine.selectedId = null;
    resetMachineRun();
    setMachineResult('부품을 모두 비웠어요. 새 장치를 만들어 보세요.');
  });
  document.querySelector('#machine-share').addEventListener('click', () => { void shareMachineLevel(); });
  document.querySelector('#machine-lab-refresh-access').addEventListener('click', () => { void refreshMachineLabAccess(); });
document.querySelector('#machine-lab-toggle').addEventListener('click', () => { void toggleTeacherMachineLab(); });
document.querySelector('#machine-lab-setup-help').addEventListener('click', () => document.querySelector('#open-supabase-setup').click());
  document.querySelector('#machine-piece-settings').addEventListener('input', (event) => {
    const input = event.target.closest('[data-machine-setting]');
    const part = machine.parts.find((item) => item.id === machine.selectedId);
    if (!input || !part) return;
    if (input.dataset.machineSetting === 'angle') part.angle = Number(input.value);
    if (input.dataset.machineSetting === 'yaw') part.yaw = Number(input.value);
    if (input.dataset.machineSetting === 'height') part.y = Number(input.value);
    if (input.dataset.machineSetting === 'width') part.width = Number(input.value);
    if (input.dataset.machineSetting === 'depth') part.depth = Number(input.value);
    if (input.dataset.machineSetting === 'speed') part.speed = Math.sign(part.speed || 1) * Number(input.value);
    if (input.dataset.machineSetting === 'leverArm') part.leverArm = Number(input.value);
    const readout = input.parentElement.querySelector('strong');
    if (readout) {
      if (input.dataset.machineSetting === 'angle') readout.textContent = `${Math.round(part.angle)}°`;
      else if (input.dataset.machineSetting === 'yaw') readout.textContent = `${Math.round(part.yaw)}°`;
      else if (input.dataset.machineSetting === 'height') readout.textContent = `${part.y.toFixed(1)}m`;
      else if (input.dataset.machineSetting === 'width') readout.textContent = `${part.width.toFixed(1)}m`;
      else if (input.dataset.machineSetting === 'depth') readout.textContent = `${part.depth.toFixed(1)}m`;
      else if (input.dataset.machineSetting === 'speed') readout.textContent = `${Math.abs(part.speed).toFixed(1)} rad/s`;
      else readout.textContent = `${part.leverArm.toFixed(2)}m`;
    }
    drawMachine();
  });
  document.querySelector('#machine-piece-settings').addEventListener('click', (event) => {
    const button = event.target.closest('[data-machine-action]');
    if (!button) return;
    const part = machine.parts.find((item) => item.id === machine.selectedId);
    if (!part) return;
    if (button.dataset.machineAction === 'delete') {
      machine.parts = machine.parts.filter((item) => item.id !== part.id);
      machine.selectedId = null;
    } else if (button.dataset.machineAction === 'reverse') part.speed *= -1;
    else if (button.dataset.machineAction === 'lever-left' || button.dataset.machineAction === 'lever-right') {
      const inertia = Math.max(900, part.width * part.width * 0.055);
      const direction = button.dataset.machineAction === 'lever-right' ? 1 : -1;
      part.leverOmega = Math.max(-4, Math.min(4, part.leverOmega + direction * 80 * part.leverArm / inertia));
    }
    renderMachineLab();
  });
  renderMachineLab();
}

async function loadStudentSkillProgress() {
  if (!studentSession?.id) return;
  try {
    const client = await getSupabaseClient();
    const { data: { session } } = await client.auth.getSession();
    if (!session?.access_token) throw new Error('로그인 세션을 확인해 주세요.');
    const response = await fetch('/api/student/skill-progress', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || '개념 기록을 읽지 못했어요.');
    studentSkillProgress = Object.fromEntries((result.progress || []).map((row) => [row.skill, row]));
  } catch {
    studentSkillProgress = {};
    showToast('개념별 기록을 읽지 못했어요. 최신 Supabase SQL을 확인해 주세요.');
  }
  renderLearningProfile();
}

async function recordSkillAttempt(skill, correct, hints = 0, unitId = activeStudyUnitId) {
  if (!studentSession?.id || !learningSkillLabels[skill]) return;
  try {
    const client = await getSupabaseClient();
    const { data: { session } } = await client.auth.getSession();
    if (!session?.access_token) return;
    const response = await fetch('/api/student/skill-progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ skill, unitId, correct, hints: Math.max(0, Math.min(10, Number(hints) || 0)) }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || '개념 기록을 저장하지 못했어요.');
    studentSkillProgress[skill] = result.progress;
    renderLearningProfile();
  } catch {
    showToast('개념별 기록을 저장하지 못했어요.');
  }
}

function renderMission() {
  const index = Math.min(Number(missionProgress.lesson_index) || 0, dailyMissions.length - 1);
  const mission = dailyMissions[index];
  const unit = curriculumUnitById[mission.unitId] || curriculumUnits[0];
  updateNotebookPrompt(mission.questionTitle);
  const unitNumber = curriculumUnits.findIndex((entry) => entry.id === unit.id) + 1;
  const attempts = Number(missionProgress.attempts) || 0;
  const sessionStartIndex = Math.max(0, Math.min(index, Number(missionProgress.session_start_index) || 0));
  const configuredSessionCount = Math.max(1, Math.min(4, Number(missionProgress.missions_per_session) || classMissionsPerSession || 1));
  const sessionMissionCount = Math.max(1, Math.min(
    Number(missionProgress.session_mission_count) || configuredSessionCount,
    dailyMissions.length - sessionStartIndex,
  ));
  const missionInSession = Math.max(1, index - sessionStartIndex + 1);
  const wasRetried = attempts > 0 && (!missionProgress.completed_at || !missionProgress.completed_correctly);
  const activeMission = wasRetried && mission.retry ? mission.retry : mission;
  const unitProgress = curriculumUnits.map((curriculumUnit) => {
    const indexes = dailyMissions.map((lesson, lessonIndex) => lesson.unitId === curriculumUnit.id ? lessonIndex : -1).filter((lessonIndex) => lessonIndex >= 0);
    const first = indexes[0];
    const last = indexes[indexes.length - 1];
    return {
      unit: curriculumUnit,
      first,
      last,
      completed: last < index || (last === index && Boolean(missionProgress.completed_at)),
      current: index >= first && index <= last && !missionProgress.completed_at,
    };
  });
  const completedUnits = unitProgress.filter((entry) => entry.completed);
  const garden = document.querySelector('#bean-garden-seeds');
  garden.replaceChildren();
  unitProgress.forEach((entry) => {
    const seed = document.createElement('span');
    const watered = entry.current && attempts > 0;
    seed.className = `bean-garden-seed${entry.completed ? ' grown' : ''}${entry.current ? ' current' : ''}${watered ? ' watered' : ''}`;
    seed.title = entry.unit.title;
    seed.setAttribute('aria-label', `${entry.unit.title}${entry.completed ? ' 완료' : entry.current ? ' 학습 중' : ' 시작 전'}`);
    seed.innerHTML = '<i class="garden-bean"></i><i class="garden-leaf"></i>';
    garden.append(seed);
  });
  document.querySelector('#bean-garden-progress').textContent = `${completedUnits.length} / ${curriculumUnits.length} 단원`;
  document.querySelector('#bean-garden-note').textContent = missionProgress.completed_at
    ? `정답 여부와 관계없이 ${unit.title}에서 도전한 씨앗이 자랐어요.`
    : attempts > 0
      ? `${unit.title}에서 다시 생각해 본 것도 성장의 한 걸음이에요.`
      : `${unit.title}에서 한 걸음씩 배워가요. 정답보다 도전한 과정이 중요해요.`;
  document.querySelector('#bean-garden-seeds').setAttribute('aria-label', `${curriculumUnits.length}개 단원 중 ${completedUnits.length}개 단원을 마쳤어요.`);
  const lessonInUnit = index - unitProgress.find((entry) => entry.unit.id === unit.id).first + 1;
  document.querySelector('#today-unit-label').textContent = `${activeGrade}학년 2학기 · ${unitNumber}단원 ${unit.title}`;
  document.querySelector('#quest-kicker').textContent = `${unit.title} · 오늘의 배움 ${lessonInUnit}/${unit.missionCount}`;
  const sessionNote = document.querySelector('#quest-session-note');
  sessionNote.hidden = false;
  sessionNote.textContent = sessionMissionCount > 1
    ? `이번 수업 ${missionInSession}/${sessionMissionCount}번째 미션`
    : '이번 수업 미션';
  document.querySelector('#quest-title').innerHTML = formatFractionText(activeMission.questionTitle);
  document.querySelector('#quest-question').innerHTML = formatFractionText(activeMission.question);
  document.querySelector('#quest-hintline').innerHTML = formatFractionText(activeMission.hint);
  document.querySelector('#mission-visual').innerHTML = buildMissionVisual(activeMission);
  document.querySelector('#quest-time').textContent = missionProgress.completed_at ? '오늘 미션 완료' : missionAnswerPending ? '저장 중...' : attempts >= 2 ? '다른 방법으로 다시 보기' : '천천히 살펴봐요';

  const choices = document.querySelector('#quest-choices');
  choices.replaceChildren();
  activeMission.choices.forEach((answer) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.questAnswer = answer;
    button.setAttribute('aria-pressed', 'false');
    button.innerHTML = formatFractionText(answer);
    button.disabled = Boolean(missionProgress.completed_at || missionAnswerPending || attempts >= 2);
    choices.append(button);
  });
  const skipButton = document.querySelector('#skip-mission');
  skipButton.hidden = Boolean(missionProgress.completed_at || attempts < 2);
  skipButton.textContent = sessionMissionCount > missionInSession
    ? '이 미션 건너뛰고 다음 수업 미션으로'
    : '오늘 수업 미션은 여기까지';
  skipButton.disabled = missionAnswerPending;

  const feedback = document.querySelector('#quest-feedback');
  if (missionProgress.completed_at) {
    feedback.hidden = false;
    feedback.classList.toggle('is-success', Boolean(missionProgress.completed_correctly));
    feedback.innerHTML = formatFractionText(missionFeedbackState?.text || (missionProgress.completed_correctly ? mission.correctText : mission.retryText));
    const unlockAt = Date.parse(missionProgress.completed_at) + 24 * 60 * 60 * 1000;
    document.querySelector('#quest-footer').textContent = index < dailyMissions.length - 1
      ? `이번 수업 ${sessionMissionCount}개 미션을 마쳤어요. 다음 수업 미션은 ${new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(unlockAt))} 이후에 열려요. 함께 공부는 언제든 할 수 있어요.`
      : '준비된 배움 순서를 마쳤어요. 함께 공부에서 원하는 만큼 복습해요.';
  } else if (missionFeedbackState) {
    feedback.hidden = false;
    feedback.classList.toggle('is-success', missionFeedbackState.correct);
    feedback.innerHTML = formatFractionText(missionFeedbackState.text);
    document.querySelector('#quest-footer').textContent = missionAnswerPending ? '답을 저장하고 있어요.' : '다시 골라도 괜찮아요. 함께 공부에서 더 물어볼 수도 있어요.';
  } else {
    feedback.hidden = true;
    feedback.classList.remove('is-success');
    document.querySelector('#quest-footer').textContent = missionAnswerPending
      ? '답을 저장하고 있어요.'
      : attempts >= 2
        ? '두 번 다시 생각해 봤어요. 아래에서 오늘은 여기까지 하거나 함께 공부로 이어가요.'
        : attempts > 0
          ? '같은 개념을 다른 숫자로 다시 풀어봐요.'
          : '정답을 몰라도 괜찮아요. 그림과 힌트를 보고 골라봐요.';
  }
}

async function loadStudentLearningPath() {
  if (!studentSession?.id) return;
  try {
    const client = await getSupabaseClient();
    const { data: { session } } = await client.auth.getSession();
    if (!session?.access_token) throw new Error('로그인 세션을 확인해 주세요.');
    const response = await fetch('/api/student/learning-path', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.progress) throw new Error(result.error || '오늘의 배움 기록을 읽지 못했어요.');
    classMissionsPerSession = Math.max(1, Math.min(4, Number(result.missionsPerSession) || 1));
    if (result.pacingAvailable === false && !missionPacingNoticeShown) {
      missionPacingNoticeShown = true;
      showToast('수업당 미션 수 조절은 최신 Supabase 설정 SQL을 실행하면 사용할 수 있어요. 기본은 한 번에 1개예요.');
    }
    missionProgress = result.progress;
    missionFeedbackState = null;
    setActiveStudyUnit(dailyMissions[Math.min(Number(missionProgress.lesson_index) || 0, dailyMissions.length - 1)].unitId);
  } catch {
    classMissionsPerSession = 1;
    missionProgress = { lesson_index: 0, completed_at: null, completed_correctly: null };
    missionAnswerPending = false;
    missionFeedbackState = null;
    setActiveStudyUnit(dailyMissions[0].unitId);
    showToast('차시 이동 기록을 읽지 못했어요. 최신 Supabase SQL을 실행했는지 확인해 주세요.');
  }
  renderMission();
  updateBattleProgress();
}

async function submitMissionAnswer(correct) {
  if (!studentSession?.id || missionAnswerPending || missionProgress.completed_at) return;
  missionAnswerPending = true;
  renderMission();
  try {
    const client = await getSupabaseClient();
    const { data: { session } } = await client.auth.getSession();
    if (!session?.access_token) throw new Error('로그인 세션을 확인해 주세요.');
    const response = await fetch('/api/student/learning-path', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ lessonIndex: missionProgress.lesson_index, correct }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.progress) throw new Error(result.error || '미션 완료를 저장하지 못했어요.');
    classMissionsPerSession = Math.max(1, Math.min(4, Number(result.missionsPerSession) || classMissionsPerSession));
    if (result.pacingAvailable === false && !missionPacingNoticeShown) {
      missionPacingNoticeShown = true;
      showToast('Supabase 수업 진도 설정이 오래되어 현재는 한 번에 1개 미션으로 진행해요.');
    }
    missionProgress = result.progress;
    if (result.sessionAdvanced) {
      missionFeedbackState = null;
      showToast('이번 미션을 마쳤어요. 이번 수업의 다음 미션을 이어서 풀어봐요.');
    }
  } catch (error) {
    showToast(error.message || '미션 완료를 저장하지 못했어요.');
  } finally {
    missionAnswerPending = false;
    renderMission();
  }
}

async function skipMissionForToday() {
  if (!studentSession?.id || missionAnswerPending || missionProgress.completed_at) return;
  missionAnswerPending = true;
  renderMission();
  try {
    const client = await getSupabaseClient();
    const { data: { session } } = await client.auth.getSession();
    if (!session?.access_token) throw new Error('로그인 세션을 확인해 주세요.');
    const response = await fetch('/api/student/learning-path', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ lessonIndex: missionProgress.lesson_index, skip: true }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.progress) throw new Error(result.error || '오늘 미션을 마무리하지 못했어요.');
    classMissionsPerSession = Math.max(1, Math.min(4, Number(result.missionsPerSession) || classMissionsPerSession));
    missionProgress = result.progress;
    if (result.sessionAdvanced) {
      missionFeedbackState = null;
      showToast('이 미션을 건너뛰고 이번 수업의 다음 미션으로 넘어가요.');
    } else if (!missionProgress.completed_at) {
      throw new Error(result.error || '이번 수업 미션을 마무리하지 못했어요.');
    }
  } catch (error) {
    showToast(error.message || '오늘 미션을 마무리하지 못했어요.');
  } finally {
    missionAnswerPending = false;
    renderMission();
  }
}

async function restoreSupabaseSession() {
  try {
    const client = await getSupabaseClient();
    const { data: { session } } = await client.auth.getSession();
    if (!session?.user) return;
    const { data: profile, error } = await client.from('profiles')
      .select('id, role, grade, class_number, student_number, display_name')
      .eq('id', session.user.id)
      .maybeSingle();
    if (error || !profile) {
      await client.auth.signOut();
      return;
    }
    currentAuthUser = session.user;
    if (profile.role === 'student') {
      setCurriculumGrade(profile.grade);
      studentSession = { id: profile.id, grade: profile.grade, classNumber: profile.class_number, number: profile.student_number, name: profile.display_name };
      activeDataStudentId = profile.id;
      data = loadData(profile.id);
      renderStats();
      updateBattleProgress();
      await loadStudentSkillProgress();
      await loadStudentLearningPath();
      await refreshMachineLabAccess();
      document.querySelector('#student-session-label').textContent = `${profile.class_number}반 ${profile.student_number}번 ${profile.display_name}`;
      showRole('student');
      if (new URLSearchParams(location.search).has('machine')) showStudentView('machine');
      publishStudentActivity('오늘 미션');
    } else if (profile.role === 'teacher') {
      setCurriculumGrade(profile.grade);
      teacherSession = { id: profile.id, grade: profile.grade, classNumber: profile.class_number, name: profile.display_name };
      document.querySelector('#teacher-class-label').textContent = `${profile.grade}학년 ${profile.class_number}반`;
      document.querySelector('#teacher-session-label').textContent = profile.display_name;
      showRole('teacher');
      await startTeacherRealtime();
    }
  } catch {
    showToast('Supabase 연결 설정을 확인해 주세요.');
  }
}

function dataStorageKey(studentId = activeDataStudentId) {
  return studentId ? `${STORAGE_KEY}:${studentId}` : STORAGE_KEY;
}

function loadData(studentId = activeDataStudentId) {
  try {
    const saved = JSON.parse(localStorage.getItem(dataStorageKey(studentId)) || '{}');
    const savedBattleCompleted = saved.battleCompleted && typeof saved.battleCompleted === 'object' && !Array.isArray(saved.battleCompleted)
      ? saved.battleCompleted
      : {};
    return {
      total: Number(saved.total) || 0,
      attempts: Number(saved.attempts) || 0,
      correct: Number(saved.correct) || 0,
      battleCompleted: Object.fromEntries(Object.entries(savedBattleCompleted).map(([unitId, ids]) => [unitId, Array.isArray(ids) ? ids.filter((id) => typeof id === 'string') : []])),
      activeStudents: Array.isArray(saved.activeStudents) ? saved.activeStudents : [],
      records: Array.isArray(saved.records) ? saved.records.slice(0, 20) : [],
    };
  } catch {
    return { total: 0, attempts: 0, correct: 0, battleCompleted: {}, activeStudents: [], records: [] };
  }
}

function saveData() {
  try {
    localStorage.setItem(dataStorageKey(), JSON.stringify(data));
    activityChannel?.postMessage({ type: 'student-data-updated', studentId: activeDataStudentId });
  } catch {
    showToast('이 기기에서 기록을 저장할 수 없어요.');
  }
  renderStats();
}

function escapeHTML(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function formatFractionText(value) {
  return escapeHTML(String(value)).replace(/(?<![\d.])(\d+)\s*\/\s*(\d+)(?![\d.])/g,
    '<span class="math-fraction" role="img" aria-label="$2분의 $1"><span aria-hidden="true">$1</span><span aria-hidden="true">$2</span></span>');
}

function renderQuestionFractions() {
  const panel = document.querySelector('#question-fractions');
  const list = document.querySelector('#question-fraction-items');
  list.replaceChildren();
  panel.hidden = attachedQuestionFractions.length === 0;
  attachedQuestionFractions.forEach(({ whole = 0, numerator, denominator }, index) => {
    const chip = document.createElement('span');
    chip.className = 'question-fraction-chip';
    const fraction = document.createElement('span');
    fraction.innerHTML = `${whole ? `${whole}과 ` : ''}${formatFractionText(`${numerator}/${denominator}`)}`;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.dataset.removeFraction = String(index);
    remove.setAttribute('aria-label', `${whole ? `${whole}와 ` : ''}${denominator}분의 ${numerator} 삭제`);
    remove.textContent = '×';
    chip.append(fraction, remove);
    list.append(chip);
  });
}

function setQuestionFractionMode(mode, focusInput = true) {
  questionFractionKind = mode;
  const mixed = mode === 'mixed';
  fractionWholeField.hidden = !mixed;
  simpleFractionMode.setAttribute('aria-pressed', String(!mixed));
  mixedFractionMode.setAttribute('aria-pressed', String(mixed));
  fractionBuilder.querySelector(':scope > p:first-child').textContent = mixed
    ? '자연수는 왼쪽 칸, 분자는 위 칸, 분모는 아래 칸에 적어요.'
    : '위 칸에 분자, 아래 칸에 분모를 적어요.';
  fractionBuilderMessage.textContent = '';
  if (focusInput) (mixed ? fractionWholeInput : fractionNumerator).focus();
}

function resetQuestionFractionBuilder() {
  attachedQuestionFractions.length = 0;
  renderQuestionFractions();
  fractionWholeInput.value = '';
  fractionNumerator.value = '';
  fractionDenominator.value = '';
  setQuestionFractionMode('fraction', false);
  fractionBuilder.hidden = true;
  document.querySelector('#toggle-fraction-builder').setAttribute('aria-expanded', 'false');
}

function addMessage(role, text, options = {}) {
  const article = document.createElement('article');
  article.className = `message ${role === 'user' ? 'user-message' : 'tutor-message'}`;
  const safeText = formatFractionText(text);
  const time = new Intl.DateTimeFormat('ko-KR', { hour: 'numeric', minute: '2-digit' }).format(new Date());
  const visual = options.visualMarkup || (options.calculation ? calculationVisual(options.calculation) : '');
  const actions = options.actions ? `<button class="inline-action" type="button" data-action="${options.actions}">${options.actions === 'hint' ? '힌트 하나 더 받기' : '확인 문제 풀어보기'} <span aria-hidden="true">↗</span></button>` : '';
  article.innerHTML = `<span class="message-avatar">${role === 'user' ? '나' : '콩'}</span><div class="message-body"><div class="message-meta">${role === 'user' ? '나' : '콩이 튜터'} <time>${time}</time></div><div class="bubble">${safeText}</div>${visual}${actions}</div>`;
  elements.messages.append(article);
  elements.messages.scrollTop = elements.messages.scrollHeight;
  return article;
}

function parseDecimalOperation(question) {
  const symbolMatch = question.match(/(\d+(?:\.\d+)?)\s*([+\-−])\s*(\d+(?:\.\d+)?)/);
  const wordAdd = question.match(/(\d+(?:\.\d+)?)\s*(?:과|와)\s*(\d+(?:\.\d+)?)\s*(?:의\s*)?(?:합|더)/);
  const wordSubtract = question.match(/(\d+(?:\.\d+)?)\s*에서\s*(\d+(?:\.\d+)?)\s*(?:을|를)?\s*(?:빼|뺀)/);
  const match = symbolMatch || wordAdd || wordSubtract;
  if (!match) return null;
  const left = match[1];
  const operator = symbolMatch ? (match[2] === '+' ? '+' : '-') : wordSubtract ? '-' : '+';
  const right = symbolMatch ? match[3] : match[2];
  const places = Math.max(left.split('.')[1]?.length || 0, right.split('.')[1]?.length || 0);
  if (places > 2) return { unsupported: true };
  const scale = 10 ** places;
  const toUnits = (value) => {
    const [whole, fraction = ''] = value.split('.');
    return Number(whole) * scale + Number(fraction.padEnd(places, '0') || 0);
  };
  const leftUnits = toUnits(left);
  const rightUnits = toUnits(right);
  const resultUnits = operator === '+' ? leftUnits + rightUnits : leftUnits - rightUnits;
  if (resultUnits < 0) return { unsupported: true };
  const format = (units) => {
    const whole = Math.floor(units / scale);
    const fraction = places ? String(units % scale).padStart(places, '0').replace(/0+$/, '') : '';
    return fraction ? `${whole}.${fraction}` : String(whole);
  };
  const align = (value) => {
    if (!places) return value;
    const [whole, fraction = ''] = value.split('.');
    return `${whole}.${fraction.padEnd(places, '0')}`;
  };
  return {
    left,
    right,
    operator,
    places,
    leftAligned: align(left),
    rightAligned: align(right),
    result: format(resultUnits),
  };
}

function updateNotebookPrompt(question) {
  const calculation = parseDecimalOperation(question);
  notebookCurrentPrompt = calculation && !calculation.unsupported
    ? `${calculation.left} ${calculation.operator} ${calculation.right} = ?`
    : `${question.slice(0, 34)}${question.length > 34 ? '…' : ''}`;
  document.querySelector('#notebook-current-problem').innerHTML = formatFractionText(notebookCurrentPrompt);
}

function calculationVisual(calculation) {
  const rows = `<div class="calculation-row"><span></span><span>${escapeHTML(calculation.leftAligned)}</span></div><div class="calculation-row"><span>${calculation.operator}</span><span>${escapeHTML(calculation.rightAligned)}</span></div>`;
  const result = calculation.showResult ? `<div class="calculation-row calculation-answer"><span></span><span>${escapeHTML(calculation.result)}</span></div>` : '';
  return `<div class="visual-card calculation-card"><div class="visual-title">소수점을 맞춰 세로로 써요</div><div class="calculation-stack">${rows}<hr>${result}</div><p class="visual-caption">소수점끼리 맞추면 같은 자리끼리 계산할 수 있어요</p></div>`;
}

function hundredthsVisual(value = '0.37') {
  const number = Number(value);
  const count = Math.max(0, Math.min(100, Math.round(number * 100)));
  const formatted = number.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  const cells = Array.from({ length: 100 }, (_, index) => `<i${index < count ? ' class="shaded"' : ''}></i>`).join('');
  return `<div class="visual-card place-value-card"><div class="visual-title">100칸 모형 · ${formatted}</div><div class="mini-hundred-grid" role="img" aria-label="100칸 중 ${count}칸이 색칠된 그림">${cells}</div><p class="visual-caption">색칠한 ${count}칸은 0.01이 ${count}개예요. 10칸씩 묶어 살펴봐요.</p></div>`;
}

function placeValueRow(value, label = value) {
  const [whole, fraction = ''] = value.split('.');
  const digits = [whole, fraction[0] || '0', fraction[1] || '0', fraction[2] || '0'];
  return `<div class="place-value-row" role="row"><strong>${escapeHTML(label)}</strong>${digits.map((digit) => `<span role="cell">${escapeHTML(digit)}</span>`).join('')}</div>`;
}

function placeValueChart(value, title) {
  const headers = ['일의 자리', '소수 첫째', '소수 둘째', '소수 셋째'];
  return `<div class="visual-card mission-place-value"><div class="visual-title">${escapeHTML(title)}</div><div class="place-value-chart" role="table"><div class="place-value-row place-value-head" role="row"><strong></strong>${headers.map((header) => `<span role="columnheader">${header}</span>`).join('')}</div>${placeValueRow(value)}</div></div>`;
}

function fractionBarsVisual(bars = [{ numerator: 2, denominator: 5 }, { numerator: 1, denominator: 5 }], title = '분모가 같은 크기 조각끼리 모아요', caption = '아래쪽 숫자는 한 조각의 크기, 위쪽 숫자는 조각 수를 나타내요.') {
  const rows = bars.map((bar, index) => {
    const cells = Array.from({ length: bar.denominator }, (_, cell) => `<i${cell < bar.numerator ? ' class="filled"' : ''}></i>`).join('');
    return `<div class="fraction-bar-row"><strong>${index ? '두 번째 수' : '첫 번째 수'} · ${formatFractionText(`${bar.numerator}/${bar.denominator}`)}</strong><div class="fraction-bar" role="img" aria-label="${bar.denominator}칸 중 ${bar.numerator}칸 색칠">${cells}</div></div>`;
  }).join('');
  return `<div class="visual-card fraction-model"><div class="visual-title">${title}</div>${rows}<p class="visual-caption">${caption}</p></div>`;
}

function multiplicationVisual(data = {}) {
  const left = Number(data.left) || 0;
  const right = Number(data.right) || 0;
  if (!left || !right) return '<div class="visual-card multiplication-model"><div class="visual-title">같은 수를 여러 묶음으로 모아요</div><div class="multiplication-parts"><span>한 묶음의 수</span><b>×</b><span>묶음 수</span></div><p class="visual-caption">곱셈은 같은 수를 여러 번 더하는 계산이에요.</p></div>';
  const rightParts = String(right).split('').map((digit, index, digits) => Number(digit) * (10 ** (digits.length - index - 1))).filter(Boolean);
  const leftParts = String(left).split('').map((digit, index, digits) => Number(digit) * (10 ** (digits.length - index - 1))).filter(Boolean);
  const parts = rightParts.length > 1
    ? rightParts.map((part) => `<span>${left} × ${part}</span>`).join('<b>+</b>')
    : leftParts.length > 1
      ? leftParts.map((part) => `<span>${part} × ${right}</span>`).join('<b>+</b>')
      : `<span>${left} × ${right}</span>`;
  return `<div class="visual-card multiplication-model"><div class="visual-title">자리값으로 나누어 곱해요</div><div class="multiplication-equation">${left} × ${right}</div><div class="multiplication-parts">${parts}</div><p class="visual-caption">각 자리의 곱을 더해요.</p></div>`;
}

function divisionVisual(data = {}) {
  if (!data.dividend || !data.divisor) return '<div class="visual-card division-model"><div class="visual-title">똑같이 나누어 묶어요</div><div class="multiplication-parts"><span>전체 개수</span><b>÷</b><span>묶음 수</span></div><p class="visual-caption">몫은 한 묶음의 수, 나머지는 묶고 남은 수예요.</p></div>';
  const divisor = Math.max(1, Math.min(10, Number(data.divisor) || 1));
  const groups = Array.from({ length: divisor }, (_, index) => `<span>${index + 1}번째 묶음</span>`).join('');
  return `<div class="visual-card division-model"><div class="visual-title">${Number(data.dividend) || 0}개를 ${divisor}묶음으로 나누어요</div><div class="division-groups">${groups}</div><p class="visual-caption">같은 수씩 나누고 남는 것이 있으면 나머지로 나타내요.</p></div>`;
}

function circleVisual(data = {}) {
  const kind = data.kind || 'radius';
  const lines = kind === 'diameter'
    ? '<path d="M35 100H185" stroke="#d8875e" stroke-width="4"/><circle cx="35" cy="100" r="5" fill="#d8875e"/><circle cx="185" cy="100" r="5" fill="#d8875e"/><text x="110" y="88" text-anchor="middle">지름</text>'
    : kind === 'radius'
      ? '<path d="M110 100L165 55" stroke="#d8875e" stroke-width="4"/><circle cx="110" cy="100" r="5" fill="#354a76"/><circle cx="165" cy="55" r="5" fill="#d8875e"/><text x="141" y="73">반지름</text>'
      : kind === 'compass'
        ? '<path d="M110 42L75 145M110 42L145 145M75 145Q110 175 145 145" fill="none" stroke="#d8875e" stroke-width="4" stroke-linecap="round"/><circle cx="110" cy="42" r="7" fill="#536a94"/><path d="M110 42V22" stroke="#536a94" stroke-width="4"/><text x="110" y="168" text-anchor="middle">다리 사이가 반지름</text>'
      : '<circle cx="110" cy="100" r="6" fill="#d8875e"/><text x="120" y="105">중심</text>';
  const caption = kind === 'diameter' ? '지름은 중심을 지나 원의 양 끝을 이어요.' : kind === 'radius' ? '반지름은 중심에서 원 위까지의 선분이에요.' : kind === 'compass' ? '컴퍼스 다리 사이 거리가 원의 반지름이 돼요.' : '원의 중심에서 원 위까지의 거리는 모두 같아요.';
  return `<div class="visual-card circle-model"><div class="visual-title">원의 중심과 반지름</div><svg class="shape-svg" viewBox="0 0 220 200" role="img" aria-label="${caption}"><circle cx="110" cy="100" r="70" fill="#eef2de" stroke="#536a94" stroke-width="4"/>${lines}</svg><p class="visual-caption">${caption}</p></div>`;
}

function measurementVisual(data = {}) {
  const isCapacity = data.kind === 'capacity';
  const baseUnit = isCapacity ? 'mL' : 'g';
  const largeUnit = isCapacity ? 'L' : 'kg';
  if (data.generic) return `<div class="visual-card measurement-model"><div class="visual-title">${isCapacity ? '들이' : '무게'}의 단위를 바꾸어요</div><div class="measurement-equation">1${largeUnit} = 1000${baseUnit}</div><p class="visual-caption">큰 단위와 작은 단위를 먼저 같은 단위로 바꾸어 계산해요.</p></div>`;
  const value = Number(data.value) || 0;
  const large = Math.floor(value / 1000);
  const small = value % 1000;
  return `<div class="visual-card measurement-model"><div class="visual-title">${isCapacity ? '들이' : '무게'}의 단위를 바꾸어 봐요</div><div class="measurement-equation">1${largeUnit} = 1000${baseUnit}</div><strong>${large}${largeUnit} ${small}${baseUnit}</strong><p class="visual-caption">큰 단위를 작은 단위로 바꾸려면 1000배 해요.</p></div>`;
}

function dataOrganizationVisual(data = {}) {
  if (data.generic) return '<div class="visual-card data-table-model"><div class="visual-title">자료를 표나 그림그래프로 정리해요</div><div class="multiplication-parts"><span>항목</span><b>→</b><span>개수</span></div><p class="visual-caption">항목마다 자료 수를 세어 알맞은 칸에 적어요.</p></div>';
  if (data.pictograph) {
    const { label = '자료', symbolCount = 0, key = 1 } = data.pictograph;
    const symbols = Array.from({ length: Math.min(12, symbolCount) }, () => '<i aria-hidden="true">●</i>').join('');
    return `<div class="visual-card data-table-model"><div class="visual-title">그림그래프의 기호를 읽어요</div><div class="pictograph-row"><strong>${escapeHTML(label)}</strong><span>${symbols}</span></div><p class="visual-caption">기호 1개는 ${key}개를 나타내요.</p></div>`;
  }
  const rows = (data.rows || []).map(([label, value]) => `<tr><th>${escapeHTML(String(label))}</th><td>${escapeHTML(String(value))}</td></tr>`).join('');
  return `<div class="visual-card data-table-model"><div class="visual-title">자료를 표로 정리해요</div><table><tbody>${rows}</tbody></table><p class="visual-caption">항목별 수를 비교하거나 모두 더할 수 있어요.</p></div>`;
}

function fractionDivisionVisual(data = {}) {
  if (!data.numerator || !data.denominator) return '<div class="visual-card fraction-model"><div class="visual-title">분수의 나눗셈</div><div class="fraction-product-rule"><span>분수 ÷ 자연수</span><b>또는</b><span>분수 ÷ 분수</span></div><p class="visual-caption">분수끼리 나눌 때는 나누는 분수를 뒤집어 곱해요.</p></div>';
  const numerator = Number(data.numerator) || 0;
  const denominator = Number(data.denominator) || 1;
  const divisorNumerator = Number(data.divisorNumerator) || 0;
  const divisorDenominator = Number(data.divisorDenominator) || 1;
  const dividendText = `${data.whole ? `${data.whole}과 ` : ''}${numerator}/${denominator}`;
  const divisorText = divisorNumerator ? `${divisorNumerator}/${divisorDenominator}` : String(data.divisor || 1);
  const hint = divisorNumerator ? '나누는 분수를 뒤집어 곱해요.' : '분수에 자연수를 나눌 때는 분모에 자연수를 곱해요.';
  const count = Math.min(denominator, 12);
  const cells = Array.from({ length: count }, (_, index) => `<i${index < Math.min(numerator, count) ? ' class="filled"' : ''}></i>`).join('');
  return `<div class="visual-card fraction-model"><div class="visual-title">${formatFractionText(`${dividendText} ÷ ${divisorText}`)}</div><div class="fraction-division-bar" style="--division-cells:${count}">${cells}</div><p class="visual-caption">${hint}</p></div>`;
}

function decimalDivisionVisual(data = {}) {
  if (data.generic || !data.dividend || !data.divisor) return '<div class="visual-card decimal-division-model"><div class="visual-title">소수 나눗셈의 순서</div><div class="decimal-product-steps"><span>나누는 수의 소수점을 옮겨 자연수로 만들기</span><b>→</b><span>두 수의 소수점을 똑같이 옮기기</span><b>→</b><span>나눗셈하기</span></div></div>';
  const dividend = data.dividend ?? '';
  const divisor = data.divisor ?? '';
  const places = String(divisor).split('.')[1]?.length || 0;
  const scale = 10 ** places;
  return `<div class="visual-card decimal-division-model"><div class="visual-title">나누는 수를 자연수로 바꾸어요</div><div class="decimal-division-equation"><span>${dividend} ÷ ${divisor}</span><b>→</b><span>${places ? `${Number(dividend) * scale} ÷ ${Number(divisor) * scale}` : `${dividend} ÷ ${divisor}`}</span></div><p class="visual-caption">나누어지는 수와 나누는 수를 같은 수만큼 곱해요.</p></div>`;
}

function spaceSolidsVisual(data = {}) {
  const stacks = Array.isArray(data.stacks) ? data.stacks : [];
  if (!stacks.length) return '<div class="visual-card space-solids-model"><div class="visual-title">입체도형을 여러 방향에서 봐요</div><div class="space-view-labels"><span>위</span><span>앞</span><span>옆</span></div><p class="visual-caption">위에서 보면 바닥 자리, 앞이나 옆에서 보면 보이는 높이를 살펴봐요.</p></div>';
  const highest = Math.max(1, ...stacks.flat());
  const columns = Math.max(1, ...stacks.map((row) => row.length));
  const cells = stacks.flatMap((row, rowIndex) => Array.from({ length: columns }, (_, columnIndex) => {
    const height = row[columnIndex] || 0;
    return `<div class="space-stack-cell" aria-label="${height}개 쌓기나무"><span style="--stack-height:${height / highest * 100}%"></span><small>${height || '·'}</small></div>`;
  })).join('');
  return `<div class="visual-card space-solids-model"><div class="visual-title">자리별로 쌓인 높이를 살펴봐요</div><div class="space-stack-grid" style="--space-columns:${columns}">${cells}</div><p class="visual-caption">위에서 본 모양은 자리를 세고, 앞·옆에서 본 모양은 각 자리의 높이를 살펴봐요.</p></div>`;
}

function ratioProportionVisual(data = {}) {
  if (!data.left || !data.right) return '<div class="visual-card ratio-model"><div class="visual-title">비를 같은 크기 묶음으로 나타내요</div><div class="ratio-proportion-rule"><span>앞의 수</span><b>:</b><span>뒤의 수</span><b>=</b><span>앞의 수 × 같은 수 : 뒤의 수 × 같은 수</span></div><p class="visual-caption">전체를 비례배분할 때는 먼저 비의 합을 구해요.</p></div>';
  const left = Math.max(1, Math.min(10, Number(data.left) || 1));
  const right = Math.max(1, Math.min(10, Number(data.right) || 1));
  const unit = data.total ? Number(data.total) / (left + right) : null;
  const boxes = (count, label) => Array.from({ length: count }, () => `<i>${unit ? unit : ''}</i>`).join('');
  return `<div class="visual-card ratio-model"><div class="visual-title">비의 두 수를 같은 크기 묶음으로 나타내요</div><div class="ratio-row"><strong>앞</strong><span>${boxes(left, '앞')}</span><b>${left}</b></div><div class="ratio-row"><strong>뒤</strong><span>${boxes(right, '뒤')}</span><b>${right}</b></div><p class="visual-caption">두 줄의 한 칸 크기는 같아요. ${data.total ? `전체 ${data.total}을 비의 합 ${left + right}로 나누어 한 칸의 수를 찾아요.` : '비의 두 수를 같은 수만큼 곱하거나 나누어도 비의 값은 같아요.'}</p></div>`;
}

function circleAreaVisual(data = {}) {
  const radius = Number(data.radius);
  if (!radius) return '<div class="visual-card circle-area-model"><div class="visual-title">원의 넓이 구하기</div><div class="circle-area-rule">반지름 × 반지름 × 3.14</div><p class="visual-caption">지름이 주어지면 먼저 2로 나누어 반지름을 구해요.</p></div>';
  return `<div class="visual-card circle-area-model"><div class="visual-title">원의 넓이는 반지름으로 계산해요</div><svg class="shape-svg" viewBox="0 0 220 185" role="img" aria-label="반지름이 표시된 원"><circle cx="110" cy="92" r="65" fill="#f1e8ce" stroke="#536a94" stroke-width="4"/><path d="M110 92H175" stroke="#d8875e" stroke-width="4"/><circle cx="110" cy="92" r="5" fill="#354a76"/><text x="142" y="82" text-anchor="middle">반지름 ${radius}</text></svg><div class="circle-area-rule">반지름 × 반지름 × 3.14</div><p class="visual-caption">원의 넓이는 반지름의 제곱에 원주율을 곱해요.</p></div>`;
}

function cylinderConeSphereVisual(data = {}) {
  const kind = data.kind || 'cylinder';
  const shapes = {
    cylinder: '<ellipse cx="70" cy="45" rx="38" ry="14"/><path d="M32 45v75c0 8 17 14 38 14s38-6 38-14V45"/><path d="M32 120c0 8 17 14 38 14s38-6 38-14"/>',
    'cylinder-net': '<rect x="25" y="52" width="110" height="62"/><ellipse cx="25" cy="83" rx="15" ry="31"/><ellipse cx="135" cy="83" rx="15" ry="31"/>',
    cone: '<ellipse cx="70" cy="120" rx="40" ry="14"/><path d="M30 120L70 35l40 85"/>',
    sphere: '<circle cx="70" cy="85" r="48"/><ellipse cx="70" cy="85" rx="20" ry="48"/><path d="M24 85c15-16 77-16 92 0M24 85c15 16 77 16 92 0"/>',
  }[kind] || '';
  const label = kind === 'cylinder-net' ? '원기둥 전개도' : kind === 'cone' ? '원뿔' : kind === 'sphere' ? '구' : '원기둥';
  return `<div class="visual-card solid-family-model"><div class="visual-title">${label}의 면과 곡면</div><svg class="shape-svg" viewBox="0 0 150 165" role="img" aria-label="${label}의 모양"><g fill="#e3edcf" stroke="#485b8f" stroke-width="4" stroke-linejoin="round">${shapes}</g></svg><p class="visual-caption">평평한 면과 곡면, 꼭짓점이 있는지 살펴봐요.</p></div>`;
}

function numberRangeVisual(data = {}) {
  if (data.kind === 'concept') {
    return '<div class="visual-card number-range-model"><div class="visual-title">수의 범위는 양 끝의 포함 여부로 나타내요</div><svg class="shape-svg" viewBox="0 0 250 100" role="img" aria-label="수직선의 시작점과 끝점"><path d="M30 45H220" stroke="#53678f" stroke-width="4"/><circle cx="76" cy="45" r="9" fill="#d8875e" stroke="#718e57" stroke-width="3"/><circle cx="174" cy="45" r="9" fill="#fff" stroke="#718e57" stroke-width="3"/><path d="M30 37v16M220 37v16" stroke="#53678f" stroke-width="3"/><text x="76" y="82" text-anchor="middle">시작</text><text x="174" y="82" text-anchor="middle">끝</text></svg><p class="visual-caption">이상·이하는 끝 수를 포함하고, 초과·미만은 포함하지 않아요.</p></div>';
  }
  if (data.kind === 'range') {
    const leftFill = data.startInclusive ? '#d8875e' : '#fff';
    const rightFill = data.endInclusive ? '#d8875e' : '#fff';
    return `<div class="visual-card number-range-model"><div class="visual-title">수직선에서 범위를 살펴봐요</div><svg class="shape-svg" viewBox="0 0 250 100" role="img" aria-label="${data.start}부터 ${data.end}까지의 수직선 범위"><path d="M30 45H220" stroke="#53678f" stroke-width="4"/><path d="M76 45H174" stroke="#718e57" stroke-width="8"/><circle cx="76" cy="45" r="9" fill="${leftFill}" stroke="#718e57" stroke-width="3"/><circle cx="174" cy="45" r="9" fill="${rightFill}" stroke="#718e57" stroke-width="3"/><path d="M30 37v16M220 37v16" stroke="#53678f" stroke-width="3"/><text x="76" y="82" text-anchor="middle">${data.start}</text><text x="174" y="82" text-anchor="middle">${data.end}</text></svg><p class="visual-caption">닫힌 점은 포함하고, 열린 점은 포함하지 않아요.</p></div>`;
  }
  if (data.kind === 'rounding') {
    return `<div class="visual-card number-range-model"><div class="visual-title">${data.place}까지 어림하기</div><div class="range-rounding-values"><span>${data.lower.toLocaleString('ko-KR')}</span><strong>${data.value.toLocaleString('ko-KR')}</strong><span>${data.upper.toLocaleString('ko-KR')}</span></div><p class="visual-caption">가까운 두 수 중 어느 쪽에 더 가까운지 살펴봐요.</p></div>`;
  }
  if (data.kind === 'estimate') {
    return `<div class="visual-card number-range-model"><div class="visual-title">계산하기 전에 가까운 수로 바꿔요</div><div class="range-estimate-line"><span>${data.left.toLocaleString('ko-KR')}</span><b>≈</b><strong>${data.leftRounded.toLocaleString('ko-KR')}</strong></div><div class="range-estimate-line"><span>${data.right.toLocaleString('ko-KR')}</span><b>≈</b><strong>${data.rightRounded.toLocaleString('ko-KR')}</strong></div><p class="visual-caption">어림한 두 수를 더해 답이 어느 정도인지 예상해요.</p></div>`;
  }
  return '';
}

function fractionMultiplicationVisual(data = {}) {
  if (!data || !Number(data.denominator)) {
    return '<div class="visual-card fraction-model"><div class="visual-title">분수 곱셈의 순서</div><div class="fraction-product-rule"><span>분자 × 분자</span><b>/</b><span>분모 × 분모</span></div><p class="visual-caption">자연수를 곱할 때는 분자에 곱하고, 분모는 그대로 두어요.</p></div>';
  }
  const whole = Number(data.whole) || 0;
  const numerator = Number(data.numerator) || 0;
  const denominator = Number(data.denominator) || 1;
  if (data.multiplier) {
    const label = `${whole ? `${whole}과 ` : ''}${numerator}/${denominator} × ${data.multiplier}`;
    const rows = Array.from({ length: data.multiplier }, (_, index) => {
      const cells = Array.from({ length: denominator }, (_, cell) => `<i${cell < numerator ? ' class="filled"' : ''}></i>`).join('');
      return `<div class="fraction-product-row"><small>${index + 1}번째</small>${whole ? `<strong>자연수 ${whole}</strong>` : ''}<div class="fraction-bar" role="img" aria-label="${denominator}칸 중 ${numerator}칸 색칠">${cells}</div></div>`;
    }).join('');
    return `<div class="visual-card fraction-model"><div class="visual-title">${formatFractionText(label)}</div><div class="fraction-product-rows">${rows}</div><p class="visual-caption">분수 부분과 자연수 부분을 각각 ${data.multiplier}배 해요.</p></div>`;
  }
  const secondNumerator = Number(data.secondNumerator) || 0;
  const secondDenominator = Number(data.secondDenominator) || 1;
  const cells = Array.from({ length: denominator * secondDenominator }, (_, index) => {
    const row = Math.floor(index / secondDenominator);
    const column = index % secondDenominator;
    const first = row < numerator;
    const second = column < secondNumerator;
    return `<i class="${first && second ? 'overlap' : first ? 'first-area' : second ? 'second-area' : ''}"></i>`;
  }).join('');
  return `<div class="visual-card fraction-model"><div class="visual-title">분수끼리 곱하기는 넓이로 살펴봐요</div><p class="fraction-area-label">${formatFractionText(`${numerator}/${denominator} × ${secondNumerator}/${secondDenominator}`)}</p><div class="fraction-area-grid" style="--fraction-columns:${secondDenominator};--fraction-rows:${denominator}" role="img" aria-label="${denominator}칸과 ${secondDenominator}칸으로 나눈 분수 곱셈 그림">${cells}</div><p class="visual-caption">두 방향에서 색칠한 부분이 겹치는 칸을 찾아요.</p></div>`;
}

function symmetryVisual(data = {}) {
  const shape = data.shape === 'triangle'
    ? '<polygon points="110,25 45,145 175,145" fill="#e3edcf" stroke="#485b8f" stroke-width="4"/>'
    : `<rect x="${data.shape === 'rectangle' ? 55 : 65}" y="35" width="${data.shape === 'rectangle' ? 110 : 90}" height="110" fill="#e3edcf" stroke="#485b8f" stroke-width="4"/>`;
  const axes = data.shape === 'triangle'
    ? data.axes === 3
      ? '<path d="M110 25V145M45 145L137.5 85M175 145L82.5 85" stroke="#cf815d" stroke-width="2.5" stroke-dasharray="6 5"/>'
      : '<path d="M110 25V145" stroke="#cf815d" stroke-width="3" stroke-dasharray="6 5"/>'
    : (data.axes === 4
      ? '<path d="M110 25V155M45 90H175M58 38L162 142M162 38L58 142" stroke="#cf815d" stroke-width="2.5" stroke-dasharray="6 5"/>'
      : '<path d="M110 25V155M45 90H175" stroke="#cf815d" stroke-width="3" stroke-dasharray="6 5"/>');
  return `<div class="visual-card shape-model"><div class="visual-title">접었을 때 포개지는 선을 찾아봐요</div><svg class="shape-svg" viewBox="0 0 220 180" role="img" aria-label="대칭축을 표시한 도형">${shape}${axes}</svg><p class="visual-caption">점선이 대칭축이에요.</p></div>`;
}

function congruenceVisual(data = {}) {
  const shape = data.shape === 'quadrilateral'
    ? '<polygon points="35,55 90,55 90,115 35,115"/><polygon points="130,55 185,55 185,115 130,115"/>'
    : '<polygon points="45,125 75,55 105,125"/><polygon points="125,125 155,55 185,125"/>';
  return `<div class="visual-card shape-model"><div class="visual-title">포개어지는 두 도형</div><svg class="shape-svg congruence-svg" viewBox="0 0 220 155" role="img" aria-label="모양과 크기가 같은 두 도형">${shape}</svg><p class="visual-caption">방향이 달라도 모양과 크기가 같으면 합동이에요.</p></div>`;
}

function parseDecimalMultiplication(question) {
  const match = String(question).match(/(\d+(?:\.\d+)?)\s*[×x*]\s*(\d+(?:\.\d+)?)/i);
  if (!match) return null;
  const leftPlaces = match[1].split('.')[1]?.length || 0;
  const rightPlaces = match[2].split('.')[1]?.length || 0;
  const places = leftPlaces + rightPlaces;
  if (places > 6) return null;
  const result = (Number(match[1]) * Number(match[2])).toFixed(places).replace(/(?:\.0+|(?<=\d)0+)$/, '').replace(/\.$/, '');
  return { left: match[1], right: match[2], places, result };
}

function parseFractionMultiplication(question) {
  const bothFractions = question.match(/(?:(\d+)\s*과\s*)?(\d+)\s*\/\s*(\d+)\s*[×*]\s*(?:(\d+)\s*과\s*)?(\d+)\s*\/\s*(\d+)/);
  const fractionTimesNatural = question.match(/(?:(\d+)\s*과\s*)?(\d+)\s*\/\s*(\d+)\s*[×*]\s*(\d+)/);
  const naturalTimesFraction = question.match(/(\d+)\s*[×*]\s*(?:(\d+)\s*과\s*)?(\d+)\s*\/\s*(\d+)/);
  let leftNumerator;
  let leftDenominator;
  let rightNumerator;
  let rightDenominator;
  if (bothFractions) {
    leftDenominator = Number(bothFractions[3]);
    leftNumerator = Number(bothFractions[1] || 0) * leftDenominator + Number(bothFractions[2]);
    rightDenominator = Number(bothFractions[6]);
    rightNumerator = Number(bothFractions[4] || 0) * rightDenominator + Number(bothFractions[5]);
  } else if (fractionTimesNatural) {
    leftDenominator = Number(fractionTimesNatural[3]);
    leftNumerator = Number(fractionTimesNatural[1] || 0) * leftDenominator + Number(fractionTimesNatural[2]);
    rightNumerator = Number(fractionTimesNatural[4]);
    rightDenominator = 1;
  } else if (naturalTimesFraction) {
    leftNumerator = Number(naturalTimesFraction[1]);
    leftDenominator = 1;
    rightDenominator = Number(naturalTimesFraction[4]);
    rightNumerator = Number(naturalTimesFraction[2] || 0) * rightDenominator + Number(naturalTimesFraction[3]);
  } else return null;
  if (leftDenominator <= 0 || rightDenominator <= 0) return null;
  let numerator = leftNumerator * rightNumerator;
  let denominator = leftDenominator * rightDenominator;
  const gcd = (left, right) => right ? gcd(right, left % right) : left;
  const divisor = gcd(numerator, denominator) || 1;
  numerator /= divisor;
  denominator /= divisor;
  const whole = Math.floor(numerator / denominator);
  const remainder = numerator % denominator;
  const answer = whole ? remainder ? `${whole}과 ${remainder}/${denominator}` : String(whole) : `${numerator}/${denominator}`;
  return { answer, numerator, denominator };
}

function decimalMultiplicationVisual(expression, showResult = false) {
  const calculation = parseDecimalMultiplication(expression);
  if (!calculation) {
    return '<div class="visual-card decimal-multiplication-model"><div class="visual-title">소수 곱셈의 순서</div><div class="decimal-product-steps"><span>소수점을 잠깐 빼고 곱하기</span><b>→</b><span>두 수의 소수 자릿수 더하기</span><b>→</b><span>곱에 소수점 표시하기</span></div></div>';
  }
  const leftInteger = String(Number(calculation.left.replace('.', '')));
  const rightInteger = String(Number(calculation.right.replace('.', '')));
  const result = showResult ? `<strong class="decimal-product-result">= ${calculation.result}</strong>` : '';
  return `<div class="visual-card decimal-multiplication-model"><div class="visual-title">소수점을 잠깐 떼고 곱한 뒤 자릿수를 세어요</div><div class="decimal-product-equation">${calculation.left} × ${calculation.right}</div><p>${leftInteger} × ${rightInteger}을 먼저 계산해요.</p><p>두 수의 소수 자릿수를 합하면 ${calculation.places}자리예요.</p>${result}</div>`;
}

function fractionProductVisualData(question) {
  const mixed = question.match(/(?:(\d+)\s*과\s*)?(\d+)\s*\/\s*(\d+)\s*[×*]\s*(?:(\d+)\s*과\s*)?(\d+)\s*\/\s*(\d+)/);
  if (mixed) return { whole: Number(mixed[1]) || 0, numerator: Number(mixed[2]), denominator: Number(mixed[3]), secondNumerator: Number(mixed[5]), secondDenominator: Number(mixed[6]) };
  const timesNatural = question.match(/(?:(\d+)\s*과\s*)?(\d+)\s*\/\s*(\d+)\s*[×*]\s*(\d+)/);
  if (timesNatural) return { whole: Number(timesNatural[1]) || 0, numerator: Number(timesNatural[2]), denominator: Number(timesNatural[3]), multiplier: Number(timesNatural[4]) };
  const naturalTimesFraction = question.match(/(\d+)\s*[×*]\s*(?:(\d+)\s*과\s*)?(\d+)\s*\/\s*(\d+)/);
  if (naturalTimesFraction) return { whole: Number(naturalTimesFraction[2]) || 0, numerator: Number(naturalTimesFraction[3]), denominator: Number(naturalTimesFraction[4]), multiplier: Number(naturalTimesFraction[1]) };
  return null;
}

function fractionDivisionVisualData(question) {
  const twoFractions = question.match(/(?:(\d+)\s*과\s*)?(\d+)\s*\/\s*(\d+)\s*÷\s*(?:(\d+)\s*과\s*)?(\d+)\s*\/\s*(\d+)/);
  if (twoFractions) return { whole: Number(twoFractions[1]) || 0, numerator: Number(twoFractions[2]), denominator: Number(twoFractions[3]), divisorNumerator: Number(twoFractions[5]), divisorDenominator: Number(twoFractions[6]) };
  const fractionByNatural = question.match(/(?:(\d+)\s*과\s*)?(\d+)\s*\/\s*(\d+)\s*÷\s*(\d+)/);
  if (fractionByNatural) return { whole: Number(fractionByNatural[1]) || 0, numerator: Number(fractionByNatural[2]), denominator: Number(fractionByNatural[3]), divisor: Number(fractionByNatural[4]) };
  return null;
}

function parseFractionDivision(question) {
  const data = fractionDivisionVisualData(question);
  if (!data) return null;
  let numerator = (Number(data.whole) || 0) * data.denominator + data.numerator;
  let denominator = data.denominator;
  if (data.divisorNumerator) {
    numerator *= data.divisorDenominator;
    denominator *= data.divisorNumerator;
  } else denominator *= Number(data.divisor) || 1;
  const gcd = (left, right) => right ? gcd(right, left % right) : left;
  const divisor = gcd(numerator, denominator) || 1;
  numerator /= divisor;
  denominator /= divisor;
  const whole = Math.floor(numerator / denominator);
  const remainder = numerator % denominator;
  return { answer: whole ? remainder ? `${whole}과 ${remainder}/${denominator}` : String(whole) : `${numerator}/${denominator}` };
}

function decimalDivisionVisualData(question) {
  const match = question.match(/(\d+(?:\.\d+)?)\s*÷\s*(\d+(?:\.\d+)?)/);
  return match ? { dividend: Number(match[1]), divisor: Number(match[2]) } : null;
}

function spaceSolidsDataForQuestion(question) {
  const match = question.match(/\[\[[\d,\s]+\](?:\s*,\s*\[[\d,\s]+\])?\]/);
  if (!match) return null;
  try {
    return { stacks: JSON.parse(match[0]) };
  } catch {
    return null;
  }
}

function numberRangeVisualForQuestion(question) {
  const range = question.match(/([\d,]+)\s*(이상|초과).*?([\d,]+)\s*(미만|이하)/);
  if (range) {
    return numberRangeVisual({
      kind: 'range',
      start: Number(range[1].replace(/,/g, '')),
      end: Number(range[3].replace(/,/g, '')),
      startInclusive: range[2] === '이상',
      endInclusive: range[4] === '이하',
    });
  }
  const rounding = question.match(/([\d,]+).*?(십의|백의|천의) 자리.*?(반올림|올림|버림)/);
  if (rounding) {
    const value = Number(rounding[1].replace(/,/g, ''));
    const place = rounding[2];
    const factor = place === '십의' ? 10 : place === '백의' ? 100 : 1000;
    const lower = Math.floor(value / factor) * factor;
    return numberRangeVisual({ kind: 'rounding', value, place, lower, upper: lower + factor });
  }
  return numberRangeVisual({ kind: 'concept' });
}

function rectangularPrismVisual() {
  return '<div class="visual-card shape-model"><div class="visual-title">직육면체의 면·모서리·꼭짓점</div><svg class="shape-svg prism-svg" viewBox="0 0 220 180" role="img" aria-label="앞면과 옆면, 윗면이 보이는 직육면체"><path d="M45 55H145V145H45ZM45 55L80 25H180L145 55M145 55L180 25V115L145 145M45 145L80 115H180" fill="#e3edcf" stroke="#485b8f" stroke-width="4" stroke-linejoin="round"/><path d="M80 25V115" fill="none" stroke="#485b8f" stroke-width="3" stroke-dasharray="6 5"/></svg><p class="visual-caption">평평한 면, 면이 만나는 모서리, 모서리가 만나는 꼭짓점을 살펴봐요.</p></div>';
}

function averageProbabilityVisual(data = {}) {
  if (data.kind === 'die') {
    return '<div class="visual-card probability-model"><div class="visual-title">보통 주사위에 있는 눈</div><div class="die-faces" role="img" aria-label="1부터 6까지의 눈이 있는 주사위"><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span></div><p class="visual-caption">주사위에는 1부터 6까지 있어요.</p></div>';
  }
  if (Array.isArray(data.values)) {
    const max = Math.max(...data.values, 1);
    const bars = data.values.map((value, index) => `<div class="average-bar-column"><i style="--average-height:${Math.max(12, value / max * 100)}%"></i><span>${index + 1}</span><strong>${value}</strong></div>`).join('');
    return `<div class="visual-card average-model"><div class="visual-title">자료를 고르게 나누어 평균을 생각해요</div><div class="average-bars">${bars}</div><p class="visual-caption">자료의 합을 자료의 수로 나누어요.</p></div>`;
  }
  if (data.kind === 'average-rule') {
    return '<div class="visual-card average-model"><div class="visual-title">평균 구하는 방법</div><div class="average-rule"><span>자료의 합</span><b>÷</b><span>자료의 수</span></div><p class="visual-caption">평균은 자료를 똑같이 나누었을 때 한 개에 해당하는 값이에요.</p></div>';
  }
  if (data.kind === 'possibility') {
    return '<div class="visual-card probability-model"><div class="visual-title">일어날 가능성을 비교해요</div><div class="possibility-scale"><span>불가능</span><i></i><span>반반</span><i></i><span>확실</span></div><p class="visual-caption">자료를 보고 가능성이 어느 쪽에 가까운지 말해요.</p></div>';
  }
  const red = Math.max(0, Math.min(12, Number(data.red) || 0));
  const blue = Math.max(0, Math.min(12, Number(data.blue) || 0));
  const tokens = [...Array.from({ length: red }, () => '<i class="probability-token red-token">●</i>'), ...Array.from({ length: blue }, () => '<i class="probability-token blue-token">●</i>')].join('');
  return `<div class="visual-card probability-model"><div class="visual-title">주머니 속 색깔별 개수를 세어요</div><div class="probability-tokens" role="img" aria-label="빨간 구슬 ${red}개와 파란 구슬 ${blue}개">${tokens}</div><p class="visual-caption">더 많이 들어 있는 쪽이 나올 가능성이 더 높아요.</p></div>`;
}

function triangleVisual(kind = 'isosceles') {
  const points = {
    isosceles: '100,24 35,145 165,145',
    equilateral: '100,22 30,145 170,145',
    acute: '100,24 35,145 165,145',
    obtuse: '30,112 170,112 105,38',
    'right-isosceles': '38,35 38,155 158,155',
  }[kind] || '100,24 35,145 165,145';
  const rightMarker = kind === 'right-isosceles' ? '<path d="M38 137h18v18" fill="none" stroke="#556b9d" stroke-width="2"/>' : '';
  const caption = kind === 'obtuse' ? '각 하나가 직각보다 커요' : kind === 'acute' ? '세 각이 모두 예각이에요' : kind === 'right-isosceles' ? '같은 변 두 개와 직각이 있어요' : kind === 'equilateral' ? '세 변의 길이가 같아요' : '같은 길이의 변 두 개를 표시했어요';
  return `<div class="visual-card shape-model"><div class="visual-title">삼각형을 눈으로 살펴봐요</div><svg class="shape-svg" viewBox="0 0 200 175" role="img" aria-label="${caption}"><polygon points="${points}" fill="#f6d895" stroke="#485b8f" stroke-width="4" stroke-linejoin="round"/>${rightMarker}<text x="100" y="170" text-anchor="middle">${caption}</text></svg></div>`;
}

function lineRelationsVisual(kind = 'perpendicular') {
  const lines = kind === 'parallel'
    ? '<path d="M30 55h180M30 115h180" stroke="#5368a6" stroke-width="6" stroke-linecap="round"/><text x="120" y="40" text-anchor="middle">간격이 같고 만나지 않아요</text>'
    : '<path d="M55 35v115M25 95h175" stroke="#5368a6" stroke-width="6" stroke-linecap="round"/><path d="M55 95h18v18" fill="none" stroke="#cf8f4c" stroke-width="3"/><text x="125" y="80" text-anchor="middle">직각으로 만나요</text>';
  return `<div class="visual-card shape-model"><div class="visual-title">두 직선의 관계를 살펴봐요</div><svg class="shape-svg" viewBox="0 0 230 170" role="img" aria-label="${kind === 'parallel' ? '평행한 두 직선' : '수직으로 만나는 두 직선'}">${lines}</svg></div>`;
}

function quadrilateralVisual(kind = 'parallelogram') {
  const shape = {
    trapezoid: { points: '45,38 155,38 185,135 15,135', label: '평행한 변 한 쌍' },
    parallelogram: { points: '55,30 180,30 145,135 20,135', label: '마주 보는 변 두 쌍이 평행' },
    rhombus: { points: '100,18 175,85 100,152 25,85', label: '네 변의 길이가 같아요' },
    square: { points: '38,28 162,28 162,152 38,152', label: '네 변이 같고 네 각이 직각' },
  }[kind] || { points: '38,28 162,28 162,152 38,152', label: '사각형의 변을 살펴봐요' };
  return `<div class="visual-card shape-model"><div class="visual-title">사각형의 성질을 살펴봐요</div><svg class="shape-svg" viewBox="0 0 200 180" role="img" aria-label="${shape.label}"><polygon points="${shape.points}" fill="#e4edce" stroke="#485b8f" stroke-width="4" stroke-linejoin="round"/><text x="100" y="174" text-anchor="middle">${shape.label}</text></svg></div>`;
}

function lineGraphVisual(graph = lineGraphSets.monthlyTemperatures) {
  const { labels, values, title, unit } = graph;
  const width = 350;
  const height = 210;
  const left = 43;
  const right = 12;
  const top = 12;
  const bottom = 40;
  const tickStep = graph.tickStep || (Math.max(...values) <= 10 ? 1 : 2);
  const maxValue = Math.ceil(Math.max(...values, 1) / tickStep) * tickStep;
  const stepX = (width - left - right) / Math.max(values.length - 1, 1);
  const yFor = (value) => height - bottom - value / maxValue * (height - top - bottom);
  const points = values.map((value, index) => `${left + index * stepX},${yFor(value)}`);
  const dots = points.map((point) => {
    const [cx, cy] = point.split(',');
    return `<circle cx="${cx}" cy="${cy}" r="5" fill="#d8875e" stroke="#fff" stroke-width="2"/>`;
  }).join('');
  const xLabels = labels.map((label, index) => `<text x="${left + index * stepX}" y="${height - 10}" text-anchor="middle">${escapeHTML(label)}</text>`).join('');
  const tickCount = Math.floor(maxValue / tickStep);
  const grid = Array.from({ length: tickCount + 1 }, (_, index) => {
    const tick = index * tickStep;
    const y = yFor(tick);
    return `<path d="M${left} ${y}H${width - right}" stroke="#dbe1eb" stroke-width="1"/><text x="${left - 7}" y="${y + 4}" text-anchor="end">${tick}</text>`;
  }).join('');
  const description = labels.map((label, index) => `${label} ${values[index]}${unit}`).join(', ');
  return `<div class="visual-card graph-model"><div class="visual-title">${escapeHTML(title || '시간에 따른 변화')}</div><svg class="line-graph-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHTML(`${title}: ${description}`)}"><g fill="#52617d" font-size="11" font-family="sans-serif">${grid}${xLabels}</g><path d="M${left} ${top}V${height - bottom}H${width - right}" fill="none" stroke="#647392" stroke-width="2"/><polyline points="${points.join(' ')}" fill="none" stroke="#728f58" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>${dots}</svg><p class="visual-caption">가로축은 시점, 세로축은 ${escapeHTML(unit)}를 나타내요.</p></div>`;
}

function polygonVisual(kind = 'pentagon') {
  const sides = kind.includes('hexagon') ? 6 : kind.includes('pentagon') ? 5 : 4;
  const center = 100;
  const radius = 68;
  const points = Array.from({ length: sides }, (_, index) => {
    const angle = -Math.PI / 2 + index * 2 * Math.PI / sides;
    return [center + Math.cos(angle) * radius, center + Math.sin(angle) * radius];
  });
  const pointText = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  let diagonals = '';
  if (kind.includes('diagonals')) {
    diagonals = points.flatMap(([x, y], index) => points.map(([targetX, targetY], targetIndex) => {
      const adjacent = targetIndex === index + 1 || (index === 0 && targetIndex === sides - 1);
      return targetIndex > index && !adjacent
        ? `<path d="M${x} ${y}L${targetX} ${targetY}" stroke="#d8875e" stroke-width="2" stroke-dasharray="5 4"/>`
        : '';
    })).join('');
  }
  return `<div class="visual-card shape-model"><div class="visual-title">변과 꼭짓점, 대각선을 세어봐요</div><svg class="shape-svg" viewBox="0 0 200 200" role="img" aria-label="${sides}개의 변을 가진 다각형"><polygon points="${pointText}" fill="#f6e8c4" stroke="#485b8f" stroke-width="4" stroke-linejoin="round"/>${diagonals}</svg><p class="visual-caption">이웃하지 않은 꼭짓점을 이은 선분이 대각선이에요.</p></div>`;
}

function polygonTilingVisual() {
  return '<div class="visual-card shape-model"><div class="visual-title">다각형 조각을 빈틈없이 이어 붙여요</div><svg class="shape-svg" viewBox="0 0 220 150" role="img" aria-label="삼각형과 사각형 조각이 빈틈없이 이어진 모양"><polygon points="30,25 90,25 60,75" fill="#f3d590" stroke="#485b8f" stroke-width="3"/><polygon points="90,25 150,25 150,75 60,75" fill="#d9e9cc" stroke="#485b8f" stroke-width="3"/><polygon points="30,25 60,75 30,125" fill="#d8def4" stroke="#485b8f" stroke-width="3"/><polygon points="60,75 150,75 120,125 30,125" fill="#f3d590" stroke="#485b8f" stroke-width="3"/><polygon points="150,25 190,75 150,75" fill="#d8def4" stroke="#485b8f" stroke-width="3"/><polygon points="150,75 190,75 150,125 120,125" fill="#d9e9cc" stroke="#485b8f" stroke-width="3"/></svg><p class="visual-caption">서로 맞닿은 변을 따라 조각을 놓으면 빈틈없이 채울 수 있어요.</p></div>';
}

function buildMissionVisual(mission) {
  if (mission.visual === 'multiplication') return multiplicationVisual(mission.visualData);
  if (mission.visual === 'division') return divisionVisual(mission.visualData);
  if (mission.visual === 'circle') return circleVisual(mission.visualData);
  if (mission.visual === 'fraction3') return fractionBarsVisual(mission.fractionBars, '전체를 똑같이 나눈 부분이에요', '분모는 전체 조각 수, 분자는 색칠하거나 고른 조각 수예요.');
  if (mission.visual === 'measurement') return measurementVisual(mission.visualData);
  if (mission.visual === 'data-organization') return dataOrganizationVisual(mission.visualData);
  if (mission.visual === 'fraction-division') return fractionDivisionVisual(mission.visualData);
  if (mission.visual === 'decimal-division') return decimalDivisionVisual(mission.visualData);
  if (mission.visual === 'space-solids') return spaceSolidsVisual(mission.visualData);
  if (mission.visual === 'ratio-proportion') return ratioProportionVisual(mission.visualData);
  if (mission.visual === 'circle-area') return circleAreaVisual(mission.visualData);
  if (mission.visual === 'cylinder-cone-sphere') return cylinderConeSphereVisual(mission.visualData);
  if (mission.visual === 'number-range') return numberRangeVisual(mission.visualData);
  if (mission.visual === 'fraction-bars') return fractionBarsVisual(mission.fractionBars);
  if (mission.visual === 'fraction-multiply') return fractionMultiplicationVisual(mission.visualData);
  if (mission.visual === 'congruence') return congruenceVisual(mission.visualData);
  if (mission.visual === 'symmetry') return symmetryVisual(mission.visualData);
  if (mission.visual === 'decimal-multiplication') return decimalMultiplicationVisual(mission.expression, false);
  if (mission.visual === 'rectangular-prism') return rectangularPrismVisual();
  if (mission.visual === 'average-probability') return averageProbabilityVisual(mission.visualData);
  if (mission.visual === 'hundredths') return hundredthsVisual(mission.visualValue || '0.37');
  if (mission.visual === 'triangle') return triangleVisual(mission.triangleKind);
  if (mission.visual === 'line-relations') return lineRelationsVisual(mission.lineRelation);
  if (mission.visual === 'quadrilateral') return quadrilateralVisual(mission.shapeKind);
  if (mission.visual === 'line-graph') return lineGraphVisual(lineGraphSets[mission.graphId] || lineGraphSets.monthlyTemperatures);
  if (mission.visual === 'polygon') return polygonVisual(mission.polygonKind);
  if (mission.visual === 'polygon-tiling') return polygonTilingVisual();
  if (mission.visual === 'place-value') return placeValueChart(mission.visualValue || '0.426', '소수점 오른쪽 자리를 차례로 살펴봐요');
  if (mission.visual === 'comparison') {
    const values = mission.comparisonValues || ['0.5', '0.48'];
    const headers = ['일의 자리', '소수 첫째', '소수 둘째'];
    const row = (value) => {
      const [whole, fraction = ''] = value.split('.');
      return `<div class="place-value-row" role="row"><strong>${escapeHTML(value)}</strong><span role="cell">${whole}</span><span role="cell">${fraction[0] || '0'}</span><span role="cell">${fraction[1] || '0'}</span></div>`;
    };
    return `<div class="visual-card mission-place-value"><div class="visual-title">소수점을 맞춰 자릿수끼리 비교해요</div><div class="place-value-chart compare-chart" role="table"><div class="place-value-row place-value-head" role="row"><strong></strong>${headers.map((header) => `<span role="columnheader">${header}</span>`).join('')}</div>${values.map(row).join('')}</div></div>`;
  }
  if (mission.visual === 'relationships') {
    const tenths = mission.relationshipTenths || 4;
    return `<div class="visual-card relationship-model"><div class="visual-title">한 단위를 잘게 나누어 봐요</div><div class="relationship-steps"><span>1</span><b>=</b><span>10개의 0.1</span><b>=</b><span>100개의 0.01</span></div><p class="visual-caption">0.${tenths}는 0.1이 ${tenths}개예요. 각 0.1을 0.01 열 개로 나누어 세어봐요.</p></div>`;
  }
  const calculation = parseDecimalOperation(mission.expression);
  return calculation && !calculation.unsupported ? calculationVisual({ ...calculation, showResult: false }) : '';
}

function getSkillForQuestion(question, unitId = activeStudyUnitId) {
  if (unitId === 'fractions') {
    if (/받아내림|1을 가르|분수 부분끼리 뺄 수 없/.test(question)) return 'fraction_regroup';
    if (/\+|덧셈|더하기/.test(question)) return 'fraction_add';
    if (/-|뺄셈|빼기/.test(question)) return 'fraction_subtract';
    return 'fraction_unit';
  }
  if (unitId === 'triangles') {
    if (/예각|둔각|직각|각의 크기|각도/.test(question)) return 'triangle_angles';
    if (/성질|두 가지|둘 다/.test(question)) return 'triangle_properties';
    return 'triangle_sides';
  }
  if (unitId === 'quadrilaterals') {
    if (/수직|수선|평행선/.test(question)) return 'quad_perpendicular_parallel';
    if (/사다리꼴/.test(question)) return 'quad_trapezoid';
    if (/평행사변형/.test(question)) return 'quad_parallelogram';
    if (/마름모/.test(question)) return 'quad_rhombus';
    return 'quad_relations';
  }
  if (unitId === 'line_graphs') {
    if (/그리|나타내|축|눈금/.test(question)) return /눈금|축/.test(question) ? 'graph_scale' : 'graph_draw';
    if (/변화|증가|감소|차이|올랐|내렸/.test(question)) return 'graph_change';
    return 'graph_read';
  }
  if (unitId === 'polygons') {
    if (/정다각형/.test(question)) return 'polygon_regular';
    if (/대각선/.test(question)) return 'polygon_diagonal';
    if (/모양|채우|조각/.test(question)) return 'polygon_composition';
    return 'polygon_definition';
  }
  if (unitId === 'number_ranges') {
    if (/반올림|올림|버림|가까운/.test(question)) return 'range_rounding';
    if (/어림|약/.test(question)) return 'range_estimation';
    return 'range_bounds';
  }
  if (unitId === 'fraction_multiplication') {
    if (/대분수|자연수/.test(question)) return 'fraction_multiply_mixed';
    if (/약분|분자끼리|분모끼리|분수끼리|\d+\s*\/\s*\d+.*[×*]\s*\d+\s*\/\s*\d+/.test(question)) return 'fraction_multiply_fraction';
    return 'fraction_multiply_natural';
  }
  if (unitId === 'congruence_symmetry') {
    if (/합동|포개/.test(question)) return 'congruence_definition';
    if (/축|대칭/.test(question)) return 'symmetry_axis';
    return 'line_symmetry';
  }
  if (unitId === 'decimal_multiplication') {
    if (/소수점|자릿수/.test(question)) return 'decimal_product_places';
    const multiplication = parseDecimalMultiplication(question);
    if (multiplication) return multiplication.left.includes('.') && multiplication.right.includes('.') ? 'decimal_multiply_decimal' : 'decimal_multiply_natural';
    if (/자연수|몇 묶음|배/.test(question)) return 'decimal_multiply_natural';
    return 'decimal_multiply_decimal';
  }
  if (unitId === 'rectangular_prisms') {
    if (/전개도|겨냥도/.test(question)) return 'prism_nets';
    if (/모서리|꼭짓점/.test(question)) return 'prism_edges_vertices';
    return 'prism_faces';
  }
  if (unitId === 'average_probability') {
    if (/가능|확실|불가능|반반|나올|뽑/.test(question)) return 'probability_comparison';
    if (/비교|자료/.test(question)) return 'average_interpretation';
    return 'average_calculation';
  }
  if (unitId === 'multiplication') {
    const factors = question.match(/(\d+)\s*[×*]\s*(\d+)/);
    if (factors && Number(factors[1]) >= 100 && Number(factors[2]) < 10) return 'multiplication_3digit_1digit';
    if (factors && Number(factors[1]) >= 10 && Number(factors[2]) >= 10) return 'multiplication_2digit_2digit';
    return 'multiplication_meaning';
  }
  if (unitId === 'division') return /나머지|몫/.test(question) ? 'division_remainder' : /관계|곱셈|거꾸로|×.*=/.test(question) ? 'division_relation' : 'division_quotient';
  if (unitId === 'circles') return /지름|반지름/.test(question) ? 'circle_radius' : /컴퍼스|그리/.test(question) ? 'circle_draw' : 'circle_parts';
  if (unitId === 'fractions3') return /비교|더 큰|더 작은/.test(question) ? 'fraction3_compare' : /분모|분자|나눈 부분/.test(question) ? 'fraction3_unit' : 'fraction3_read';
  if (unitId === 'capacity_weight') return /kg|그램|무게/.test(question) ? /더|빼|차/.test(question) ? 'measurement_add_subtract' : 'weight_units' : /더|빼|차/.test(question) ? 'measurement_add_subtract' : 'capacity_units';
  if (unitId === 'data_organization') return /기호|그림그래프/.test(question) ? /몇 명|몇 권|몇 개/.test(question) ? 'pictograph_key' : 'pictograph_read' : /그리|나타내|만들/.test(question) ? 'pictograph_draw' : 'data_table';
  if (unitId === 'fraction_division') return /역수|분수끼리|분수 나눗셈/.test(question) ? 'fraction_divide_fraction' : /몇 번 들어가|의미/.test(question) ? 'fraction_division_meaning' : 'fraction_divide_natural';
  if (unitId === 'decimal_division') return /소수점|자리/.test(question) ? 'decimal_division_places' : /소수끼리|나누는 수가 소수/.test(question) ? 'decimal_divide_decimal' : 'decimal_divide_natural';
  if (unitId === 'space_solids') return /위에서/.test(question) ? 'space_top_view' : /앞에서|옆에서|방향/.test(question) ? 'space_front_side_view' : 'space_cube_count';
  if (unitId === 'ratio_proportion') return /나누|배분|몫/.test(question) ? 'proportional_sharing' : /비례식|네모|□/.test(question) ? 'proportion_equation' : 'ratio_value';
  if (unitId === 'circle_area') return /지름|반지름/.test(question) ? 'circle_radius_diameter' : /어림|비교/.test(question) ? 'circle_area_estimation' : 'circle_area_formula';
  if (unitId === 'cylinder_cone_sphere') return /원기둥/.test(question) ? 'cylinder_parts' : /원뿔|구/.test(question) ? 'cone_sphere_parts' : 'solid_identification';
  const calculation = parseDecimalOperation(question);
  if (calculation && !calculation.unsupported) {
    const leftPlaces = calculation.left.split('.')[1]?.length || 0;
    const rightPlaces = calculation.right.split('.')[1]?.length || 0;
    if (leftPlaces !== rightPlaces) return 'decimal_alignment';
    const scale = 10 ** calculation.places;
    const leftFraction = Math.round((Number(calculation.left) % 1) * scale);
    const rightFraction = Math.round((Number(calculation.right) % 1) * scale);
    if ((calculation.operator === '+' && leftFraction + rightFraction >= scale)
      || (calculation.operator === '-' && leftFraction < rightFraction)) return 'decimal_regrouping';
    return calculation.operator === '+' ? 'decimal_addition' : 'decimal_subtraction';
  }
  if (/비교|더 큰 수|더 작은 수|같은 수/.test(question)) return 'decimal_comparison';
  if (/사이의 관계|0\.01이 몇 개|0\.1이 몇 개/.test(question)) return 'decimal_relationships';
  if (/소수점.*맞|자리 맞|자릿수/.test(question)) return 'decimal_alignment';
  if (/더하기|덧셈|합|받아올림/.test(question)) return 'decimal_addition';
  if (/빼기|뺄셈|차|받아내림/.test(question)) return 'decimal_subtraction';
  return 'decimal_place_value';
}

function getTutorVisualOptions(question, unitId = activeStudyUnitId, graphId = null) {
  if (unitId === 'fractions') {
    const matches = [...question.matchAll(/(\d+)\s*\/\s*(\d+)/g)];
    const fractionBars = matches.length > 1
      ? matches.slice(0, 2).map((match) => ({ numerator: Number(match[1]), denominator: Number(match[2]) }))
      : [{ numerator: 2, denominator: 7 }, { numerator: 3, denominator: 7 }];
    const visualMarkup = buildMissionVisual({ visual: 'fraction-bars', fractionBars });
    const skill = getSkillForQuestion(question, unitId);
    return { visualMarkup: getSkillStatus(studentSkillProgress[skill]) === 'secure' ? `<details class="optional-visual"><summary>분수 그림 보기</summary>${visualMarkup}</details>` : visualMarkup };
  }
  if (unitId === 'triangles') {
    const triangleKind = /정삼각형/.test(question) ? 'equilateral' : /둔각/.test(question) ? 'obtuse' : /직각/.test(question) ? 'right-isosceles' : 'isosceles';
    const visualMarkup = triangleVisual(triangleKind);
    const skill = getSkillForQuestion(question, unitId);
    return { visualMarkup: getSkillStatus(studentSkillProgress[skill]) === 'secure' ? `<details class="optional-visual"><summary>삼각형 그림 보기</summary>${visualMarkup}</details>` : visualMarkup };
  }
  if (unitId === 'quadrilaterals') {
    const shapeKind = /마름모/.test(question) ? 'rhombus' : /사다리꼴/.test(question) ? 'trapezoid' : /정사각형|직사각형/.test(question) ? 'square' : 'parallelogram';
    const visualMarkup = /수직|평행/.test(question) ? lineRelationsVisual(/평행/.test(question) ? 'parallel' : 'perpendicular') : quadrilateralVisual(shapeKind);
    const skill = getSkillForQuestion(question, unitId);
    return { visualMarkup: getSkillStatus(studentSkillProgress[skill]) === 'secure' ? `<details class="optional-visual"><summary>사각형 그림 보기</summary>${visualMarkup}</details>` : visualMarkup };
  }
  if (unitId === 'line_graphs') {
    const visualMarkup = lineGraphVisual(lineGraphSets[graphId] || getTutorGraphData(question, lineGraphSets));
    const skill = getSkillForQuestion(question, unitId);
    return { visualMarkup: getSkillStatus(studentSkillProgress[skill]) === 'secure' ? `<details class="optional-visual"><summary>꺾은선그래프 보기</summary>${visualMarkup}</details>` : visualMarkup };
  }
  if (unitId === 'polygons') {
    const visualMarkup = /채우|모양을 만들/.test(question)
      ? polygonTilingVisual()
      : polygonVisual(/대각선/.test(question) ? 'quadrilateral-diagonals' : /육각형/.test(question) ? 'hexagon' : 'pentagon');
    const skill = getSkillForQuestion(question, unitId);
    return { visualMarkup: getSkillStatus(studentSkillProgress[skill]) === 'secure' ? `<details class="optional-visual"><summary>다각형 그림 보기</summary>${visualMarkup}</details>` : visualMarkup };
  }
  if (unitId === 'number_ranges') {
    return { visualMarkup: numberRangeVisualForQuestion(question) };
  }
  if (unitId === 'fraction_multiplication') {
    return { visualMarkup: fractionMultiplicationVisual(fractionProductVisualData(question)) };
  }
  if (unitId === 'congruence_symmetry') {
    const shape = /정사각형/.test(question) ? 'square' : /직사각형/.test(question) ? 'rectangle' : 'triangle';
    const axes = shape === 'square' ? 4 : shape === 'rectangle' ? 2 : /정삼각형/.test(question) ? 3 : 1;
    const visualMarkup = /합동|포개/.test(question) ? congruenceVisual({ shape: /사각형/.test(question) ? 'quadrilateral' : 'triangle' }) : symmetryVisual({ shape, axes });
    return { visualMarkup };
  }
  if (unitId === 'decimal_multiplication') {
    return { visualMarkup: decimalMultiplicationVisual(question) };
  }
  if (unitId === 'rectangular_prisms') return { visualMarkup: rectangularPrismVisual() };
  if (unitId === 'average_probability') {
    const bag = question.match(/빨간\D*(\d+).*?(?:파란|파랑|노란|노랑)\D*(\d+)/);
    const values = /평균/.test(question) ? question.match(/\d+(?:\.\d+)?/g)?.map(Number).slice(0, 6) : null;
    const visualMarkup = bag
      ? averageProbabilityVisual({ red: Number(bag[1]), blue: Number(bag[2]) })
      : values?.length ? averageProbabilityVisual({ values }) : averageProbabilityVisual({ kind: /평균/.test(question) ? 'average-rule' : 'possibility' });
    return { visualMarkup };
  }
  if (unitId === 'multiplication') {
    const factors = question.match(/(\d+)\s*[×*]\s*(\d+)/);
    return { visualMarkup: multiplicationVisual(factors ? { left: Number(factors[1]), right: Number(factors[2]) } : {}) };
  }
  if (unitId === 'division') {
    const factors = question.match(/(\d+)\s*[÷/]\s*(\d+)/);
    return { visualMarkup: divisionVisual(factors ? { dividend: Number(factors[1]), divisor: Number(factors[2]) } : {}) };
  }
  if (unitId === 'circles') return { visualMarkup: circleVisual({ kind: /지름/.test(question) ? 'diameter' : /컴퍼스|그리/.test(question) ? 'compass' : /중심/.test(question) ? 'center' : 'radius' }) };
  if (unitId === 'fractions3') {
    const fractions = [...question.matchAll(/(\d+)\s*\/\s*(\d+)/g)].map((match) => ({ numerator: Number(match[1]), denominator: Number(match[2]) }));
    return { visualMarkup: fractionBarsVisual(fractions.length ? fractions.slice(0, 2) : [{ numerator: 1, denominator: 4 }], '분수로 나타내요', '전체 조각 수는 분모, 고른 조각 수는 분자예요.') };
  }
  if (unitId === 'capacity_weight') return { visualMarkup: measurementVisual({ kind: /kg|그램|무게/.test(question) ? 'weight' : 'capacity', generic: true }) };
  if (unitId === 'data_organization') return { visualMarkup: dataOrganizationVisual({ generic: true }) };
  if (unitId === 'fraction_division') return { visualMarkup: fractionDivisionVisual(fractionDivisionVisualData(question) || {}) };
  if (unitId === 'decimal_division') return { visualMarkup: decimalDivisionVisual(decimalDivisionVisualData(question) || { generic: true }) };
  if (unitId === 'space_solids') return { visualMarkup: spaceSolidsVisual(spaceSolidsDataForQuestion(question) || {}) };
  if (unitId === 'ratio_proportion') {
    const ratio = question.match(/(\d+)\s*:\s*(\d+)/);
    const left = ratio ? Number(ratio[1]) : 0;
    const right = ratio ? Number(ratio[2]) : 0;
    const total = ratio ? question.match(/\d+/g)?.map(Number).find((value) => value !== left && value !== right) : undefined;
    return { visualMarkup: ratioProportionVisual(ratio ? { left, right, total } : {}) };
  }
  if (unitId === 'circle_area') {
    const radius = question.match(/반지름(?:이|은|\s)*(\d+)/);
    const diameter = question.match(/지름(?:이|은|\s)*(\d+)/);
    return { visualMarkup: circleAreaVisual({ radius: Number(radius?.[1] || 0) || Number(diameter?.[1] || 0) / 2 }) };
  }
  if (unitId === 'cylinder_cone_sphere') {
    const kind = /원뿔/.test(question) ? 'cone' : /구/.test(question) ? 'sphere' : /전개도/.test(question) ? 'cylinder-net' : 'cylinder';
    return { visualMarkup: cylinderConeSphereVisual({ kind }) };
  }

  const calculation = parseDecimalOperation(question);
  let visual = '';
  if (calculation && !calculation.unsupported) {
    visual = calculationVisual({ ...calculation, showResult: true });
  } else if (/빼기|뺄셈|받아내림|subtraction/i.test(question)) {
    const example = parseDecimalOperation('7.3 - 2.4');
    visual = calculationVisual({ ...example, showResult: true });
  } else if (/더하기|덧셈|받아올림|addition/i.test(question)) {
    const example = parseDecimalOperation('1.7 + 1.9');
    visual = calculationVisual({ ...example, showResult: true });
  } else if (/소수점.*맞|자리 맞|자릿수/.test(question)) {
    const example = parseDecimalOperation('2.78 + 3.6');
    visual = calculationVisual({ ...example, showResult: true });
  } else {
    const value = question.match(/0\.\d{1,2}/)?.[0] || '0.37';
    visual = hundredthsVisual(value);
  }
  const skill = getSkillForQuestion(question, unitId);
  const status = getSkillStatus(studentSkillProgress[skill]);
  return { visualMarkup: status === 'secure' ? `<details class="optional-visual"><summary>그림이나 세로셈 보기</summary>${visual}</details>` : visual };
}

function workedReply(calculation, showResult = true) {
  const leftPlaces = calculation.left.split('.')[1]?.length || 0;
  const rightPlaces = calculation.right.split('.')[1]?.length || 0;
  const shorter = leftPlaces < rightPlaces
    ? [calculation.left, calculation.leftAligned]
    : [calculation.right, calculation.rightAligned];
  const placesNote = leftPlaces !== rightPlaces
    ? `\n\n소수 자릿수가 다르면 자릿수가 적은 수 오른쪽에 0을 붙여 맞춰요. ${shorter[0]} → ${shorter[1]}처럼 써도 수의 크기는 같아요.`
    : '';
  const method = calculation.operator === '+'
    ? '소수점을 맞춰 쓴 뒤 같은 자리끼리 더해요. 같은 자리의 합이 10이 되면 바로 왼쪽 자리로 받아올림해요.'
    : '소수점을 맞춰 쓴 뒤 같은 자리끼리 빼요. 위의 숫자가 더 작으면 바로 왼쪽 자리에서 1을 받아내려요. 1은 0.1 열 개, 0.1은 0.01 열 개와 같아요.';
  return {
    text: `계산식을 같이 풀어 볼게요.\n\n${method}${placesNote}${showResult ? `\n\n계산하면 ${calculation.result}입니다.` : '\n\n소수점 아래 가장 오른쪽 자리부터 계산해 보세요. 어느 자리에서 받아올림이나 받아내림이 필요한가요?'}`,
    calculation: { ...calculation, showResult },
    actions: showResult ? 'check' : 'hint',
  };
}

function tutorReply(question, unitId = activeStudyUnitId) {
  const text = question.toLowerCase();
  const unit = curriculumUnitById[unitId] || curriculumUnits[0];
  if (unitId === 'line_graphs') return graphTutorReply(question, activeMode, lineGraphSets);
  if (activeMode === 'teach') {
    const checkingQuestions = {
      fractions: '분모가 같은 분수를 더할 때 분모는 왜 그대로 두는지 설명해 줄래?',
      triangles: '그 삼각형을 그렇게 분류한 기준은 변의 길이였을까, 각의 크기였을까?',
      decimals: '소수점을 맞추면 왜 같은 자리끼리 계산할 수 있는지 말해 줄래?',
      quadrilaterals: '그 사각형에서 평행하거나 길이가 같은 변을 어떻게 찾았는지 설명해 줄래?',
      line_graphs: '그래프에서 그 값을 읽을 때 어느 축과 눈금을 확인했는지 말해 줄래?',
      polygons: '그 도형의 변과 꼭짓점을 어떤 순서로 세었는지 설명해 줄래?',
      fraction_multiplication: '대분수를 먼저 가분수로 바꾸는 이유가 무엇인지 말해 줄래?',
      decimal_multiplication: '곱의 소수점 자리를 어떻게 정했는지 설명해 줄래?',
      congruence_symmetry: '두 도형이 합동이라고 생각한 까닭을 설명해 줄래?',
      number_ranges: '이 범위에서 끝 수가 포함되는지 어떻게 판단했는지 말해 줄래?',
      rectangular_prisms: '입체도형의 면이나 모서리를 어떤 방향에서 세었는지 알려줄래?',
      average_probability: '평균이나 가능성을 구할 때 어떤 수를 먼저 모았는지 말해 줄래?',
      multiplication: '곱하는 수를 자릿값으로 어떻게 나누어 계산했는지 설명해 줄래?',
      division: '몫과 나머지를 곱셈으로 어떻게 확인했는지 말해 줄래?',
      circles: '원의 중심과 반지름을 어떻게 찾았는지 알려줄래?',
      fractions3: '분모와 분자가 각각 무엇을 나타내는지 네 말로 설명해 줄래?',
      capacity_weight: '단위를 바꿀 때 왜 1000을 곱하거나 나누는지 설명해 줄래?',
      data_organization: '그림그래프의 기호 하나가 나타내는 수를 어디에서 확인했는지 말해 줄래?',
      fraction_division: '나누는 분수를 뒤집어 곱하면 왜 같은 답이 되는지 네 생각을 말해 줄래?',
      decimal_division: '나누는 수를 자연수로 만들 때 두 수를 같이 바꾸는 이유를 설명해 줄래?',
      space_solids: '위에서 본 모양과 앞에서 본 모양이 어떻게 다르게 보이는지 알려줄래?',
      ratio_proportion: '전체를 비의 합으로 나누어 한 단위의 크기를 구한 이유는 뭐야?',
      circle_area: '원의 넓이를 구할 때 지름이 아니라 반지름을 사용하는 이유를 설명해 줄래?',
      cylinder_cone_sphere: '이 입체도형의 면이나 꼭짓점을 어떻게 구별했는지 말해 줄래?',
    };
    const hasExplanation = question.trim().length >= 24 && !/설명해 볼게|먼저 내가 생각|내가 이 개념/.test(question);
    return {
      text: hasExplanation
        ? `네가 설명한 방법을 들었어. 내가 제대로 이해했는지 확인해 볼게. ${checkingQuestions[unitId] || `${unit.title}에서 그렇게 생각한 까닭을 한 가지 더 말해 줄래?`}`
        : `좋아요. 이번엔 네가 ‘${unit.title}’ 선생님이에요. 먼저 네가 생각한 풀이를 한두 문장으로 설명해 줘요. 그다음 콩이가 이해한 걸 질문으로 확인할게요.`,
      actions: 'check',
    };
  }
  if (unitId === 'fractions') {
    const match = question.match(/(\d+)\s*\/\s*(\d+)\s*([+\-])\s*(\d+)\s*\/\s*(\d+)/);
    if (match && match[2] === match[5]) {
      const result = Number(match[1]) + (match[3] === '+' ? 1 : -1) * Number(match[4]);
      return { text: `분모가 같은 분수라 조각 크기는 그대로예요. 분자만 계산하면 ${match[1]} ${match[3]} ${match[4]} = ${result}이므로 답은 ${result}/${match[2]}예요.`, actions: 'check' };
    }
    const textReply = /뺄셈|빼기|받아내림/.test(text)
      ? '같은 크기 조각끼리 빼요. 대분수에서 분수 부분이 모자라면 자연수 1을 분모와 같은 크기의 분수로 바꿔 보세요.'
      : '분모가 같으면 조각 크기가 같아요. 그림에서 조각을 세듯 분자끼리 계산하고 분모는 그대로 두어요.';
    return { text: activeMode === 'stuck' ? '힌트: 먼저 두 분수가 같은 크기의 조각인지 분모를 비교해 봐요.' : textReply, actions: 'check' };
  }
  if (unitId === 'triangles') {
    const textReply = /예각|둔각|직각|각의/.test(text)
      ? '삼각형의 각을 살펴봐요. 직각이 하나 있으면 직각삼각형, 둔각이 하나 있으면 둔각삼각형, 세 각이 모두 예각이면 예각삼각형이에요.'
      : '변의 길이 표시를 살펴봐요. 두 변이 같으면 이등변삼각형, 세 변이 모두 같으면 정삼각형이에요. 각의 모양으로도 따로 분류할 수 있어요.';
    return { text: activeMode === 'stuck' ? '힌트: 먼저 세 변의 표시나 세 각 중 하나만 골라 살펴봐요.' : textReply, actions: 'check' };
  }
  if (unitId === 'quadrilaterals') {
    const textReply = /수직|평행선/.test(text)
      ? '직각으로 만나면 수직이고, 나란히 가며 만나지 않으면 평행이에요.'
      : /사다리꼴/.test(text)
        ? '사다리꼴은 마주 보는 변 한 쌍이 평행한 사각형이에요.'
        : /마름모/.test(text)
          ? '마름모는 네 변의 길이가 모두 같은 사각형이에요.'
          : '마주 보는 변의 평행 여부와 네 변의 길이, 네 각을 차례로 살펴보면 사각형을 구분할 수 있어요.';
    return { text: activeMode === 'stuck' ? '힌트: 먼저 마주 보는 변이 평행한지 또는 네 변 길이가 같은지 한 가지 성질을 살펴봐요.' : textReply, actions: 'check' };
  }
  if (unitId === 'polygons') {
    const textReply = /대각선/.test(text)
      ? '대각선은 서로 이웃하지 않은 두 꼭짓점을 이은 선분이에요.'
      : /정다각형/.test(text)
        ? '정다각형은 모든 변의 길이와 모든 각의 크기가 같은 다각형이에요.'
        : '다각형은 곧은 선분으로 둘러싸인 닫힌 도형이에요. 변과 꼭짓점을 세어 이름을 정해요.';
    return { text: activeMode === 'stuck' ? '힌트: 먼저 선분이 모두 이어져 닫혔는지, 변과 꼭짓점이 몇 개인지 세어봐요.' : textReply, actions: 'check' };
  }
  if (unitId === 'number_ranges') {
    const rounding = question.match(/([\d,]+).*?(십의|백의|천의) 자리.*?(반올림|올림|버림)/);
    if (rounding) {
      const value = Number(rounding[1].replace(/,/g, ''));
      const place = rounding[2];
      const factor = place === '십의' ? 10 : place === '백의' ? 100 : 1000;
      const rounded = rounding[3] === '올림' ? Math.ceil(value / factor) * factor : rounding[3] === '버림' ? Math.floor(value / factor) * factor : Math.round(value / factor) * factor;
      return { text: activeMode === 'stuck' ? `힌트: ${place} 자리 바로 오른쪽 숫자를 확인해요.` : `${value.toLocaleString('ko-KR')}를 ${place} 자리까지 ${rounding[3]}하면 ${rounded.toLocaleString('ko-KR')}이에요.`, actions: 'check' };
    }
    const range = question.match(/([\d,]+)\s*(이상|초과).*?([\d,]+)\s*(미만|이하)/);
    if (range) return { text: `${range[1]} ${range[2]}은 ${range[2] === '이상' ? '포함하고' : '포함하지 않아요'}, ${range[3]} ${range[4]}은 ${range[4] === '이하' ? '포함해요' : '포함하지 않아요'}.`, actions: 'check' };
    return { text: '이상과 이하는 기준 수를 포함하고, 초과와 미만은 기준 수를 포함하지 않아요. 어림할 때는 어느 자리까지 나타낼지 먼저 정해요.', actions: 'check' };
  }
  if (unitId === 'fraction_multiplication') {
    const product = parseFractionMultiplication(question);
    if (product) return { text: activeMode === 'stuck' ? '힌트: 분자끼리 곱하고 분모끼리 곱한 뒤, 분자와 분모를 함께 나눌 수 있는 수가 있는지 찾아봐요.' : `분자끼리, 분모끼리 곱해요. 계산한 뒤 약분하면 ${product.answer}예요.`, actions: 'check' };
    return { text: '분수에 자연수를 곱할 때는 분자에 곱하고 분모는 그대로 둬요. 분수끼리는 분자끼리, 분모끼리 곱한 뒤 약분할 수 있어요.', actions: 'check' };
  }
  if (unitId === 'congruence_symmetry') {
    if (/대칭축|몇.*축/.test(text)) {
      const axes = /정사각형/.test(text) ? 4 : /직사각형/.test(text) ? 2 : /정삼각형/.test(text) ? 3 : /이등변삼각형/.test(text) ? 1 : null;
      if (axes !== null) return { text: `${/정사각형/.test(text) ? '정사각형' : /직사각형/.test(text) ? '직사각형' : /정삼각형/.test(text) ? '정삼각형' : '이등변삼각형'}의 대칭축은 ${axes}개예요.`, actions: 'check' };
    }
    return { text: /합동|포개/.test(text) ? '합동인 도형은 모양과 크기가 같아 포개었을 때 완전히 겹쳐요.' : '대칭축을 따라 접었을 때 양쪽 모양이 포개지면 선대칭도형이에요. 합동은 모양과 크기가 모두 같은 도형을 말해요.', actions: 'check' };
  }
  if (unitId === 'decimal_multiplication') {
    const product = parseDecimalMultiplication(question);
    if (product) {
      const integerProduct = Number(product.left.replace('.', '')) * Number(product.right.replace('.', ''));
      return { text: activeMode === 'stuck' ? `힌트: 소수점을 잠깐 빼고 ${product.left}과 ${product.right}의 숫자끼리 곱해요. 두 수의 소수 자릿수도 세어봐요.` : `${product.left}×${product.right}에서 소수점을 잠시 빼면 ${integerProduct}예요. 두 수의 소수 자릿수를 합해 소수점을 놓으면 ${product.result}예요.`, actions: 'check' };
    }
    return { text: '소수의 곱셈은 소수점을 잠깐 빼고 곱한 뒤, 두 수의 소수 자릿수를 합한 만큼 곱에 소수점을 놓아요.', actions: 'check' };
  }
  if (unitId === 'rectangular_prisms') {
    const answer = /면|몇.*개/.test(text) ? '면은 6개' : /모서리/.test(text) ? '모서리는 12개' : /꼭짓점/.test(text) ? '꼭짓점은 8개' : '';
    return { text: answer ? `직육면체는 ${answer}예요. 서로 마주 보는 면은 3쌍이고, 한 꼭짓점에는 모서리 3개가 모여요.` : '직육면체는 면 6개, 모서리 12개, 꼭짓점 8개로 이루어져요. 전개도는 여섯 면을 펼쳐 놓은 모양이에요.', actions: 'check' };
  }
  if (unitId === 'average_probability') {
    const values = /평균/.test(text) ? question.match(/\d+(?:\.\d+)?/g)?.map(Number) : null;
    if (values?.length > 1) {
      const average = values.reduce((sum, value) => sum + value, 0) / values.length;
      return { text: `자료를 모두 더하면 ${values.reduce((sum, value) => sum + value, 0)}이고 자료는 ${values.length}개예요. ${values.reduce((sum, value) => sum + value, 0)}÷${values.length}=${Number.isInteger(average) ? average : average.toFixed(2)}이므로 평균은 그 값이에요.`, actions: 'check' };
    }
    return { text: /평균/.test(text) ? '평균은 자료의 합을 자료의 수로 나눈 값이에요.' : '가능성은 불가능, 가능성이 낮음, 반반, 가능성이 높음, 확실함처럼 비교해요. 같은 기회가 몇 개씩 있는지 세어봐요.', actions: 'check' };
  }
  if (unitId === 'fraction_division') {
    const result = parseFractionDivision(question);
    if (result) return { text: activeMode === 'stuck' ? '힌트: 분수끼리 나눌 때는 나누는 분수를 뒤집어 곱해요.' : `나누는 분수를 뒤집어 곱한 뒤 약분하면 ${result.answer}예요.`, actions: 'check' };
    return { text: '분수를 자연수로 나누면 분모에 그 자연수를 곱해요. 분수끼리 나눌 때는 나누는 분수를 뒤집어 곱해요.', actions: 'check' };
  }
  if (unitId === 'decimal_division') {
    const division = decimalDivisionVisualData(question);
    if (division) {
      const answer = Number((division.dividend / division.divisor).toFixed(6)).toString();
      return { text: activeMode === 'stuck' ? '힌트: 나누는 수를 자연수로 만들도록 두 수의 소수점을 같은 만큼 옮겨요.' : `${division.dividend}÷${division.divisor}=${answer}예요. 나누는 수를 자연수로 만들 때 두 수를 같은 수만큼 곱해요.`, actions: 'check' };
    }
    return { text: '소수를 나눌 때 나누는 수가 소수이면 두 수의 소수점을 같은 자리 수만큼 옮겨 나누는 수를 자연수로 만들어요.', actions: 'check' };
  }
  if (unitId === 'space_solids') {
    const data = spaceSolidsDataForQuestion(question);
    if (data?.stacks) {
      const topSquares = data.stacks.flat().filter((height) => height > 0).length;
      const cubes = data.stacks.flat().reduce((sum, height) => sum + height, 0);
      const frontHeights = Array.from({ length: Math.max(...data.stacks.map((row) => row.length)) }, (_, index) => Math.max(...data.stacks.map((row) => row[index] || 0)));
      if (/위에서|위쪽/.test(question)) return { text: `위에서 보면 바닥 자리가 ${topSquares}칸 보여요. 쌓인 높이는 위에서 본 칸 수에 더하지 않아요.`, actions: 'check' };
      if (/모두 몇 개|모두 몇|쌓기나무/.test(question)) return { text: `각 자리의 높이를 더하면 쌓기나무는 모두 ${cubes}개예요.`, actions: 'check' };
      if (/앞에서|가장 높은/.test(question)) return { text: `앞에서 본 가장 높은 부분은 ${Math.max(...frontHeights)}층이에요.`, actions: 'check' };
    }
    return { text: '위에서 본 모양은 바닥 자리의 배열이고, 앞이나 옆에서 본 모양은 그 방향에서 보이는 높이를 나타내요.', actions: 'check' };
  }
  if (unitId === 'ratio_proportion') {
    const ratio = question.match(/(\d+)\s*:\s*(\d+)/);
    if (ratio) {
      const left = Number(ratio[1]);
      const right = Number(ratio[2]);
      const proportion = question.match(/=\s*(\d+)\s*:\s*(?:□|\?)/);
      if (proportion) return { text: `${left}이 ${proportion[1]}로 ${Number(proportion[1]) / left}배 되었어요. ${right}에도 같은 수를 곱하면 ${right * Number(proportion[1]) / left}예요.`, actions: 'check' };
      const numbers = question.match(/\d+/g)?.map(Number) || [];
      const total = numbers.find((value) => value !== left && value !== right);
      if (total && /전체|모두|나누면|몫/.test(question)) {
        const onePart = total / (left + right);
        const selected = /작은 몫|작은 쪽/.test(question) ? Math.min(left, right) : /큰 몫|큰 쪽/.test(question) ? Math.max(left, right) : left;
        return { text: `비의 합은 ${left + right}예요. 한 단위는 ${total}÷${left + right}=${onePart}이고, 선택한 쪽은 ${selected}단위이므로 ${selected * onePart}예요.`, actions: 'check' };
      }
    }
    return { text: '비례식은 두 비의 값이 같다는 식이에요. 비례배분은 전체를 비의 합으로 나누어 한 단위의 크기를 먼저 구해요.', actions: 'check' };
  }
  if (unitId === 'circle_area') {
    const radiusMatch = question.match(/반지름(?:이|은|\s)*(\d+(?:\.\d+)?)/);
    const diameterMatch = question.match(/지름(?:이|은|\s)*(\d+(?:\.\d+)?)/);
    const radius = radiusMatch ? Number(radiusMatch[1]) : diameterMatch ? Number(diameterMatch[1]) / 2 : null;
    if (radius !== null) {
      const area = (radius * radius * 3.14).toFixed(2).replace(/\.00$/, '');
      return { text: activeMode === 'stuck' ? '힌트: 지름이 주어졌다면 먼저 2로 나누어 반지름을 구해요.' : `반지름은 ${radius}예요. 원의 넓이는 반지름×반지름×3.14이므로 ${area}예요.`, actions: 'check' };
    }
    return { text: '원의 넓이는 반지름×반지름×3.14로 구해요. 지름이 주어지면 먼저 반으로 나누어 반지름을 찾아요.', actions: 'check' };
  }
  if (unitId === 'cylinder_cone_sphere') {
    if (/원기둥/.test(text)) return { text: '원기둥은 평행하고 합동인 원 모양 밑면 두 개와 옆면으로 이루어져요. 꼭짓점은 없어요.', actions: 'check' };
    if (/원뿔/.test(text)) return { text: '원뿔은 원 모양 밑면 한 개와 곡면, 그리고 꼭짓점 한 개가 있어요.', actions: 'check' };
    if (/구/.test(text)) return { text: '구는 둥근 곡면으로 이루어져 있고 평평한 면, 모서리, 꼭짓점은 없어요.', actions: 'check' };
    return { text: '원기둥, 원뿔, 구를 비교할 때는 평평한 면과 곡면, 모서리, 꼭짓점이 있는지 살펴봐요.', actions: 'check' };
  }
  if (unitId === 'multiplication') {
    const factors = question.match(/(\d+)\s*[×*]\s*(\d+)/);
    if (factors) {
      const left = Number(factors[1]);
      const right = Number(factors[2]);
      return { text: activeMode === 'stuck' ? `힌트: ${right}를 십의 자리와 일의 자리로 나누어 ${left}에 곱해 보세요.` : `${left}×${right}=${left * right}예요. 십의 자리와 일의 자리로 나누어 곱한 뒤 더할 수도 있어요.`, actions: 'check' };
    }
    return { text: '곱셈은 같은 수를 여러 번 더하는 계산이에요. 큰 수는 자릿값에 따라 나누어 곱한 뒤 더해요.', actions: 'check' };
  }
  if (unitId === 'division') {
    const division = question.match(/(\d+)\s*[÷/]\s*(\d+)/);
    if (division) {
      const dividend = Number(division[1]);
      const divisor = Number(division[2]);
      const quotient = Math.floor(dividend / divisor);
      const remainder = dividend % divisor;
      return { text: activeMode === 'stuck' ? `힌트: ${divisor}에 몫을 곱해 ${dividend}에 가까운 수를 찾아봐요.` : `${dividend}÷${divisor}는 몫 ${quotient}${remainder ? `, 나머지 ${remainder}` : ''}예요. 곱셈으로 ${divisor}×${quotient}${remainder ? `+${remainder}` : ''}=${dividend}인지 확인해요.`, actions: 'check' };
    }
    return { text: '나눗셈은 똑같이 나누거나 같은 수씩 묶는 계산이에요. 몫은 한 묶음의 수이고, 나머지는 남은 수예요.', actions: 'check' };
  }
  if (unitId === 'circles') {
    const radius = question.match(/반지름(?:이|은|\s)*(\d+)\s*cm/);
    const diameter = question.match(/지름(?:이|은|\s)*(\d+)\s*cm/);
    if (radius) return { text: `원의 지름은 반지름의 2배예요. 반지름이 ${radius[1]}cm이면 지름은 ${Number(radius[1]) * 2}cm예요.`, actions: 'check' };
    if (diameter) return { text: `원의 반지름은 지름의 절반이에요. 지름이 ${diameter[1]}cm이면 반지름은 ${Number(diameter[1]) / 2}cm예요.`, actions: 'check' };
    return { text: '원의 중심은 가운데 점이고, 반지름은 중심에서 원 위까지의 선분이에요. 지름은 중심을 지나 원의 양쪽 끝을 이어요.', actions: 'check' };
  }
  if (unitId === 'fractions3') {
    const values = [...question.matchAll(/(\d+)\s*\/\s*(\d+)/g)].map((match) => [Number(match[1]), Number(match[2])]);
    if (values.length >= 2) {
      const [[firstNumerator, firstDenominator], [secondNumerator, secondDenominator]] = values;
      const first = firstNumerator / firstDenominator;
      const second = secondNumerator / secondDenominator;
      return { text: first === second ? '두 분수의 크기가 같아요.' : `${first > second ? `${firstNumerator}/${firstDenominator}` : `${secondNumerator}/${secondDenominator}`}가 더 커요. 같은 전체를 같은 크기로 나눈 조각 수를 비교해요.`, actions: 'check' };
    }
    return { text: '분수에서 분모는 전체를 똑같이 나눈 조각 수, 분자는 그중 고른 조각 수예요. 같은 전체라면 그림의 조각 크기도 함께 살펴봐요.', actions: 'check' };
  }
  if (unitId === 'capacity_weight') {
    return { text: '1L는 1000mL이고 1kg은 1000g이에요. 더하거나 빼기 전에 먼저 같은 단위로 바꾸면 계산하기 쉬워요.', actions: 'check' };
  }
  if (unitId === 'data_organization') {
    return { text: '표는 항목별 자료 수를 정리해 비교하기 쉬워요. 그림그래프는 그림 기호 하나가 몇 개를 나타내는지 범례부터 확인해요.', actions: 'check' };
  }
  const calculation = parseDecimalOperation(question);
  if (calculation?.unsupported) {
    return { text: '이 연습 튜터는 소수 둘째 자리까지의 덧셈과 뺄셈을 다뤄요. 또 뺄셈은 큰 수에서 작은 수를 빼는 문제로 함께 연습해요. 식을 그 범위에 맞춰 다시 적어 볼까요?', actions: 'hint' };
  }
  if (!calculation && /소수 두 자리|소수 둘째 자리|백분의|자리값|0\.\d{2}/.test(text)) {
    const value = text.match(/0\.\d{2}/)?.[0] || '0.37';
    const hundredths = Math.round(Number(value) * 100);
    return {
      text: `${value}는 0.01이 ${hundredths}개예요. 10개씩 묶으면 0.1이 ${Math.floor(hundredths / 10)}개와 0.01이 ${hundredths % 10}개 남아요.`,
      actions: 'check',
    };
  }
  if (activeMode === 'check') {
    const submitted = question.match(/[=＝]\s*(\d+(?:\.\d+)?)/);
    if (calculation && submitted) {
      const correct = Number(submitted[1]) === Number(calculation.result);
      const worked = workedReply(calculation, true);
      return {
        ...worked,
        text: correct ? `맞아요! ${calculation.left} ${calculation.operator} ${calculation.right}의 답은 ${calculation.result}입니다.\n\n소수점을 맞추고 같은 자리끼리 계산했는지 확인해 보세요.` : `계산을 다시 살펴볼게요. ${calculation.left} ${calculation.operator} ${calculation.right}의 답은 ${calculation.result}입니다.\n\n소수점끼리 맞춰 썼는지, 받아올림이나 받아내림을 빠뜨리지 않았는지 확인해 봐요.`,
        actions: 'check',
      };
    }
    return { text: '계산식과 네 답을 함께 적어 주세요. 예를 들어 ‘2.78 + 3.6 = 6.38’처럼 보내면 소수점 위치와 계산 결과를 확인해 볼게요.', actions: 'hint' };
  }
  if (calculation) return workedReply(calculation, activeMode !== 'stuck');
  if (activeMode === 'stuck') {
    return {
      text: '막힌 식을 같이 살펴봐요. 먼저 두 수를 세로로 쓸 때 소수점끼리 맞춰 보세요.\n\n더하기라면 같은 자리의 합이 10 이상인지, 빼기라면 위 숫자가 더 작아 받아내림이 필요한 자리가 있는지 찾아볼까요?',
      actions: 'hint',
    };
  }
  if (/자릿수|소수점|자리 맞/.test(text)) {
    const example = parseDecimalOperation('2.78 + 3.6');
    return {
      text: '소수점끼리 세로줄을 맞추면 같은 자리끼리 계산할 수 있어요.\n\n3.6은 3.60과 같은 수라서 소수 둘째 자리까지 맞춰 쓸 수 있어요. 오른쪽에 붙인 0은 수의 크기를 바꾸지 않아요.',
      calculation: { ...example, showResult: false },
      actions: 'check',
    };
  }
  if (/덧셈|더하기|받아올림/.test(text)) {
    const example = parseDecimalOperation('0.8 + 0.5');
    return {
      text: '소수의 덧셈은 소수점끼리 맞추고 같은 자리끼리 더해요.\n\n0.8은 0.1이 8개, 0.5는 0.1이 5개예요. 0.1이 10개 모이면 1이 되므로 받아올림이 생겨요.',
      calculation: { ...example, showResult: true },
      actions: 'check',
    };
  }
  if (/뺄셈|빼기|받아내림/.test(text)) {
    const example = parseDecimalOperation('7.3 - 2.4');
    return {
      text: '소수의 뺄셈도 소수점끼리 맞추고 같은 자리끼리 빼요.\n\n십분의 자리에서 3개로 4개를 뺄 수 없으므로 1을 받아내려요. 7.3의 7은 6이 되고, 0.3은 13개의 0.1로 생각해요.',
      calculation: { ...example, showResult: true },
      actions: 'check',
    };
  }
  return {
    text: '이 단원은 먼저 소수 둘째 자리의 뜻을 익히고, 소수의 덧셈과 뺄셈으로 이어가요.\n\n계산할 때 소수점끼리 맞추는 방법이나 0.01이 몇 개인지 궁금하면 편하게 물어봐요.',
    actions: 'hint',
  };
}

function hintReply() {
  hintCount += 1;
  if (data.records[0]) data.records[0].hints = hintCount;
  saveData();
  askQuestion('힌트 하나만 더 주세요. 정답을 바로 말하지 말고 다음에 생각할 한 가지만 알려주세요.', {
    record: false,
    resetHints: false,
    updateLastQuestion: false,
  });
}

function localHintReply(unitId = activeStudyUnitId) {
  if (unitId === 'fractions') return '힌트: 먼저 두 분수의 분모를 비교해요. 같은 분모라면 같은 크기 조각이므로 분자끼리 계산할 수 있어요.';
  if (unitId === 'triangles') return '힌트: 변의 길이 표시와 각의 모양을 따로 살펴보세요. 같은 삼각형도 두 기준으로 분류할 수 있어요.';
  if (unitId === 'quadrilaterals') return '힌트: 마주 보는 변이 평행한지, 네 변의 길이가 같은지, 각이 직각인지 한 가지씩 확인해요.';
  if (unitId === 'line_graphs') return '힌트: 가로축에서 시점을 찾은 뒤 점의 높이를 읽고, 이웃한 점이 올라가는지 내려가는지 살펴봐요.';
  if (unitId === 'polygons') return '힌트: 선분이 이어져 닫혔는지 먼저 보고, 변과 꼭짓점을 세어봐요.';
  if (unitId === 'multiplication') return '힌트: 곱하는 수를 십의 자리와 일의 자리로 나누어 계산한 뒤 더해봐요.';
  if (unitId === 'division') return '힌트: 나누는 수에 몫을 곱해 나누어지는 수에 가까운 곱을 찾아봐요.';
  if (unitId === 'circles') return '힌트: 컴퍼스 바늘이 놓이는 점이 중심이고, 중심에서 원 위까지가 반지름이에요.';
  if (unitId === 'fractions3') return '힌트: 전체를 똑같이 나눈 수가 분모, 그중 고른 수가 분자예요.';
  if (unitId === 'capacity_weight') return '힌트: 더하기 전에 들이나 무게를 같은 단위로 바꾸어 써봐요.';
  if (unitId === 'data_organization') return '힌트: 그림그래프는 먼저 기호 하나가 몇 개를 나타내는지 범례를 확인해요.';
  if (unitId === 'fraction_division') return '힌트: 분수끼리 나눌 때는 나누는 분수의 분자와 분모를 바꾸어 곱해요.';
  if (unitId === 'decimal_division') return '힌트: 나누는 수를 자연수로 만들기 위해 두 수의 소수점을 같은 만큼 옮겨요.';
  if (unitId === 'space_solids') return '힌트: 위에서 본 모양은 바닥 자리를, 앞이나 옆에서 본 모양은 보이는 높이를 살펴봐요.';
  if (unitId === 'ratio_proportion') return '힌트: 비례배분은 먼저 비의 두 수를 더해 한 단위의 크기를 구해요.';
  if (unitId === 'circle_area') return '힌트: 원의 넓이는 지름이 아니라 반지름을 두 번 곱하고 원주율 3.14를 곱해요.';
  if (unitId === 'cylinder_cone_sphere') return '힌트: 평평한 면, 곡면, 모서리, 꼭짓점이 있는지 도형을 돌려 살펴봐요.';
  if (unitId === 'number_ranges') return '힌트: 이상·이하와 초과·미만이 끝 수를 포함하는지 확인해요.';
  if (unitId === 'fraction_multiplication') return '힌트: 분자끼리, 분모끼리 곱한 다음 약분할 수 있는지 살펴봐요.';
  if (unitId === 'congruence_symmetry') return '힌트: 접었을 때 양쪽이 포개지는 선이 대칭축이에요.';
  if (unitId === 'decimal_multiplication') return '힌트: 소수점을 잠시 빼고 곱한 뒤 두 수의 소수 자릿수를 합해봐요.';
  if (unitId === 'rectangular_prisms') return '힌트: 면, 모서리, 꼭짓점을 하나씩 표시하며 세어봐요.';
  if (unitId === 'average_probability') return '힌트: 평균은 자료의 합을 자료의 수로 나누고, 가능성은 경우의 수를 비교해요.';
  const calculation = parseDecimalOperation(lastQuestion);
  if (calculation?.operator === '-') return '소수점을 세로로 맞춘 뒤, 위의 같은 자리 숫자가 더 작은 곳을 찾아봐요. 그 자리는 왼쪽 자리에서 1을 받아내려야 할 수 있어요.';
  if (calculation?.operator === '+') return '소수점을 세로로 맞춘 뒤, 가장 오른쪽 자리부터 더해봐요. 같은 자리의 합이 10이 되면 1을 받아올림해요.';
  return '소수점끼리 세로줄을 맞추고 같은 자리끼리 계산해봐요. 정답보다 어느 자리가 헷갈리는지 먼저 찾아봐요.';
}

function checkProblem() {
  let problem;
  if (activeStudyUnitId !== 'decimals') {
    const unitMissions = dailyMissions.filter((mission) => mission.unitId === activeStudyUnitId);
    const skill = getSkillForQuestion(lastQuestion, activeStudyUnitId);
    const graphQuestions = activeStudyUnitId === 'line_graphs' && ['graph_read', 'graph_change'].includes(skill)
      ? makeGraphBattleQuestions(getTutorGraphData(lastQuestion, lineGraphSets)).filter((question) => question.skill === skill)
      : [];
    const skillMissions = unitMissions.filter((mission) => mission.skill === skill);
    const candidates = graphQuestions.length ? graphQuestions : skillMissions.length ? skillMissions : unitMissions;
    const selected = candidates[Math.floor(Math.random() * candidates.length)];
    problem = {
      prompt: `확인 문제: ${selected.title || selected.questionTitle}\n${selected.prompt || selected.question}\n선택지: ${selected.choices.join(' / ')}`,
      answer: [selected.answer],
      retryText: selected.retryText,
      unitId: selected.unitId || activeStudyUnitId,
      skill: selected.skill || skill,
      graphId: selected.graphId,
    };
  } else {
    const asked = parseDecimalOperation(lastQuestion);
    if (asked?.operator === '-' || /뺄셈|빼기|받아내림/.test(lastQuestion)) {
    const expression = asked?.places > 1 ? '9.2 - 5.29' : '7.3 - 2.4';
    const calculation = parseDecimalOperation(expression);
    problem = {
      prompt: `확인 문제: ${expression} = ?`,
      answer: [calculation.result],
      retryText: asked?.places > 1
        ? '9.2를 9.20으로 바꿔 소수점끼리 맞춰 보세요. 소수 둘째 자리에서 뺄 수 없으면 소수 첫째 자리에서 받아내려요.'
        : '십분의 자리에서 3개로 4개를 뺄 수 없어요. 1을 받아내려 7.3을 6과 13개의 0.1로 나누어 생각해 보세요.',
    };
    } else if (asked?.operator === '+' || /덧셈|더하기|받아올림/.test(lastQuestion)) {
    const expression = asked?.places > 1 ? '2.75 + 3.56' : '1.7 + 1.9';
    const calculation = parseDecimalOperation(expression);
    problem = {
      prompt: `확인 문제: ${expression} = ?`,
      answer: [calculation.result],
      retryText: '소수점끼리 맞추고 같은 자리끼리 더해 보세요. 0.1이 10개가 되면 1로 받아올림하는 것도 확인해요.',
    };
    } else if (/소수 두 자리|소수 둘째 자리|백분의|자리값|\d+\.\d{2}/.test(lastQuestion)) {
    problem = {
      prompt: '확인 문제: 0.46은 0.01이 몇 개일까요?',
      answer: ['46'],
      retryText: '0.46은 0.1이 4개, 0.01이 6개예요. 0.1 하나는 0.01 열 개이므로 모두 0.01이 46개예요.',
    };
    } else if (/자릿수|소수점/.test(lastQuestion)) {
    const calculation = parseDecimalOperation('2.78 + 3.6');
    problem = {
      prompt: '확인 문제: 2.78 + 3.6 = ?',
      answer: [calculation.result],
      retryText: '3.6의 오른쪽에 0을 붙여 3.60으로 쓴 뒤 소수점끼리 맞춰 계산해 보세요.',
    };
    } else {
    const calculation = parseDecimalOperation('0.37 + 0.01');
    problem = {
      prompt: '확인 문제: 0.37에 0.01을 더하면 얼마일까요?',
      answer: [calculation.result],
      retryText: '0.37은 0.01이 37개예요. 0.01 하나를 더하면 38개, 즉 0.38이에요.',
    };
    }
    problem.unitId = activeStudyUnitId;
    problem.skill = getSkillForQuestion(problem.prompt, problem.unitId);
  }
  problem.startedAt = Date.now();
  elements.activeProblem = problem;
  if (data.records[0]) data.records[0].practiceStartedAt = problem.startedAt;
  saveData();
  const prompt = `${problem.prompt}\n\n답을 입력하면 함께 확인해 볼게요.`;
  updateNotebookPrompt(problem.prompt.replace(/^확인 문제:\s*/, ''));
  conversation.push({ role: 'assistant', content: prompt });
  addMessage('tutor', prompt, getTutorVisualOptions(problem.prompt, problem.unitId, problem.graphId));
  appendTeacherTranscript('tutor', prompt);
  elements.input.placeholder = '확인 문제의 답을 적어보세요...';
  elements.input.focus();
}

function normalizeAnswer(value) {
  return value.toLowerCase().replace(/[\s,!?.,]/g, '').replace(/÷/g, '/');
}

async function getUpstageReply(messages, mode, conversationId, unitId = activeStudyUnitId) {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session?.access_token) throw new Error('다시 로그인해 주세요.');
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ mode, messages: messages.slice(-10), conversationId, unitId }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || '콩이와 연결하지 못했어요.');
  if (typeof result.reply !== 'string' || !result.reply.trim()) throw new Error('콩이가 빈 답변을 보냈어요.');
  return {
    reply: result.reply.trim(),
    moderation: result.moderation || { flagged: false },
    conversationId: result.conversationId || null,
  };
}

function setTutorBusy(busy) {
  tutorBusy = busy;
  elements.input.disabled = busy;
  elements.form.querySelector('button[type="submit"]').disabled = busy;
  document.querySelector('#new-chat').disabled = busy;
  elements.quickPrompts.querySelectorAll('button').forEach((button) => { button.disabled = busy; });
  elements.messages.querySelectorAll('.inline-action').forEach((button) => { button.disabled = busy; });
  document.querySelectorAll('.mode-card, #teach-mode-toggle, #teach-mode-exit').forEach((button) => { button.disabled = busy; });
}

function appendTeacherTranscript(role, text) {
  const record = data.records[0];
  if (!record?.student) return;
  if (!Array.isArray(record.messages)) record.messages = [];
  record.messages.push({ role, text: text.slice(0, 800), at: Date.now() });
  record.messages = record.messages.slice(-16);
  saveData();
  void syncSupabaseRecord(record);
}

async function syncSupabaseRecord(record) {
  if (!supabaseClient || !studentSession?.id || !record?.student) return;
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session?.access_token) return;
    const response = await fetch('/api/student-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({
        id: record.supabaseId,
        question: record.text,
        mode: record.mode,
        unitId: record.unitId || activeStudyUnitId,
        messages: record.messages,
        result: record.result,
        practiceSeconds: record.practiceSeconds,
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || '대화를 안전하게 저장하지 못했어요.');
    if (!record.supabaseId && result.id) {
      record.supabaseId = result.id;
      saveData();
    }
  } catch {
    showToast('학습 기록을 서버에 저장하지 못했어요.');
  }
}

async function askQuestion(question, options = {}) {
  const cleanQuestion = question.trim();
  if (!cleanQuestion || tutorBusy) return;
  const { record = true, resetHints = true, updateLastQuestion = true } = options;
  elements.quickPrompts.hidden = true;
  addMessage('user', cleanQuestion);
  conversation.push({ role: 'user', content: cleanQuestion });
  if (resetHints) hintCount = 0;
  if (updateLastQuestion) {
    lastQuestion = cleanQuestion;
    updateNotebookPrompt(cleanQuestion);
  }
  if (record) {
    data.total += 1;
      data.records.unshift({
        text: cleanQuestion,
        mode: activeMode,
        unitId: activeStudyUnitId,
        unitId: activeStudyUnitId,
        at: Date.now(),
      hints: 0,
      result: null,
      flagged: false,
      student: studentSession ? { grade: '4', classNumber: studentSession.classNumber, number: studentSession.number, name: studentSession.name } : null,
      messages: [{ role: 'student', text: cleanQuestion, at: Date.now() }],
      supabaseId: null,
    });
    data.records = data.records.slice(0, 20);
    saveData();
  } else {
    appendTeacherTranscript('student', cleanQuestion);
  }
  publishStudentActivity('콩이와 대화 중');
  setTutorBusy(true);
  const loading = addMessage('tutor', '콩이가 생각하고 있어요…');
  loading.querySelector('.bubble').classList.add('typing-bubble');
  try {
    const result = await getUpstageReply(conversation, activeMode, data.records[0]?.supabaseId, activeStudyUnitId);
    loading.remove();
    const reply = result.reply;
    conversation.push({ role: 'assistant', content: reply });
    addMessage('tutor', reply, { ...getTutorVisualOptions(cleanQuestion, activeStudyUnitId), actions: 'check' });
    if (data.records[0] && result.conversationId && (record || !data.records[0].supabaseId)) {
      data.records[0].supabaseId = result.conversationId;
      saveData();
    }
    appendTeacherTranscript('tutor', reply);
    if (result.moderation?.flagged && data.records[0]) {
      data.records[0].flagged = true;
      data.records[0].flagReason = result.moderation.category;
      data.records[0].flaggedText = cleanQuestion;
      saveData();
      void syncSupabaseRecord(data.records[0]);
      showToast('교사가 확인할 내용으로 표시했어요.');
    }
  } catch (error) {
    loading.remove();
    const fallback = updateLastQuestion ? tutorReply(cleanQuestion, activeStudyUnitId) : { text: localHintReply(activeStudyUnitId), actions: 'check' };
    conversation.push({ role: 'assistant', content: fallback.text });
    addMessage('tutor', fallback.text, { ...fallback, ...getTutorVisualOptions(cleanQuestion, activeStudyUnitId) });
    appendTeacherTranscript('tutor', fallback.text);
    showToast(`${error.message || 'AI 연결이 잠시 어려워요.'} 예시 도움을 보여드릴게요.`);
  } finally {
    setTutorBusy(false);
  }
}

function submitAnswer(answer) {
  const problem = elements.activeProblem;
  addMessage('user', answer);
  conversation.push({ role: 'user', content: answer });
  appendTeacherTranscript('student', answer);
  data.attempts += 1;
  const normalized = normalizeAnswer(answer);
  const numericAnswer = Number(answer);
  const correct = problem.answer.some((candidate) => normalizeAnswer(candidate) === normalized || (Number.isFinite(numericAnswer) && numericAnswer === Number(candidate)));
  void recordSkillAttempt(problem.skill || getSkillForQuestion(lastQuestion, activeStudyUnitId), correct, hintCount, problem.unitId || activeStudyUnitId);
  if (data.records[0]) {
    data.records[0].result = correct ? 'correct' : 'retry';
    data.records[0].practiceSeconds = Math.max(1, Math.round((Date.now() - problem.startedAt) / 1000));
    delete data.records[0].practiceStartedAt;
    void syncSupabaseRecord(data.records[0]);
  }
  if (correct) {
    data.correct += 1;
    const currentUnitTitle = curriculumUnitById[problem.unitId || activeStudyUnitId]?.title || '수학';
    const feedback = `맞았어요! ${currentUnitTitle}에서 배운 방법을 잘 적용했어요. 풀이에서 가장 중요했던 생각을 말로 설명해 보면 원리가 더 또렷해져요.`;
    conversation.push({ role: 'assistant', content: feedback });
    addMessage('tutor', feedback);
    appendTeacherTranscript('tutor', feedback);
  } else {
    const feedback = problem.retryText || '문제의 기준과 조건을 다시 읽어 보세요. 어떤 규칙을 사용했는지 풀이를 나누어 살펴보면 어디를 고칠지 찾을 수 있어요.';
    conversation.push({ role: 'assistant', content: feedback });
    addMessage('tutor', feedback);
    appendTeacherTranscript('tutor', feedback);
  }
  delete elements.activeProblem;
  elements.input.placeholder = tutorModeGuide(curriculumUnitById[activeStudyUnitId] || curriculumUnits[0], activeMode).placeholder;
  saveData();
}

function renderStats() {
  elements.historyCount.textContent = data.records.length;
  elements.historyList.replaceChildren();
  if (!data.records.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-history';
    empty.innerHTML = '아직 모아둔 질문이 없어요.<br />궁금할 때 하나씩 남겨봐요.';
    elements.historyList.append(empty);
  } else {
    data.records.slice(0, 4).forEach((record) => {
      const entry = document.createElement('div');
      entry.className = 'history-entry';
      const icon = record.mode === 'concept' ? '◇' : record.mode === 'stuck' ? '↗' : '✓';
      const stamp = new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric' }).format(new Date(record.at));
      const title = document.createElement('strong');
      title.innerHTML = formatFractionText(record.text);
      const date = document.createElement('small');
      const details = [modes[record.mode]?.label || '수학 질문', stamp];
      if (record.hints) details.push(`힌트 ${record.hints}`);
      if (record.result === 'correct') details.push(`확인 정답 · ${record.practiceSeconds || 1}초`);
      if (record.result === 'retry') details.push('확인 더 연습하기');
      date.textContent = details.join(' · ');
      const copy = document.createElement('span');
      copy.className = 'history-entry-copy';
      copy.append(title, date);
      const mark = document.createElement('span');
      mark.className = 'history-entry-icon';
      mark.setAttribute('aria-hidden', 'true');
      mark.textContent = icon;
      entry.append(mark, copy);
      elements.historyList.append(entry);
    });
  }
  elements.clearHistory.hidden = !studentSession;
}

let teacherDataRefreshId = 0;
let lastTeacherRosterRefresh = 0;
function renderTeacherLive(activeSource, recordSource) {
  if (arguments.length === 0 && supabaseClient && teacherSession?.id) {
    void loadTeacherSupabaseData();
    return;
  }
  const activeList = document.querySelector('#teacher-active-list');
  const conversationList = document.querySelector('#teacher-conversation-log');
  const alertPanel = document.querySelector('#teacher-alert-panel');
  const alertList = document.querySelector('#teacher-alert-list');
  const alertCount = document.querySelector('#teacher-alert-count');
  if (!activeList || !conversationList || !alertPanel || !teacherSession) return;

  const classMatches = (item) => String(item.grade) === String(teacherSession.grade)
    && String(item.classNumber) === String(teacherSession.classNumber);
  const activeStudents = (activeSource || data.activeStudents || []).filter((student) => classMatches(student) && Date.now() - student.updatedAt < 35_000);
  activeList.replaceChildren();
  if (activeStudents.length) {
    activeStudents.forEach((student) => {
      const row = document.createElement('div');
      row.className = 'active-student-row';
      const identity = document.createElement('strong');
      identity.textContent = `${student.number}번 ${student.name}`;
      const task = document.createElement('span');
      task.textContent = student.activity;
      const time = document.createElement('small');
      time.textContent = '지금';
      row.append(identity, task, time);
      activeList.append(row);
    });
  } else {
    const empty = document.createElement('p');
    empty.className = 'teacher-empty';
    empty.textContent = '같은 브라우저에서 학생이 활동하면 여기에 보여요.';
    activeList.append(empty);
  }

  const records = (recordSource || data.records).filter((record) => record.student && classMatches(record.student));
  const flagged = records.filter((record) => record.flagged);
  document.querySelector('#teacher-active-count').textContent = `${activeStudents.length}명`;
  document.querySelector('#teacher-question-count').textContent = `${records.length}개`;
  document.querySelector('#teacher-flagged-count').textContent = `${flagged.length}건`;
  alertPanel.hidden = flagged.length === 0;
  alertCount.textContent = flagged.length;
  alertList.replaceChildren();
  flagged.slice(0, 5).forEach((record) => {
    const alert = document.createElement('article');
    alert.className = 'teacher-alert-item';
    const heading = document.createElement('strong');
    heading.textContent = `${record.student.number}번 ${record.student.name} · 확인 필요`;
    const context = document.createElement('p');
    context.innerHTML = formatFractionText(record.flaggedText || record.text);
    const reason = document.createElement('small');
    reason.textContent = record.flagReason === 'inappropriate' ? '부적절한 표현이 감지되어 콩이가 답변을 멈췄어요.' : '수업 범위를 벗어난 요청이 감지됐어요.';
    alert.append(heading, context, reason);
    alertList.append(alert);
  });

  conversationList.replaceChildren();
  const conversationsByStudent = new Map();
  [...records].sort((left, right) => right.at - left.at).forEach((record) => {
    const student = record.student;
    const studentKey = student.id || `${student.grade}-${student.classNumber}-${student.number}`;
    if (!conversationsByStudent.has(studentKey)) conversationsByStudent.set(studentKey, []);
    const studentRecords = conversationsByStudent.get(studentKey);
    if (studentRecords.length < 10) studentRecords.push(record);
  });
  conversationsByStudent.forEach((studentRecords) => {
    const record = studentRecords[0];
    const card = document.createElement('details');
    card.className = `teacher-transcript${record.flagged ? ' flagged' : ''}`;
    const summary = document.createElement('summary');
    const summaryCopy = document.createElement('span');
    summaryCopy.className = 'teacher-transcript-summary-copy';
    const heading = document.createElement('strong');
    heading.textContent = `${record.student.number}번 ${record.student.name}`;
    const preview = document.createElement('span');
    preview.className = 'teacher-transcript-preview';
    preview.innerHTML = formatFractionText(record.text || '최근 대화 내용 보기');
    const meta = document.createElement('small');
    const stamp = Number.isFinite(record.at)
      ? new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(record.at))
      : '';
    meta.textContent = [modes[record.mode]?.label || '수학 질문', stamp].filter(Boolean).join(' · ');
    summaryCopy.append(heading, preview, meta);
    const disclosure = document.createElement('span');
    disclosure.className = 'teacher-transcript-disclosure';
    disclosure.textContent = `최근 대화 ${studentRecords.length}개 보기`;
    summary.append(summaryCopy, disclosure);
    card.append(summary);
    const history = document.createElement('div');
    history.className = 'teacher-student-conversations';
    studentRecords.forEach((conversation, index) => {
      const entry = document.createElement('article');
      entry.className = `teacher-student-conversation${conversation.flagged ? ' flagged' : ''}`;
      const entryHeading = document.createElement('div');
      entryHeading.className = 'teacher-student-conversation-heading';
      const entryTitle = document.createElement('strong');
      entryTitle.textContent = `대화 ${index + 1} · ${modes[conversation.mode]?.label || '수학 질문'}`;
      const entryTime = document.createElement('small');
      entryTime.textContent = Number.isFinite(conversation.at)
        ? new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(conversation.at))
        : '';
      entryHeading.append(entryTitle, entryTime);
      entry.append(entryHeading);
      const messages = Array.isArray(conversation.messages) && conversation.messages.length
        ? conversation.messages
        : [{ role: 'student', text: conversation.text }];
      const transcript = document.createElement('div');
      transcript.className = 'teacher-transcript-messages';
      messages.forEach((message) => {
        const line = document.createElement('p');
        line.className = message.role === 'student' ? 'transcript-student' : 'transcript-tutor';
        line.innerHTML = `${message.role === 'student' ? '학생' : '콩이'}: ${formatFractionText(message.text)}`;
        transcript.append(line);
      });
      entry.append(transcript);
      history.append(entry);
    });
    card.append(history);
    conversationList.append(card);
  });
  if (!conversationsByStudent.size) {
    const empty = document.createElement('p');
    empty.className = 'teacher-empty';
    empty.textContent = '같은 브라우저에서 남긴 질문이 여기에 쌓여요.';
    conversationList.append(empty);
  }
}

async function loadTeacherSupabaseData() {
  if (!supabaseClient || !teacherSession?.id) return;
  const requestId = ++teacherDataRefreshId;
  const classQuery = (query) => query.eq('grade', teacherSession.grade).eq('class_number', teacherSession.classNumber);
  const [activityResult, logResult] = await Promise.all([
    classQuery(supabaseClient.from('student_activity').select('student_id, grade, class_number, current_view, activity, updated_at'))
      .order('updated_at', { ascending: false }),
    classQuery(supabaseClient.from('conversation_logs').select('id, student_id, grade, class_number, student_number, question, mode, messages, flagged, flag_reason, flagged_context, result, practice_seconds, created_at, updated_at'))
      .order('updated_at', { ascending: false })
      .limit(1000),
  ]);
  if (requestId !== teacherDataRefreshId) return;
  if (activityResult.error || logResult.error) {
    showToast('Supabase 학급 기록을 읽지 못했어요. 설정을 확인해 주세요.');
    renderTeacherLive(data.activeStudents, data.records);
    return;
  }
  const rows = [...(activityResult.data || []), ...(logResult.data || [])];
  const ids = [...new Set(rows.map((row) => row.student_id).filter(Boolean))];
  const profilesResult = ids.length
    ? await supabaseClient.from('profiles').select('id, display_name, student_number').in('id', ids)
    : { data: [], error: null };
  if (profilesResult.error || requestId !== teacherDataRefreshId) return;
  const profiles = new Map((profilesResult.data || []).map((profile) => [profile.id, profile]));
  const activity = (activityResult.data || []).map((row) => ({
    grade: row.grade,
    classNumber: row.class_number,
    number: profiles.get(row.student_id)?.student_number,
    name: profiles.get(row.student_id)?.display_name || '학생',
    activity: row.activity,
    updatedAt: Date.parse(row.updated_at),
  }));
  const records = (logResult.data || []).map((row) => ({
    text: row.question,
    mode: row.mode,
    at: Date.parse(row.updated_at || row.created_at),
    studentId: row.student_id,
    hints: 0,
    result: row.result,
    practiceSeconds: row.practice_seconds,
    flagged: row.flagged,
    flagReason: row.flag_reason,
    flaggedText: row.flagged_context,
    student: {
      id: row.student_id,
      grade: row.grade,
      classNumber: row.class_number,
      number: row.student_number,
      name: profiles.get(row.student_id)?.display_name || '학생',
    },
    messages: Array.isArray(row.messages) ? row.messages.map((message) => ({
      role: ['student', 'user'].includes(message.role) ? 'student' : 'tutor',
      text: message.text || message.content || '',
    })) : [],
  }));
  renderTeacherLive(activity, records);
}

async function teacherRosterRequest(method = 'GET', body, endpoint = '/api/teacher/roster') {
  if (!supabaseClient) throw new Error('Supabase 설정을 확인해 주세요.');
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session?.access_token) throw new Error('교사 로그인을 다시 해주세요.');
  const response = await fetch(endpoint, {
    method,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || '학생 명단을 처리하지 못했어요.');
  return result;
}

function parseRosterFileText(text, fileName) {
  const cleanedText = text.replace(/^\uFEFF/, '');
  const firstLine = cleanedText.split(/\r?\n/, 1)[0] || '';
  const delimiterCounts = ['\t', ',', ';'].map((delimiter) => ({
    delimiter,
    count: [...firstLine].filter((character) => character === delimiter).length,
  })).sort((left, right) => right.count - left.count);
  const extension = fileName.split('.').pop().toLowerCase();
  const delimiter = extension === 'tsv' || (extension === 'txt' && delimiterCounts[0].delimiter === '\t')
    ? '\t'
    : delimiterCounts[0].delimiter || ',';
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < cleanedText.length; index += 1) {
    const character = cleanedText[index];
    if (quoted) {
      if (character === '"' && cleanedText[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"' && field === '') quoted = true;
    else if (character === delimiter) {
      row.push(field.trim());
      field = '';
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && cleanedText[index + 1] === '\n') index += 1;
      row.push(field.trim());
      if (row.some((cell) => cell !== '')) rows.push(row);
      row = [];
      field = '';
    } else field += character;
  }
  if (quoted) throw new Error('파일의 따옴표 짝이 맞지 않아요. CSV로 다시 저장해 주세요.');
  row.push(field.trim());
  if (row.some((cell) => cell !== '')) rows.push(row);
  if (rows.length < 2) throw new Error('첫 줄에 번호·이름 제목이 있고 학생 데이터가 한 줄 이상 있어야 해요.');

  const normalizeHeader = (value) => value.toLowerCase().replace(/[\s_-]/g, '');
  const headers = rows[0].map(normalizeHeader);
  const numberIndex = headers.findIndex((value) => ['번호', '학생번호', 'number', 'studentnumber'].includes(value));
  const nameIndex = headers.findIndex((value) => ['이름', '학생이름', 'name', 'displayname'].includes(value));
  if (numberIndex < 0 || nameIndex < 0) throw new Error('첫 줄에 ‘번호’와 ‘이름’ 열이 있어야 해요.');

  const students = rows.slice(1).map((cells) => ({
    studentNumber: Number(cells[numberIndex]),
    displayName: cells[nameIndex] || '',
  }));
  if (students.length > 50) throw new Error('한 번에 최대 50명까지 등록할 수 있어요.');
  if (students.some((student) => !Number.isInteger(student.studentNumber) || student.studentNumber < 1 || student.studentNumber > 50
    || student.displayName.length < 2 || student.displayName.length > 30
    || !/^[A-Za-z가-힣]+(?: [A-Za-z가-힣]+)*$/.test(student.displayName))) {
    throw new Error('번호는 1~50의 숫자, 이름은 한글 또는 영문으로 입력해 주세요.');
  }
  if (new Set(students.map((student) => student.studentNumber)).size !== students.length) {
    throw new Error('같은 학생 번호가 두 번 있어요. 번호를 확인해 주세요.');
  }
  return students;
}

function decodeRosterFile(buffer) {
  const bytes = new Uint8Array(buffer);
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes.subarray(2));
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes.subarray(2));
  return new TextDecoder('utf-8').decode(bytes);
}

let issuedRosterCodes = [];

function renderIssuedRosterCodes(codes, message) {
  issuedRosterCodes = codes;
  document.querySelector('#roster-code-message').textContent = message;
  const list = document.querySelector('#issued-code-list');
  list.replaceChildren();
  codes.forEach((student) => {
    const row = document.createElement('div');
    row.className = 'issued-code-row';
    const label = document.createElement('span');
    label.textContent = `${student.studentNumber}번 ${student.displayName}`;
    const code = document.createElement('strong');
    code.textContent = student.activationCode;
    row.append(label, code);
    list.append(row);
  });
  document.querySelector('#roster-code-result').hidden = codes.length === 0;
}

function downloadIssuedRosterCodes() {
  if (!issuedRosterCodes.length) return;
  const csvCell = (value) => `"${String(value).replaceAll('"', '""')}"`;
  const rows = [['번호', '이름', '1회 코드'], ...issuedRosterCodes.map((student) => [student.studentNumber, student.displayName, student.activationCode])];
  const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`;
  const link = document.createElement('a');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  link.href = url;
  link.download = `학생별_첫로그인_코드_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function printIssuedRosterCodes() {
  if (!issuedRosterCodes.length) return;
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  const cards = issuedRosterCodes.map((student) => `<article class="card"><small>콩셈콩셈 · 첫 로그인</small><h2>${escapeHtml(student.studentNumber)}번 ${escapeHtml(student.displayName)}</h2><strong>${escapeHtml(student.activationCode)}</strong><p>학생 로그인에서 반·번호·이름과 이 코드를 입력한 뒤, 본인 비밀번호를 만들어요.</p></article>`).join('');
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    showToast('팝업이 차단되어 인쇄 창을 열지 못했어요. 팝업을 허용해 주세요.');
    return;
  }
  printWindow.document.write(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>학생별 첫 로그인 코드</title><style>body{font-family:Arial,sans-serif;margin:12mm;color:#25334f}.sheet{display:grid;grid-template-columns:1fr 1fr;gap:8mm}.card{border:1px dashed #68758b;border-radius:10px;padding:8mm;break-inside:avoid}.card small{color:#61704c}.card h2{font-size:18px}.card strong{display:block;margin:6mm 0;font:700 30px monospace;letter-spacing:.18em}.card p{font-size:12px;line-height:1.5}@media print{body{margin:0}.sheet{gap:6mm}}</style></head><body><main class="sheet">${cards}</main></body></html>`);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

function teacherSkillStatusLabel(status) {
  return status === 'secure' ? '익숙해요' : status === 'support' ? '도움 필요' : status === 'practice' ? '연습 중' : '기록 쌓는 중';
}

function renderTeacherLearningData(students, progressAvailable, errorMessage = '') {
  const summary = document.querySelector('#teacher-skill-summary');
  const studentList = document.querySelector('#teacher-student-list');
  const notice = document.querySelector('#teacher-progress-notice');
  if (!summary || !studentList) return;
  students = Array.isArray(students) ? students : [];
  const expandedClassUnits = new Set([...summary.querySelectorAll('.teacher-unit-summary[open]')].map((unit) => unit.dataset.unitId));
  const expandedStudents = new Set([...studentList.querySelectorAll('.teacher-student[open]')].map((student) => student.dataset.studentNumber));
  const expandedStudentUnits = new Set([...studentList.querySelectorAll('.teacher-student-unit[open]')]
    .map((unit) => `${unit.closest('.teacher-student')?.dataset.studentNumber}:${unit.dataset.unitId}`));
  summary.replaceChildren();
  studentList.replaceChildren();
  if (notice) notice.textContent = progressAvailable
    ? '개념별 ‘익숙해요’는 4회 이상·정답률 80% 이상·연속 2회 정답·힌트 절반 이하 기준이에요. ‘도움 필요’는 2회 이상 시도한 개념의 정답률이 50% 미만일 때 표시해요. 종합 ‘익숙해요’는 전체 개념 60% 이상을 확인하고 그중 80% 이상이 익숙할 때 표시해요.'
    : errorMessage || '개념별 시도 기록을 읽지 못했어요. 최신 Supabase 설정을 확인해 주세요.';

  if (progressAvailable) {
    const units = curriculumUnits.map((unit) => {
      const skills = unit.skills.map((skill) => {
        const rows = students.flatMap((student) => (student.skill_progress || [])
          .filter((row) => row.unit_id === unit.id && row.skill === skill.id));
        const attempts = rows.reduce((sum, row) => sum + (Number(row.attempts) || 0), 0);
        const correct = rows.reduce((sum, row) => sum + (Number(row.correct) || 0), 0);
        const supportStudents = students.filter((student) => {
          const row = (student.skill_progress || []).find((progress) => progress.unit_id === unit.id && progress.skill === skill.id);
          return row && getSkillStatus({
            attempts: Number(row.attempts) || 0,
            correct: Number(row.correct) || 0,
            consecutive_correct: Number(row.consecutive_correct) || 0,
            hint_count: Number(row.hint_count) || 0,
          }) === 'support';
        }).length;
        return { ...skill, attempts, correct, supportStudents };
      });
      return {
        ...unit,
        skills,
        attempts: skills.reduce((sum, skill) => sum + skill.attempts, 0),
        supportStudents: skills.reduce((sum, skill) => sum + skill.supportStudents, 0),
      };
    }).sort((left, right) => right.supportStudents - left.supportStudents || right.attempts - left.attempts);
    const recordedUnits = units.filter((unit) => unit.attempts > 0);
    if (!recordedUnits.length) {
      const empty = document.createElement('p');
      empty.className = 'teacher-empty';
      empty.textContent = '아직 개념 확인 기록이 없어요. 학생이 미션이나 대결 문제를 풀면 실제 통계가 쌓여요.';
      summary.append(empty);
    } else {
      recordedUnits.forEach((unit, index) => {
        const details = document.createElement('details');
        details.className = 'teacher-unit-summary';
        details.dataset.unitId = unit.id;
        details.open = expandedClassUnits.has(unit.id) || (!expandedClassUnits.size && index === 0);
        const heading = document.createElement('summary');
        const title = document.createElement('strong');
        title.textContent = unit.title;
        const attempts = unit.skills.reduce((sum, skill) => sum + skill.attempts, 0);
        const correct = unit.skills.reduce((sum, skill) => sum + skill.correct, 0);
        const overview = document.createElement('small');
        overview.textContent = `${Math.round(correct / attempts * 100)}% 정답 · ${attempts}회 · 도움 필요 ${unit.supportStudents}건`;
        heading.append(title, overview);
        details.append(heading);
        const rows = document.createElement('div');
        rows.className = 'teacher-unit-skill-list';
        unit.skills.forEach((skill) => {
          const row = document.createElement('div');
          row.className = 'teacher-unit-skill-row';
          const label = document.createElement('span');
          label.textContent = skill.label;
          const meter = document.createElement('progress');
          meter.max = 100;
          meter.value = skill.attempts ? Math.round(skill.correct / skill.attempts * 100) : 0;
          meter.setAttribute('aria-label', `${skill.label} 정답률`);
          const stat = document.createElement('small');
          stat.textContent = skill.attempts
            ? `정답률 ${meter.value}% · ${skill.correct}/${skill.attempts}회 · 도움 필요 ${skill.supportStudents}명`
            : '아직 기록 없음';
          row.append(label, meter, stat);
          rows.append(row);
        });
        details.append(rows);
        summary.append(details);
      });
    }
  } else {
    const empty = document.createElement('p');
    empty.className = 'teacher-empty';
    empty.textContent = errorMessage || '개념 통계를 불러오지 못했어요. 학생 명단과 로그인 관리는 계속 사용할 수 있어요.';
    summary.append(empty);
  }

  if (!students.length) {
    const empty = document.createElement('p');
    empty.className = 'teacher-empty';
    empty.textContent = '담당 반에 등록된 학생이 아직 없어요.';
    studentList.append(empty);
    return;
  }

  students.forEach((student) => {
    const skillProgress = student.skill_progress || [];
    const progressBySkill = new Map(skillProgress.map((row) => [`${row.unit_id}:${row.skill}`, {
      attempts: Number(row.attempts) || 0,
      correct: Number(row.correct) || 0,
      consecutive_correct: Number(row.consecutive_correct) || 0,
      hint_count: Number(row.hint_count) || 0,
    }]));
    const allSkills = curriculumUnits.flatMap((unit) => unit.skills.map((skill) => ({
      ...skill,
      unitId: unit.id,
      unitTitle: unit.title,
      progress: progressBySkill.get(`${unit.id}:${skill.id}`),
    })));
    const assessed = allSkills.filter((skill) => getSkillStatus(skill.progress) !== 'unknown');
    const supportCount = assessed.filter((skill) => getSkillStatus(skill.progress) === 'support').length;
    const secureCount = assessed.filter((skill) => getSkillStatus(skill.progress) === 'secure').length;
    const attempts = skillProgress.reduce((sum, row) => sum + (Number(row.attempts) || 0), 0);
    const correct = skillProgress.reduce((sum, row) => sum + (Number(row.correct) || 0), 0);
    const overallSecure = assessed.length >= Math.ceil(allSkills.length * 0.6)
      && secureCount >= Math.ceil(assessed.length * 0.8);
    const status = !student.has_account || assessed.length === 0
      ? 'unknown'
      : supportCount ? 'support' : overallSecure ? 'secure' : 'practice';
    const levelText = !student.has_account ? '계정 준비 전'
      : !progressAvailable ? '통계 확인 필요'
        : status === 'support' ? `도움 필요 개념 ${supportCount}개`
          : status === 'secure' ? `익숙한 개념 ${secureCount}개`
            : status === 'practice' ? '계속 연습 중' : '기록 쌓는 중';
    const card = document.createElement('details');
    card.className = 'teacher-student';
    card.dataset.status = status;
    card.dataset.studentNumber = String(student.student_number);
    card.open = expandedStudents.has(card.dataset.studentNumber);
    const heading = document.createElement('summary');
    const identity = document.createElement('span');
    identity.className = 'teacher-student-identity';
    const name = document.createElement('strong');
    name.textContent = `${student.student_number}번 ${student.display_name}`;
    const facts = document.createElement('small');
    facts.textContent = student.has_account
      ? attempts ? `정답률 ${Math.round(correct / attempts * 100)}% · 풀이 ${attempts}회 · 확인 개념 ${assessed.length}/${allSkills.length} · 익숙 ${secureCount}개` : '아직 개념 풀이 기록이 없어요.'
        : '학생 계정이 아직 없어요.';
    identity.append(name, facts);
    const badge = document.createElement('span');
    badge.className = `teacher-level-badge ${status}`;
    badge.textContent = levelText;
    heading.append(identity, badge);
    card.append(heading);
    const detail = document.createElement('div');
    detail.className = 'teacher-student-detail';
    if (!progressAvailable) {
      const message = document.createElement('p');
      message.className = 'teacher-empty';
      message.textContent = '개념 통계를 불러오지 못했어요. 최신 Supabase 설정 SQL이 실행됐는지 확인해 주세요.';
      detail.append(message);
    } else if (!student.has_account) {
      const message = document.createElement('p');
      message.className = 'teacher-empty';
      message.textContent = '첫 로그인 코드를 사용하면 학생별 학습 기록이 여기에 쌓여요.';
      detail.append(message);
    } else {
      const path = student.learning_path;
      const pathText = document.createElement('p');
      pathText.className = 'teacher-learning-path';
      if (path) {
        const index = Math.min(Number(path.lesson_index) || 0, dailyMissions.length - 1);
        const completed = Math.min(dailyMissions.length, index + (path.completed_at ? 1 : 0));
        const ready = path.completed_at && Date.now() - Date.parse(path.completed_at) >= 24 * 60 * 60 * 1000;
        const sessionStart = Math.max(0, Math.min(index, Number(path.session_start_index) || 0));
        const sessionCount = Math.max(1, Math.min(4, Number(path.session_mission_count) || 1));
        const sessionStep = Math.min(sessionCount, Math.max(1, index - sessionStart + 1));
        const sessionSummary = sessionCount > 1 ? ` · 이번 수업 ${sessionStep}/${sessionCount}개` : '';
        pathText.textContent = completed >= dailyMissions.length
          ? `오늘의 배움 ${completed}/${dailyMissions.length}단계 완료${sessionSummary}`
          : `오늘의 배움 ${completed}/${dailyMissions.length}단계 완료${sessionSummary} · ${ready ? '다음 수업 미션이 열렸어요' : `${dailyMissions[index].title} 학습 중`}`;
      } else pathText.textContent = `오늘의 배움 0/${dailyMissions.length}단계 · 아직 시작 전`;
      detail.append(pathText);
      const unitList = document.createElement('div');
      unitList.className = 'teacher-student-unit-list';
      curriculumUnits.forEach((unit) => {
        const unitSkills = allSkills.filter((skill) => skill.unitId === unit.id);
        const unitAssessed = unitSkills.filter((skill) => getSkillStatus(skill.progress) !== 'unknown');
        const unitDetails = document.createElement('details');
        unitDetails.className = 'teacher-student-unit';
        unitDetails.dataset.unitId = unit.id;
        unitDetails.open = expandedStudentUnits.has(`${student.student_number}:${unit.id}`);
        const unitHeading = document.createElement('summary');
        const unitName = document.createElement('strong');
        unitName.textContent = unit.title;
        const unitStatus = document.createElement('small');
        unitStatus.textContent = unitAssessed.length
          ? `${unitAssessed.filter((skill) => getSkillStatus(skill.progress) === 'secure').length}/${unitAssessed.length}개념 익숙 · ${unitSkills.reduce((sum, skill) => sum + (skill.progress?.attempts || 0), 0)}회`
          : '기록 쌓는 중';
        unitHeading.append(unitName, unitStatus);
        unitDetails.append(unitHeading);
        const rows = document.createElement('div');
        rows.className = 'teacher-student-skill-list';
        unitSkills.forEach((skill) => {
          const row = document.createElement('div');
          row.className = `teacher-student-skill ${getSkillStatus(skill.progress)}`;
          const label = document.createElement('strong');
          label.textContent = skill.label;
          const stat = document.createElement('small');
          stat.textContent = skill.progress?.attempts
            ? `${teacherSkillStatusLabel(getSkillStatus(skill.progress))} · 정답 ${skill.progress.correct}/${skill.progress.attempts} · 힌트 ${skill.progress.hint_count}회`
            : '기록 없음';
          row.append(label, stat);
          rows.append(row);
        });
        unitDetails.append(rows);
        unitList.append(unitDetails);
      });
      detail.append(unitList);
    }
    card.append(detail);
    studentList.append(card);
  });
}

async function loadTeacherRoster() {
  const list = document.querySelector('#teacher-roster-list');
  if (!list || !teacherSession) return;
  try {
    const { students, progress_available: progressAvailable } = await teacherRosterRequest();
    renderTeacherLearningData(students, progressAvailable !== false);
    list.replaceChildren();
    if (!students.length) {
      const empty = document.createElement('p');
      empty.className = 'teacher-empty';
      empty.textContent = '등록된 학생이 아직 없어요.';
      list.append(empty);
      return;
    }
    students.forEach((student) => {
      const row = document.createElement('div');
      row.className = 'roster-row';
      const identity = document.createElement('span');
      identity.className = 'roster-identity';
      const label = document.createElement('strong');
      label.textContent = `${student.student_number}번 ${student.display_name}`;
      const status = document.createElement('small');
      const claimed = Boolean(student.claimed_at);
      status.className = claimed ? 'roster-state roster-state-done' : 'roster-state';
      const expired = student.code_expires_at && Date.parse(student.code_expires_at) < Date.now();
      status.textContent = claimed
        ? '계정 사용 중'
        : student.has_account && !student.code_expires_at
          ? '계정 사용 중'
        : expired
          ? '코드 만료 · 다시 발급 필요'
          : student.has_account ? '비밀번호 초기화 코드 전달 대기' : '첫 로그인 코드 전달 대기';
      identity.append(label, status);
      row.append(identity);
      if (student.has_account) {
        const resetButton = document.createElement('button');
        resetButton.type = 'button';
        resetButton.className = 'roster-reset-button';
        resetButton.textContent = '비밀번호 초기화';
        resetButton.addEventListener('click', async () => {
          resetButton.disabled = true;
          document.querySelector('#roster-error').hidden = true;
          renderIssuedRosterCodes([], '');
          try {
            const result = await teacherRosterRequest('POST', {
              studentNumber: student.student_number,
              displayName: student.display_name,
            });
            renderIssuedRosterCodes([{
              studentNumber: student.student_number,
              displayName: student.display_name,
              activationCode: result.activationCode,
            }], '이 학생의 이전 코드는 사용할 수 없어요. 새 코드를 학생에게 직접 전달하면 로그인 화면에서 새 비밀번호를 만들 수 있어요.');
            await loadTeacherRoster();
          } catch (error) {
            const errorElement = document.querySelector('#roster-error');
            errorElement.textContent = error.message || '비밀번호 초기화 코드를 발급하지 못했어요.';
            errorElement.hidden = false;
          } finally {
            resetButton.disabled = false;
          }
        });
        row.append(resetButton);
      }
      list.append(row);
    });
  } catch (error) {
    renderTeacherLearningData([], false, error.message);
    list.replaceChildren();
    const message = document.createElement('p');
    message.className = 'teacher-empty';
    message.textContent = error.message;
    list.append(message);
  }
}

async function startTeacherRealtime() {
  if (!supabaseClient || !teacherSession?.id) return;
  await loadTeacherMachineLabSetting();
  if (teacherRealtimeChannel) await supabaseClient.removeChannel(teacherRealtimeChannel);
  await loadTeacherSupabaseData();
  await loadTeacherRoster();
  lastTeacherRosterRefresh = Date.now();
  if (!teacherDashboard.hidden) {
    teacherRealtimeChannel = supabaseClient.channel(`teacher-${teacherSession.grade}-${teacherSession.classNumber}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'student_activity', filter: `class_number=eq.${teacherSession.classNumber}` }, () => { void loadTeacherSupabaseData(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_logs', filter: `class_number=eq.${teacherSession.classNumber}` }, () => { void loadTeacherSupabaseData(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'student_skill_progress', filter: `class_number=eq.${teacherSession.classNumber}` }, () => { void loadTeacherRoster(); })
      .subscribe();
  }
}

if (activityChannel) {
  activityChannel.addEventListener('message', (event) => {
    if (event.data?.studentId !== activeDataStudentId) return;
    data = loadData(activeDataStudentId);
    renderStats();
    updateBattleProgress();
    if (!teacherDashboard.hidden) renderTeacherLive();
  });
}
window.addEventListener('storage', (event) => {
  if (event.key !== dataStorageKey()) return;
  data = loadData(activeDataStudentId);
  renderStats();
  updateBattleProgress();
  if (!teacherDashboard.hidden) renderTeacherLive();
});

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add('show');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => elements.toast.classList.remove('show'), 2300);
}

function resetChat() {
  if (tutorBusy) return;
  elements.messages.replaceChildren();
  conversation = [];
  const guide = tutorModeGuide(curriculumUnitById[activeStudyUnitId] || curriculumUnits[0], activeMode);
  addMessage('tutor', `${curriculumUnitById[activeStudyUnitId]?.title || '수학'} 공부를 다시 시작해요. ${guide.welcome}`);
  elements.quickPrompts.hidden = false;
  elements.messages.append(elements.quickPrompts);
  renderTutorModeExperience();
  hintCount = 0;
  lastQuestion = '';
  delete elements.activeProblem;
  elements.input.value = '';
  elements.input.placeholder = tutorModeGuide(curriculumUnitById[activeStudyUnitId] || curriculumUnits[0], activeMode).placeholder;
  elements.input.style.height = 'auto';
  elements.charCount.textContent = '0 / 500';
  resetQuestionFractionBuilder();
  elements.input.focus();
}

document.querySelectorAll('.mode-card').forEach((button) => {
  button.addEventListener('click', () => selectMode(button.dataset.mode));
});

const fractionBuilder = document.querySelector('#fraction-builder');
const fractionNumerator = document.querySelector('#fraction-numerator');
const fractionDenominator = document.querySelector('#fraction-denominator');
const fractionBuilderMessage = document.querySelector('#fraction-builder-message');
const fractionBuilderRow = fractionBuilder.querySelector('.fraction-builder-row');
const fractionInputStack = fractionBuilder.querySelector('.fraction-input-stack');
const fractionModeControls = document.createElement('div');
fractionModeControls.className = 'fraction-mode-controls';
fractionModeControls.setAttribute('role', 'group');
fractionModeControls.setAttribute('aria-label', '분수 종류');
const simpleFractionMode = document.createElement('button');
simpleFractionMode.type = 'button';
simpleFractionMode.textContent = '분수';
simpleFractionMode.setAttribute('aria-pressed', 'true');
const mixedFractionMode = document.createElement('button');
mixedFractionMode.type = 'button';
mixedFractionMode.textContent = '대분수';
mixedFractionMode.setAttribute('aria-pressed', 'false');
fractionModeControls.append(simpleFractionMode, mixedFractionMode);
fractionBuilder.insertBefore(fractionModeControls, fractionBuilderRow);
const fractionWholeField = document.createElement('label');
fractionWholeField.className = 'fraction-whole-field';
fractionWholeField.hidden = true;
fractionWholeField.textContent = '자연수';
const fractionWholeInput = document.createElement('input');
fractionWholeInput.type = 'number';
fractionWholeInput.min = '1';
fractionWholeInput.max = '999';
fractionWholeInput.step = '1';
fractionWholeInput.inputMode = 'numeric';
fractionWholeInput.placeholder = '자연수';
fractionWholeInput.setAttribute('aria-label', '대분수의 자연수');
fractionWholeField.append(fractionWholeInput);
fractionBuilderRow.insertBefore(fractionWholeField, fractionInputStack);
simpleFractionMode.addEventListener('click', () => setQuestionFractionMode('fraction'));
mixedFractionMode.addEventListener('click', () => setQuestionFractionMode('mixed'));
document.querySelector('#toggle-fraction-builder').addEventListener('click', (event) => {
  const open = fractionBuilder.hidden;
  fractionBuilder.hidden = !open;
  event.currentTarget.setAttribute('aria-expanded', String(open));
  if (open) fractionNumerator.focus();
});
document.querySelector('#add-question-fraction').addEventListener('click', () => {
  const whole = questionFractionKind === 'mixed' ? Number(fractionWholeInput.value) : 0;
  const numerator = Number(fractionNumerator.value);
  const denominator = Number(fractionDenominator.value);
  if (questionFractionKind === 'mixed' && (!Number.isInteger(whole) || whole < 1 || whole > 999)) {
    fractionBuilderMessage.textContent = '대분수의 자연수를 1부터 999까지 적어주세요.';
    return;
  }
  if (!Number.isInteger(numerator) || numerator < 1 || numerator > 999
    || !Number.isInteger(denominator) || denominator < 1 || denominator > 999) {
    fractionBuilderMessage.textContent = '분자와 분모에 1부터 999까지의 수를 적어주세요.';
    return;
  }
  if (questionFractionKind === 'mixed' && numerator >= denominator) {
    fractionBuilderMessage.textContent = '대분수는 분자가 분모보다 작아야 해요.';
    return;
  }
  if (attachedQuestionFractions.length >= 5) {
    fractionBuilderMessage.textContent = '한 질문에는 분수를 최대 5개까지 넣을 수 있어요.';
    return;
  }
  attachedQuestionFractions.push({ whole, numerator, denominator });
  renderQuestionFractions();
  fractionWholeInput.value = '';
  fractionNumerator.value = '';
  fractionDenominator.value = '';
  fractionBuilderMessage.textContent = '분수를 질문에 넣었어요.';
  (questionFractionKind === 'mixed' ? fractionWholeInput : fractionNumerator).focus();
});
document.querySelector('#question-fraction-items').addEventListener('click', (event) => {
  const button = event.target.closest('[data-remove-fraction]');
  if (!button) return;
  attachedQuestionFractions.splice(Number(button.dataset.removeFraction), 1);
  renderQuestionFractions();
});

function selectMode(mode) {
  const previousMode = activeMode;
  if (previousMode !== mode) elements.quickPrompts.hidden = false;
  activeMode = mode;
  document.querySelectorAll('.mode-card').forEach((card) => {
    const selected = card.dataset.mode === mode;
    card.classList.toggle('selected', selected);
    card.setAttribute('aria-pressed', String(selected));
  });
  renderTutorModeExperience({ announce: true, previousMode });
  elements.input.focus();
}

document.querySelector('#teach-mode-toggle').addEventListener('click', () => {
  selectMode(activeMode === 'teach' ? 'concept' : 'teach');
});
document.querySelector('#teach-mode-exit').addEventListener('click', () => {
  selectMode('concept');
  document.querySelector('#modes').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
});

elements.form.addEventListener('submit', (event) => {
  event.preventDefault();
  const answer = elements.input.value.trim();
  if (!answer) return;
  const attachedFractions = attachedQuestionFractions.length
    ? `\n\n함께 볼 분수: ${attachedQuestionFractions.map(({ whole = 0, numerator, denominator }) => `${whole ? `${whole}과 ` : ''}${numerator}/${denominator}`).join(', ')}`
    : '';
  const question = `${answer}${attachedFractions}`;
  if (elements.activeProblem) submitAnswer(question);
  else askQuestion(question);
  elements.input.value = '';
  elements.input.style.height = 'auto';
  elements.charCount.textContent = '0 / 500';
  resetQuestionFractionBuilder();
});

elements.input.addEventListener('input', () => {
  elements.charCount.textContent = `${elements.input.value.length} / 500`;
  elements.input.style.height = 'auto';
  elements.input.style.height = `${Math.min(elements.input.scrollHeight, 104)}px`;
});

elements.input.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    elements.form.requestSubmit();
  }
});

document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-prompt]');
  if (button) {
    selectMode(button.dataset.promptMode || 'concept');
    askQuestion(button.dataset.prompt);
  }
});

document.querySelector('#quest-choices').addEventListener('click', (event) => {
  const button = event.target.closest('[data-quest-answer]');
  if (!button || missionProgress.completed_at || missionAnswerPending) return;
  const mission = dailyMissions[Math.min(Number(missionProgress.lesson_index) || 0, dailyMissions.length - 1)];
  const activeMission = Number(missionProgress.attempts) > 0 && mission.retry ? mission.retry : mission;
  const correct = button.dataset.questAnswer === activeMission.answer;
  document.querySelectorAll('[data-quest-answer]').forEach((choice) => {
    choice.classList.toggle('chosen', choice === button);
    choice.classList.toggle('is-right', choice === button && correct);
    choice.setAttribute('aria-pressed', String(choice === button));
  });
  const feedback = document.querySelector('#quest-feedback');
  feedback.hidden = false;
  feedback.classList.toggle('is-success', correct);
  const feedbackText = correct ? activeMission.correctText : activeMission.retryText;
  missionFeedbackState = { correct, text: feedbackText };
  feedback.innerHTML = formatFractionText(feedbackText);
  void recordSkillAttempt(activeMission.skill || mission.skill, correct, 0, activeMission.unitId || mission.unitId);
  if (studentSession) {
    data.attempts += 1;
    if (correct) data.correct += 1;
    const record = {
      text: `오늘의 배움 ${Number(missionProgress.lesson_index) + 1}: ${mission.title}`,
      mode: 'check',
      unitId: mission.unitId,
      at: Date.now(),
      hints: 0,
      result: correct ? 'correct' : 'retry',
      practiceSeconds: 0,
      flagged: false,
      supabaseId: null,
      student: { grade: studentSession.grade, classNumber: studentSession.classNumber, number: studentSession.number, name: studentSession.name },
      messages: [
        { role: 'student', text: `오늘 미션 답: ${button.dataset.questAnswer}`, at: Date.now() },
        { role: 'tutor', text: feedbackText, at: Date.now() },
      ],
    };
    data.total += 1;
    data.records.unshift(record);
    data.records = data.records.slice(0, 20);
    saveData();
    void syncSupabaseRecord(record);
  }
  void submitMissionAnswer(correct);
});

document.querySelector('#skip-mission').addEventListener('click', () => skipMissionForToday());

elements.messages.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  if (button.dataset.action === 'hint') hintReply();
  if (button.dataset.action === 'check') checkProblem();
});

document.querySelector('#new-chat').addEventListener('click', resetChat);
elements.clearHistory.addEventListener('click', async () => {
  if (!studentSession || !supabaseClient) {
    showToast('학생 계정으로 로그인해 주세요.');
    return;
  }
  if (tutorBusy) {
    showToast('콩이 답변이 끝난 뒤 기록을 지울 수 있어요.');
    return;
  }
  if (!window.confirm('이 학생의 질문·대화 기록을 삭제할까요? 담당 교사 화면에서도 사라져요. 개념별 학습 진도는 유지됩니다.')) return;
  elements.clearHistory.disabled = true;
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session?.access_token) throw new Error('로그인 세션을 확인해 주세요.');
    const response = await fetch('/api/student/history', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || '대화 기록을 삭제하지 못했어요.');
    data.records = [];
    data.total = 0;
    saveData();
    conversation = [];
    hintCount = 0;
    lastQuestion = '';
    delete elements.activeProblem;
    resetChat();
    document.querySelector('#history').open = false;
    showToast('질문과 대화 기록을 삭제했어요. 개념별 학습 진도는 유지돼요.');
  } catch (error) {
    showToast(error.message || '대화 기록을 삭제하지 못했어요.');
  } finally {
    elements.clearHistory.disabled = false;
  }
});

document.querySelector('#open-together-study').addEventListener('click', () => {
  const currentMission = dailyMissions[Math.min(Number(missionProgress.lesson_index) || 0, dailyMissions.length - 1)];
  setActiveStudyUnit(currentMission.unitId);
  showStudentView('together');
});

const helpDialog = document.querySelector('#help-dialog');
document.querySelectorAll('.help-button').forEach((button) => button.addEventListener('click', () => helpDialog.showModal()));
document.querySelector('#close-help').addEventListener('click', () => helpDialog.close());
helpDialog.addEventListener('click', (event) => {
  if (event.target === helpDialog) helpDialog.close();
});

const setupDialog = document.querySelector('#supabase-setup-dialog');
const setupSql = document.querySelector('#supabase-schema-output');
const setupStatus = document.querySelector('#supabase-setup-status');
let setupSqlLoaded = false;
document.querySelector('#open-supabase-setup').addEventListener('click', async () => {
  setupDialog.showModal();
  if (setupSqlLoaded) return;
  setupStatus.textContent = '설정 SQL을 불러오는 중이에요.';
  try {
    const response = await fetch('/api/supabase-setup');
    const result = await response.json();
    if (!response.ok || typeof result.schema !== 'string') throw new Error(result.error || 'SQL을 불러오지 못했어요.');
    setupSql.value = result.schema;
    setupStatus.textContent = '아래 SQL을 복사해 Supabase SQL Editor에 붙여넣으세요.';
    setupSqlLoaded = true;
  } catch (error) {
    setupStatus.textContent = error.message || 'SQL을 불러오지 못했어요.';
  }
});
document.querySelector('#copy-supabase-sql').addEventListener('click', async () => {
  if (!setupSql.value) {
    setupStatus.textContent = 'SQL이 아직 준비되지 않았어요. 잠시 뒤 다시 열어주세요.';
    return;
  }
  try {
    if (!navigator.clipboard?.writeText || !window.isSecureContext) throw new Error('클립보드 권한을 사용할 수 없어요.');
    await navigator.clipboard.writeText(setupSql.value);
    setupStatus.textContent = 'SQL을 복사했어요. Supabase SQL Editor에 붙여넣어 실행하세요.';
  } catch {
    setupSql.focus();
    setupSql.setSelectionRange(0, setupSql.value.length);
    setupSql.scrollTop = 0;
    let copied = false;
    try {
      copied = document.execCommand('copy');
    } catch {
      copied = false;
    }
    if (copied) {
      setupStatus.textContent = '전체 SQL을 복사했어요. Supabase SQL Editor에 붙여넣으세요.';
      return;
    }
    setupStatus.textContent = '전체 SQL을 선택했어요. 선택된 내용을 복사해 Supabase SQL Editor에 붙여넣으세요.';
  }
});
document.querySelector('#select-supabase-sql').addEventListener('click', () => {
  if (!setupSql.value) {
    setupStatus.textContent = 'SQL이 아직 준비되지 않았어요. 잠시 뒤 다시 열어주세요.';
    return;
  }
  setupSql.focus();
  setupSql.setSelectionRange(0, setupSql.value.length);
  setupSql.scrollTop = 0;
  setupStatus.textContent = '전체 SQL을 선택했어요. 선택된 내용을 복사해 Supabase SQL Editor에 붙여넣으세요.';
});
async function copyProfileExample(id) {
  const text = document.querySelector(id).textContent;
  try {
    await navigator.clipboard.writeText(text);
    setupStatus.textContent = '프로필 예시를 복사했어요. Auth UUID와 이름을 바꿔 실행하세요.';
  } catch {
    setupStatus.textContent = '복사가 안 되면 예시 SQL을 길게 눌러 선택해 복사하세요.';
  }
}
document.querySelector('#copy-student-profile').addEventListener('click', () => copyProfileExample('#student-profile-sql'));
document.querySelector('#copy-teacher-profile').addEventListener('click', () => copyProfileExample('#teacher-profile-sql'));
document.querySelector('#close-supabase-setup').addEventListener('click', () => setupDialog.close());
setupDialog.addEventListener('click', (event) => {
  if (event.target === setupDialog) setupDialog.close();
});

const loginScreen = document.querySelector('#login-screen');
const studentLoginScreen = document.querySelector('#student-login-screen');
const teacherLoginScreen = document.querySelector('#teacher-login-screen');
const studentApp = document.querySelector('#student-app');
const teacherDashboard = document.querySelector('#teacher-dashboard');
let studentSession = null;
let teacherSession = null;
let currentStudentView = 'study';

function showRole(screen) {
  loginScreen.hidden = screen !== 'login';
  studentLoginScreen.hidden = screen !== 'student-login';
  teacherLoginScreen.hidden = screen !== 'teacher-login';
  studentApp.hidden = screen !== 'student';
  teacherDashboard.hidden = screen !== 'teacher';
  window.scrollTo({ top: 0, behavior: 'instant' });
  if (screen === 'teacher') renderTeacherLive();
}

async function publishStudentActivity(activity = currentStudentActivity, active = true) {
  if (!studentSession) return;
  currentStudentActivity = activity;
  const key = `${studentSession.grade}-${studentSession.classNumber}-${studentSession.number}`;
  const current = (data.activeStudents || []).find((student) => student.key === key);
  if (active && current && current.activity === activity && Date.now() - current.updatedAt < 10_000) return;
  data.activeStudents = (data.activeStudents || []).filter((student) => student.key !== key);
  if (active) {
    data.activeStudents.push({
      key,
      grade: studentSession.grade,
      classNumber: studentSession.classNumber,
      number: studentSession.number,
      name: studentSession.name,
      activity,
      updatedAt: Date.now(),
    });
  }
  data.activeStudents = data.activeStudents.slice(-30);
  saveData();
  if (!supabaseClient || !studentSession.id) return;
  try {
    if (!active) {
      const { error } = await supabaseClient.from('student_activity').delete().eq('student_id', studentSession.id);
      if (error) showToast('온라인 상태를 업데이트하지 못했어요.');
      return;
    }
    const { error } = await supabaseClient.from('student_activity').upsert({
      student_id: studentSession.id,
      grade: studentSession.grade,
      class_number: studentSession.classNumber,
      current_view: currentStudentView,
      activity,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'student_id' });
    if (error) showToast('온라인 상태를 업데이트하지 못했어요.');
  } catch {
    showToast('온라인 상태를 업데이트하지 못했어요.');
  }
}

document.querySelector('#student-login').addEventListener('click', () => showRole('student-login'));
document.querySelector('#teacher-login').addEventListener('click', () => showRole('teacher-login'));

document.querySelectorAll('[data-back-role]').forEach((button) => button.addEventListener('click', () => {
  document.querySelector('#student-login-form').reset();
  document.querySelector('#teacher-login-form').reset();
  setCurriculumGrade(Number(studentGradeSelect.value));
  setStudentFirstLoginMode(false);
  studentNameInput.setCustomValidity('');
  studentPasswordInput.setCustomValidity('');
  teacherPasswordInput.setCustomValidity('');
  showRole('login');
}));

const studentLoginForm = document.querySelector('#student-login-form');
const studentNameInput = document.querySelector('#student-name');
const studentPasswordInput = document.querySelector('#student-password');
const studentActivationCode = document.querySelector('#student-activation-code');
const studentPasswordConfirm = document.querySelector('#student-password-confirm');
const teacherLoginForm = document.querySelector('#teacher-login-form');
const teacherPasswordInput = document.querySelector('#teacher-password');
const studentGradeSelect = document.querySelector('#student-grade');
const teacherGradeSelect = document.querySelector('#teacher-grade');
const securePasswordPattern = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9])[\x21-\x7e]{8,16}$/;
let studentFirstLoginMode = false;

studentGradeSelect.addEventListener('change', () => setCurriculumGrade(studentGradeSelect.value));
teacherGradeSelect.addEventListener('change', () => setCurriculumGrade(teacherGradeSelect.value));

function validateStudentName() {
  const name = studentNameInput.value.trim();
  const valid = /^[A-Za-z가-힣]+(?: [A-Za-z가-힣]+)*$/.test(name);
  studentNameInput.setCustomValidity(name && !valid ? '학교에 등록된 한글 또는 영문 이름을 입력해 주세요.' : '');
}
function validatePassword(input) {
  const valid = securePasswordPattern.test(input.value);
  input.setCustomValidity(input.value && !valid ? '8~16자이며 영문자 1자 이상, 숫자 1자 이상, 특수문자 1자 이상을 넣어주세요.' : '');
}
function validatePasswordConfirmation() {
  const mismatch = studentFirstLoginMode && studentPasswordConfirm.value && studentPasswordConfirm.value !== studentPasswordInput.value;
  studentPasswordConfirm.setCustomValidity(mismatch ? '두 비밀번호가 서로 달라요.' : '');
}
function setStudentFirstLoginMode(enabled) {
  studentFirstLoginMode = enabled;
  document.querySelector('#student-first-login-fields').hidden = !enabled;
  document.querySelector('#student-password-confirm-wrap').hidden = !enabled;
  studentActivationCode.required = enabled;
  studentPasswordConfirm.required = enabled;
  studentPasswordInput.autocomplete = enabled ? 'new-password' : 'current-password';
  studentPasswordInput.minLength = enabled ? 8 : 0;
  studentPasswordInput.maxLength = enabled ? 16 : 256;
  document.querySelector('#student-password-hint').textContent = enabled
    ? '처음 설정하거나 초기화하는 비밀번호예요. 8~16자, 영문자·숫자·특수문자를 넣어주세요.'
    : '이미 만든 계정은 등록한 비밀번호를 입력해요. 잊었다면 선생님께 초기화 코드를 요청하세요.';
  document.querySelector('#student-login-submit').textContent = enabled ? '새 비밀번호 만들기' : '학생으로 들어가기';
  document.querySelector('#student-first-login-toggle').textContent = enabled ? '로그인 화면으로 돌아가기' : '처음 설정 / 비밀번호 잊음';
  document.querySelector('#student-login-error').hidden = true;
  studentActivationCode.setCustomValidity('');
  studentPasswordConfirm.setCustomValidity('');
}

studentNameInput.addEventListener('input', () => { validateStudentName(); document.querySelector('#student-login-error').hidden = true; });
studentPasswordInput.addEventListener('input', () => {
  if (studentFirstLoginMode) validatePassword(studentPasswordInput);
  else studentPasswordInput.setCustomValidity('');
  document.querySelector('#student-login-error').hidden = true;
});
teacherPasswordInput.addEventListener('input', () => { document.querySelector('#teacher-login-error').hidden = true; });
document.querySelector('#student-first-login-toggle').addEventListener('click', () => setStudentFirstLoginMode(!studentFirstLoginMode));
studentActivationCode.addEventListener('input', () => { document.querySelector('#student-login-error').hidden = true; });
studentPasswordInput.addEventListener('input', validatePasswordConfirmation);
studentPasswordConfirm.addEventListener('input', validatePasswordConfirmation);

studentLoginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  validateStudentName();
  if (studentFirstLoginMode) validatePassword(studentPasswordInput);
  else studentPasswordInput.setCustomValidity('');
  validatePasswordConfirmation();
  if (studentFirstLoginMode) studentActivationCode.setCustomValidity(/^\d{6}$/.test(studentActivationCode.value.trim()) ? '' : '선생님에게 받은 6자리 코드를 입력해 주세요.');
  if (!studentLoginForm.reportValidity()) return;
  const error = document.querySelector('#student-login-error');
  error.hidden = true;
  try {
    const studentGrade = Number(studentGradeSelect.value);
    setCurriculumGrade(studentGrade);
    const studentClass = document.querySelector('#student-class').value;
    const studentNumber = document.querySelector('#student-number').value;
    const studentName = studentNameInput.value.trim();
    const profile = studentFirstLoginMode
      ? await createStudentAccount(studentGrade, studentClass, studentNumber, studentName, studentPasswordInput.value, studentActivationCode.value.trim())
      : await signInAndLoadProfile('student', studentGrade, studentClass, studentNumber, studentName, studentPasswordInput.value);
    studentSession = { id: profile.id, grade: profile.grade, classNumber: profile.class_number, number: profile.student_number, name: profile.display_name };
    activeDataStudentId = profile.id;
    data = loadData(profile.id);
    renderStats();
    updateBattleProgress();
    await loadStudentSkillProgress();
    await loadStudentLearningPath();
    await refreshMachineLabAccess();
    currentStudentActivity = '오늘 미션';
    document.querySelector('#student-session-label').textContent = `${studentSession.classNumber}반 ${studentSession.number}번 ${studentSession.name}`;
    setStudentFirstLoginMode(false);
    studentPasswordInput.value = '';
    studentActivationCode.value = '';
    studentPasswordConfirm.value = '';
    showRole('student');
    if (new URLSearchParams(location.search).has('machine')) showStudentView('machine');
    await publishStudentActivity(currentStudentActivity);
  } catch (loginError) {
    error.textContent = loginError.message || '로그인하지 못했어요. 입력한 정보를 확인해 주세요.';
    error.hidden = false;
    error.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
});

const studentRosterForm = document.querySelector('#student-roster-form');
studentRosterForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const error = document.querySelector('#roster-error');
  error.hidden = true;
  renderIssuedRosterCodes([], '');
  const submit = studentRosterForm.querySelector('button[type="submit"]');
  submit.disabled = true;
  try {
    const studentNumber = Number(document.querySelector('#roster-student-number').value);
    const displayName = document.querySelector('#roster-student-name').value.trim();
    const result = await teacherRosterRequest('POST', {
      studentNumber,
      displayName,
    });
    const message = result.existingAccount
      ? '새 코드를 학생에게 직접 전달하세요. 학생은 이 코드로 새 비밀번호를 만들 수 있어요.'
      : '이 코드는 24시간 동안 한 번만 사용할 수 있어요. 다운로드하거나 인쇄해 학생에게 전달하세요.';
    renderIssuedRosterCodes([{ studentNumber, displayName, activationCode: result.activationCode }], message);
    studentRosterForm.reset();
    await loadTeacherRoster();
  } catch (rosterError) {
    error.textContent = rosterError.message || '학생 코드를 발급하지 못했어요.';
    error.hidden = false;
  } finally {
    submit.disabled = false;
  }
});

const studentRosterImportForm = document.querySelector('#student-roster-import-form');
studentRosterImportForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const error = document.querySelector('#roster-error');
  error.hidden = true;
  renderIssuedRosterCodes([], '');
  const submit = studentRosterImportForm.querySelector('button[type="submit"]');
  submit.disabled = true;
  try {
    const file = document.querySelector('#roster-file').files[0];
    if (!file) throw new Error('먼저 학생 명단 파일을 선택해 주세요.');
    if (file.size > 1_000_000) throw new Error('파일은 1MB 이하로 올려 주세요.');
    if (!/\.(csv|tsv|txt)$/i.test(file.name)) throw new Error('Excel에서 CSV UTF-8 또는 TSV 형식으로 저장해 주세요.');
    const students = parseRosterFileText(decodeRosterFile(await file.arrayBuffer()), file.name);
    const result = await teacherRosterRequest('POST', { students }, '/api/teacher/roster/bulk');
    const skippedMessage = result.skipped.length ? ` 이미 첫 로그인을 마친 ${result.skipped.length}명은 건너뛰었어요.` : '';
    if (result.issued.length) {
      renderIssuedRosterCodes(result.issued, `${result.issued.length}명의 코드가 발급됐어요.${skippedMessage} 지금 다운로드하거나 인쇄해 학생별로 전달해 주세요.`);
    } else {
      renderIssuedRosterCodes([], '새 코드가 필요한 학생이 없어요. 비밀번호를 잊은 학생은 아래에서 한 명씩 새 코드를 발급해 주세요.');
      showToast('이미 첫 로그인을 마친 학생은 일괄 발급에서 건너뛰었어요.');
    }
    studentRosterImportForm.reset();
    await loadTeacherRoster();
  } catch (importError) {
    error.textContent = importError.message || '명단 파일을 처리하지 못했어요.';
    error.hidden = false;
  } finally {
    submit.disabled = false;
  }
});

document.querySelector('#download-roster-template').addEventListener('click', () => {
  const link = document.createElement('a');
  const url = URL.createObjectURL(new Blob(['\uFEFF번호,이름\r\n'], { type: 'text/csv;charset=utf-8' }));
  link.href = url;
  link.download = '학생명단_양식.csv';
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
});

document.querySelector('#download-roster-codes').addEventListener('click', downloadIssuedRosterCodes);
document.querySelector('#print-roster-codes').addEventListener('click', printIssuedRosterCodes);

teacherLoginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!teacherLoginForm.reportValidity()) return;
  const error = document.querySelector('#teacher-login-error');
  error.hidden = true;
  try {
    const grade = Number(teacherGradeSelect.value);
    setCurriculumGrade(grade);
    const email = document.querySelector('#teacher-email').value.trim();
    const profile = await signInAndLoadProfile('teacher', grade, null, null, null, teacherPasswordInput.value, email);
    teacherSession = { id: profile.id, grade: profile.grade, classNumber: profile.class_number, name: profile.display_name };
    teacherPasswordInput.value = '';
    document.querySelector('#teacher-class-label').textContent = `${teacherSession.grade}학년 ${teacherSession.classNumber}반`;
    document.querySelector('#teacher-session-label').textContent = teacherSession.name;
    showRole('teacher');
    await startTeacherRealtime();
  } catch (loginError) {
    error.textContent = loginError.message || '로그인하지 못했어요. 입력한 정보를 확인해 주세요.';
    error.hidden = false;
    error.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
});

const teacherPasswordDialog = document.querySelector('#teacher-password-dialog');
const teacherPasswordForm = document.querySelector('#teacher-password-form');
const teacherPasswordMessage = document.querySelector('#teacher-password-message');
const teacherCurrentPasswordInput = document.querySelector('#teacher-current-password');
const teacherNewPasswordInput = document.querySelector('#teacher-new-password');
const teacherNewPasswordConfirmInput = document.querySelector('#teacher-new-password-confirm');
const teacherPasswordSaveButton = document.querySelector('.teacher-password-submit');

function showTeacherPasswordMessage(message, error = false) {
  teacherPasswordMessage.textContent = message;
  teacherPasswordMessage.hidden = !message;
  teacherPasswordMessage.classList.toggle('is-error', error);
}

function closeTeacherPasswordDialog() {
  teacherPasswordDialog.close();
  teacherPasswordForm.reset();
  showTeacherPasswordMessage('');
}
teacherPasswordDialog.addEventListener('close', () => {
  teacherPasswordForm.reset();
  showTeacherPasswordMessage('');
});

document.querySelector('#open-teacher-password').addEventListener('click', () => {
  teacherPasswordForm.reset();
  showTeacherPasswordMessage('');
  teacherPasswordDialog.showModal();
  teacherCurrentPasswordInput.focus();
});
document.querySelector('#close-teacher-password').addEventListener('click', closeTeacherPasswordDialog);
document.querySelector('#cancel-teacher-password').addEventListener('click', closeTeacherPasswordDialog);
teacherPasswordDialog.addEventListener('click', (event) => {
  if (event.target === teacherPasswordDialog) closeTeacherPasswordDialog();
});
teacherPasswordForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const currentPassword = teacherCurrentPasswordInput.value;
  const newPassword = teacherNewPasswordInput.value;
  if (!securePasswordPattern.test(newPassword)) {
    showTeacherPasswordMessage('새 비밀번호는 8~16자이며 영문자, 숫자, 특수문자를 각각 하나 이상 넣어주세요.', true);
    teacherNewPasswordInput.focus();
    return;
  }
  if (newPassword !== teacherNewPasswordConfirmInput.value) {
    showTeacherPasswordMessage('새 비밀번호 두 칸이 서로 달라요. 다시 확인해 주세요.', true);
    teacherNewPasswordConfirmInput.focus();
    return;
  }
  if (currentPassword === newPassword) {
    showTeacherPasswordMessage('현재 비밀번호와 다른 새 비밀번호를 정해 주세요.', true);
    teacherNewPasswordInput.focus();
    return;
  }
  teacherPasswordSaveButton.disabled = true;
  showTeacherPasswordMessage('본인 확인과 비밀번호 변경을 진행하고 있어요.');
  try {
    if (!supabaseClient || teacherSession?.id !== currentAuthUser?.id) throw new Error('교사 계정으로 다시 로그인해 주세요.');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user?.email) throw new Error('로그인 정보를 확인하지 못했어요. 다시 로그인해 주세요.');
    const { error: verifyError } = await supabaseClient.auth.signInWithPassword({ email: user.email, password: currentPassword });
    if (verifyError) throw new Error('현재 비밀번호가 맞지 않아요. 다시 확인해 주세요.');
    const { error: updateError } = await supabaseClient.auth.updateUser({ password: newPassword });
    if (updateError) throw new Error('비밀번호를 바꾸지 못했어요. 잠시 후 다시 시도해 주세요.');
    closeTeacherPasswordDialog();
    showToast('교사 비밀번호를 바꿨어요. 다음 로그인부터 새 비밀번호를 사용해 주세요.');
  } catch (error) {
    showTeacherPasswordMessage(error.message || '비밀번호를 바꾸지 못했어요.', true);
  } finally {
    teacherPasswordSaveButton.disabled = false;
  }
});

document.querySelectorAll('[data-back-login]').forEach((button) => button.addEventListener('click', async () => {
  if (studentSession) await publishStudentActivity('', false);
  if (teacherRealtimeChannel && supabaseClient) {
    await supabaseClient.removeChannel(teacherRealtimeChannel);
    teacherRealtimeChannel = null;
  }
  studentSession = null;
  teacherSession = null;
  currentAuthUser = null;
  activeDataStudentId = null;
  machineLabOpen = false;
  machineLabAccessChecked = false;
  machineLabAccessError = '';
  machineLoadedShare = '';
  machineShareImportValid = false;
  machine.title = '첫 번째 경사로';
  machine.parts = createSampleMachineParts();
  machine.nextId = machine.parts.length + 1;
  machine.selectedId = null;
  machine.tool = 'ramp';
  resetMachineBall();
  machine.result = '미리 놓인 경사로에서 구슬을 굴려 보고, 부품을 더해 길을 바꿔 보세요.';
  stopMachineAnimation();
  data = loadData();
  renderStats();
  updateBattleProgress();
  studentSkillProgress = {};
  missionProgress = { lesson_index: 0, completed_at: null, completed_correctly: null };
  missionAnswerPending = false;
  missionFeedbackState = null;
  renderLearningProfile();
  renderMission();
  if (supabaseClient) await supabaseClient.auth.signOut();
  document.querySelector('#student-session-label').textContent = '';
  document.querySelector('#teacher-session-label').textContent = '';
  document.querySelector('#student-login-form').reset();
  document.querySelector('#teacher-login-form').reset();
  setCurriculumGrade(Number(studentGradeSelect.value));
  document.querySelector('#teacher-class-label').textContent = `${activeGrade}학년 1반`;
  setStudentFirstLoginMode(false);
  studentNameInput.setCustomValidity('');
  studentPasswordInput.setCustomValidity('');
  teacherPasswordInput.setCustomValidity('');
  showRole('login');
}));

const studentViews = {
  study: document.querySelector('#study-view'),
  together: document.querySelector('#study-together-view'),
  battle: document.querySelector('#battle-view'),
  geometry: document.querySelector('#geometry-view'),
  machine: document.querySelector('#machine-lab-view'),
};

function showStudentView(name) {
  if (battle.running && name !== 'battle') finishBattle('cancelled');
  currentStudentView = name;
  Object.entries(studentViews).forEach(([key, view]) => {
    view.hidden = key !== name;
  });
  if (name === 'machine') {
    renderMachineLab();
    void openMachineLab();
  }
  document.querySelectorAll('[data-student-tab]').forEach((button) => {
    const selected = button.dataset.studentTab === name;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  publishStudentActivity(name === 'battle' ? 'AI 대결 중' : name === 'together' ? '함께 공부 중' : name === 'geometry' ? '도형 놀이터에서 탐구 중' : name === 'machine' ? '움직이는 장치 제작 중' : '오늘 미션 연습 중');
  window.scrollTo({ top: 0, behavior: 'instant' });
}

document.querySelectorAll('[data-student-tab]').forEach((button) => {
  button.addEventListener('click', () => showStudentView(button.dataset.studentTab));
});

document.querySelectorAll('[data-geometry-mode]').forEach((button) => {
  button.addEventListener('click', () => {
    geometryState.mode = button.dataset.geometryMode;
    renderGeometryLab();
  });
});
const geometryStage = document.querySelector('#geometry-stage');

function geometryPointFromPointer(event) {
  const svg = geometryStage.querySelector('svg');
  if (!svg) return null;
  const point = svg.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  const local = point.matrixTransform(svg.getScreenCTM().inverse());
  return [Math.max(16, Math.min(304, Math.round(local.x / 4) * 4)), Math.max(16, Math.min(236, Math.round(local.y / 4) * 4))];
}

function addGeometryPoint(point) {
  const tool = geometryState.tool;
  const points = geometryState.drawings[tool];
  if (!points) return;
  geometryState.constrainedShapes[tool] = null;
  if (geometryState.drawingComplete) {
    geometryState.drawings[tool] = [];
    geometryState.drawingComplete = false;
  }
  const fixedPointCount = { lines: 2, angles: 3, triangles: 3, quadrilaterals: 4, circle: 2, circleArea: 2 }[tool];
  if (fixedPointCount && points.length >= fixedPointCount) {
    geometryState.drawings[tool] = [];
    geometryState.drawingComplete = false;
  }
  const nextPoints = geometryState.drawings[tool];
  if (nextPoints.length >= 8) return;
  nextPoints.push(point);
  if (tool === 'triangles' && nextPoints.length === 3) {
    geometryState.drawingComplete = true;
    renderGeometryLab();
    return;
  }
  if (tool === 'quadrilaterals' && nextPoints.length === 4) {
    geometryState.drawingComplete = true;
    renderGeometryLab();
    return;
  }
  if (fixedPointCount && nextPoints.length === fixedPointCount) geometryState.drawingComplete = true;
  if (nextPoints.length === 8) geometryState.drawingComplete = true;
  renderGeometryLab();
}

geometryStage.addEventListener('pointerdown', (event) => {
  if (geometryState.mode !== '2d' || !event.target.closest('.geometry-interactive-svg')) return;
  const handle = event.target.closest('[data-geometry-point]');
  if (handle) {
    event.preventDefault();
    geometryState.activeDragPoint = Number(handle.dataset.geometryPoint);
    const points = geometryState.drawings[geometryState.tool];
    const model = geometryState.constrainedShapes[geometryState.tool];
    geometryState.dragOrigin = model ? {
      point: [...points[geometryState.activeDragPoint]],
      center: [...model.center],
    } : null;
    geometryStage.setPointerCapture(event.pointerId);
    return;
  }
  const point = geometryPointFromPointer(event);
  if (point) addGeometryPoint(point);
});

geometryStage.addEventListener('pointermove', (event) => {
  if (geometryState.activeDragPoint === null || geometryState.mode !== '2d') return;
  const point = geometryPointFromPointer(event);
  const points = geometryState.drawings[geometryState.tool];
  if (!point || !points?.[geometryState.activeDragPoint]) return;
  if (geometryState.constrainedShapes[geometryState.tool]) {
    geometryMoveConstrainedPoint(geometryState.tool, geometryState.activeDragPoint, point, geometryState.dragOrigin);
  } else {
    points[geometryState.activeDragPoint] = point;
  }
  renderGeometryStage();
});

function stopGeometryDrag() {
  geometryState.activeDragPoint = null;
  geometryState.dragOrigin = null;
}

geometryStage.addEventListener('pointerup', stopGeometryDrag);
geometryStage.addEventListener('pointercancel', stopGeometryDrag);
geometryStage.addEventListener('keydown', (event) => {
  const handle = event.target.closest('[data-geometry-point]');
  if (!handle) return;
  const movement = { ArrowLeft: [-4, 0], ArrowRight: [4, 0], ArrowUp: [0, -4], ArrowDown: [0, 4] }[event.key];
  if (!movement) return;
  event.preventDefault();
  const points = geometryState.drawings[geometryState.tool];
  const pointIndex = Number(handle.dataset.geometryPoint);
  const point = points[pointIndex];
  if (!point) return;
  const target = [Math.max(16, Math.min(304, point[0] + movement[0])), Math.max(16, Math.min(236, point[1] + movement[1]))];
  const model = geometryState.constrainedShapes[geometryState.tool];
  if (model) {
    geometryMoveConstrainedPoint(geometryState.tool, pointIndex, target, { point: [...point], center: [...model.center] });
  } else {
    point[0] = target[0];
    point[1] = target[1];
  }
  renderGeometryLab();
});

document.querySelector('#geometry-tool-list').addEventListener('click', (event) => {
  const button = event.target.closest('[data-geometry-tool]');
  if (!button) return;
  geometryState.tool = button.dataset.geometryTool;
  if (geometryState.tool === 'prism') geometryState.solid = 'prism';
  renderGeometryLab();
});
document.querySelector('#geometry-controls').addEventListener('input', (event) => {
  const input = event.target.closest('[data-geometry-input]');
  if (!input) return;
  const value = input.value;
  if (input.dataset.geometryInput === 'sides') geometryState.sides = Number(value);
  if (input.dataset.geometryInput === 'rotation') geometryState.rotation = Number(value);
  if (input.dataset.geometryInput === 'radius') geometryState.radius = Number(value);
  if (input.dataset.geometryInput === 'symmetryShape') geometryState.symmetryShape = value;
  if (input.dataset.geometryInput === 'solid') geometryState.solid = value;
   const label = input.parentElement.querySelector('strong');
   if (label) label.textContent = input.dataset.geometryInput === 'rotation' ? `${value}°` : `${value}칸`;
  renderGeometryStage();
});
document.querySelector('#geometry-controls').addEventListener('change', (event) => {
  const input = event.target.closest('[data-geometry-input]');
  if (!input) return;
  if (input.dataset.geometryInput === 'symmetryShape') geometryState.symmetryShape = input.value;
  if (input.dataset.geometryInput === 'solid') geometryState.solid = input.value;
  if (input.dataset.geometryInput === 'lineKind') geometryState.lineKind = input.value;
  if (input.dataset.geometryInput === 'angleKind') geometryState.angleKind = input.value;
  if (input.dataset.geometryInput === 'triangleKind') geometryState.triangleKind = input.value;
  if (input.dataset.geometryInput === 'quadrilateralKind') geometryState.quadrilateralKind = input.value;
  if (input.dataset.geometryInput === 'congruenceShape') geometryState.congruenceShape = input.value;
  if (input.dataset.geometryInput === 'lineKind') geometryState.lineKind = input.value;
  renderGeometryLab();
});
document.querySelector('#geometry-controls').addEventListener('click', (event) => {
  const presetShape = event.target.closest('[data-geometry-preset-shape]')?.dataset.geometryPresetShape;
  if (presetShape) {
    if (presetShape === 'freeTriangle' || presetShape === 'freeSquare') {
      const tool = presetShape === 'freeTriangle' ? 'triangles' : 'quadrilaterals';
      geometryState.tool = tool;
      geometryState.constrainedShapes[tool] = null;
      geometryState.drawings[tool] = [];
      geometryState.drawingComplete = false;
      renderGeometryLab();
    } else {
      geometryMakePreset(presetShape);
    }
    return;
  }
  const drawAction = event.target.closest('[data-geometry-action]')?.dataset.geometryAction;
  if (drawAction === 'clear-drawing') {
    geometryState.drawings[geometryState.tool] = [];
    if (geometryState.constrainedShapes[geometryState.tool]) geometryState.constrainedShapes[geometryState.tool] = null;
    geometryState.drawingComplete = false;
    renderGeometryLab();
    return;
  }
  if (drawAction === 'undo-point') {
    if (geometryState.constrainedShapes[geometryState.tool]) geometryState.constrainedShapes[geometryState.tool] = null;
    geometryState.drawings[geometryState.tool].pop();
    geometryState.drawingComplete = false;
    renderGeometryLab();
    return;
  }
  if (drawAction === 'continue-drawing') {
    geometryState.drawingComplete = false;
    renderGeometryLab();
    return;
  }
  if (drawAction === 'finish-drawing') {
    if (geometryState.drawings[geometryState.tool].length >= 3) geometryState.drawingComplete = true;
    renderGeometryLab();
    return;
  }
  const viewButton = event.target.closest('[data-geometry-view]');
  if (viewButton) {
    geometryState.blockView = viewButton.dataset.geometryView;
    renderGeometryLab();
    return;
  }
  const presetButton = event.target.closest('[data-geometry-preset]');
  if (presetButton) {
    const presets = {
      stairs: [[1, 2, 3], [0, 1, 2], [0, 0, 1]],
      wall: [[3, 3, 3], [3, 3, 3], [0, 0, 0]],
      clear: [[0, 0, 0], [0, 0, 0], [0, 0, 0]],
    };
    geometryState.blocks = presets[presetButton.dataset.geometryPreset].map((row) => [...row]);
    geometryState.blockView = 'iso';
    renderGeometryLab();
    return;
  }
  const actionButton = event.target.closest('[data-geometry-action]');
  if (!actionButton) return;
  const action = actionButton.dataset.geometryAction;
  if (action === 'toggle-measurements') geometryState.showMeasurements = !geometryState.showMeasurements;
  if (action === 'toggle-axes') geometryState.symmetryAxes = !geometryState.symmetryAxes;
  if (action === 'toggle-net') geometryState.solidNet = !geometryState.solidNet;
  if (action === 'rotate-left' || action === 'rotate-right') {
    const old = geometryState.blocks;
    geometryState.blocks = old[0].map((_, column) => old.map((row) => row[column]).reverse());
  }
  if (action === 'solid-turn-left') geometryState.solidTurn -= 30;
  if (action === 'solid-turn-right') geometryState.solidTurn += 30;
  if (action === 'block-up' || action === 'block-down') {
    const x = Number(actionButton.dataset.x);
    const y = Number(actionButton.dataset.y);
    geometryState.blocks[x][y] = Math.max(0, Math.min(4, geometryState.blocks[x][y] + (action === 'block-up' ? 1 : -1)));
  }
  renderGeometryLab();
});

renderMission();
initializeStudyUnits();
renderGeometryLab();
initializeMachineLab();

document.querySelectorAll('[data-student-filter]').forEach((button) => {
  button.addEventListener('click', () => {
    const filter = button.dataset.studentFilter;
    document.querySelectorAll('[data-student-filter]').forEach((filterButton) => filterButton.classList.toggle('active', filterButton === button));
    document.querySelectorAll('.teacher-student').forEach((student) => {
      student.hidden = filter !== 'all' && student.dataset.status !== filter;
    });
  });
});

const notebookCanvas = document.querySelector('#notebook-canvas');
const notebookContext = notebookCanvas.getContext('2d', { willReadFrequently: true });
const notebookStatus = document.querySelector('#notebook-status');
const notebookHistory = [];
let isWriting = false;
let lastInkPoint;

function sizeNotebookCanvas() {
  notebookContext.lineCap = 'round';
  notebookContext.lineJoin = 'round';
  notebookContext.strokeStyle = '#26365d';
}

function rememberNotebook() {
  if (notebookHistory.length >= 12) notebookHistory.shift();
  notebookHistory.push(notebookContext.getImageData(0, 0, notebookCanvas.width, notebookCanvas.height));
}

function notebookPoint(event) {
  const rect = notebookCanvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * notebookCanvas.width / rect.width,
    y: (event.clientY - rect.top) * notebookCanvas.height / rect.height,
  };
}

notebookCanvas.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  rememberNotebook();
  try {
    notebookCanvas.setPointerCapture(event.pointerId);
  } catch {
    // Pointer capture is unavailable for synthetic events but drawing still works.
  }
  isWriting = true;
  lastInkPoint = notebookPoint(event);
  notebookContext.beginPath();
  notebookContext.moveTo(lastInkPoint.x, lastInkPoint.y);
  notebookContext.lineWidth = event.pointerType === 'pen' && event.pressure ? 3 + event.pressure * 5 : 6;
  notebookContext.lineTo(lastInkPoint.x + 1, lastInkPoint.y + 1);
  notebookContext.stroke();
  notebookStatus.textContent = '좋아요! 계속 써봐요.';
});

notebookCanvas.addEventListener('pointermove', (event) => {
  if (!isWriting) return;
  const point = notebookPoint(event);
  notebookContext.beginPath();
  notebookContext.moveTo(lastInkPoint.x, lastInkPoint.y);
  notebookContext.lineTo(point.x, point.y);
  notebookContext.lineWidth = event.pointerType === 'pen' && event.pressure ? 2 + event.pressure * 6 : 6;
  notebookContext.stroke();
  lastInkPoint = point;
});

function finishInk() {
  isWriting = false;
  lastInkPoint = null;
}

notebookCanvas.addEventListener('pointerup', finishInk);
notebookCanvas.addEventListener('pointercancel', finishInk);
document.querySelector('#undo-ink').addEventListener('click', () => {
  const previous = notebookHistory.pop();
  if (previous) {
    notebookContext.putImageData(previous, 0, 0);
    notebookStatus.textContent = '한 번 되돌렸어요.';
  } else {
    notebookStatus.textContent = '되돌릴 게 없어요.';
  }
});
document.querySelector('#clear-ink').addEventListener('click', () => {
  rememberNotebook();
  notebookContext.clearRect(0, 0, notebookCanvas.width, notebookCanvas.height);
  notebookStatus.textContent = '공책을 깨끗이 비웠어요.';
});
document.querySelector('#write-problem').addEventListener('click', () => {
  rememberNotebook();
  notebookContext.fillStyle = '#26365d';
  notebookContext.font = '64px Jua, sans-serif';
  notebookContext.fillText(notebookCurrentPrompt, 55, 92, notebookCanvas.width - 100);
  notebookStatus.textContent = '이제 아래에 계산 과정을 써봐요.';
});
sizeNotebookCanvas();

const notebookDialog = document.querySelector('#notebook-drawer');
document.querySelector('#open-notebook').addEventListener('click', () => {
  publishStudentActivity('공책으로 계산 중');
  notebookDialog.showModal();
  requestAnimationFrame(sizeNotebookCanvas);
});
document.querySelector('#close-notebook').addEventListener('click', () => notebookDialog.close());
notebookDialog.addEventListener('click', (event) => {
  if (event.target === notebookDialog) notebookDialog.close();
});
notebookDialog.addEventListener('close', () => publishStudentActivity(currentStudentView === 'battle' ? 'AI 대결 중' : currentStudentView === 'together' ? '함께 공부 중' : '오늘 미션 연습 중'));

function makeGraphBattleQuestions(graph) {
  const questions = [];
  const adjacentValues = (correct) => {
    const alternatives = [...new Set(graph.values.filter((value) => value !== correct))].slice(0, 2);
    for (let offset = 1; alternatives.length < 2; offset += 1) {
      const candidate = correct + offset;
      if (!alternatives.includes(candidate)) alternatives.push(candidate);
    }
    return [`${correct}${graph.unit}`, ...alternatives.map((value) => `${value}${graph.unit}`)];
  };
  const segmentNames = graph.labels.slice(1).map((label, index) => `${graph.labels[index]}-${label}`);
  const segmentChanges = graph.values.slice(1).map((value, index) => value - graph.values[index]);
  const labelChoices = (correct) => [correct, ...graph.labels.filter((label) => label !== correct).slice(0, 2)];
  const segmentChoices = (correct) => [correct, ...segmentNames.filter((segment) => segment !== correct).slice(0, 2)];
  const add = (id, title, prompt, answer, choices, skill) => questions.push({
    id: `graph-${graph.id}-${id}`,
    unitId: 'line_graphs',
    graphId: graph.id,
    skill,
    title: `${graph.title}: ${title}`,
    prompt,
    answer,
    choices,
  });

  graph.labels.forEach((label, index) => {
    const answer = `${graph.values[index]}${graph.unit}`;
    add(`read-${index}`, `${label}의 값은 몇 ${graph.unit}일까요?`, `${graph.title}의 그래프에서 ${label} 점을 찾아요.`, answer, adjacentValues(graph.values[index]), 'graph_read');
  });
  const highestIndex = graph.values.indexOf(Math.max(...graph.values));
  const lowestIndex = graph.values.indexOf(Math.min(...graph.values));
  add('highest', '값이 가장 높은 때는 언제일까요?', '세로축에서 가장 높은 점의 가로축 이름을 찾아요.', graph.labels[highestIndex], labelChoices(graph.labels[highestIndex]), 'graph_read');
  add('lowest', '값이 가장 낮은 때는 언제일까요?', '세로축에서 가장 낮은 점의 가로축 이름을 찾아요.', graph.labels[lowestIndex], labelChoices(graph.labels[lowestIndex]), 'graph_read');
  const riseIndex = segmentChanges.indexOf(Math.max(...segmentChanges));
  const dropIndex = segmentChanges.indexOf(Math.min(...segmentChanges));
  const greatestRise = segmentNames[riseIndex];
  const greatestDrop = segmentNames[dropIndex];
  add('greatest-rise', '가장 많이 오른 구간은 어디일까요?', '이웃한 점 사이의 값 차이를 비교해요.', greatestRise, segmentChoices(greatestRise), 'graph_change');
  add('greatest-drop', '가장 많이 내려간 구간은 어디일까요?', '이웃한 점 사이의 값 차이를 비교해요.', greatestDrop, segmentChoices(greatestDrop), 'graph_change');
  const totalChange = graph.values.at(-1) - graph.values[0];
  const totalAnswer = totalChange === 0 ? '변화 없어요' : `${Math.abs(totalChange)}${graph.unit} ${totalChange > 0 ? '올랐어요' : '내렸어요'}`;
  add('overall-change', `${graph.labels[0]}에서 ${graph.labels.at(-1)}까지 어떻게 변했을까요?`, '처음 값과 마지막 값을 비교해요.', totalAnswer, [totalAnswer, `${Math.abs(totalChange) + 1}${graph.unit} 올랐어요`, '변화 없어요'].filter((choice, index, items) => items.indexOf(choice) === index).slice(0, 3), 'graph_change');
  return questions;
}

function getBattleQuestions(unitId) {
  const lessonQuestions = dailyMissions.flatMap((mission, missionIndex) => {
    if (mission.unitId !== unitId) return [];
    if (unitId === 'line_graphs' && !['graph_draw', 'graph_scale'].includes(mission.skill)) return [];
    const versions = [{ question: mission, id: `mission-${missionIndex}` }];
    if (mission.retry) versions.push({ question: { ...mission, ...mission.retry }, id: `retry-${missionIndex}` });
    return versions.map(({ question, id }) => ({
      ...question,
      id: `${unitId}-${id}`,
      unitId,
      skill: question.skill || mission.skill,
      title: question.questionTitle,
      prompt: question.question,
    }));
  });
  const extraQuestions = (supplementalBattleQuestions[unitId] || []).map((question, index) => ({
    ...question,
    id: `${unitId}-extra-${index}`,
    unitId,
  }));
  const graphQuestions = unitId === 'line_graphs'
    ? [lineGraphSets.monthlyTemperatures, lineGraphSets.weekdayTemperatures, lineGraphSets.hourlyCounts].flatMap(makeGraphBattleQuestions)
    : [];
  return [...lessonQuestions, ...extraQuestions, ...graphQuestions];
}

function validateActiveQuestionBank() {
  const questionIds = new Set();
  curriculumUnits.forEach((unit) => {
    const missionCount = dailyMissions.filter((mission) => mission.unitId === unit.id).length;
    if (missionCount !== unit.missionCount) throw new Error(`오늘 미션 수가 교육과정과 달라요: ${unit.id}`);
  });
  curriculumUnits.forEach((unit) => getBattleQuestions(unit.id).forEach((question) => {
    if (questionIds.has(question.id)) throw new Error(`AI 대결 문제 ID가 겹쳐요: ${question.id}`);
    if (!question.choices?.includes(question.answer)) throw new Error(`AI 대결 정답이 보기에 없어요: ${question.id}`);
    if (!learningSkillLabels[question.skill]) throw new Error(`AI 대결 개념을 찾을 수 없어요: ${question.skill}`);
    if (question.graphId && !lineGraphSets[question.graphId]) throw new Error(`그래프 자료를 찾을 수 없어요: ${question.graphId}`);
    questionIds.add(question.id);
  }));
  dailyMissions.forEach((mission) => {
    [mission, ...(mission.retry ? [mission.retry] : [])].forEach((question) => {
      if (!question.choices?.includes(question.answer)) throw new Error(`오늘 미션 정답이 보기에 없어요: ${question.questionTitle}`);
      if (!learningSkillLabels[question.skill || mission.skill]) throw new Error(`오늘 미션 개념을 찾을 수 없어요: ${question.skill || mission.skill}`);
    });
  });
}

if (import.meta.env.DEV) {
  validateActiveQuestionBank();
}

const battle = {
  running: false,
  interval: null,
  startedAt: 0,
  aiSeconds: 0,
  question: null,
  attempts: [],
};
const battleStart = document.querySelector('#battle-start');
const battleRound = document.querySelector('#battle-round');
const battleForm = document.querySelector('#battle-form');
const battleAnswer = document.querySelector('#battle-answer');
const battleFeedback = document.querySelector('#battle-feedback');
const battleAgain = document.querySelector('#battle-again');
const battleOptions = document.querySelector('#battle-options');
const battleUnitSelect = document.querySelector('#battle-unit-select');
const battleProgressLabel = document.querySelector('#battle-progress-label');
const battleComplete = document.querySelector('#battle-complete');
const battleVisual = document.querySelector('#battle-visual');

function updateBattleProgress() {
  const unitId = battleUnitSelect?.value || activeStudyUnitId;
  const questions = getBattleQuestions(unitId);
  const completedIds = new Set(data.battleCompleted?.[unitId] || []);
  const completed = questions.filter((question) => completedIds.has(question.id)).length;
  const isComplete = questions.length > 0 && completed === questions.length;
  document.querySelector('#battle-unit-label').textContent = `${curriculumUnitById[unitId].title} · 단원 도전 문제`;
  battleProgressLabel.textContent = `${completed} / ${questions.length}문제`;
  battleComplete.hidden = !isComplete;
  if (battleRound.hidden) battleStart.hidden = isComplete;
  if (isComplete && !battle.running) battleAgain.hidden = true;
  return { questions, completedIds, isComplete };
}

function stopBattle() {
  if (battle.interval) window.clearInterval(battle.interval);
  battle.interval = null;
  battle.running = false;
}

function finishBattle(winner) {
  if (!battle.running) return;
  stopBattle();
  const elapsed = (Date.now() - battle.startedAt) / 1000;
  battleAnswer.disabled = true;
  document.querySelector('#battle-form button').disabled = true;
  battleUnitSelect.disabled = false;
  battleOptions.querySelectorAll('button').forEach((button) => { button.disabled = true; });
  battleAgain.hidden = false;
  if (winner === 'student') {
    battleFeedback.className = 'battle-feedback is-win';
    battleFeedback.innerHTML = formatFractionText(`맞았어요! ${elapsed.toFixed(1)}초 만에 풀었어요. 다음 문제도 도전해 볼까요?`);
  } else if (winner === 'wrong') {
    battleFeedback.className = 'battle-feedback is-loss';
    battleFeedback.innerHTML = formatFractionText(`틀렸어요. 정답은 ${battle.question.answer}예요. 다음 문제에 도전해 봐요.`);
  } else if (winner === 'ai') {
    battleFeedback.className = 'battle-feedback is-loss';
    battleFeedback.innerHTML = formatFractionText(`콩이가 먼저 풀었어요. 정답은 ${battle.question.answer}예요. 다음 문제를 풀어봐요.`);
  } else {
    battleFeedback.className = 'battle-feedback';
    battleFeedback.textContent = '대결을 멈췄어요. 준비되면 다시 시작해요.';
    battleStart.hidden = false;
    battleRound.hidden = true;
    battleAgain.hidden = true;
    battleOptions.hidden = true;
  }
  if (winner !== 'cancelled' && battle.question) {
    const completed = data.battleCompleted[battle.question.unitId] || (data.battleCompleted[battle.question.unitId] = []);
    if (!completed.includes(battle.question.id)) completed.push(battle.question.id);
    const progress = updateBattleProgress();
    battleAgain.hidden = progress.isComplete;
    if (battle.attempts.length) {
      const solved = battle.attempts.some((attempt) => attempt.correct);
      void recordSkillAttempt(battle.question.skill, solved, 0, battle.question.unitId);
    }
  }
  if (studentSession && winner !== 'cancelled' && battle.question) {
    const resultText = winner === 'student' ? '학생이 먼저 맞혔어요.' : winner === 'wrong' ? `오답이에요. 정답은 ${battle.question.answer}예요.` : `시간이 끝났어요. 정답은 ${battle.question.answer}예요.`;
    const questionText = `${battle.question.title} ${battle.question.prompt}`;
    const messages = [{ role: 'tutor', text: `대결 문제: ${questionText}` }];
    battle.attempts.forEach((attempt) => {
      messages.push({ role: 'student', text: `내 답: ${attempt.value}` });
      if (!attempt.correct) messages.push({ role: 'tutor', text: '아직 답이 아니에요. 문제의 그림과 조건을 다시 살펴봐요.' });
    });
    messages.push({ role: 'tutor', text: resultText });
    data.total += 1;
    if (winner === 'student') data.correct += 1;
    data.records.unshift({
      supabaseId: null,
      text: questionText,
      mode: 'battle',
      unitId: battle.question.unitId,
      at: Date.now(),
      hints: 0,
      result: winner === 'student' ? 'correct' : 'retry',
      practiceSeconds: Math.max(1, Math.round(elapsed)),
      student: { grade: studentSession.grade, classNumber: studentSession.classNumber, number: studentSession.number, name: studentSession.name },
      messages,
    });
    data.records = data.records.slice(0, 20);
    void syncSupabaseRecord(data.records[0]);
  }
  saveData();
  if (winner !== 'cancelled') publishStudentActivity('AI 대결 결과 확인 중');
}

function tickBattle() {
  if (!battle.running) return;
  const elapsed = (Date.now() - battle.startedAt) / 1000;
  const remaining = Math.max(0, battle.aiSeconds - elapsed);
  document.querySelector('#student-time').textContent = `나 ${elapsed.toFixed(1)}초`;
  document.querySelector('#ai-time').textContent = `콩이 ${remaining.toFixed(1)}초 남음`;
  document.querySelector('#battle-progress').style.width = `${Math.min(elapsed / battle.aiSeconds, 1) * 100}%`;
  if (elapsed >= battle.aiSeconds) finishBattle('ai');
}

function startBattle() {
  stopBattle();
  const { questions, completedIds, isComplete } = updateBattleProgress();
  const availableQuestions = questions.filter((question) => !completedIds.has(question.id));
  if (isComplete || !availableQuestions.length) {
    battleStart.hidden = true;
    battleComplete.hidden = false;
    return;
  }
  battle.running = true;
  battle.startedAt = Date.now();
  battle.aiSeconds = 10 + Math.floor(Math.random() * 6);
  battle.question = availableQuestions[Math.floor(Math.random() * availableQuestions.length)];
  battle.attempts = [];
  document.querySelector('#battle-problem').innerHTML = formatFractionText(`${battle.question.title}\n${battle.question.prompt}`);
  battleVisual.innerHTML = battle.question.graphId
    ? lineGraphVisual(lineGraphSets[battle.question.graphId])
    : battle.question.visual ? buildMissionVisual(battle.question) : '';
  updateNotebookPrompt(battle.question.title);
  battleOptions.replaceChildren();
  battle.question.choices.forEach((choice) => {
    const option = document.createElement('button');
    option.type = 'button';
    option.dataset.battleAnswer = choice;
     option.innerHTML = formatFractionText(choice);
    option.addEventListener('click', () => {
      if (!battle.running) return;
      battleAnswer.value = choice;
      battleForm.requestSubmit();
    });
    battleOptions.append(option);
  });
  battleOptions.hidden = !battle.question.choices.length;
  battleComplete.hidden = true;
  battleStart.hidden = true;
  battleRound.hidden = false;
  battleAgain.hidden = true;
  battleFeedback.className = 'battle-feedback';
  battleFeedback.textContent = '콩이도 풀기 시작했어요. 답을 적어봐요!';
  battleAnswer.disabled = false;
  battleAnswer.value = '';
  document.querySelector('#battle-form button').disabled = false;
  battleUnitSelect.disabled = true;
  publishStudentActivity('콩이와 계산 대결 중');
  tickBattle();
  battle.interval = window.setInterval(tickBattle, 100);
  battleAnswer.focus();
}

battleStart.addEventListener('click', startBattle);
battleAgain.addEventListener('click', startBattle);
function resetBattleForSelectedUnit() {
  if (battle.running) return;
  battleRound.hidden = true;
  battleAgain.hidden = true;
  battleVisual.replaceChildren();
  battleFeedback.textContent = '';
  updateBattleProgress();
}
battleUnitSelect.addEventListener('change', resetBattleForSelectedUnit);
document.querySelector('#study-unit-select').addEventListener('change', resetBattleForSelectedUnit);
battleForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!battle.running) return;
  const answer = battleAnswer.value.trim();
  const numericAnswer = Number(answer.replace(/(?:도|개|점)$/, '').replace(',', '.'));
  const numericTarget = Number(String(battle.question.answer).replace(/(?:도|개|점)$/, ''));
  const correct = normalizeAnswer(answer) === normalizeAnswer(String(battle.question.answer))
    || (Number.isFinite(numericAnswer) && Number.isFinite(numericTarget) && numericAnswer === numericTarget);
  if (!correct) {
    battleOptions.querySelectorAll('button').forEach((option) => {
      if (normalizeAnswer(option.dataset.battleAnswer) === normalizeAnswer(answer)) option.classList.add('is-wrong');
      if (normalizeAnswer(option.dataset.battleAnswer) === normalizeAnswer(String(battle.question.answer))) option.classList.add('is-right');
    });
    battle.attempts.push({ value: answer, correct: false });
    finishBattle('wrong');
    return;
  }
  battleOptions.querySelectorAll('button').forEach((option) => {
    if (normalizeAnswer(option.dataset.battleAnswer) === normalizeAnswer(String(battle.question.answer))) option.classList.add('is-right');
  });
  battle.attempts.push({ value: answer, correct: true });
  if ((Date.now() - battle.startedAt) / 1000 < battle.aiSeconds) finishBattle('student');
  else finishBattle('ai');
});

updateBattleProgress();
window.setInterval(() => {
  if (studentSession && !studentApp.hidden && !document.hidden) publishStudentActivity(currentStudentActivity);
  if (studentSession && currentStudentView === 'machine' && !document.hidden) void refreshMachineLabAccess();
  if (!teacherDashboard.hidden) {
    renderTeacherLive();
    if (Date.now() - lastTeacherRosterRefresh >= 60_000) {
      lastTeacherRosterRefresh = Date.now();
      void loadTeacherRoster();
    }
  }
}, 15_000);

renderStats();
void restoreSupabaseSession();
