import { useEffect, useState } from "react";
import { request } from "./api/client";
import { parseHealth } from "./api/validation";

export type ServiceStatus = "connecting" | "ready" | "unavailable";

export function useServiceStatus(): ServiceStatus {
  const [status, setStatus] = useState<ServiceStatus>("connecting");
  useEffect(() => {
    const controller = new AbortController();
    void request("/api/v1/health/ready", parseHealth, {
      signal: controller.signal,
    })
      .then((health) => {
        if (!controller.signal.aborted) {
          setStatus(health.status === "ready" ? "ready" : "unavailable");
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus("unavailable");
      });
    return () => controller.abort();
  }, []);
  return status;
}
