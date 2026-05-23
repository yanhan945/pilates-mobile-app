// 完整基础动作库
// 来源：全场馆中英文动作库
// 作用：完整搜索池 / 搜索兜底库。
// 注意：这个文件是只读基础数据，不要在使用过程中直接修改它。
// 后面我们会把 500+ 动作逐步清洗后放进这里。

export const baseActionsFull = [
  {
    id: "full-m-pelvic-clock",
    source: "full",
    apparatus: "M",
    name: "Pelvic Clock",
    cnName: "",
    level: "G",
    benefits: [
      "增加骨盆灵活性和本体感觉",
      "强化核心控制",
    ],
    defaultBenefit: "增加骨盆灵活性和本体感觉；强化核心控制",
  },
  {
    id: "full-m-dead-bug",
    source: "full",
    apparatus: "M",
    name: "Femur Arcs / Dead Bug",
    cnName: "死虫式",
    level: "G",
    benefits: [
      "激活核心",
      "增加躯干协调性",
      "强化髋屈肌群离心控制",
    ],
    defaultBenefit: "激活核心；增加躯干协调性；强化髋屈肌群离心控制",
  },
  {
    id: "full-m-roll-up",
    source: "full",
    apparatus: "M",
    name: "Roll Up",
    cnName: "卷起",
    level: "F",
    benefits: [
      "强化腹部核心",
      "增加脊柱屈曲灵活性",
      "改善卷曲控制",
    ],
    defaultBenefit: "强化腹部核心；增加脊柱屈曲灵活性；改善卷曲控制",
  },
  {
    id: "full-r-footwork-series",
    source: "full",
    apparatus: "R",
    name: "Footwork ",
    cnName: "蹬腿系列",
    level: "G",
    benefits: [
      "强化下肢力量和髋膝踝关节协调",
      "改善足弓支撑",
      "增加腿部控制",
    ],
    defaultBenefit: "强化下肢力量和髋膝踝关节协调；改善足弓支撑；增加腿部控制",
  },
  {
    id: "full-r-hundred",
    source: "full",
    apparatus: "R",
    name: "Hundred",
    cnName: "百次拍击",
    level: "G",
    benefits: [
      "激活腹横肌",
      "增加呼吸配合能力",
      "强化核心控制",
    ],
    defaultBenefit: "激活腹横肌；增加呼吸配合能力；强化核心控制",
  },
];