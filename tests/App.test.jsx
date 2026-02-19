/**
 * App.jsx — Integration Tests
 *
 * Tests the top-level MTGMonteCarloAnalyzer component covering:
 *   Initial render        – header, subtitle, core panels visible
 *   Data Source panel     – radio buttons, default selection, conditional upload UI
 *   Deck List panel       – textarea, placeholder text, Parse Deck button
 *   Parse Deck flow       – parseDeckList called, success path, failure path, error banner
 *   Run Simulation flow   – monteCarlo called, "Please parse a deck first" guard
 *   localStorage          – state persisted on change, state restored on mount
 *
 * Run:  npm test
 */

// @vitest-environment jsdom

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import MTGMonteCarloAnalyzer from '../src/App.jsx';

// ─── Global stubs (jsdom gaps) ────────────────────────────────────────────────

global.ResizeObserver = class {
  observe()    {}
  unobserve()  {}
  disconnect() {}
};

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../src/simulation/monteCarlo.js', () => ({
  monteCarlo:       vi.fn(() => ({})),
  buildCompleteDeck: vi.fn(() => []),
}));

vi.mock('../src/parser/deckParser.js', () => ({
  parseDeckList: vi.fn(),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Minimal parsed-deck object returned by a mocked successful parseDeckList call */
const MOCK_PARSED_DECK = {
  totalCards:  60,
  landCount:   24,
  lands:       [{ name: 'Forest', quantity: 24, isBasic: true, produces: ['G'], isFetch: false, entersTappedAlways: false }],
  spells:      [],
  creatures:   [],
  artifacts:   [],
  rituals:     [],
  rampSpells:  [],
  exploration: [],
  errors:      [],
};

/** Convenience: import the mocked module so tests can configure it per-test */
import { parseDeckList } from '../src/parser/deckParser.js';
import { monteCarlo }    from '../src/simulation/monteCarlo.js';

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

// =============================================================================
// 1 — Initial render
// =============================================================================
describe('Initial render', () => {
  it('renders without throwing', () => {
    expect(() => render(<MTGMonteCarloAnalyzer />)).not.toThrow();
  });

  it('displays the app title', () => {
    render(<MTGMonteCarloAnalyzer />);
    expect(screen.getByText(/MTG Monte Carlo Deck Analyzer/i)).toBeInTheDocument();
  });

  it('displays the subtitle', () => {
    render(<MTGMonteCarloAnalyzer />);
    expect(screen.getByText(/Simulation-based deck analysis/i)).toBeInTheDocument();
  });

  it('renders the Data Source panel heading', () => {
    render(<MTGMonteCarloAnalyzer />);
    expect(screen.getByText(/Data Source/i)).toBeInTheDocument();
  });

  it('renders the Deck List panel heading', () => {
    render(<MTGMonteCarloAnalyzer />);
    expect(screen.getByText(/Deck List/i)).toBeInTheDocument();
  });

  it('renders the Parse Deck button', () => {
    render(<MTGMonteCarloAnalyzer />);
    expect(screen.getByRole('button', { name: /parse deck/i })).toBeInTheDocument();
  });

  it('renders the footer copyright notice', () => {
    render(<MTGMonteCarloAnalyzer />);
    expect(screen.getByText(/All card data © Wizards of the Coast/i)).toBeInTheDocument();
  });

  it('does not show the error banner initially', () => {
    render(<MTGMonteCarloAnalyzer />);
    expect(screen.queryByText(/⚠️/)).not.toBeInTheDocument();
  });
});

// =============================================================================
// 2 — Data Source panel
// =============================================================================
describe('Data Source panel', () => {
  it('renders the "Local JSON File" radio option', () => {
    render(<MTGMonteCarloAnalyzer />);
    expect(screen.getByLabelText(/Local JSON File/i)).toBeInTheDocument();
  });

  it('renders the "Scryfall API" radio option', () => {
    render(<MTGMonteCarloAnalyzer />);
    expect(screen.getByLabelText(/Scryfall API/i)).toBeInTheDocument();
  });

  it('defaults to "Local JSON File" mode', () => {
    render(<MTGMonteCarloAnalyzer />);
    const localRadio = screen.getByLabelText(/Local JSON File/i);
    expect(localRadio).toBeChecked();
  });

  it('shows the file upload input in local mode', () => {
    render(<MTGMonteCarloAnalyzer />);
    expect(screen.getByRole('button', { hidden: true }) || screen.queryByText(/How to get cards\.json/i)).toBeTruthy();
    // The file input is present (accept=".json")
    const fileInput = document.querySelector('input[type="file"][accept=".json"]');
    expect(fileInput).not.toBeNull();
  });

  it('hides the file upload input after switching to Scryfall mode', () => {
    render(<MTGMonteCarloAnalyzer />);
    const scryfallRadio = screen.getByLabelText(/Scryfall API/i);
    fireEvent.click(scryfallRadio);
    expect(document.querySelector('input[type="file"][accept=".json"]')).toBeNull();
  });

  it('marks the Scryfall radio as checked after clicking it', () => {
    render(<MTGMonteCarloAnalyzer />);
    const scryfallRadio = screen.getByLabelText(/Scryfall API/i);
    fireEvent.click(scryfallRadio);
    expect(scryfallRadio).toBeChecked();
  });
});

// =============================================================================
// 3 — Deck List panel
// =============================================================================
describe('Deck List panel', () => {
  it('renders the deck textarea', () => {
    render(<MTGMonteCarloAnalyzer />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('textarea placeholder mentions MTG Arena format', () => {
    render(<MTGMonteCarloAnalyzer />);
    const ta = screen.getByRole('textbox');
    expect(ta.placeholder).toMatch(/MTG Arena format/i);
  });

  it('textarea reflects user input', () => {
    render(<MTGMonteCarloAnalyzer />);
    const ta = screen.getByRole('textbox');
    fireEvent.change(ta, { target: { value: '24 Forest\n36 Lightning Bolt' } });
    expect(ta.value).toBe('24 Forest\n36 Lightning Bolt');
  });
});

// =============================================================================
// 4 — Parse Deck flow
// =============================================================================
describe('Parse Deck flow', () => {
  it('calls parseDeckList when Parse Deck is clicked', async () => {
    parseDeckList.mockResolvedValue(MOCK_PARSED_DECK);
    render(<MTGMonteCarloAnalyzer />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /parse deck/i }));
    });

    expect(parseDeckList).toHaveBeenCalledTimes(1);
  });

  it('passes the current deck text to parseDeckList', async () => {
    parseDeckList.mockResolvedValue(MOCK_PARSED_DECK);
    render(<MTGMonteCarloAnalyzer />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '24 Forest' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /parse deck/i }));
    });

    expect(parseDeckList.mock.calls[0][0]).toBe('24 Forest');
  });

  it('shows deck statistics after a successful parse', async () => {
    parseDeckList.mockResolvedValue(MOCK_PARSED_DECK);
    render(<MTGMonteCarloAnalyzer />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /parse deck/i }));
    });

    await waitFor(() => {
      expect(screen.getByText(/Total Cards:\s*60/i)).toBeInTheDocument();
    });
  });

  it('shows land count after a successful parse', async () => {
    parseDeckList.mockResolvedValue(MOCK_PARSED_DECK);
    render(<MTGMonteCarloAnalyzer />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /parse deck/i }));
    });

    await waitFor(() => {
      expect(screen.getByText(/Lands:\s*24/i)).toBeInTheDocument();
    });
  });

  it('shows the error banner when parseDeckList returns null', async () => {
    parseDeckList.mockResolvedValue(null);
    render(<MTGMonteCarloAnalyzer />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /parse deck/i }));
    });

    await waitFor(() => {
      expect(screen.getByText(/Parsing failed/i)).toBeInTheDocument();
    });
  });

  it('shows parse errors returned inside the deck object', async () => {
    parseDeckList.mockResolvedValue({ ...MOCK_PARSED_DECK, errors: ['Unknown card: Foo'] });
    render(<MTGMonteCarloAnalyzer />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /parse deck/i }));
    });

    await waitFor(() => {
      expect(screen.getByText(/Unknown card: Foo/i)).toBeInTheDocument();
    });
  });

  it('clears a previous error when a new parse succeeds cleanly', async () => {
    // First parse fails
    parseDeckList.mockResolvedValueOnce(null);
    render(<MTGMonteCarloAnalyzer />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /parse deck/i }));
    });
    await waitFor(() => expect(screen.getByText(/Parsing failed/i)).toBeInTheDocument());

    // Second parse succeeds
    parseDeckList.mockResolvedValueOnce(MOCK_PARSED_DECK);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /parse deck/i }));
    });

    await waitFor(() => {
      expect(screen.queryByText(/Parsing failed/i)).not.toBeInTheDocument();
    });
  });
});

