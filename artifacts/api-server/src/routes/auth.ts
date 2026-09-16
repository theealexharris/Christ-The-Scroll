import { Router, type IRouter } from "express";
import { GetCurrentUserResponse, LoginBody, LoginResponse, RegisterBody, RegisterResponse } from "@workspace/api-zod";
import { createUser, getUserByEmail, getUserById } from "../data/auth";
import { clearSession, hashPassword, issueSession, verifyPassword } from "../lib/auth";

const router: IRouter = Router();

router.post("/auth/register", async (req, res) => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "A valid email and password (at least 8 characters) are required." });
  const existing = await getUserByEmail(parsed.data.email);
  if (existing) return res.status(409).json({ error: "An account with that email already exists." });
  const passwordHash = await hashPassword(parsed.data.password);
  const user = await createUser(parsed.data.email, passwordHash);
  issueSession(res, user.id);
  return res.status(201).json(RegisterResponse.parse({ id: user.id, email: user.email }));
});

router.post("/auth/login", async (req, res) => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Email and password are required." });
  const user = await getUserByEmail(parsed.data.email);
  const valid = user && (await verifyPassword(parsed.data.password, user.passwordHash));
  if (!user || !valid) return res.status(401).json({ error: "Invalid email or password." });
  issueSession(res, user.id);
  return res.json(LoginResponse.parse({ id: user.id, email: user.email }));
});

router.post("/auth/logout", (_req, res) => {
  clearSession(res);
  return res.status(204).send();
});

router.get("/auth/me", async (req, res) => {
  const user = req.userId ? await getUserById(req.userId) : null;
  if (!user) return res.status(401).json({ error: "Not signed in." });
  return res.json(GetCurrentUserResponse.parse({ id: user.id, email: user.email }));
});

export default router;
