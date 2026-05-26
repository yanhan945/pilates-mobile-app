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
  deleteTemplate,
  getAppData,
  getTemplates,
  saveLesson,
  saveLessonDraft,
  saveSettings,
  saveTemplate,
} from "./data/localStore";

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
          <SchedulePage member={selectedMember} languagePreference={languagePreference} />
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

function SchedulePage({ member, languagePreference }) {
  const searchInputRef = useRef(null);
  const apparatusPickerRef = useRef(null);

  const [selectedApparatus, setSelectedApparatus] = useState("all");
  const [isApparatusOpen, setIsApparatusOpen] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [isQuickPanelOpen, setIsQuickPanelOpen] = useState(false);
  const [quickMode, setQuickMode] = useState("templates");
  const [pasteText, setPasteText] = useState("");
  const [parsedRows, setParsedRows] = useState([]);
  const [saveMessage, setSaveMessage] = useState("");
  const [addMessage, setAddMessage] = useState("");

  const [lessonForm, setLessonForm] = useState({
    weather: "晴 24℃",
    studentName: member?.name || "",
    lessonTheme: member ? "核心增强" : "",
    summary:
      "今天整体完成度不错，核心控制比上节课更稳定，后续可以继续加强骨盆稳定和呼吸配合。",
  });

  const [actions, setActions] = useState([]);

  const templates = useMemo(() => getTemplates(), []);
  const lessonNumber = member ? member.lessons + 1 : 1;

  const selectedApparatusLabel =
    apparatusOptions.find((item) => item.key === selectedApparatus)?.label || "全部";

  useEffect(() => {
    setLessonForm((current) => ({
      ...current,
      studentName: member?.name || current.studentName,
      lessonTheme: member ? current.lessonTheme || "核心增强" : current.lessonTheme,
    }));
  }, [member]);

  useEffect(() => {
    function closeApparatusWhenClickOutside(event) {
      if (!apparatusPickerRef.current) return;
      if (!apparatusPickerRef.current.contains(event.target)) {
        setIsApparatusOpen(false);
      }
    }

    document.addEventListener("mousedown", closeApparatusWhenClickOutside);
    document.addEventListener("touchstart", closeApparatusWhenClickOutside);

    return () => {
      document.removeEventListener("mousedown", closeApparatusWhenClickOutside);
      document.removeEventListener("touchstart", closeApparatusWhenClickOutside);
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

  function updateLessonField(fieldName, nextValue) {
    setLessonForm((current) => ({
      ...current,
      [fieldName]: nextValue,
    }));
  }

  function addAction(action) {
    const nextAction = createSelectedLessonAction(action);
    setActions((currentActions) => [...currentActions, nextAction]);
    setSearchKeyword("");
    setAddMessage(`已添加：${action.displayName || action.cnName || action.name}`);

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

  function saveCurrentDraft() {
    saveLessonDraft(buildLessonPayload());
    setSaveMessage("已保存草稿");
    setTimeout(() => setSaveMessage(""), 1600);
  }

  function saveCurrentLesson() {
    saveLesson(buildLessonPayload());
    setSaveMessage("课程已保存");
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
    <section className="page">
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
          <label className="field">
            <span>学员</span>
            <input
              value={lessonForm.studentName}
              onChange={(event) => updateLessonField("studentName", event.target.value)}
              placeholder="选择或输入学员姓名"
            />
          </label>

          <label className="lesson-stepper">
            <span>课次</span>
            <div>
              <button type="button">-</button>
              <strong>{lessonNumber}</strong>
              <button type="button">+</button>
            </div>
          </label>
        </div>

        <label className="field">
          <span>课程主题</span>
          <input
            value={lessonForm.lessonTheme}
            onChange={(event) => updateLessonField("lessonTheme", event.target.value)}
            placeholder="例如：核心增强"
          />
        </label>
      </section>

      <section className="form-card">
        <div className="section-title compact">
          <h2>训练动作详情</h2>
          <span>{actions.length} 个动作</span>
        </div>

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
            onChange={(event) => setSearchKeyword(event.target.value)}
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

        <div className="quick-recommend-title">
          <strong>推荐动作</strong>
          <span>切换器械后自动刷新，直接点选加入</span>
        </div>

        <div className="search-results always-visible">
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

      <div className="floating-actions">
        <button className="dark-action" onClick={saveCurrentDraft}>保存草稿</button>
        <button className="light-action" onClick={saveCurrentLesson}>保存课程</button>
        <button className="main-action">生成海报</button>
      </div>

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
  const [openPanel, setOpenPanel] = useState("");
  const [settingsForm, setSettingsForm] = useState(initialData.settings);
  const [templates, setTemplates] = useState(getTemplates());
  const [templateName, setTemplateName] = useState("");
  const [templateDesc, setTemplateDesc] = useState("");
  const [templateApparatus, setTemplateApparatus] = useState("all");
  const [templateKeyword, setTemplateKeyword] = useState("");
  const [selectedTemplateActions, setSelectedTemplateActions] = useState([]);
  const [libraryApparatus, setLibraryApparatus] = useState("all");
  const [libraryKeyword, setLibraryKeyword] = useState("");

  const allActions = useMemo(() => getAllActions(languagePreference), [languagePreference]);

  const actionStats = useMemo(() => {
    const result = allActions.reduce((acc, action) => {
      acc[action.apparatus] = (acc[action.apparatus] || 0) + 1;
      return acc;
    }, {});

    return result;
  }, [allActions]);

  const templateSearchResults = useMemo(() => {
    return searchActions({
      keyword: templateKeyword,
      apparatus: templateApparatus,
      languagePreference,
    }).slice(0, 20);
  }, [templateKeyword, templateApparatus, languagePreference]);

  const filteredLibraryActions = useMemo(() => {
    return searchActions({
      keyword: libraryKeyword,
      apparatus: libraryApparatus,
      languagePreference,
    }).slice(0, 80);
  }, [libraryKeyword, libraryApparatus, languagePreference]);

  const languageLabelMap = {
    chinese: "中文优先",
    english: "英文优先",
    mixed: "中英对照",
  };

  function chooseLanguagePreference(nextPreference) {
    setLanguagePreference(nextPreference);
  }

  function updateSettingsField(fieldName, value) {
    setSettingsForm((current) => ({ ...current, [fieldName]: value }));
  }

  function saveStudioInfo() {
    saveSettings(settingsForm);
  }

  function autoFillEnglishName() {
    if (settingsForm.studioNameEn) return;

    if (settingsForm.studioNameCn?.includes("北极星")) {
      updateSettingsField("studioNameEn", "Polaris Pilates");
      return;
    }

    updateSettingsField("studioNameEn", "Pilates Studio");
  }

  function handleLogoUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      const nextSettings = {
        ...settingsForm,
        logoDataUrl: reader.result,
      };
      setSettingsForm(nextSettings);
      saveSettings(nextSettings);
    };

    reader.readAsDataURL(file);
  }

  function addActionToTemplate(action) {
    const nextItem = normalizeTemplateItemFromAction(action);
    const exists = selectedTemplateActions.some((item) => item.baseActionId === nextItem.baseActionId);

    if (exists) return;

    setSelectedTemplateActions((current) => [...current, nextItem]);
  }

  function removeActionFromTemplate(baseActionId) {
    setSelectedTemplateActions((current) => current.filter((item) => item.baseActionId !== baseActionId));
  }

  function createTemplateFromSelectedActions() {
    if (!selectedTemplateActions.length) return;

    const nextTemplates = saveTemplate({
      name: templateName || "新课程模板",
      desc: templateDesc || "自定义快速排课模板",
      actions: selectedTemplateActions,
    });

    setTemplates(nextTemplates);
    setTemplateName("");
    setTemplateDesc("");
    setTemplateKeyword("");
    setSelectedTemplateActions([]);
  }

  function removeTemplate(templateId) {
    setTemplates(deleteTemplate(templateId));
  }

  return (
    <section className="page">
      <header className="simple-header">
        <h1>设置</h1>
      </header>

      <div className="settings-list">
        <button
          className="settings-row-with-subtitle"
          onClick={() => setOpenPanel(openPanel === "studio" ? "" : "studio")}
        >
          <div>
            <strong>工作室信息</strong>
            <small>{settingsForm.studioNameCn || "设置店铺名称、英文名和 Logo"}</small>
          </div>
          <span>{openPanel === "studio" ? "⌃" : "›"}</span>
        </button>

        {openPanel === "studio" && (
          <div className="settings-panel-card">
            <label className="field">
              <span>中文名称</span>
              <input
                value={settingsForm.studioNameCn || ""}
                onChange={(event) => updateSettingsField("studioNameCn", event.target.value)}
                placeholder="例如：北极星普拉提"
              />
            </label>

            <label className="field">
              <span>英文名称</span>
              <input
                value={settingsForm.studioNameEn || ""}
                onChange={(event) => updateSettingsField("studioNameEn", event.target.value)}
                placeholder="例如：Polaris Pilates"
              />
            </label>

            <div className="settings-action-row">
              <button onClick={autoFillEnglishName}>生成英文名</button>
              <button onClick={saveStudioInfo}>保存信息</button>
            </div>

            <label className="logo-upload-box">
              {settingsForm.logoDataUrl ? (
                <img src={settingsForm.logoDataUrl} alt="工作室 Logo" />
              ) : (
                <span>上传 Logo</span>
              )}
              <input type="file" accept="image/*" onChange={handleLogoUpload} />
            </label>
          </div>
        )}

        <button
          className="settings-row-with-subtitle"
          onClick={() => setOpenPanel(openPanel === "templates" ? "" : "templates")}
        >
          <div>
            <strong>课程模板管理</strong>
            <small>已保存 {templates.length} 个模板，从动作库选择动作</small>
          </div>
          <span>{openPanel === "templates" ? "⌃" : "›"}</span>
        </button>

        {openPanel === "templates" && (
          <div className="settings-panel-card">
            <div className="template-mini-list">
              {templates.map((template) => (
                <div key={template.id}>
                  <strong>{template.name}</strong>
                  <span>{template.actions.length} 个动作 · {template.desc}</span>
                  <button onClick={() => removeTemplate(template.id)}>删除</button>
                </div>
              ))}
            </div>

            <label className="field">
              <span>新模板名称</span>
              <input
                value={templateName}
                onChange={(event) => setTemplateName(event.target.value)}
                placeholder="例如：肩颈放松"
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

            <div className="template-builder-toolbar">
              <select value={templateApparatus} onChange={(event) => setTemplateApparatus(event.target.value)}>
                {apparatusOptions.map((item) => (
                  <option key={item.key} value={item.key}>{item.label}</option>
                ))}
              </select>
              <input
                value={templateKeyword}
                onChange={(event) => setTemplateKeyword(event.target.value)}
                placeholder="搜索动作加入模板"
              />
            </div>

            <div className="selected-template-actions">
              <strong>已选动作：{selectedTemplateActions.length}</strong>
              {selectedTemplateActions.length === 0 && <p>从下方动作库点选加入模板。</p>}
              {selectedTemplateActions.map((item, index) => (
                <button key={item.baseActionId || `${item.apparatus}-${item.keyword}`} onClick={() => removeActionFromTemplate(item.baseActionId)}>
                  {index + 1}. {item.apparatus} · {item.displayName || item.keyword} ×
                </button>
              ))}
            </div>

            <div className="template-action-picker">
              {templateSearchResults.map((action) => (
                <button key={action.id} onClick={() => addActionToTemplate(action)}>
                  <em>{action.apparatus}</em>
                  <div>
                    <strong>{action.displayName}</strong>
                    <span>{action.defaultBenefit || "暂无动作好处"}</span>
                  </div>
                </button>
              ))}
            </div>

            <button className="main-wide-button" onClick={createTemplateFromSelectedActions}>
              保存为新模板
            </button>
          </div>
        )}

        <button
          className="settings-row-with-subtitle"
          onClick={() => setOpenPanel(openPanel === "language" ? "" : "language")}
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

        <button
          className="settings-row-with-subtitle"
          onClick={() => setOpenPanel(openPanel === "library" ? "" : "library")}
        >
          <div>
            <strong>动作库管理</strong>
            <small>当前动作池 {allActions.length} 个，可按器械和关键词搜索</small>
          </div>
          <span>{openPanel === "library" ? "⌃" : "›"}</span>
        </button>

        {openPanel === "library" && (
          <div className="settings-panel-card">
            <div className="action-stats-grid">
              {apparatusOptions
                .filter((item) => item.key !== "all" && item.key !== "favorite")
                .map((item) => (
                  <div key={item.key}>
                    <strong>{item.label}</strong>
                    <span>{actionStats[item.key] || 0}</span>
                  </div>
                ))}
            </div>

            <div className="template-builder-toolbar">
              <select value={libraryApparatus} onChange={(event) => setLibraryApparatus(event.target.value)}>
                {apparatusOptions.map((item) => (
                  <option key={item.key} value={item.key}>{item.label}</option>
                ))}
              </select>
              <input
                value={libraryKeyword}
                onChange={(event) => setLibraryKeyword(event.target.value)}
                placeholder="输入中文、英文或器械代码"
              />
            </div>

            <div className="library-list">
              {filteredLibraryActions.map((action) => (
                <div key={action.id}>
                  <em>{action.apparatus}</em>
                  <div>
                    <strong>{action.displayName}</strong>
                    <span>{action.defaultBenefit || "暂无动作好处"}</span>
                  </div>
                </div>
              ))}
            </div>
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
    </section>
  );
}

export default App;
