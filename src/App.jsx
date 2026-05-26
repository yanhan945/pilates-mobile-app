import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import {
  createSelectedLessonAction,
  createTemporaryLessonAction,
  findBestActionMatch,
  searchActions,
} from "./data/actionRepository";
import {
  getAppData,
  getTemplates,
  saveLesson,
  saveLessonDraft,
  saveSettings,
} from "./data/localStore";

const apparatusOptions = [
  { key: "all", label: "全部", desc: "全部动作" },
  { key: "M", label: "M", desc: "垫上" },
  { key: "R", label: "R", desc: "核心床" },
  { key: "TT", label: "TT", desc: "卡迪拉克 / 秋千床" },
  { key: "LB", label: "LB", desc: "梯桶 / Ladder Barrel" },
  { key: "C", label: "C", desc: "椅子 / 稳踏椅" },
  { key: "SC", label: "SC", desc: "脊柱矫正器" },
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

      const apparatusMatch = line.match(/^([A-Za-z]{1,3}|哑铃|壶铃|波速球)\s*[-—:：]?\s*(.+)$/);
      const maybeApparatus = apparatusMatch?.[1]?.toUpperCase();
      const normalizedApparatus = apparatusAliases[maybeApparatus] || apparatusAliases[apparatusMatch?.[1]];

      if (normalizedApparatus && apparatusMatch?.[2]) {
        return {
          id: `parsed-${index}`,
          rawText: line,
          type: "action",
          apparatus: normalizedApparatus,
          keyword: apparatusMatch[2].trim(),
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

  const recommendedActions = useMemo(() => {
    return searchActions({
      keyword: searchKeyword,
      apparatus: selectedApparatus,
      languagePreference,
    }).slice(0, 8);
  }, [searchKeyword, selectedApparatus, languagePreference]);

  function updateLessonField(fieldName, nextValue) {
    setLessonForm((current) => ({
      ...current,
      [fieldName]: nextValue,
    }));
  }

  function addAction(action) {
  setActions((currentActions) => [
    ...currentActions,
    createSelectedLessonAction(action),
  ]);

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
    setActions((currentActions) =>
      currentActions.filter((action) => action.id !== actionId)
    );
  }

  function buildLessonPayload() {
    return {
      id: `lesson-${member?.name || "guest"}-${lessonNumber}`,
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

  function applyTemplate(template) {
    const nextActions = template.actions.map((item) => {
      const matchedAction = findBestActionMatch({
        apparatus: item.apparatus,
        keyword: item.keyword,
        languagePreference,
      });

      if (matchedAction) {
        return createSelectedLessonAction(matchedAction);
      }

      return createTemporaryLessonAction({
        apparatus: item.apparatus,
        name: item.keyword,
      });
    });

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
      currentRows.map((row) =>
        row.id === rowId ? { ...row, type: nextType } : row
      )
    );
  }

  function importParsedRows() {
    const nextActions = [];
    let pendingSummary = lessonForm.summary || "";

    parsedRows.forEach((row) => {
      if (row.type === "summary") {
        pendingSummary = row.keyword;
        return;
      }

      if (row.type === "action") {
        const matchedAction = findBestActionMatch({
          apparatus: row.apparatus || "all",
          keyword: row.keyword,
          languagePreference,
        });

        if (matchedAction) {
          nextActions.push(createSelectedLessonAction(matchedAction));
          return;
        }

        nextActions.push(
          createTemporaryLessonAction({
            apparatus: row.apparatus || "M",
            name: row.keyword || row.rawText,
          })
        );

        return;
      }

      const lastAction = nextActions[nextActions.length - 1];

      if (lastAction) {
        lastAction.comment = lastAction.comment
          ? `${lastAction.comment}\n${row.keyword}`
          : row.keyword;
      } else {
        pendingSummary = pendingSummary
          ? `${pendingSummary}\n${row.keyword}`
          : row.keyword;
      }
    });

    setActions((currentActions) => [...currentActions, ...nextActions]);
    setLessonForm((current) => ({
      ...current,
      summary: pendingSummary,
    }));
    setPasteText("");
    setParsedRows([]);
    setIsQuickPanelOpen(false);
  }

  return (
    <section className="page">
      <header className="simple-header schedule-header">
        <div>
          <h1>{lessonForm.studentName ? `${lessonForm.studentName} · 第${lessonNumber}节` : "普拉提私教助手"}</h1>
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
                      setTimeout(() => searchInputRef.current?.focus(), 0);
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
              if (recommendedActions[0]) {
                addAction(recommendedActions[0]);
              }
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
                <strong className="action-name">{action.name}</strong>
                <button className="delete-mini" onClick={() => deleteAction(action.id)}>
                  ×
                </button>
              </div>

              <label className="action-line">
                <span>好处</span>
                <textarea
                  value={action.benefit}
                  onChange={(event) =>
                    updateActionField(action.id, "benefit", event.target.value)
                  }
                  placeholder="输入这个动作本节课的训练好处..."
                />
              </label>

              <label className="action-line">
                <span>点评</span>
                <textarea
                  value={action.comment}
                  onChange={(event) =>
                    updateActionField(action.id, "comment", event.target.value)
                  }
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
              <button
                className={quickMode === "templates" ? "active" : ""}
                onClick={() => setQuickMode("templates")}
              >
                套用模板
              </button>
              <button
                className={quickMode === "paste" ? "active" : ""}
                onClick={() => setQuickMode("paste")}
              >
                粘贴排课
              </button>
              <button
                className={quickMode === "history" ? "active" : ""}
                onClick={() => setQuickMode("history")}
              >
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
          <button
            className="member-card"
            key={member.name}
            onClick={() => onOpenSchedule(member)}
          >
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
  const [isLanguagePanelOpen, setIsLanguagePanelOpen] = useState(false);
  const templates = useMemo(() => getTemplates(), []);

  const languageLabelMap = {
    chinese: "中文优先",
    english: "英文优先",
    mixed: "中英对照",
  };

  function chooseLanguagePreference(nextPreference) {
    setLanguagePreference(nextPreference);
    setIsLanguagePanelOpen(false);
  }

  return (
    <section className="page">
      <header className="simple-header">
        <h1>设置</h1>
      </header>

      <div className="settings-list">
        <button>
          工作室信息 <span>›</span>
        </button>

        <button className="settings-row-with-subtitle">
          <div>
            <strong>课程模板管理</strong>
            <small>已内置 {templates.length} 个快速排课模板</small>
          </div>
          <span>›</span>
        </button>

        <button
          className="settings-row-with-subtitle"
          onClick={() => setIsLanguagePanelOpen((current) => !current)}
        >
          <div>
            <strong>动作语言偏好</strong>
            <small>{languageLabelMap[languagePreference]}</small>
          </div>
          <span>{isLanguagePanelOpen ? "⌃" : "›"}</span>
        </button>

        {isLanguagePanelOpen && (
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
          动作库管理 <span>›</span>
        </button>

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
