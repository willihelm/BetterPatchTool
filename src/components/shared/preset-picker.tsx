"use client";

import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Search } from "lucide-react";

interface PresetPickerProps<T extends { id: string; manufacturer: string; model: string }> {
  presets: T[];
  manufacturers: string[];
  renderItem: (preset: T) => React.ReactNode;
  onSelect: (preset: T) => void;
  searchPlaceholder?: string;
}

export function PresetPicker<T extends { id: string; manufacturer: string; model: string }>({
  presets,
  manufacturers,
  renderItem,
  onSelect,
  searchPlaceholder = "Search equipment...",
}: PresetPickerProps<T>) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return presets;
    const q = search.toLowerCase();
    return presets.filter(
      (p) =>
        p.model.toLowerCase().includes(q) ||
        p.manufacturer.toLowerCase().includes(q)
    );
  }, [presets, search]);

  const grouped = useMemo(() => {
    const groups: { manufacturer: string; items: T[] }[] = [];
    for (const mfr of manufacturers) {
      const items = filtered.filter((p) => p.manufacturer === mfr);
      if (items.length > 0) groups.push({ manufacturer: mfr, items });
    }
    return groups;
  }, [filtered, manufacturers]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>
      <div className="max-h-80 overflow-y-auto space-y-4">
        {grouped.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">No matching equipment found.</p>
        )}
        {grouped.map(({ manufacturer, items }) => (
          <div key={manufacturer}>
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 px-1">
              {manufacturer}
            </h4>
            <div className="space-y-1">
              {items.map((preset) => (
                <Card
                  key={preset.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => onSelect(preset)}
                >
                  <CardContent className="p-2.5">
                    {renderItem(preset)}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
