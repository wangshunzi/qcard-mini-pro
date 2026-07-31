import { normalizeSchemaWidget } from "../../utils/schemaCompatibility";

export type PathPart = string | number;

export type SchemaOption = {
  label: string;
  value: unknown;
  children?: SchemaOption[];
};

export type FormSchema = {
  type?: string;
  title?: string;
  description?: string;
  default?: unknown;
  defaultValue?: unknown;
  required?: boolean | string;
  placeholder?: string;
  format?: string;
  widget?: string;
  readOnlyWidget?: string;
  hidden?: boolean | string;
  disabled?: boolean | string;
  readOnly?: boolean | string;
  min?: number | string;
  max?: number | string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  multipleOf?: number;
  step?: number;
  pattern?: string;
  enum?: unknown[] | string;
  enumNames?: unknown[] | string;
  properties?: Record<string, FormSchema>;
  items?: FormSchema;
  rules?: Record<string, unknown> | Array<Record<string, unknown>>;
  props?: Record<string, any>;
  bind?: false | string | string[];
  order?: number;
  extra?: string | { text?: string };
  [key: string]: unknown;
};

export type RenderRow = FormSchema & {
  id: string;
  kind: "field" | "display" | "section" | "list";
  path: PathPart[];
  pathJson: string;
  listPathJson?: string;
  listIndex?: number;
  title: string;
  normalizedWidget: string;
  requiredNow: boolean;
  controlDisabled: boolean;
  value: any;
  options: Array<SchemaOption & { selected: boolean; valueKey: string }>;
  selectedLabel: string;
  multiple: boolean;
  minimum?: number;
  maximum?: number;
  stepValue: number;
  hasStep: boolean;
  atMin: boolean;
  atMax: boolean;
  maxLengthValue: number;
  placeholderValue: string;
  rateItems: Array<{ value: number; active: boolean }>;
  sliderValue: number;
  dateValue: string;
  timeValue: string;
  dateFields: "year" | "month" | "day";
  isDateTime: boolean;
  html: string;
  canAdd?: boolean;
  canRemove?: boolean;
  itemCount?: number;
  error?: string;
};

