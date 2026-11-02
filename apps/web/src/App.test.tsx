import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App";

describe("service status", () => {
  it("shows confirmed readiness", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ status: "ready" })),
    );
    render(<App />);
    expect(await screen.findByText("Review service connected")).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Engine analysis" }),
    ).toBeVisible();
  });

  it("shows service failure without claiming readiness", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    render(<App />);
    expect(await screen.findByText(/Review service unavailable/)).toBeVisible();
  });
});
