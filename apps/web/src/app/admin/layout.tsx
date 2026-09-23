import type { ReactNode } from "react";
import "./admin.css";

// Every page keeps its own authorization and MFA checks before rendering AdminShell.
export default function AdminLayout({ children }: { children: ReactNode }) {
  return children;
}