function clone<T>(value: T): T {
  if (value === undefined) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

export function getAtPath(root: any, path: PathPart[]) {
  return path.reduce<any>((value, part) => value?.[part], root);
}

export function setAtPath(root: any, path: PathPart[], value: unknown) {
  if (!path.length) return value;
  const copy = clone(root ?? {});
  let cursor = copy;
  path.forEach((part, index) => {
    if (index === path.length - 1) {
      cursor[part] = value;
      return;
    }
    const nextPart = path[index + 1];
    if (!cursor[part] || typeof cursor[part] !== "object") {
      cursor[part] = typeof nextPart === "number" ? [] : {};
    }
    cursor = cursor[part];
  });
  return copy;
}

export function removeAtPath(root: any, path: PathPart[]) {
  const copy = clone(root ?? {});
  const parent = getAtPath(copy, path.slice(0, -1));
  const key = path[path.length - 1];
  if (Array.isArray(parent) && typeof key === "number") parent.splice(key, 1);
  else if (parent && typeof parent === "object") delete parent[key];
  return copy;
}

function parsePath(path: string) {
  return path
    .replace(/^formData\.?/, "")
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .filter(Boolean)
    .map((part) => /^\d+$/.test(part) ? Number(part) : part);
}

function parseLiteral(raw: string, formData: Record<string, unknown>): unknown {
  const value = raw.trim();
  if (/^(['"]).*\1$/.test(value)) return value.slice(1, -1);
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "null") return null;
  if (value === "undefined") return undefined;
  if (value !== "" && Number.isFinite(Number(value))) return Number(value);
  if (value.startsWith("[") || value.startsWith("{")) {
    try {
      return JSON.parse(value);
    } catch {
      // Keep resolving as a path.
    }
  }
  return getAtPath(formData, parsePath(value));
}

function splitLogical(expression: string, operator: "||" | "&&") {
  const parts: string[] = [];
  let depth = 0;
  let quote = "";
  let current = "";
  for (let index = 0; index < expression.length; index += 1) {
    const character = expression[index];
    if ((character === "'" || character === '"') && expression[index - 1] !== "\\") {
      quote = quote === character ? "" : quote ? quote : character;
    }
    if (!quote) {
      if (character === "(") depth += 1;
      if (character === ")") depth -= 1;
      if (depth === 0 && expression.slice(index, index + 2) === operator) {
        parts.push(current.trim());
        current = "";
        index += 1;
        continue;
      }
    }
    current += character;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function expressionTruthy(value: unknown) {
  if (value === undefined || value === null || value === "" || value === false) return false;
  if (typeof value === "number") return value !== 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function hasOuterParentheses(expression: string) {
  if (!expression.startsWith("(") || !expression.endsWith(")")) return false;
  let depth = 0;
  for (let index = 0; index < expression.length; index += 1) {
    if (expression[index] === "(") depth += 1;
    if (expression[index] === ")") depth -= 1;
    if (depth === 0 && index < expression.length - 1) return false;
  }
  return depth === 0;
}

export function resolveExpression(value: unknown, formData: Record<string, unknown>): unknown {
  if (typeof value !== "string") return value;
  const match = value.match(/^{{\s*([\s\S]*?)\s*}}$/);
  if (!match) return value;
  let expression = match[1].trim();
  if (hasOuterParentheses(expression)) {
    expression = expression.slice(1, -1).trim();
  }
  const or = splitLogical(expression, "||");
  if (or.length > 1) {
    return or.some((item) => expressionTruthy(resolveExpression(`{{${item}}}`, formData)));
  }
  const and = splitLogical(expression, "&&");
  if (and.length > 1) {
    return and.every((item) => expressionTruthy(resolveExpression(`{{${item}}}`, formData)));
  }
  if (expression.startsWith("!")) {
    return !expressionTruthy(resolveExpression(`{{${expression.slice(1)}}}`, formData));
  }
  const comparison = expression.match(
    /^([\w.[\]]+)\s*(===|==|!==|!=|>=|<=|>|<)\s*([\s\S]+)$/,
  );
  if (comparison) {
    const left = getAtPath(formData, parsePath(comparison[1]));
    const right = parseLiteral(comparison[3], formData);
    switch (comparison[2]) {
      case "===":
      case "==": return left === right;
      case "!==":
      case "!=": return left !== right;
      case ">": return Number(left) > Number(right);
      case "<": return Number(left) < Number(right);
      case ">=": return Number(left) >= Number(right);
      case "<=": return Number(left) <= Number(right);
    }
  }
  return parseLiteral(expression, formData);
}

function resolvedBoolean(value: unknown, formData: Record<string, unknown>) {
  return expressionTruthy(resolveExpression(value, formData));
}

function resolvedNumber(value: unknown, formData: Record<string, unknown>) {
  const resolved = resolveExpression(value, formData);
  return resolved === undefined || resolved === null || resolved === ""
    ? undefined
    : Number(resolved);
}

function resolvedArray(value: unknown, formData: Record<string, unknown>): unknown[] {
  const resolved = resolveExpression(value, formData);
  return Array.isArray(resolved) ? resolved : [];
}

function sortProperties(properties: Record<string, FormSchema>) {
  return Object.entries(properties).sort(
    ([, left], [, right]) => Number(left.order ?? 999) - Number(right.order ?? 999),
  );
}

function initializeNode(schema: FormSchema, current: any, applyDefaults = true): any {
  let value = current;
  if (value === undefined && applyDefaults) {
    value = clone(schema.default ?? schema.defaultValue);
  }
  if (schema.type === "array" && schema.items?.type === "object") {
    if (!Array.isArray(value)) value = applyDefaults ? [{}] : value;
    return Array.isArray(value)
      ? value.map((item: unknown) => initializeNode(schema.items!, item, applyDefaults))
      : value;
  }
  if (schema.type === "array") return Array.isArray(value) ? value : value;
  if (schema.properties) {
    if (value === undefined && !applyDefaults) return undefined;
    const objectValue = value && typeof value === "object" && !Array.isArray(value)
      ? { ...value }
      : {};
    Object.entries(schema.properties).forEach(([key, child]) => {
      const initialized = initializeNode(child, objectValue[key], applyDefaults);
      if (initialized !== undefined) objectValue[key] = initialized;
    });
    return objectValue;
  }
  return value;
}

export function initializeFormData(
  schema: FormSchema,
  value: Record<string, unknown> | undefined,
  applyDefaults = true,
) {
  const initialized = initializeNode(
    schema,
    clone(value ?? {}),
    applyDefaults,
  ) as Record<string, unknown>;
  if (!schema.properties) return initialized;
  return Object.fromEntries(
    Object.keys(schema.properties)
      .filter((key) => initialized[key] !== undefined)
      .map((key) => [key, initialized[key]]),
  );
}

function optionKey(value: unknown) {
  return typeof value === "string" ? value : JSON.stringify(value);
}

function normalizeOptions(schema: FormSchema, formData: Record<string, unknown>): SchemaOption[] {
  const propsOptions = resolveExpression(schema.props?.options, formData);
  if (Array.isArray(propsOptions)) {
    return propsOptions.map((option) =>
      option && typeof option === "object" && "value" in option
        ? {
            label: String((option as any).label ?? (option as any).value),
            value: (option as any).value,
            children: Array.isArray((option as any).children)
              ? normalizeOptions({ props: { options: (option as any).children } }, formData)
              : undefined,
          }
        : { label: String(option), value: option },
    );
  }
  const values = resolvedArray(schema.enum, formData);
  const names = resolvedArray(schema.enumNames, formData);
  return values.map((value, index) => ({
    label: String(names[index] ?? value),
    value,
  }));
}

function flattenCascader(options: SchemaOption[], labels: string[] = [], values: unknown[] = []) {
  const result: SchemaOption[] = [];
  options.forEach((option) => {
    const nextLabels = [...labels, option.label];
    const nextValues = [...values, option.value];
    if (option.children?.length) {
      result.push(...flattenCascader(option.children, nextLabels, nextValues));
    } else {
      result.push({ label: nextLabels.join(" / "), value: nextValues });
    }
  });
  return result;
}

function flattenColumns(columns: unknown[][], index = 0, labels: string[] = [], values: unknown[] = []): SchemaOption[] {
  if (index >= columns.length) return [{ label: labels.join(" / "), value: values }];
  return (columns[index] ?? []).flatMap((raw) => {
    const option = raw && typeof raw === "object" && "value" in (raw as any)
      ? { label: String((raw as any).label ?? (raw as any).value), value: (raw as any).value }
      : { label: String(raw), value: raw };
    return flattenColumns(columns, index + 1, [...labels, option.label], [...values, option.value]);
  });
}

function inferWidget(schema: FormSchema) {
  const explicit = normalizeSchemaWidget(schema);
  if (explicit) return explicit;
  const format = String(schema.format ?? "").toLowerCase();
  if (format === "textarea") return "textarea";
  if (["date", "datetime", "time"].includes(String(schema.type ?? "").toLowerCase()) ||
      ["date", "datetime", "time"].includes(format)) return "datepicker";
  if (schema.type === "boolean" || schema.type === "bool") return "switch";
  if (schema.enum || schema.props?.options) return "selector";
  if (schema.type === "number" || schema.type === "integer") return "inputnumber";
  if (schema.type === "void") return "html";
  return "input";
}

function formatDateParts(value: unknown) {
  const text = String(value ?? "");
  const match = text.match(/^(\d{4}-\d{2}(?:-\d{2})?)(?:[ T](\d{2}:\d{2}(?::\d{2})?))?/);
  const now = new Date();
  const today = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
  return { date: match?.[1] ?? today, time: match?.[2]?.slice(0, 5) ?? "" };
}

function buildField(
  schema: FormSchema,
  path: PathPart[],
  formData: Record<string, unknown>,
  parentRequired: boolean,
): RenderRow {
  const value = getAtPath(formData, path);
  const readOnly = resolvedBoolean(schema.readOnly, formData);
  const normalizedWidget = readOnly && schema.readOnlyWidget
    ? normalizeSchemaWidget({ widget: schema.readOnlyWidget })
    : inferWidget(schema);
  let options = normalizeOptions(schema, formData);
  if (normalizedWidget === "cascader") options = flattenCascader(options);
  const columns = resolveExpression(schema.props?.columns, formData);
  if (normalizedWidget === "picker" && Array.isArray(columns) && columns.every(Array.isArray)) {
    options = flattenColumns(columns as unknown[][]);
  }
  const valueKeys = Array.isArray(value) ? value.map(optionKey) : [optionKey(value)];
  const mappedOptions = options.map((option) => ({
    ...option,
    selected: valueKeys.includes(optionKey(option.value)),
    valueKey: optionKey(option.value),
  }));
  const selectedLabel = mappedOptions.find((option) => option.selected)?.label ?? "";
  const numericField =
    schema.type === "number" ||
    schema.type === "integer" ||
    ["stepper", "slider", "rate", "inputnumber"].includes(normalizedWidget);
  const minimum = resolvedNumber(
    schema.minimum ?? (numericField ? schema.min : undefined) ?? schema.props?.min,
    formData,
  );
  const maximum = resolvedNumber(
    schema.maximum ?? (numericField ? schema.max : undefined) ?? schema.props?.max,
    formData,
  );
  const step = resolvedNumber(schema.step ?? schema.multipleOf ?? schema.props?.step, formData) ?? 1;
  const currentNumber = Number(value);
  const rateCount = Number(schema.props?.count ?? schema.props?.max ?? schema.max ?? 5);
  const precision = String(schema.props?.precision ?? schema.format ?? schema.type ?? "day").toLowerCase();
  const dateParts = formatDateParts(value);
  const multiple =
    schema.type === "array" ||
    schema.props?.multiple === true ||
    ["multiselect", "checkbox", "checkboxes"].includes(normalizedWidget);
  const title = String(schema.title ?? path[path.length - 1] ?? "");
  const htmlValue = schema.props?.html ?? schema.props?.children ?? value ?? schema.description ?? title;
  return {
    ...schema,
    id: path.map(String).join("."),
    kind: normalizedWidget === "html" || schema.type === "void" ? "display" : "field",
    path,
    pathJson: JSON.stringify(path),
    title,
    normalizedWidget,
    requiredNow: parentRequired || resolvedBoolean(schema.required, formData),
    controlDisabled:
      resolvedBoolean(schema.disabled, formData) ||
      readOnly,
    value,
    options: mappedOptions,
    selectedLabel,
    multiple,
    minimum,
    maximum,
    stepValue: step,
    hasStep:
      schema.step !== undefined ||
      schema.multipleOf !== undefined ||
      schema.props?.step !== undefined,
    atMin: Number.isFinite(currentNumber) && minimum !== undefined && currentNumber <= minimum,
    atMax: Number.isFinite(currentNumber) && maximum !== undefined && currentNumber >= maximum,
    maxLengthValue: Number(schema.maxLength ?? schema.props?.maxLength ?? 1000),
    placeholderValue: String(
      schema.placeholder ??
      schema.props?.placeholder ??
      schema.description ??
      `请输入${title}`,
    ),
    rateItems: Array.from({ length: Math.max(1, rateCount) }, (_, index) => ({
      value: index + 1,
      active: index + 1 <= Number(value ?? 0),
    })),
    sliderValue: Number.isFinite(currentNumber) ? currentNumber : minimum ?? 0,
    dateValue: dateParts.date,
    timeValue: dateParts.time,
    dateFields: precision === "year" ? "year" : precision === "month" ? "month" : "day",
    isDateTime:
      schema.type === "datetime" ||
      ["datetime", "hour", "minute", "second"].includes(precision),
    html: String(htmlValue ?? ""),
  };
}

export function createRenderRows(
  schema: FormSchema,
  formData: Record<string, unknown>,
  errors: Record<string, string> = {},
) {
  const rows: RenderRow[] = [];
  const walk = (
    properties: Record<string, FormSchema>,
    parentPath: PathPart[],
    requiredKeys: Set<string>,
  ) => {
    sortProperties(properties).forEach(([key, field]) => {
      const path = [...parentPath, key];
      if (resolvedBoolean(field.hidden, formData)) return;
      if (field.type === "array" && field.items?.type === "object" && field.items.properties) {
        const items = getAtPath(formData, path);
        const list = Array.isArray(items) ? items : [];
        const min = resolvedNumber(field.min ?? field.minItems, formData) ?? 0;
        const max = resolvedNumber(field.max ?? field.maxItems, formData);
        rows.push({
          ...buildField(field, path, formData, requiredKeys.has(key)),
          kind: "list",
          normalizedWidget: "list",
          itemCount: list.length,
          canAdd: max === undefined || list.length < max,
        });
        list.forEach((_, index) => {
          rows.push({
            ...buildField(
              { type: "void", title: `${field.title ?? key} ${index + 1}`, widget: "html" },
              [...path, index, "$header"],
              formData,
              false,
            ),
            kind: "section",
            normalizedWidget: "listitem",
            listPathJson: JSON.stringify(path),
            listIndex: index,
            canRemove: list.length > min,
          });
          walk(
            field.items!.properties!,
            [...path, index],
            new Set<string>((field.items as any).required ?? []),
          );
        });
        return;
      }
      if (field.properties) {
        rows.push({
          ...buildField(field, path, formData, requiredKeys.has(key)),
          kind: "section",
          normalizedWidget: ["card", "group"].includes(inferWidget(field))
            ? inferWidget(field)
            : "group",
        });
        walk(field.properties, path, new Set<string>((field as any).required ?? []));
        return;
      }
      const row = buildField(field, path, formData, requiredKeys.has(key));
      row.error = errors[row.id] ?? "";
      rows.push(row);
    });
  };
  walk(schema.properties ?? {}, [], new Set<string>((schema as any).required ?? []));
  return rows;
}

function emptyValue(value: unknown) {
  return (
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}

function validateFormat(format: string | undefined, value: unknown) {
  if (!format || typeof value !== "string") return true;
  switch (format.toLowerCase()) {
    case "email": return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    case "url": return /^https?:\/\/\S+$/i.test(value);
    case "color": return /^#(?:[\da-f]{3}|[\da-f]{6}|[\da-f]{8})$/i.test(value);
    case "date": return /^\d{4}-\d{2}-\d{2}$/.test(value);
    case "time": return /^\d{2}:\d{2}(?::\d{2})?$/.test(value);
    case "datetime": return /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2})?$/.test(value);
    default: return true;
  }
}

export function validateRows(rows: RenderRow[], formData: Record<string, unknown>) {
  const errors: Record<string, string> = {};
  rows.forEach((field) => {
    if (field.kind !== "field") return;
    const value = getAtPath(formData, field.path);
    const title = field.title || field.id;
    if (field.requiredNow && emptyValue(value)) {
      errors[field.id] = `请填写${title}`;
      return;
    }
    if (emptyValue(value)) return;
    const type = String(field.type ?? "").toLowerCase();
    if (["number", "integer"].includes(type) && (typeof value !== "number" || !Number.isFinite(value))) {
      errors[field.id] = `${title}必须是有效数字`;
      return;
    }
    if (type === "integer" && !Number.isInteger(value)) {
      errors[field.id] = `${title}必须是整数`;
      return;
    }
    if (typeof value === "number" && field.minimum !== undefined && value < field.minimum) {
      errors[field.id] = `${title}不能小于 ${field.minimum}`;
      return;
    }
    if (typeof value === "number" && field.maximum !== undefined && value > field.maximum) {
      errors[field.id] = `${title}不能大于 ${field.maximum}`;
      return;
    }
    const minLength = Number(field.minLength ?? field.props?.minLength);
    const maxLength = Number(field.maxLength ?? field.props?.maxLength);
    if (typeof value === "string" && Number.isFinite(minLength) && value.length < minLength) {
      errors[field.id] = `${title}至少需要 ${minLength} 个字`;
      return;
    }
    if (typeof value === "string" && Number.isFinite(maxLength) && value.length > maxLength) {
      errors[field.id] = `${title}最多允许 ${maxLength} 个字`;
      return;
    }
    if (
      typeof value === "string" &&
      field.max !== undefined &&
      Number.isFinite(Number(field.max)) &&
      value.length > Number(field.max)
    ) {
      errors[field.id] = `${title}最多${field.max}个字符，当前${value.length}个`;
      return;
    }
    if (Array.isArray(value)) {
      if (field.minItems !== undefined && value.length < field.minItems) {
        errors[field.id] = `${title}至少选择 ${field.minItems} 项`;
        return;
      }
      if (field.maxItems !== undefined && value.length > field.maxItems) {
        errors[field.id] = `${title}最多选择 ${field.maxItems} 项`;
        return;
      }
      if (field.uniqueItems && new Set(value.map(optionKey)).size !== value.length) {
        errors[field.id] = `${title}不能包含重复项`;
        return;
      }
    }
    if (!validateFormat(field.format, value)) {
      errors[field.id] = `${title}格式不正确`;
      return;
    }
    const rules: any[] = Array.isArray(field.rules) ? field.rules : field.rules ? [field.rules] : [];
    const rootRule: any[] = field.pattern ? [{ pattern: field.pattern }] : [];
    for (const rule of [...rootRule, ...rules]) {
      if (rule.required && emptyValue(value)) {
        errors[field.id] = String(rule.message ?? `请填写${title}`);
        break;
      }
      if (rule.pattern) {
        try {
          if (!new RegExp(String(rule.pattern)).test(String(value))) {
            errors[field.id] = String(rule.message ?? `${title}格式不正确`);
            break;
          }
        } catch {
          errors[field.id] = `${title}校验规则无效`;
          break;
        }
      }
      if (rule.len !== undefined && String(value).length !== Number(rule.len)) {
        errors[field.id] = String(rule.message ?? `${title}长度必须为 ${rule.len}`);
        break;
      }
      if (Array.isArray(rule.enum) && !rule.enum.some((item: unknown) => optionKey(item) === optionKey(value))) {
        errors[field.id] = String(rule.message ?? `${title}不是有效选项`);
        break;
      }
    }
  });
  return errors;
}

function applyBindAt(data: any, path: PathPart[], bind: FormSchema["bind"]) {
  if (bind === undefined) return data;
  if (bind === false) return removeAtPath(data, path);
  const value = getAtPath(data, path);
  let next = removeAtPath(data, path);
  if (typeof bind === "string") {
    if (bind === "root" && path.some((part) => typeof part === "number")) return next;
    return setAtPath(next, parsePath(bind), value);
  }
  if (Array.isArray(bind) && Array.isArray(value)) {
    bind.forEach((target, index) => {
      next = setAtPath(next, parsePath(target), value[index]);
    });
  }
  return next;
}

export function applySchemaBindings(rows: RenderRow[], formData: Record<string, unknown>) {
  return rows
    .filter((row) => row.kind === "field" && row.bind !== undefined)
    .reduce<Record<string, unknown>>(
      (data, row) => applyBindAt(data, row.path, row.bind),
      clone(formData),
    );
}
