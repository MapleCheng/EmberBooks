import { Router } from "express";
import { CategoryModel } from "../models/Category.js";
import { authMiddleware } from "../middleware/auth.js";

export const categoriesRouter = Router();
categoriesRouter.use(authMiddleware);

// GET all categories
categoriesRouter.get("/", async (req, res) => {
  try {
    const categories = await CategoryModel.find({ userId: req.userId });
    res.json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch categories" });
  }
});

// GET single category
categoriesRouter.get("/:id", async (req, res) => {
  try {
    const category = await CategoryModel.findOne({ _id: req.params.id, userId: req.userId });
    if (!category) {
      res.status(404).json({ success: false, error: "Category not found" });
      return;
    }
    res.json({ success: true, data: category });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch category" });
  }
});

// POST create category
categoriesRouter.post("/", async (req, res) => {
  try {
    const category = await CategoryModel.create({ ...req.body, userId: req.userId });
    res.status(201).json({ success: true, data: category });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to create category" });
  }
});

// PUT update category
categoriesRouter.put("/:id", async (req, res) => {
  try {
    const category = await CategoryModel.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      req.body,
      { new: true },
    );
    if (!category) {
      res.status(404).json({ success: false, error: "Category not found" });
      return;
    }
    res.json({ success: true, data: category });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to update category" });
  }
});

// DELETE category
categoriesRouter.delete("/:id", async (req, res) => {
  try {
    const category = await CategoryModel.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!category) {
      res.status(404).json({ success: false, error: "Category not found" });
      return;
    }
    res.json({ success: true, data: category });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to delete category" });
  }
});
