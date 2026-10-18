
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const COOKIE_NAME = "cga_session";

export interface AuthenticatedRequest extends Request {
  userId?: string;
}

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const token = req.cookies?.[COOKIE_NAME];
  const secret = process.env.JWT_SECRET;

  // Ensure the authentication secret is configured.
  if (!secret) {
    return res.status(500).json({
      error: "Authentication is not configured.",
    });
  }

  // Reject requests without a valid session cookie.
  if (typeof token !== "string" || !token) {
    return res.status(401).json({
      error: "Please sign in.",
    });
  }

  try {
    const payload = jwt.verify(token, secret, {
      issuer: "cholo-ghure-asi",
    });

    // Ensure the JWT contains a valid user ID.
    if (
      typeof payload === "string" ||
      typeof payload.sub !== "string" ||
      !payload.sub
    ) {
      return res.status(401).json({
        error: "Invalid session.",
      });
    }

    // Attach the authenticated user's ID to the request.
    (req as AuthenticatedRequest).userId = payload.sub;

    return next();
  } catch {
    return res.status(401).json({
      error: "Your session has expired. Please sign in again.",
    });
  }
}
