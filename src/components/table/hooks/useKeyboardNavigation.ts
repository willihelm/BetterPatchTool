import { useState, useCallback, useEffect, useRef } from "react";

export interface CellPosition {
  rowIndex: number;
  columnId: string;
}

export interface UseKeyboardNavigationOptions {
  rowCount: number;
  columnIds: string[];
  onCellChange?: (position: CellPosition) => void;
  onStartEditing?: (position: CellPosition) => void;
  onStopEditing?: () => void;
  onDeleteRow?: (rowIndex: number) => void;
  onMoveRow?: (rowIndex: number, direction: "up" | "down") => void;
}

export function useKeyboardNavigation({
  rowCount,
  columnIds,
  onCellChange,
  onStartEditing,
  onStopEditing,
  onDeleteRow,
  onMoveRow,
}: UseKeyboardNavigationOptions) {
  const [activeCell, setActiveCell] = useState<CellPosition | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const getColumnIndex = useCallback(
    (columnId: string) => columnIds.indexOf(columnId),
    [columnIds]
  );

  const navigate = useCallback(
    (direction: "up" | "down" | "left" | "right") => {
      if (!activeCell || rowCount === 0) return;

      const { rowIndex, columnId } = activeCell;
      const colIndex = getColumnIndex(columnId);

      let newRowIndex = rowIndex;
      let newColIndex = colIndex;

      switch (direction) {
        case "up":
          newRowIndex = Math.max(0, rowIndex - 1);
          break;
        case "down":
          newRowIndex = Math.min(rowCount - 1, rowIndex + 1);
          break;
        case "left":
          newColIndex = Math.max(0, colIndex - 1);
          break;
        case "right":
          newColIndex = Math.min(columnIds.length - 1, colIndex + 1);
          break;
      }

      const newPosition = {
        rowIndex: newRowIndex,
        columnId: columnIds[newColIndex],
      };

      setActiveCell(newPosition);
      onCellChange?.(newPosition);
    },
    [activeCell, rowCount, columnIds, getColumnIndex, onCellChange]
  );

  const navigateToNextCell = useCallback(
    (reverse = false) => {
      if (!activeCell) return;

      const { rowIndex, columnId } = activeCell;
      const colIndex = getColumnIndex(columnId);

      let newRowIndex = rowIndex;
      let newColIndex = colIndex;

      if (reverse) {
        newColIndex--;
        if (newColIndex < 0) {
          newColIndex = columnIds.length - 1;
          newRowIndex = Math.max(0, rowIndex - 1);
        }
      } else {
        newColIndex++;
        if (newColIndex >= columnIds.length) {
          newColIndex = 0;
          newRowIndex = Math.min(rowCount - 1, rowIndex + 1);
        }
      }

      const newPosition = {
        rowIndex: newRowIndex,
        columnId: columnIds[newColIndex],
      };

      setActiveCell(newPosition);
      onCellChange?.(newPosition);
    },
    [activeCell, rowCount, columnIds, getColumnIndex, onCellChange]
  );

  const navigateToNextRow = useCallback(
    (reverse = false) => {
      if (!activeCell) return;

      const { rowIndex, columnId } = activeCell;
      const newRowIndex = reverse
        ? Math.max(0, rowIndex - 1)
        : Math.min(rowCount - 1, rowIndex + 1);

      const newPosition = {
        rowIndex: newRowIndex,
        columnId,
      };

      setActiveCell(newPosition);
      onCellChange?.(newPosition);
    },
    [activeCell, rowCount, onCellChange]
  );

  const startEditing = useCallback(
    (clearContent = false) => {
      if (!activeCell) return;
      setIsEditing(true);
      onStartEditing?.(activeCell);
    },
    [activeCell, onStartEditing]
  );

  const stopEditing = useCallback(
    (save = true) => {
      setIsEditing(false);
      onStopEditing?.();
    },
    [onStopEditing]
  );

  const selectCell = useCallback(
    (position: CellPosition) => {
      setActiveCell(position);
      setIsEditing(false);
      onCellChange?.(position);
    },
    [onCellChange]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Wenn wir im Bearbeitungsmodus sind, andere Behandlung
      if (isEditing) {
        switch (e.key) {
          case "Escape":
            e.preventDefault();
            stopEditing(false);
            break;
          case "Enter":
            if (!e.shiftKey) {
              e.preventDefault();
              stopEditing(true);
              navigateToNextRow(false);
            }
            break;
          case "Tab":
            e.preventDefault();
            stopEditing(true);
            navigateToNextCell(e.shiftKey);
            break;
        }
        return;
      }

      // Navigation im Nicht-Bearbeitungsmodus
      if (!activeCell) return;

      switch (e.key) {
        case "ArrowUp":
          e.preventDefault();
          if (e.altKey && onMoveRow) {
            onMoveRow(activeCell.rowIndex, "up");
          } else {
            navigate("up");
          }
          break;
        case "ArrowDown":
          e.preventDefault();
          if (e.altKey && onMoveRow) {
            onMoveRow(activeCell.rowIndex, "down");
          } else {
            navigate("down");
          }
          break;
        case "ArrowLeft":
          e.preventDefault();
          navigate("left");
          break;
        case "ArrowRight":
          e.preventDefault();
          navigate("right");
          break;
        case "Tab":
          e.preventDefault();
          navigateToNextCell(e.shiftKey);
          break;
        case "Enter":
          e.preventDefault();
          if (e.shiftKey) {
            navigateToNextRow(true);
          } else {
            startEditing();
          }
          break;
        case "F2":
          e.preventDefault();
          startEditing();
          break;
        case "Delete":
        case "Backspace":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            onDeleteRow?.(activeCell.rowIndex);
          } else {
            // Löscht Inhalt und startet Bearbeitung
            startEditing(true);
          }
          break;
        case "Escape":
          e.preventDefault();
          setActiveCell(null);
          break;
        default:
          // Alphanumerische Tasten starten Bearbeitung
          if (
            e.key.length === 1 &&
            !e.ctrlKey &&
            !e.metaKey &&
            !e.altKey
          ) {
            e.preventDefault();
            startEditing(true);
          }
          break;
      }
    },
    [
      activeCell,
      isEditing,
      navigate,
      navigateToNextCell,
      navigateToNextRow,
      startEditing,
      stopEditing,
      onDeleteRow,
      onMoveRow,
    ]
  );

  // Event-Listener auf Container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("keydown", handleKeyDown);
    return () => container.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Initial-Fokus auf erste Zelle wenn Tabelle Fokus erhält
  const initializeNavigation = useCallback(() => {
    if (!activeCell && rowCount > 0 && columnIds.length > 0) {
      setActiveCell({ rowIndex: 0, columnId: columnIds[0] });
    }
  }, [activeCell, rowCount, columnIds]);

  return {
    activeCell,
    isEditing,
    containerRef,
    selectCell,
    startEditing,
    stopEditing,
    navigate,
    navigateToNextCell,
    navigateToNextRow,
    initializeNavigation,
    setActiveCell,
    setIsEditing,
  };
}
