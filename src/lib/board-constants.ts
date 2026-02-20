// Shared magic numbers for the canvas, syncing, and UI.
// Centralizing these avoids duplicated literals and makes tuning easier.
// Timing values (debounce, throttle, TTL) directly affect performance and Firestore cost.

export const STICKY_PLACEHOLDER_TEXT = 'New note';
export const RECT_CLICK_DEFAULT_WIDTH = 180;
export const RECT_CLICK_DEFAULT_HEIGHT = 120;
export const CIRCLE_CLICK_DEFAULT_SIZE = 120;
export const LINE_CLICK_DEFAULT_WIDTH = 180;
export const RECT_CLICK_DRAG_THRESHOLD = 8;
export const BOARD_SAVE_DEBOUNCE_MS = 300;
export const OBJECT_UPDATE_EMIT_THROTTLE_MS = 45;
export const OBJECT_LATENCY_SAMPLE_WINDOW = 30;
export const OBJECT_LATENCY_UI_UPDATE_MS = 120;
export const AI_APPLY_LATENCY_SAMPLE_WINDOW = 20;
export const SHARE_FEEDBACK_RESET_MS = 2000;
export const VIEWPORT_SAVE_DEBOUNCE_MS = 180;
export const REALTIME_DEDUPE_TTL_MS = 30_000;
export const REALTIME_DEDUPE_MAX_ENTRIES = 4_000;
export const BOARD_FONT_FAMILY = 'Outfit, sans-serif';
export const CONNECTOR_DEFAULT_STROKE = '#4A8FCC';
export const CONNECTOR_HANDLE_RADIUS = 7;
export const CONNECTOR_HANDLE_STROKE = '#D4952B';
export const CONNECTOR_SELECTION_HIT_STROKE_WIDTH = 30;
export const CONNECTOR_SNAP_DISTANCE_PX = 20;
export const CONNECTOR_SNAP_RELEASE_BUFFER_PX = 10;
export const CONNECTOR_PERIMETER_SNAP_DISTANCE_PX = 26;
export const CONNECTOR_HOVER_LOCK_DELAY_MS = 2000;
export const CONNECTOR_ROUTING_CLEARANCE_PX = 12;
export const CONNECTOR_ROUTING_TURN_PENALTY = 18;
export const SHAPE_ANCHOR_RADIUS = 4;
export const SHAPE_ANCHOR_MATCH_EPSILON = 0.01;
export const CONNECTOR_ANCHOR_ACTIVE_FILL = '#F5D08E';
export const CONNECTOR_ANCHOR_ACTIVE_STROKE = '#D4952B';
export const CONNECTOR_ANCHOR_IDLE_FILL = '#FAFAF8';
export const CONNECTOR_ANCHOR_IDLE_STROKE = '#2A4A7F';
export const CONNECTOR_PATH_HANDLE_RADIUS = 6;
export const CONNECTOR_PATH_HANDLE_STROKE = '#D4952B';
export const CONNECTOR_LABEL_FONT_SIZE = 13;
export const CONNECTOR_LABEL_FONT_FAMILY = 'Outfit, sans-serif';
export const CONNECTOR_LABEL_CHAR_WIDTH_FACTOR = 0.56;
export const CONNECTOR_LABEL_PADDING_X = 8;
export const CONNECTOR_LABEL_PADDING_Y = 4;
export const CONNECTOR_LABEL_BACKGROUND_FILL = 'rgba(248, 250, 252, 0.96)';
export const CONNECTOR_LABEL_BACKGROUND_STROKE = 'rgba(42, 74, 127, 0.35)';
export const SELECTION_RECT_FILL = 'rgba(212, 149, 43, 0.12)';
export const SELECTION_RECT_STROKE = '#D4952B';
export const BOARD_HISTORY_MAX_ENTRIES = 100;
export const FRAME_HIGHLIGHT_STROKE = '#D4952B';

// PRD performance targets (hard gates — see docs/prd.md)
export const MAX_OBJECT_CAPACITY = 500;
export const CAPACITY_WARNING_THRESHOLD = 450;
export const FPS_TARGET = 60;
export const CURSOR_LATENCY_TARGET_MS = 50;
export const OBJECT_LATENCY_TARGET_MS = 100;
export const CONCURRENT_USER_TARGET = 5;
