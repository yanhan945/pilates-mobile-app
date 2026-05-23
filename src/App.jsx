import { useState } from "react";
import "./App.css";

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

const starterActions = [
  {
    name: "Footwork",
    benefit: "激活下肢力量，建立稳定发力节奏。",
  },
  {
    name: "Hundred",
    benefit: "提升核心控制，帮助呼吸和躯干稳定。",
  },
];

function App() {
  const [activeTab, setActiveTab] = useState("home");
  const [selectedMember, setSelectedMember] = useState(null);

  function openSchedule(member) {
    setSelectedMember(member);
    setActiveTab("schedule");
  }

  return (
    <div className="app-shell">
      <main className="phone-page">
        {activeTab === "home" && <HomePage onOpenSchedule={openSchedule} />}
        {activeTab === "schedule" && <SchedulePage member={selectedMember} />}
        {activeTab === "members" && <MembersPage onOpenSchedule={openSchedule} />}
        {activeTab === "settings" && <SettingsPage />}
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

function SchedulePage({ member }) {
  const lessonNumber = member ? member.lessons + 1 : 1;

  return (
    <section className="page">
      <header className="simple-header">
        <div>
          <h1>普拉提私教助手</h1>
          <p>2026.05.23 · 周六</p>
        </div>
        <button className="small-button">导入计划</button>
      </header>

      <section className="form-card">
        <h2>课程主题 / 学员姓名</h2>

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
          <span>{starterActions.length} 个动作</span>
        </div>

        <div className="action-toolbar">
          <button className="filter-button">器械 ▾</button>
          <input placeholder="输入动作关键词" />
          <button className="add-button">＋</button>
        </div>

        <div className="action-list">
          {starterActions.map((action, index) => (
            <div className="action-card" key={action.name}>
              <div className="action-number">{index + 1}</div>
              <div className="action-content">
                <strong>{action.name}</strong>
                <textarea defaultValue={action.benefit} />
              </div>
              <button className="delete-mini">×</button>
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

function SettingsPage() {
  return (
    <section className="page">
      <header className="simple-header">
        <h1>设置</h1>
      </header>

      <div className="settings-list">
        <button>账户管理 <span>›</span></button>
        <button>工作室信息 <span>›</span></button>
        <button>动作库管理 <span>›</span></button>
        <button>动作语言偏好 <span>›</span></button>
        <button>课程模板管理 <span>›</span></button>
        <button>导出数据 <span>›</span></button>
        <button>导入数据 <span>›</span></button>
      </div>
    </section>
  );
}

export default App;