"use client";

import { createContext, useContext } from "react";
import type { ProjectAccessRole } from "@/types/convex";

interface ProjectAccessContextValue {
  accessRole: ProjectAccessRole;
  readOnly: boolean;
  accessToken?: string;
}

const ProjectAccessContext = createContext<ProjectAccessContextValue>({
  accessRole: "owner",
  readOnly: false,
});

export function ProjectAccessProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: ProjectAccessContextValue;
}) {
  return <ProjectAccessContext.Provider value={value}>{children}</ProjectAccessContext.Provider>;
}

export function useProjectAccess() {
  return useContext(ProjectAccessContext);
}