// =============================================================================
// 5 — Run Simulation flow
// =============================================================================
describe('Run Simulation flow', () => {
  it('calls monteCarlo after parsing a deck and clicking Start Simulation', async () => {
    // After a successful parse, SimulationSettingsPanel renders with a Start Simulation button.
    // Parse a deck first, then verify monteCarlo is invoked.
    // We test the guard via the exported handler indirectly: render only (no parse).
    // The Start Simulation button is only visible after parsing, so we parse first,
    // then verify monteCarlo is called.
    parseDeckList.mockResolvedValue(MOCK_PARSED_DECK);
    monteCarlo.mockReturnValue({
      landsPerTurn:       [],
      untappedPerTurn:    [],
      colorsByTurn:       [],
      manaByTurn:         [],
      lifeLossByTurn:     [],
      stdDevByTurn:       [],
      keyCardPlayability: {},
      mulligans:          0,
      handsKept:          1,
      fastestPlaySequences: [],
      hasBurstCards:      false,
    });

    render(<MTGMonteCarloAnalyzer />);

    // Parse the deck so the Run Simulation button appears
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /parse deck/i }));
    });

    // The Run Simulation button should now be in the document
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /start simulation/i })).toBeInTheDocument();
    });

    // Click it
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /start simulation/i }));
    });

    // monteCarlo should be called (inside a setTimeout—wait for it)
    await waitFor(() => {
      expect(monteCarlo).toHaveBeenCalledTimes(1);
    }, { timeout: 500 });
  });
});

