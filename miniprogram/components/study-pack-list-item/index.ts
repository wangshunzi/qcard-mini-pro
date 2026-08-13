interface StudyPackItem {
  id?: string;
  userStudyProgress?: {
    progress?: number;
    lastStudiedAt?: string;
  };
}

function formatTimeAgo(value?: string, prefix = "学习") {
  if (!value) return prefix === "学习" ? "尚未学习" : `刚刚${prefix}`;
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (elapsed < minute) return `刚刚${prefix}`;
  if (elapsed < hour) return `${Math.floor(elapsed / minute)}分钟前`;
  if (elapsed < day) return `${Math.floor(elapsed / hour)}小时前`;
  if (elapsed < 7 * day) return `${Math.floor(elapsed / day)}天前`;
  const date = new Date(value);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

Component({
  properties: {
    item: {
      type: Object,
      value: {},
    },
    isPrivate: {
      type: Boolean,
      value: false,
    },
    privateCover: {
      type: String,
      value: "",
    },
    appIcon: {
      type: String,
      value: "",
    },
    locked: {
      type: Boolean,
      value: false,
    },
  },

  data: {
    progressPercent: 0,
    timeAgo: "尚未学习",
  },

  observers: {
    "item, locked"(value: StudyPackItem, locked: boolean) {
      const raw = Number(value?.userStudyProgress?.progress ?? 0);
      const progressPercent = Math.max(
        0,
        Math.min(100, raw <= 1 ? raw * 100 : raw),
      );
      this.setData({
        progressPercent: locked ? 0 : progressPercent,
        timeAgo: formatTimeAgo(
          value?.userStudyProgress?.lastStudiedAt,
          progressPercent > 0 ? "学习" : "解锁",
        ),
      });
    },
  },

  methods: {
    open() {
      this.triggerEvent("open", {
        id: String((this.data.item as StudyPackItem)?.id ?? ""),
      });
    },

    start() {
      this.triggerEvent("start", {
        id: String((this.data.item as StudyPackItem)?.id ?? ""),
      });
    },
  },
});
