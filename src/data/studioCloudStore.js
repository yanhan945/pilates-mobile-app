import { getAppData, saveSettings } from "./localStore";
import { supabase } from "./supabaseClient";

const STUDIO_SETTINGS_COLUMNS =
  "user_id, studio_name_cn, studio_name_en, coach_name, logo_data_url, language_preference, updated_at";

function toCloudRow(settings, userId) {
  return {
    user_id: userId,
    studio_name_cn: settings.studioNameCn || "",
    studio_name_en: settings.studioNameEn || "",
    coach_name: settings.coachName || "",
    logo_data_url: settings.logoDataUrl || "",
    language_preference: settings.languagePreference || "chinese",
    updated_at: new Date().toISOString(),
  };
}

function fromCloudRow(row) {
  return {
    studioNameCn: row.studio_name_cn || "",
    studioNameEn: row.studio_name_en || "",
    coachName: row.coach_name || "",
    logoDataUrl: row.logo_data_url || "",
    languagePreference: row.language_preference || "chinese",
  };
}

export async function getCurrentUser() {
  try {
    const { data, error } = await supabase.auth.getUser();

    if (error) {
      return null;
    }

    return data.user || null;
  } catch (error) {
    console.warn("读取当前账号失败，继续使用本机数据", error);
    return null;
  }
}

export async function loadCloudStudioSettings() {
  const localSettings = getAppData().settings || {};
  const user = await getCurrentUser();

  if (!user) {
    return {
      user: null,
      settings: localSettings,
      source: "local",
    };
  }

  const { data, error } = await supabase
    .from("studio_settings")
    .select(STUDIO_SETTINGS_COLUMNS)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.warn("读取云端工作室信息失败，继续使用本机数据", error);

    return {
      user,
      settings: localSettings,
      source: "cloud-error",
      error,
    };
  }

  if (!data) {
    return {
      user,
      settings: localSettings,
      source: "empty",
    };
  }

  const cloudSettings = fromCloudRow(data);
  saveSettings(cloudSettings);

  return {
    user,
    settings: cloudSettings,
    source: "cloud",
  };
}

export async function saveCloudStudioSettings(settings) {
  const localSettings = saveSettings(settings);
  const user = await getCurrentUser();

  if (!user) {
    return {
      user: null,
      settings: localSettings,
      status: "local",
    };
  }

  const { data, error } = await supabase
    .from("studio_settings")
    .upsert(toCloudRow(localSettings, user.id), { onConflict: "user_id" })
    .select(STUDIO_SETTINGS_COLUMNS)
    .single();

  if (error) {
    console.warn("同步云端工作室信息失败，本机数据已保存", error);

    return {
      user,
      settings: localSettings,
      status: "cloud-error",
      error,
    };
  }

  const cloudSettings = data ? fromCloudRow(data) : localSettings;
  saveSettings(cloudSettings);

  return {
    user,
    settings: cloudSettings,
    status: "cloud",
  };
}
