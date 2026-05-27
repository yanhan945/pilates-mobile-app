const STORAGE_KEY = "pilates-mobile-app-v12";

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
];

const defaultTemplates = [
  {
    id: "template-core",
    name: "核心增强",
    desc: "核心激活、骨盆稳定、躯干控制",
    actions: [
      { apparatus: "M", keyword: "死虫式" },
      { apparatus: "M", keyword: "百次拍击" },
      { apparatus: "R", keyword: "蹬腿系列" },
    ],
  },
  {
    id: "template-neck-shoulder",
    name: "肩颈理疗",
    desc: "放松肩颈、打开胸廓、改善圆肩紧张",
    actions: [
      { apparatus: "M", keyword: "稻草人" },
      { apparatus: "R", keyword: "手臂弧系列" },
      { apparatus: "R", keyword: "坐姿手臂后拉系列" },
    ],
  },
];

const defaultState = {
  settings: {
    languagePreference: "chinese",
    studioNameCn: "北极星普拉提",
    studioNameEn: "Polaris Pilates",
    coachName: "严老师",
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

function createId(prefix) {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readState() {
  if (!canUseLocalStorage()) return defaultState;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) return defaultState;

    const parsed = JSON.parse(raw);

    return {
      ...defaultState,
      ...parsed,
      settings: {
        ...defaultState.settings,
        ...(parsed.settings || {}),
      },
      members: Array.isArray(parsed.members) && parsed.members.length
        ? parsed.members
        : defaultMembers,
      templates: Array.isArray(parsed.templates) && parsed.templates.length
        ? parsed.templates
        : defaultTemplates,
      lessons: Array.isArray(parsed.lessons) ? parsed.lessons : [],
      lessonDraft: parsed.lessonDraft || null,
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

export function getMembers() {
  return readState().members;
}

export function getTemplates() {
  return readState().templates;
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

export function saveTemplate(template) {
  const current = readState();

  const nextTemplate = {
    id: template.id || createId("template"),
    name: template.name || "未命名模板",
    desc: template.desc || "",
    actions: Array.isArray(template.actions) ? template.actions : [],
  };

  const nextState = {
    ...current,
    templates: [
      nextTemplate,
      ...current.templates.filter((item) => item.id !== nextTemplate.id),
    ],
  };

  writeState(nextState);
  return nextState.templates;
}

export function deleteTemplate(templateId) {
  const current = readState();

  const nextState = {
    ...current,
    templates: current.templates.filter((template) => template.id !== templateId),
  };

  writeState(nextState);
  return nextState.templates;
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
    id: lesson.id || createId("lesson"),
    savedAt: new Date().toISOString(),
  };

  const nextState = {
    ...current,
    lessonDraft: savedLesson,
    lessons: [
      savedLesson,
      ...current.lessons.filter((item) => item.id !== savedLesson.id),
    ],
  };

  writeState(nextState);
  return savedLesson;
}

export function resetLocalData() {
  writeState(defaultState);
  return defaultState;
}
