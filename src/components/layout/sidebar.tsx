// Re-export from refactored module for backward compatibility
export { Sidebar, COLLAPSED_WIDTH, EXPANDED_WIDTH } from "./sidebar/sidebar";
export { useSidebar } from "./sidebar/useSidebar";
export { menuItems, lightenColor, getVisibleChildren } from "./sidebar/config";
export type { MenuItem, SubMenuItem } from "./sidebar/config";
