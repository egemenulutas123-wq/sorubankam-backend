import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export const authMiddleware = (req: Request, res: Response, next: NextFunction): any => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Erişim reddedildi. Token eksik." });
  }

  const token = authHeader.split(" ")[1];

  try {
    // Token'ı doğruluyoruz
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
    
    // TypeScript'i susturduğumuz o sihirli satır:
    (req as any).userId = decoded.id;
    
    next();
  } catch (error) {
    return res.status(401).json({ error: "Geçersiz veya süresi dolmuş token." });
  }
};