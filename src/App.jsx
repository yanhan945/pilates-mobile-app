import { useEffect, useMemo, useState } from "react";
import "./App.css";

const STORAGE_KEY = "green-rental-mobile-v8";

const initialOrders = [
  {
    id: 1,
    customerName: "杭州东站办公室",
    status: "待接单",
    tags: ["需比价", "室外", "租过绿植"],
    areaSize: "300㎡",
    expectedDate: "2026-05-28",
    address: "杭州市上城区杭州东站附近",
    description: "客户希望办公室和门口都摆放绿植，偏好大气、好养护的植物。",
    dispatchTime: "2026-05-24 21:30",
    source: "商户派单",
  },
  {
    id: 2,
    customerName: "滨江科技公司",
    status: "待接单",
    tags: ["办公室", "长期租赁"],
    areaSize: "500㎡",
    expectedDate: "2026-06-01",
    address: "杭州市滨江区江南大道",
    description: "需要为前台、会议室、开放办公区配置绿植方案。",
    dispatchTime: "2026-05-24 19:10",
    source: "商户派单",
  },
];

const statusTabs = ["待接单", "配置中", "方案已提交", "已完成"];
const merchantStatusTabs = ["全部", "待接单", "配置中", "方案已提交", "已完成"];

const productCategories = ["室内绿植", "室外植物", "月租套餐", "仿真植物"];
const subCategories = ["大型植物", "中型植物", "小型植物", "水培植物", "盆景植物"];

const products = [
  {
    id: 1,
    name: "原生发财树",
    category: "室内绿植",
    subCategory: "大型植物",
    description: "寓意财源滚滚，适合前台、办公室、会议室。",
    pricePerDay: 2.5,
    image: "🌳",
  },
  {
    id: 2,
    name: "天堂鸟",
    category: "室内绿植",
    subCategory: "大型植物",
    description: "株型舒展，适合大堂、休息区、开放办公区。",
    pricePerDay: 3.2,
    image: "🪴",
  },
  {
    id: 3,
    name: "绿萝柱",
    category: "室内绿植",
    subCategory: "中型植物",
    description: "耐阴好养，适合办公室角落和走廊区域。",
    pricePerDay: 1.6,
    image: "🌿",
  },
  {
    id: 4,
    name: "红掌",
    category: "室内绿植",
    subCategory: "小型植物",
    description: "颜色鲜明，适合前台、桌面、接待区点缀。",
    pricePerDay: 0.8,
    image: "🌺",
  },
  {
    id: 5,
    name: "水培白掌",
    category: "室内绿植",
    subCategory: "水培植物",
    description: "干净清爽，适合会议桌、茶水间、前台。",
    pricePerDay: 0.7,
    image: "💧",
  },
  {
    id: 6,
    name: "罗汉松盆景",
    category: "室内绿植",
    subCategory: "盆景植物",
    description: "稳重大气，适合老板办公室、会客区。",
    pricePerDay: 4.5,
    image: "🎍",
  },
  {
    id: 7,
    name: "户外铁树",
    category: "室外植物",
    subCategory: "大型植物",
    description: "耐晒耐养，适合门口、庭院、园区入口。",
    pricePerDay: 3.8,
    image: "🌴",
  },
  {
    id: 8,
    name: "月租前台组合",
    category: "月租套餐",
    subCategory: "中型植物",
    description: "适合前台和接待区的基础组合套餐。",
    pricePerDay: 5.8,
    image: "🧺",
  },
  {
    id: 9,
    name: "仿真龟背竹",
    category: "仿真植物",
    subCategory: "大型植物",
    description: "无需养护，适合光线不足或维护不便区域。",
    pricePerDay: 1.2,
    image: "🍃",
  },
];

const readStorage = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data && typeof data === "object" ? data : null;
  } catch (error) {
    console.error("读取本地数据失败：", error);
    return null;
  }
};

const saveStorage = (data) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error("保存本地数据失败：", error);
  }
};

