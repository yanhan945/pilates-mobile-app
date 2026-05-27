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
  const didAutoSaveOnceRef = useRef(false);

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
  function clearCurrentDraft() {
  const nextForm = {
    weather: "晴 24℃",
    studentName: member?.name || "",
    lessonTheme: "",
    summary: "",
  };

  setLessonForm(nextForm);
  setActions([]);
  setPasteText("");
  setParsedRows([]);

  saveLessonDraft({
    id: `draft-${nextForm.studentName || "guest"}-${lessonNumber}`,
    memberName: nextForm.studentName,
    lessonNumber,
    lessonDate: getTodayLabel(),
    weather: nextForm.weather,
    lessonTheme: nextForm.lessonTheme,
    actions: [],
    summary: "",
    languagePreference,
  });

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

     <div className="floating-actions course-save-actions">
  <button className="danger-action" onClick={clearCurrentDraft}>
    清空草稿
  </button>
  <button className="dark-action" onClick={saveCurrentDraft}>
    保存草稿
  </button>
  <button className="light-action" onClick={saveCurrentLesson}>
    保存课程
  </button>
  <button className="main-action">
    生成海报
  </button>
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
