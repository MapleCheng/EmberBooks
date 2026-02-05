import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

interface JwtPayload {
  userId: string;
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  // 1. Check API Key
  const apiKey = req.headers["x-api-key"] as string | undefined;
  if (apiKey) {
    const expectedKey = process.env.API_KEY;
    const apiUserId = process.env.API_USER_ID;
    if (expectedKey && apiKey === expectedKey && apiUserId) {
      req.userId = apiUserId;
      return next();
    }
    res.status(401).json({ success: false, error: "Invalid API key" });
    return;
  }

  // 2. Check JWT Bearer token
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      res.status(500).json({ success: false, error: "JWT secret not configured" });
      return;
    }
    try {
      const decoded = jwt.verify(token, secret) as JwtPayload;
      req.userId = decoded.userId;
      return next();
    } catch {
      res.status(401).json({ success: false, error: "Invalid or expired token" });
      return;
    }
  }

  // 3. No auth provided
  res.status(401).json({ success: false, error: "Unauthorized" });
}
