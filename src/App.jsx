/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./App.css";
import {
  HomeIcon,
  CalendarIcon,
  UsersIcon,
  SettingsIcon,
  MailIcon,
  LockIcon,
  LogInIcon,
  LogOutIcon,
  SearchIcon,
  PlusIcon,
  TrashIcon,
  SaveIcon,
  EyeIcon,
  ImageIcon,
  PaletteIcon,
  FileTextIcon,
  SparklesIcon,
  ClipboardListIcon,
} from "./components/AppIcons";
import {
  createSelectedLessonAction,
  createTemporaryLessonAction,
  findBestActionMatch,
  getActionIdentityKey,
  getAllActions,
  searchActions,
} from "./data/actionRepository";
import {
  clearLessonDraft,
  deleteTemplate,
  getAppData,
  getLessonsByMember,
  getLessonByMemberAndNumber,
  getLessonDraftForMemberAndNumber,
  getMemberActionMemory,
  getTemplates,
  getUserActionMeta,
  saveCustomAction,
  saveLesson,
  saveLessonDraft,
  saveMemberActionMemory,
  saveMemberProfile,
  saveSettings,
  saveTemplate,
  saveUserActionMeta,
} from "./data/localStore";
import {
  getCurrentUser as getCloudSyncUser,
  loadCloudStudioSettings,
  saveCloudStudioSettings,
} from "./data/studioCloudStore";
import {
  onCloudBaseAuthStateChange,
  requestCloudBaseEmailPasswordReset,
  requestCloudBaseEmailSignUp,
  resendCloudBaseEmailCode,
  signInCloudBaseWithEmail,
  signOutCloudBase,
  signUpCloudBaseWithEmail,
  verifyCloudBaseEmailPasswordReset,
  verifyCloudBaseEmailSignUp,
} from "./data/cloudbaseClient";
import {
  loadUserActionMeta,
  saveCloudLesson,
  saveCloudTemplate,
  saveUserActionMeta as saveCloudUserActionMeta,
} from "./data/cloudbaseStore";

const POSTER_API_URL =
  import.meta.env.VITE_POSTER_API_URL ||
  "https://pilates-poster-api.onrender.com/generate";
const POSTER_SOFT_BREAK = "\u200B";
const POSTER_LONG_TOKEN_PATTERN = /[A-Za-z0-9_./\\-]{18,}/g;
const POSTER_TEXT_CHUNK_SIZE = 14;

function addPosterSoftBreaks(value) {
  if (value === null || value === undefined) return "";

  return String(value)
    .trim()
    .replace(POSTER_LONG_TOKEN_PATTERN, (token) => {
      if (token.includes(POSTER_SOFT_BREAK)) return token;

      const chunks = [];

      for (let index = 0; index < token.length; index += POSTER_TEXT_CHUNK_SIZE) {
        chunks.push(token.slice(index, index + POSTER_TEXT_CHUNK_SIZE));
      }

      return chunks.join(POSTER_SOFT_BREAK);
    });
}

