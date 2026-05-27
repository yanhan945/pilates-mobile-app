import { starterActions } from "./starterActions";
import { baseActionsFull } from "./baseActionsFull";

const userCustomActions = [];
const userActionOverrides = {};
const userActionUsage = {};
const userFavorites = new Set();

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function compactText(value) {
  return normalizeText(value).replace(/[\/\-\s（）()·+＋]/g, "");
}

function createSafeId(prefix = "selected") {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function getActionIdentityKey(action) {
  return [
    action.apparatus || "",
    compactText(action.cnName || ""),
    compactText(action.name || ""),
  ].join("|");
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

  if (!override) return action;

  return {
    ...action,
    ...override,
    benefits: override.benefits || action.benefits,
    defaultBenefit: override.defaultBenefit || action.defaultBenefit,
  };
}

function cleanAction(action) {
  const benefits = Array.isArray(action.benefits)
    ? action.benefits
    : action.defaultBenefit
      ? String(action.defaultBenefit).split("；").filter(Boolean)
      : [];

  return {
    ...action,
    id: action.id || `${action.source || "action"}-${action.apparatus || "other"}-${compactText(action.cnName || action.name)}`,
    source: action.source || "full",
    apparatus: action.apparatus || action.equipment_code || action.category || "",
    name: action.name?.trim() || action.nameEn?.trim() || "",
    cnName: action.cnName?.trim() || action.nameCn?.trim() || "",
    benefits,
    defaultBenefit: action.defaultBenefit || action.benefitsText || benefits.join("；") || "",
  };
}

function mergeActionsWithoutDuplicates(actions) {
  const map = new Map();

  actions.forEach((rawAction) => {
    const action = cleanAction(rawAction);

    const key = `${action.apparatus}-${compactText(action.name)}-${compactText(action.cnName)}`;

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
  const favoriteScore = userFavorites.has(action.id) || action.isFavorite ? 1000 : 0;
  const customScore = action.source === "custom" ? 800 : 0;
  const starterScore = action.source === "starter" ? 300 : 0;

  return favoriteScore + customScore + usageScore + starterScore;
}

function attachDisplayFields(action, languagePreference) {
  return {
    ...action,
    identityKey: getActionIdentityKey(action),
    displayName: getSearchDisplayName(action, languagePreference),
    lessonName: getLessonDisplayName(action, languagePreference),
    posterName: getPosterDisplayName(action, languagePreference),
  };
}

export function getAllActions(languagePreference = "mixed") {
  return mergeActionsWithoutDuplicates([
    ...userCustomActions,
    ...starterActions,
    ...baseActionsFull,
  ])
    .map(applyUserOverride)
    .map((action) => attachDisplayFields(action, languagePreference));
}

export function searchActions({
  keyword = "",
  apparatus = "all",
  languagePreference = "mixed",
} = {}) {
  const normalizedKeyword = normalizeText(keyword);
  const compactKeyword = compactText(keyword);

  return getAllActions(languagePreference)
    .filter((action) => {
      if (apparatus === "all") return true;

      if (apparatus === "favorite") {
        return userFavorites.has(action.id) || action.isFavorite;
      }

      return action.apparatus === apparatus;
    })
    .filter((action) => {
      if (!normalizedKeyword) return true;

      const searchableText = [
        action.name,
        action.cnName,
        action.displayName,
        action.defaultBenefit,
        ...(action.benefits || []),
      ].join(" ");

      return (
        normalizeText(searchableText).includes(normalizedKeyword) ||
        compactText(searchableText).includes(compactKeyword)
      );
    })
    .sort((a, b) => getRecommendationScore(b) - getRecommendationScore(a));
}

export function findBestActionMatch({
  apparatus = "all",
  keyword = "",
  languagePreference = "mixed",
}) {
  const normalizedKeyword = normalizeText(keyword);
  const compactKeyword = compactText(keyword);

  if (!normalizedKeyword) return null;

  const candidates = getAllActions(languagePreference).filter((action) => {
    if (apparatus === "all") return true;
    return action.apparatus === apparatus;
  });

  const exactMatch = candidates.find((action) => {
    return (
      normalizeText(action.cnName) === normalizedKeyword ||
      normalizeText(action.name) === normalizedKeyword ||
      normalizeText(action.displayName) === normalizedKeyword ||
      compactText(action.cnName) === compactKeyword ||
      compactText(action.name) === compactKeyword ||
      compactText(action.displayName) === compactKeyword
    );
  });

  if (exactMatch) return exactMatch;

  const includesMatch = candidates.find((action) => {
    const names = [action.cnName, action.name, action.displayName].filter(Boolean);

    return names.some((name) => {
      const compactName = compactText(name);

      return (
        normalizeText(name).includes(normalizedKeyword) ||
        normalizedKeyword.includes(normalizeText(name)) ||
        compactName.includes(compactKeyword) ||
        compactKeyword.includes(compactName)
      );
    });
  });

  if (includesMatch) return includesMatch;

  const looseMatch = candidates.find((action) => {
    const searchableText = [
      action.name,
      action.cnName,
      action.displayName,
      action.defaultBenefit,
      ...(action.benefits || []),
    ].join(" ");

    return compactText(searchableText).includes(compactKeyword);
  });

  return looseMatch || null;
}

export function createSelectedLessonAction(action) {
  const cleanedAction = attachDisplayFields(cleanAction(action), "mixed");

  return {
    id: createSafeId("selected-action"),
    baseActionId: cleanedAction.id,
    identityKey: getActionIdentityKey(cleanedAction),
    name: action.lessonName || cleanedAction.lessonName || cleanedAction.cnName || cleanedAction.name,
    posterName: action.posterName || cleanedAction.posterName || cleanedAction.lessonName || cleanedAction.cnName || cleanedAction.name,
    rawName: cleanedAction.name,
    cnName: cleanedAction.cnName,
    apparatus: cleanedAction.apparatus,
    benefit: cleanedAction.defaultBenefit || "",
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
    identityKey: `${apparatus}|${compactText(name)}|temporary`,
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
