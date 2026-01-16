import { useState, useCallback, useMemo } from "react";

interface UseChannelSelectionOptions {
  channelIds: string[];
}

interface UseChannelSelectionReturn {
  selectedIds: Set<string>;
  isSelected: (id: string) => boolean;
  toggleSelection: (id: string) => void;
  selectRange: (startId: string, endId: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  selectionCount: number;
  hasSelection: boolean;
  getSelectedInOrder: () => string[];
}

export function useChannelSelection({
  channelIds,
}: UseChannelSelectionOptions): UseChannelSelectionReturn {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds]
  );

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectRange = useCallback(
    (startId: string, endId: string) => {
      const startIndex = channelIds.indexOf(startId);
      const endIndex = channelIds.indexOf(endId);

      if (startIndex === -1 || endIndex === -1) return;

      const minIndex = Math.min(startIndex, endIndex);
      const maxIndex = Math.max(startIndex, endIndex);

      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (let i = minIndex; i <= maxIndex; i++) {
          next.add(channelIds[i]);
        }
        return next;
      });
    },
    [channelIds]
  );

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(channelIds));
  }, [channelIds]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const selectionCount = selectedIds.size;
  const hasSelection = selectionCount > 0;

  // Get selected IDs in their original order
  const getSelectedInOrder = useCallback(() => {
    return channelIds.filter((id) => selectedIds.has(id));
  }, [channelIds, selectedIds]);

  return useMemo(
    () => ({
      selectedIds,
      isSelected,
      toggleSelection,
      selectRange,
      selectAll,
      clearSelection,
      selectionCount,
      hasSelection,
      getSelectedInOrder,
    }),
    [
      selectedIds,
      isSelected,
      toggleSelection,
      selectRange,
      selectAll,
      clearSelection,
      selectionCount,
      hasSelection,
      getSelectedInOrder,
    ]
  );
}
