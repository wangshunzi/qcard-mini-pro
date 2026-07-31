Component({
  properties: {
    status: {
      type: String,
      value: "processing",
    },
    compact: {
      type: Boolean,
      value: false,
    },
    retry: {
      type: Boolean,
      value: false,
    },
  },
  methods: {
    retry() {
      this.triggerEvent("retry");
    },
  },
});
