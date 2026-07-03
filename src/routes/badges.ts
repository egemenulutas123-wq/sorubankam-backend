import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { authMiddleware } from "../middleware/auth";

const router = Router();
const prisma = new PrismaClient();

// 1. GET /badges - Tüm rozetleri listele (Kullanıcının kazanıp kazanmadığı bilgisiyle)
router.get("/badges", authMiddleware, async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).userId;
    const allBadges = await prisma.badge.findMany();
    
    const userBadges = await prisma.userBadge.findMany({
      where: { userId }
    });
    const earnedBadgeIds = userBadges.map(ub => ub.badgeId);

    const badgesWithStatus = allBadges.map(badge => ({
      ...badge,
      earned: earnedBadgeIds.includes(badge.id)
    }));

    res.json(badgesWithStatus);
  } catch (error) {
    res.status(500).json({ error: "Rozetler getirilirken hata oluştu." });
  }
});

// 2. GET /badges/earned - Sadece kazanılan rozetleri listele
router.get("/badges/earned", authMiddleware, async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).userId;
    const earnedBadges = await prisma.userBadge.findMany({
      where: { userId },
      include: { badge: true },
      orderBy: { earnedAt: "desc" }
    });

    res.json(earnedBadges.map(ub => ({ ...ub.badge, earnedAt: ub.earnedAt })));
  } catch (error) {
    res.status(500).json({ error: "Kazanılan rozetler getirilirken hata oluştu." });
  }
});

export default router;