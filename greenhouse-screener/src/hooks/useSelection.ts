import { useState, useCallback, useMemo } from 'react';

export function useSelection() {
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const toggle = useCallback((id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: number[]) => {
    setSelected(new Set(ids));
  }, []);

  const selectMultiple = useCallback((ids: number[]) => {
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
  }, []);

  const deselectMultiple = useCallback((ids: number[]) => {
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setSelected(new Set());
  }, []);

  const isSelected = useCallback((id: number) => selected.has(id), [selected]);

  const selectedArray = useMemo(() => Array.from(selected), [selected]);

  return {
    selected,
    selectedArray,
    selectedCount: selected.size,
    toggle,
    selectAll,
    selectMultiple,
    deselectMultiple,
    clear,
    isSelected,
    hasSelection: selected.size > 0,
  };
}
