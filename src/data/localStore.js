const STORAGE_KEY = "pilates-mobile-app-v13";

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
    courseThemes: [
      "核心增强",
      "脊柱灵活",
      "肩背改善",
      "髋膝踝",
      "柔韧提升",
      "平衡协调",
      "体态调整",
    ],
  },
  members: defaultMembers,
  templates: defaultTemplates,

  // v13：草稿改成多草稿，按「会员 + 课次」分别保存
  lessonDrafts: {},

  // v12 老字段保留兼容，读旧数据时会自动迁移
  lessonDraft: null,

  lessons: [],
  customActions: [],
  memberActionMemories: {},

  // 后续给动作收藏、标签、自定义动作覆盖层预留
  userActionMeta: {},
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

function getLessonDraftKey(memberName, lessonNumber) {
  const safeMemberName = String(memberName || "guest").trim() || "guest";
  const safeLessonNumber = Number(lessonNumber) || 1;

  return `${safeMemberName}__${safeLessonNumber}`;
}

function normalizeState(parsed = {}) {
  const oldSingleDraft = parsed.lessonDraft || null;
  const existingDrafts =
    parsed.lessonDrafts && typeof parsed.lessonDrafts === "object"
      ? parsed.lessonDrafts
      : {};

  const migratedDrafts = { ...existingDrafts };

  if (oldSingleDraft?.memberName && oldSingleDraft?.lessonNumber) {
    const oldDraftKey = getLessonDraftKey(
      oldSingleDraft.memberName,
      oldSingleDraft.lessonNumber
    );

    if (!migratedDrafts[oldDraftKey]) {
      migratedDrafts[oldDraftKey] = oldSingleDraft;
    }
  }

  return {
    ...defaultState,
    ...parsed,
    settings: {
      ...defaultState.settings,
      ...(parsed.settings || {}),
    },
    members:
      Array.isArray(parsed.members) && parsed.members.length
        ? parsed.members
        : defaultMembers,
    templates:
      Array.isArray(parsed.templates) && parsed.templates.length
        ? parsed.templates
        : defaultTemplates,
    lessons: Array.isArray(parsed.lessons) ? parsed.lessons : [],
    customActions: Array.isArray(parsed.customActions) ? parsed.customActions : [],
    memberActionMemories:
      parsed.memberActionMemories && typeof parsed.memberActionMemories === "object"
        ? parsed.memberActionMemories
        : {},
    lessonDrafts: migratedDrafts,
    lessonDraft: oldSingleDraft,
    userActionMeta:
      parsed.userActionMeta && typeof parsed.userActionMeta === "object"
        ? parsed.userActionMeta
        : {},
  };
}

function readState() {
  if (!canUseLocalStorage()) return defaultState;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      const oldRaw = window.localStorage.getItem("pilates-mobile-app-v12");

      if (!oldRaw) return defaultState;

      const oldParsed = JSON.parse(oldRaw);
      const migratedState = normalizeState(oldParsed);

      writeState(migratedState);
      return migratedState;
    }

    const parsed = JSON.parse(raw);
    return normalizeState(parsed);
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

export function getLessonsByMember(memberName) {
  const current = readState();
  const safeMemberName = String(memberName || "").trim();

  if (!safeMemberName) return [];

  return current.lessons
    .filter((lesson) => (lesson.memberName || "") === safeMemberName)
    .sort((a, b) => Number(a.lessonNumber || 0) - Number(b.lessonNumber || 0));
}

export function getTemplates() {
  return readState().templates;
}

export function getCustomActions() {
  return readState().customActions || [];
}

