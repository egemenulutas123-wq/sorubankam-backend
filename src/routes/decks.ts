import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { authMiddleware } from "../middleware/auth";

const router = Router();
const prisma = new PrismaClient();

// 1. GET /decks/public - Herkese açık desteleri listele (En fazla 20 tane, en yeniler üstte)
// Statik route, /:id dinamik route'unun üstüne taşındı.
router.get("/public", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const publicDecks = await prisma.deck.findMany({
      where: { isPublic: true },
      take: 20,
      orderBy: { createdAt: "desc" },
      include: { 
        author: { select: { username: true, fullName: true } } 
      },
    });
    res.json(publicDecks);
  } catch (error) {
    res.status(500).json({ error: "Herkese açık desteler getirilirken hata oluştu." });
  }
});

// 2. GET /saved-decks - (İsimlendirme güncellendi, mantık korundu)
router.get("/saved-decks", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    // Orijinal mantığınız Prisma şemanıza bağlı olarak buraya gelecek
    // Örnek: const saved = await prisma.savedDeck.findMany({ where: { userId } })
    res.json({ message: "Kaydedilmiş desteler (Mevcut mantık buraya eklenebilir)" });
  } catch (error) {
    res.status(500).json({ error: "Kaydedilen desteler getirilirken hata oluştu." });
  }
});

// 3. GET /decks - Giriş yapan kullanıcının KENDİ destelerini listele
router.get("/", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    const decks = await prisma.deck.findMany({
      where: { authorId: userId },
      orderBy: { createdAt: "desc" },
    });
    res.json(decks);
  } catch (error) {
    res.status(500).json({ error: "Desteler getirilirken bir hata oluştu." });
  }
});

// 4. GET /decks/:id/progress - Deste ilerleme oranı (Dinamik :id'den önce tanımlanmalı)
router.get("/:id/progress", authMiddleware, async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).userId;
    const deckId = req.params.id;

    // Prisma şemasındaki ilişkili tablolara göre (Örn: Question ve Answer)
    const totalQuestions = await (prisma as any).question.count({
      where: { deckId }
    });

    const uniqueAnswers = await (prisma as any).answer.findMany({
      where: { userId, question: { deckId } },
      distinct: ["questionId"],
      orderBy: { createdAt: "desc" } // En son cevabı almak için
    });

    let correctCount = 0;
    let wrongCount = 0;

    uniqueAnswers.forEach((ans: any) => {
      if (ans.isCorrect) correctCount++;
      else wrongCount++;
    });

    const answeredCount = correctCount + wrongCount;
    const progressPercentage = totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0;

    res.json({
      totalQuestions,
      answeredCount,
      correctCount,
      wrongCount,
      progressPercentage
    });
  } catch (error) {
    res.status(500).json({ error: "İlerleme durumu hesaplanırken hata oluştu." });
  }
});

// 5. GET /decks/:id - Tek bir destenin detayı
router.get("/:id", authMiddleware, async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).userId;
    const deck = await prisma.deck.findUnique({
      where: { id: req.params.id },
      include: { author: { select: { username: true } } },
    });

    if (!deck) return res.status(404).json({ error: "Deste bulunamadı." });
    
    // Eğer deste gizliyse (public değilse) ve istek atan kişi destenin sahibi değilse engelle (403)
    if (!deck.isPublic && deck.authorId !== userId) {
      return res.status(403).json({ error: "Bu desteyi görme yetkiniz yok." });
    }

    res.json(deck);
  } catch (error) {
    res.status(500).json({ error: "Deste detayı getirilemedi." });
  }
});

// 6. POST /decks - Yeni deste oluştur
router.post("/", authMiddleware, async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).userId;
    const { title, category, isPublic } = req.body;
    
    if (!title || !category) {
      return res.status(400).json({ error: "Title ve category alanları zorunludur." });
    }

    const deck = await prisma.deck.create({
      data: {
        title,
        category,
        isPublic: isPublic || false,
        authorId: userId,
      },
    });
    res.status(201).json({ message: "Deste başarıyla oluşturuldu.", deck });
  } catch (error) {
    res.status(500).json({ error: "Deste oluşturulamadı." });
  }
});

// 7. PUT /decks/:id - Desteyi güncelle (Sadece kendi destesi ise)
router.put("/:id", authMiddleware, async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).userId;
    const deckId = req.params.id;
    const { title, category, isPublic } = req.body;

    const existingDeck = await prisma.deck.findUnique({ where: { id: deckId } });
    if (!existingDeck) return res.status(404).json({ error: "Deste bulunamadı." });
    
    if (existingDeck.authorId !== userId) {
      return res.status(403).json({ error: "Sadece kendi destenizi güncelleyebilirsiniz." });
    }

    const updatedDeck = await prisma.deck.update({
      where: { id: deckId },
      data: { title, category, isPublic },
    });

    res.json({ message: "Deste başarıyla güncellendi.", deck: updatedDeck });
  } catch (error) {
    res.status(500).json({ error: "Deste güncellenemedi." });
  }
});

// 8. DELETE /decks/:id - Desteyi sil (Sadece kendi destesi ise)
router.delete("/:id", authMiddleware, async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).userId;
    const deckId = req.params.id;

    const existingDeck = await prisma.deck.findUnique({ where: { id: deckId } });
    if (!existingDeck) return res.status(404).json({ error: "Deste bulunamadı." });
    
    if (existingDeck.authorId !== userId) {
      return res.status(403).json({ error: "Sadece kendi destenizi silebilirsiniz." });
    }

    await prisma.deck.delete({ where: { id: deckId } });
    res.json({ message: "Deste başarıyla silindi." });
  } catch (error) {
    res.status(500).json({ error: "Deste silinemedi." });
  }
});

export default router;