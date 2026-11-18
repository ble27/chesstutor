import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App";

describe("service status", () => {
  it("keeps the ready shell focused on search", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ status: "ready" })),
    );
    render(<App />);
    await waitFor(() =>
      expect(screen.queryByRole("status")).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: "Find games" })).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "Engine analysis" }),
    ).not.toBeInTheDocument();
  });

  it("shows service failure without claiming readiness", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    render(<App />);
    expect(await screen.findByText(/Review service unavailable/)).toBeVisible();
  });
});