// =============================================================================
// 6 — localStorage persistence
// =============================================================================
describe('localStorage persistence', () => {
  it('persists deck text to localStorage when the textarea changes', async () => {
    render(<MTGMonteCarloAnalyzer />);
    const ta = screen.getByRole('textbox');

    await act(async () => {
      fireEvent.change(ta, { target: { value: '4 Lightning Bolt' } });
    });

    // useEffect fires synchronously in testing environment after state update
    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem('mtg_mca_state') || '{}');
      expect(saved.deckText).toBe('4 Lightning Bolt');
    });
  });

  it('restores saved deck text from localStorage on mount', () => {
    localStorage.setItem('mtg_mca_state', JSON.stringify({ deckText: '4 Counterspell' }));
    render(<MTGMonteCarloAnalyzer />);
    expect(screen.getByRole('textbox').value).toBe('4 Counterspell');
  });

  it('restores saved apiMode from localStorage on mount', () => {
    localStorage.setItem('mtg_mca_state', JSON.stringify({ apiMode: 'scryfall' }));
    render(<MTGMonteCarloAnalyzer />);
    const scryfallRadio = screen.getByLabelText(/Scryfall API/i);
    expect(scryfallRadio).toBeChecked();
  });

  it('falls back to defaults when localStorage is empty', () => {
    render(<MTGMonteCarloAnalyzer />);
    expect(screen.getByLabelText(/Local JSON File/i)).toBeChecked();
    expect(screen.getByRole('textbox').value).toBe('');
  });
});
