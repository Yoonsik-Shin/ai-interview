import { ReactNode } from "react";
import "./PageFrame.css";

interface PageFrameProps {
  children: ReactNode;
}

export function PageFrame({ children }: PageFrameProps) {
  return <div className="pageFrame">{children}</div>;
}
