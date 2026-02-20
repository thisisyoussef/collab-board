import { describe, expect, it } from 'vitest';
import {
  BOARD_FONT_FAMILY,
  CONNECTOR_ANCHOR_ACTIVE_FILL,
  CONNECTOR_ANCHOR_ACTIVE_STROKE,
  CONNECTOR_ANCHOR_IDLE_STROKE,
  CONNECTOR_DEFAULT_STROKE,
  CONNECTOR_HANDLE_STROKE,
  CONNECTOR_SELECTION_HIT_STROKE_WIDTH,
  CONNECTOR_LABEL_BACKGROUND_STROKE,
  CONNECTOR_LABEL_FONT_FAMILY,
  FRAME_HIGHLIGHT_STROKE,
  SELECTION_RECT_FILL,
  SELECTION_RECT_STROKE,
} from './board-constants';

describe('board constants brand defaults', () => {
  it('uses outfit as board ui font family', () => {
    expect(BOARD_FONT_FAMILY).toBe('Outfit, sans-serif');
  });

  it('uses brand amber for active connector affordances', () => {
    expect(CONNECTOR_HANDLE_STROKE).toBe('#D4952B');
    expect(CONNECTOR_ANCHOR_ACTIVE_FILL).toBe('#F5D08E');
    expect(CONNECTOR_ANCHOR_ACTIVE_STROKE).toBe('#D4952B');
    expect(SELECTION_RECT_STROKE).toBe('#D4952B');
  });

  it('uses brand slate/navy for connector defaults', () => {
    expect(CONNECTOR_DEFAULT_STROKE).toBe('#4A8FCC');
    expect(CONNECTOR_ANCHOR_IDLE_STROKE).toBe('#2A4A7F');
    expect(CONNECTOR_LABEL_BACKGROUND_STROKE).toBe('rgba(42, 74, 127, 0.35)');
    expect(SELECTION_RECT_FILL).toBe('rgba(212, 149, 43, 0.12)');
  });

  it('uses brand tokens for frame highlight and label font', () => {
    expect(FRAME_HIGHLIGHT_STROKE).toBe('#D4952B');
    expect(CONNECTOR_LABEL_FONT_FAMILY).toBe('Outfit, sans-serif');
  });

  it('uses an expanded connector hit target for easier reselection', () => {
    expect(CONNECTOR_SELECTION_HIT_STROKE_WIDTH).toBe(30);
  });
});
