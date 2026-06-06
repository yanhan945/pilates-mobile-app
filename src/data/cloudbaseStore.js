import { getAppData, saveSettings } from "./localStore";
import { getCloudBaseCurrentUser, getCloudBaseDb } from "./cloudbaseClient";

const COLLECTIONS = {
  studioSettings: "studio_settings",
  members: "members",
  lessons: "lessons",
  templates: "course_templates",
  userActionMeta: "user_action_meta",
  actionUsage: "action_usage",
};

function nowIso() {
  return new Date().toISOString();
}

function getRows(result) {
  if (Array.isArray(result?.data)) return result.data;
  if (Array.isArray(result?.data?.data)) return result.data.data;
  return [];
}

function withoutCloudId(row = {}) {
  const rest = { ...row };
  delete rest._id;
  delete rest.id;
  return rest;
}

export async function getCurrentUser() {
  return getCloudBaseCurrentUser();
}

async function getCloudContext() {
  const user = await getCurrentUser();
  const db = user ? getCloudBaseDb() : null;

  if (!db || !user) {
    return { db: null, user, ready: false };
  }

  return { db, user, ready: true };
}

async function queryOwn(collectionName, user, extraQuery = {}) {
  const db = getCloudBaseDb();
  if (!db || !user) return [];

  const result = await db
    .collection(collectionName)
    .where({
      user_id: user.id,
      ...extraQuery,
    })
    .get();

  return getRows(result);
}

async function upsertOwn(collectionName, user, uniqueQuery, payload) {
  const db = getCloudBaseDb();
  if (!db || !user) {
    throw new Error("CloudBase 未配置或未登录");
  }

  const collection = db.collection(collectionName);
  const query = {
    user_id: user.id,
    ...uniqueQuery,
  };
  const rows = getRows(await collection.where(query).get());
  const existing = rows[0];
  const timestamp = nowIso();
  const document = {
    user_id: user.id,
    email: user.email || "",
    ...payload,
    updated_at: timestamp,
  };

  if (existing?._id) {
    await collection.doc(existing._id).update(withoutCloudId(document));
    return {
      ...existing,
      ...document,
    };
  }

  const createDocument = {
    ...document,
    created_at: timestamp,
  };
  const addResult = await collection.add(createDocument);

  return {
    _id: addResult?.id || addResult?._id,
    ...createDocument,
  };
}

function toStudioDocument(settings) {
  return {
    studio_name_cn: settings.studioNameCn || "",
    studio_name_en: settings.studioNameEn || "",
    coach_name: settings.coachName || "",
    logo_data_url: settings.logoDataUrl || "",
    language_preference: settings.languagePreference || "chinese",
  };
}

function fromStudioDocument(row = {}) {
  return {
    studioNameCn: row.studio_name_cn || "",
    studioNameEn: row.studio_name_en || "",
    coachName: row.coach_name || "",
    logoDataUrl: row.logo_data_url || row.logo_url || "",
    languagePreference: row.language_preference || "chinese",
  };
}

export async function loadCloudStudioSettings() {
  const localSettings = getAppData().settings || {};
  const { user, ready } = await getCloudContext();

  if (!user || !ready) {
    return {
      user: user || null,
      settings: localSettings,
      source: "local",
    };
  }

  try {
    const rows = await queryOwn(COLLECTIONS.studioSettings, user);
    const cloudRow = rows[0];

    if (!cloudRow) {
      return {
        user,
        settings: localSettings,
        source: "empty",
      };
    }

    const cloudSettings = fromStudioDocument(cloudRow);
    saveSettings(cloudSettings);

    return {
      user,
      settings: cloudSettings,
      source: "cloud",
    };
  } catch (error) {
    console.warn("读取 CloudBase 工作室信息失败，继续使用本机数据", error);

    return {
      user,
      settings: localSettings,
      source: "cloud-error",
      error,
    };
  }
}

