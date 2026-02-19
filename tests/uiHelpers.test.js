/**
 * uiHelpers.jsx — Unit Tests
 *
 * Uses jsdom so that DOM-dependent helpers (downloadTextFile) work correctly.
 *
 * Covers all six exports:
 *   getManaSymbol      – colour → emoji string
 *   parseManaSymbols   – mana-cost string → token array
 *   getFetchSymbol     – fetchType → badge emoji
 *   renderManaCost     – mana-cost string → React element array
 *   renderSequenceBody – sequence data → React element
 *   downloadTextFile   – creates a blob URL and triggers a download anchor
 *   prepareChartData   – simulationResults → chart-ready plain objects
 *
 * Run:  npm test
 */

// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import {
  getManaSymbol,
  parseManaSymbols,
  getFetchSymbol,
  renderManaCost,
  renderSequenceBody,
  downloadTextFile,
  prepareChartData,
} from '../src/utils/uiHelpers.jsx';

// ─────────────────────────────────────────────────────────────────────────────
// getManaSymbol
// ─────────────────────────────────────────────────────────────────────────────
describe('getManaSymbol', () => {
  it('returns correct emoji for each colour', () => {
    expect(getManaSymbol('W')).toBe('☀️');
    expect(getManaSymbol('U')).toBe('💧');
    expect(getManaSymbol('B')).toBe('💀');
    expect(getManaSymbol('R')).toBe('🔥');
    expect(getManaSymbol('G')).toBe('🌿');
    expect(getManaSymbol('C')).toBe('◇');
  });

  it('returns an empty string for an unknown symbol', () => {
    expect(getManaSymbol('X')).toBe('');
    expect(getManaSymbol('')).toBe('');
    expect(getManaSymbol(undefined)).toBe('');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// parseManaSymbols
// ─────────────────────────────────────────────────────────────────────────────
describe('parseManaSymbols', () => {
  it('returns [] for null / undefined / empty string', () => {
    expect(parseManaSymbols(null)).toEqual([]);
    expect(parseManaSymbols(undefined)).toEqual([]);
    expect(parseManaSymbols('')).toEqual([]);
  });

  it('parses a single generic cost', () => {
    expect(parseManaSymbols('{3}')).toEqual(['3']);
  });

  it('parses a single coloured pip', () => {
    expect(parseManaSymbols('{G}')).toEqual(['G']);
  });

  it('parses a mixed mana cost', () => {
    expect(parseManaSymbols('{2}{G}{G}')).toEqual(['2', 'G', 'G']);
  });

  it('parses a zero-cost spell', () => {
    expect(parseManaSymbols('{0}')).toEqual(['0']);
  });

  it('parses a five-colour cost', () => {
    expect(parseManaSymbols('{W}{U}{B}{R}{G}')).toEqual(['W', 'U', 'B', 'R', 'G']);
  });

  it('parses X costs', () => {
    expect(parseManaSymbols('{X}{R}')).toEqual(['X', 'R']);
  });

  it('returns [] when no braces are present', () => {
    expect(parseManaSymbols('no braces here')).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getFetchSymbol
// ─────────────────────────────────────────────────────────────────────────────
describe('getFetchSymbol', () => {
  it('returns correct badge for known fetch types', () => {
    expect(getFetchSymbol('classic')).toBe('⚡');
    expect(getFetchSymbol('slow')).toBe('🐌');
    expect(getFetchSymbol('mana_cost')).toBe('💰');
    expect(getFetchSymbol('free_slow')).toBe('🆓');
  });

  it('returns empty string for unknown types', () => {
    expect(getFetchSymbol('unknown_type')).toBe('');
    expect(getFetchSymbol(undefined)).toBe('');
    expect(getFetchSymbol('')).toBe('');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// renderManaCost  (returns an array of React elements — tested without renderer)
// ─────────────────────────────────────────────────────────────────────────────
describe('renderManaCost', () => {
  it('returns an empty array for null / empty input', () => {
    expect(renderManaCost(null)).toEqual([]);
    expect(renderManaCost('')).toEqual([]);
  });

  it('returns one element per symbol', () => {
    const result = renderManaCost('{2}{G}');
    expect(result).toHaveLength(2);
  });

  it('uses mana-cost-symbol class for known colour pips', () => {
    const result = renderManaCost('{G}');
    expect(result[0].props.className).toBe('mana-cost-symbol');
    expect(result[0].props.children).toBe('🌿');
  });

  it('uses mana-cost-generic class for generic/numeric symbols', () => {
    const result = renderManaCost('{3}');
    expect(result[0].props.className).toBe('mana-cost-generic');
    expect(result[0].props.children).toBe('3');
  });

  it('handles a multicolour cost correctly', () => {
    const result = renderManaCost('{1}{U}{B}');
    expect(result).toHaveLength(3);
    // generic
    expect(result[0].props.className).toBe('mana-cost-generic');
    // colour pips
    expect(result[1].props.className).toBe('mana-cost-symbol');
    expect(result[2].props.className).toBe('mana-cost-symbol');
  });

  it('each returned element is a valid React element', () => {
    const result = renderManaCost('{W}{U}');
    result.forEach(el => expect(React.isValidElement(el)).toBe(true));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// renderSequenceBody
// ─────────────────────────────────────────────────────────────────────────────
describe('renderSequenceBody', () => {
  const sampleData = {
    openingHand: ['Forest', 'Island', 'Llanowar Elves'],
    sequence: [
      { turn: 1, actions: ['Played Forest (untapped)'], lifeLoss: 0 },
      { turn: 2, actions: ['Drew: Island', 'Played Island (untapped)'], lifeLoss: 2 },
    ],
  };

  it('returns a valid React element', () => {
    const result = renderSequenceBody(sampleData);
    expect(React.isValidElement(result)).toBe(true);
  });

  it('accepts an optional accentColor without throwing', () => {
    expect(() => renderSequenceBody(sampleData, '#ff0000')).not.toThrow();
  });

  it('works with an empty sequence array', () => {
    const data = { openingHand: [], sequence: [] };
    expect(() => renderSequenceBody(data)).not.toThrow();
  });

  it('works with a turn that has no actions', () => {
    const data = {
      openingHand: ['Forest'],
      sequence: [{ turn: 1, actions: [], lifeLoss: 0 }],
    };
    expect(() => renderSequenceBody(data)).not.toThrow();
  });

  it('works with a turn that has life loss', () => {
    const data = {
      openingHand: ['Shock Land'],
      sequence: [{ turn: 1, actions: ['Played Shock Land [-2 life]'], lifeLoss: 2 }],
    };
    expect(() => renderSequenceBody(data)).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// downloadTextFile  (requires jsdom)
// ─────────────────────────────────────────────────────────────────────────────
describe('downloadTextFile', () => {
  beforeEach(() => {
    // Mock URL and anchor APIs
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:mock-url'),
      revokeObjectURL: vi.fn(),
    });
  });

  it('creates an anchor element and triggers a click', () => {
    const clickSpy  = vi.fn();
    const createSpy = vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      if (tag === 'a') {
        return { href: '', download: '', click: clickSpy };
      }
      return document.createElement(tag);
    });

    downloadTextFile('hello world', 'test.txt');

    expect(URL.createObjectURL).toHaveBeenCalledOnce();
    expect(clickSpy).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');

    createSpy.mockRestore();
  });

  it('sets the correct download filename', () => {
    let capturedAnchor = null;
    const createSpy = vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      if (tag === 'a') {
        capturedAnchor = { href: '', download: '', click: vi.fn() };
        return capturedAnchor;
      }
      return document.createElement(tag);
    });

    downloadTextFile('some content', 'my-export.csv');
    expect(capturedAnchor.download).toBe('my-export.csv');

    createSpy.mockRestore();
  });

  it('passes content to Blob correctly', () => {
    const BlobSpy = vi.fn(function (content, options) {
      this.content = content;
      this.type = options?.type;
    });
    vi.stubGlobal('Blob', BlobSpy);

    const createSpy = vi.spyOn(document, 'createElement').mockReturnValue({
      href: '', download: '', click: vi.fn(),
    });

    downloadTextFile('deck data here', 'deck.txt');
    expect(BlobSpy).toHaveBeenCalledWith(['deck data here'], { type: 'text/plain' });

    createSpy.mockRestore();
    vi.unstubAllGlobals();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// prepareChartData
// ─────────────────────────────────────────────────────────────────────────────
describe('prepareChartData', () => {
  it('returns null for null simulationResults', () => {
    expect(prepareChartData(null, 5)).toBeNull();
  });

  it('returns an object with the 4 expected array keys', () => {
    const result = prepareChartData({}, 3);
    expect(result).toHaveProperty('landsData');
    expect(result).toHaveProperty('manaByColorData');
    expect(result).toHaveProperty('lifeLossData');
    expect(result).toHaveProperty('keyCardsData');
  });

  it('each array has exactly `turns` entries', () => {
    const result = prepareChartData({}, 4);
    expect(result.landsData).toHaveLength(4);
    expect(result.manaByColorData).toHaveLength(4);
    expect(result.lifeLossData).toHaveLength(4);
    expect(result.keyCardsData).toHaveLength(4);
  });

  it('turn numbers are 1-indexed', () => {
    const result = prepareChartData({}, 3);
    expect(result.landsData[0].turn).toBe(1);
    expect(result.landsData[2].turn).toBe(3);
  });

  it('defaults missing landsPerTurn values to 0', () => {
    const result = prepareChartData({}, 2);
    expect(result.landsData[0]['Total Lands']).toBe(0);
    expect(result.landsData[0]['Untapped Lands']).toBe(0);
  });

  it('rounds averages to 2 decimal places', () => {
    const sim = { landsPerTurn: [1.33333] };
    const result = prepareChartData(sim, 1);
    expect(result.landsData[0]['Total Lands']).toBe(1.33);
  });

  it('computes Lo/Hi bands from std-dev', () => {
    const sim = { landsPerTurn: [3], landsPerTurnStdDev: [1] };
    const result = prepareChartData(sim, 1);
    expect(result.landsData[0]['Total Lands Lo']).toBe(2);
    expect(result.landsData[0]['Total Lands Hi']).toBe(4);
  });

  it('Lo band never goes below 0', () => {
    const sim = { landsPerTurn: [0.5], landsPerTurnStdDev: [2] };
    const result = prepareChartData(sim, 1);
    expect(result.landsData[0]['Total Lands Lo']).toBe(0);
  });

  it('includes per-colour mana in manaByColorData', () => {
    const sim = {
      colorsByTurn: [{ W: 0, U: 2.1, B: 0, R: 0, G: 3 }],
    };
    const result = prepareChartData(sim, 1);
    expect(result.manaByColorData[0].U).toBe(2.1);
    expect(result.manaByColorData[0].G).toBe(3);
  });

  it('handles missing colorsByTurn without throwing', () => {
    expect(() => prepareChartData({ landsPerTurn: [1, 2] }, 2)).not.toThrow();
  });

  it('includes key-card playability in keyCardsData', () => {
    const sim = {
      keyCardPlayability: { 'Sol Ring': [0, 45.5, 80] },
    };
    const result = prepareChartData(sim, 3);
    expect(result.keyCardsData[1]['Sol Ring']).toBe(45.5);
  });

  it('includes "+burst" columns when hasBurstCards=true', () => {
    const sim = {
      hasBurstCards: true,
      keyCardPlayability: { 'Dark Ritual': [10] },
      keyCardPlayabilityBurst: { 'Dark Ritual': [30] },
    };
    const result = prepareChartData(sim, 1);
    expect(result.keyCardsData[0]['Dark Ritual (+burst)']).toBe(30);
  });

  it('omits "+burst" columns when hasBurstCards=false', () => {
    const sim = {
      hasBurstCards: false,
      keyCardPlayabilityBurst: { 'Dark Ritual': [30] },
    };
    const result = prepareChartData(sim, 1);
    expect(result.keyCardsData[0]['Dark Ritual (+burst)']).toBeUndefined();
  });

  it('includes life-loss data with Lo/Hi bands', () => {
    const sim = { lifeLossPerTurn: [4], lifeLossPerTurnStdDev: [1] };
    const result = prepareChartData(sim, 1);
    expect(result.lifeLossData[0]['Life Loss']).toBe(4);
    expect(result.lifeLossData[0]['Life Loss Lo']).toBe(3);
    expect(result.lifeLossData[0]['Life Loss Hi']).toBe(5);
  });

  it('returns 0 for missing std-dev fields', () => {
    const sim = { landsPerTurn: [2] };
    const result = prepareChartData(sim, 1);
    expect(result.landsData[0]['_landsSd']).toBe(0);
    expect(result.landsData[0]['_untappedSd']).toBe(0);
  });
});
