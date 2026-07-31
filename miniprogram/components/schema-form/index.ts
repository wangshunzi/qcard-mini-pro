import {
  applySchemaBindings,
  createRenderRows,
  getAtPath,
  initializeFormData,
  removeAtPath,
  setAtPath,
  validateRows,
  type FormSchema,
  type PathPart,
  type RenderRow,
} from "./runtime";

function parseDatasetPath(event: WechatMiniprogram.BaseEvent): PathPart[] {
  try {
    const value = event.currentTarget.dataset.path;
    return Array.isArray(value) ? value : JSON.parse(String(value || "[]"));
  } catch {
    return [];
  }
}

function optionKey(value: unknown) {
  return typeof value === "string" ? value : JSON.stringify(value);
}

function dateTimeValue(date: string, time: string, includeTime: boolean) {
  if (!includeTime) return date;
  if (!date && !time) return "";
  return `${date || "1970-01-01"} ${time || "00:00"}`;
}

function clientDateValue(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return date;
  return new Date(year, month - 1, day).toISOString();
}

Component({
  properties: {
    schema: { type: Object, value: {} },
    value: { type: Object, value: {} },
    disabled: { type: Boolean, value: false },
    applyDefaults: { type: Boolean, value: true },
  },
  data: {
    fields: [] as RenderRow[],
    formData: {} as Record<string, unknown>,
    errors: {} as Record<string, string>,
  },
  observers: {
    "schema,value,applyDefaults"(
      schema: FormSchema,
      value: Record<string, unknown>,
      applyDefaults: boolean,
    ) {
      const schemaSignature = JSON.stringify(schema ?? {});
      if ((this as any)._lastSchemaSignature !== schemaSignature) {
        (this as any)._lastSchemaSignature = schemaSignature;
        (this as any)._lastChangeSignature = "";
      }
      const formData = initializeFormData(schema ?? {}, value ?? {}, applyDefaults);
      const fields = createRenderRows(schema ?? {}, formData);
      this.setData({ fields, formData, errors: {} }, () => this.emitChange(formData));
    },
  },
  methods: {
    input(event: WechatMiniprogram.Input) {
      this.update(parseDatasetPath(event), event.detail.value);
    },
    numberInput(event: WechatMiniprogram.Input) {
      const value = event.detail.value === "" ? undefined : Number(event.detail.value);
      this.update(parseDatasetPath(event), value);
    },
    switchInput(event: WechatMiniprogram.SwitchChange) {
      this.update(parseDatasetPath(event), event.detail.value);
    },
    checkboxInput(event: WechatMiniprogram.CheckboxGroupChange) {
      const path = parseDatasetPath(event);
      const field = this.findField(path);
      const values = event.detail.value.map((rawValue) =>
        field?.options.find((option) => option.valueKey === rawValue)?.value ?? rawValue,
      );
      this.update(path, values);
    },
    radioInput(event: WechatMiniprogram.RadioGroupChange) {
      const path = parseDatasetPath(event);
      const field = this.findField(path);
      const value =
        field?.options.find((option) => option.valueKey === event.detail.value)?.value ??
        event.detail.value;
      this.update(path, value);
    },
    pickerInput(event: WechatMiniprogram.PickerChange) {
      const path = parseDatasetPath(event);
      const field = this.findField(path);
      this.update(path, field?.options[Number(event.detail.value)]?.value);
    },
    dateInput(event: WechatMiniprogram.PickerChange) {
      const path = parseDatasetPath(event);
      const field = this.findField(path);
      const rawDate = String(event.detail.value);
      this.update(path, field?.isDateTime
        ? dateTimeValue(rawDate, field?.timeValue ?? "", true)
        : clientDateValue(rawDate));
    },
    timeInput(event: WechatMiniprogram.PickerChange) {
      const path = parseDatasetPath(event);
      const field = this.findField(path);
      this.update(
        path,
        dateTimeValue(field?.dateValue ?? "", String(event.detail.value), true),
      );
    },
    sliderInput(event: WechatMiniprogram.SliderChange) {
      this.update(parseDatasetPath(event), Number(event.detail.value));
    },
    rateInput(event: WechatMiniprogram.TouchEvent) {
      const path = parseDatasetPath(event);
      const field = this.findField(path);
      if ((this.data as any).disabled || field?.controlDisabled) return;
      this.update(path, Number(event.currentTarget.dataset.value));
    },
    stepperChange(event: WechatMiniprogram.TouchEvent) {
      const path = parseDatasetPath(event);
      const delta = Number(event.currentTarget.dataset.delta);
      const field = this.findField(path);
      if (!field || !Number.isFinite(delta)) return;
      const current = Number(getAtPath((this.data as any).formData, path));
      const fallback = delta > 0 ? Number(field.minimum ?? 0) : Number(field.maximum ?? 0);
      const target = Number.isFinite(current)
        ? current + delta * field.stepValue
        : fallback;
      const next = Math.min(
        field.maximum ?? Number.POSITIVE_INFINITY,
        Math.max(field.minimum ?? Number.NEGATIVE_INFINITY, target),
      );
      this.update(path, Number(next.toFixed(10)));
    },
    addListItem(event: WechatMiniprogram.TouchEvent) {
      if ((this.data as any).disabled) return;
      const path = parseDatasetPath(event);
      const current = getAtPath((this.data as any).formData, path);
      const next = [...(Array.isArray(current) ? current : []), {}];
      this.update(path, next, true);
    },
    removeListItem(event: WechatMiniprogram.TouchEvent) {
      if ((this.data as any).disabled) return;
      let listPath: PathPart[] = [];
      try {
        listPath = JSON.parse(String(event.currentTarget.dataset.listPath || "[]"));
      } catch {
        return;
      }
      const index = Number(event.currentTarget.dataset.index);
      if (!Number.isInteger(index)) return;
      const next = removeAtPath((this.data as any).formData, [...listPath, index]);
      this.commit(next);
    },
    findField(path: PathPart[]) {
      const id = path.map(String).join(".");
      return ((this.data as any).fields as RenderRow[]).find((item) => item.id === id);
    },
    update(path: PathPart[], value: unknown, initialize = false) {
      if (!path.length) return;
      let formData = setAtPath((this.data as any).formData, path, value);
      if (initialize) {
        formData = initializeFormData((this.data as any).schema, formData);
      }
      this.commit(formData, path.map(String).join("."));
    },
    commit(formData: Record<string, unknown>, clearErrorId = "") {
      const errors = { ...((this.data as any).errors as Record<string, string>) };
      if (clearErrorId) delete errors[clearErrorId];
      const fields = createRenderRows((this.data as any).schema, formData, errors);
      this.setData({ formData, fields, errors }, () => this.emitChange(formData));
    },
    emitChange(formData: Record<string, unknown>) {
      const signature = JSON.stringify(formData);
      if ((this as any)._lastChangeSignature === signature) return;
      (this as any)._lastChangeSignature = signature;
      this.triggerEvent("change", {
        value: formData,
        valid: this.validate(formData, false),
      });
    },
    validate(formData?: Record<string, unknown>, display = true) {
      const values = formData ?? ((this.data as any).formData as Record<string, unknown>);
      const rows = createRenderRows((this.data as any).schema, values);
      const errors = validateRows(rows, values);
      if (display) {
        this.setData({
          errors,
          fields: createRenderRows((this.data as any).schema, values, errors),
        });
      }
      return Object.keys(errors).length === 0;
    },
    getValue() {
      const valid = this.validate();
      const formData = (this.data as any).formData as Record<string, unknown>;
      const rows = createRenderRows((this.data as any).schema, formData);
      return {
        valid,
        value: applySchemaBindings(rows, formData),
      };
    },
    optionKey,
  },
});
