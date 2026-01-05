// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./routes";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);

// src/routes.tsx
import { createBrowserRouter } from "react-router-dom";
import RootLayout from "./ui/RootLayout";
import Landing from "./ui/pages/Landing";
import Onboarding from "./ui/pages/Onboarding";
import Portfolio from "./ui/pages/Portfolio";
import Result from "./ui/pages/Result";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      { index: true, element: <Landing /> },
      { path: "onboarding", element: <Onboarding /> },
      { path: "portfolio", element: <Portfolio /> },
      { path: "result", element: <Result /> },
    ],
  },
]);
