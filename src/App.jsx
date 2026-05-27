import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
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
  getLessonByMemberAndNumber,
  getLessonDraftForMemberAndNumber,
  getTemplates,
  saveLesson,
  saveLessonDraft,
  saveSettings,
  saveTemplate,
} from "./data/localStore";

const POSTER_API_URL = "https://pilates-poster-api.onrender.com/generate";

const posterThemeOptions = [
  { key: "vitalityOrange", label: "活力橙" },
  { key: "freshGreen", label: "清新绿" },
  { key: "softLightWhite", label: "柔光白" },
  { key: "obsidianBlack", label: "曜石黑" },
  { key: "lakeBlue", label: "静海蓝" },
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

function getTodayLabel() {
  const now = new Date();
  const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  return `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(
    now.getDate()
  ).padStart(2, "0")} · ${weekdays[now.getDay()]}`;
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
      const summaryMatch = line.match(/^(课后总结|总结)\s*[:：]\s*(.*)$/);

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

function normalizeTemplateItemFromAction(action) {
  return {
    apparatus: action.apparatus,
    keyword: action.cnName || action.name,
    baseActionId: action.id,
    displayName: action.displayName,
  };
}

function App() {
  const initialData = useMemo(() => getAppData(), []);

  const [activeTab, setActiveTab] = useState("home");
  const [selectedMember, setSelectedMember] = useState(null);
  const [members] = useState(initialData.members);
  const [languagePreference, setLanguagePreference] = useState(
    initialData.settings.languagePreference || "chinese"
  );

  useEffect(() => {
    saveSettings({ languagePreference });
  }, [languagePreference]);

  function openSchedule(member) {
    setSelectedMember(member);
    setActiveTab("schedule");
  }

  return (
    <div className="app-shell">
      <main className="phone-page">
        {activeTab === "home" && (
          <HomePage members={members} onOpenSchedule={openSchedule} />
        )}

        {activeTab === "schedule" && (
        <SchedulePage
  member={selectedMember}
  members={members}
  languagePreference={languagePreference}
/>
        )}

        {activeTab === "members" && (
          <MembersPage members={members} onOpenSchedule={openSchedule} />
        )}

        {activeTab === "settings" && (
          <SettingsPage
            languagePreference={languagePreference}
            setLanguagePreference={setLanguagePreference}
          />
        )}
      </main>

      <nav className="bottom-tabs">
        <button
          className={activeTab === "home" ? "tab active" : "tab"}
          onClick={() => setActiveTab("home")}
        >
          <span>⌂</span>
          首页
        </button>
        <button
          className={activeTab === "schedule" ? "tab active" : "tab"}
          onClick={() => setActiveTab("schedule")}
        >
          <span>▣</span>
          排课
        </button>
        <button
          className={activeTab === "members" ? "tab active" : "tab"}
          onClick={() => setActiveTab("members")}
        >
          <span>♧</span>
          会员
        </button>
        <button
          className={activeTab === "settings" ? "tab active" : "tab"}
          onClick={() => setActiveTab("settings")}
        >
          <span>⚙</span>
          设置
        </button>
      </nav>
    </div>
  );
}

function HomePage({ members, onOpenSchedule }) {
  const recentMembers = members.slice(0, 3);

  return (
    <section className="page">
      <header className="hero">
        <p>下午好</p>
        <h1>严老师</h1>
        <div className="search-box">搜索会员...</div>
      </header>

      <section className="section-block">
        <div className="section-title">
          <div>
            <h2>🔥 近期活跃会员</h2>
            <p>按最近训练频率排序，常来的会员优先显示</p>
          </div>
          <button className="text-button">查看全部 ›</button>
        </div>

        <div className="card-list">
          {recentMembers.map((member) => (
            <button
              className="member-card"
              key={member.name}
              onClick={() => onOpenSchedule(member)}
            >
              <div className="avatar">{member.name.slice(0, 1)}</div>
              <div className="member-info">
                <strong>{member.name}</strong>
                <p>目标：{member.goal}</p>
              </div>
              <div className="member-meta">
                <strong>{member.lessons}次</strong>
                <span>{member.lastDate}</span>
              </div>
            </button>
          ))}
        </div>
      </section>
    </section>
  );
}

function SchedulePage({ member, members = [], languagePreference }) {
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

    studentName: lessonForm.studentName || "未命名学员",
    studentNameSlug: lessonForm.studentName || "student",
    date: getTodayLabel(),
    weather: lessonForm.weather || "晴",
    lessonNumber: `第${lessonNumber}课`,
    courseTheme: lessonForm.lessonTheme || "",

    studioName: latestSettings.studioNameCn || "",
    studioSubName: latestSettings.studioNameEn || "",
    logo: latestSettings.logoDataUrl || "",

    summary: lessonForm.summary || "",
    actions: actions.map((action, index) => ({
      number: index + 1,
      equipment: action.apparatus || "",
      name: getPosterActionName(action),
      benefit: action.benefit || "",
      comment: action.comment || "",
    })),
  };
}

async function generatePoster() {
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
    setSaveMessage("正在生成海报...");

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
  }
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
          <h2>训练动作详情</h2>
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

            <button
              className="add-button"
              onClick={() => {
                if (recommendedActions[0]) addAction(recommendedActions[0]);
              }}
            >
              ＋
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
        <h2>课后总结 / 二天身体反馈</h2>
        <textarea
          className="summary-box"
          placeholder="输入课后总结或二天身体反馈建议..."
          value={lessonForm.summary}
          onChange={(event) => updateLessonField("summary", event.target.value)}
        />
      </section>

      <div className="poster-theme-panel">
  <div className="poster-theme-title">
    <strong>海报主题</strong>
    <span>生成前选择海报风格</span>
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
  <button className="danger-action" onClick={clearCurrentDraft}>
    清空
  </button>

  <button className="light-action" onClick={saveCurrentLesson}>
    保存
  </button>

  <button className="light-action" onClick={() => setIsPosterPreviewOpen(true)}>
    预览
  </button>

  <button className="main-action" onClick={generatePoster}>
    生成海报
  </button>
</div>

     {generatedPosterUrl && (
  <div className="modal-backdrop" onClick={() => setGeneratedPosterUrl("")}>
    <div
      className="modal-sheet poster-result-sheet"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="modal-header">
        <div>
          <h2>海报已生成</h2>
          <p>长按图片保存，或点击下方按钮打开原图。</p>
        </div>
        <button onClick={() => setGeneratedPosterUrl("")}>×</button>
      </div>

      <div className="poster-result-image-wrap">
        <img src={generatedPosterUrl} alt="生成的课后海报" />
      </div>

      <button
        className="main-wide-button"
        onClick={() => window.open(generatedPosterUrl, "_blank")}
      >
        打开原图
      </button>
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

function MembersPage({ members, onOpenSchedule }) {
  return (
    <section className="page">
      <header className="simple-header">
        <h1>会员管理</h1>
        <button className="round-button">＋</button>
      </header>

      <div className="search-box members-search">搜索会员...</div>

      <div className="card-list">
        {members.map((member) => (
          <button className="member-card" key={member.name} onClick={() => onOpenSchedule(member)}>
            <div className="avatar">{member.name.slice(0, 1)}</div>
            <div className="member-info">
              <strong>{member.name}</strong>
              <p>{member.phone || "暂无手机号"}</p>
              <p>目标：{member.goal}</p>
            </div>
            <div className="arrow">›</div>
          </button>
        ))}
      </div>
    </section>
  );
}

function SettingsPage({ languagePreference, setLanguagePreference }) {
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

  function saveStudioInfo() {
    saveSettings({
      ...settingsForm,
      languagePreference,
    });

    setSettingsSavedMessage("工作室信息已保存");
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

  <button>
    账户管理 <span>›</span>
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

export default App;
/* ===== 海报区压缩优化版：小主题条 + 一排操作按钮 ===== */

.poster-theme-panel {
  background: transparent !important;
  border-radius: 0 !important;
  padding: 0 2px !important;
  margin: -2px 0 12px !important;
  box-shadow: none !important;
}

.poster-theme-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px !important;
  padding: 0 2px;
}

.poster-theme-title strong {
  color: #21332f;
  font-size: 14px !important;
  font-weight: 900;
}

.poster-theme-title span {
  color: #9aa9a4;
  font-size: 12px !important;
}

.poster-theme-strip {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 0 2px 4px !important;
  scrollbar-width: none;
}

.poster-theme-strip::-webkit-scrollbar {
  display: none;
}

.poster-theme-strip button {
  flex: 0 0 auto;
  height: 34px !important;
  min-width: auto !important;
  border-radius: 999px;
  padding: 0 13px !important;
  background: rgba(255, 255, 255, 0.76) !important;
  color: #78908a !important;
  font-size: 13px !important;
  font-weight: 800;
  box-shadow: none !important;
  border: 1px solid rgba(126, 178, 160, 0.12);
  transform: none !important;
  transition: none !important;
}

.poster-theme-strip button.active {
  background: #079b87 !important;
  color: #ffffff !important;
  border-color: #079b87 !important;
  box-shadow: 0 6px 14px rgba(7, 155, 135, 0.16) !important;
  transform: none !important;
}

.lesson-bottom-actions.course-save-actions {
  display: grid;
  grid-template-columns: 0.78fr 0.78fr 0.78fr 1.15fr !important;
  gap: 8px !important;
  margin: 10px 0 24px !important;
}

.lesson-bottom-actions.course-save-actions button {
  height: 46px !important;
  border-radius: 16px !important;
  font-size: 14px !important;
  font-weight: 900;
  box-shadow: none !important;
}

.lesson-bottom-actions.course-save-actions .main-action {
  background: #079b87;
  color: #ffffff;
  box-shadow: 0 8px 18px rgba(7, 155, 135, 0.18) !important;
}

.lesson-bottom-actions.course-save-actions .light-action {
  background: rgba(255, 255, 255, 0.78);
  color: #0c8f7c;
  border: 1px solid rgba(126, 210, 184, 0.32);
}

.lesson-bottom-actions.course-save-actions .danger-action {
  background: rgba(255, 248, 244, 0.9);
  color: #d86555;
  border: 1px solid rgba(235, 175, 155, 0.3);
}

/* 生成后的真实海报弹窗 */
.poster-result-sheet {
  max-height: 92vh !important;
  padding-bottom: 20px !important;
}

.poster-result-image-wrap {
  width: 100%;
  max-height: 68vh;
  overflow: auto;
  border-radius: 22px;
  background: #eef5f1;
  border: 1px solid rgba(126, 178, 160, 0.16);
}

.poster-result-image-wrap img {
  display: block;
  width: 100%;
  height: auto;
  border-radius: 22px;
}

.poster-preview-placeholder {
  background: rgba(255, 255, 255, 0.78) !important;
  border-radius: 18px !important;
  padding: 22px 16px !important;
  text-align: center;
  border: 1px dashed #c8ddd6;
}
