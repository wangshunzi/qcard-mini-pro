Component({
  properties: {
    checked: { type: Boolean, value: false },
    disabled: { type: Boolean, value: false },
    label: { type: String, value: "切换开关" },
  },

  methods: {
    toggle() {
      if (this.data.disabled) return;
      this.triggerEvent("change", { value: !this.data.checked });
    },
  },
});