export async function saveCloudStudioSettings(settings) {
  const localSettings = saveSettings(settings);
  const { user, ready } = await getCloudContext();

  if (!user || !ready) {
    return {
      user: user || null,
      settings: localSettings,
      status: "local",
    };
  }

  try {
    const row = await upsertOwn(
      COLLECTIONS.studioSettings,
      user,
      {},
      toStudioDocument(localSettings)
    );

    const cloudSettings = fromStudioDocument(row);
    saveSettings(cloudSettings);

    return {
      user,
      settings: cloudSettings,
      status: "cloud",
    };
  } catch (error) {
    console.warn("同步 CloudBase 工作室信息失败，本机数据已保存", error);

    return {
      user,
      settings: localSettings,
      status: "cloud-error",
      error,
    };
  }
}

export async function loadCloudMembers() {
  const user = await getCurrentUser();
  if (!user) return [];
  return queryOwn(COLLECTIONS.members, user);
}

export async function saveCloudMember(member) {
  const user = await getCurrentUser();
  const memberId = member.member_id || member.id || member.name;

  return upsertOwn(COLLECTIONS.members, user, { member_id: memberId }, {
    member_id: memberId,
    name: member.name || "",
    phone: member.phone || "",
    goal: member.goal || "",
    lessons_count: Number(member.lessons || member.lessons_count || 0),
    last_date: member.lastDate || member.last_date || "",
  });
}

export async function loadCloudLessons() {
  const user = await getCurrentUser();
  if (!user) return [];
  return queryOwn(COLLECTIONS.lessons, user);
}

export async function saveCloudLesson(lesson) {
  const user = await getCurrentUser();
  const lessonId = lesson.lesson_id || lesson.id;

  return upsertOwn(COLLECTIONS.lessons, user, { lesson_id: lessonId }, {
    lesson_id: lessonId,
    member_id: lesson.memberId || lesson.member_id || lesson.memberName || "",
    member_name: lesson.memberName || lesson.member_name || "",
    lesson_number: Number(lesson.lessonNumber || lesson.lesson_number || 1),
    lesson_date: lesson.lessonDate || lesson.lesson_date || "",
    weather: lesson.weather || "",
    lesson_theme: lesson.lessonTheme || lesson.lesson_theme || "",
    poster_theme: lesson.posterTheme || lesson.poster_theme || "",
    actions: Array.isArray(lesson.actions) ? lesson.actions : [],
    summary: lesson.summary || "",
  });
}

export async function loadCloudTemplates() {
  const user = await getCurrentUser();
  if (!user) return [];
  return queryOwn(COLLECTIONS.templates, user);
}

export async function saveCloudTemplate(template) {
  const user = await getCurrentUser();
  const templateId = template.template_id || template.id || template.name;

  return upsertOwn(COLLECTIONS.templates, user, { template_id: templateId }, {
    template_id: templateId,
    name: template.name || "",
    desc: template.desc || "",
    actions: Array.isArray(template.actions) ? template.actions : [],
  });
}

export async function loadUserActionMeta() {
  const user = await getCurrentUser();
  if (!user) return [];
  return queryOwn(COLLECTIONS.userActionMeta, user);
}

export async function saveUserActionMeta(meta) {
  const user = await getCurrentUser();

  return upsertOwn(COLLECTIONS.userActionMeta, user, { action_id: meta.action_id || meta.id }, {
    action_id: meta.action_id || meta.id,
    is_favorite: Boolean(meta.is_favorite),
    tags: Array.isArray(meta.tags) ? meta.tags : [],
    custom_cn_name: meta.custom_cn_name || "",
    custom_en_name: meta.custom_en_name || "",
    custom_benefit: meta.custom_benefit || "",
    is_hidden: Boolean(meta.is_hidden),
    is_custom_action: Boolean(meta.is_custom_action),
    apparatus: meta.apparatus || "",
  });
}

export async function loadActionUsage() {
  const user = await getCurrentUser();
  if (!user) return [];
  return queryOwn(COLLECTIONS.actionUsage, user);
}

export async function recordActionUsage(actionId) {
  const user = await getCurrentUser();
  const rows = await queryOwn(COLLECTIONS.actionUsage, user, { action_id: actionId });
  const current = rows[0];

  return upsertOwn(COLLECTIONS.actionUsage, user, { action_id: actionId }, {
    action_id: actionId,
    used_count: Number(current?.used_count || 0) + 1,
    last_used_at: nowIso(),
  });
}
