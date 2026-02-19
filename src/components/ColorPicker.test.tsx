import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ColorPicker } from './ColorPicker';
import { COLOR_SWATCHES } from '../lib/style-applicability';

describe('ColorPicker', () => {
  it('renders 12 swatch buttons', () => {
    render(<ColorPicker value="#FF5733" label="Fill" onChange={vi.fn()} />);
    const swatches = screen.getAllByRole('button');
    expect(swatches).toHaveLength(12);
  });

  it('highlights the swatch matching current value', () => {
    render(<ColorPicker value={COLOR_SWATCHES[2]} label="Fill" onChange={vi.fn()} />);
    const swatches = screen.getAllByRole('button');
    expect(swatches[2].className).toContain('selected');
  });

  it('calls onChange when a swatch is clicked', () => {
    const onChange = vi.fn();
    render(<ColorPicker value="#FF5733" label="Fill" onChange={onChange} />);
    const swatches = screen.getAllByRole('button');
    fireEvent.click(swatches[0]);
    expect(onChange).toHaveBeenCalledWith(COLOR_SWATCHES[0]);
  });

  it('renders hex input with current color value', () => {
    render(<ColorPicker value="#FF5733" label="Fill" onChange={vi.fn()} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('FF5733');
  });

  it('calls onChange on valid hex input followed by Enter', () => {
    const onChange = vi.fn();
    render(<ColorPicker value="#FF5733" label="Fill" onChange={onChange} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'AABBCC' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('#AABBCC');
  });

  it('calls onChange on valid hex input followed by blur', () => {
    const onChange = vi.fn();
    render(<ColorPicker value="#FF5733" label="Fill" onChange={onChange} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '00BCD4' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith('#00BCD4');
  });

  it('does NOT call onChange on invalid hex input — reverts on blur', () => {
    const onChange = vi.fn();
    render(<ColorPicker value="#FF5733" label="Fill" onChange={onChange} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'ZZZZZZ' } });
    fireEvent.blur(input);
    expect(onChange).not.toHaveBeenCalled();
    expect(input.value).toBe('FF5733');
  });

  it('shows Mixed placeholder when isMixed is true', () => {
    render(<ColorPicker value="" label="Fill" isMixed onChange={vi.fn()} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.placeholder).toBe('Mixed');
    expect(input.value).toBe('');
  });

  it('all swatches are disabled when disabled=true', () => {
    render(<ColorPicker value="#FF5733" label="Fill" disabled onChange={vi.fn()} />);
    const swatches = screen.getAllByRole('button');
    for (const swatch of swatches) {
      expect(swatch).toBeDisabled();
    }
  });

  it('hex input is disabled when disabled=true', () => {
    render(<ColorPicker value="#FF5733" label="Fill" disabled onChange={vi.fn()} />);
    const input = screen.getByRole('textbox');
    expect(input).toBeDisabled();
  });

  it('renders the label text', () => {
    render(<ColorPicker value="#FF5733" label="Stroke" onChange={vi.fn()} />);
    expect(screen.getByText('Stroke')).toBeInTheDocument();
  });
});
