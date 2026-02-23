/**
 * useCardLookup — custom hook encapsulating local-file and Scryfall API card lookups.
 *
 * Manages:
 *   cardsDatabase        — loaded JSON array (or null)
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

  const [scryfallCallCount, setScryfallCallCount] = useState(() =>
    parseInt(sessionStorage.getItem('scryfall_call_count') || '0', 10)
  );

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
      }
    },
    [setError]
  );

  // ── Card lookup (cache → Scryfall API) ────────────────────────────────────
  const lookupCard = useCallback(
    async cardName => {
      const cache = lookupCacheRef.current;
      const searchName = cardName.toLowerCase().trim();

      if (cache.has(searchName)) return cache.get(searchName);

      for (const [name, card] of cache.entries()) {
        if (name.startsWith(searchName) || name.includes(searchName)) return card;
      }

      if (apiMode === 'scryfall') {
        if (scryfallCallCount >= SCRYFALL_HARD_LIMIT) return null;

        try {
          const response = await fetch(
            `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(cardName)}`
          );
          if (response.ok) {
            const data = await response.json();

            const newCount = scryfallCallCount + 1;
            sessionStorage.setItem('scryfall_call_count', newCount);
            setScryfallCallCount(newCount);

            if (
              data.layout === 'token' ||
              data.layout === 'double_faced_token' ||
              data.set_type === 'token' ||
              data.type_line?.includes('Token')
            ) {
              console.warn(`⚠️ Skipping token for: ${cardName}`);
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
    [apiMode, scryfallCallCount]
  );

  return { cardsDatabase, lookupCacheRef, scryfallCallCount, handleFileUpload, lookupCard };
};
