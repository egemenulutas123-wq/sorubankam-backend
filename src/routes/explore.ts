import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const router = Router();
const prisma = new PrismaClient();

// 1. GET /explore/leaderboard - En çok XP'ye sahip 20 kullanıcıyı getir
router.get("/leaderboard", async (req: Request, res: Response): Promise<void> => {
  try {
    const topUsers = await prisma.profile.findMany({
      take: 20,
      orderBy: { xpCurrent: "desc" }, // Puanı en yüksek olan en üstte
      select: { 
        id: true, 
        username: true, 
        fullName: true, 
        xpCurrent: true, 
        currentStreak: true 
      }
    });
    res.json(topUsers);
  } catch (error) {
    res.status(500).json({ error: "Liderlik tablosu getirilemedi." });
  }
});

// 2. GET /explore/search - Herkese açık destelerde arama yap
router.get("/search", async (req: Request, res: Response): Promise<void> => {
  try {
    const query = req.query.q as string;
    
    if (!query) {
      res.status(400).json({ error: "Lütfen bir arama kelimesi girin. (Örn: ?q=matematik)" });
      return;
    }

    const decks = await prisma.deck.findMany({
      where: {
        isPublic: true, // Sadece herkese açık desteler bulunsun
        OR: [
          { title: { contains: query, mode: "insensitive" } }, // Başlıkta ara (büyük/küçük harf duyarsız)
          { category: { contains: query, mode: "insensitive" } } // Kategoride ara
        ]
      },
      include: { 
        author: { select: { username: true } },
        _count: { select: { questions: true } } // Destenin kaç sorusu olduğunu da gönderelim
      },
      orderBy: { createdAt: "desc" }
    });

    res.json(decks);
  } catch (error) {
    res.status(500).json({ error: "Arama yapılırken hata oluştu." });
  }
});

export default router;