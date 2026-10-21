import { anonymousClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: typeof window !== "undefined" ? window.location.origin : "http://localhost:5174",
  basePath: "/api/auth",
  plugins: [anonymousClient()],
});

export const { useSession } = authClient;
