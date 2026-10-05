export const EDITOR_TABS = ["copy", "visual", "caption", "details"] as const;
export type EditorTab = (typeof EDITOR_TABS)[number];
