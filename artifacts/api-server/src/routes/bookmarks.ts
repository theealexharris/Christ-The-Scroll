import { Router, type IRouter } from "express";
import { CreateBookmarkBody, ListBookmarksResponse } from "@workspace/api-zod";
import { createBookmark, deleteBookmark, listBookmarks } from "../data/bookmarks";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

router.use("/bookmarks", requireAuth);

router.get("/bookmarks", async (req, res) => {
  return res.json(ListBookmarksResponse.parse(await listBookmarks(req.userId!)));
});

router.post("/bookmarks", async (req, res) => {
  const parsed = CreateBookmarkBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "A valid bookmark target is required." });
  const bookmark = await createBookmark(req.userId!, parsed.data);
  return res.status(201).json(bookmark);
});

router.delete("/bookmarks/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid bookmark id." });
  const deleted = await deleteBookmark(req.userId!, id);
  return deleted ? res.status(204).send() : res.status(404).json({ error: "Bookmark not found." });
});

export default router;
