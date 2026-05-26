import { starterActions } from "./starterActions";
import { baseActionsFull } from "./baseActionsFull";

// 临时模拟：以后这些会来自 Supabase 或本地账号数据
const userCustomActions = [];
const userActionOverrides = {};
const userActionUsage = {};
const userFavorites = new Set();

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function createSafeId(prefix = "selected") {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getPrimaryName(action, languagePreference = "mixed") {
  if (languagePreference === "english") {
    return action.name || action.cnName;
  }

  if (languagePreference === "chinese") {
    return action.cnName || action.name;
  }

  return action.cnName || action.name;
}

function getSecondaryName(action, languagePreference = "mixed") {
  if (languagePreference === "english") {
    return action.cnName || "";
  }

  if (languagePreference === "chinese") {
    return action.name || "";
  }

  return action.name || "";
}

function getSearchDisplayName(action, languagePreference = "mixed") {
  const primaryName = getPrimaryName(action, languagePreference);
  const secondaryName = getSecondaryName(action, languagePreference);

  if (!primaryName) return secondaryName;
  if (!secondaryName) return primaryName;
  if (primaryName === secondaryName) return primaryName;

  if (languagePreference === "english") {
    return `${primaryName} / ${secondaryName}`;
  }

  return `${primaryName} / ${secondaryName}`;
}

function getLessonDisplayName(action, languagePreference = "mixed") {
  if (languagePreference === "mixed") {
    return getSearchDisplayName(action, languagePreference);
  }

  return getPrimaryName(action, languagePreference);
}

function getPosterDisplayName(action, languagePreference = "mixed") {
  if (languagePreference === "mixed") {
    return getSearchDisplayName(action, languagePreference);
  }

  return getPrimaryName(action, languagePreference);
}

function applyUserOverride(action) {
  const override = userActionOverrides[action.id];

  if (!override) return action;

  return {
    ...action,
    ...override,
    benefits: override.benefits || action.benefits,
    defaultBenefit: override.defaultBenefit || action.defaultBenefit,
  };
}

function mergeActionsWithoutDuplicates(actions) {
  const map = new Map();

  actions.forEach((action) => {
    const normalizedName = normalizeText(action.name);
    const normalizedCnName = normalizeText(action.cnName);
    const key = `${action.apparatus}-${normalizedName}-${normalizedCnName}`;

    if (!map.has(key)) {
      map.set(key, {
        ...action,
        name: action.name?.trim() || "",
        cnName: action.cnName?.trim() || "",
      });
      return;
    }

    const existing = map.get(key);

    map.set(key, {
      ...existing,
      cnName: existing.cnName || action.cnName,
      name: existing.name || action.name,
      benefits: existing.benefits?.length ? existing.benefits : action.benefits,
      defaultBenefit: existing.defaultBenefit || action.defaultBenefit,
      source: existing.source === "starter" ? existing.source : action.source,
    });
  });

  return Array.from(map.values());
}

function getUsageScore(action) {
  return userActionUsage[action.id]?.last30DaysCount || 0;
}

function getRecommendationScore(action) {
  const usageScore = getUsageScore(action) * 100;
  const favoriteScore = userFavorites.has(action.id) || action.isFavorite ? 1000 : 0;
  const customScore = action.source === "custom" ? 800 : 0;
  const starterScore = action.source === "starter" ? 200 : 0;

  return favoriteScore + customScore + usageScore + starterScore;
}

export function getAllActions() {
  return mergeActionsWithoutDuplicates([
    ...userCustomActions,
    ...starterActions,
    ...baseActionsFull,
  ]).map(applyUserOverride);
}

export function searchActions({
  keyword = "",
  apparatus = "all",
  languagePreference = "mixed",
} = {}) {
  const normalizedKeyword = normalizeText(keyword);

  return getAllActions()
    .filter((action) => {
      if (apparatus === "all") return true;

      if (apparatus === "favorite") {
        return userFavorites.has(action.id) || action.isFavorite;
      }

      return action.apparatus === apparatus;
    })
    .filter((action) => {
      if (!normalizedKeyword) return true;

      return (
        normalizeText(action.name).includes(normalizedKeyword) ||
        normalizeText(action.cnName).includes(normalizedKeyword) ||
        normalizeText(action.defaultBenefit).includes(normalizedKeyword)
      );
    })
    .sort((a, b) => getRecommendationScore(b) - getRecommendationScore(a))
    .map((action) => ({
      ...action,
      displayName: getSearchDisplayName(action, languagePreference),
      lessonName: getLessonDisplayName(action, languagePreference),
      posterName: getPosterDisplayName(action, languagePreference),
    }));
}

export function findBestActionMatch({ apparatus = "all", keyword = "", languagePreference = "mixed" }) {
  const normalizedKeyword = normalizeText(keyword);

  if (!normalizedKeyword) return null;

  const candidates = searchActions({
    keyword: "",
    apparatus,
    languagePreference,
  });

  const exactMatch = candidates.find((action) => {
    return (
      normalizeText(action.cnName) === normalizedKeyword ||
      normalizeText(action.name) === normalizedKeyword ||
      normalizeText(action.displayName) === normalizedKeyword
    );
  });

  if (exactMatch) return exactMatch;

  const includesMatch = candidates.find((action) => {
    return (
      normalizeText(action.cnName).includes(normalizedKeyword) ||
      normalizeText(action.name).includes(normalizedKeyword) ||
      normalizeText(action.displayName).includes(normalizedKeyword) ||
      normalizedKeyword.includes(normalizeText(action.cnName)) ||
      normalizedKeyword.includes(normalizeText(action.name))
    );
  });

  if (includesMatch) return includesMatch;

  const benefitMatch = candidates.find((action) =>
    normalizeText(action.defaultBenefit).includes(normalizedKeyword)
  );

  return benefitMatch || null;
}

export function createSelectedLessonAction(action) {
  return {
    id: createSafeId("selected-action"),
    baseActionId: action.id,
    name: action.lessonName || action.cnName || action.name,
    posterName: action.posterName || action.lessonName || action.cnName || action.name,
    rawName: action.name,
    cnName: action.cnName,
    apparatus: action.apparatus,
    benefit: action.defaultBenefit || "",
    comment: action.comment || "",
  };
}

export function createTemporaryLessonAction({
  apparatus = "M",
  name = "",
  comment = "",
}) {
  return {
    id: createSafeId("temporary-action"),
    baseActionId: "",
    name,
    posterName: name,
    rawName: name,
    cnName: name,
    apparatus,
    benefit: "",
    comment,
    isTemporary: true,
  };
}
