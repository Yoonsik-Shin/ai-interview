import { ReactNode } from "react";
import { createPortal } from "react-dom";

interface PortalProps {
  children: ReactNode;
  containerId?: string;
}

/**
 * Portal component to render children outside of the current DOM hierarchy.
 * Useful for modals and overlays to avoid CSS containing block issues (like transform).
 */
export function Portal({ children, containerId = "portal-root" }: PortalProps) {
  let container = document.getElementById(containerId);

  if (!container) {
    container = document.createElement("div");
    container.setAttribute("id", containerId);
    document.body.appendChild(container);
  }

  return createPortal(children, container);
}
