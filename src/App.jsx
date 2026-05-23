import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { createSelectedLessonAction, searchActions } from "./data/actionRepository";

const recentMembers = [
  {
    name: "丽容",
    goal: "减脂 / 改善僵硬",
    lessons: 18,
    lastDate: "5月22日",
  },
  {
    name: "张小美",
    goal: "塑形翘臀",
    lessons: 4,
    lastDate: "5月15日",
  },
  {
    name: "陈思思",
    goal: "改善久坐不适",
    lessons: 0,
    lastDate: "暂无记录",
  },
];

const allMembers = [
  {
    name: "陈思思",
    phone: "136****5432",
    goal: "改善久坐不适",
    lessons: 0,
  },
  {
    name: "王丽",
    phone: "139****9000",
    goal: "塑形增肌",
    lessons: 3,
  },
  {
    name: "李娜",
    phone: "138****2222",
    goal: "康复训练",
    lessons: 6,
  },
  {
    name: "张小美",
    phone: "138****8000",
    goal: "塑形翘臀",
    lessons: 4,
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
  { key: "favorite", label: "收藏", desc: "常用收藏动作" },
  { key: "dumbbell", label: "哑铃", desc: "哑铃类小工具" },
  { key: "kettlebell", label: "壶铃", desc: "壶铃类小工具" },
  { key: "bosu", label: "波速球", desc: "BOSU / 平衡训练" },
];



function App() {
  const [activeTab, setActiveTab] = useState("home");
  const [selectedMember, setSelectedMember] = useState(null);
const [languagePreference, setLanguagePreference] = useState("chinese");

  function openSchedule(member) {
    setSelectedMember(member);
    setActiveTab("schedule");
  }

  return (
    <div className="app-shell">
      <main className="phone-page">
        {activeTab === "home" && <HomePage onOpenSchedule={openSchedule} />}
        {activeTab === "schedule" && (
  <SchedulePage
    member={selectedMember}
    languagePreference={languagePreference}
  />
)}
        {activeTab === "members" && <MembersPage onOpenSchedule={openSchedule} />}
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

function HomePage({ onOpenSchedule }) {
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
  const [actions, setActions] = useState([
  {
    id: "selected-footwork",
    name: "Footwork",
    benefit: "激活下肢力量，建立稳定发力节奏。",
    comment: "",
  },
  {
    id: "selected-hundred",
    name: "Hundred",
    benefit: "提升核心控制，帮助呼吸和躯干稳定。",
    comment: "",
  },
]);
  

  const lessonNumber = member ? member.lessons + 1 : 1;

  const selectedApparatusLabel =
    apparatusOptions.find((item) => item.key === selectedApparatus)?.label || "全部";

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

  const filteredActions = useMemo(() => {
  return searchActions({
    keyword: searchKeyword,
    apparatus: selectedApparatus,
    languagePreference,
  }).slice(0, 8);
}, [searchKeyword, selectedApparatus, languagePreference]);

  function addAction(action) {
    setActions((currentActions) => [
  ...currentActions,
  createSelectedLessonAction(action),
]);

    setSearchKeyword("");

    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 0);
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

    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 0);
  }

  return (
    <section className="page">
      <header className="simple-header">
        <div>
          <h1>普拉提私教助手</h1>
          <p>2026.05.23 · 周六</p>
        </div>
        <button className="small-button">快速填充</button>
      </header>

      <section className="form-card">
        <h2>课程信息</h2>

        <label className="field">
          <span>天气</span>
          <input placeholder="例如：晴 24℃" defaultValue="晴 24℃" />
        </label>

        <div className="two-column">
          <label className="field">
            <span>学员</span>
            <input placeholder="选择或输入学员姓名" defaultValue={member?.name || ""} />
          </label>

          <label className="lesson-stepper">
            <span>课次</span>
            <div>
              <button>-</button>
              <strong>{lessonNumber}</strong>
              <button>+</button>
            </div>
          </label>
        </div>

        <label className="field">
          <span>课程主题</span>
          <input placeholder="例如：核心增强" defaultValue={member ? "核心增强" : ""} />
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

                      setTimeout(() => {
                        searchInputRef.current?.focus();
                      }, 0);
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
              if (filteredActions[0]) {
                addAction(filteredActions[0]);
              }
            }}
          >
            ＋
          </button>
        </div>

        {(searchKeyword || isApparatusOpen) && (
          <div className="search-results">
            {filteredActions.map((action) => (
  <button key={action.id} onClick={() => addAction(action)}>
    <div>
      <strong>{action.displayName}</strong>
      <span>{action.defaultBenefit}</span>
    </div>
    <em>{action.apparatus}</em>
  </button>
))}
            {filteredActions.length === 0 && (
              <p className="empty-result">没有找到动作，可以之后做“临时新增动作”。</p>
            )}
          </div>
        )}

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
          defaultValue="今天整体完成度不错，核心控制比上节课更稳定，后续可以继续加强骨盆稳定和呼吸配合。"
        />
      </section>

      <div className="floating-actions">
        <button className="dark-action">保存课程</button>
        <button className="light-action">预览</button>
        <button className="main-action">生成海报</button>
      </div>
    </section>
  );
}

function MembersPage({ onOpenSchedule }) {
  return (
    <section className="page">
      <header className="simple-header">
        <h1>会员管理</h1>
        <button className="round-button">＋</button>
      </header>

      <div className="search-box members-search">搜索会员...</div>

      <div className="card-list">
        {allMembers.map((member) => (
          <button
            className="member-card"
            key={member.name}
            onClick={() => onOpenSchedule(member)}
          >
            <div className="avatar">{member.name.slice(0, 1)}</div>
            <div className="member-info">
              <strong>{member.name}</strong>
              <p>{member.phone}</p>
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

        <button>
          课程模板管理 <span>›</span>
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
              <small>搜索和海报优先显示中文名，没有中文时显示英文。</small>
            </button>

            <button
              className={languagePreference === "english" ? "active" : ""}
              onClick={() => chooseLanguagePreference("english")}
            >
              <strong>英文优先</strong>
              <small>适合习惯国际体系动作名的老师。</small>
            </button>

            <button
              className={languagePreference === "mixed" ? "active" : ""}
              onClick={() => chooseLanguagePreference("mixed")}
            >
              <strong>中英对照</strong>
              <small>同时显示中文和英文，方便对照。</small>
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