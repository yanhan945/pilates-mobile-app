import { starterActions } from "./starterActions";
import { baseActionsFull } from "./baseActionsFull";
import { getCustomActions, getUserActionMeta } from "./localStore";

const userCustomActions = [];
const userFavorites = new Set();

const tagAliasGroups = [
  ["臀腿", "臀部", "腿部", "翘臀", "美腿", "髋", "髋膝踝"],
  ["核心", "核心增强", "腹部", "腹肌", "骨盆稳定", "躯干"],
  ["肩颈", "肩背", "美背", "圆肩", "肩颈理疗", "肩胛"],
  ["柔韧", "柔韧性", "灵活", "活动度", "脊柱灵活"],
  ["平衡", "协调", "稳定", "体态", "体态调整"],
];

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function compactText(value) {
  return normalizeText(value).replace(/[/\s（）()·+＋-]/g, "");
}

function createSafeId(prefix = "selected") {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function getActionIdentityKey(action) {
  return [
    action?.apparatus || "",
    compactText(action?.cnName || ""),
    compactText(action?.name || ""),
  ].join("|");
}

function cleanAction(action) {
  const benefits = Array.isArray(action?.benefits)
    ? action.benefits
    : action?.defaultBenefit
      ? String(action.defaultBenefit).split("；").filter(Boolean)
      : [];

  return {
    id:
      action?.id ||
      `${action?.source || "action"}-${action?.apparatus || "other"}-${compactText(
        action?.cnName || action?.name || ""
      )}`,
    source: action?.source || "full",
    apparatus: action?.apparatus || "",
    name: action?.name?.trim() || "",
    cnName: action?.cnName?.trim() || "",
    level: action?.level || "",
    benefits,
    defaultBenefit: action?.defaultBenefit || benefits.join("；") || "",
  };
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

function normalizeMeta(meta = {}) {
  return {
    ...meta,
    isFavorite: Boolean(meta.isFavorite ?? meta.is_favorite),
    tags: Array.isArray(meta.tags) ? meta.tags : [],
    customCnName: meta.customCnName ?? meta.custom_cn_name ?? "",
    customEnName: meta.customEnName ?? meta.custom_en_name ?? "",
    customBenefit: meta.customBenefit ?? meta.custom_benefit ?? "",
    isHidden: Boolean(meta.isHidden ?? meta.is_hidden),
    apparatus: meta.apparatus || "",
    usageRecords: Array.isArray(meta.usageRecords) ? meta.usageRecords : [],
  };
}

function applyUserMeta(action, metaMap) {
  const meta = normalizeMeta(metaMap[action.id]);

  if (!meta || Object.keys(meta).length === 0) return action;

  return {
    ...action,
    apparatus: meta.apparatus || action.apparatus,
    cnName: meta.customCnName || action.cnName,
    name: meta.customEnName || action.name,
    benefits: meta.customBenefit ? [meta.customBenefit] : action.benefits,
    defaultBenefit: meta.customBenefit || action.defaultBenefit,
    isFavorite: meta.isFavorite,
    tags: meta.tags,
    usageRecords: meta.usageRecords,
    isHidden: meta.isHidden,
  };
}

function mergeActionsWithoutDuplicates(actions) {
  const map = new Map();
  const keyIndex = new Map();

  function getDedupKeys(action) {
    return [
      `${action.apparatus}-${compactText(action.name)}-${compactText(action.cnName)}`,
      action.cnName ? `${action.apparatus}-cn-${compactText(action.cnName)}` : "",
      action.name ? `${action.apparatus}-en-${compactText(action.name)}` : "",
    ].filter(Boolean);
  }

  function indexActionKeys(action, primaryKey) {
    getDedupKeys(action).forEach((key) => {
      if (!keyIndex.has(key)) {
        keyIndex.set(key, primaryKey);
      }
    });
  }

  actions.forEach((rawAction) => {
    const action = cleanAction(rawAction);
    const keys = getDedupKeys(action);
    const existingKey = keys.find((key) => keyIndex.has(key));
    const key = existingKey ? keyIndex.get(existingKey) : keys[0];

    if (!map.has(key)) {
      map.set(key, action);
      indexActionKeys(action, key);
      return;
    }

    const existing = map.get(key);
    const mergedAction = {
      ...existing,
      cnName: existing.cnName || action.cnName,
      name: existing.name || action.name,
      benefits: existing.benefits?.length ? existing.benefits : action.benefits,
      defaultBenefit: existing.defaultBenefit || action.defaultBenefit,
      source: existing.source === "starter" ? existing.source : action.source,
    };

    map.set(key, mergedAction);
    indexActionKeys(mergedAction, key);
  });

  return Array.from(map.values());
}

function getUsageScore(action) {
  const records = Array.isArray(action.usageRecords) ? action.usageRecords : [];
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

  return records.filter((record) => {
    const usedAt = Date.parse(record.usedAt || record.last_used_at || "");
    return Number.isFinite(usedAt) && usedAt >= thirtyDaysAgo;
  }).length;
}

function getRecommendationScore(action) {
  const usageScore = getUsageScore(action) * 100;
  const favoriteScore = userFavorites.has(action.id) || action.isFavorite ? 1000 : 0;
  const customScore = action.source === "custom" ? 800 : 0;
  const starterScore = action.source === "starter" ? 300 : 0;

  return favoriteScore + customScore + usageScore + starterScore;
}

function attachDisplayFields(action, languagePreference = "mixed") {
  return {
    ...action,
    identityKey: getActionIdentityKey(action),
    displayName: getSearchDisplayName(action, languagePreference),
    lessonName: getLessonDisplayName(action, languagePreference),
    posterName: getPosterDisplayName(action, languagePreference),
  };
}

function getTagSearchTokens(keyword) {
  const compactKeyword = compactText(keyword);
  const tokens = new Set([compactKeyword]);

  tagAliasGroups.forEach((group) => {
    const normalizedGroup = group.map(compactText);
    const hasMatch = normalizedGroup.some(
      (item) => item && (compactKeyword.includes(item) || item.includes(compactKeyword))
    );

    if (hasMatch) {
      normalizedGroup.forEach((item) => {
        if (item) tokens.add(item);
      });
    }
  });

  return Array.from(tokens);
}

function matchesTagSearch(action, keyword) {
  const tags = Array.isArray(action.tags) ? action.tags : [];
  if (!tags.length) return false;

  const tagText = compactText(tags.join(" "));
  const tokens = getTagSearchTokens(keyword);

  return tokens.some((token) => token && tagText.includes(token));
}

function getExpandedSearchTokens(keyword) {
  const compactKeyword = compactText(keyword);
  const rawTokens = normalizeText(keyword)
    .split(/[\s,，、;；/]+/)
    .map(compactText)
    .filter(Boolean);
  const tokens = new Set([compactKeyword, ...rawTokens].filter(Boolean));

  Array.from(tokens).forEach((token) => {
    tagAliasGroups.forEach((group) => {
      const normalizedGroup = group.map(compactText);
      const hasMatch = normalizedGroup.some(
        (item) => item && (token.includes(item) || item.includes(token))
      );

      if (hasMatch) {
        normalizedGroup.forEach((item) => {
          if (item) tokens.add(item);
        });
      }
    });
  });

  return Array.from(tokens);
}

function getSearchableText(action) {
  return [
    action.name,
    action.cnName,
    action.displayName,
    action.defaultBenefit,
    action.apparatus,
    action.level,
    ...(action.tags || []),
    ...(action.benefits || []),
  ].join(" ");
}

function getSearchMatchScore(action, keyword) {
  const normalizedKeyword = normalizeText(keyword);
  const compactKeyword = compactText(keyword);

  if (!normalizedKeyword) return 1;

  const normalizedText = normalizeText(getSearchableText(action));
  const compactSearchText = compactText(getSearchableText(action));
  const compactNames = [
    action.cnName,
    action.name,
    action.displayName,
  ]
    .map(compactText)
    .filter(Boolean);
  const tokens = getExpandedSearchTokens(keyword);
  let score = 0;

  if (
    normalizeText(action.cnName) === normalizedKeyword ||
    normalizeText(action.name) === normalizedKeyword ||
    normalizeText(action.displayName) === normalizedKeyword ||
    compactNames.includes(compactKeyword)
  ) {
    score += 10000;
  }

  if (compactKeyword && compactNames.some((name) => name.includes(compactKeyword))) {
    score += 4200;
  }

  if (normalizedText.includes(normalizedKeyword)) {
    score += 2600;
  }

  if (compactKeyword && compactSearchText.includes(compactKeyword)) {
    score += 2200;
  }

  tokens.forEach((token) => {
    if (!token) return;

    if (compactNames.some((name) => name.includes(token))) {
      score += 520;
      return;
    }

    if (compactSearchText.includes(token)) {
      score += 150;
    }
  });

  if (matchesTagSearch(action, keyword)) {
    score += 350;
  }

  return score;
}

export function getAllActions(languagePreference = "mixed") {
  const metaMap = getUserActionMeta();

  return mergeActionsWithoutDuplicates([
    ...getCustomActions(),
    ...userCustomActions,
    ...starterActions,
    ...baseActionsFull,
  ])
    .map((action) => applyUserMeta(action, metaMap))
    .filter((action) => !action.isHidden)
    .map((action) => attachDisplayFields(action, languagePreference));
}

export function searchActions({
  keyword = "",
  apparatus = "all",
  languagePreference = "mixed",
} = {}) {
  const normalizedKeyword = normalizeText(keyword);

  return getAllActions(languagePreference)
    .filter((action) => {
      if (apparatus === "all") return true;

      if (apparatus === "favorite") {
        return userFavorites.has(action.id) || action.isFavorite;
      }

      return action.apparatus === apparatus;
    })
    .map((action) => ({
      action,
      matchScore: getSearchMatchScore(action, keyword),
    }))
    .filter(({ matchScore }) => {
      if (!normalizedKeyword) return true;
      return matchScore > 0;
    })
    .sort((a, b) => {
      if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
      return getRecommendationScore(b.action) - getRecommendationScore(a.action);
    })
    .map(({ action }) => action);
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
    posterName:
      action.posterName ||
      cleanedAction.posterName ||
      cleanedAction.lessonName ||
      cleanedAction.cnName ||
      cleanedAction.name,
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
