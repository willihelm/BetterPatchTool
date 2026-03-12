"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BusConfig } from "@/lib/bus-utils";
import { busConfigTotal } from "@/lib/bus-utils";

interface BusConfigFieldsProps {
  value: BusConfig;
  onChange: (config: BusConfig) => void;
}

const FIELDS: Array<{ key: keyof BusConfig; label: string }> = [
  { key: "groups", label: "Groups" },
  { key: "auxes", label: "Auxes" },
  { key: "fx", label: "FX" },
  { key: "matrices", label: "Matrices" },
  { key: "masters", label: "Masters" },
  { key: "cue", label: "Cue" },
];

export function BusConfigFields({ value, onChange }: BusConfigFieldsProps) {
  const total = busConfigTotal(value);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Output Buses</Label>
        <span className="text-xs text-muted-foreground">{total} total</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {FIELDS.map(({ key, label }) => (
          <div key={key} className="space-y-1">
            <Label className="text-xs text-muted-foreground">{label}</Label>
            <Input
              type="number"
              min={0}
              max={128}
              value={value[key] ?? 0}
              onChange={(e) => {
                const n = parseInt(e.target.value) || 0;
                onChange({ ...value, [key]: n > 0 ? n : undefined });
              }}
              className="h-8 text-sm"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
