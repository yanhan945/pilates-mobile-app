export function searchActions({
  keyword = "",
  apparatus = "all",
  languagePreference = "mixed",
} = {}) {
  const normalizedKeyword = normalizeText(keyword);
  const compactKeyword = compactText(keyword);
  const isSingleEnglishLetter = /^[a-z]$/.test(normalizedKeyword);

  return getAllActions(languagePreference)
    .filter((action) => {
      if (apparatus === "all") return true;

      if (apparatus === "favorite") {
        return userFavorites.has(action.id) || action.isFavorite;
      }

      return action.apparatus === apparatus;
    })
    .filter((action) => {
      // 没有输入关键词时，才显示推荐动作
      if (!normalizedKeyword) return true;

      const name = normalizeText(action.name);
      const cnName = normalizeText(action.cnName);
      const displayName = normalizeText(action.displayName);

      const compactName = compactText(action.name);
      const compactCnName = compactText(action.cnName);
      const compactDisplayName = compactText(action.displayName);

      // 英文单字母搜索更严格：只匹配英文名开头
      // 例如搜 D，只出 Dolphin / Down Stretch，不出 Standing
      if (isSingleEnglishLetter) {
        return (
          name.startsWith(normalizedKeyword) ||
          displayName.startsWith(normalizedKeyword)
        );
      }

      // 中文、英文多字符搜索：只搜动作名，不搜动作好处
      return (
        name.includes(normalizedKeyword) ||
        cnName.includes(normalizedKeyword) ||
        displayName.includes(normalizedKeyword) ||
        compactName.includes(compactKeyword) ||
        compactCnName.includes(compactKeyword) ||
        compactDisplayName.includes(compactKeyword)
      );
    })
    .sort((a, b) => getRecommendationScore(b) - getRecommendationScore(a));
}
