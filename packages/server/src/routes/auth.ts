import { Router } from "express";
import jwt from "jsonwebtoken";
import { UserModel } from "../models/User.js";
import { authMiddleware } from "../middleware/auth.js";

export const authRouter = Router();

// POST /api/auth/login
authRouter.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ success: false, error: "Email and password are required" });
      return;
    }

    const user = await UserModel.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      res.status(401).json({ success: false, error: "Invalid email or password" });
      return;
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      res.status(401).json({ success: false, error: "Invalid email or password" });
      return;
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      res.status(500).json({ success: false, error: "JWT secret not configured" });
      return;
    }

    const token = jwt.sign({ userId: user._id.toString() }, secret, { expiresIn: "7d" });
    res.json({
      success: true,
      data: {
        token,
        user: { _id: user._id, email: user.email, name: user.name, createdAt: user.createdAt },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: "Login failed" });
  }
});

// GET /api/auth/me
authRouter.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await UserModel.findById(req.userId).select("-password");
    if (!user) {
      res.status(404).json({ success: false, error: "User not found" });
      return;
    }
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch user" });
  }
});

// GET /api/auth/settings
authRouter.get("/settings", authMiddleware, async (req, res) => {
  try {
    const user = await UserModel.findById(req.userId).select("settings");
    if (!user) {
      res.status(404).json({ success: false, error: "User not found" });
      return;
    }
    res.json({
      success: true,
      data: user.settings || { payDay: 5 },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch settings" });
  }
});

// PUT /api/auth/settings
authRouter.put("/settings", authMiddleware, async (req, res) => {
  try {
    const { payDay } = req.body;
    const update: Record<string, unknown> = {};

    if (payDay !== undefined) {
      const pd = Number(payDay);
      if (!Number.isInteger(pd) || pd < 1 || pd > 28) {
        res.status(400).json({ success: false, error: "payDay 必須為 1-28 的整數" });
        return;
      }
      update["settings.payDay"] = pd;
    }

    const user = await UserModel.findByIdAndUpdate(
      req.userId,
      { $set: update },
      { new: true, runValidators: true },
    ).select("settings");

    if (!user) {
      res.status(404).json({ success: false, error: "User not found" });
      return;
    }

    res.json({ success: true, data: user.settings || { payDay: 5 } });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to update settings" });
  }
});

// PUT /api/auth/profile
authRouter.put("/profile", authMiddleware, async (req, res) => {
  try {
    const { name, email } = req.body;
    const update: Record<string, string> = {};

    if (name !== undefined) update.name = name;
    if (email !== undefined) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        res.status(400).json({ success: false, error: "Email 格式不正確" });
        return;
      }
      const existing = await UserModel.findOne({ email: email.toLowerCase().trim(), _id: { $ne: req.userId } });
      if (existing) {
        res.status(409).json({ success: false, error: "此 Email 已被使用" });
        return;
      }
      update.email = email.toLowerCase().trim();
    }

    const user = await UserModel.findByIdAndUpdate(
      req.userId,
      { $set: update },
      { new: true, runValidators: true }
    ).select("-password");

    if (!user) {
      res.status(404).json({ success: false, error: "User not found" });
      return;
    }

    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to update profile" });
  }
});

// PUT /api/auth/password
authRouter.put("/password", authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      res.status(400).json({ success: false, error: "請提供目前密碼和新密碼" });
      return;
    }
    if (newPassword.length < 6) {
      res.status(400).json({ success: false, error: "新密碼至少需要 6 個字元" });
      return;
    }

    const user = await UserModel.findById(req.userId);
    if (!user) {
      res.status(404).json({ success: false, error: "User not found" });
      return;
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      res.status(401).json({ success: false, error: "目前密碼不正確" });
      return;
    }

    user.password = newPassword;
    await user.save();

    res.json({ success: true, data: { success: true, message: "密碼已更新" } });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to change password" });
  }
});
