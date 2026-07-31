Component({
  properties: {
    item: {
      type: Object,
      value: {},
    },
    editMode: {
      type: Boolean,
      value: false,
    },
    showMakeSimilar: {
      type: Boolean,
      value: true,
    },
  },

  data: {
    emptyCardData: {},
  },

  methods: {
    open() {
      this.triggerEvent("open", { id: String((this.data.item as any)?.id ?? "") });
    },

    makeSimilar() {
      this.triggerEvent("make-similar", {
        id: String((this.data.item as any)?.id ?? ""),
      });
    },

    deleteItem() {
      this.triggerEvent("delete", { id: String((this.data.item as any)?.id ?? "") });
    },
  },
});
