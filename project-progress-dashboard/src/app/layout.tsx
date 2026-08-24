import React from "react";
import "./globals.css";

export const metadata = {
  title: "SocialEngage — Project Development Dashboard",
  description: "Live Engineering Telemetry, Architecture Decisions, Requirements, Specifications, and Epics Tracking for SocialEngage.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-slate-50">{children}</body>
    </html>
  );
}