export function saveCustomAction(action) {
  const current = readState();

  const cleanCnName = String(action.cnName || action.name || "").trim();
  const cleanName = String(action.name || cleanCnName).trim();
  const cleanBenefit = String(action.defaultBenefit || action.benefit || "").trim();

  const nextAction = {
    id: action.id || createId("custom-action"),
    source: "custom",
    apparatus: action.apparatus || "M",
    cnName: cleanCnName,
    name: cleanName,
    defaultBenefit: cleanBenefit,
    benefits: cleanBenefit ? cleanBenefit.split(/[;；]/).map((item) => item.trim()).filter(Boolean) : [],
    createdAt: action.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const nextState = {
    ...current,
    customActions: [
      nextAction,
      ...(current.customActions || []).filter((item) => item.id !== nextAction.id),
    ],
  };

  writeState(nextState);
  return nextAction;
}

function getMemberActionMemoryKey(memberName, actionIdentityKey) {
  const safeMemberName = String(memberName || "guest").trim() || "guest";
  const safeActionKey = String(actionIdentityKey || "").trim();

  return `${safeMemberName}__${safeActionKey}`;
}

export function getMemberActionMemory(memberName, actionIdentityKey) {
  if (!memberName || !actionIdentityKey) return null;

  const current = readState();
  const memoryKey = getMemberActionMemoryKey(memberName, actionIdentityKey);

  return current.memberActionMemories?.[memoryKey] || null;
}

export function saveMemberActionMemory({
  memberName,
  actionIdentityKey,
  cnName = "",
  name = "",
  benefit = "",
}) {
  if (!memberName || !actionIdentityKey) return null;

  const current = readState();
  const memoryKey = getMemberActionMemoryKey(memberName, actionIdentityKey);

  const nextMemory = {
    memberName,
    actionIdentityKey,
    cnName,
    name,
    benefit,
    updatedAt: new Date().toISOString(),
  };

  const nextState = {
    ...current,
    memberActionMemories: {
      ...(current.memberActionMemories || {}),
      [memoryKey]: nextMemory,
    },
  };

  writeState(nextState);
  return nextMemory;
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

  const draftWithTime = {
    ...lessonDraft,
    updatedAt: new Date().toISOString(),
  };

  const draftKey = getLessonDraftKey(
    draftWithTime.memberName,
    draftWithTime.lessonNumber
  );

  const nextState = {
    ...current,
    lessonDrafts: {
      ...(current.lessonDrafts || {}),
      [draftKey]: draftWithTime,
    },

    // 兼容旧逻辑：保留最近一份草稿
    lessonDraft: draftWithTime,
  };

  writeState(nextState);
  return draftWithTime;
}

export function getLessonDraft() {
  return readState().lessonDraft;
}

export function getLessonDraftForMemberAndNumber(memberName, lessonNumber) {
  const current = readState();
  const draftKey = getLessonDraftKey(memberName, lessonNumber);

  return current.lessonDrafts?.[draftKey] || null;
}

export function getLessonByMemberAndNumber(memberName, lessonNumber) {
  const current = readState();

  return current.lessons.find((lesson) => {
    const sameMember = (lesson.memberName || "") === (memberName || "");
    const sameLesson = Number(lesson.lessonNumber) === Number(lessonNumber);

    return sameMember && sameLesson;
  });
}

export function clearLessonDraft(memberName, lessonNumber) {
  const current = readState();

  // 如果没有传会员和课次，就兼容旧用法：清掉最近草稿
  if (!memberName || !lessonNumber) {
    const nextState = {
      ...current,
      lessonDraft: null,
    };

    writeState(nextState);
    return nextState;
  }

  const draftKey = getLessonDraftKey(memberName, lessonNumber);
  const nextDrafts = { ...(current.lessonDrafts || {}) };

  delete nextDrafts[draftKey];

  const nextState = {
    ...current,
    lessonDrafts: nextDrafts,
    lessonDraft: null,
  };

  writeState(nextState);
  return nextState;
}

export function saveLesson(lesson) {
  const current = readState();

  const savedLesson = {
    ...lesson,
    id: lesson.id || createId("lesson"),
    savedAt: new Date().toISOString(),
  };

  const draftKey = getLessonDraftKey(
    savedLesson.memberName,
    savedLesson.lessonNumber
  );

  const nextDrafts = { ...(current.lessonDrafts || {}) };
  delete nextDrafts[draftKey];

  const nextMembers = (current.members || []).map((member) => {
    const sameMember = (member.name || "") === (savedLesson.memberName || "");
    const savedLessonNumber = Number(savedLesson.lessonNumber || 0);
    const currentLessons = Number(member.lessons || 0);

    if (!sameMember || savedLessonNumber <= currentLessons) return member;

    return {
      ...member,
      lessons: savedLessonNumber,
      lastDate: savedLesson.lessonDate || member.lastDate || "",
    };
  });

  const nextState = {
    ...current,
    members: nextMembers,
    lessonDrafts: nextDrafts,
    lessonDraft: null,
    lessons: [
      savedLesson,
      ...current.lessons.filter((item) => {
        const sameId = item.id === savedLesson.id;
        const sameMember = (item.memberName || "") === (savedLesson.memberName || "");
        const sameLesson = Number(item.lessonNumber) === Number(savedLesson.lessonNumber);

        return !sameId && !(sameMember && sameLesson);
      }),
    ],
  };

  writeState(nextState);
  return savedLesson;
}

export function resetLocalData() {
  writeState(defaultState);
  return defaultState;
}
