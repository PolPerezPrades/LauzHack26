/**
 * Inspector panels of developer mode (SPEC §6), shown under the forced-play controls and above the
 * event log. Parts add theirs here (one import and one line) instead of editing DevScreen.tsx:
 * the learner-state inspector in Part C, the recommender inspector in Part D.
 */
import type { ComponentType } from "react";
import type { LogStore } from "../data/logStore";

export interface DevPanelProps {
  /** the sandbox log ("signa-dev"), where forced play writes */
  sandbox: LogStore | null;
  /** the learner's real log ("signa"), read-only here */
  real: LogStore | null;
}

export interface DevPanel {
  id: string;
  Component: ComponentType<DevPanelProps>;
}

export const DEV_PANELS: readonly DevPanel[] = [];