const nowText = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${h}:${min}`;
};

const safeAreas = (plan) => (Array.isArray(plan?.areas) ? plan.areas : []);
const safeItems = (area) => (Array.isArray(area?.items) ? area.items : []);

const areaCount = (area) =>
  safeItems(area).reduce((sum, item) => sum + Number(item.quantity || 0), 0);

const areaRent = (area) =>
  safeItems(area).reduce(
    (sum, item) => sum + Number(item.pricePerDay || 0) * Number(item.quantity || 0),
    0
  );

const planCount = (areas) =>
  (Array.isArray(areas) ? areas : []).reduce((sum, area) => sum + areaCount(area), 0);

const planRent = (areas) =>
  (Array.isArray(areas) ? areas : []).reduce((sum, area) => sum + areaRent(area), 0);

const formatRent = (value) => Number(value || 0).toFixed(1);

function App() {
  const [activeRole, setActiveRole] = useState("staff");
  const [activeStatus, setActiveStatus] = useState("待接单");
  const [merchantTab, setMerchantTab] = useState("订单总览");
  const [merchantStatusFilter, setMerchantStatusFilter] = useState("全部");

  const [orders, setOrders] = useState(() => {
    const saved = readStorage();
    return Array.isArray(saved?.orders) ? saved.orders : initialOrders;
  });

  const [draftPlans, setDraftPlans] = useState(() => {
    const saved = readStorage();
    return Array.isArray(saved?.draftPlans) ? saved.draftPlans : [];
  });

  const [submittedPlans, setSubmittedPlans] = useState(() => {
    const saved = readStorage();
    return Array.isArray(saved?.submittedPlans) ? saved.submittedPlans : [];
  });

  const [currentPage, setCurrentPage] = useState("orders");
  const [currentPlanId, setCurrentPlanId] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [planType, setPlanType] = useState("租赁方案");

  const [selectedOrderDetail, setSelectedOrderDetail] = useState(null);
  const [merchantViewingPlan, setMerchantViewingPlan] = useState(null);

  const [showAreaSheet, setShowAreaSheet] = useState(false);
  const [areaName, setAreaName] = useState("");

  const [showProductSheet, setShowProductSheet] = useState(false);
  const [currentAreaId, setCurrentAreaId] = useState(null);
  const [activeCategory, setActiveCategory] = useState("室内绿植");
  const [activeSubCategory, setActiveSubCategory] = useState("大型植物");
  const [searchText, setSearchText] = useState("");

  const [showPaymentSheet, setShowPaymentSheet] = useState(false);
  const [leaseMonths, setLeaseMonths] = useState(12);
  const [paymentMethod, setPaymentMethod] = useState("月付");
  const [needDeposit, setNeedDeposit] = useState(true);

  const [showPriceSheet, setShowPriceSheet] = useState(false);
  const [customTotalRent, setCustomTotalRent] = useState("");

  const [showSubmitSheet, setShowSubmitSheet] = useState(false);
  const [showMoreSheet, setShowMoreSheet] = useState(false);

  const [showCreateOrderSheet, setShowCreateOrderSheet] = useState(false);
  const [newOrderForm, setNewOrderForm] = useState({
    customerName: "",
    areaSize: "",
    expectedDate: "",
    address: "",
    description: "",
    tagsText: "办公室,长期租赁",
  });

  const currentPlan = draftPlans.find((plan) => plan.id === currentPlanId) || null;
  const planAreas = safeAreas(currentPlan);
  const currentArea = planAreas.find((area) => area.id === currentAreaId) || null;

  const dailyRent = planRent(planAreas);
  const productCount = planCount(planAreas);
  const systemTotalNumber = dailyRent * Number(leaseMonths || 0) * 30;
  const systemTotal = formatRent(systemTotalNumber);
  const finalRent = customTotalRent ? formatRent(customTotalRent) : systemTotal;

  const currentAreaCount = areaCount(currentArea);
  const currentAreaRent = areaRent(currentArea);

  const filteredOrders = orders.filter((order) => order.status === activeStatus);

  const merchantOrders = useMemo(() => {
    if (merchantStatusFilter === "全部") return orders;
    return orders.filter((order) => order.status === merchantStatusFilter);
  }, [orders, merchantStatusFilter]);

  const filteredProducts = products.filter((product) => {
    const keyword = searchText.trim();
    return (
      product.category === activeCategory &&
      product.subCategory === activeSubCategory &&
      (keyword === "" ||
        product.name.includes(keyword) ||
        product.description.includes(keyword))
    );
  });

  useEffect(() => {
    saveStorage({ orders, draftPlans, submittedPlans });
  }, [orders, draftPlans, submittedPlans]);

  useEffect(() => {
    if (currentPage === "plan" && !currentPlan) setCurrentPage("orders");
    if (showProductSheet && !currentArea) setShowProductSheet(false);
  }, [currentPage, currentPlan, showProductSheet, currentArea]);

  const updateCurrentPlan = (updater) => {
    setDraftPlans((plans) =>
      plans.map((plan) => {
        if (plan.id !== currentPlanId) return plan;
        const next = typeof updater === "function" ? updater(plan) : updater;
        return { ...next, updatedAt: nowText() };
      })
    );
  };

  const syncPlanPriceInfo = () => {
    updateCurrentPlan((plan) => {
      const areas = safeAreas(plan);
      const nextDailyRent = planRent(areas);
      const nextProductCount = planCount(areas);
      const nextSystemTotal = formatRent(nextDailyRent * Number(leaseMonths || 0) * 30);
      const nextFinalRent = customTotalRent ? formatRent(customTotalRent) : nextSystemTotal;

      return {
        ...plan,
        leaseMonths,
        paymentMethod,
        needDeposit,
        customTotalRent,
        dailyRent: formatRent(nextDailyRent),
        totalRent: nextSystemTotal,
        finalRent: nextFinalRent,
        totalProductCount: nextProductCount,
        areaCount: areas.length,
      };
    });
  };

  const resetAllSheets = () => {
    setSelectedOrder(null);
    setSelectedOrderDetail(null);
    setMerchantViewingPlan(null);
    setShowAreaSheet(false);
    setShowProductSheet(false);
    setShowPaymentSheet(false);
    setShowPriceSheet(false);
    setShowSubmitSheet(false);
    setShowMoreSheet(false);
    setShowCreateOrderSheet(false);
  };

  const switchRole = (role) => {
    setActiveRole(role);
    setCurrentPage("orders");
    resetAllSheets();
  };

  const copyText = async (text, successText = "已复制") => {
    if (!text) {
      alert("暂无可复制内容");
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      alert(successText);
    } catch (error) {
      console.error("复制失败：", error);
      const input = document.createElement("textarea");
      input.value = text;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      alert(successText);
    }
  };

  const openMap = (address) => {
    if (!address) {
      alert("暂无地址");
      return;
    }

    const encodedAddress = encodeURIComponent(address);
    const amapUrl = `https://uri.amap.com/search?keyword=${encodedAddress}&callnative=1`;

    window.open(amapUrl, "_blank");
  };

  const createPlanFromOrder = () => {
    if (!selectedOrder) return;

    const existedDraft = draftPlans.find((plan) => plan.orderId === selectedOrder.id);

    if (existedDraft) {
      setCurrentPlanId(existedDraft.id);
    } else {
      const newPlan = {
        id: Date.now(),
        orderId: selectedOrder.id,
        customerName: selectedOrder.customerName,
        planType,
        address: selectedOrder.address,
        areaSize: selectedOrder.areaSize,
        expectedDate: selectedOrder.expectedDate,
        areas: [],
        submitted: false,
        leaseMonths: 12,
        paymentMethod: "月付",
        needDeposit: true,
        customTotalRent: "",
        dailyRent: "0.0",
        totalRent: "0.0",
        finalRent: "0.0",
        totalProductCount: 0,
        areaCount: 0,
        createdAt: nowText(),
        updatedAt: nowText(),
      };

      setDraftPlans((plans) => [newPlan, ...plans]);
      setCurrentPlanId(newPlan.id);
    }

    setOrders((prev) =>
      prev.map((order) =>
        order.id === selectedOrder.id
          ? {
              ...order,
              status: "配置中",
              planStatus: "配置中",
              acceptedAt: order.acceptedAt || nowText(),
            }
          : order
      )
    );

    setLeaseMonths(12);
    setPaymentMethod("月付");
    setNeedDeposit(true);
    setCustomTotalRent("");
    setCurrentPage("plan");
    setSelectedOrder(null);
    setPlanType("租赁方案");
  };

  const openPlanForOrder = (order) => {
    const draft = draftPlans.find((plan) => plan.orderId === order.id);
    const submitted = submittedPlans.find((plan) => plan.orderId === order.id);
    const plan = draft || submitted;

    if (plan) {
      if (!draft) setDraftPlans((plans) => [plan, ...plans]);

      setCurrentPlanId(plan.id);
      setLeaseMonths(plan.leaseMonths || 12);
      setPaymentMethod(plan.paymentMethod || "月付");
      setNeedDeposit(plan.needDeposit ?? true);
      setCustomTotalRent(plan.customTotalRent || "");
    } else {
      const newPlan = {
        id: Date.now(),
        orderId: order.id,
        customerName: order.customerName,
        planType: "租赁方案",
        address: order.address,
        areaSize: order.areaSize,
        expectedDate: order.expectedDate,
        areas: [],
        submitted: false,
        leaseMonths: 12,
        paymentMethod: "月付",
        needDeposit: true,
        customTotalRent: "",
        dailyRent: "0.0",
        totalRent: "0.0",
        finalRent: "0.0",
        totalProductCount: 0,
        areaCount: 0,
        createdAt: nowText(),
        updatedAt: nowText(),
      };

      setDraftPlans((plans) => [newPlan, ...plans]);
      setCurrentPlanId(newPlan.id);
      setLeaseMonths(12);
      setPaymentMethod("月付");
      setNeedDeposit(true);
      setCustomTotalRent("");
    }

    setCurrentPage("plan");
  };

  const addArea = () => {
    const name = areaName.trim();
    if (!name) return;

    updateCurrentPlan((plan) => ({
      ...plan,
      areas: [...safeAreas(plan), { id: Date.now(), name, items: [] }],
    }));

    setAreaName("");
    setShowAreaSheet(false);
  };

  const openProductSheet = (area) => {
    setCurrentAreaId(area.id);
    setActiveCategory("室内绿植");
    setActiveSubCategory("大型植物");
    setSearchText("");
    setShowProductSheet(true);
  };

  const addProductToArea = (product) => {
    if (!currentAreaId) return;

    setDraftPlans((plans) =>
      plans.map((plan) => {
        if (plan.id !== currentPlanId) return plan;

        const nextAreas = safeAreas(plan).map((area) => {
          if (area.id !== currentAreaId) return area;

          const items = safeItems(area);
          const existed = items.find((item) => item.productId === product.id);

          const nextItems = existed
            ? items.map((item) =>
                item.productId === product.id
                  ? { ...item, quantity: Number(item.quantity || 0) + 1 }
                  : item
              )
            : [
                ...items,
                {
                  productId: product.id,
                  name: product.name,
                  pricePerDay: Number(product.pricePerDay || 0),
                  quantity: 1,
                },
              ];

          return { ...area, items: nextItems };
        });

        const nextDailyRent = planRent(nextAreas);
        const nextProductCount = planCount(nextAreas);
        const nextSystemTotal = formatRent(nextDailyRent * Number(leaseMonths || 0) * 30);
        const nextFinalRent = customTotalRent ? formatRent(customTotalRent) : nextSystemTotal;

        return {
          ...plan,
          areas: nextAreas,
          dailyRent: formatRent(nextDailyRent),
          totalRent: nextSystemTotal,
          finalRent: nextFinalRent,
          totalProductCount: nextProductCount,
          areaCount: nextAreas.length,
          updatedAt: nowText(),
        };
      })
    );
  };

  const changeItemQuantity = (areaId, productId, change) => {
    setDraftPlans((plans) =>
      plans.map((plan) => {
        if (plan.id !== currentPlanId) return plan;

        const nextAreas = safeAreas(plan).map((area) => {
          if (area.id !== areaId) return area;

          const nextItems = safeItems(area)
            .map((item) =>
              item.productId === productId
                ? { ...item, quantity: Number(item.quantity || 0) + change }
                : item
            )
            .filter((item) => Number(item.quantity || 0) > 0);

          return { ...area, items: nextItems };
        });

        const nextDailyRent = planRent(nextAreas);
        const nextProductCount = planCount(nextAreas);
        const nextSystemTotal = formatRent(nextDailyRent * Number(leaseMonths || 0) * 30);
        const nextFinalRent = customTotalRent ? formatRent(customTotalRent) : nextSystemTotal;

        return {
          ...plan,
          areas: nextAreas,
          dailyRent: formatRent(nextDailyRent),
          totalRent: nextSystemTotal,
          finalRent: nextFinalRent,
          totalProductCount: nextProductCount,
          areaCount: nextAreas.length,
          updatedAt: nowText(),
        };
      })
    );
  };

  const removeItemFromArea = (areaId, productId) => {
    setDraftPlans((plans) =>
      plans.map((plan) => {
        if (plan.id !== currentPlanId) return plan;

        const nextAreas = safeAreas(plan).map((area) => {
          if (area.id !== areaId) return area;

          return {
            ...area,
            items: safeItems(area).filter((item) => item.productId !== productId),
          };
        });

        const nextDailyRent = planRent(nextAreas);
        const nextProductCount = planCount(nextAreas);
        const nextSystemTotal = formatRent(nextDailyRent * Number(leaseMonths || 0) * 30);
        const nextFinalRent = customTotalRent ? formatRent(customTotalRent) : nextSystemTotal;

        return {
          ...plan,
          areas: nextAreas,
          dailyRent: formatRent(nextDailyRent),
          totalRent: nextSystemTotal,
          finalRent: nextFinalRent,
          totalProductCount: nextProductCount,
          areaCount: nextAreas.length,
          updatedAt: nowText(),
        };
      })
    );
  };

  const clearCurrentAreaItems = () => {
    if (!currentAreaId) return;

    setDraftPlans((plans) =>
      plans.map((plan) => {
        if (plan.id !== currentPlanId) return plan;

        const nextAreas = safeAreas(plan).map((area) =>
          area.id === currentAreaId ? { ...area, items: [] } : area
        );

        const nextDailyRent = planRent(nextAreas);
        const nextProductCount = planCount(nextAreas);
        const nextSystemTotal = formatRent(nextDailyRent * Number(leaseMonths || 0) * 30);
        const nextFinalRent = customTotalRent ? formatRent(customTotalRent) : nextSystemTotal;

        return {
          ...plan,
          areas: nextAreas,
          dailyRent: formatRent(nextDailyRent),
          totalRent: nextSystemTotal,
          finalRent: nextFinalRent,
          totalProductCount: nextProductCount,
          areaCount: nextAreas.length,
          updatedAt: nowText(),
        };
      })
    );
  };

  const savePaymentInfo = () => {
    syncPlanPriceInfo();
    setShowPaymentSheet(false);
  };

  const saveCustomPrice = () => {
    syncPlanPriceInfo();
    setShowPriceSheet(false);
  };

  const submitPlan = () => {
    if (!currentPlan) return;

    const submittedPlan = {
      ...currentPlan,
      submitted: true,
      submittedAt: nowText(),
      leaseMonths,
      paymentMethod,
      needDeposit,
      customTotalRent,
      dailyRent: dailyRent.toFixed(1),
      totalRent: systemTotal,
      finalRent,
      totalProductCount: productCount,
      areaCount: planAreas.length,
    };

    setDraftPlans((plans) =>
      plans.map((plan) => (plan.id === currentPlan.id ? submittedPlan : plan))
    );

    setSubmittedPlans((plans) => [
      submittedPlan,
      ...plans.filter((plan) => plan.orderId !== currentPlan.orderId),
    ]);

    setOrders((prev) =>
      prev.map((order) =>
        order.id === currentPlan.orderId
          ? {
              ...order,
              status: "方案已提交",
              planStatus: "方案已提交",
              submittedAt: nowText(),
            }
          : order
      )
    );

    setShowSubmitSheet(false);
    setActiveStatus("方案已提交");
    setCurrentPage("orders");
  };

  const completeOrder = (orderId) => {
    const targetOrder = orders.find((order) => order.id === orderId);

    if (!targetOrder) return;

    if (!window.confirm(`确认将「${targetOrder.customerName}」标记为已完成吗？`)) {
      return;
    }

    setOrders((prev) =>
      prev.map((order) =>
        order.id === orderId
          ? {
              ...order,
              status: "已完成",
              planStatus: "已完成",
              completedAt: nowText(),
            }
          : order
      )
    );

    setSubmittedPlans((plans) =>
      plans.map((plan) =>
        plan.orderId === orderId
          ? {
              ...plan,
              status: "已完成",
              completedAt: nowText(),
            }
          : plan
      )
    );

    if (selectedOrderDetail?.id === orderId) {
      setSelectedOrderDetail((order) =>
        order
          ? {
              ...order,
              status: "已完成",
              planStatus: "已完成",
              completedAt: nowText(),
            }
          : order
      );
    }

    setActiveStatus("已完成");
    setMerchantStatusFilter("已完成");
  };

  const createMerchantOrder = () => {
    if (!newOrderForm.customerName.trim()) {
      alert("请填写客户名称");
      return;
    }

    if (!newOrderForm.address.trim()) {
      alert("请填写客户地址");
      return;
    }

    const tags = newOrderForm.tagsText
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    const newOrder = {
      id: Date.now(),
      customerName: newOrderForm.customerName.trim(),
      status: "待接单",
      tags: tags.length ? tags : ["新订单"],
      areaSize: newOrderForm.areaSize.trim() || "待确认",
      expectedDate: newOrderForm.expectedDate.trim() || "待确认",
      address: newOrderForm.address.trim(),
      description: newOrderForm.description.trim() || "暂无详细需求，待员工现场确认。",
      dispatchTime: nowText(),
      source: "商户手动创建",
    };

    setOrders((prev) => [newOrder, ...prev]);

    setNewOrderForm({
      customerName: "",
      areaSize: "",
      expectedDate: "",
      address: "",
      description: "",
      tagsText: "办公室,长期租赁",
    });

    setShowCreateOrderSheet(false);
    setMerchantTab("订单总览");
    setMerchantStatusFilter("全部");
  };

  const buildPlanSummary = () => {
    const areaText = planAreas
      .map((area) => {
        const items = safeItems(area)
          .map((item) => `- ${item.name} × ${item.quantity}（¥${item.pricePerDay}/天）`)
          .join("\n");

        return `【${area.name}】\n${items || "- 暂无商品"}`;
      })
      .join("\n\n");

    return `绿植租赁方案
客户：${currentPlan?.customerName || "-"}
项目面积：${currentPlan?.areaSize || "-"}
进场时间：${currentPlan?.expectedDate || "-"}
客户地址：${currentPlan?.address || "-"}

方案明细：
${areaText || "暂无区域"}

日租金：¥${dailyRent.toFixed(1)}
租期：${leaseMonths}月
系统总租金：¥${systemTotal}
最终报价：¥${finalRent}
支付方式：${paymentMethod}
押金：${needDeposit ? "需要" : "不需要"}`;
  };

  const copyPlanSummary = async () => {
    const summary = buildPlanSummary();
    await copyText(summary, "方案摘要已复制");
  };

  const renderPlanPage = () => {
    if (!currentPlan) return null;

    return (
      <div className="app">
        <header className="plan-header">
          <button className="back-button" onClick={() => setCurrentPage("orders")}>
            ←
          </button>
          <div>
            <p className="eyebrow">Plan Editor</p>
            <h1>{currentPlan.customerName}</h1>
          </div>
        </header>

        <section className="plan-summary-card">
          <div className="plan-summary-top">
            <div>
              <p>方案类型</p>
              <strong>{currentPlan.planType}</strong>
            </div>
            <div>
              <p>项目面积</p>
              <strong>{currentPlan.areaSize}</strong>
            </div>
          </div>

          <div className="plan-info-line">
            <span>进场时间</span>
            <strong>{currentPlan.expectedDate}</strong>
          </div>

          <div className="plan-info-line">
            <span>客户地址</span>
            <strong>{currentPlan.address}</strong>
          </div>

          <div className="actions mini-actions">
            <button className="ghost-button" onClick={() => copyText(currentPlan.address, "地址已复制")}>
              复制地址
            </button>
            <button className="ghost-button" onClick={() => openMap(currentPlan.address)}>
              打开导航
            </button>
          </div>
        </section>

        <section className="area-section">
          <div className="section-title-row">
            <div>
              <p className="eyebrow">区域</p>
              <h2>区域配置</h2>
            </div>
            <button className="add-area-button" onClick={() => setShowAreaSheet(true)}>
              新增区域
            </button>
          </div>

          {planAreas.length === 0 ? (
            <div className="empty-card">
              <p>还没有添加区域</p>
              <span>如：前台、办公室、会议室、走廊、门口</span>
            </div>
          ) : (
            <div className="area-list">
              {planAreas.map((area) => (
                <article className="area-card" key={area.id}>
                  <div>
                    <h3>{area.name}</h3>
                    <p>
                      已选商品：{areaCount(area)} 件｜区域日租金：¥{" "}
                      {areaRent(area).toFixed(1)}
                    </p>

                    {safeItems(area).length > 0 && (
                      <div className="selected-product-list">
                        {safeItems(area).map((item) => (
                          <div className="selected-product-row" key={item.productId}>
                            <div>
                              <strong>{item.name}</strong>
                              <span>
                                ¥ {item.pricePerDay}/天 × {item.quantity}
                              </span>
                            </div>

                            <div className="quantity-controls">
                              <button
                                onClick={() =>
                                  changeItemQuantity(area.id, item.productId, -1)
                                }
                              >
                                -
                              </button>
                              <b>{item.quantity}</b>
                              <button
                                onClick={() =>
                                  changeItemQuantity(area.id, item.productId, 1)
                                }
                              >
                                +
                              </button>
                            </div>

                            <button
                              className="remove-item-button"
                              onClick={() => removeItemFromArea(area.id, item.productId)}
                            >
                              删除
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <button onClick={() => openProductSheet(area)}>选择商品</button>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="price-card price-detail-card">
          <div>
            <span>目前方案日租金</span>
            <strong>¥ {dailyRent.toFixed(1)}</strong>
          </div>
          <div>
            <span>租期</span>
            <strong>{leaseMonths} 月</strong>
          </div>
          <div>
            <span>系统预计总租金</span>
            <strong>¥ {systemTotal}</strong>
          </div>
          <div>
            <span>最终报价</span>
            <strong>¥ {finalRent}</strong>
          </div>
          <div>
            <span>支付方式</span>
            <strong>{paymentMethod}</strong>
          </div>
          <div>
            <span>押金</span>
            <strong>{needDeposit ? "需要" : "不需要"}</strong>
          </div>
        </section>

        <nav className="bottom-actions">
          <button onClick={() => setShowMoreSheet(true)}>更多</button>
          <button onClick={() => setShowPriceSheet(true)}>改价</button>
          <button onClick={() => setShowPaymentSheet(true)}>租期与支付</button>
          <button className="submit-plan-button" onClick={() => setShowSubmitSheet(true)}>
            提交方案
          </button>
        </nav>

        {showAreaSheet && (
          <div className="sheet-mask" onClick={() => setShowAreaSheet(false)}>
            <section className="bottom-sheet" onClick={(event) => event.stopPropagation()}>
              <div className="sheet-handle" />
              <div className="sheet-header">
                <div>
                  <p className="eyebrow">Add Area</p>
                  <h2>新增区域</h2>
                </div>
                <button className="close-button" onClick={() => setShowAreaSheet(false)}>
                  ×
                </button>
              </div>

              <div className="sheet-block">
                <p className="sheet-label">区域名称</p>
                <input
                  className="area-input"
                  value={areaName}
                  onChange={(e) => setAreaName(e.target.value)}
                  placeholder="例如：前台、办公室、会议室"
                />
              </div>

              <div className="quick-area-list">
                {["前台", "办公室", "会议室", "走廊", "门口"].map((name) => (
                  <button key={name} onClick={() => setAreaName(name)}>
                    {name}
                  </button>
                ))}
              </div>

              <button className="submit-sheet-button" onClick={addArea}>
                保存区域
              </button>
            </section>
          </div>
        )}

        {showProductSheet && (
          <div className="sheet-mask" onClick={() => setShowProductSheet(false)}>
            <section className="bottom-sheet" onClick={(event) => event.stopPropagation()}>
              <div className="sheet-handle" />
              <div className="sheet-header">
                <div>
                  <p className="eyebrow">Product Library</p>
                  <h2>{currentArea?.name || "当前区域"}选品</h2>
                </div>
                <button className="close-button" onClick={() => setShowProductSheet(false)}>
                  ×
                </button>
              </div>

              <div className="rent-preview">
                <span>当前区域</span>
                <strong>
                  已选 {currentAreaCount} 件｜日租金 ¥ {currentAreaRent.toFixed(1)}
                </strong>
              </div>

              <div className="sheet-block">
                <input
                  className="area-input"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="搜索植物名称 / 寓意 / 场景"
                />
              </div>

              <div className="category-tabs">
                {productCategories.map((category) => (
                  <button
                    key={category}
                    className={activeCategory === category ? "active" : ""}
                    onClick={() => {
                      setActiveCategory(category);
                      setActiveSubCategory("大型植物");
                    }}
                  >
                    {category}
                  </button>
                ))}
              </div>

              <main className="product-layout">
                <aside className="sub-category-list">
                  {subCategories.map((subCategory) => (
                    <button
                      key={subCategory}
                      className={activeSubCategory === subCategory ? "active" : ""}
                      onClick={() => setActiveSubCategory(subCategory)}
                    >
                      {subCategory}
                    </button>
                  ))}
                </aside>

                <section className="product-list">
                  {filteredProducts.length === 0 ? (
                    <div className="empty-product-card">
                      <p>暂无商品</p>
                      <span>可以换个分类，或清空搜索关键词</span>
                    </div>
                  ) : (
                    filteredProducts.map((product) => {
                      const selected = safeItems(currentArea).find(
                        (item) => item.productId === product.id
                      );
                      const selectedQuantity = selected ? Number(selected.quantity || 0) : 0;

                      return (
                        <article className="product-card" key={product.id}>
                          <div className="product-image">{product.image}</div>
                          <div className="product-info">
                            <h3>{product.name}</h3>
                            <p>{product.description}</p>
                            <div className="product-bottom">
                              <strong>¥ {product.pricePerDay}/天</strong>
                              <button onClick={() => addProductToArea(product)}>
                                {selectedQuantity > 0
                                  ? `已选 ${selectedQuantity} 件`
                                  : "加入方案"}
                              </button>
                            </div>
                          </div>
                        </article>
                      );
                    })
                  )}
                </section>
              </main>

              <button className="submit-sheet-button" onClick={() => setShowProductSheet(false)}>
                已选 {currentAreaCount} 件｜日租金 ¥ {currentAreaRent.toFixed(1)}
                ｜完成选品
              </button>

              <button className="ghost-button" onClick={clearCurrentAreaItems}>
                清空当前区域商品
              </button>
            </section>
          </div>
        )}

        {showPaymentSheet && (
          <div className="sheet-mask" onClick={() => setShowPaymentSheet(false)}>
            <section className="bottom-sheet" onClick={(event) => event.stopPropagation()}>
              <div className="sheet-handle" />
              <div className="sheet-header">
                <div>
                  <p className="eyebrow">Payment</p>
                  <h2>租期与支付</h2>
                </div>
                <button className="close-button" onClick={() => setShowPaymentSheet(false)}>
                  ×
                </button>
              </div>

              <div className="sheet-block">
                <p className="sheet-label">选择租期</p>
                <div className="option-grid">
                  {[6, 12, 24, 36].map((m) => (
                    <button
                      key={m}
                      className={leaseMonths === m ? "selected" : ""}
                      onClick={() => setLeaseMonths(m)}
                    >
                      {m} 月
                    </button>
                  ))}
                </div>
              </div>

              <div className="sheet-block">
                <p className="sheet-label">支付方式</p>
                <div className="option-grid payment-grid">
                  {["月付", "季付", "半年付", "年付"].map((m) => (
                    <button
                      key={m}
                      className={paymentMethod === m ? "selected" : ""}
                      onClick={() => setPaymentMethod(m)}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div className="deposit-row">
                <div>
                  <strong>是否需要押金</strong>
                  <span>真实业务里可根据客户情况调整</span>
                </div>
                <button
                  className={needDeposit ? "switch-button active" : "switch-button"}
                  onClick={() => setNeedDeposit(!needDeposit)}
                >
                  {needDeposit ? "需要" : "不需要"}
                </button>
              </div>

              <div className="rent-preview">
                <span>预计总租金</span>
                <strong>¥ {systemTotal}</strong>
              </div>

              <button className="submit-sheet-button" onClick={savePaymentInfo}>
                保存租期与支付
              </button>
            </section>
          </div>
        )}

        {showPriceSheet && (
          <div className="sheet-mask" onClick={() => setShowPriceSheet(false)}>
            <section className="bottom-sheet" onClick={(event) => event.stopPropagation()}>
              <div className="sheet-handle" />
              <div className="sheet-header">
                <div>
                  <p className="eyebrow">Adjust Price</p>
                  <h2>修改最终报价</h2>
                </div>
                <button className="close-button" onClick={() => setShowPriceSheet(false)}>
                  ×
                </button>
              </div>

              <div className="sheet-block">
                <p className="sheet-label">系统预计总租金</p>
                <div className="price-preview-line">
                  <span>按当前商品和租期自动计算</span>
                  <strong>¥ {systemTotal}</strong>
                </div>
              </div>

              <div className="sheet-block">
                <p className="sheet-label">最终报价</p>
                <input
                  className="price-input"
                  type="number"
                  value={customTotalRent}
                  onChange={(e) => setCustomTotalRent(e.target.value)}
                  placeholder="例如：1980"
                />
              </div>

              <div className="quick-price-list">
                {[systemTotal, 1980, 2880, 3880].map((price) => (
                  <button key={price} onClick={() => setCustomTotalRent(String(price))}>
                    ¥ {price}
                  </button>
                ))}
              </div>

              <button className="submit-sheet-button" onClick={saveCustomPrice}>
                保存最终报价
              </button>
            </section>
          </div>
        )}

        {showMoreSheet && (
          <div className="sheet-mask" onClick={() => setShowMoreSheet(false)}>
            <section className="bottom-sheet" onClick={(event) => event.stopPropagation()}>
              <div className="sheet-handle" />
              <div className="sheet-header">
                <div>
                  <p className="eyebrow">More</p>
                  <h2>更多操作</h2>
                </div>
                <button className="close-button" onClick={() => setShowMoreSheet(false)}>
                  ×
                </button>
              </div>

              <button className="submit-sheet-button" onClick={copyPlanSummary}>
                复制方案摘要
              </button>

              <button
                className="submit-sheet-button"
                onClick={() => openMap(currentPlan.address)}
              >
                打开客户地址导航
              </button>

              <button
                className="ghost-button danger"
                onClick={() => {
                  updateCurrentPlan((plan) => ({ ...plan, areas: [] }));
                  setShowMoreSheet(false);
                }}
              >
                清空全部区域
              </button>
            </section>
          </div>
        )}

        {showSubmitSheet && (
          <div className="sheet-mask" onClick={() => setShowSubmitSheet(false)}>
            <section className="bottom-sheet" onClick={(event) => event.stopPropagation()}>
              <div className="sheet-handle" />
              <div className="sheet-header">
                <div>
                  <p className="eyebrow">Submit Plan</p>
                  <h2>确认提交方案</h2>
                </div>
                <button className="close-button" onClick={() => setShowSubmitSheet(false)}>
                  ×
                </button>
              </div>

              <div className="sheet-block">
                <p className="sheet-label">方案摘要</p>
                <div className="confirm-row">
                  <span>客户名称</span>
                  <strong>{currentPlan.customerName}</strong>
                </div>
                <div className="confirm-row">
                  <span>区域数量</span>
                  <strong>{planAreas.length} 个</strong>
                </div>
                <div className="confirm-row">
                  <span>商品数量</span>
                  <strong>{productCount} 件</strong>
                </div>
                <div className="confirm-row">
                  <span>日租金</span>
                  <strong>¥ {dailyRent.toFixed(1)}</strong>
                </div>
                <div className="confirm-row">
                  <span>最终报价</span>
                  <strong>¥ {finalRent}</strong>
                </div>
                <div className="confirm-row">
                  <span>支付方式</span>
                  <strong>{paymentMethod}</strong>
                </div>
                <div className="confirm-row">
                  <span>押金</span>
                  <strong>{needDeposit ? "需要" : "不需要"}</strong>
                </div>
              </div>

              {productCount === 0 && (
                <div className="rent-preview">
                  <span>提醒</span>
                  <strong>当前还没有添加商品，也可以先提交测试流程</strong>
                </div>
              )}

              <button className="submit-sheet-button" onClick={submitPlan}>
                确认提交方案
              </button>
            </section>
          </div>
        )}
      </div>
    );
  };

  const renderMerchantPage = () => {
    const pendingCount = orders.filter((order) => order.status === "待接单").length;
    const configuringCount = orders.filter((order) => order.status === "配置中").length;
    const submittedCount = orders.filter((order) => order.status === "方案已提交").length;
    const completedCount = orders.filter((order) => order.status === "已完成").length;

    if (selectedOrderDetail) {
      return (
        <div className="app">
          <header className="plan-header">
            <button className="back-button" onClick={() => setSelectedOrderDetail(null)}>
              ←
            </button>
            <div>
              <p className="eyebrow">Order Detail</p>
              <h1>{selectedOrderDetail.customerName}</h1>
            </div>
          </header>

          <section className="plan-summary-card">
            <div className="plan-summary-top">
              <div>
                <p>订单状态</p>
                <strong>{selectedOrderDetail.planStatus || selectedOrderDetail.status}</strong>
              </div>
              <div>
                <p>项目面积</p>
                <strong>{selectedOrderDetail.areaSize}</strong>
              </div>
            </div>

            <div className="plan-info-line">
              <span>期望进场</span>
              <strong>{selectedOrderDetail.expectedDate}</strong>
            </div>
            <div className="plan-info-line">
              <span>客户地址</span>
              <strong>{selectedOrderDetail.address}</strong>
            </div>
            <div className="plan-info-line">
              <span>派单时间</span>
              <strong>{selectedOrderDetail.dispatchTime}</strong>
            </div>
            <div className="plan-info-line">
              <span>订单来源</span>
              <strong>{selectedOrderDetail.source || "商户派单"}</strong>
            </div>

            <p className="description">{selectedOrderDetail.description}</p>

            <div className="actions">
              <button
                className="ghost-button"
                onClick={() => copyText(selectedOrderDetail.address, "地址已复制")}
              >
                复制地址
              </button>
              <button
                className="ghost-button"
                onClick={() => openMap(selectedOrderDetail.address)}
              >
                打开导航
              </button>

              {selectedOrderDetail.status === "方案已提交" && (
                <button
                  className="primary-button"
                  onClick={() => completeOrder(selectedOrderDetail.id)}
                >
                  完成订单
                </button>
              )}
            </div>
          </section>
        </div>
      );
    }

    if (merchantViewingPlan) {
      const viewAreas = safeAreas(merchantViewingPlan);

      return (
        <div className="app">
          <header className="plan-header">
            <button className="back-button" onClick={() => setMerchantViewingPlan(null)}>
              ←
            </button>
            <div>
              <p className="eyebrow">Plan Detail</p>
              <h1>{merchantViewingPlan.customerName}</h1>
            </div>
          </header>

          <section className="plan-summary-card">
            <div className="plan-summary-top">
              <div>
                <p>方案状态</p>
                <strong>{merchantViewingPlan.status || "方案已提交"}</strong>
              </div>
              <div>
                <p>最终报价</p>
                <strong>¥ {merchantViewingPlan.finalRent}</strong>
              </div>
            </div>

            <div className="plan-info-line">
              <span>项目面积</span>
              <strong>{merchantViewingPlan.areaSize}</strong>
            </div>
            <div className="plan-info-line">
              <span>进场时间</span>
              <strong>{merchantViewingPlan.expectedDate}</strong>
            </div>
            <div className="plan-info-line">
              <span>客户地址</span>
              <strong>{merchantViewingPlan.address}</strong>
            </div>
            <div className="plan-info-line">
              <span>提交时间</span>
              <strong>{merchantViewingPlan.submittedAt}</strong>
            </div>

            <div className="actions">
              <button
                className="ghost-button"
                onClick={() => copyText(merchantViewingPlan.address, "地址已复制")}
              >
                复制地址
              </button>
              <button
                className="ghost-button"
                onClick={() => openMap(merchantViewingPlan.address)}
              >
                打开导航
              </button>
              <button className="ghost-button" onClick={() => copyText(buildPlanTextFromPlan(merchantViewingPlan), "方案已复制")}>
                复制方案
              </button>
            </div>
          </section>

          <section className="price-card price-detail-card">
            <div>
              <span>日租金</span>
              <strong>¥ {merchantViewingPlan.dailyRent}</strong>
            </div>
            <div>
              <span>租期</span>
              <strong>{merchantViewingPlan.leaseMonths} 月</strong>
            </div>
            <div>
              <span>系统总租金</span>
              <strong>¥ {merchantViewingPlan.totalRent}</strong>
            </div>
            <div>
              <span>最终报价</span>
              <strong>¥ {merchantViewingPlan.finalRent}</strong>
            </div>
            <div>
              <span>支付方式</span>
              <strong>{merchantViewingPlan.paymentMethod}</strong>
            </div>
            <div>
              <span>押金</span>
              <strong>{merchantViewingPlan.needDeposit ? "需要" : "不需要"}</strong>
            </div>
          </section>

          <section className="area-section">
            <div className="section-title-row">
              <div>
                <p className="eyebrow">Areas</p>
                <h2>方案明细</h2>
              </div>
            </div>

            {viewAreas.length === 0 ? (
              <div className="empty-card">
                <p>这个方案还没有区域明细</p>
              </div>
            ) : (
              <div className="area-list">
                {viewAreas.map((area) => (
                  <article className="area-card" key={area.id}>
                    <div>
                      <h3>{area.name}</h3>
                      <p>
                        已选商品：{areaCount(area)} 件｜区域日租金：¥{" "}
                        {areaRent(area).toFixed(1)}
                      </p>

                      {safeItems(area).length > 0 && (
                        <div className="selected-product-list">
                          {safeItems(area).map((item) => (
                            <div className="selected-product-row" key={item.productId}>
                              <div>
                                <strong>{item.name}</strong>
                                <span>
                                  ¥ {item.pricePerDay}/天 × {item.quantity}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}

            {merchantViewingPlan.status !== "已完成" && (
              <button
                className="submit-sheet-button"
                onClick={() => completeOrder(merchantViewingPlan.orderId)}
              >
                标记为已完成
              </button>
            )}
          </section>
        </div>
      );
    }

    return (
      <div className="app">
        <header className="app-header">
          <div>
            <p className="eyebrow">Merchant Console</p>
            <h1>商户管理端</h1>
          </div>
          <button className="role-button" onClick={() => switchRole("staff")}>
            切到员工端
          </button>
        </header>

        <section className="tabs">
          {["订单总览", "已提交方案"].map((tab) => (
            <button
              key={tab}
              className={merchantTab === tab ? "tab active" : "tab"}
              onClick={() => setMerchantTab(tab)}
            >
              {tab}
            </button>
          ))}
        </section>

        <section className="plan-summary-card">
          <div className="plan-summary-top">
            <div>
              <p>待接单</p>
              <strong>{pendingCount} 单</strong>
            </div>
            <div>
              <p>配置中</p>
              <strong>{configuringCount} 单</strong>
            </div>
          </div>
          <div className="plan-summary-top">
            <div>
              <p>方案已提交</p>
              <strong>{submittedCount} 单</strong>
            </div>
            <div>
              <p>已完成</p>
              <strong>{completedCount} 单</strong>
            </div>
          </div>
          <div className="plan-info-line">
            <span>已提交方案</span>
            <strong>{submittedPlans.length} 份</strong>
          </div>
        </section>

        {merchantTab === "订单总览" && (
          <>
            <section className="area-section">
              <div className="section-title-row">
                <div>
                  <p className="eyebrow">Create Order</p>
                  <h2>派发新订单</h2>
                </div>
                <button className="add-area-button" onClick={() => setShowCreateOrderSheet(true)}>
                  创建订单
                </button>
              </div>
            </section>

            <section className="tabs">
              {merchantStatusTabs.map((status) => (
                <button
                  key={status}
                  className={merchantStatusFilter === status ? "tab active" : "tab"}
                  onClick={() => setMerchantStatusFilter(status)}
                >
                  {status}
                </button>
              ))}
            </section>

            <section className="area-section">
              <div className="section-title-row">
                <div>
                  <p className="eyebrow">Orders</p>
                  <h2>{merchantStatusFilter === "全部" ? "全部订单" : merchantStatusFilter}</h2>
                </div>
              </div>

              <main className="order-list">
                {merchantOrders.length === 0 ? (
                  <div className="empty-card">
                    <p>当前状态下暂无订单</p>
                    <span>可以切换其他状态查看</span>
                  </div>
                ) : (
                  merchantOrders.map((order) => (
                    <article className="order-card" key={order.id}>
                      <div className="order-card-header">
                        <div>
                          <h2>{order.customerName}</h2>
                          <p>{order.planStatus || order.status}</p>
                        </div>
                        <span className="area-size">{order.areaSize}</span>
                      </div>

                      <div className="tag-list">
                        {(Array.isArray(order.tags) ? order.tags : []).map((tag) => (
                          <span key={tag}>{tag}</span>
                        ))}
                      </div>

                      <div className="info-row">
                        <span>期望进场</span>
                        <strong>{order.expectedDate}</strong>
                      </div>
                      <div className="info-row">
                        <span>客户地址</span>
                        <strong>{order.address}</strong>
                      </div>

                      <p className="description">{order.description}</p>
                      <p className="dispatch-time">派单时间：{order.dispatchTime}</p>

                      <div className="actions">
                        <button
                          className="ghost-button"
                          onClick={() => copyText(order.address, "地址已复制")}
                        >
                          复制地址
                        </button>
                        <button className="ghost-button" onClick={() => openMap(order.address)}>
                          打开导航
                        </button>
                        <button
                          className="primary-button"
                          onClick={() => {
                            setSelectedOrderDetail(order);
                            setMerchantViewingPlan(null);
                          }}
                        >
                          查看订单详情
                        </button>

                        {order.status === "方案已提交" && (
                          <button className="primary-button" onClick={() => completeOrder(order.id)}>
                            完成订单
                          </button>
                        )}
                      </div>
                    </article>
                  ))
                )}
              </main>
            </section>
          </>
        )}

        {merchantTab === "已提交方案" && (
          <section className="area-section">
            <div className="section-title-row">
              <div>
                <p className="eyebrow">Submitted Plans</p>
                <h2>员工提交的方案</h2>
              </div>
            </div>

            {submittedPlans.length === 0 ? (
              <div className="empty-card">
                <p>暂时还没有员工提交方案</p>
                <span>先切到员工端，完成一次提交方案流程</span>
              </div>
            ) : (
              <div className="order-list">
                {submittedPlans.map((plan) => (
                  <article className="order-card" key={plan.id}>
                    <div className="order-card-header">
                      <div>
                        <h2>{plan.customerName}</h2>
                        <p>{plan.status || "方案已提交"}</p>
                      </div>
                      <span className="area-size">¥ {plan.finalRent}</span>
                    </div>

                    <div className="info-row">
                      <span>区域数量</span>
                      <strong>{plan.areaCount} 个</strong>
                    </div>
                    <div className="info-row">
                      <span>商品数量</span>
                      <strong>{plan.totalProductCount} 件</strong>
                    </div>
                    <div className="info-row">
                      <span>支付方式</span>
                      <strong>{plan.paymentMethod}</strong>
                    </div>
                    <div className="info-row">
                      <span>提交时间</span>
                      <strong>{plan.submittedAt}</strong>
                    </div>

                    <div className="actions">
                      <button
                        className="primary-button"
                        onClick={() => {
                          setMerchantViewingPlan(plan);
                          setSelectedOrderDetail(null);
                        }}
                      >
                        查看方案
                      </button>

                      {plan.status !== "已完成" && (
                        <button
                          className="primary-button"
                          onClick={() => completeOrder(plan.orderId)}
                        >
                          完成订单
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {showCreateOrderSheet && (
          <div className="sheet-mask" onClick={() => setShowCreateOrderSheet(false)}>
            <section className="bottom-sheet" onClick={(event) => event.stopPropagation()}>
              <div className="sheet-handle" />
              <div className="sheet-header">
                <div>
                  <p className="eyebrow">New Order</p>
                  <h2>创建新订单</h2>
                </div>
                <button className="close-button" onClick={() => setShowCreateOrderSheet(false)}>
                  ×
                </button>
              </div>

              {[
                ["客户名称", "customerName", "例如：西湖写字楼客户"],
                ["项目面积", "areaSize", "例如：260㎡"],
                ["期望进场时间", "expectedDate", "例如：2026-06-08"],
                ["客户地址", "address", "例如：杭州市西湖区文三路"],
                ["需求描述", "description", "例如：前台和会议室需要绿植配置"],
                ["标签，用英文逗号分隔", "tagsText", "例如：办公室,长期租赁"],
              ].map(([label, key, placeholder]) => (
                <div className="sheet-block" key={key}>
                  <p className="sheet-label">{label}</p>
                  <input
                    className="area-input"
                    value={newOrderForm[key]}
                    onChange={(event) =>
                      setNewOrderForm((form) => ({
                        ...form,
                        [key]: event.target.value,
                      }))
                    }
                    placeholder={placeholder}
                  />
                </div>
              ))}

              <button className="submit-sheet-button" onClick={createMerchantOrder}>
                创建并派发订单
              </button>
            </section>
          </div>
        )}
      </div>
    );
  };

  const buildPlanTextFromPlan = (plan) => {
    const areas = safeAreas(plan);

    const areaText = areas
      .map((area) => {
        const items = safeItems(area)
          .map((item) => `- ${item.name} × ${item.quantity}（¥${item.pricePerDay}/天）`)
          .join("\n");

        return `【${area.name}】\n${items || "- 暂无商品"}`;
      })
      .join("\n\n");

    return `绿植租赁方案
客户：${plan.customerName || "-"}
项目面积：${plan.areaSize || "-"}
进场时间：${plan.expectedDate || "-"}
客户地址：${plan.address || "-"}

方案明细：
${areaText || "暂无区域"}

日租金：¥${plan.dailyRent || "0.0"}
租期：${plan.leaseMonths || "-"}月
系统总租金：¥${plan.totalRent || "0.0"}
最终报价：¥${plan.finalRent || "0.0"}
支付方式：${plan.paymentMethod || "-"}
押金：${plan.needDeposit ? "需要" : "不需要"}`;
  };

  if (currentPage === "plan" && currentPlan) return renderPlanPage();
  if (activeRole === "merchant") return renderMerchantPage();

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <p className="eyebrow">Green Rental</p>
          <h1>绿植租赁接单系统</h1>
        </div>
        <button className="role-button" onClick={() => switchRole("merchant")}>
          切到商户端
        </button>
      </header>

      <section className="tabs">
        {statusTabs.map((status) => (
          <button
            key={status}
            className={activeStatus === status ? "tab active" : "tab"}
            onClick={() => setActiveStatus(status)}
          >
            {status}
          </button>
        ))}
      </section>

      <main className="order-list">
        {filteredOrders.length === 0 ? (
          <div className="empty-card">
            <p>暂无{activeStatus}订单</p>
            <span>切换其他状态看看</span>
          </div>
        ) : (
          filteredOrders.map((order) => (
            <article className="order-card" key={order.id}>
              <div className="order-card-header">
                <div>
                  <h2>{order.customerName}</h2>
                  <p>{order.planStatus || order.status}</p>
                </div>
                <span className="area-size">{order.areaSize}</span>
              </div>

              <div className="tag-list">
                {(Array.isArray(order.tags) ? order.tags : []).map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>

              <div className="info-row">
                <span>期望进场</span>
                <strong>{order.expectedDate}</strong>
              </div>
              <div className="info-row">
                <span>客户地址</span>
                <strong>{order.address}</strong>
              </div>

              <p className="description">{order.description}</p>
              <p className="dispatch-time">派单时间：{order.dispatchTime}</p>

              <div className="actions">
                <button className="ghost-button" onClick={() => openMap(order.address)}>
                  导航
                </button>
                <button className="ghost-button" onClick={() => copyText(order.address, "地址已复制")}>
                  复制地址
                </button>
                <button className="ghost-button danger">拒绝接单</button>

                {order.status === "待接单" ? (
                  <button className="primary-button" onClick={() => setSelectedOrder(order)}>
                    确认接单
                  </button>
                ) : order.status === "已完成" ? (
                  <button className="primary-button" onClick={() => openPlanForOrder(order)}>
                    查看方案
                  </button>
                ) : (
                  <button className="primary-button" onClick={() => openPlanForOrder(order)}>
                    继续编辑方案
                  </button>
                )}
              </div>
            </article>
          ))
        )}
      </main>

      {selectedOrder && (
        <div className="sheet-mask" onClick={() => setSelectedOrder(null)}>
          <section className="bottom-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="sheet-handle" />

            <div className="sheet-header">
              <div>
                <p className="eyebrow">Confirm Order</p>
                <h2>确认接单</h2>
              </div>
              <button className="close-button" onClick={() => setSelectedOrder(null)}>
                ×
              </button>
            </div>

            <div className="sheet-block">
              <p className="sheet-label">选择方案类型</p>
              <div className="plan-type-grid">
                <button
                  className={planType === "租赁方案" ? "selected" : ""}
                  onClick={() => setPlanType("租赁方案")}
                >
                  租赁方案
                </button>
                <button
                  className={planType === "零售方案" ? "selected" : ""}
                  onClick={() => setPlanType("零售方案")}
                >
                  零售方案
                </button>
              </div>
            </div>

            <div className="sheet-block">
              <p className="sheet-label">客户信息</p>
              <div className="confirm-row">
                <span>客户名称</span>
                <strong>{selectedOrder.customerName}</strong>
              </div>
              <div className="confirm-row">
                <span>项目面积</span>
                <strong>{selectedOrder.areaSize}</strong>
              </div>
              <div className="confirm-row">
                <span>进场时间</span>
                <strong>{selectedOrder.expectedDate}</strong>
              </div>
              <div className="confirm-row address">
                <span>客户地址</span>
                <strong>{selectedOrder.address}</strong>
              </div>
            </div>

            <button className="submit-sheet-button" onClick={createPlanFromOrder}>
              确认接单并创建{planType}
            </button>
          </section>
        </div>
      )}
    </div>
  );
}

export default App;
