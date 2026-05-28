import type { Dispatch } from "react";
import type { WorkspaceState } from "../types/model";
import type { WorkspaceAction } from "../state/reducer";

export interface PanelProps {
  workspace: WorkspaceState;
  dispatch: Dispatch<WorkspaceAction>;
}