function getPosterDownloadName(studentName, lessonNumber) {
  const safeStudentName =
    String(studentName || "student")
      .trim()
      .replace(/[\\/:*?"<>|]+/g, "")
      .replace(/\s+/g, "-") || "student";

  return `${safeStudentName}-pilates-lesson-${lessonNumber || "poster"}.jpg`;
}

function isAppleMobileBrowser() {
  if (typeof navigator === "undefined") return false;

  const userAgent = navigator.userAgent || "";
  const platform = navigator.platform || "";

  return (
    /iPad|iPhone|iPod/.test(userAgent) ||
    (platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function clickTemporaryLink(href, { downloadName = "", target = "" } = {}) {
  const link = document.createElement("a");
  link.href = href;
  if (downloadName) link.download = downloadName;
  if (target) {
    link.target = target;
    link.rel = "noopener noreferrer";
  }

  document.body.appendChild(link);
  link.click();
  link.remove();
}

function openPosterOriginalUrl(imageUrl) {
  if (!imageUrl) return;

  const opened = window.open(imageUrl, "_blank", "noopener,noreferrer");
  if (!opened) window.location.href = imageUrl;
}

async function savePosterImageToDevice(imageUrl, fileName) {
  if (!imageUrl) return "missing";

  try {
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error(`Poster download failed: ${response.status}`);

    const blob = await response.blob();
    const mimeType = blob.type || "image/jpeg";
    const file =
      typeof File === "function" ? new File([blob], fileName, { type: mimeType }) : null;

    if (
      file &&
      isAppleMobileBrowser() &&
      typeof navigator.share === "function" &&
      typeof navigator.canShare === "function" &&
      navigator.canShare({ files: [file] })
    ) {
      try {
        await navigator.share({
          files: [file],
          title: "Pilates poster",
        });
        return "shared";
      } catch (error) {
        if (error?.name === "AbortError") return "cancelled";
      }
    }

    const objectUrl = URL.createObjectURL(blob);
    clickTemporaryLink(objectUrl, { downloadName: fileName });
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1200);
    return "downloaded";
  } catch (error) {
    console.warn("Poster direct download failed, opening original image instead", error);
    clickTemporaryLink(imageUrl, { downloadName: fileName, target: "_blank" });
    return "opened";
  }
}

const TAB_ITEMS = [
  { key: "home", label: "首页", Icon: HomeIcon },
  { key: "schedule", label: "排课", Icon: CalendarIcon },
  { key: "members", label: "会员", Icon: UsersIcon },
  { key: "settings", label: "设置", Icon: SettingsIcon },
];

const posterThemeOptions = [
  { key: "vitalityOrange", label: "活力橙" },
  { key: "freshGreen", label: "清新绿" },
  { key: "softLightWhite", label: "柔光白" },
  { key: "obsidianBlack", label: "曜石黑" },
  { key: "lakeBlue", label: "静海蓝" },
];
const summaryModeOptions = [
  {
    key: "lessonSummary",
    label: "课后总结",
    placeholder: "输入课后总结、训练重点或给学员的课后建议...",
    emptyText: "暂无总结",
  },
  {
    key: "bodyFeedback",
    label: "身体反馈",
    placeholder: "记录酸痛、身体感觉、恢复状态或第二天跟进内容...",
    emptyText: "暂无身体反馈",
  },
];
const apparatusOptions = [
  { key: "all", label: "全部", desc: "全部动作" },
  { key: "M", label: "M", desc: "垫上" },
  { key: "R", label: "R", desc: "核心床" },
  { key: "TT", label: "TT", desc: "卡迪拉克 / 秋千床" },
  { key: "LB", label: "LB", desc: "梯桶 / Ladder Barrel" },
  { key: "C", label: "C", desc: "椅子 / 稳踏椅" },
  { key: "SC", label: "SC", desc: "脊柱矫正器" },
  { key: "P", label: "P", desc: "小工具" },
  { key: "favorite", label: "收藏", desc: "常用收藏动作" },
  { key: "dumbbell", label: "哑铃", desc: "哑铃类小工具" },
  { key: "kettlebell", label: "壶铃", desc: "壶铃类小工具" },
  { key: "bosu", label: "波速球", desc: "BOSU / 平衡训练" },
];

const apparatusAliases = {
  M: "M",
  MAT: "M",
  R: "R",
  TT: "TT",
  T: "TT",
  LB: "LB",
  L: "LB",
  C: "C",
  SC: "SC",
  P: "P",
  哑铃: "dumbbell",
  壶铃: "kettlebell",
  波速球: "bosu",
};

function getDynamicApparatusOptions(actions = []) {
  const known = new Set(apparatusOptions.map((item) => item.key));
  const dynamicOptions = actions
    .map((action) => String(action.apparatus || "").trim())
    .filter((key) => key && !known.has(key))
    .map((key) => ({
      key,
      label: key,
      desc: "自定义器械",
    }));

  return [...apparatusOptions, ...dynamicOptions];
}

function getTodayLabel() {
  const now = new Date();
  const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  return `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(
    now.getDate()
  ).padStart(2, "0")} · ${weekdays[now.getDay()]}`;
}

function getDateInputValue(date = new Date()) {
  const nextDate = date instanceof Date ? date : new Date(date);

  if (Number.isNaN(nextDate.getTime())) return getDateInputValue(new Date());

  return `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}-${String(
    nextDate.getDate()
  ).padStart(2, "0")}`;
}

function getLessonDateInputValue(value) {
  const rawValue = String(value || "").trim();

  if (!rawValue) return getDateInputValue();
  if (/^\d{4}-\d{2}-\d{2}$/.test(rawValue)) return rawValue;

  const fullDateMatch = rawValue.match(/(\d{4})[.\-/年](\d{1,2})[.\-/月](\d{1,2})/);
  if (fullDateMatch) {
    const [, year, month, day] = fullDateMatch;
    return getDateInputValue(new Date(Number(year), Number(month) - 1, Number(day)));
  }

  const monthDayMatch = rawValue.match(/(\d{1,2})月(\d{1,2})日/);
  if (monthDayMatch) {
    const [, month, day] = monthDayMatch;
    const currentYear = new Date().getFullYear();
    return getDateInputValue(new Date(currentYear, Number(month) - 1, Number(day)));
  }

  const parsedDate = new Date(rawValue);
  if (!Number.isNaN(parsedDate.getTime())) return getDateInputValue(parsedDate);

  return getDateInputValue();
}

function getDateLabel(dateValue) {
  const [year, month, day] = getLessonDateInputValue(dateValue)
    .split("-")
    .map(Number);
  const date = new Date(year || new Date().getFullYear(), (month || 1) - 1, day || 1);
  const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(
    date.getDate()
  ).padStart(2, "0")} · ${weekdays[date.getDay()]}`;
}

function getApparatusLabel(apparatus) {
  return apparatusOptions.find((item) => item.key === apparatus)?.label || apparatus || "";
}

function parseActionLine(line) {
  const apparatusMatch = line.match(/^([A-Za-z]{1,3}|哑铃|壶铃|波速球)\s*[-—:：]?\s*(.+)$/);
  if (!apparatusMatch) return null;

  const rawApparatus = apparatusMatch[1];
  const normalizedApparatus =
    apparatusAliases[rawApparatus.toUpperCase()] || apparatusAliases[rawApparatus];

  if (!normalizedApparatus) return null;

  return {
    apparatus: normalizedApparatus,
    keyword: apparatusMatch[2].trim(),
  };
}

function parsePasteCourseText(rawText) {
  return rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const summaryMatch = line.match(/^(课后总结|总结|身体反馈)\s*[:：]\s*(.*)$/);

      if (summaryMatch) {
        return {
          id: `parsed-${index}`,
          rawText: line,
          type: "summary",
          apparatus: "",
          keyword: summaryMatch[2].trim(),
        };
      }

      const actionLine = parseActionLine(line);

      if (actionLine) {
        return {
          id: `parsed-${index}`,
          rawText: line,
          type: "action",
          apparatus: actionLine.apparatus,
          keyword: actionLine.keyword,
        };
      }

      return {
        id: `parsed-${index}`,
        rawText: line,
        type: "comment",
        apparatus: "",
        keyword: line,
      };
    });
}

function PortalLayer({ children }) {
  if (typeof document === "undefined") return children;

  return createPortal(children, document.body);
}

function App() {
  const initialData = useMemo(() => getAppData(), []);

  const [activeTab, setActiveTab] = useState("home");
  const [selectedMember, setSelectedMember] = useState(null);
  const [members, setMembers] = useState(initialData.members);
  const [languagePreference, setLanguagePreference] = useState(
    initialData.settings.languagePreference || "chinese"
  );

  useEffect(() => {
    saveSettings({ languagePreference });
  }, [languagePreference]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    window.history.replaceState({ tab: "home" }, "", window.location.href);

    function handlePopState(event) {
      const nextTab = event.state?.tab || "home";
      setActiveTab(nextTab);
    }

    window.addEventListener("popstate", handlePopState);

    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  function switchTab(nextTab) {
    setActiveTab(nextTab);

    if (typeof window === "undefined") return;

    const currentTab = window.history.state?.tab || "home";
    if (currentTab === nextTab) return;

    if (nextTab === "home") {
      if (currentTab !== "home") {
        window.history.back();
      } else {
        window.history.replaceState({ tab: "home" }, "", window.location.href);
      }
      return;
    }

    if (currentTab === "home") {
      window.history.pushState({ tab: nextTab }, "", window.location.href);
    } else {
      window.history.replaceState({ tab: nextTab }, "", window.location.href);
    }
  }

  function openSchedule(member) {
    setSelectedMember(member);
    switchTab("schedule");
  }

  return (
    <div className={`app-shell app-shell--${activeTab}`}>
      <main className={`phone-page phone-page--${activeTab}`}>
        {activeTab === "home" && (
          <HomePage
            members={members}
            onOpenSchedule={openSchedule}
            coachName={initialData.settings?.coachName || "严老师"}
          />
        )}

        {activeTab === "schedule" && (
        <SchedulePage
  member={selectedMember}
  members={members}
  languagePreference={languagePreference}
  onMembersUpdated={setMembers}
/>
        )}

        {activeTab === "members" && (
          <MembersPage
            members={members}
            onOpenSchedule={openSchedule}
            onMembersUpdated={setMembers}
          />
        )}

        {activeTab === "settings" && (
          <SettingsPage
            languagePreference={languagePreference}
            setLanguagePreference={setLanguagePreference}
          />
        )}
      </main>

      <nav className="bottom-tabs" aria-label="主导航">
        {TAB_ITEMS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={activeTab === item.key ? "tab active" : "tab"}
            aria-current={activeTab === item.key ? "page" : undefined}
            onClick={() => switchTab(item.key)}
          >
            <span className="tab-icon-wrap">
              <item.Icon className="tab-icon" size={27} strokeWidth={1.9} />
            </span>
            <span className="tab-label">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

function HomePage({ members, onOpenSchedule, coachName }) {
  const [memberSearch, setMemberSearch] = useState("");

  const filteredMembers = useMemo(() => {
    const keyword = memberSearch.trim().toLowerCase();

    if (!keyword) return members;

    return members.filter((member) =>
      [member.name, member.phone, member.goal, member.lastDate]
        .join(" ")
        .toLowerCase()
        .includes(keyword)
    );
  }, [members, memberSearch]);

  function getMemberAvatar(member) {
    return (
      member.avatarUrl ||
      member.avatar ||
      member.photoUrl ||
      member.photo ||
      member.imageUrl ||
      ""
    );
  }

  return (
    <section className="page home-page">
      <section className="home-hero-card">
        <div className="home-hero-copy">
          <h1>
            <span>下午好，</span>
            <span>{coachName || "严老师"}</span>
          </h1>
          <p className="home-welcome">欢迎回来，今天也要加油呀</p>
        </div>
        <div className="home-hero-dots" aria-hidden="true">
          <span className="active" />
          <span />
          <span />
        </div>
      </section>

      <div className="home-search-shell">
        <label className="home-search-box">
          <SearchIcon size={30} />
          <input
            value={memberSearch}
            onChange={(event) => setMemberSearch(event.target.value)}
            placeholder="搜索会员姓名"
            aria-label="搜索会员姓名"
          />
          {memberSearch ? (
            <button
              className="home-search-clear"
              type="button"
              onClick={() => setMemberSearch("")}
              aria-label="清空搜索"
            >
              ×
            </button>
          ) : (
            <span className="home-scan-icon" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
            </span>
          )}
        </label>
      </div>

      <section className="home-member-panel" aria-labelledby="home-recent-title">
        <div className="home-member-header">
          <div className="home-title-line">
            <span className="home-title-bar" />
            <h2 id="home-recent-title">近期活跃会员</h2>
          </div>
        </div>

        <div className="home-member-list">
          {filteredMembers.map((member) => {
            const avatarSrc = getMemberAvatar(member);

            return (
              <button
                className="home-member-row"
                key={member.name}
                onClick={() => onOpenSchedule(member)}
              >
                <span className="home-avatar">
                  {avatarSrc ? (
                    <img src={avatarSrc} alt={`${member.name}头像`} />
                  ) : (
                    <span className="home-default-avatar" aria-hidden="true" />
                  )}
                </span>
                <span className="home-member-info">
                  <strong>{member.name}</strong>
                  <span>最后上课：{member.lastDate || "暂无记录"}</span>
                </span>
                <span className="home-member-lessons">
                  <strong>{member.lessons || 0}</strong>
                  <span>节</span>
                </span>
                <span className="home-member-chevron" aria-hidden="true">
                  ›
                </span>
              </button>
            );
          })}

          {filteredMembers.length === 0 && (
            <div className="home-empty-members">没有匹配的会员</div>
          )}
        </div>
      </section>
    </section>
  );
}

function LegacyHomePage({ members, onOpenSchedule, coachName }) {
  const recentMembers = members;

  function getMemberAvatar(member) {
    return (
      member.avatarUrl ||
      member.avatar ||
      member.photoUrl ||
      member.photo ||
      member.imageUrl ||
      ""
    );
  }

  return (
    <section className="page home-page">
      <header className="home-hero-card">
        <div className="home-hero-copy">
          <h1>
            <span>下午好，</span>
            <span>{coachName}</span>
          </h1>
          <p className="home-welcome">欢迎回来，今天也要加油呀</p>
        </div>
        <div className="home-hero-dots" aria-hidden="true">
          <span className="active" />
          <span />
          <span />
        </div>
      </header>

      <div className="home-search-shell">
        <div className="home-search-box" role="search">
          <SearchIcon size={27} strokeWidth={1.8} />
          <span>搜索会员姓名</span>
          <span className="home-scan-icon" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
        </div>
      </div>

      <section className="home-member-panel" aria-labelledby="home-recent-title">
        <div className="home-member-header">
          <div className="home-title-line">
            <span className="home-title-bar" aria-hidden="true" />
            <h2 id="home-recent-title">近期活跃会员</h2>
          </div>
          <button className="home-view-more" type="button">
            查看更多
            <span aria-hidden="true">›</span>
          </button>
        </div>

        <div className="home-member-list">
          {recentMembers.map((member) => {
            const avatarSrc = getMemberAvatar(member);

            return (
              <button
                className="home-member-row"
                key={member.name}
                onClick={() => onOpenSchedule(member)}
              >
                <span className="home-avatar">
                  {avatarSrc ? (
                    <img src={avatarSrc} alt={`${member.name}头像`} />
                  ) : (
                    <span className="home-default-avatar" aria-hidden="true" />
                  )}
                </span>
                <span className="home-member-info">
                  <strong>{member.name}</strong>
                  <span>最后上课：{member.lastDate}</span>
                </span>
                <span className="home-member-lessons">
                  <strong>{member.lessons}</strong>
                  <span>节</span>
                </span>
                <span className="home-member-chevron" aria-hidden="true">
                  ›
                </span>
              </button>
            );
          })}
          {recentMembers.length === 0 && (
            <div className="home-empty-members">暂无活跃会员</div>
          )}
        </div>
      </section>
    </section>
  );
}

function SchedulePage({ member, members = [], languagePreference, onMembersUpdated }) {
  const memberPickerRef = useRef(null);
  const themeFieldRef = useRef(null);
  const scheduleScrollRef = useRef(null);
  const actionDetailsRef = useRef(null);
  const actionSearchAreaRef = useRef(null);
  const quickMenuRef = useRef(null);
  const didAutoSaveOnceRef = useRef(false);
  const isRestoringLessonRef = useRef(false);
  const [isScheduleInputActive, setIsScheduleInputActive] = useState(false);
  const [scheduleFocusMode, setScheduleFocusMode] = useState("");

  const initialSettings = useMemo(() => getAppData().settings || {}, []);
  const templates = useMemo(() => getTemplates(), []);
  const allScheduleActions = useMemo(() => getAllActions(languagePreference), [
    languagePreference,
  ]);
  const scheduleApparatusOptions = useMemo(
    () => getDynamicApparatusOptions(allScheduleActions),
    [allScheduleActions]
  );
  const weatherOptions = ["晴", "多云", "小雨", "大雨", "暴雨", "雷雨", "雪"];
  const scheduleFilterOptions = useMemo(
    () => [
      { key: "all", label: "所有器械", desc: "全部动作" },
      ...scheduleApparatusOptions.filter((item) => item.key !== "all" && item.key !== "favorite"),
    ],
    [scheduleApparatusOptions]
  );

  const [scheduleMember, setScheduleMember] = useState(member || null);
  const currentMember = scheduleMember;
  const [lessonNumber, setLessonNumber] = useState(member ? (member.lessons || 0) + 1 : 1);
  const [isLessonPickerOpen, setIsLessonPickerOpen] = useState(false);
  const [isMemberPickerOpen, setIsMemberPickerOpen] = useState(false);
  const [selectedApparatus, setSelectedApparatus] = useState("all");
  const [isFavoriteFilterActive, setIsFavoriteFilterActive] = useState(false);
  const [isActionSearchPrimed, setIsActionSearchPrimed] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [isRecommendationOpen, setIsRecommendationOpen] = useState(false);
  const [themePresets, setThemePresets] = useState(
    Array.isArray(initialSettings.courseThemes) && initialSettings.courseThemes.length
      ? initialSettings.courseThemes
      : ["核心增强", "基础灵活", "脊柱灵活", "美背改善", "柔韧提升"]
  );
  const [isThemeLinked, setIsThemeLinked] = useState(true);
  const [isThemeAddOpen, setIsThemeAddOpen] = useState(false);
  const [isThemeManagerOpen, setIsThemeManagerOpen] = useState(false);
  const [newThemeName, setNewThemeName] = useState("");
  const [isQuickMenuOpen, setIsQuickMenuOpen] = useState(false);
  const [isQuickPanelOpen, setIsQuickPanelOpen] = useState(false);
  const [quickMode, setQuickMode] = useState("templates");
  const [pasteText, setPasteText] = useState("");
  const [parsedRows, setParsedRows] = useState([]);
  const [selectedHistoryLesson, setSelectedHistoryLesson] = useState(null);
  const [isCustomActionOpen, setIsCustomActionOpen] = useState(false);
  const [customActionDraft, setCustomActionDraft] = useState({
    apparatus: "M",
    cnName: "",
    name: "",
    benefit: "",
  });
  const [expandedParamsId, setExpandedParamsId] = useState("");
  const [editingActionId, setEditingActionId] = useState("");
  const [actionEditDraft, setActionEditDraft] = useState({
    cnName: "",
    name: "",
    benefit: "",
  });
  const [selectedPosterTheme, setSelectedPosterTheme] = useState("vitalityOrange");
  const [summaryMode, setSummaryMode] = useState("lessonSummary");
  const [isPosterModalOpen, setIsPosterModalOpen] = useState(false);
  const [isPosterPreviewOpen, setIsPosterPreviewOpen] = useState(false);
  const [generatedPosterUrl, setGeneratedPosterUrl] = useState("");
  const [isPosterGenerating, setIsPosterGenerating] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [lessonForm, setLessonForm] = useState({
    lessonDate: getDateInputValue(),
    weather: "晴",
    studentName: member?.name || "",
    lessonTheme: "",
    summary: "",
  });
  const [actions, setActions] = useState([]);
  const isScheduleModalOpen =
    isLessonPickerOpen ||
    isThemeAddOpen ||
    isThemeManagerOpen ||
    isCustomActionOpen ||
    isQuickPanelOpen ||
    isPosterModalOpen ||
    isPosterGenerating ||
    Boolean(generatedPosterUrl);

  function growTextareaElement(textarea) {
    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }

  function getSummaryOption(mode = summaryMode) {
    return (
      summaryModeOptions.find((option) => option.key === mode) ||
      summaryModeOptions[0]
    );
  }

  function getStoredSummaryMode(lesson) {
    if (summaryModeOptions.some((option) => option.key === lesson?.summaryMode)) {
      return lesson.summaryMode;
    }

    if (
      lesson?.summaryLabel === "身体反馈" ||
      lesson?.summaryTitle === "身体反馈" ||
      lesson?.summary_label === "身体反馈" ||
      lesson?.summary_title === "身体反馈"
    ) {
      return "bodyFeedback";
    }

    return "lessonSummary";
  }

  function toggleSummaryMode() {
    setSummaryMode((current) =>
      current === "lessonSummary" ? "bodyFeedback" : "lessonSummary"
    );
  }

  function activateScheduleInput(mode) {
    setScheduleFocusMode(mode);
    setIsScheduleInputActive(true);
  }

  function deactivateScheduleInput(mode) {
    window.setTimeout(() => {
      setScheduleFocusMode((currentMode) => {
        if (currentMode !== mode) return currentMode;

        setIsScheduleInputActive(false);
        return "";
      });
    }, 140);
  }

  function openActionSearchPanel() {
    setIsRecommendationOpen(true);
    activateScheduleInput("action");

    const scrollToActionSection = () => {
      const scroller = scheduleScrollRef.current;
      const section = actionDetailsRef.current;
      if (!scroller || !section) return;

      const scrollerRect = scroller.getBoundingClientRect();
      const sectionRect = section.getBoundingClientRect();
      const nextTop = scroller.scrollTop + sectionRect.top - scrollerRect.top - 8;

      scroller.scrollTo({
        top: Math.max(nextTop, 0),
        behavior: "smooth",
      });
    };

    window.requestAnimationFrame(scrollToActionSection);
    window.setTimeout(scrollToActionSection, 80);
    window.setTimeout(scrollToActionSection, 280);
    window.setTimeout(scrollToActionSection, 520);
  }

  function primeActionSearch(event) {
    if (isRecommendationOpen && isActionSearchPrimed) return;

    event.preventDefault();
    setIsActionSearchPrimed(true);
    openActionSearchPanel();
  }

  function focusThemeInput() {
    activateScheduleInput("theme");

    window.setTimeout(() => {
      themeFieldRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 80);
  }

  const lessonOptions = useMemo(() => {
    const max = Math.max(Number(currentMember?.lessons || 0) + 1, lessonNumber, 1);
    return Array.from({ length: max }, (_, index) => index + 1);
  }, [currentMember?.lessons, lessonNumber]);

  const filteredMembers = useMemo(() => {
    const keyword = lessonForm.studentName.trim().toLowerCase();

    if (!keyword) return members;

    return members.filter((item) =>
      [item.name, item.phone, item.goal]
        .join(" ")
        .toLowerCase()
        .includes(keyword)
    );
  }, [members, lessonForm.studentName]);

  const addedActionKeys = useMemo(() => {
    return new Set(
      actions.map((action) => action.identityKey || getActionIdentityKey(action)).filter(Boolean)
    );
  }, [actions]);

  const addedBaseActionIds = useMemo(() => {
    return new Set(actions.map((action) => action.baseActionId).filter(Boolean));
  }, [actions]);

  const recommendationApparatus = isFavoriteFilterActive ? "favorite" : selectedApparatus;

  const recommendedActions = useMemo(() => {
    const hasTypedKeyword = Boolean(searchKeyword.trim());
    const hasLinkedTheme = isThemeLinked && Boolean(lessonForm.lessonTheme.trim());
    const recommendationKeyword = hasTypedKeyword
      ? searchKeyword
      : hasLinkedTheme
        ? lessonForm.lessonTheme
        : "";

    const getCandidates = (apparatus) =>
      searchActions({
        keyword: recommendationKeyword,
        apparatus,
        languagePreference,
        preferTagged: !hasTypedKeyword && hasLinkedTheme,
      })
        .filter((action) => !addedBaseActionIds.has(action.id))
        .filter((action) => !addedActionKeys.has(getActionIdentityKey(action)));
    const scopedCandidates = getCandidates(recommendationApparatus);
    const candidates =
      scopedCandidates.length || recommendationApparatus === "all" || recommendationApparatus === "favorite"
        ? scopedCandidates
        : getCandidates("all");

    return candidates.slice(0, 8);
  }, [
    searchKeyword,
    recommendationApparatus,
    languagePreference,
    addedBaseActionIds,
    addedActionKeys,
    isThemeLinked,
    lessonForm.lessonTheme,
  ]);

  const historyLessons = useMemo(() => {
    return getLessonsByMember(lessonForm.studentName).filter(
      (lesson) => Number(lesson.lessonNumber) < Number(lessonNumber)
    );
  }, [lessonForm.studentName, lessonNumber, isQuickPanelOpen, saveMessage]);

  useEffect(() => {
    const nextMember = member
      ? members.find((item) => item.name === member.name) || member
      : null;

    const nextLessonNumber = nextMember ? Number(nextMember.lessons || 0) + 1 : 1;

    didAutoSaveOnceRef.current = false;
    setScheduleMember(nextMember);
    setLessonNumber(nextLessonNumber);
  }, [member?.name]);

  useEffect(() => {
    if (!scheduleMember?.name) return;

    const latestMember = members.find((item) => item.name === scheduleMember.name);
    if (latestMember) setScheduleMember(latestMember);
  }, [members, scheduleMember?.name]);

  useEffect(() => {
    const memberName = currentMember?.name || lessonForm.studentName || "";

    isRestoringLessonRef.current = true;

    const draft = getLessonDraftForMemberAndNumber(memberName, lessonNumber);
    const savedLesson = getLessonByMemberAndNumber(memberName, lessonNumber);
    const existingLesson = draft || savedLesson;

    if (existingLesson) {
      setLessonForm({
        lessonDate: getLessonDateInputValue(existingLesson.lessonDate || existingLesson.lesson_date),
        weather: existingLesson.weather || "晴",
        studentName: existingLesson.memberName || memberName,
        lessonTheme: existingLesson.lessonTheme || "",
        summary: existingLesson.summary || "",
      });
      setSummaryMode(getStoredSummaryMode(existingLesson));
      setActions(Array.isArray(existingLesson.actions) ? existingLesson.actions : []);
    } else {
      setLessonForm((current) => ({
        ...current,
        lessonDate: current.lessonDate || getDateInputValue(),
        weather: current.weather || "晴",
        studentName: memberName,
        lessonTheme: "",
        summary: "",
      }));
      setSummaryMode("lessonSummary");
      setActions([]);
    }

    setSearchKeyword("");
    setIsRecommendationOpen(false);
    setExpandedParamsId("");
    setEditingActionId("");

    setTimeout(() => {
      isRestoringLessonRef.current = false;
    }, 0);
  }, [currentMember?.name, lessonNumber]);

  useEffect(() => {
    if (isRestoringLessonRef.current) return;

    if (!didAutoSaveOnceRef.current) {
      didAutoSaveOnceRef.current = true;
      return;
    }

    const hasContent =
      lessonForm.studentName.trim() ||
      lessonForm.lessonTheme.trim() ||
      lessonForm.summary.trim() ||
      actions.length > 0;

    if (!hasContent) return;

    const timer = setTimeout(() => {
      saveLessonDraft(buildLessonPayload());
    }, 900);

    return () => clearTimeout(timer);
  }, [lessonForm, actions, languagePreference, lessonNumber, summaryMode]);

  useEffect(() => {
    function closeWhenClickOutside(event) {
      if (
        memberPickerRef.current &&
        !memberPickerRef.current.contains(event.target)
      ) {
        setIsMemberPickerOpen(false);
      }

      if (
        actionSearchAreaRef.current &&
        !actionSearchAreaRef.current.contains(event.target)
      ) {
        setIsRecommendationOpen(false);
        setIsActionSearchPrimed(false);
        setIsScheduleInputActive(false);
      }

      if (
        quickMenuRef.current &&
        !quickMenuRef.current.contains(event.target)
      ) {
        setIsQuickMenuOpen(false);
      }

    }

    document.addEventListener("mousedown", closeWhenClickOutside);
    document.addEventListener("touchstart", closeWhenClickOutside);

    return () => {
      document.removeEventListener("mousedown", closeWhenClickOutside);
      document.removeEventListener("touchstart", closeWhenClickOutside);
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle("schedule-input-active", isScheduleInputActive);

    return () => {
      document.body.classList.remove("schedule-input-active");
    };
  }, [isScheduleInputActive]);

  useEffect(() => {
    document.body.classList.toggle("schedule-modal-open", isScheduleModalOpen);

    return () => {
      document.body.classList.remove("schedule-modal-open");
    };
  }, [isScheduleModalOpen]);

  function showToast(message, duration = 1600) {
    setSaveMessage(message);
    setTimeout(() => setSaveMessage(""), duration);
  }

  function syncMembersFromStore() {
    const latestData = getAppData();
    onMembersUpdated?.(latestData.members || []);

    const latestMember = (latestData.members || []).find(
      (item) => item.name === lessonForm.studentName
    );

    if (latestMember) setScheduleMember(latestMember);
  }

  function updateLessonField(fieldName, nextValue) {
    setLessonForm((current) => ({
      ...current,
      [fieldName]: nextValue,
    }));
  }

  function selectMemberFromPicker(nextMember) {
    const nextLessonNumber = Number(nextMember.lessons || 0) + 1;

    didAutoSaveOnceRef.current = false;
    setScheduleMember(nextMember);
    setLessonNumber(nextLessonNumber);
    setLessonForm({
      lessonDate: getDateInputValue(),
      weather: "晴",
      studentName: nextMember.name,
      lessonTheme: "",
      summary: "",
    });
    setSummaryMode("lessonSummary");
    setActions([]);
    setSearchKeyword("");
    setIsMemberPickerOpen(false);
    setScheduleFocusMode("");
    setIsScheduleInputActive(false);
  }

  function persistThemePresets(nextThemes) {
    setThemePresets(nextThemes);
    saveSettings({
      courseThemes: nextThemes,
    });
  }

  function applyThemePreset(theme) {
    setLessonForm((current) => {
      if (!isThemeLinked) {
        return {
          ...current,
          lessonTheme: theme,
        };
      }

      const parts = String(current.lessonTheme || "")
        .split(/[、,，\s]+/)
        .map((item) => item.trim())
        .filter(Boolean);

      if (parts.includes(theme)) return current;

      return {
        ...current,
        lessonTheme: parts.length ? `${parts.join("、")}、${theme}` : theme,
      };
    });
  }

  function addThemePreset() {
    const cleanTheme = newThemeName.trim();
    if (!cleanTheme) return;

    const nextThemes = themePresets.includes(cleanTheme)
      ? themePresets
      : [...themePresets, cleanTheme];

    persistThemePresets(nextThemes);
    applyThemePreset(cleanTheme);
    setNewThemeName("");
    setIsThemeAddOpen(false);
  }

  function removeThemePreset(theme) {
    persistThemePresets(themePresets.filter((item) => item !== theme));
  }

  function moveThemePreset(theme, direction) {
    const index = themePresets.indexOf(theme);
    const targetIndex = index + direction;

    if (index < 0 || targetIndex < 0 || targetIndex >= themePresets.length) return;

    const nextThemes = [...themePresets];
    const [removed] = nextThemes.splice(index, 1);
    nextThemes.splice(targetIndex, 0, removed);
    persistThemePresets(nextThemes);
  }

  function getCurrentMemberName() {
    return lessonForm.studentName.trim() || currentMember?.name || "";
  }

  function createActionForLesson(action) {
    const nextAction = createSelectedLessonAction(action);
    const memberName = getCurrentMemberName();
    const memory = getMemberActionMemory(memberName, nextAction.identityKey);

    if (!memory) return nextAction;

    return {
      ...nextAction,
      name: memory.cnName || nextAction.name,
      posterName: memory.cnName || nextAction.posterName,
      cnName: memory.cnName || nextAction.cnName,
      rawName: memory.name || nextAction.rawName,
      benefit: memory.benefit || nextAction.benefit,
    };
  }

  function buildActionFromKeyword(item) {
    if (item.baseActionId) {
      const foundById = getAllActions(languagePreference).find(
        (action) => action.id === item.baseActionId
      );
      if (foundById) return createActionForLesson(foundById);
    }

    const matchedAction = findBestActionMatch({
      apparatus: item.apparatus || "all",
      keyword: item.keyword,
      languagePreference,
    });

    if (matchedAction) return createActionForLesson(matchedAction);

    return createTemporaryLessonAction({
      apparatus:
        item.apparatus && item.apparatus !== "all"
          ? item.apparatus
          : selectedApparatus !== "all"
            ? selectedApparatus
            : "M",
      name: item.keyword,
    });
  }

  function addAction(action) {
    const nextAction = createActionForLesson(action);

    setActions((currentActions) => [...currentActions, nextAction]);
    setSearchKeyword("");
    setIsRecommendationOpen(true);
  }

  function handleSearchAdd() {
    if (recommendedActions[0]) {
      addAction(recommendedActions[0]);
      return;
    }

    const cleanKeyword = searchKeyword.trim();
    if (!cleanKeyword) {
      setIsRecommendationOpen(true);
      return;
    }

    setCustomActionDraft({
      apparatus: selectedApparatus === "all" ? "M" : selectedApparatus,
      cnName: cleanKeyword,
      name: "",
      benefit: "",
    });
    setIsCustomActionOpen(true);
  }

  function saveCustomActionDraft() {
    const cleanName = customActionDraft.cnName.trim() || customActionDraft.name.trim();

    if (!cleanName) return;

    const savedAction = saveCustomAction({
      apparatus: customActionDraft.apparatus || "M",
      cnName: customActionDraft.cnName.trim() || cleanName,
      name: customActionDraft.name.trim() || cleanName,
      defaultBenefit: customActionDraft.benefit.trim(),
    });

    setActions((currentActions) => [...currentActions, createActionForLesson(savedAction)]);
    setSearchKeyword("");
    setIsCustomActionOpen(false);
    showToast("动作已加入动作库");
  }

  function updateActionField(actionId, fieldName, nextValue) {
    setActions((currentActions) =>
      currentActions.map((action) =>
        action.id === actionId ? { ...action, [fieldName]: nextValue } : action
      )
    );
  }

  function handleActionCommentChange(actionId, event) {
    updateActionField(actionId, "comment", event.target.value);
    growTextareaElement(event.currentTarget);
  }

  function handleSummaryChange(event) {
    updateLessonField("summary", event.target.value);
    growTextareaElement(event.currentTarget);
  }

  function updateActionParams(actionId, fieldName, nextValue) {
    setActions((currentActions) =>
      currentActions.map((action) =>
        action.id === actionId
          ? {
              ...action,
              params: {
                ...(action.params || {}),
                [fieldName]: nextValue,
              },
            }
          : action
      )
    );
  }

  function deleteAction(actionId) {
    setActions((currentActions) => currentActions.filter((action) => action.id !== actionId));
  }

  function moveAction(actionId, direction) {
    setActions((currentActions) => {
      const index = currentActions.findIndex((action) => action.id === actionId);
      const targetIndex = index + direction;

      if (index < 0 || targetIndex < 0 || targetIndex >= currentActions.length) {
        return currentActions;
      }

      const nextActions = [...currentActions];
      const [removed] = nextActions.splice(index, 1);
      nextActions.splice(targetIndex, 0, removed);
      return nextActions;
    });
  }

  function openActionEdit(action) {
    setExpandedParamsId("");
    setEditingActionId(action.id);
    setActionEditDraft({
      cnName: action.cnName || action.name || "",
      name: action.rawName || action.name || "",
      benefit: action.benefit || "",
    });
  }

  function saveActionEdit(actionId) {
    const action = actions.find((item) => item.id === actionId);
    if (!action) return;

    const cnName = actionEditDraft.cnName.trim();
    const name = actionEditDraft.name.trim();
    const benefit = actionEditDraft.benefit.trim();

    setActions((currentActions) =>
      currentActions.map((item) =>
        item.id === actionId
          ? {
              ...item,
              name: cnName || item.name,
              posterName: cnName || item.posterName,
              cnName: cnName || item.cnName,
              rawName: name || item.rawName,
              benefit,
            }
          : item
      )
    );

    saveMemberActionMemory({
      memberName: getCurrentMemberName(),
      actionIdentityKey: action.identityKey || getActionIdentityKey(action),
      cnName: cnName || action.cnName || action.name,
      name: name || action.rawName || "",
      benefit,
    });

    setEditingActionId("");
    showToast("动作记忆已保存");
  }

  function getActionParamText(action) {
    const params = action.params || {};
    const parts = [];

    if (params.reps) parts.push(`${params.reps}次`);
    if (params.sets) parts.push(`${params.sets}组`);
    if (params.seconds) parts.push(`${params.seconds}秒`);
    if (params.kg) parts.push(`${params.kg}公斤`);
    if (params.spring) parts.push(`${params.spring}弹簧`);

    return parts.join(" · ");
  }

  function parseImportText() {
    const defaultApparatus = selectedApparatus === "all" ? "all" : selectedApparatus;
    const rows = pasteText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, index) => {
        const parsed = parseActionLine(line);

        return {
          id: `import-${Date.now()}-${index}`,
          rawText: line,
          apparatus: parsed?.apparatus || defaultApparatus,
          keyword: parsed?.keyword || line,
        };
      });

    setParsedRows(rows);
  }

  function removeParsedRow(rowId) {
    setParsedRows((currentRows) => currentRows.filter((row) => row.id !== rowId));
  }

  function confirmImportRows() {
    if (!parsedRows.length) return;

    setActions(parsedRows.map(buildActionFromKeyword));
    setIsQuickPanelOpen(false);
    setPasteText("");
    setParsedRows([]);
  }

  function applyTemplate(template) {
    const nextActions = (template.actions || []).map(buildActionFromKeyword);

    setActions(nextActions);
    setLessonForm((current) => ({
      ...current,
      lessonTheme: template.name || current.lessonTheme,
    }));
    setIsQuickPanelOpen(false);
  }

  function copyHistoryLesson() {
    const lesson = historyLessons.find(
      (item) => Number(item.lessonNumber) === Number(selectedHistoryLesson)
    );

    if (!lesson) return;

    setLessonForm((current) => ({
      ...current,
      lessonTheme: lesson.lessonTheme || "",
      summary: lesson.summary || "",
    }));
    setSummaryMode(getStoredSummaryMode(lesson));
    setActions(Array.isArray(lesson.actions) ? lesson.actions : []);
    setSelectedHistoryLesson(null);
    setIsQuickPanelOpen(false);
    showToast(`已复制第${lesson.lessonNumber}节`);
  }

  function buildLessonPayload() {
    const summaryOption = getSummaryOption();

    return {
      id: `lesson-${lessonForm.studentName || "guest"}-${lessonNumber}`,
      memberName: lessonForm.studentName,
      lessonNumber,
      lessonDate: getDateLabel(lessonForm.lessonDate),
      weather: lessonForm.weather,
      lessonTheme: lessonForm.lessonTheme,
      posterTheme: selectedPosterTheme,
      actions,
      summary: lessonForm.summary,
      summaryMode,
      summaryLabel: summaryOption.label,
      summaryTitle: summaryOption.label,
      summary_label: summaryOption.label,
      summary_title: summaryOption.label,
      languagePreference,
    };
  }

  async function saveCurrentLesson() {
    if (!lessonForm.studentName.trim()) {
      showToast("请先选择或输入学员");
      return;
    }

    const savedLesson = saveLesson(buildLessonPayload());
    syncMembersFromStore();

    try {
      await saveCloudLesson(savedLesson);
    } catch (error) {
      console.warn("课程云端同步失败，已保存在本机", error);
    }

    showToast("课程已保存");
  }

  function clearCurrentDraft() {
    clearLessonDraft(lessonForm.studentName, lessonNumber);
    setLessonForm({
      lessonDate: getDateInputValue(),
      weather: "晴",
      studentName: currentMember?.name || "",
      lessonTheme: "",
      summary: "",
    });
    setSummaryMode("lessonSummary");
    setActions([]);
    setPasteText("");
    setParsedRows([]);
    setSearchKeyword("");
    setExpandedParamsId("");
    setEditingActionId("");
    showToast("已清空当前草稿");
  }

  function getPosterActionName(action) {
    const cnName = action.cnName || action.name || "";
    const enName = action.rawName || action.name || "";

    if (languagePreference === "english") return enName || cnName;

    if (languagePreference === "mixed") {
      if (cnName && enName && cnName !== enName) return `${cnName} / ${enName}`;
      return cnName || enName;
    }

    return cnName || enName;
  }

  function buildPosterPayload() {
    const latestSettings = getAppData().settings || {};
    const summaryOption = getSummaryOption();

    return {
      posterTheme: selectedPosterTheme,
      studentName: addPosterSoftBreaks(lessonForm.studentName || "未命名学员"),
      studentNameSlug: lessonForm.studentName || "student",
      date: addPosterSoftBreaks(getDateLabel(lessonForm.lessonDate)),
      weather: addPosterSoftBreaks(lessonForm.weather || "晴"),
      lessonNumber: `第${lessonNumber}课`,
      courseTheme: addPosterSoftBreaks(lessonForm.lessonTheme || ""),
      studioName: addPosterSoftBreaks(latestSettings.studioNameCn || ""),
      studioSubName: addPosterSoftBreaks(latestSettings.studioNameEn || ""),
      logo: latestSettings.logoDataUrl || "",
      summary: addPosterSoftBreaks(lessonForm.summary || ""),
      summaryMode,
      summaryLabel: addPosterSoftBreaks(summaryOption.label),
      summaryTitle: addPosterSoftBreaks(summaryOption.label),
      summary_label: addPosterSoftBreaks(summaryOption.label),
      summary_title: addPosterSoftBreaks(summaryOption.label),
      actions: actions.map((action, index) => ({
        number: index + 1,
        equipment: action.apparatus || "",
        name: addPosterSoftBreaks(getPosterActionName(action)),
        benefit: addPosterSoftBreaks(action.benefit || ""),
        comment: addPosterSoftBreaks(action.comment || ""),
      })),
    };
  }

  async function generatePoster() {
    if (isPosterGenerating) return;

    if (!lessonForm.studentName.trim()) {
      showToast("请先填写学员姓名");
      return;
    }

    if (actions.length === 0) {
      showToast("请先添加至少一个动作");
      return;
    }

    try {
      setIsPosterGenerating(true);
      setSaveMessage("");
      saveLesson(buildLessonPayload());
      syncMembersFromStore();

      const response = await fetch(POSTER_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildPosterPayload()),
      });

      if (!response.ok) {
        throw new Error(`生成失败：${response.status}`);
      }

      const result = await response.json();

      if (!result.success || !result.imageUrl) {
        throw new Error(result.message || "后端没有返回海报图片地址");
      }

      setGeneratedPosterUrl(result.imageUrl);
      setIsPosterModalOpen(false);
      showToast("海报已生成");
    } catch (error) {
      console.error("生成海报失败", error);
      showToast("生成海报失败，请检查后端接口", 2200);
    } finally {
      setIsPosterGenerating(false);
    }
  }

  async function saveGeneratedPosterImage() {
    const status = await savePosterImageToDevice(
      generatedPosterUrl,
      getPosterDownloadName(lessonForm.studentName, lessonNumber)
    );

    if (status === "shared") {
      showToast("已打开系统保存菜单");
      return;
    }

    if (status === "downloaded") {
      showToast("已开始下载高清原图");
      return;
    }

    if (status === "opened") {
      showToast("已打开高清原图，请长按保存");
    }
  }

  function openGeneratedPosterOriginal() {
    openPosterOriginalUrl(generatedPosterUrl);
  }

  function buildCourseText() {
    const summaryOption = getSummaryOption();
    const actionText = actions
      .map((action, index) => {
        const params = getActionParamText(action);
        return [
          `${index + 1}. [${action.apparatus || "-"}] ${action.name || action.cnName || action.rawName || ""}`,
          action.rawName && action.rawName !== action.name ? `   ${action.rawName}` : "",
          action.benefit ? `   好处：${action.benefit}` : "",
          action.comment ? `   点评：${action.comment}` : "",
          params ? `   参数：${params}` : "",
        ]
          .filter(Boolean)
          .join("\n");
      })
      .join("\n");

    return [
      `${lessonForm.studentName || "未命名学员"} · 第${lessonNumber}节`,
      `日期：${getDateLabel(lessonForm.lessonDate)}`,
      `天气：${lessonForm.weather || "晴"}`,
      `主题：${lessonForm.lessonTheme || "未填写"}`,
      "",
      "训练动作：",
      actionText || "暂无动作",
      "",
      `${summaryOption.label}：`,
      lessonForm.summary || summaryOption.emptyText,
    ].join("\n");
  }

  async function copyCourseText() {
    const text = buildCourseText();

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }

      showToast("课程文本已复制");
    } catch (error) {
      console.error("复制课程文本失败", error);
      showToast("复制失败，请稍后再试");
    }
  }

  function openQuickMode(mode) {
    setQuickMode(mode);
    setIsQuickPanelOpen(true);
    setIsQuickMenuOpen(false);
    if (mode === "history") setSelectedHistoryLesson(null);
  }

  function getQuickTitle() {
    if (quickMode === "paste") return "导入动作文本";
    if (quickMode === "history") return "复制历史课程";
    return "套用课程模板";
  }

  function renderQuickPanelBody() {
    if (quickMode === "templates") {
      return (
        <div className="schedule-v2-template-list">
          {templates.map((template) => (
            <button
              key={template.id}
              type="button"
              className="schedule-v2-template-row"
              onClick={() => applyTemplate(template)}
            >
              <span>
                <strong>{template.name}</strong>
                <small>{template.desc || "设置页保存的模板"}</small>
              </span>
              <em>{template.actions?.length || 0}个动作</em>
            </button>
          ))}

          {templates.length === 0 && (
            <div className="schedule-v2-empty">暂无模板，请先到设置页创建。</div>
          )}
        </div>
      );
    }

    if (quickMode === "paste") {
      return (
        <div className="schedule-v2-import-panel">
          <textarea
            value={pasteText}
            onChange={(event) => setPasteText(event.target.value)}
            placeholder={"每行一个动作，例如：\nR 蹬腿系列\nTT 坐姿推开\nM 卷腹"}
          />
          <button
            type="button"
            className="schedule-v2-primary-wide"
            onClick={parseImportText}
          >
            解析
          </button>

          {parsedRows.length > 0 && (
            <div className="schedule-v2-import-preview">
              {parsedRows.map((row) => {
                const previewAction = buildActionFromKeyword(row);

                return (
                  <div className="schedule-v2-import-row" key={row.id}>
                    <span className="schedule-v2-apparatus-badge">{previewAction.apparatus}</span>
                    <span>
                      <strong>{previewAction.name || row.keyword}</strong>
                      <small>{previewAction.benefit || "暂无动作好处"}</small>
                    </span>
                    <button type="button" onClick={() => removeParsedRow(row.id)}>
                      ×
                    </button>
                  </div>
                );
              })}
              <button
                type="button"
                className="schedule-v2-primary-wide"
                onClick={confirmImportRows}
              >
                确认导入
              </button>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="schedule-v2-history-list">
        {historyLessons.map((lesson) => (
          <button
            key={lesson.id}
            type="button"
            className={
              Number(selectedHistoryLesson) === Number(lesson.lessonNumber)
                ? "active"
                : ""
            }
            onClick={() => setSelectedHistoryLesson(lesson.lessonNumber)}
          >
            <span>
              <strong>第{lesson.lessonNumber}节</strong>
              <small>{lesson.lessonTheme || lesson.summary || "已保存课程"}</small>
            </span>
            <em>{lesson.actions?.length || 0}个动作</em>
          </button>
        ))}

        {historyLessons.length === 0 && (
          <div className="schedule-v2-empty">当前学员还没有可复制的历史课程。</div>
        )}

        <button
          type="button"
          className="schedule-v2-primary-wide"
          disabled={!selectedHistoryLesson}
          onClick={copyHistoryLesson}
        >
          确认复制
        </button>
      </div>
    );
  }

  return (
    <section
      className={`page schedule-page schedule-v2-page${
        isScheduleInputActive ? " schedule-v2-input-active" : ""
      }${scheduleFocusMode ? ` schedule-v2-focus-${scheduleFocusMode}` : ""}`}
    >
      <header className="schedule-v2-header">
        <div>
          <h1>普拉提私教助手</h1>
          <p>
            {lessonForm.studentName || "选择学员"} · {getDateLabel(lessonForm.lessonDate)}
          </p>
        </div>
        <div className="schedule-v2-quick-wrap" ref={quickMenuRef}>
          <button
            type="button"
            className="schedule-v2-quick-button"
            onClick={() => setIsQuickMenuOpen((current) => !current)}
          >
            <SparklesIcon size={17} />
            快速排课
          </button>
          {isQuickMenuOpen && (
            <div className="schedule-v2-quick-menu">
              <button type="button" onClick={() => openQuickMode("templates")}>
                <ClipboardListIcon size={15} />
                模板
              </button>
              <button type="button" onClick={() => openQuickMode("paste")}>
                <FileTextIcon size={15} />
                导入
              </button>
              <button type="button" onClick={() => openQuickMode("history")}>
                <SaveIcon size={15} />
                复制课程
              </button>
            </div>
          )}
        </div>
      </header>

      {saveMessage && <div className="save-toast schedule-v2-toast">{saveMessage}</div>}

      <div className="schedule-v2-scroll" ref={scheduleScrollRef}>
      <section className="schedule-v2-card">
        <div className="schedule-v2-card-title">
          <h2>
            <ClipboardListIcon size={18} />
            课程信息
          </h2>
          <button type="button" onClick={clearCurrentDraft}>
            清空当前草稿
          </button>
        </div>

        <div className="schedule-v2-meta-grid">
          <label>
            <span>日期</span>
            <input
              type="date"
              value={lessonForm.lessonDate}
              onChange={(event) =>
                updateLessonField("lessonDate", event.target.value || getDateInputValue())
              }
            />
            <small>{getDateLabel(lessonForm.lessonDate).split(" · ")[1]}</small>
          </label>
          <label>
            <span>天气</span>
            <select
              value={lessonForm.weather}
              onChange={(event) => updateLessonField("weather", event.target.value)}
            >
              {weatherOptions.map((weather) => (
                <option key={weather} value={weather}>
                  {weather}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>课次</span>
            <button
              type="button"
              className="schedule-v2-select-button"
              onClick={() => setIsLessonPickerOpen(true)}
            >
              第{lessonNumber}节
            </button>
          </label>
        </div>

        <div className="schedule-v2-field member-picker-field" ref={memberPickerRef}>
          <span>学员姓名</span>
          <input
            value={lessonForm.studentName}
            onFocus={() => {
              setIsMemberPickerOpen(true);
              activateScheduleInput("member");
            }}
            onBlur={() => deactivateScheduleInput("member")}
            onChange={(event) => {
              setScheduleMember(null);
              updateLessonField("studentName", event.target.value);
              setIsMemberPickerOpen(true);
              activateScheduleInput("member");
            }}
            placeholder="搜索或输入学员姓名"
          />

          {isMemberPickerOpen && (
            <div className="schedule-v2-dropdown member-picker-menu">
              {filteredMembers.length > 0 ? (
                filteredMembers.map((item) => (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => selectMemberFromPicker(item)}
                  >
                    <strong>{item.name}</strong>
                    <span>{item.goal || "暂无训练目标"} · 已上 {item.lessons || 0} 节</span>
                  </button>
                ))
              ) : (
                <p>没有匹配会员，可以直接保留这个姓名。</p>
              )}
            </div>
          )}
        </div>

        <div className="schedule-v2-readonly-grid">
          <div>
            <span>训练目标</span>
            <strong>{currentMember?.goal || "暂无训练目标"}</strong>
          </div>
          <div>
            <span>禁忌症</span>
            <strong>{currentMember?.contraindications || currentMember?.taboo || "无"}</strong>
          </div>
        </div>

        <div className="schedule-v2-field" ref={themeFieldRef}>
          <div className="schedule-v2-label-row">
            <span>课程主题</span>
            <button
              type="button"
              className={isThemeLinked ? "active" : ""}
              onClick={() => setIsThemeLinked((current) => !current)}
            >
              关联
            </button>
          </div>
          <div className="schedule-v2-theme-input-row">
            <input
              value={lessonForm.lessonTheme}
              onFocus={focusThemeInput}
              onBlur={() => deactivateScheduleInput("theme")}
              onChange={(event) => updateLessonField("lessonTheme", event.target.value)}
              placeholder="输入课程主题或选择预设主题..."
            />
            <button type="button" onClick={() => setIsThemeAddOpen(true)}>
              +
            </button>
            <button type="button" onClick={() => setIsThemeManagerOpen(true)}>
              -
            </button>
          </div>
        </div>

        <div className="schedule-v2-theme-strip">
          {themePresets.map((theme) => (
            <button key={theme} type="button" onClick={() => applyThemePreset(theme)}>
              {theme}
            </button>
          ))}
        </div>
      </section>

      <section className="schedule-v2-card schedule-v2-action-section" ref={actionDetailsRef}>
        <div className="schedule-v2-card-title">
          <h2>
            <SparklesIcon size={18} />
            训练动作详情
          </h2>
          <div className="schedule-v2-title-actions">
            <button
              type="button"
              className={isFavoriteFilterActive ? "active" : ""}
              onClick={() => {
                setIsFavoriteFilterActive((current) => !current);
                setIsRecommendationOpen(true);
              }}
            >
              收藏
            </button>
            <span>{actions.length}个动作</span>
          </div>
        </div>

        <div className="schedule-v2-filter-row">
          {scheduleFilterOptions.map((item) => (
            <button
              key={item.key}
              type="button"
              className={selectedApparatus === item.key ? "active" : ""}
              onClick={() => {
                setSelectedApparatus(item.key);
                setIsRecommendationOpen(true);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="schedule-v2-action-search" ref={actionSearchAreaRef}>
          <label>
            <SearchIcon size={18} />
            <input
              value={searchKeyword}
              onPointerDown={primeActionSearch}
              onFocus={openActionSearchPanel}
              onChange={(event) => {
                setSearchKeyword(event.target.value);
                setIsActionSearchPrimed(true);
                setIsRecommendationOpen(true);
                activateScheduleInput("action");
              }}
              placeholder="搜索动作关键词"
            />
          </label>
          <button type="button" onClick={handleSearchAdd}>
            <PlusIcon size={23} />
          </button>

          {isRecommendationOpen && (
            <div className="schedule-v2-recommend-panel">
              <div className="schedule-v2-recommend-head">
                <strong>推荐动作</strong>
                <span>点选后可连续添加</span>
              </div>
              {recommendedActions.map((action) => (
                <button key={action.id} type="button" onClick={() => addAction(action)}>
                  <span>
                    <strong>{action.displayName}</strong>
                    <small>{action.defaultBenefit || "暂无动作好处"}</small>
                  </span>
                  <em>{action.apparatus}</em>
                </button>
              ))}
              {recommendedActions.length === 0 && (
                <p>没有找到动作，点击加号可新增到动作库。</p>
              )}
            </div>
          )}
        </div>

        <div className="schedule-v2-action-list">
          {actions.map((action, index) => {
            const paramText = getActionParamText(action);

            return (
              <article className="schedule-v2-action-card" key={action.id}>
                <div className="schedule-v2-action-top">
                  <span className="schedule-v2-action-number">{index + 1}</span>
                  <span className="schedule-v2-apparatus-badge">{action.apparatus || "-"}</span>
                  <div>
                    <strong>{action.name || action.cnName || action.rawName}</strong>
                    {action.rawName && action.rawName !== action.name && (
                      <small>{action.rawName}</small>
                    )}
                  </div>
                  <button
                    type="button"
                    className="schedule-v2-icon-button"
                    onClick={() =>
                      setExpandedParamsId(
                        expandedParamsId === action.id ? "" : action.id
                      )
                    }
                  >
                    ⌄
                  </button>
                </div>

                <p className="schedule-v2-action-benefit">
                  {action.benefit || "暂无动作好处"}
                </p>

                <textarea
                  className="schedule-v2-comment-input"
                  value={action.comment || ""}
                  onFocus={() => activateScheduleInput("comment")}
                  onBlur={() => deactivateScheduleInput("comment")}
                  onChange={(event) => handleActionCommentChange(action.id, event)}
                  placeholder="点击添加点评..."
                />

                <div className="schedule-v2-action-tools">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedParamsId(
                        expandedParamsId === action.id ? "" : action.id
                      )
                    }
                  >
                    参数
                  </button>
                  <button type="button" onClick={() => openActionEdit(action)}>
                    编辑动作
                  </button>
                  <button type="button" onClick={() => moveAction(action.id, -1)} disabled={index === 0}>
                    上移
                  </button>
                  <button
                    type="button"
                    onClick={() => moveAction(action.id, 1)}
                    disabled={index === actions.length - 1}
                  >
                    下移
                  </button>
                  <button type="button" onClick={() => deleteAction(action.id)}>
                    删除
                  </button>
                </div>

                {paramText && <div className="schedule-v2-param-text">{paramText}</div>}

                {expandedParamsId === action.id && (
                  <div className="schedule-v2-inline-panel schedule-v2-param-panel">
                    {[
                      ["sets", "组数"],
                      ["reps", "次数"],
                      ["seconds", "秒数"],
                      ["kg", "公斤"],
                      ["spring", "弹簧"],
                    ].map(([field, label]) => (
                      <label key={field}>
                        <span>{label}</span>
                        <input
                          value={action.params?.[field] || ""}
                          onChange={(event) =>
                            updateActionParams(action.id, field, event.target.value)
                          }
                          placeholder={field === "spring" ? "如一红" : "可选"}
                        />
                      </label>
                    ))}
                  </div>
                )}

                {editingActionId === action.id && (
                  <div className="schedule-v2-inline-panel schedule-v2-edit-panel">
                    <label>
                      <span>中文名</span>
                      <input
                        value={actionEditDraft.cnName}
                        onChange={(event) =>
                          setActionEditDraft((current) => ({
                            ...current,
                            cnName: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label>
                      <span>英文名</span>
                      <input
                        value={actionEditDraft.name}
                        onChange={(event) =>
                          setActionEditDraft((current) => ({
                            ...current,
                            name: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label>
                      <span>动作好处</span>
                      <textarea
                        value={actionEditDraft.benefit}
                        onChange={(event) =>
                          setActionEditDraft((current) => ({
                            ...current,
                            benefit: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <div className="schedule-v2-panel-actions">
                      <button type="button" onClick={() => setEditingActionId("")}>
                        取消
                      </button>
                      <button type="button" onClick={() => saveActionEdit(action.id)}>
                        保存
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}

          {actions.length === 0 && (
            <div className="schedule-v2-empty">搜索或导入动作后，会显示在这里。</div>
          )}
        </div>
      </section>

      <section className="schedule-v2-card schedule-v2-summary-card">
        <div className="schedule-v2-card-title">
          <h2>
            <FileTextIcon size={18} />
            {getSummaryOption().label}
          </h2>
          <button
            type="button"
            className="schedule-v2-summary-switch"
            onClick={toggleSummaryMode}
          >
            切换
          </button>
        </div>
        <textarea
          value={lessonForm.summary}
          onFocus={() => activateScheduleInput("summary")}
          onBlur={() => deactivateScheduleInput("summary")}
          onChange={handleSummaryChange}
          placeholder={getSummaryOption().placeholder}
        />
      </section>

      <div className="schedule-v2-bottom-bar">
        <button type="button" onClick={saveCurrentLesson}>
          <SaveIcon size={21} />
          <span>保存</span>
        </button>
        <button type="button" onClick={() => setIsPosterModalOpen(true)}>
          <ImageIcon size={21} />
          <span>海报</span>
        </button>
        <button type="button" onClick={copyCourseText}>
          <ClipboardListIcon size={21} />
          <span>复制</span>
        </button>
      </div>
      </div>

      {isLessonPickerOpen && (
        <PortalLayer>
          <div className="modal-backdrop schedule-v2-backdrop" onClick={() => setIsLessonPickerOpen(false)}>
            <div className="modal-sheet schedule-v2-modal-small" onClick={(event) => event.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <h2>选择课次</h2>
                  <p>可切换历史课次或当前新课。</p>
                </div>
                <button type="button" onClick={() => setIsLessonPickerOpen(false)}>×</button>
              </div>
              <div className="lesson-picker-grid schedule-v2-lesson-grid">
                {lessonOptions.map((number) => (
                  <button
                    key={number}
                    type="button"
                    className={lessonNumber === number ? "active" : ""}
                    onClick={() => {
                      setLessonNumber(number);
                      setIsLessonPickerOpen(false);
                    }}
                  >
                    第{number}节
                  </button>
                ))}
              </div>
            </div>
          </div>
        </PortalLayer>
      )}

      {isThemeAddOpen && (
        <PortalLayer>
        <div className="modal-backdrop schedule-v2-backdrop" onClick={() => setIsThemeAddOpen(false)}>
          <div className="modal-sheet schedule-v2-modal-small" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>新增主题</h2>
                <p>保存后会出现在主题横向列表。</p>
              </div>
              <button type="button" onClick={() => setIsThemeAddOpen(false)}>×</button>
            </div>
            <label className="schedule-v2-field">
              <span>主题名称</span>
              <input
                value={newThemeName}
                onChange={(event) => setNewThemeName(event.target.value)}
                placeholder="例如：肩背塑形"
              />
            </label>
            <button type="button" className="schedule-v2-primary-wide" onClick={addThemePreset}>
              保存主题
            </button>
          </div>
        </div>
        </PortalLayer>
      )}

      {isThemeManagerOpen && (
        <PortalLayer>
        <div className="modal-backdrop schedule-v2-backdrop" onClick={() => setIsThemeManagerOpen(false)}>
          <div className="modal-sheet schedule-v2-modal-small" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>管理主题</h2>
                <p>用上/下按钮调整展示顺序。</p>
              </div>
              <button type="button" onClick={() => setIsThemeManagerOpen(false)}>×</button>
            </div>
            <div className="schedule-v2-theme-manager">
              {themePresets.map((theme, index) => (
                <div key={theme}>
                  <strong>{theme}</strong>
                  <button type="button" onClick={() => moveThemePreset(theme, -1)} disabled={index === 0}>↑</button>
                  <button type="button" onClick={() => moveThemePreset(theme, 1)} disabled={index === themePresets.length - 1}>↓</button>
                  <button type="button" onClick={() => removeThemePreset(theme)}>删除</button>
                </div>
              ))}
            </div>
          </div>
        </div>
        </PortalLayer>
      )}

      {isCustomActionOpen && (
        <PortalLayer>
        <div className="modal-backdrop schedule-v2-backdrop" onClick={() => setIsCustomActionOpen(false)}>
          <div className="modal-sheet schedule-v2-modal-small" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>新增动作</h2>
                <p>保存后会进入动作库，并加入当前课程。</p>
              </div>
              <button type="button" onClick={() => setIsCustomActionOpen(false)}>×</button>
            </div>
            <div className="schedule-v2-custom-grid">
              <label className="schedule-v2-field">
                <span>器械</span>
                <select
                  value={customActionDraft.apparatus}
                  onChange={(event) =>
                    setCustomActionDraft((current) => ({
                      ...current,
                      apparatus: event.target.value,
                    }))
                  }
                >
                  {scheduleApparatusOptions.filter((item) => item.key !== "all" && item.key !== "favorite").map((item) => (
                    <option key={item.key} value={item.key}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="schedule-v2-field">
                <span>中文名</span>
                <input
                  value={customActionDraft.cnName}
                  onChange={(event) =>
                    setCustomActionDraft((current) => ({
                      ...current,
                      cnName: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="schedule-v2-field">
                <span>英文名</span>
                <input
                  value={customActionDraft.name}
                  onChange={(event) =>
                    setCustomActionDraft((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="可选"
                />
              </label>
              <label className="schedule-v2-field">
                <span>动作好处</span>
                <textarea
                  value={customActionDraft.benefit}
                  onChange={(event) =>
                    setCustomActionDraft((current) => ({
                      ...current,
                      benefit: event.target.value,
                    }))
                  }
                  placeholder="填写这个动作的训练好处"
                />
              </label>
            </div>
            <button type="button" className="schedule-v2-primary-wide" onClick={saveCustomActionDraft}>
              保存并加入
            </button>
          </div>
        </div>
        </PortalLayer>
      )}

      {isQuickPanelOpen && (
        <PortalLayer>
        <div className="modal-backdrop schedule-v2-backdrop" onClick={() => setIsQuickPanelOpen(false)}>
          <div className="modal-sheet schedule-v2-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>{getQuickTitle()}</h2>
                <p>选择后会刷新当前动作列表。</p>
              </div>
              <button type="button" onClick={() => setIsQuickPanelOpen(false)}>×</button>
            </div>
            {renderQuickPanelBody()}
          </div>
        </div>
        </PortalLayer>
      )}

      {isPosterModalOpen && (
        <PortalLayer>
        <div className="modal-backdrop schedule-v2-backdrop" onClick={() => setIsPosterModalOpen(false)}>
          <div className="modal-sheet schedule-v2-modal-small" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>海报</h2>
                <p>选择主题后可预览或生成。</p>
              </div>
              <button type="button" onClick={() => setIsPosterModalOpen(false)}>×</button>
            </div>
            <div className="poster-theme-strip schedule-v2-poster-strip">
              {posterThemeOptions.map((theme) => (
                <button
                  key={theme.key}
                  type="button"
                  className={`poster-theme-choice poster-theme-choice--${theme.key}${
                    selectedPosterTheme === theme.key ? " active" : ""
                  }`}
                  onClick={() => setSelectedPosterTheme(theme.key)}
                >
                  {theme.label}
                </button>
              ))}
            </div>
            {isPosterPreviewOpen && (
              <div className="poster-preview-placeholder schedule-v2-poster-preview">
                <strong>{posterThemeOptions.find((item) => item.key === selectedPosterTheme)?.label}</strong>
                <p>{lessonForm.studentName || "学员"} · 第{lessonNumber}节 · {lessonForm.lessonTheme || "课程主题"}</p>
              </div>
            )}
            <div className="schedule-v2-panel-actions">
              <button type="button" onClick={() => setIsPosterPreviewOpen((current) => !current)}>
                预览
              </button>
              <button type="button" onClick={generatePoster} disabled={isPosterGenerating}>
                {isPosterGenerating ? "生成中" : "生成"}
              </button>
            </div>
          </div>
        </div>
        </PortalLayer>
      )}

      {isPosterGenerating && (
        <PortalLayer>
          <div className="modal-backdrop schedule-v2-backdrop poster-loading-backdrop" role="status" aria-live="polite">
            <div className="poster-loading-sheet" onClick={(event) => event.stopPropagation()}>
              <span className="poster-loading-spinner" aria-hidden="true" />
              <strong>努力生成中</strong>
              <p>高清海报正在生成，请稍等一下。</p>
            </div>
          </div>
        </PortalLayer>
      )}

      {generatedPosterUrl && (
        <PortalLayer>
        <div className="modal-backdrop schedule-v2-backdrop" onClick={() => setGeneratedPosterUrl("")}>
          <div className="modal-sheet poster-result-sheet schedule-v2-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>海报已生成</h2>
                <p>保存高清原图，或在浏览器中打开。</p>
              </div>
              <button type="button" onClick={() => setGeneratedPosterUrl("")}>×</button>
            </div>
            <div className="poster-result-image-wrap">
              <img src={generatedPosterUrl} alt="生成的课后海报" />
            </div>
            <div className="poster-result-actions">
              <button
                type="button"
                className="schedule-v2-primary-wide"
                onClick={saveGeneratedPosterImage}
              >
                保存高清原图
              </button>
              <button
                type="button"
                className="poster-result-link"
                onClick={openGeneratedPosterOriginal}
              >
                点击这里，在浏览器中打开高清原图
              </button>
            </div>
          </div>
        </div>
        </PortalLayer>
      )}
    </section>
  );
}

function LegacySchedulePage({ member, members = [], languagePreference }) {
  const searchInputRef = useRef(null);
  const apparatusPickerRef = useRef(null);
  const actionSearchAreaRef = useRef(null);
  const memberPickerRef = useRef(null);
  const didAutoSaveOnceRef = useRef(false);
  const isRestoringLessonRef = useRef(false);

  const defaultThemePresets = [
    "核心增强",
    "脊柱灵活",
    "肩背改善",
    "髋膝踝",
    "柔韧提升",
    "平衡协调",
    "体态调整",
  ];

  const initialSettings = useMemo(() => getAppData().settings || {}, []);
  const [scheduleMember, setScheduleMember] = useState(member || null);
  const currentMember = scheduleMember;

  const initialLessonNumber = currentMember ? currentMember.lessons + 1 : 1;

  const [lessonNumber, setLessonNumber] = useState(initialLessonNumber);
  const [isLessonPickerOpen, setIsLessonPickerOpen] = useState(false);

  const [selectedApparatus, setSelectedApparatus] = useState("all");
  const [isApparatusOpen, setIsApparatusOpen] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [isRecommendationOpen, setIsRecommendationOpen] = useState(false);

  const [isMemberPickerOpen, setIsMemberPickerOpen] = useState(false);
  const [isThemeLinked, setIsThemeLinked] = useState(true);
  const [themePresets, setThemePresets] = useState(
    Array.isArray(initialSettings.courseThemes) && initialSettings.courseThemes.length
      ? initialSettings.courseThemes
      : defaultThemePresets
  );

  const [isQuickPanelOpen, setIsQuickPanelOpen] = useState(false);
  const [selectedPosterTheme, setSelectedPosterTheme] = useState("vitalityOrange");
const [isPosterPreviewOpen, setIsPosterPreviewOpen] = useState(false);
  const [generatedPosterUrl, setGeneratedPosterUrl] = useState("");
  const [isPosterGenerating, setIsPosterGenerating] = useState(false);
  const [quickMode, setQuickMode] = useState("templates");
  const [pasteText, setPasteText] = useState("");
  const [parsedRows, setParsedRows] = useState([]);
  const [saveMessage, setSaveMessage] = useState("");
  const [addMessage, setAddMessage] = useState("");

  const [lessonForm, setLessonForm] = useState({
    weather: "晴 24℃",
    studentName: currentMember?.name || "",
    lessonTheme: currentMember ? "核心增强" : "",
    summary:
      "今天整体完成度不错，核心控制比上节课更稳定，后续可以继续加强骨盆稳定和呼吸配合。",
  });

  const [actions, setActions] = useState([]);

  const templates = useMemo(() => getTemplates(), []);

  const maxSelectableLesson = currentMember
    ? currentMember.lessons + 1
    : Math.max(lessonNumber, 1);

  const lessonOptions = useMemo(() => {
    const max = Math.max(maxSelectableLesson, lessonNumber, 1);
    return Array.from({ length: max }, (_, index) => index + 1);
  }, [maxSelectableLesson, lessonNumber]);

  const selectedApparatusLabel =
    apparatusOptions.find((item) => item.key === selectedApparatus)?.label || "全部";

  const filteredMembers = useMemo(() => {
    const keyword = lessonForm.studentName.trim().toLowerCase();

    if (!keyword) return members;

    return members.filter((item) =>
      [item.name, item.phone, item.goal]
        .join(" ")
        .toLowerCase()
        .includes(keyword)
    );
  }, [members, lessonForm.studentName]);

  useEffect(() => {
    const nextMember = member || null;
    const nextLessonNumber = nextMember ? nextMember.lessons + 1 : 1;

    didAutoSaveOnceRef.current = false;
    setScheduleMember(nextMember);
    setLessonNumber(nextLessonNumber);
  }, [member]);

  useEffect(() => {
    const memberName = currentMember?.name || lessonForm.studentName || "";

    isRestoringLessonRef.current = true;

    const draft = getLessonDraftForMemberAndNumber(memberName, lessonNumber);
    const savedLesson = getLessonByMemberAndNumber(memberName, lessonNumber);
    const existingLesson = draft || savedLesson;

    if (existingLesson) {
      setLessonForm({
        weather: existingLesson.weather || "晴 24℃",
        studentName: existingLesson.memberName || memberName,
        lessonTheme: existingLesson.lessonTheme || "",
        summary: existingLesson.summary || "",
      });

      setActions(Array.isArray(existingLesson.actions) ? existingLesson.actions : []);
    } else if (currentMember && lessonNumber <= currentMember.lessons) {
      setLessonForm({
        weather: "晴 24℃",
        studentName: currentMember.name,
        lessonTheme: `第${lessonNumber}节历史占位`,
        summary: "这节课是历史课次占位，用于保留课次顺序。",
      });

      setActions([
        {
          id: `placeholder-${currentMember.name}-${lessonNumber}`,
          name: "占位",
          rawName: "历史课次占位",
          cnName: "占位",
          apparatus: "M",
          benefit: "历史课次占位，用于保留课次顺序。",
          comment: "",
          identityKey: `placeholder-${currentMember.name}-${lessonNumber}`,
        },
      ]);
    } else {
      setLessonForm((current) => ({
        ...current,
        weather: current.weather || "晴 24℃",
        studentName: memberName,
        lessonTheme: currentMember ? "" : current.lessonTheme,
        summary:
          current.summary ||
          "今天整体完成度不错，核心控制比上节课更稳定，后续可以继续加强骨盆稳定和呼吸配合。",
      }));

      setActions([]);
    }

    setTimeout(() => {
      isRestoringLessonRef.current = false;
    }, 0);
  }, [currentMember, lessonNumber]);

  useEffect(() => {
    if (isRestoringLessonRef.current) return;

    if (!didAutoSaveOnceRef.current) {
      didAutoSaveOnceRef.current = true;
      return;
    }

    const hasContent =
      lessonForm.studentName.trim() ||
      lessonForm.lessonTheme.trim() ||
      lessonForm.summary.trim() ||
      actions.length > 0;

    if (!hasContent) return;

    const timer = setTimeout(() => {
      saveLessonDraft(buildLessonPayload());
    }, 900);

    return () => clearTimeout(timer);
  }, [lessonForm, actions, languagePreference, lessonNumber]);

  useEffect(() => {
    function closeWhenClickOutside(event) {
      if (
        apparatusPickerRef.current &&
        !apparatusPickerRef.current.contains(event.target)
      ) {
        setIsApparatusOpen(false);
      }

      if (
        actionSearchAreaRef.current &&
        !actionSearchAreaRef.current.contains(event.target)
      ) {
        setIsRecommendationOpen(false);
      }

      if (
        memberPickerRef.current &&
        !memberPickerRef.current.contains(event.target)
      ) {
        setIsMemberPickerOpen(false);
      }
    }

    document.addEventListener("mousedown", closeWhenClickOutside);
    document.addEventListener("touchstart", closeWhenClickOutside);

    return () => {
      document.removeEventListener("mousedown", closeWhenClickOutside);
      document.removeEventListener("touchstart", closeWhenClickOutside);
    };
  }, []);

  const addedActionKeys = useMemo(() => {
    return new Set(
      actions.map((action) => action.identityKey || getActionIdentityKey(action)).filter(Boolean)
    );
  }, [actions]);

  const addedBaseActionIds = useMemo(() => {
    return new Set(actions.map((action) => action.baseActionId).filter(Boolean));
  }, [actions]);

  const recommendedActions = useMemo(() => {
    return searchActions({
      keyword: searchKeyword,
      apparatus: selectedApparatus,
      languagePreference,
    })
      .filter((action) => !addedBaseActionIds.has(action.id))
      .filter((action) => !addedActionKeys.has(getActionIdentityKey(action)))
      .slice(0, 8);
  }, [searchKeyword, selectedApparatus, languagePreference, addedBaseActionIds, addedActionKeys]);

  function openRecommendationPanel() {
    setIsRecommendationOpen(true);

    setTimeout(() => {
      actionSearchAreaRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 50);
  }

  function updateLessonField(fieldName, nextValue) {
    setLessonForm((current) => ({
      ...current,
      [fieldName]: nextValue,
    }));
  }

 function selectMemberFromPicker(nextMember) {
  const nextLessonNumber = nextMember.lessons + 1;

  didAutoSaveOnceRef.current = false;
  setScheduleMember(nextMember);
  setLessonNumber(nextLessonNumber);

  setLessonForm({
    weather: "晴 24℃",
    studentName: nextMember.name,
    lessonTheme: "",
    summary:
      "今天整体完成度不错，核心控制比上节课更稳定，后续可以继续加强骨盆稳定和呼吸配合。",
  });

  setActions([]);
  setSearchKeyword("");
  setIsRecommendationOpen(false);
  setIsMemberPickerOpen(false);
}

  function appendThemePreset(theme) {
    setLessonForm((current) => {
      const existing = current.lessonTheme || "";
      const parts = existing
        .split(/[、,，\s]+/)
        .map((item) => item.trim())
        .filter(Boolean);

      if (parts.includes(theme)) return current;

      return {
        ...current,
        lessonTheme: parts.length ? `${parts.join("、")}、${theme}` : theme,
      };
    });
  }

  function addThemePreset() {
    const nextTheme = window.prompt("输入新的课程主题，例如：肩颈放松");

    if (!nextTheme || !nextTheme.trim()) return;

    const cleanTheme = nextTheme.trim();

    setThemePresets((current) => {
      if (current.includes(cleanTheme)) return current;

      const next = [...current, cleanTheme];

      saveSettings({
        courseThemes: next,
        languagePreference,
      });

      return next;
    });

    appendThemePreset(cleanTheme);
  }

  function addAction(action) {
    const nextAction = createSelectedLessonAction(action);

    setActions((currentActions) => [...currentActions, nextAction]);
    setSearchKeyword("");
    setIsRecommendationOpen(true);
    setAddMessage(`已添加：${action.displayName || action.cnName || action.name}`);

    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 0);

    setTimeout(() => {
      setAddMessage("");
    }, 900);
  }

  function updateActionField(actionId, fieldName, nextValue) {
    setActions((currentActions) =>
      currentActions.map((action) =>
        action.id === actionId ? { ...action, [fieldName]: nextValue } : action
      )
    );
  }

  function deleteAction(actionId) {
    setActions((currentActions) => currentActions.filter((action) => action.id !== actionId));
  }

  function buildLessonPayload() {
    return {
      id: `lesson-${lessonForm.studentName || "guest"}-${lessonNumber}`,
      memberName: lessonForm.studentName,
      lessonNumber,
      lessonDate: getTodayLabel(),
      weather: lessonForm.weather,
      lessonTheme: lessonForm.lessonTheme,
      actions,
      summary: lessonForm.summary,
      languagePreference,
    };
  }

  function saveCurrentLesson() {
  saveLesson(buildLessonPayload());
  setSaveMessage("课程已保存");
  setTimeout(() => setSaveMessage(""), 1600);
}

function getPosterActionName(action) {
  const cnName = action.cnName || action.name || "";
  const enName = action.rawName || action.name || "";

  if (languagePreference === "english") {
    return enName || cnName;
  }

  if (languagePreference === "mixed") {
    if (cnName && enName && cnName !== enName) {
      return `${cnName} / ${enName}`;
    }

    return cnName || enName;
  }

  return cnName || enName;
}

function buildPosterPayload() {
  const latestSettings = getAppData().settings || {};

  return {
    posterTheme: selectedPosterTheme,

    studentName: addPosterSoftBreaks(lessonForm.studentName || "未命名学员"),
    studentNameSlug: lessonForm.studentName || "student",
    date: addPosterSoftBreaks(getTodayLabel()),
    weather: addPosterSoftBreaks(lessonForm.weather || "晴"),
    lessonNumber: `第${lessonNumber}课`,
    courseTheme: addPosterSoftBreaks(lessonForm.lessonTheme || ""),

    studioName: addPosterSoftBreaks(latestSettings.studioNameCn || ""),
    studioSubName: addPosterSoftBreaks(latestSettings.studioNameEn || ""),
    logo: latestSettings.logoDataUrl || "",

    summary: addPosterSoftBreaks(lessonForm.summary || ""),
    actions: actions.map((action, index) => ({
      number: index + 1,
      equipment: action.apparatus || "",
      name: addPosterSoftBreaks(getPosterActionName(action)),
      benefit: addPosterSoftBreaks(action.benefit || ""),
      comment: addPosterSoftBreaks(action.comment || ""),
    })),
  };
}

async function generatePoster() {
  if (isPosterGenerating) return;

  if (!lessonForm.studentName.trim()) {
    setSaveMessage("请先填写学员姓名");
    setTimeout(() => setSaveMessage(""), 1600);
    return;
  }

  if (actions.length === 0) {
    setSaveMessage("请先添加至少一个动作");
    setTimeout(() => setSaveMessage(""), 1600);
    return;
  }

  try {
    setIsPosterGenerating(true);
    setSaveMessage("");

    saveLesson(buildLessonPayload());

    const response = await fetch(POSTER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildPosterPayload()),
    });

    if (!response.ok) {
      throw new Error(`生成失败：${response.status}`);
    }

    const result = await response.json();

    if (!result.success || !result.imageUrl) {
      throw new Error(result.message || "后端没有返回海报图片地址");
    }

    setSaveMessage("海报已生成");
setGeneratedPosterUrl(result.imageUrl);
setTimeout(() => setSaveMessage(""), 1600);
  } catch (error) {
    console.error("生成海报失败", error);
    setSaveMessage("生成海报失败，请检查后端接口");
    setTimeout(() => setSaveMessage(""), 2200);
  } finally {
    setIsPosterGenerating(false);
  }
}

async function saveGeneratedPosterImage() {
  const status = await savePosterImageToDevice(
    generatedPosterUrl,
    getPosterDownloadName(lessonForm.studentName, lessonNumber)
  );

  if (status === "shared") {
    setSaveMessage("已打开系统保存菜单");
  } else if (status === "downloaded") {
    setSaveMessage("已开始下载高清原图");
  } else if (status === "opened") {
    setSaveMessage("已打开高清原图，请长按保存");
  }

  if (status !== "cancelled") {
    setTimeout(() => setSaveMessage(""), 1600);
  }
}

function openGeneratedPosterOriginal() {
  openPosterOriginalUrl(generatedPosterUrl);
}

  function clearCurrentDraft() {
    clearLessonDraft(lessonForm.studentName, lessonNumber);

    setLessonForm({
      weather: "晴 24℃",
      studentName: currentMember?.name || "",
      lessonTheme: "",
      summary: "",
    });

    setActions([]);
    setPasteText("");
    setParsedRows([]);
    setSearchKeyword("");
    setIsRecommendationOpen(false);

    setSaveMessage("已清空当前草稿");
    setTimeout(() => setSaveMessage(""), 1600);
  }

  function buildActionFromKeyword(item) {
    if (item.baseActionId) {
      const foundById = getAllActions(languagePreference).find((action) => action.id === item.baseActionId);
      if (foundById) return createSelectedLessonAction(foundById);
    }

    const matchedAction = findBestActionMatch({
      apparatus: item.apparatus || "all",
      keyword: item.keyword,
      languagePreference,
    });

    if (matchedAction) return createSelectedLessonAction(matchedAction);

    return createTemporaryLessonAction({
      apparatus: item.apparatus || "M",
      name: item.keyword,
    });
  }

  function applyTemplate(template) {
    const nextActions = template.actions.map(buildActionFromKeyword);

    setActions((currentActions) => [...currentActions, ...nextActions]);
    setLessonForm((current) => ({
      ...current,
      lessonTheme: current.lessonTheme || template.name,
    }));
    setIsQuickPanelOpen(false);
  }

  function handleParsePasteText() {
    setParsedRows(parsePasteCourseText(pasteText));
  }

  function updateParsedRowType(rowId, nextType) {
    setParsedRows((currentRows) =>
      currentRows.map((row) => (row.id === rowId ? { ...row, type: nextType } : row))
    );
  }

  function importParsedRows() {
    if (!parsedRows.length) return;

    const nextActions = [];
    let pendingSummary = lessonForm.summary || "";

    parsedRows.forEach((row) => {
      if (row.type === "summary") {
        pendingSummary = row.keyword || row.rawText.replace(/^(课后总结|总结)\s*[:：]\s*/, "");
        return;
      }

      if (row.type === "action") {
        const reparsedAction = parseActionLine(row.rawText);
        const actionInput = {
          apparatus: row.apparatus || reparsedAction?.apparatus || "all",
          keyword: row.keyword || reparsedAction?.keyword || row.rawText,
        };

        nextActions.push(buildActionFromKeyword(actionInput));
        return;
      }

      const lastAction = nextActions[nextActions.length - 1];

      if (lastAction) {
        lastAction.comment = lastAction.comment ? `${lastAction.comment}\n${row.keyword}` : row.keyword;
      } else {
        pendingSummary = pendingSummary ? `${pendingSummary}\n${row.keyword}` : row.keyword;
      }
    });

    setActions((currentActions) => [...currentActions, ...nextActions]);
    setLessonForm((current) => ({ ...current, summary: pendingSummary }));
    setPasteText("");
    setParsedRows([]);
    setIsQuickPanelOpen(false);
  }

  return (
    <section className="page schedule-page">
      <header className="simple-header schedule-header">
        <div>
          <h1>
            {lessonForm.studentName
              ? `${lessonForm.studentName} · 第${lessonNumber}节`
              : "普拉提私教助手"}
          </h1>
          <p>{lessonForm.lessonTheme || "选择学员或填写课程主题"} · {getTodayLabel()}</p>
        </div>
        <button
          className="small-button"
          onClick={() => {
            setQuickMode("templates");
            setIsQuickPanelOpen(true);
          }}
        >
          <SparklesIcon size={17} />
          快速排课
        </button>
      </header>

      {saveMessage && <div className="save-toast">{saveMessage}</div>}
      {addMessage && <div className="add-toast">{addMessage}</div>}

      <section className="form-card">
        <h2>课程信息</h2>

        <label className="field">
          <span>天气</span>
          <input
            value={lessonForm.weather}
            onChange={(event) => updateLessonField("weather", event.target.value)}
            placeholder="例如：晴 24℃"
          />
        </label>

        <div className="two-column">
          <div className="field member-picker-field" ref={memberPickerRef}>
            <span>学员</span>
            <input
              value={lessonForm.studentName}
              onFocus={() => setIsMemberPickerOpen(true)}
              onChange={(event) => {
                setScheduleMember(null);
                updateLessonField("studentName", event.target.value);
                setIsMemberPickerOpen(true);
              }}
              placeholder="选择或输入学员姓名"
            />

            {isMemberPickerOpen && (
              <div className="member-picker-menu">
                {filteredMembers.length > 0 ? (
                  filteredMembers.map((item) => (
                    <button
                      key={item.name}
                      type="button"
                      onClick={() => selectMemberFromPicker(item)}
                    >
                      <strong>{item.name}</strong>
                      <span>{item.goal || "暂无训练目标"} · 已上 {item.lessons || 0} 节</span>
                    </button>
                  ))
                ) : (
                  <p>没有匹配会员，可以直接输入新名字。</p>
                )}
              </div>
            )}
          </div>

          <label className="lesson-stepper">
            <span>课次</span>
            <div>
              <button
                type="button"
                disabled={lessonNumber <= 1}
                onClick={() => setLessonNumber((current) => Math.max(1, current - 1))}
              >
                -
              </button>

              <button
                type="button"
                className="lesson-number-button"
                onClick={() => setIsLessonPickerOpen(true)}
              >
                {lessonNumber}
              </button>

              <button
                type="button"
                disabled={lessonNumber >= maxSelectableLesson}
                onClick={() =>
                  setLessonNumber((current) =>
                    Math.min(maxSelectableLesson, current + 1)
                  )
                }
              >
                +
              </button>
            </div>
          </label>
        </div>

        <label className="field theme-field">
          <div className="theme-label-row">
            <span>课程主题</span>
            <button
              type="button"
              className={isThemeLinked ? "theme-link active" : "theme-link"}
              onClick={() => setIsThemeLinked((current) => !current)}
            >
              关联
            </button>
          </div>

          <input
            value={lessonForm.lessonTheme}
            onChange={(event) => updateLessonField("lessonTheme", event.target.value)}
            placeholder="例如：核心增强"
          />
        </label>

        <div className="theme-preset-strip">
          {themePresets.map((theme) => (
            <button
              key={theme}
              type="button"
              onClick={() => appendThemePreset(theme)}
            >
              {theme}
            </button>
          ))}

          <button type="button" className="theme-add-button" onClick={addThemePreset}>
            ＋新增
          </button>
        </div>
      </section>

      <section className="form-card">
        <div className="section-title compact">
          <h2>
            <ClipboardListIcon size={18} />
            训练动作详情
          </h2>
          <span>{actions.length} 个动作</span>
        </div>

        <div className="action-search-area" ref={actionSearchAreaRef}>
          <div className="action-toolbar">
            <div className="apparatus-picker" ref={apparatusPickerRef}>
              <button
                className="filter-button"
                onClick={() => setIsApparatusOpen((current) => !current)}
              >
                {selectedApparatusLabel} ▾
              </button>

              {isApparatusOpen && (
                <div className="apparatus-menu">
                  {apparatusOptions.map((item) => (
                    <button
                      key={item.key}
                      className={selectedApparatus === item.key ? "selected" : ""}
                      onClick={() => {
                        setSelectedApparatus(item.key);
                        setIsApparatusOpen(false);
                        openRecommendationPanel();
                      }}
                    >
                      <strong>{item.label}</strong>
                      <span>{item.desc}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <label className="action-search-input">
              <SearchIcon size={18} />
              <input
                ref={searchInputRef}
                value={searchKeyword}
                onFocus={openRecommendationPanel}
                onChange={(event) => {
                  setSearchKeyword(event.target.value);
                  openRecommendationPanel();
                }}
                placeholder="输入动作关键词"
              />
            </label>

            <button
              className="add-button"
              onClick={() => {
                if (recommendedActions[0]) addAction(recommendedActions[0]);
              }}
            >
              <PlusIcon size={22} />
            </button>
          </div>

          {isRecommendationOpen && (
            <>
              <div className="quick-recommend-title">
                <strong>推荐动作</strong>
                <span>点选后继续停留，可连续添加</span>
              </div>

              <div className="search-results recommendation-results">
                {recommendedActions.map((action) => (
                  <button key={action.id} onClick={() => addAction(action)}>
                    <div>
                      <strong>{action.displayName}</strong>
                      <span>{action.defaultBenefit}</span>
                    </div>
                    <em>{action.apparatus}</em>
                  </button>
                ))}

                {recommendedActions.length === 0 && (
                  <p className="empty-result">没有找到动作，可以之后做“临时新增动作”。</p>
                )}
              </div>
            </>
          )}
        </div>

        <div className="action-list">
          {actions.map((action, index) => (
            <div className="action-card" key={action.id}>
              <div className="action-card-top">
                <div className="action-number">{index + 1}</div>
                <div className="action-title-wrap">
                  <strong className="action-name">{action.name}</strong>
                  <span>{getApparatusLabel(action.apparatus)} · {action.rawName || action.cnName || action.name}</span>
                </div>
                <button className="delete-mini" onClick={() => deleteAction(action.id)}>
                  ×
                </button>
              </div>

              <label className="action-line">
                <span>好处</span>
                <textarea
                  value={action.benefit}
                  onChange={(event) => updateActionField(action.id, "benefit", event.target.value)}
                  placeholder="输入这个动作本节课的训练好处..."
                />
              </label>

              <label className="action-line">
                <span>点评</span>
                <textarea
                  value={action.comment}
                  onChange={(event) => updateActionField(action.id, "comment", event.target.value)}
                  placeholder="输入动作点评，可不填..."
                />
              </label>
            </div>
          ))}
        </div>
      </section>

      <section className="form-card bottom-space">
        <h2>
          <FileTextIcon size={18} />
          课后总结 / 二天身体反馈
        </h2>
        <textarea
          className="summary-box"
          placeholder="输入课后总结或二天身体反馈建议..."
          value={lessonForm.summary}
          onChange={(event) => updateLessonField("summary", event.target.value)}
        />
      </section>

     <div className="poster-theme-panel">
  <div className="poster-theme-topline">
    <strong>
      <PaletteIcon size={17} />
      海报主题
    </strong>
  </div>

  <div className="poster-theme-strip">
    {posterThemeOptions.map((theme) => (
      <button
        key={theme.key}
        type="button"
        className={selectedPosterTheme === theme.key ? "active" : ""}
        onClick={() => setSelectedPosterTheme(theme.key)}
      >
        {theme.label}
      </button>
    ))}
  </div>
</div>
    <div className="lesson-bottom-actions course-save-actions">
  <button className="poster-tool-action danger-action" onClick={clearCurrentDraft}>
    <TrashIcon size={20} />
    <span>清空</span>
  </button>

  <button className="poster-tool-action light-action" onClick={saveCurrentLesson}>
    <SaveIcon size={20} />
    <span>保存</span>
  </button>

  <button
    type="button"
    className="poster-tool-action light-action"
    onClick={() => setIsPosterPreviewOpen(true)}
  >
    <EyeIcon size={20} />
    <span>预览</span>
  </button>

  <button className="poster-tool-action main-action" onClick={generatePoster} disabled={isPosterGenerating}>
    <ImageIcon size={20} />
    <span>{isPosterGenerating ? "生成中" : "生成"}</span>
  </button>
</div>

     {isPosterGenerating && (
  <div className="modal-backdrop poster-loading-backdrop" role="status" aria-live="polite">
    <div className="poster-loading-sheet" onClick={(event) => event.stopPropagation()}>
      <span className="poster-loading-spinner" aria-hidden="true" />
      <strong>努力生成中</strong>
      <p>高清海报正在生成，请稍等一下。</p>
    </div>
  </div>
)}

     {generatedPosterUrl && (
  <div className="modal-backdrop" onClick={() => setGeneratedPosterUrl("")}>
    <div
      className="modal-sheet poster-result-sheet"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="modal-header">
        <div>
          <h2>海报已生成</h2>
          <p>保存高清原图，或在浏览器中打开。</p>
        </div>
        <button onClick={() => setGeneratedPosterUrl("")}>×</button>
      </div>

      <div className="poster-result-image-wrap">
        <img src={generatedPosterUrl} alt="生成的课后海报" />
      </div>

      <div className="poster-result-actions">
        <button
          type="button"
          className="main-wide-button"
          onClick={saveGeneratedPosterImage}
        >
          保存高清原图
        </button>
        <button
          type="button"
          className="poster-result-link"
          onClick={openGeneratedPosterOriginal}
        >
          点击这里，在浏览器中打开高清原图
        </button>
      </div>
    </div>
  </div>
)}
      {isPosterPreviewOpen && (
  <div className="modal-backdrop" onClick={() => setIsPosterPreviewOpen(false)}>
    <div
      className="modal-sheet small-modal-sheet"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="modal-header">
        <div>
          <h2>海报预览</h2>
          <p>
            当前主题：
            {posterThemeOptions.find((item) => item.key === selectedPosterTheme)?.label}
          </p>
        </div>
        <button onClick={() => setIsPosterPreviewOpen(false)}>×</button>
      </div>

      <div className="poster-preview-placeholder">
        <strong>预览图待添加</strong>
        <p>
          后面放入 5 张假人示例图后，这里会根据当前主题显示对应预览。
        </p>
      </div>
    </div>
  </div>
)}
      {isLessonPickerOpen && (
        <div className="modal-backdrop" onClick={() => setIsLessonPickerOpen(false)}>
          <div
            className="modal-sheet small-modal-sheet"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h2>选择课次</h2>
                <p>可快速切换已上过的历史课次和当前新课。</p>
              </div>
              <button onClick={() => setIsLessonPickerOpen(false)}>×</button>
            </div>

            <div className="lesson-picker-grid">
              {lessonOptions.map((number) => (
                <button
                  key={number}
                  className={lessonNumber === number ? "active" : ""}
                  onClick={() => {
                    setLessonNumber(number);
                    setIsLessonPickerOpen(false);
                  }}
                >
                  第{number}节
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {isQuickPanelOpen && (
        <div className="modal-backdrop">
          <div className="modal-sheet">
            <div className="modal-header">
              <div>
                <h2>快速排课</h2>
                <p>选择一种方式快速生成本节课动作</p>
              </div>
              <button onClick={() => setIsQuickPanelOpen(false)}>×</button>
            </div>

            <div className="quick-mode-tabs">
              <button className={quickMode === "templates" ? "active" : ""} onClick={() => setQuickMode("templates")}>
                套用模板
              </button>
              <button className={quickMode === "paste" ? "active" : ""} onClick={() => setQuickMode("paste")}>
                粘贴排课
              </button>
              <button className={quickMode === "history" ? "active" : ""} onClick={() => setQuickMode("history")}>
                复制历史
              </button>
            </div>

            {quickMode === "templates" && (
              <div className="template-list">
                {templates.map((template) => (
                  <button key={template.id} onClick={() => applyTemplate(template)}>
                    <strong>{template.name}</strong>
                    <span>{template.desc}</span>
                    <em>{template.actions.length} 个动作</em>
                  </button>
                ))}
              </div>
            )}

            {quickMode === "paste" && (
              <div className="paste-panel">
                <textarea
                  value={pasteText}
                  onChange={(event) => setPasteText(event.target.value)}
                  placeholder={`例如：\nR 臀桥\n今天骨盆控制不错\nM 四足游泳\n右肩容易耸肩\n总结：今天核心稳定更好`}
                />

                <button className="main-wide-button" onClick={handleParsePasteText}>
                  解析文本
                </button>

                {parsedRows.length > 0 && (
                  <div className="parsed-list">
                    <h3>确认解析结果</h3>
                    {parsedRows.map((row, index) => (
                      <div className="parsed-row" key={row.id}>
                        <div className="parsed-index">{index + 1}</div>
                        <div className="parsed-content">
                          <strong>{row.rawText}</strong>
                          <div className="type-switch">
                            {["action", "comment", "summary"].map((type) => (
                              <button
                                key={type}
                                className={row.type === type ? "active" : ""}
                                onClick={() => updateParsedRowType(row.id, type)}
                              >
                                {type === "action" ? "动作" : type === "comment" ? "点评" : "总结"}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}

                    <button className="main-wide-button" onClick={importParsedRows}>
                      一键导入
                    </button>
                  </div>
                )}
              </div>
            )}

            {quickMode === "history" && (
              <div className="empty-quick-panel">
                <strong>复制历史课程</strong>
                <p>等课程保存和会员历史稳定后，这里会显示第1节到第N节，可任选一节复制后修改。</p>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function MembersPage({ members, onOpenSchedule, onMembersUpdated }) {
  const [keyword, setKeyword] = useState("");
  const [editingMember, setEditingMember] = useState(null);
  const [originalName, setOriginalName] = useState("");
  const [memberForm, setMemberForm] = useState({
    name: "",
    phone: "",
    goal: "",
    contraindications: "",
    lessons: 0,
    lastDate: "",
    avatarUrl: "",
  });

  const filteredMembers = useMemo(() => {
    const cleanKeyword = keyword.trim().toLowerCase();

    if (!cleanKeyword) return members;

    return members.filter((member) =>
      [member.name, member.phone, member.goal, member.contraindications, member.taboo]
        .join(" ")
        .toLowerCase()
        .includes(cleanKeyword)
    );
  }, [members, keyword]);

  function getMemberAvatar(member) {
    return (
      member.avatarUrl ||
      member.avatar ||
      member.photoUrl ||
      member.photo ||
      member.imageUrl ||
      ""
    );
  }

  function openMemberEditor(member = null) {
    const nextMember = member || {
      name: "",
      phone: "",
      goal: "",
      contraindications: "",
      lessons: 0,
      lastDate: "",
      avatarUrl: "",
    };

    setEditingMember(nextMember);
    setOriginalName(member?.name || "");
    setMemberForm({
      name: nextMember.name || "",
      phone: nextMember.phone || "",
      goal: nextMember.goal || "",
      contraindications: nextMember.contraindications || nextMember.taboo || "",
      lessons: Number(nextMember.lessons || 0),
      lastDate: nextMember.lastDate || "",
      avatarUrl: getMemberAvatar(nextMember),
    });
  }

  function updateMemberField(fieldName, nextValue) {
    setMemberForm((current) => ({
      ...current,
      [fieldName]: nextValue,
    }));
  }

  function saveMemberOnly() {
    if (!memberForm.name.trim()) return;

    const nextMembers = saveMemberProfile(memberForm, originalName);
    onMembersUpdated?.(nextMembers);
    setEditingMember(null);
    setOriginalName("");
  }

  function saveMemberAndSchedule() {
    if (!memberForm.name.trim()) return;

    const nextMembers = saveMemberProfile(memberForm, originalName);
    const savedMember =
      nextMembers.find((member) => member.name === memberForm.name.trim()) || memberForm;

    onMembersUpdated?.(nextMembers);
    onOpenSchedule(savedMember);
  }

  if (editingMember) {
    const avatarSrc = memberForm.avatarUrl;

    return (
      <section className="page members-page members-edit-page">
        <header className="members-edit-header">
          <button type="button" onClick={() => setEditingMember(null)} aria-label="返回">
            ‹
          </button>
          <h1>{originalName ? "编辑会员" : "新建会员"}</h1>
          <span />
        </header>

        <section className="members-edit-card members-profile-card">
          <div className="members-edit-avatar">
            {avatarSrc ? (
              <img src={avatarSrc} alt={`${memberForm.name || "会员"}头像`} />
            ) : (
              <span>{(memberForm.name || "会").slice(0, 1)}</span>
            )}
            <span className="members-camera-dot">
              <ImageIcon size={21} />
            </span>
          </div>

          <div className="members-form-list">
            <label>
              <span>姓名</span>
              <input
                value={memberForm.name}
                onChange={(event) => updateMemberField("name", event.target.value)}
                placeholder="输入会员姓名"
              />
            </label>
            <label>
              <span>手机号</span>
              <input
                value={memberForm.phone}
                onChange={(event) => updateMemberField("phone", event.target.value)}
                placeholder="例如：138****8000"
              />
            </label>
          </div>
        </section>

        <section className="members-edit-card">
          <h2>训练档案</h2>
          <div className="members-form-list">
            <label>
              <span>训练目标</span>
              <input
                value={memberForm.goal}
                onChange={(event) => updateMemberField("goal", event.target.value)}
                placeholder="例如：塑形翘臀 / 改善体态"
              />
            </label>
            <label>
              <span>禁忌症</span>
              <input
                value={memberForm.contraindications}
                onChange={(event) =>
                  updateMemberField("contraindications", event.target.value)
                }
                placeholder="无"
              />
            </label>
          </div>
        </section>

        <section className="members-edit-card">
          <h2>课程进度</h2>
          <div className="members-form-list">
            <label>
              <span>累计已上课次</span>
              <input
                type="number"
                min="0"
                inputMode="numeric"
                value={memberForm.lessons}
                onChange={(event) => updateMemberField("lessons", event.target.value)}
              />
            </label>
          </div>
          <p className="members-progress-note">
            例如填写18，则新建课程时自动从第19节开始
          </p>
        </section>

        <div className="members-edit-actions">
          <button type="button" onClick={saveMemberOnly}>
            保存资料
          </button>
          <button type="button" onClick={saveMemberAndSchedule}>
            新建课程
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="page members-page members-v2-page">
      <header className="members-v2-header">
        <h1>会员管理</h1>
        <button type="button" onClick={() => openMemberEditor()} aria-label="新建会员">
          <PlusIcon size={31} />
        </button>
      </header>

      <label className="members-v2-search">
        <SearchIcon size={21} />
        <input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="搜索会员..."
        />
      </label>

      <div className="members-v2-list">
        {filteredMembers.map((member) => {
          const avatarSrc = getMemberAvatar(member);

          return (
            <button
              className="members-v2-card"
              key={member.name}
              onClick={() => openMemberEditor(member)}
              type="button"
            >
              <span className="members-v2-avatar">
                {avatarSrc ? (
                  <img src={avatarSrc} alt={`${member.name}头像`} />
                ) : (
                  <span>{member.name.slice(0, 1)}</span>
                )}
              </span>
              <span className="members-v2-info">
                <strong>{member.name}</strong>
                <small>{member.phone || "未填写手机号"}</small>
                <em>目标：{member.goal || "暂无训练目标"}</em>
              </span>
              <span className="members-v2-lessons">{member.lessons || 0}节</span>
              <span className="members-v2-chevron" aria-hidden="true">
                ›
              </span>
            </button>
          );
        })}

        {filteredMembers.length === 0 && (
          <div className="members-v2-empty">没有匹配的会员</div>
        )}
      </div>
    </section>
  );
}

function SettingsPage({ languagePreference, setLanguagePreference }) {
  const initialData = useMemo(() => getAppData(), []);
  const [settingsView, setSettingsView] = useState("home");
  const [settingsForm, setSettingsForm] = useState({
    studioNameCn: initialData.settings?.studioNameCn || "北极星普拉提",
    studioNameEn: initialData.settings?.studioNameEn || "Polaris Pilates",
    coachName: initialData.settings?.coachName || "严老师",
    logoDataUrl: initialData.settings?.logoDataUrl || "",
  });

  const [templates, setTemplates] = useState(getTemplates());
  const [userActionMeta, setUserActionMeta] = useState(() => getUserActionMeta());
  const [actionLibraryVersion, setActionLibraryVersion] = useState(0);
  const [libraryApparatus, setLibraryApparatus] = useState("all");
  const [libraryKeyword, setLibraryKeyword] = useState("");
  const [tagTarget, setTagTarget] = useState(null);
  const [tagInput, setTagInput] = useState("");
  const [actionEditorOpen, setActionEditorOpen] = useState(false);
  const [editingAction, setEditingAction] = useState(null);
  const [actionDraft, setActionDraft] = useState({
    apparatus: "M",
    newApparatus: "",
    cnName: "",
    name: "",
    benefit: "",
    tags: "",
    isFavorite: false,
  });

  const [editingTemplateId, setEditingTemplateId] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [templateDesc, setTemplateDesc] = useState("");
  const [templateApparatus, setTemplateApparatus] = useState("all");
  const [templateKeyword, setTemplateKeyword] = useState("");
  const [selectedTemplateActions, setSelectedTemplateActions] = useState([]);

  const [settingsSavedMessage, setSettingsSavedMessage] = useState("");
  const [authUser, setAuthUser] = useState(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [authMode, setAuthMode] = useState("login");
  const [authConfirmPassword, setAuthConfirmPassword] = useState("");
  const [authVerificationCode, setAuthVerificationCode] = useState("");
  const [pendingSignUpVerification, setPendingSignUpVerification] = useState(null);
  const [pendingPasswordReset, setPendingPasswordReset] = useState(null);

  const allActions = useMemo(() => {
    return getAllActions(languagePreference);
  }, [languagePreference, userActionMeta, actionLibraryVersion]);

  const settingsApparatusOptions = useMemo(
    () => getDynamicApparatusOptions(allActions),
    [allActions]
  );

  const actionStats = useMemo(() => {
    const stats = {};

    allActions.forEach((action) => {
      const key = action.apparatus || "其他";
      stats[key] = (stats[key] || 0) + 1;
    });

    return stats;
  }, [allActions]);

  const libraryFilterOrder = [
    "all",
    "M",
    "R",
    "TT",
    "C",
    "LB",
    "SC",
    "P",
    "dumbbell",
    "kettlebell",
    "bosu",
    "favorite",
  ];
  const libraryFilterOptions = [
    ...libraryFilterOrder
      .map((key) => settingsApparatusOptions.find((item) => item.key === key))
      .filter(Boolean),
    ...settingsApparatusOptions.filter(
      (item) => !libraryFilterOrder.includes(item.key)
    ),
  ];
  const templateFilterKeys = ["all", "M", "R", "TT", "C", "LB"];
  const templateFilterOptions = templateFilterKeys.map((key) => (
    settingsApparatusOptions.find((item) => item.key === key) || { key, label: key }
  ));
  const editorApparatusOptions = settingsApparatusOptions.filter(
    (item) => item.key !== "all" && item.key !== "favorite"
  );

  const filteredLibraryActions = useMemo(() => {
    const keyword = libraryKeyword.trim().toLowerCase();

    return allActions
      .filter((action) => {
        if (libraryApparatus === "all") return true;
        if (libraryApparatus === "favorite") return action.isFavorite;
        return action.apparatus === libraryApparatus;
      })
      .filter((action) => {
        if (!keyword) return true;

        return [
          action.cnName,
          action.name,
          action.displayName,
          action.defaultBenefit,
          action.apparatus,
          ...(action.tags || []),
        ]
          .join(" ")
          .toLowerCase()
          .includes(keyword);
      });
  }, [allActions, libraryApparatus, libraryKeyword]);

  const libraryVisibleActions = filteredLibraryActions.slice(0, 120);

  const templateSearchActions = useMemo(() => {
    const keyword = templateKeyword.trim().toLowerCase();

    return allActions
      .filter((action) => {
        if (templateApparatus === "all") return true;
        return action.apparatus === templateApparatus;
      })
      .filter((action) => {
        if (!keyword) return true;

        return [action.cnName, action.name, action.displayName, action.apparatus]
          .join(" ")
          .toLowerCase()
          .includes(keyword);
      })
      .slice(0, 50);
  }, [allActions, templateApparatus, templateKeyword]);

  const languageLabelMap = {
    chinese: "中文优先",
    english: "英文优先",
    mixed: "中英对照",
  };

  function showSettingsMessage(message, duration = 1600) {
    setSettingsSavedMessage(message);
    window.setTimeout(() => setSettingsSavedMessage(""), duration);
  }

  function getActionMeta(actionId) {
    return userActionMeta[actionId] || {};
  }

  function parseTags(value) {
    return String(value || "")
      .split(/[、,，\s]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function toCloudActionMeta(actionId, meta = {}) {
    return {
      id: actionId,
      action_id: actionId,
      is_favorite: Boolean(meta.isFavorite),
      tags: Array.isArray(meta.tags) ? meta.tags : [],
      custom_cn_name: meta.customCnName || "",
      custom_en_name: meta.customEnName || "",
      custom_benefit: meta.customBenefit || "",
      apparatus: meta.apparatus || "",
      is_hidden: Boolean(meta.isHidden),
      is_custom_action: Boolean(meta.isCustomAction),
    };
  }

  function fromCloudActionMeta(row = {}) {
    return {
      isFavorite: Boolean(row.is_favorite),
      tags: Array.isArray(row.tags) ? row.tags : [],
      customCnName: row.custom_cn_name || "",
      customEnName: row.custom_en_name || "",
      customBenefit: row.custom_benefit || "",
      apparatus: row.apparatus || "",
      isHidden: Boolean(row.is_hidden),
      isCustomAction: Boolean(row.is_custom_action),
      updatedAt: row.updated_at || row.updatedAt || "",
    };
  }

  function persistActionMeta(actionId, patch) {
    const nextMetaMap = saveUserActionMeta(actionId, patch);
    const nextMeta = nextMetaMap[actionId] || {};

    setUserActionMeta(nextMetaMap);
    saveCloudUserActionMeta(toCloudActionMeta(actionId, nextMeta)).catch((error) => {
      console.warn("动作设置云端同步失败，已保存在本机", error);
    });

    return nextMetaMap;
  }

  function applyStudioSettings(settings) {
    if (!settings) return;

    setSettingsForm((current) => ({
      ...current,
      studioNameCn: settings.studioNameCn ?? current.studioNameCn,
      studioNameEn: settings.studioNameEn ?? current.studioNameEn,
      coachName: settings.coachName ?? current.coachName,
      logoDataUrl: settings.logoDataUrl ?? current.logoDataUrl,
    }));

    if (settings.languagePreference) {
      setLanguagePreference(settings.languagePreference);
    }
  }

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      const cloudUser = await getCloudSyncUser();

      if (mounted) {
        setAuthUser(cloudUser || null);
        setAuthEmail(cloudUser?.email || "");
      }
    }

    loadSession();

    const unsubscribeCloudBase = onCloudBaseAuthStateChange((user) => {
      setAuthUser(user || null);
      setAuthEmail(user?.email || "");
    });

    return () => {
      mounted = false;
      unsubscribeCloudBase();
    };
  }, []);

  useEffect(() => {
    if (!authUser) return undefined;

    let mounted = true;

    async function syncCloudState() {
      const studioResult = await loadCloudStudioSettings();

      if (mounted && studioResult.source === "cloud") {
        applyStudioSettings(studioResult.settings);
      }

      try {
        const cloudRows = await loadUserActionMeta();

        if (!mounted || !cloudRows.length) return;

        cloudRows.forEach((row) => {
          const actionId = row.action_id || row.id;
          if (!actionId) return;

          saveUserActionMeta(actionId, fromCloudActionMeta(row));
        });

        setUserActionMeta(getUserActionMeta());
      } catch (error) {
        console.warn("读取云端动作偏好失败，继续使用本机数据", error);
      }
    }

    syncCloudState();

    return () => {
      mounted = false;
    };
  }, [authUser?.id]);

  function getCleanAuthInput() {
    return {
      email: authEmail.trim(),
      password: authPassword.trim(),
      confirmPassword: authConfirmPassword.trim(),
      verificationCode: authVerificationCode.trim(),
    };
  }

  function isLikelyEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function getAuthErrorText(error, fallbackMessage) {
    return error?.message || error?.cloudbaseError?.message || fallbackMessage;
  }

  function openAuthMode(nextMode) {
    setAuthMode(nextMode);
    setAuthMessage("");
    setAuthVerificationCode("");
    setAuthConfirmPassword("");
    setPendingSignUpVerification(null);
    setPendingPasswordReset(null);

    if (nextMode === "reset" || authMode === "reset") {
      setAuthPassword("");
    }
  }

  function finishSignedInAuth(cloudUser, email, message) {
    setAuthUser(cloudUser);
    setAuthEmail(cloudUser?.email || email);
    setAuthPassword("");
    setAuthConfirmPassword("");
    setAuthVerificationCode("");
    setPendingSignUpVerification(null);
    setPendingPasswordReset(null);
    setAuthMode("login");
    setAuthMessage(message);
  }

  function validateAuthEmail(email) {
    if (!email) {
      setAuthMessage("请先填写邮箱");
      return false;
    }

    if (!isLikelyEmail(email)) {
      setAuthMessage("邮箱格式不正确");
      return false;
    }

    return true;
  }

  function validateNewPassword(password, confirmPassword) {
    if (!password || !confirmPassword) {
      setAuthMessage("请填写密码并确认一次");
      return false;
    }

    if (password.length < 6) {
      setAuthMessage("密码至少需要 6 位");
      return false;
    }

    if (password !== confirmPassword) {
      setAuthMessage("两次输入的密码不一致");
      return false;
    }

    return true;
  }

  async function handleEmailSignUp() {
    const { email, password, confirmPassword, verificationCode } = getCleanAuthInput();

    if (!validateAuthEmail(email)) {
      return;
    }

    if (!validateNewPassword(password, confirmPassword)) {
      return;
    }

    if (pendingSignUpVerification) {
      if (pendingSignUpVerification.email !== email || pendingSignUpVerification.password !== password) {
        setPendingSignUpVerification(null);
        setAuthVerificationCode("");
        setAuthMessage("邮箱或密码已修改，请重新发送验证码");
        return;
      }

      if (!verificationCode) {
        setAuthMessage("请输入邮箱验证码");
        return;
      }

      try {
        setAuthLoading(true);
        setAuthMessage("正在验证验证码...");

        const cloudUser = await verifyCloudBaseEmailSignUp(
          pendingSignUpVerification.verifyOtp,
          verificationCode,
          pendingSignUpVerification.messageId
        );

        finishSignedInAuth(cloudUser, email, "注册成功，已登录");
      } catch (error) {
        setAuthMessage(getAuthErrorText(error, "验证码验证失败，请检查后重试"));
      } finally {
        setAuthLoading(false);
      }

      return;
    }

    try {
      setAuthLoading(true);
      setAuthMessage("正在发送邮箱验证码...");

      const signUpResult = await requestCloudBaseEmailSignUp(email, password);

      if (signUpResult.user && !signUpResult.verifyOtp) {
        finishSignedInAuth(signUpResult.user, email, "注册成功，已登录");
        return;
      }

      if (!signUpResult.verifyOtp) {
        throw new Error("验证码会话创建失败，请重新发送验证码");
      }

      setPendingSignUpVerification({
        verifyOtp: signUpResult.verifyOtp,
        email,
        password,
        messageId: "",
      });
      setAuthVerificationCode("");
      setAuthMessage("验证码已发送，请输入邮箱里的验证码");
    } catch (error) {
      setAuthMessage(getAuthErrorText(error, "CloudBase 注册失败，请检查云开发身份认证"));
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleResendSignUpCode() {
    const { email, password, confirmPassword } = getCleanAuthInput();

    if (!pendingSignUpVerification) {
      await handleEmailSignUp();
      return;
    }

    if (!validateAuthEmail(email) || !validateNewPassword(password, confirmPassword)) {
      return;
    }

    if (pendingSignUpVerification.email !== email || pendingSignUpVerification.password !== password) {
      setPendingSignUpVerification(null);
      setAuthVerificationCode("");
      setAuthMessage("邮箱或密码已修改，请重新发送验证码");
      return;
    }

    try {
      setAuthLoading(true);
      setAuthMessage("正在重新发送验证码...");

      const messageId = await resendCloudBaseEmailCode(email, "signup");

      setPendingSignUpVerification((current) => (
        current ? { ...current, messageId } : current
      ));
      setAuthVerificationCode("");
      setAuthMessage("新的验证码已发送");
    } catch (error) {
      setAuthMessage(getAuthErrorText(error, "验证码重新发送失败，请稍后再试"));
    } finally {
      setAuthLoading(false);
    }
  }

  async function handlePasswordReset() {
    const { email, password, confirmPassword, verificationCode } = getCleanAuthInput();

    if (!validateAuthEmail(email)) {
      return;
    }

    if (!pendingPasswordReset) {
      try {
        setAuthLoading(true);
        setAuthMessage("正在发送重置验证码...");

        const resetResult = await requestCloudBaseEmailPasswordReset(email);

        setPendingPasswordReset({
          updateUser: resetResult.updateUser,
          email,
        });
        setAuthVerificationCode("");
        setAuthMessage("重置验证码已发送，请输入邮箱里的验证码");
      } catch (error) {
        setAuthMessage(getAuthErrorText(error, "重置验证码发送失败，请检查邮箱"));
      } finally {
        setAuthLoading(false);
      }

      return;
    }

    if (pendingPasswordReset.email !== email) {
      setPendingPasswordReset(null);
      setAuthVerificationCode("");
      setAuthMessage("邮箱已修改，请重新发送重置验证码");
      return;
    }

    if (!validateNewPassword(password, confirmPassword)) {
      return;
    }

    if (!verificationCode) {
      setAuthMessage("请输入邮箱验证码");
      return;
    }

    try {
      setAuthLoading(true);
      setAuthMessage("正在重置密码...");

      const cloudUser = await verifyCloudBaseEmailPasswordReset(
        pendingPasswordReset.updateUser,
        verificationCode,
        password
      );

      finishSignedInAuth(cloudUser, email, "密码已重置，已登录");
    } catch (error) {
      setAuthMessage(getAuthErrorText(error, "密码重置失败，请检查验证码"));
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleResendPasswordResetCode() {
    const { email } = getCleanAuthInput();

    if (!validateAuthEmail(email)) {
      return;
    }

    try {
      setAuthLoading(true);
      setAuthMessage("正在重新发送重置验证码...");

      const resetResult = await requestCloudBaseEmailPasswordReset(email);

      setPendingPasswordReset({
        updateUser: resetResult.updateUser,
        email,
      });
      setAuthVerificationCode("");
      setAuthMessage("新的重置验证码已发送");
    } catch (error) {
      setAuthMessage(getAuthErrorText(error, "重置验证码重新发送失败，请稍后再试"));
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleEmailSignIn() {
    const { email, password } = getCleanAuthInput();

    if (!email || !password) {
      setAuthMessage("请先填写邮箱和密码");
      return;
    }

    if (!isLikelyEmail(email)) {
      setAuthMessage("邮箱格式不正确");
      return;
    }

    try {
      setAuthLoading(true);
      setAuthMessage("正在登录...");

      const cloudUser = await signInCloudBaseWithEmail(email, password);

      finishSignedInAuth(cloudUser, email, "登录成功");
    } catch (error) {
      setAuthMessage(getAuthErrorText(error, "CloudBase 登录失败，请检查邮箱或密码"));
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleEmailSignOut() {
    try {
      setAuthLoading(true);
      setAuthMessage("正在退出...");

      await signOutCloudBase();

      setAuthUser(null);
      setAuthPassword("");
      setAuthConfirmPassword("");
      setAuthVerificationCode("");
      setPendingSignUpVerification(null);
      setPendingPasswordReset(null);
      setAuthMode("login");
      setAuthMessage("已退出登录");
    } catch (error) {
      setAuthMessage(getAuthErrorText(error, "退出失败，请稍后再试"));
    } finally {
      setAuthLoading(false);
    }
  }

  function updateSettingsField(fieldName, value) {
    setSettingsForm((current) => ({
      ...current,
      [fieldName]: value,
    }));
  }

  function handleLogoUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showSettingsMessage("请上传图片格式的 Logo");
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const logoDataUrl = reader.result;

      setSettingsForm((current) => ({
        ...current,
        logoDataUrl,
      }));

      saveSettings({
        ...settingsForm,
        logoDataUrl,
        languagePreference,
      });

      showSettingsMessage("Logo 已上传");
    };

    reader.readAsDataURL(file);
  }

  function clearLogo() {
    const nextSettings = {
      ...settingsForm,
      logoDataUrl: "",
    };

    setSettingsForm(nextSettings);
    saveSettings({
      ...nextSettings,
      languagePreference,
    });
    showSettingsMessage("Logo 已清除");
  }

  async function saveStudioInfo() {
    const result = await saveCloudStudioSettings({
      ...settingsForm,
      languagePreference,
    });

    if (result.status === "cloud") {
      showSettingsMessage("工作室信息已同步");
    } else if (result.status === "cloud-error") {
      showSettingsMessage("本机已保存，云端同步失败");
    } else {
      showSettingsMessage("工作室信息已保存到本机");
    }
  }

  function chooseLanguagePreference(nextPreference) {
    setLanguagePreference(nextPreference);
    saveSettings({
      ...settingsForm,
      languagePreference: nextPreference,
    });
    showSettingsMessage("语言偏好已保存");
  }

  function updateLibraryFilter(nextApparatus) {
    setLibraryApparatus(nextApparatus);
  }

  function toggleFavorite(action) {
    const meta = getActionMeta(action.id);

    persistActionMeta(action.id, {
      ...meta,
      isFavorite: !(action.isFavorite || meta.isFavorite),
      tags: meta.tags || action.tags || [],
    });
  }

  function openTagEditor(action) {
    const meta = getActionMeta(action.id);

    setTagTarget(action);
    setTagInput((meta.tags || action.tags || []).join("、"));
  }

  function saveActionTags() {
    if (!tagTarget) return;

    const tags = parseTags(tagInput);
    const meta = getActionMeta(tagTarget.id);

    persistActionMeta(tagTarget.id, {
      ...meta,
      tags,
      isFavorite: Boolean(meta.isFavorite || tagTarget.isFavorite),
    });

    setTagTarget(null);
    setTagInput("");
    showSettingsMessage("标签已保存");
  }

  function openNewActionEditor() {
    setEditingAction(null);
    setActionDraft({
      apparatus: libraryApparatus !== "all" && libraryApparatus !== "favorite" ? libraryApparatus : "M",
      newApparatus: "",
      cnName: "",
      name: "",
      benefit: "",
      tags: "",
      isFavorite: false,
    });
    setActionEditorOpen(true);
  }

  function openEditActionEditor(action) {
    const meta = getActionMeta(action.id);

    setEditingAction(action);
    setActionDraft({
      apparatus: action.apparatus || meta.apparatus || "M",
      newApparatus: "",
      cnName: action.cnName || "",
      name: action.name || "",
      benefit: action.defaultBenefit || "",
      tags: (meta.tags || action.tags || []).join("、"),
      isFavorite: Boolean(action.isFavorite || meta.isFavorite),
    });
    setActionEditorOpen(true);
  }

  function saveActionEditor() {
    const cleanApparatus =
      actionDraft.apparatus === "__new__"
        ? actionDraft.newApparatus.trim()
        : actionDraft.apparatus;
    const cleanCnName = actionDraft.cnName.trim();
    const cleanName = actionDraft.name.trim();
    const cleanBenefit = actionDraft.benefit.trim();
    const tags = parseTags(actionDraft.tags);

    if (!cleanApparatus) {
      showSettingsMessage("请先选择或新增器械");
      return;
    }

    if (!cleanCnName && !cleanName) {
      showSettingsMessage("请至少填写中文名或英文名");
      return;
    }

    if (editingAction?.id) {
      if (editingAction.source === "custom") {
        saveCustomAction({
          id: editingAction.id,
          apparatus: cleanApparatus,
          cnName: cleanCnName || cleanName,
          name: cleanName || cleanCnName,
          defaultBenefit: cleanBenefit,
        });
      }

      persistActionMeta(editingAction.id, {
        ...getActionMeta(editingAction.id),
        apparatus: cleanApparatus,
        customCnName: cleanCnName || cleanName,
        customEnName: cleanName || cleanCnName,
        customBenefit: cleanBenefit,
        tags,
        isFavorite: actionDraft.isFavorite,
        isCustomAction: editingAction.source === "custom",
      });

      showSettingsMessage("动作已更新");
    } else {
      const savedAction = saveCustomAction({
        apparatus: cleanApparatus,
        cnName: cleanCnName || cleanName,
        name: cleanName || cleanCnName,
        defaultBenefit: cleanBenefit,
      });

      persistActionMeta(savedAction.id, {
        apparatus: cleanApparatus,
        tags,
        isFavorite: actionDraft.isFavorite,
        isCustomAction: true,
      });

      showSettingsMessage("动作已添加");
    }

    setActionEditorOpen(false);
    setEditingAction(null);
    setActionLibraryVersion((current) => current + 1);
  }

  function resetTemplateEditor() {
    setEditingTemplateId("");
    setTemplateName("");
    setTemplateDesc("");
    setTemplateApparatus("all");
    setTemplateKeyword("");
    setSelectedTemplateActions([]);
  }

  function openNewTemplatePage() {
    resetTemplateEditor();
    setSettingsView("templateEditor");
  }

  function openEditTemplatePage(template) {
    const loadedActions = (template.actions || []).map((item, index) => {
      const foundById = item.actionId
        ? allActions.find((action) => action.id === item.actionId)
        : null;
      const foundByBaseId = item.baseActionId
        ? allActions.find((action) => action.id === item.baseActionId)
        : null;
      const foundByKeyword =
        foundById || foundByBaseId
          ? null
          : allActions.find(
              (action) =>
                action.apparatus === item.apparatus &&
                [action.cnName, action.name, action.displayName]
                  .join(" ")
                  .includes(item.keyword || "")
            );
      const found = foundById || foundByBaseId || foundByKeyword;

      if (found) {
        return {
          id: found.id,
          apparatus: found.apparatus,
          cnName: found.cnName,
          name: found.name,
          keyword: found.cnName || found.name,
        };
      }

      return {
        id: item.actionId || item.baseActionId || `${item.apparatus}-${item.keyword}-${index}`,
        apparatus: item.apparatus || "M",
        cnName: item.keyword || "",
        name: "",
        keyword: item.keyword || "",
      };
    });

    setEditingTemplateId(template.id);
    setTemplateName(template.name || "");
    setTemplateDesc(template.desc || "");
    setTemplateApparatus("all");
    setTemplateKeyword("");
    setSelectedTemplateActions(loadedActions);
    setSettingsView("templateEditor");
  }

  function addActionToTemplate(action) {
    const exists = selectedTemplateActions.some((item) => item.id === action.id);
    if (exists) return;

    setSelectedTemplateActions((current) => [
      ...current,
      {
        id: action.id,
        apparatus: action.apparatus,
        cnName: action.cnName,
        name: action.name,
        keyword: action.cnName || action.name,
      },
    ]);
  }

  function removeActionFromTemplate(actionId) {
    setSelectedTemplateActions((current) =>
      current.filter((action) => action.id !== actionId)
    );
  }

  function moveTemplateAction(actionId, direction) {
    setSelectedTemplateActions((current) => {
      const index = current.findIndex((item) => item.id === actionId);
      if (index < 0) return current;

      const nextIndex = direction === "up" ? index - 1 : index + 1;
      if (nextIndex < 0 || nextIndex >= current.length) return current;

      const next = [...current];
      const temp = next[index];
      next[index] = next[nextIndex];
      next[nextIndex] = temp;

      return next;
    });
  }

  async function saveCurrentTemplate() {
    if (!templateName.trim()) {
      showSettingsMessage("请填写模板名称");
      return;
    }

    if (!selectedTemplateActions.length) {
      showSettingsMessage("请至少选择一个动作");
      return;
    }

    const templatePayload = {
      id: editingTemplateId || undefined,
      name: templateName.trim(),
      desc: templateDesc.trim(),
      actions: selectedTemplateActions.map((action) => ({
        actionId: action.id,
        apparatus: action.apparatus,
        keyword: action.keyword || action.cnName || action.name,
      })),
    };
    const nextTemplates = saveTemplate(templatePayload);
    const savedTemplate = nextTemplates.find(
      (template) => template.id === (editingTemplateId || nextTemplates[0]?.id)
    );

    setTemplates(nextTemplates);
    resetTemplateEditor();
    setSettingsView("templates");
    showSettingsMessage("模板已保存");

    if (savedTemplate) {
      try {
        await saveCloudTemplate(savedTemplate);
      } catch (error) {
        console.warn("模板云端同步失败，已保存在本机", error);
      }
    }
  }

  function removeTemplate(templateId) {
    setTemplates(deleteTemplate(templateId));
    showSettingsMessage("模板已删除");
  }

  function renderBackHeader(title, subtitle, backView = "home") {
    return (
      <header className="settings-v2-sub-header">
        <button
          type="button"
          className="settings-v2-back"
          onClick={() => {
            if (settingsView === "templateEditor") resetTemplateEditor();
            setSettingsView(backView);
          }}
        >
          ‹
        </button>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </header>
    );
  }

  function renderSettingsToast() {
    return settingsSavedMessage ? (
      <div className="save-toast settings-v2-toast">{settingsSavedMessage}</div>
    ) : null;
  }

  function renderSettingsHome() {
    return (
      <section className="page settings-v2-page">
        <header className="settings-v2-main-header">
          <h1>设置</h1>
          <p>管理账号、工作室和排课配置</p>
        </header>
        {renderSettingsToast()}

        <div className="settings-v2-group-title">
          <SettingsIcon size={16} />
          <span>账号与工作室</span>
        </div>
        <div className="settings-v2-card-list">
          <button type="button" className="settings-v2-nav-row" onClick={() => setSettingsView("account")}>
            <span className="settings-v2-icon-tile">
              <UsersIcon size={28} />
            </span>
            <span>
              <strong>账户管理</strong>
              <small>{authUser ? authUser.email : "邮箱注册 / 登录 / 云端同步"}</small>
            </span>
            <em>›</em>
          </button>
          <button type="button" className="settings-v2-nav-row" onClick={() => setSettingsView("studio")}>
            <span className="settings-v2-icon-tile">
              <HomeIcon size={28} />
            </span>
            <span>
              <strong>工作室信息</strong>
              <small>Logo、名称、首页称呼</small>
            </span>
            <em>›</em>
          </button>
        </div>

        <div className="settings-v2-group-title">
          <CalendarIcon size={16} />
          <span>排课配置</span>
        </div>
        <div className="settings-v2-card-list">
          <button type="button" className="settings-v2-nav-row" onClick={() => setSettingsView("library")}>
            <span className="settings-v2-icon-tile">
              <SparklesIcon size={28} />
            </span>
            <span>
              <strong>动作库管理</strong>
              <small>当前动作池 {allActions.length} 个，可搜索筛选</small>
            </span>
            <em>›</em>
          </button>
          <button type="button" className="settings-v2-nav-row" onClick={() => setSettingsView("templates")}>
            <span className="settings-v2-icon-tile">
              <ClipboardListIcon size={28} />
            </span>
            <span>
              <strong>课程模板管理</strong>
              <small>创建模板，排课页可套用</small>
            </span>
            <em>›</em>
          </button>
          <div className="settings-v2-nav-row settings-v2-language-row">
            <span className="settings-v2-icon-tile">文</span>
            <span>
              <strong>动作语言偏好</strong>
              <small>{languageLabelMap[languagePreference]}</small>
            </span>
            <select
              value={languagePreference}
              onChange={(event) => chooseLanguagePreference(event.target.value)}
            >
              <option value="chinese">中文优先</option>
              <option value="english">英文优先</option>
              <option value="mixed">中英对照</option>
            </select>
          </div>
        </div>

        <div className="settings-v2-group-title">
          <SaveIcon size={16} />
          <span>数据管理</span>
        </div>
        <div className="settings-v2-card-list">
          <button type="button" className="settings-v2-nav-row">
            <span className="settings-v2-icon-tile">
              <LogOutIcon size={26} />
            </span>
            <span>
              <strong>导出数据</strong>
            </span>
            <em>›</em>
          </button>
          <button type="button" className="settings-v2-nav-row">
            <span className="settings-v2-icon-tile">
              <LogInIcon size={26} />
            </span>
            <span>
              <strong>导入数据</strong>
            </span>
            <em>›</em>
          </button>
        </div>
      </section>
    );
  }

  function renderAccountPage() {
    return (
      <section className="page settings-v2-page settings-v2-sub-page">
        {renderBackHeader("账户管理", "邮箱注册 / 登录 / 云端同步")}
        {renderSettingsToast()}

        <div className="settings-v2-panel account-v2-panel">
          <div className="account-v2-status">
            <span className="settings-v2-icon-tile">
              {authUser ? <UsersIcon size={30} /> : <MailIcon size={30} />}
            </span>
            <span>
              <strong>{authUser ? "已登录" : "未登录"}</strong>
              <small>
                {authUser
                  ? authUser.email
                  : "登录后可同步您的工作室信息、动作设置与模板。"}
              </small>
            </span>
          </div>

          {!authUser && (
            <div className="settings-v2-auth-flow">
              {authMode === "login" && (
                <>
                  <label className="settings-v2-field">
                    <span>邮箱</span>
                    <div>
                      <MailIcon size={18} />
                      <input
                        value={authEmail}
                        onChange={(event) => setAuthEmail(event.target.value)}
                        placeholder="请输入邮箱"
                        type="email"
                        autoComplete="email"
                      />
                    </div>
                  </label>
                  <label className="settings-v2-field">
                    <span>密码</span>
                    <div>
                      <LockIcon size={18} />
                      <input
                        value={authPassword}
                        onChange={(event) => setAuthPassword(event.target.value)}
                        placeholder="请输入密码"
                        type="password"
                        autoComplete="current-password"
                      />
                    </div>
                  </label>
                  <div className="settings-v2-two-actions">
                    <button type="button" className="settings-v2-primary" onClick={handleEmailSignIn} disabled={authLoading}>
                      登录
                    </button>
                    <button type="button" className="settings-v2-secondary" onClick={() => openAuthMode("register")} disabled={authLoading}>
                      注册
                    </button>
                  </div>
                  <button type="button" className="settings-v2-link-button" onClick={() => openAuthMode("reset")} disabled={authLoading}>
                    忘记密码？
                  </button>
                </>
              )}

              {authMode === "register" && (
                <>
                  <div className="settings-v2-auth-head">
                    <strong>注册账号</strong>
                    <button type="button" onClick={() => openAuthMode("login")} disabled={authLoading}>
                      返回登录
                    </button>
                  </div>
                  <label className="settings-v2-field">
                    <span>邮箱</span>
                    <div>
                      <MailIcon size={18} />
                      <input
                        value={authEmail}
                        onChange={(event) => setAuthEmail(event.target.value)}
                        placeholder="请输入邮箱"
                        type="email"
                        autoComplete="email"
                      />
                    </div>
                  </label>
                  <label className="settings-v2-field">
                    <span>密码</span>
                    <div>
                      <LockIcon size={18} />
                      <input
                        value={authPassword}
                        onChange={(event) => setAuthPassword(event.target.value)}
                        placeholder="至少 6 位"
                        type="password"
                        autoComplete="new-password"
                      />
                    </div>
                  </label>
                  <label className="settings-v2-field">
                    <span>确认密码</span>
                    <div>
                      <LockIcon size={18} />
                      <input
                        value={authConfirmPassword}
                        onChange={(event) => setAuthConfirmPassword(event.target.value)}
                        placeholder="再次输入密码"
                        type="password"
                        autoComplete="new-password"
                      />
                    </div>
                  </label>
                  <label className="settings-v2-field">
                    <span>邮箱验证码</span>
                    <div>
                      <MailIcon size={18} />
                      <input
                        value={authVerificationCode}
                        onChange={(event) => setAuthVerificationCode(event.target.value)}
                        placeholder="请输入验证码"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                      />
                    </div>
                  </label>
                  <button type="button" className="settings-v2-primary settings-v2-wide" onClick={handleEmailSignUp} disabled={authLoading}>
                    {pendingSignUpVerification ? "完成注册并登录" : "发送验证码"}
                  </button>
                  {pendingSignUpVerification && (
                    <button type="button" className="settings-v2-link-button" onClick={handleResendSignUpCode} disabled={authLoading}>
                      重新发送验证码
                    </button>
                  )}
                </>
              )}

              {authMode === "reset" && (
                <>
                  <div className="settings-v2-auth-head">
                    <strong>找回密码</strong>
                    <button type="button" onClick={() => openAuthMode("login")} disabled={authLoading}>
                      返回登录
                    </button>
                  </div>
                  <label className="settings-v2-field">
                    <span>邮箱</span>
                    <div>
                      <MailIcon size={18} />
                      <input
                        value={authEmail}
                        onChange={(event) => setAuthEmail(event.target.value)}
                        placeholder="请输入邮箱"
                        type="email"
                        autoComplete="email"
                      />
                    </div>
                  </label>
                  <label className="settings-v2-field">
                    <span>新密码</span>
                    <div>
                      <LockIcon size={18} />
                      <input
                        value={authPassword}
                        onChange={(event) => setAuthPassword(event.target.value)}
                        placeholder="至少 6 位"
                        type="password"
                        autoComplete="new-password"
                      />
                    </div>
                  </label>
                  <label className="settings-v2-field">
                    <span>确认新密码</span>
                    <div>
                      <LockIcon size={18} />
                      <input
                        value={authConfirmPassword}
                        onChange={(event) => setAuthConfirmPassword(event.target.value)}
                        placeholder="再次输入新密码"
                        type="password"
                        autoComplete="new-password"
                      />
                    </div>
                  </label>
                  <label className="settings-v2-field">
                    <span>邮箱验证码</span>
                    <div>
                      <MailIcon size={18} />
                      <input
                        value={authVerificationCode}
                        onChange={(event) => setAuthVerificationCode(event.target.value)}
                        placeholder="请输入验证码"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                      />
                    </div>
                  </label>
                  <button type="button" className="settings-v2-primary settings-v2-wide" onClick={handlePasswordReset} disabled={authLoading}>
                    {pendingPasswordReset ? "重设并登录" : "发送重置验证码"}
                  </button>
                  {pendingPasswordReset && (
                    <button type="button" className="settings-v2-link-button" onClick={handleResendPasswordResetCode} disabled={authLoading}>
                      重新发送验证码
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {authUser && (
            <button type="button" className="settings-v2-secondary" onClick={handleEmailSignOut} disabled={authLoading}>
              退出登录
            </button>
          )}

          {authMessage && <p className="settings-v2-note">{authMessage}</p>}
        </div>

        <div className="settings-v2-panel account-v2-sync">
          <span className="settings-v2-icon-tile">
            <SaveIcon size={28} />
          </span>
          <div>
            <strong>云端同步</strong>
            <p>同一邮箱登录后，工作室、动作偏好、标签、收藏与模板会优先跟随账号。</p>
          </div>
        </div>
      </section>
    );
  }

  function renderStudioPage() {
    return (
      <section className="page settings-v2-page settings-v2-sub-page">
        {renderBackHeader("工作室信息", "Logo、名称与首页称呼")}
        {renderSettingsToast()}

        <div className="settings-v2-panel studio-v2-panel">
          <div className="studio-v2-logo-row">
            <label className="studio-v2-logo-upload">
              {settingsForm.logoDataUrl ? (
                <img src={settingsForm.logoDataUrl} alt="工作室 Logo" />
              ) : (
                <>
                  <SaveIcon size={38} />
                  <span>上传 Logo</span>
                </>
              )}
              <input type="file" accept="image/*" onChange={handleLogoUpload} />
            </label>
            <div>
              <strong>工作室 Logo</strong>
              <p>将在课程页面、会员端及相关场景中展示。</p>
              {settingsForm.logoDataUrl && (
                <button type="button" onClick={clearLogo}>清除 Logo</button>
              )}
            </div>
          </div>

          <label className="settings-v2-plain-field">
            <span>中文名称</span>
            <input
              value={settingsForm.studioNameCn || ""}
              onChange={(event) => updateSettingsField("studioNameCn", event.target.value)}
              placeholder="例如：北极星普拉提"
            />
          </label>
          <label className="settings-v2-plain-field">
            <span>英文名称</span>
            <input
              value={settingsForm.studioNameEn || ""}
              onChange={(event) => updateSettingsField("studioNameEn", event.target.value)}
              placeholder="例如：Polaris Pilates"
            />
          </label>
          <label className="settings-v2-plain-field">
            <span>首页称呼</span>
            <input
              value={settingsForm.coachName || ""}
              onChange={(event) => updateSettingsField("coachName", event.target.value)}
              placeholder="例如：严老师"
            />
          </label>

          <button type="button" className="settings-v2-primary settings-v2-wide" onClick={saveStudioInfo}>
            保存工作室信息
          </button>
        </div>
      </section>
    );
  }

  function renderLibraryPage() {
    return (
      <section className="page settings-v2-page settings-v2-sub-page settings-v2-library-page">
        {renderBackHeader("动作库管理", "查看、搜索与筛选动作")}
        {renderSettingsToast()}

        <div className="settings-v2-summary-card">
          <span className="settings-v2-icon-tile">
            <SparklesIcon size={30} />
          </span>
          <div>
            <strong>动作池 {allActions.length} 个</strong>
            <p>
              M {actionStats.M || 0} · R {actionStats.R || 0} · TT {actionStats.TT || 0} · C {actionStats.C || 0} · LB {actionStats.LB || 0}
            </p>
          </div>
        </div>

        <div className="settings-v2-filter-row">
          {libraryFilterOptions.map((item) => (
            <button
              key={item.key}
              type="button"
              className={libraryApparatus === item.key ? "active" : ""}
              onClick={() => updateLibraryFilter(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <label className="settings-v2-search">
          <SearchIcon size={18} />
          <input
            value={libraryKeyword}
            onChange={(event) => setLibraryKeyword(event.target.value)}
            placeholder="搜索动作名称 / 好处关键词"
          />
        </label>

        <div className="settings-v2-action-list">
          {libraryVisibleActions.map((action) => {
            const meta = getActionMeta(action.id);
            const tags = meta.tags || action.tags || [];
            const isFavorite = Boolean(action.isFavorite || meta.isFavorite);

            return (
              <article key={action.id} className="settings-v2-action-row">
                <button type="button" className="settings-v2-action-main" onClick={() => openEditActionEditor(action)}>
                  <em>{action.apparatus}</em>
                  <span>
                    <strong>
                      {action.cnName || action.name}
                      {action.cnName && action.name ? ` / ${action.name}` : ""}
                    </strong>
                    <small>{action.defaultBenefit || "暂无动作好处"}</small>
                    {tags.length > 0 && (
                      <span className="settings-v2-tag-strip">
                        {tags.map((tag) => (
                          <b key={tag}>{tag}</b>
                        ))}
                      </span>
                    )}
                  </span>
                  <i>›</i>
                </button>
                <div className="settings-v2-action-tools">
                  <button type="button" onClick={() => openTagEditor(action)}>打标签</button>
                  <button
                    type="button"
                    className={isFavorite ? "active" : ""}
                    onClick={() => toggleFavorite(action)}
                  >
                    {isFavorite ? "已收藏" : "收藏"}
                  </button>
                </div>
              </article>
            );
          })}

          {filteredLibraryActions.length > libraryVisibleActions.length && (
            <p className="settings-v2-list-note">
              已显示前 {libraryVisibleActions.length} 个动作，可继续输入关键词缩小范围。
            </p>
          )}
        </div>

        <button type="button" className="settings-v2-floating-add" onClick={openNewActionEditor}>
          <PlusIcon size={27} />
        </button>
      </section>
    );
  }

  function renderTemplatesPage() {
    return (
      <section className="page settings-v2-page settings-v2-sub-page settings-v2-template-page">
        {renderBackHeader("课程模板管理", "创建模板，排课页可直接套用")}
        {renderSettingsToast()}

        <div className="settings-v2-summary-card settings-v2-template-summary">
          <span className="settings-v2-icon-tile">
            <ClipboardListIcon size={30} />
          </span>
          <strong>已有模板 <b>{templates.length}</b> 个</strong>
          <button type="button" onClick={openNewTemplatePage}>
            + 新建模板
          </button>
        </div>

        <div className="settings-v2-template-list">
          {templates.length > 0 ? (
            templates.map((template) => (
              <article key={template.id} className="settings-v2-template-row">
                <button type="button" onClick={() => openEditTemplatePage(template)}>
                  <span className="settings-v2-icon-tile">
                    <ClipboardListIcon size={24} />
                  </span>
                  <span>
                    <strong>{template.name}</strong>
                    <small>
                      {template.actions?.length || 0} 个动作
                      {template.desc ? ` · ${template.desc}` : ""}
                    </small>
                  </span>
                  <em>›</em>
                </button>
                <div>
                  <button type="button" onClick={() => openEditTemplatePage(template)}>编辑</button>
                  <button type="button" onClick={() => removeTemplate(template.id)}>删除</button>
                </div>
              </article>
            ))
          ) : (
            <p className="settings-v2-list-note">暂无模板，点击“新建模板”创建第一个模板。</p>
          )}
        </div>
      </section>
    );
  }

  function renderTemplateEditorPage() {
    return (
      <section className="page settings-v2-page settings-v2-sub-page settings-v2-template-editor-page">
        {renderBackHeader(editingTemplateId ? "编辑模板" : "新建模板", "选择动作并保存为排课模板", "templates")}
        {renderSettingsToast()}

        <div className="settings-v2-panel">
          <label className="settings-v2-plain-field">
            <span>模板名称</span>
            <input
              value={templateName}
              onChange={(event) => setTemplateName(event.target.value)}
              placeholder="例如：肩颈理疗 / 核心增强"
            />
          </label>
          <label className="settings-v2-plain-field">
            <span>模板说明</span>
            <input
              value={templateDesc}
              onChange={(event) => setTemplateDesc(event.target.value)}
              placeholder="例如：适合久坐肩颈紧张"
            />
          </label>
        </div>

        {selectedTemplateActions.length > 0 && (
          <div className="settings-v2-selected-actions">
            {selectedTemplateActions.map((action, index) => (
              <div key={action.id}>
                <span>{index + 1}. {action.apparatus} · {action.cnName || action.name}</span>
                <button type="button" onClick={() => moveTemplateAction(action.id, "up")}>↑</button>
                <button type="button" onClick={() => moveTemplateAction(action.id, "down")}>↓</button>
                <button type="button" onClick={() => removeActionFromTemplate(action.id)}>×</button>
              </div>
            ))}
          </div>
        )}

        <div className="settings-v2-filter-row">
          {templateFilterOptions.map((item) => (
            <button
              key={item.key}
              type="button"
              className={templateApparatus === item.key ? "active" : ""}
              onClick={() => setTemplateApparatus(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <label className="settings-v2-search">
          <SearchIcon size={18} />
          <input
            value={templateKeyword}
            onChange={(event) => setTemplateKeyword(event.target.value)}
            placeholder="从动作库添加动作"
          />
        </label>

        <div className="settings-v2-template-picker">
          {templateSearchActions.map((action) => {
            const selected = selectedTemplateActions.some((item) => item.id === action.id);

            return (
              <button
                key={action.id}
                type="button"
                className={selected ? "selected" : ""}
                onClick={() => addActionToTemplate(action)}
              >
                <em>{action.apparatus}</em>
                <span>
                  <strong>{action.cnName || action.name}</strong>
                  {action.cnName && action.name && <small>{action.name}</small>}
                </span>
                <b>{selected ? "已选" : "+"}</b>
              </button>
            );
          })}
        </div>

        <button type="button" className="settings-v2-primary settings-v2-wide" onClick={saveCurrentTemplate}>
          保存模板
        </button>
      </section>
    );
  }

  function renderActionEditor() {
    if (!actionEditorOpen) return null;

    return (
      <PortalLayer>
        <div className="modal-backdrop settings-v2-backdrop" onClick={() => setActionEditorOpen(false)}>
          <div className="modal-sheet settings-v2-action-editor" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>{editingAction ? "编辑动作" : "新增动作"}</h2>
                <p>填写器械、名称、好处、标签与收藏状态。</p>
              </div>
              <button type="button" onClick={() => setActionEditorOpen(false)}>×</button>
            </div>

            <label className="settings-v2-plain-field">
              <span>器械</span>
              <select
                value={actionDraft.apparatus}
                onChange={(event) =>
                  setActionDraft((current) => ({
                    ...current,
                    apparatus: event.target.value,
                  }))
                }
              >
                {editorApparatusOptions.map((item) => (
                  <option key={item.key} value={item.key}>{item.label}</option>
                ))}
                <option value="__new__">+ 新增器械</option>
              </select>
            </label>

            {actionDraft.apparatus === "__new__" && (
              <label className="settings-v2-plain-field">
                <span>新器械</span>
                <input
                  value={actionDraft.newApparatus}
                  onChange={(event) =>
                    setActionDraft((current) => ({
                      ...current,
                      newApparatus: event.target.value,
                    }))
                  }
                  placeholder="例如：狐狸 / FOX"
                />
              </label>
            )}

            <label className="settings-v2-plain-field">
              <span>中文名</span>
              <input
                value={actionDraft.cnName}
                onChange={(event) =>
                  setActionDraft((current) => ({
                    ...current,
                    cnName: event.target.value,
                  }))
                }
                placeholder="例如：狐狸摇摆"
              />
            </label>
            <label className="settings-v2-plain-field">
              <span>英文名</span>
              <input
                value={actionDraft.name}
                onChange={(event) =>
                  setActionDraft((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="可选"
              />
            </label>
            <label className="settings-v2-plain-field">
              <span>动作好处</span>
              <textarea
                value={actionDraft.benefit}
                onChange={(event) =>
                  setActionDraft((current) => ({
                    ...current,
                    benefit: event.target.value,
                  }))
                }
                placeholder="例如：强化下腰背和臀部"
              />
            </label>
            <label className="settings-v2-plain-field">
              <span>标签</span>
              <input
                value={actionDraft.tags}
                onChange={(event) =>
                  setActionDraft((current) => ({
                    ...current,
                    tags: event.target.value,
                  }))
                }
                placeholder="例如：臀腿、核心、肩颈"
              />
            </label>
            <label className="settings-v2-checkbox">
              <input
                type="checkbox"
                checked={actionDraft.isFavorite}
                onChange={(event) =>
                  setActionDraft((current) => ({
                    ...current,
                    isFavorite: event.target.checked,
                  }))
                }
              />
              <span>收藏动作</span>
            </label>

            <button type="button" className="settings-v2-primary settings-v2-wide" onClick={saveActionEditor}>
              保存动作
            </button>
          </div>
        </div>
      </PortalLayer>
    );
  }

  function renderTagEditor() {
    if (!tagTarget) return null;

    return (
      <PortalLayer>
        <div className="modal-backdrop settings-v2-backdrop" onClick={() => setTagTarget(null)}>
          <div className="modal-sheet settings-v2-action-editor settings-v2-tag-editor" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>给动作打标签</h2>
                <p>{tagTarget.apparatus} · {tagTarget.cnName || tagTarget.name}</p>
              </div>
              <button type="button" onClick={() => setTagTarget(null)}>×</button>
            </div>
            <label className="settings-v2-plain-field">
              <span>主题标签</span>
              <input
                value={tagInput}
                onChange={(event) => setTagInput(event.target.value)}
                placeholder="例如：核心、臀腿、肩颈"
              />
            </label>
            <button type="button" className="settings-v2-primary settings-v2-wide" onClick={saveActionTags}>
              保存标签
            </button>
          </div>
        </div>
      </PortalLayer>
    );
  }

  const pageMap = {
    home: renderSettingsHome,
    account: renderAccountPage,
    studio: renderStudioPage,
    library: renderLibraryPage,
    templates: renderTemplatesPage,
    templateEditor: renderTemplateEditorPage,
  };
  const renderCurrentPage = pageMap[settingsView] || renderSettingsHome;

  return (
    <>
      {renderCurrentPage()}
      {renderActionEditor()}
      {renderTagEditor()}
    </>
  );
}

function LegacySettingsPage({ languagePreference, setLanguagePreference }) {
  const initialData = useMemo(() => getAppData(), []);

  const [openPanel, setOpenPanel] = useState("studio");

  const [settingsForm, setSettingsForm] = useState({
    studioNameCn: initialData.settings?.studioNameCn || "北极星普拉提",
    studioNameEn: initialData.settings?.studioNameEn || "Polaris Pilates",
    coachName: initialData.settings?.coachName || "严老师",
    logoDataUrl: initialData.settings?.logoDataUrl || "",
  });

  const [templates, setTemplates] = useState(getTemplates());

  const [libraryApparatus, setLibraryApparatus] = useState("all");
  const [libraryKeyword, setLibraryKeyword] = useState("");
  const [libraryPage, setLibraryPage] = useState(1);
  const [libraryModalOpen, setLibraryModalOpen] = useState(false);

  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [templateDesc, setTemplateDesc] = useState("");
  const [templateApparatus, setTemplateApparatus] = useState("all");
  const [templateKeyword, setTemplateKeyword] = useState("");
  const [selectedTemplateActions, setSelectedTemplateActions] = useState([]);

  const [tagTarget, setTagTarget] = useState(null);
  const [tagInput, setTagInput] = useState("");
  const [settingsSavedMessage, setSettingsSavedMessage] = useState("");
  const [authUser, setAuthUser] = useState(null);
const [authEmail, setAuthEmail] = useState("");
const [authPassword, setAuthPassword] = useState("");
const [authLoading, setAuthLoading] = useState(false);
const [authMessage, setAuthMessage] = useState("");

function applyStudioSettings(settings) {
  if (!settings) return;

  setSettingsForm((current) => ({
    ...current,
    studioNameCn: settings.studioNameCn ?? current.studioNameCn,
    studioNameEn: settings.studioNameEn ?? current.studioNameEn,
    coachName: settings.coachName ?? current.coachName,
    logoDataUrl: settings.logoDataUrl ?? current.logoDataUrl,
  }));

  if (settings.languagePreference) {
    setLanguagePreference(settings.languagePreference);
  }
}

useEffect(() => {
  let mounted = true;

  async function loadSession() {
    const cloudUser = await getCloudSyncUser();

    if (mounted) {
      setAuthUser(cloudUser || null);
      setAuthEmail(cloudUser?.email || "");
    }
  }

  loadSession();

  const unsubscribeCloudBase = onCloudBaseAuthStateChange((user) => {
    setAuthUser(user || null);
    setAuthEmail(user?.email || "");
  });

  return () => {
    mounted = false;
    unsubscribeCloudBase();
  };
}, []);

useEffect(() => {
  if (!authUser) return undefined;

  let mounted = true;

  async function syncStudioSettingsFromCloud() {
    const result = await loadCloudStudioSettings();

    if (!mounted || result.source !== "cloud") return;

    applyStudioSettings(result.settings);
  }

  syncStudioSettingsFromCloud();

  return () => {
    mounted = false;
  };
}, [authUser?.id]);

  const [favoriteIds, setFavoriteIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("pilates-action-favorites-v1") || "[]");
    } catch {
      return [];
    }
  });

  const [actionTags, setActionTags] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("pilates-action-tags-v1") || "{}");
    } catch {
      return {};
    }
  });

  const pageSize = 8;

  const allActions = useMemo(() => {
    return getAllActions(languagePreference);
  }, [languagePreference]);

  const actionStats = useMemo(() => {
    const stats = {};

    allActions.forEach((action) => {
      const key = action.apparatus || "其他";
      stats[key] = (stats[key] || 0) + 1;
    });

    return stats;
  }, [allActions]);

  const filterOptions = [
    { key: "all", label: "全部" },
    { key: "M", label: "M" },
    { key: "R", label: "R" },
    { key: "TT", label: "TT" },
    { key: "C", label: "C" },
    { key: "LB", label: "LB" },
    { key: "SC", label: "SC" },
    { key: "P", label: "P" },
  ];

  const filteredLibraryActions = useMemo(() => {
    const keyword = libraryKeyword.trim().toLowerCase();

    return allActions
      .filter((action) => {
        if (libraryApparatus === "all") return true;
        return action.apparatus === libraryApparatus;
      })
      .filter((action) => {
        if (!keyword) return true;

        return [
          action.cnName,
          action.name,
          action.displayName,
          action.defaultBenefit,
          action.apparatus,
        ]
          .join(" ")
          .toLowerCase()
          .includes(keyword);
      });
  }, [allActions, libraryApparatus, libraryKeyword]);

  const libraryTotalPages = Math.max(1, Math.ceil(filteredLibraryActions.length / pageSize));

  const pagedLibraryActions = useMemo(() => {
    const safePage = Math.min(libraryPage, libraryTotalPages);
    const start = (safePage - 1) * pageSize;
    return filteredLibraryActions.slice(start, start + pageSize);
  }, [filteredLibraryActions, libraryPage, libraryTotalPages]);

  const templateSearchActions = useMemo(() => {
    const keyword = templateKeyword.trim().toLowerCase();

    return allActions
      .filter((action) => {
        if (templateApparatus === "all") return true;
        return action.apparatus === templateApparatus;
      })
      .filter((action) => {
        if (!keyword) return true;

        return [action.cnName, action.name, action.displayName, action.apparatus]
          .join(" ")
          .toLowerCase()
          .includes(keyword);
      })
      .slice(0, 30);
  }, [allActions, templateApparatus, templateKeyword]);

  const languageLabelMap = {
    chinese: "中文优先",
    english: "英文优先",
    mixed: "中英对照",
  };

 function getCleanAuthInput() {
  return {
    email: authEmail.trim(),
    password: authPassword.trim(),
  };
}

async function handleEmailSignUp() {
  const { email, password } = getCleanAuthInput();

  if (!email || !password) {
    setAuthMessage("请先填写邮箱和密码");
    return;
  }

  if (password.length < 6) {
    setAuthMessage("密码至少需要 6 位");
    return;
  }

  try {
    setAuthLoading(true);
    setAuthMessage("正在注册...");

    await signUpCloudBaseWithEmail(email, password);
    const cloudUser = await signInCloudBaseWithEmail(email, password);

    setAuthUser(cloudUser);
    setAuthEmail(cloudUser?.email || email);
    setAuthPassword("");
    setAuthMessage("注册成功，已登录");
  } catch (error) {
    setAuthMessage(error.message || "CloudBase 注册失败，请检查云开发身份认证");
  } finally {
    setAuthLoading(false);
  }
}

async function handleEmailSignIn() {
  const { email, password } = getCleanAuthInput();

  if (!email || !password) {
    setAuthMessage("请先填写邮箱和密码");
    return;
  }

  try {
    setAuthLoading(true);
    setAuthMessage("正在登录...");

    const cloudUser = await signInCloudBaseWithEmail(email, password);

    setAuthUser(cloudUser);
    setAuthEmail(cloudUser?.email || email);
    setAuthMessage("登录成功");
    setAuthPassword("");
  } catch (error) {
    setAuthMessage(error.message || "CloudBase 登录失败，请检查邮箱或密码");
  } finally {
    setAuthLoading(false);
  }
}

async function handleEmailSignOut() {
  try {
    setAuthLoading(true);
    setAuthMessage("正在退出...");

    await signOutCloudBase();

    setAuthUser(null);
    setAuthPassword("");
    setAuthMessage("已退出登录");
  } catch (error) {
    setAuthMessage(error.message || "退出失败，请稍后再试");
  } finally {
    setAuthLoading(false);
  }
}
  function togglePanel(panelName) {
    setOpenPanel((current) => (current === panelName ? "" : panelName));
  }

  function updateLibraryFilter(nextApparatus) {
    setLibraryApparatus(nextApparatus);
    setLibraryPage(1);
  }

  function updateLibraryKeyword(nextKeyword) {
    setLibraryKeyword(nextKeyword);
    setLibraryPage(1);
  }

  function previousLibraryPage() {
    setLibraryPage((current) => Math.max(1, current - 1));
  }

  function nextLibraryPage() {
    setLibraryPage((current) => Math.min(libraryTotalPages, current + 1));
  }

  function chooseLanguagePreference(nextPreference) {
    setLanguagePreference(nextPreference);
    saveSettings({
      ...settingsForm,
      languagePreference: nextPreference,
    });
  }

  function updateSettingsField(fieldName, value) {
    setSettingsForm((current) => ({
      ...current,
      [fieldName]: value,
    }));
  }

  function handleLogoUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setSettingsSavedMessage("请上传图片格式的 Logo");
      setTimeout(() => setSettingsSavedMessage(""), 1600);
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const logoDataUrl = reader.result;

      setSettingsForm((current) => ({
        ...current,
        logoDataUrl,
      }));

      saveSettings({
        ...settingsForm,
        logoDataUrl,
        languagePreference,
      });

      setSettingsSavedMessage("Logo 已上传");
      setTimeout(() => setSettingsSavedMessage(""), 1600);
    };

    reader.readAsDataURL(file);
  }

  function clearLogo() {
    const nextSettings = {
      ...settingsForm,
      logoDataUrl: "",
    };

    setSettingsForm(nextSettings);

    saveSettings({
      ...nextSettings,
      languagePreference,
    });

    setSettingsSavedMessage("Logo 已清除");
    setTimeout(() => setSettingsSavedMessage(""), 1600);
  }

  async function saveStudioInfo() {
    const result = await saveCloudStudioSettings({
      ...settingsForm,
      languagePreference,
    });

    if (result.status === "cloud") {
      setSettingsSavedMessage("工作室信息已同步");
    } else if (result.status === "cloud-error") {
      setSettingsSavedMessage("本机已保存，云端同步失败");
    } else {
      setSettingsSavedMessage("工作室信息已保存到本机");
    }

    setTimeout(() => setSettingsSavedMessage(""), 1600);
  }

  function toggleFavorite(action) {
    setFavoriteIds((current) => {
      const exists = current.includes(action.id);
      const next = exists
        ? current.filter((id) => id !== action.id)
        : [...current, action.id];

      localStorage.setItem("pilates-action-favorites-v1", JSON.stringify(next));
      return next;
    });
  }

  function openTagEditor(action) {
    setTagTarget(action);
    setTagInput((actionTags[action.id] || []).join("、"));
  }

  function saveActionTags() {
    if (!tagTarget) return;

    const tags = tagInput
      .split(/[、,，\s]+/)
      .map((item) => item.trim())
      .filter(Boolean);

    const nextTags = {
      ...actionTags,
      [tagTarget.id]: tags,
    };

    localStorage.setItem("pilates-action-tags-v1", JSON.stringify(nextTags));
    setActionTags(nextTags);
    setTagTarget(null);
    setTagInput("");
  }

  function resetTemplateEditor() {
    setEditingTemplateId("");
    setTemplateName("");
    setTemplateDesc("");
    setTemplateApparatus("all");
    setTemplateKeyword("");
    setSelectedTemplateActions([]);
  }

  function hasTemplateDraft() {
    return (
      templateName.trim() ||
      templateDesc.trim() ||
      templateKeyword.trim() ||
      selectedTemplateActions.length > 0
    );
  }

  function openNewTemplateModal() {
    if (editingTemplateId) {
      resetTemplateEditor();
    }

    setTemplateModalOpen(true);
  }

  function openEditTemplateModal(template) {
    const loadedActions = (template.actions || []).map((item) => {
      const foundById = item.actionId
        ? allActions.find((action) => action.id === item.actionId)
        : null;

      const foundByKeyword = !foundById
        ? allActions.find(
            (action) =>
              action.apparatus === item.apparatus &&
              [action.cnName, action.name, action.displayName]
                .join(" ")
                .includes(item.keyword || "")
          )
        : null;

      const found = foundById || foundByKeyword;

      return {
        id: found?.id || item.actionId || `${item.apparatus}-${item.keyword}`,
        apparatus: found?.apparatus || item.apparatus || "M",
        cnName: found?.cnName || item.keyword || "",
        name: found?.name || "",
        keyword: found?.cnName || found?.name || item.keyword || "",
      };
    });

    setEditingTemplateId(template.id);
    setTemplateName(template.name || "");
    setTemplateDesc(template.desc || "");
    setTemplateApparatus("all");
    setTemplateKeyword("");
    setSelectedTemplateActions(loadedActions);
    setTemplateModalOpen(true);
  }

  function closeTemplateModal() {
    setTemplateModalOpen(false);
    resetTemplateEditor();
  }

  function addActionToTemplate(action) {
    const exists = selectedTemplateActions.some((item) => item.id === action.id);
    if (exists) return;

    setSelectedTemplateActions((current) => [
      ...current,
      {
        id: action.id,
        apparatus: action.apparatus,
        cnName: action.cnName,
        name: action.name,
        keyword: action.cnName || action.name,
      },
    ]);
  }

  function removeActionFromTemplate(actionId) {
    setSelectedTemplateActions((current) =>
      current.filter((action) => action.id !== actionId)
    );
  }

  function moveTemplateAction(actionId, direction) {
    setSelectedTemplateActions((current) => {
      const index = current.findIndex((item) => item.id === actionId);
      if (index < 0) return current;

      const nextIndex = direction === "up" ? index - 1 : index + 1;
      if (nextIndex < 0 || nextIndex >= current.length) return current;

      const next = [...current];
      const temp = next[index];
      next[index] = next[nextIndex];
      next[nextIndex] = temp;

      return next;
    });
  }

  function saveCurrentTemplate() {
    if (!templateName.trim() || selectedTemplateActions.length === 0) return;

    const nextTemplates = saveTemplate({
      id: editingTemplateId || undefined,
      name: templateName.trim(),
      desc: templateDesc.trim(),
      actions: selectedTemplateActions.map((action) => ({
        actionId: action.id,
        apparatus: action.apparatus,
        keyword: action.keyword || action.cnName || action.name,
      })),
    });

    setTemplates(nextTemplates);
    closeTemplateModal();
  }

  function removeTemplate(templateId) {
    setTemplates(deleteTemplate(templateId));
  }

  return (
    <section className="page">
      <header className="simple-header">
        <h1>设置</h1>
      </header>

      {settingsSavedMessage && (
        <div className="save-toast">{settingsSavedMessage}</div>
      )}

     <div className="settings-list">
  <button
  className="settings-row-with-subtitle"
  onClick={() => togglePanel("account")}
>
  <div>
    <strong>账户管理</strong>
    <small>{authUser ? authUser.email : "邮箱注册 / 登录 / 后续云端同步"}</small>
  </div>
  <span>{openPanel === "account" ? "⌃" : "›"}</span>
</button>

{openPanel === "account" && (
  <div className="settings-panel-card account-settings-panel">
    <div className="account-status-card">
      <div className="account-status-icon">
        {authUser ? <UsersIcon size={20} /> : <MailIcon size={20} />}
      </div>

      <div>
        <strong>{authUser ? "已登录" : "未登录"}</strong>
        <span>
          {authUser
            ? authUser.email
            : "登录后可同步工作室信息，后续再同步会员和课程。"}
        </span>
      </div>
    </div>

    {!authUser && (
      <>
        <label className="field icon-field">
          <span>邮箱</span>
          <div className="input-with-icon">
            <MailIcon size={18} />
            <input
              value={authEmail}
              onChange={(event) => setAuthEmail(event.target.value)}
              placeholder="输入邮箱"
              type="email"
              autoComplete="email"
            />
          </div>
        </label>

        <label className="field icon-field">
          <span>密码</span>
          <div className="input-with-icon">
            <LockIcon size={18} />
            <input
              value={authPassword}
              onChange={(event) => setAuthPassword(event.target.value)}
              placeholder="至少 6 位密码"
              type="password"
              autoComplete="current-password"
            />
          </div>
        </label>

        <div className="account-action-row">
          <button
            className="light-action account-auth-button"
            onClick={handleEmailSignIn}
            disabled={authLoading}
          >
            <LogInIcon size={17} />
            登录
          </button>

          <button
            className="main-action account-auth-button"
            onClick={handleEmailSignUp}
            disabled={authLoading}
          >
            <MailIcon size={17} />
            注册
          </button>
        </div>
      </>
    )}

    {authUser && (
      <button
        className="danger-action account-signout-button"
        onClick={handleEmailSignOut}
        disabled={authLoading}
      >
        <LogOutIcon size={17} />
        退出登录
      </button>
    )}

    {authMessage && <p className="account-auth-message">{authMessage}</p>}

    <p className="settings-tip">
      当前已支持账号登录后的工作室信息云端同步。
    </p>
  </div>
)}

  <button
    className="settings-row-with-subtitle"
    onClick={() => togglePanel("studio")}
  >
    <div>
      <strong>工作室信息</strong>
      <small>{settingsForm.studioNameCn || "设置 Logo、名称和教练称呼"}</small>
    </div>
    <span>{openPanel === "studio" ? "⌃" : "›"}</span>
  </button>

  {openPanel === "studio" && (
    <div className="settings-panel-card studio-settings-panel">
      <div className="logo-upload-card">
        <label className="logo-square-uploader">
          {settingsForm.logoDataUrl ? (
            <img src={settingsForm.logoDataUrl} alt="工作室 Logo" />
          ) : (
            <div className="logo-placeholder-content">
              <strong>Logo</strong>
              <span>点击上传</span>
            </div>
          )}

          <input
            type="file"
            accept="image/*"
            onChange={handleLogoUpload}
          />
        </label>

        <div className="logo-upload-info">
          <strong>工作室 Logo</strong>
          <span>
            建议上传正方形 Logo。第一版先保存在本机浏览器，后面接云端同步。
          </span>

          {settingsForm.logoDataUrl && (
            <button className="logo-text-button" onClick={clearLogo}>
              清除 Logo
            </button>
          )}
        </div>
      </div>

      <label className="field">
        <span>中文名称</span>
        <input
          value={settingsForm.studioNameCn || ""}
          onChange={(event) =>
            updateSettingsField("studioNameCn", event.target.value)
          }
          placeholder="例如：北极星普拉提"
        />
      </label>

      <label className="field">
        <span>英文名称</span>
        <input
          value={settingsForm.studioNameEn || ""}
          onChange={(event) =>
            updateSettingsField("studioNameEn", event.target.value)
          }
          placeholder="例如：Polaris Pilates"
        />
      </label>

      <label className="field">
        <span>首页称呼</span>
        <input
          value={settingsForm.coachName || ""}
          onChange={(event) =>
            updateSettingsField("coachName", event.target.value)
          }
          placeholder="例如：严老师 / Jason"
        />
      </label>

      <button className="main-wide-button" onClick={saveStudioInfo}>
        保存工作室信息
      </button>
    </div>
  )}

  <button
    className="settings-row-with-subtitle"
    onClick={() => togglePanel("library")}
  >
    <div>
      <strong>动作库管理</strong>
      <small>当前动作池 {allActions.length} 个，可按器械和关键词搜索</small>
    </div>
    <span>{openPanel === "library" ? "⌃" : "›"}</span>
  </button>

  {openPanel === "library" && (
    <div className="settings-panel-card action-library-entry">
      <div className="library-combined-card">
        <div className="library-combined-main">
          <strong>动作库 {allActions.length} 个</strong>
          <span>
            M {actionStats.M || 0} · R {actionStats.R || 0} · TT{" "}
            {actionStats.TT || 0} · C {actionStats.C || 0} · LB{" "}
            {actionStats.LB || 0} · SC {actionStats.SC || 0} · P{" "}
            {actionStats.P || 0}
          </span>
        </div>

        <button
          className="library-open-button"
          onClick={() => setLibraryModalOpen(true)}
        >
          查看动作
        </button>

        <p className="library-combined-tip">
          支持筛选、搜索、打标签、收藏。
        </p>
      </div>
    </div>
  )}

  <button
    className="settings-row-with-subtitle"
    onClick={() => togglePanel("templates")}
  >
    <div>
      <strong>课程模板管理</strong>
      <small>在设置页创建模板，排课页直接套用</small>
    </div>
    <span>{openPanel === "templates" ? "⌃" : "›"}</span>
  </button>

  {openPanel === "templates" && (
    <div className="settings-panel-card template-manager-panel">
      <div className="template-manager-head">
        <div>
          <strong>已有模板</strong>
          <span>{templates.length} 个模板</span>
        </div>

        <button onClick={openNewTemplateModal}>
          {hasTemplateDraft() ? "继续编辑" : "+ 新建模板"}
        </button>
      </div>

      <div className="template-card-list">
        {templates.length > 0 ? (
          templates.map((template) => (
            <div key={template.id} className="template-card">
              <div>
                <strong>{template.name}</strong>
                <span>
                  {template.actions?.length || 0} 个动作
                  {template.desc ? ` · ${template.desc}` : ""}
                </span>
              </div>

              <div className="template-card-actions">
                <button onClick={() => openEditTemplateModal(template)}>
                  编辑
                </button>
                <button onClick={() => removeTemplate(template.id)}>
                  删除
                </button>
              </div>
            </div>
          ))
        ) : (
          <p className="empty-template-text">
            暂无模板，点击“新建模板”创建第一个模板。
          </p>
        )}
      </div>
    </div>
  )}

  <button
    className="settings-row-with-subtitle"
    onClick={() => togglePanel("language")}
  >
    <div>
      <strong>动作语言偏好</strong>
      <small>{languageLabelMap[languagePreference]}</small>
    </div>
    <span>{openPanel === "language" ? "⌃" : "›"}</span>
  </button>

  {openPanel === "language" && (
    <div className="language-preference-panel">
      <button
        className={languagePreference === "chinese" ? "active" : ""}
        onClick={() => chooseLanguagePreference("chinese")}
      >
        <strong>中文优先</strong>
        <small>排课和海报优先中文；没有中文时显示英文。</small>
      </button>

      <button
        className={languagePreference === "english" ? "active" : ""}
        onClick={() => chooseLanguagePreference("english")}
      >
        <strong>英文优先</strong>
        <small>排课端英文在前；海报只发英文。</small>
      </button>

      <button
        className={languagePreference === "mixed" ? "active" : ""}
        onClick={() => chooseLanguagePreference("mixed")}
      >
        <strong>中英对照</strong>
        <small>排课和海报尽量显示中英对照。</small>
      </button>
    </div>
  )}

  <button>
    导出数据 <span>›</span>
  </button>

  <button>
    导入数据 <span>›</span>
  </button>

</div>

      {libraryModalOpen && (
  <div className="modal-backdrop" onClick={() => setLibraryModalOpen(false)}>
    <div
      className="modal-sheet library-modal-sheet"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="library-modal-fixed-head">
        <div className="modal-header">
          <div>
            <h2>查看动作</h2>
            <p>共 {filteredLibraryActions.length} 个动作，可按器械或关键词筛选。</p>
          </div>
          <button onClick={() => setLibraryModalOpen(false)}>×</button>
        </div>

        <div className="filter-strip modal-filter-strip">
          {filterOptions.map((item) => (
            <button
              key={item.key}
              className={libraryApparatus === item.key ? "active" : ""}
              onClick={() => updateLibraryFilter(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <label className="field library-search-field">
          <span>搜索动作</span>
          <input
            value={libraryKeyword}
            onChange={(event) => updateLibraryKeyword(event.target.value)}
            placeholder="输入中文、英文或好处关键词"
          />
        </label>
      </div>

      <div className="library-modal-scroll-body">
        <div className="library-list paged-library-list modal-library-list">
          {pagedLibraryActions.map((action) => {
            const tags = actionTags[action.id] || [];
            const isFavorite = favoriteIds.includes(action.id);

            return (
              <div key={action.id} className="library-action-card">
                <em>{action.apparatus}</em>
                <div>
                  <strong>
                    {action.cnName || action.name}
                    {action.cnName && action.name ? ` / ${action.name}` : ""}
                  </strong>

                  <span>{action.defaultBenefit || "暂无动作好处"}</span>

                  {tags.length > 0 && (
                    <div className="tag-row">
                      {tags.map((tag) => (
                        <b key={tag}>{tag}</b>
                      ))}
                    </div>
                  )}

                  <div className="library-card-actions">
                    <button onClick={() => openTagEditor(action)}>打标签</button>
                    <button
                      className={isFavorite ? "active" : ""}
                      onClick={() => toggleFavorite(action)}
                    >
                      {isFavorite ? "已收藏" : "收藏"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="pagination-row">
          <button onClick={previousLibraryPage} disabled={libraryPage <= 1}>
            上一页
          </button>
          <span>
            第 {Math.min(libraryPage, libraryTotalPages)} / {libraryTotalPages} 页
            （{filteredLibraryActions.length} 个动作）
          </span>
          <button
            onClick={nextLibraryPage}
            disabled={libraryPage >= libraryTotalPages}
          >
            下一页
          </button>
        </div>
      </div>
    </div>
  </div>
)}

      {templateModalOpen && (
        <div className="modal-backdrop" onClick={() => setTemplateModalOpen(false)}>
          <div
            className="modal-sheet template-editor-sheet"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h2>{editingTemplateId ? "编辑模板" : "新建模板"}</h2>
                <p>从动作库点选动作，保存后可在排课页套用。</p>
              </div>
              <button onClick={closeTemplateModal}>×</button>
            </div>

            <label className="field">
              <span>模板名称</span>
              <input
                value={templateName}
                onChange={(event) => setTemplateName(event.target.value)}
                placeholder="例如：肩颈理疗 / 核心增强"
              />
            </label>

            <label className="field">
              <span>模板说明</span>
              <input
                value={templateDesc}
                onChange={(event) => setTemplateDesc(event.target.value)}
                placeholder="例如：适合久坐肩颈紧张"
              />
            </label>

            <div className="filter-strip mini-filter-strip">
              {filterOptions.map((item) => (
                <button
                  key={item.key}
                  className={templateApparatus === item.key ? "active" : ""}
                  onClick={() => setTemplateApparatus(item.key)}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <label className="field">
              <span>从动作库添加动作</span>
              <input
                value={templateKeyword}
                onChange={(event) => setTemplateKeyword(event.target.value)}
                placeholder="搜索动作名称"
              />
            </label>

            {selectedTemplateActions.length > 0 && (
              <div className="selected-template-list">
                {selectedTemplateActions.map((action, index) => (
                  <div key={action.id}>
                    <span>
                      {index + 1}. {action.apparatus} ·{" "}
                      {action.cnName || action.name}
                    </span>
                    <button onClick={() => moveTemplateAction(action.id, "up")}>
                      ↑
                    </button>
                    <button onClick={() => moveTemplateAction(action.id, "down")}>
                      ↓
                    </button>
                    <button onClick={() => removeActionFromTemplate(action.id)}>
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="template-action-picker">
              {templateSearchActions.map((action) => {
                const selected = selectedTemplateActions.some(
                  (item) => item.id === action.id
                );

                return (
                  <button
                    key={action.id}
                    className={selected ? "selected" : ""}
                    onClick={() => addActionToTemplate(action)}
                  >
                    <em>{action.apparatus}</em>
                    <span>{action.cnName || action.name}</span>
                    {action.cnName && action.name && <small>{action.name}</small>}
                    <strong>{selected ? "已选" : "+"}</strong>
                  </button>
                );
              })}
            </div>

            <button className="main-wide-button" onClick={saveCurrentTemplate}>
              保存模板
            </button>
          </div>
        </div>
      )}

      {tagTarget && (
        <div className="modal-backdrop">
          <div className="modal-sheet small-modal-sheet">
            <div className="modal-header">
              <div>
                <h2>给动作打标签</h2>
                <p>
                  {tagTarget.apparatus} · {tagTarget.cnName || tagTarget.name}
                </p>
              </div>
              <button onClick={() => setTagTarget(null)}>×</button>
            </div>

            <label className="field">
              <span>主题标签</span>
              <input
                value={tagInput}
                onChange={(event) => setTagInput(event.target.value)}
                placeholder="例如：核心、柔韧性、肩颈"
              />
            </label>

            <p className="settings-tip">
              第一版先保存标签。后面会把“柔韧性 / 活动度”“核心 / 核心增强”等词做关联推荐。
            </p>

            <button className="main-wide-button" onClick={saveActionTags}>
              保存标签
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

void LegacyHomePage;
void LegacySchedulePage;
void LegacySettingsPage;

export default App;
