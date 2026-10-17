import { Router } from "express";
import { z } from "zod";
import Pandal from "../models/Pandal";

const router = Router();

const querySchema = z.object({
  region: z.enum(["North", "Central", "South"]).optional(),
  search: z.string().trim().max(100).optional(),
});

router.get("/", async (req, res, next) => {
  try {
    const parsed = querySchema.safeParse(req.query);

    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid query parameters",
        details: parsed.error.flatten(),
      });
    }

    const { region, search } = parsed.data;
    const filter: Record<string, unknown> = {};

    if (region) filter.region = region;

    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      filter.$or = [
        { name: { $regex: escaped, $options: "i" } },
        { address: { $regex: escaped, $options: "i" } },
        { landmark: { $regex: escaped, $options: "i" } },
      ];
    }

    const pandals = await Pandal.find(filter)
      .select("-__v")
      .sort({ region: 1, name: 1 })
      .lean()
      .limit(500);

    return res.json({
      count: pandals.length,
      pandals,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:slug", async (req, res, next) => {
  try {
    const pandal = await Pandal.findOne({ slug: req.params.slug })
      .select("-__v")
      .lean();

    if (!pandal) {
      return res.status(404).json({ error: "Pandal not found" });
    }

    return res.json(pandal);
  } catch (error) {
    next(error);
  }
});

export default router;