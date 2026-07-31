export interface MiniProgramSchemaIssue {
  field: string;
  title?: string;
  type?: string;
  widget?: string;
  reason: string;
}

const SUPPORTED_FIELD_TYPES = new Set([
  "",
  "void",
  "string",
  "number",
  "integer",
  "boolean",
  "bool",
  "array",
  "object",
  "date",
  "datetime",
  "block",
]);

const SUPPORTED_WIDGETS = new Set([
  "",
  "input",
  "textarea",
  "selector",
  "select",
  "multiselect",
  "checkbox",
  "checkboxes",
  "radio",
  "switch",
  "stepper",
  "inputnumber",
  "slider",
  "rate",
  "picker",
  "datepicker",
  "cascader",
  "html",
  "voidtitle",
  "group",
  "card",
]);

const OPTION_WIDGETS = new Set([
  "selector",
  "select",
  "multiselect",
  "checkbox",
  "checkboxes",
  "radio",
]);

export function normalizeSchemaWidget(field: Record<string, unknown> | undefined) {
  const raw = field?.widget ?? field?.["ui:widget"];
  return typeof raw === "string"
    ? raw.replace(/[\s_-]/g, "").toLowerCase()
    : "";
}

function hasOptions(field: any) {
  return (
    Array.isArray(field?.enum) ||
    Array.isArray(field?.props?.options) ||
    Array.isArray(field?.props?.columns)
  );
}

/**
 * Keep this check conservative: a template must not enter the paid generation
 * flow until every input can be represented by the native schema form.
 */
export function getMiniProgramSchemaIssues(
  schema: Record<string, unknown> | null | undefined,
): MiniProgramSchemaIssue[] {
  const properties = (schema as any)?.properties;
  if (!properties || typeof properties !== "object" || Array.isArray(properties)) {
    return [{
      field: "$schema",
      reason: "参数 Schema 缺少 properties",
    }];
  }
  const rootType = String((schema as any)?.type ?? "").toLowerCase();
  if (rootType && rootType !== "object") {
    return [{
      field: "$schema",
      type: rootType,
      reason: "参数 Schema 根节点必须为 object",
    }];
  }

  const issues: MiniProgramSchemaIssue[] = [];
  const inspectProperties = (
    fieldProperties: Record<string, unknown>,
    parentPath = "",
  ) => Object.entries(fieldProperties).forEach(([key, raw]) => {
    const fieldPath = parentPath ? `${parentPath}.${key}` : key;
    const field = raw as any;
    if (!field || typeof field !== "object" || Array.isArray(field)) {
      issues.push({ field: fieldPath, reason: "字段定义不是有效对象" });
      return;
    }
    const type = String(field.type ?? "").toLowerCase();
    const widget = normalizeSchemaWidget(field);
    const issueBase = {
      field: fieldPath,
      title: typeof field.title === "string" ? field.title : undefined,
      type: type || undefined,
      widget: widget || undefined,
    };
    if (!SUPPORTED_FIELD_TYPES.has(type)) {
      issues.push({ ...issueBase, reason: `字段类型 ${type || "未声明"} 暂不支持` });
      return;
    }
    if (!SUPPORTED_WIDGETS.has(widget)) {
      issues.push({ ...issueBase, reason: `表单控件 ${widget || "未声明"} 暂不支持` });
      return;
    }
    const readOnlyWidget = field.readOnlyWidget
      ? normalizeSchemaWidget({ widget: field.readOnlyWidget })
      : "";
    if (readOnlyWidget && !SUPPORTED_WIDGETS.has(readOnlyWidget)) {
      issues.push({
        ...issueBase,
        widget: readOnlyWidget,
        reason: `只读控件 ${readOnlyWidget} 暂不支持`,
      });
      return;
    }
    if (field.properties && typeof field.properties === "object" && !Array.isArray(field.properties)) {
      inspectProperties(field.properties, fieldPath);
      return;
    }
    const objectList =
      type === "array" &&
      field.items?.type === "object" &&
      field.items?.properties &&
      typeof field.items.properties === "object";
    if (objectList) {
      inspectProperties(field.items.properties, `${fieldPath}[]`);
      return;
    }
    if (
      (type === "array" || OPTION_WIDGETS.has(widget)) &&
      !hasOptions(field) &&
      widget !== "picker"
    ) {
      issues.push({ ...issueBase, reason: "选项控件缺少 enum 或 props.options" });
      return;
    }
    if (
      type === "array" &&
      !hasOptions(field) &&
      widget !== "picker"
    ) {
      issues.push({ ...issueBase, reason: "动态数组输入暂不支持" });
    }
  });
  inspectProperties(properties);
  return issues;
}

export function isMiniProgramSchemaSupported(
  schema: Record<string, unknown> | null | undefined,
) {
  return getMiniProgramSchemaIssues(schema).length === 0;
}
