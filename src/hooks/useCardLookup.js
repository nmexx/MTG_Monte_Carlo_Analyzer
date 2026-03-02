/**
 * useCardLookup — custom hook encapsulating local-file and Scryfall API card lookups.
 *
 * Manages:
 *   cardsDatabase        — loaded JSON array (or null)
 *   isLoadingFile        — true while a JSON file is being parsed (shows a spinner in UI)
 *   lookupCacheRef       — mutable Map used as a fast name → card cache
 *   scryfallCallCount    — session-persistent API call counter (shown in UI)
 *   handleFileUpload()   — processes a local Scryfall Default Cards JSON upload
 *   lookupCard(name)     — async lookup: cache → Scryfall API fallback
 *
 * Also re-exports the two limit constants so consumers can render threshold UI.
 */

import { useState, useRef, useCallback } from 'react';

// =============================================================================
// Scryfall session limits
// =============================================================================
export const SCRYFALL_SOFT_LIMIT = 60; // show advisory warning
export const SCRYFALL_HARD_LIMIT = 150; // block further API calls

// =============================================================================
// Hook
// =============================================================================
/**
 * @param {string}   apiMode  — 'local' | 'scryfall'
 * @param {Function} setError — stable error-state setter from calling component
 */
export const useCardLookup = (apiMode, setError) => {
  const [cardsDatabase, setCardsDatabase] = useState(null);
  const lookupCacheRef = useRef(new Map());

  /**
   * True while handleFileUpload is parsing the JSON file.
   * Exposed so the UI can disable the file input and show a loading indicator.
   */
  const [isLoadingFile, setIsLoadingFile] = useState(false);

  // ── Scryfall call counter ──────────────────────────────────────────────────
  // A ref tracks the live counter so lookupCard never needs it as a dep
  // (avoiding a new function reference on every successful API call).
  // State is only updated for UI display — the ref is the source of truth.
  const scryfallCallCountRef = useRef(
    parseInt(sessionStorage.getItem('scryfall_call_count') || '0', 10)
  );
  const [scryfallCallCount, setScryfallCallCount] = useState(scryfallCallCountRef.current);

  // ── File upload ────────────────────────────────────────────────────────────
  const handleFileUpload = useCallback(
    async event => {
      const file = event.target.files[0];
      if (!file) return;

      if (file.size > 1024 * 1024 * 1024) {
        setError(
          'File too large (max 1 GB). The Scryfall Default Cards file should be ~200-300 MB.'
        );
        return;
      }

      setIsLoadingFile(true);
      try {
        const text = await file.text();
        const data = JSON.parse(text);

        if (!Array.isArray(data)) {
          setError('Invalid JSON format. Expected an array of card objects.');
          return;
        }

        setCardsDatabase(data);

        const lookupMap = new Map();
        data.forEach(card => {
          if (
            card.layout === 'token' ||
            card.layout === 'double_faced_token' ||
            card.set_type === 'token' ||
            card.type_line?.includes('Token')
          ) {
            return;
          }
          const name = card.name.toLowerCase();
          if (lookupMap.has(name)) {
            const existing = lookupMap.get(name);
            if ((card.cmc || 0) > (existing.cmc || 0)) lookupMap.set(name, card);
          } else {
            lookupMap.set(name, card);
          }
        });

        lookupCacheRef.current = lookupMap;
        setError('');
      } catch (err) {
        setError('Invalid JSON file. Please check the file format.');
        console.error(err);
      } finally {
        setIsLoadingFile(false);
      }
    },
    [setError]
  );

  // ── Card lookup (cache → Scryfall API) ────────────────────────────────────
  /**
   * Looks up a card by name:
   *   1. Exact match in cache.
   *   2. Prefix match — prevents "Force Spike" from returning before "Force of Will".
   *   3. Substring fallback for partial / alternate-name searches.
   *   4. Scryfall fuzzy API (only when apiMode === 'scryfall').
   *
   * Function reference is stable as long as apiMode is unchanged —
   * the call counter uses a ref, not state, so it is NOT a dep here.
   */
  const lookupCard = useCallback(
    async cardName => {
      const cache = lookupCacheRef.current;
      const searchName = cardName.toLowerCase().trim();

      // 1. Exact cache hit
      if (cache.has(searchName)) return cache.get(searchName);

      // 2. Prefix match (more precise than substring)
      for (const [name, card] of cache.entries()) {
        if (name.startsWith(searchName)) return card;
      }

      // 3. Substring fallback
      for (const [name, card] of cache.entries()) {
        if (name.includes(searchName)) return card;
      }

      if (apiMode === 'scryfall') {
        if (scryfallCallCountRef.current >= SCRYFALL_HARD_LIMIT) return null;

        try {
          const response = await fetch(
            `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(cardName)}`
          );
          if (response.ok) {
            const data = await response.json();

            // Count the primary API call
            scryfallCallCountRef.current += 1;
            sessionStorage.setItem('scryfall_call_count', scryfallCallCountRef.current);
            setScryfallCallCount(scryfallCallCountRef.current);

            if (
              data.layout === 'token' ||
              data.layout === 'double_faced_token' ||
              data.set_type === 'token' ||
              data.type_line?.includes('Token')
            ) {
              console.warn(`⚠️ Skipping token for: ${cardName}`);

              // Token fallback requires a second API call — count it separately
              scryfallCallCountRef.current += 1;
              sessionStorage.setItem('scryfall_call_count', scryfallCallCountRef.current);
              setScryfallCallCount(scryfallCallCountRef.current);

              const searchResponse = await fetch(
                `https://api.scryfall.com/cards/search?q=!"${encodeURIComponent(cardName)}"+-is:token&unique=cards&order=released`
              );
              if (searchResponse.ok) {
                const searchData = await searchResponse.json();
                if (searchData.data?.length > 0) {
                  const nonToken = searchData.data[0];
                  cache.set(searchName, nonToken);
                  return nonToken;
                }
              }
              return null;
            }

            cache.set(searchName, data);
            return data;
          }
        } catch (err) {
          console.error('Scryfall API error:', err);
        }
      }

      return null;
    },
    [apiMode] // stable — call counter uses a ref, not state
  );

  return {
    cardsDatabase,
    isLoadingFile,
    lookupCacheRef,
    scryfallCallCount,
    handleFileUpload,
    lookupCard,
  };
};
