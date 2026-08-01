import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";

import { getRouter } from "./router";
import "./styles/globals.css";

performance.mark("atlas:navigation-start");

const appElement = document.getElementById("app");
if (!appElement) throw new Error("Atlas Portal root element was not found.");

const router = getRouter();

createRoot(appElement).render(<RouterProvider router={router} />);
