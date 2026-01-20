"use client";

import { useState, useRef, useEffect, memo, KeyboardEvent } from "react";
import { TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface StereoEditableCellProps {
  valueLeft: string | undefined;
  valueRight: string | undefined;
  isActive: boolean;
  columnId: string;
  rowIndex: number;
  onSave: (rowIndex: number, columnId: string, valueLeft: string, valueRight: string) => void;
  onNavigate: (rowIndex: number, columnId: string, direction: "up" | "down" | "left" | "right" | "next" | "prev") => void;
  onCopyFromAbove?: (rowIndex: number, columnId: string) => string | undefined;
  onCellClick?: () => void;
}

export const StereoEditableCell = memo(function StereoEditableCell({
  valueLeft,
  valueRight,
  isActive,
  columnId,
  rowIndex,
  onSave,
  onNavigate,
  onCopyFromAbove,
  onCellClick,
}: StereoEditableCellProps) {
  const [editValueLeft, setEditValueLeft] = useState(valueLeft || "");
  const [editValueRight, setEditValueRight] = useState(valueRight || "");
  const [isEditing, setIsEditing] = useState(false);
  const [activeSide, setActiveSide] = useState<"left" | "right">("left");
  const inputRefLeft = useRef<HTMLInputElement>(null);
  const inputRefRight = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditValueLeft(valueLeft || "");
    setEditValueRight(valueRight || "");
  }, [valueLeft, valueRight]);

  useEffect(() => {
    if (isActive && !isEditing) {
      setIsEditing(true);
      if (activeSide === "left") {
        inputRefLeft.current?.focus();
        inputRefLeft.current?.select();
      } else {
        inputRefRight.current?.focus();
        inputRefRight.current?.select();
      }
    }
  }, [isActive, isEditing, activeSide]);

  const handleSave = () => {
    onSave(rowIndex, columnId, editValueLeft, editValueRight);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValueLeft(valueLeft || "");
    setEditValueRight(valueRight || "");
    setIsEditing(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, side: "left" | "right") => {
    if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (side === "left") {
        // Move to right on enter
        setActiveSide("right");
        inputRefRight.current?.focus();
        inputRefRight.current?.select();
      } else {
        // Save on enter from right
        handleSave();
      }
    } else if (e.key === "Tab") {
      e.preventDefault();
      if (e.shiftKey) {
        // Shift+Tab: go to left or previous cell
        if (side === "left") {
          handleSave();
          onNavigate(rowIndex, columnId, "prev");
        } else {
          setActiveSide("left");
          inputRefLeft.current?.focus();
          inputRefLeft.current?.select();
        }
      } else {
        // Tab: go to right or next cell
        if (side === "left") {
          setActiveSide("right");
          inputRefRight.current?.focus();
          inputRefRight.current?.select();
        } else {
          handleSave();
          onNavigate(rowIndex, columnId, "next");
        }
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      handleSave();
      onNavigate(rowIndex, columnId, "up");
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      handleSave();
      onNavigate(rowIndex, columnId, "down");
    } else if (e.key === "ArrowLeft" && side === "right") {
      e.preventDefault();
      setActiveSide("left");
      inputRefLeft.current?.focus();
      inputRefLeft.current?.select();
    } else if (e.key === "ArrowRight" && side === "left") {
      e.preventDefault();
      setActiveSide("right");
      inputRefRight.current?.focus();
      inputRefRight.current?.select();
    } else if ((e.key === "Delete" || e.key === "Backspace") && e.ctrlKey === false && e.metaKey === false) {
      // On Delete/Backspace without modifiers, clear the field (default behavior)
    } else if ((e as any).altKey && (e as any).code === "Enter" && !isEditing) {
      // Alt+Enter to copy from above
      e.preventDefault();
      const copied = onCopyFromAbove?.(rowIndex, columnId);
      if (copied) {
        if (side === "left") {
          setEditValueLeft(copied);
        } else {
          setEditValueRight(copied);
        }
      }
    }
  };

  return (
    <TableCell
      className={cn(
        "cursor-text transition-colors p-0",
        isActive && isEditing
          ? "ring-2 ring-primary ring-inset bg-primary/5"
          : "hover:bg-muted/50"
      )}
      onClick={() => {
        if (!isEditing) {
          setIsEditing(true);
          onCellClick?.();
        }
      }}
    >
      <div className="flex items-center justify-between h-full px-2 py-1.5 gap-1">
        {/* Left Input */}
        <div className="flex items-center gap-1 flex-1">
          <span className="text-xs text-muted-foreground font-medium min-w-fit">L:</span>
          <Input
            ref={inputRefLeft}
            type="text"
            value={editValueLeft}
            onChange={(e) => setEditValueLeft(e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, "left")}
            onBlur={handleSave}
            onFocus={() => setActiveSide("left")}
            className={cn(
              "h-6 px-1.5 py-0 text-xs border-0 rounded",
              activeSide === "left" && isEditing && "ring-1 ring-primary/50"
            )}
            placeholder=""
            disabled={!isEditing}
          />
        </div>

        {/* Right Input */}
        <div className="flex items-center gap-1 flex-1">
          <span className="text-xs text-muted-foreground font-medium min-w-fit">R:</span>
          <Input
            ref={inputRefRight}
            type="text"
            value={editValueRight}
            onChange={(e) => setEditValueRight(e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, "right")}
            onBlur={handleSave}
            onFocus={() => setActiveSide("right")}
            className={cn(
              "h-6 px-1.5 py-0 text-xs border-0 rounded",
              activeSide === "right" && isEditing && "ring-1 ring-primary/50"
            )}
            placeholder=""
            disabled={!isEditing}
          />
        </div>
      </div>
    </TableCell>
  );
});
