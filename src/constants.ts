/** Cursor broadcast throttle — 16ms via requestAnimationFrame (60fps) */
export const CURSOR_THROTTLE_MS = 16;

/** Firestore debounced write interval */
export const FIRESTORE_DEBOUNCE_MS = 3000;

/** Zoom multiplier per wheel tick */
export const ZOOM_FACTOR = 1.08;

/** Minimum zoom scale */
export const MIN_SCALE = 0.1;

/** Maximum zoom scale */
export const MAX_SCALE = 5;

/** Default sticky note dimensions */
export const DEFAULT_STICKY_WIDTH = 150;
export const DEFAULT_STICKY_HEIGHT = 100;

/** Default rectangle dimensions */
export const DEFAULT_RECT_WIDTH = 200;
export const DEFAULT_RECT_HEIGHT = 150;

/** Default circle radius */
export const DEFAULT_CIRCLE_RADIUS = 50;

/** Default font size */
export const DEFAULT_FONT_SIZE = 14;

/** Colors assigned to users for cursors and presence */
export const USER_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
  '#BB8FCE', '#85C1E9', '#F0B27A', '#82E0AA',
];

/** Default object colors */
export const STICKY_COLORS = [
  '#FFEB3B', '#FF9800', '#E91E63', '#9C27B0',
  '#3F51B5', '#03A9F4', '#4CAF50', '#8BC34A',
];

/** Default sticky color */
export const DEFAULT_STICKY_COLOR = '#FFEB3B';

/** Default shape color */
export const DEFAULT_SHAPE_COLOR = '#E3F2FD';

/** Maximum objects for stress test */
export const MAX_OBJECTS = 500;

/** Stress test world size */
export const STRESS_TEST_SIZE = 5000;
