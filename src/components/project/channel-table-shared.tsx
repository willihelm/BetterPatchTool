"use client";

import type { RenderCellProps } from "react-data-grid";

// Base fields shared between input and output channel rows
export interface BaseChannelRow {
  _id: string;
  ioPortId?: string;
  ioPortIdRight?: string;
  isStereo?: boolean;
  location: string;
  cable: string;
  notes: string;
}

export interface InputChannelRow extends BaseChannelRow {
  channelNumber: number;
  source: string;
  uhf: string;
  micInputDev: string;
  stand: string;
  patched: boolean;
}

export interface OutputChannelRow extends BaseChannelRow {
  rowNumber: number;
  busName: string;
  destination: string;
  ampProcessor: string;
}

// Text cell renderer - works with any row type
export function TextCell({ row, column }: RenderCellProps<any>) { // eslint-disable-line
  const value = row[column.key];
  return (
    <span className={!value ? "text-muted-foreground" : ""}>
      {value || "-"}
    </span>
  );
}
