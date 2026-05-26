const STORAGE_KEY = "pilates-mobile-app-v1";

const defaultMembers = [
  {
    name: "丽容",
    phone: "",
    goal: "减脂 / 改善僵硬",
    lessons: 18,
    lastDate: "5月22日",
  },
  {
    name: "张小美",
    phone: "138****8000",
    goal: "塑形翘臀",
    lessons: 4,
    lastDate: "5月15日",
  },
  {
    name: "陈思思",
    phone: "136****5432",
    goal: "改善久坐不适",
    lessons: 0,
    lastDate: "暂无记录",
  },
  {
    name: "李娜",
    phone: "138****2222",
    goal: "康复训练",
    lessons: 6,
    lastDate: "5月10日",
  },
];

const defaultTemplates = [
  {
    id: "template-neck-shoulder",
    name: "肩颈理疗",
    desc: "放松肩颈、打开胸廓、改善圆肩紧张",
    actions: [
      { apparatus: "M", keyword: "翻书" },
      { apparatus: "M", keyword: "稻草人" },
      { apparatus: "R", keyword: "手臂弧" },
      { apparatus: "R", keyword: "坐姿手臂后拉" },
      { apparatus: "TT", keyword: "坐姿高位下拉" },
      { apparatus: "SC", keyword: "翻书" },
    ],
  },
  {
    id: "template-core",
    name: "核心增强",
    desc: "核心激活、骨盆稳定、躯干控制",
    actions: [
      { apparatus: "M", keyword: "死虫" },
      { apparatus: "M", keyword: "百次" },
      { apparatus: "R", keyword: "平板支撑" },
      { apparatus: "R", keyword: "卷腹" },
      { apparatus: "R", keyword: "蹬腿" },
      { apparatus: "SC", keyword: "V字" },
    ],
  },
  {
    id: "template-hip-leg",
    name: "翘臀塑形",
    desc: "臀腿激活、髋稳定、下肢控制",
    actions: [
      { apparatus: "M", keyword: "臀桥" },
      { apparatus: "M", keyword: "蚌式" },
      { apparatus: "R", keyword: "腿绳索" },
      { apparatus: "R", keyword: "腿画圈" },
      { apparatus: "R", keyword: "摩托" },
      { apparatus: "LB", keyword: "天鹅" },
    ],
  },
];

const defaultState = {
  settings: {
    languagePreference: "chinese",
    studioName: "北极星普拉提",
    logoDataUrl: "",
  },
  members: defaultMembers,
  templates: defaultTemplates,
  lessonDraft: null,
  lessons: [],
};

function canUseLocalStorage() {
  return typeof window !== "undefined" && window.localStorage;
}

function readState() {
  if (!canUseLocalStorage()) return defaultState;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState;

    return {
      ...defaultState,
      ...JSON.parse(raw),
    };
  } catch (error) {
    console.warn("读取本地数据失败，已使用默认数据", error);
    return defaultState;
  }
}

function writeState(nextState) {
  if (!canUseLocalStorage()) return;

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
}

export function getAppData() {
  return readState();
}

export function saveSettings(settings) {
  const current = readState();
  const nextState = {
    ...current,
    settings: {
      ...current.settings,
      ...settings,
    },
  };

  writeState(nextState);
  return nextState.settings;
}

export function getMembers() {
  return readState().members;
}

export function getTemplates() {
  return readState().templates;
}

export function saveLessonDraft(lessonDraft) {
  const current = readState();
  const nextState = {
    ...current,
    lessonDraft: {
      ...lessonDraft,
      updatedAt: new Date().toISOString(),
    },
  };

  writeState(nextState);
  return nextState.lessonDraft;
}

export function getLessonDraft() {
  return readState().lessonDraft;
}

export function saveLesson(lesson) {
  const current = readState();
  const savedLesson = {
    ...lesson,
    id: lesson.id || `lesson-${Date.now()}`,
    savedAt: new Date().toISOString(),
  };

  const nextState = {
    ...current,
    lessonDraft: savedLesson,
    lessons: [savedLesson, ...current.lessons.filter((item) => item.id !== savedLesson.id)],
  };

  writeState(nextState);
  return savedLesson;
}

export function resetLocalData() {
  writeState(defaultState);
  return defaultState;
}
