import { starterActions } from "./starterActions";
import { baseActionsFull } from "./baseActionsFull";

// 临时模拟：以后这些会来自本地存储或账号云同步
const userCustomActions = [];
const userActionOverrides = {};
const userActionUsage = {};
const userFavorites = new Set();

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
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

  if (!override) {
    return action;
  }

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
    const key = `${action.apparatus}-${normalizeText(action.name)}-${normalizeText(action.cnName)}`;

    if (!map.has(key)) {
      map.set(key, action);
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
  const favoriteScore = userFavorites.has(action.id) || action.isFavorite ? 50 : 0;
  const customScore = action.source === "custom" ? 80 : 0;
  const starterScore = action.source === "starter" ? 20 : 0;

  return usageScore + customScore + favoriteScore + starterScore;
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

export function createSelectedLessonAction(action) {
  return {
    id: `${action.id}-${Date.now()}`,
    baseActionId: action.id,
    name: action.lessonName || action.cnName || action.name,
    posterName: action.posterName || action.lessonName || action.cnName || action.name,
    rawName: action.name,
    cnName: action.cnName,
    apparatus: action.apparatus,
    benefit: action.defaultBenefit,
    comment: "",
  };
}