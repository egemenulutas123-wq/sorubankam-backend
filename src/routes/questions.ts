import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { authMiddleware } from "../middleware/auth";

const router = Router();
const prisma = new PrismaClient();

// 1. GET /decks/:deckId/questions - Bir destenin tüm sorularını ve şıklarını getir
router.get("/decks/:deckId/questions", authMiddleware, async (req: Request, res: Response): Promise<any> => {
  try {
    const questions = await prisma.question.findMany({
      where: { deckId: req.params.deckId },
      include: { options: true }
    });
    res.json(questions);
  } catch (error) {
    res.status(500).json({ error: "Sorular getirilirken hata oluştu." });
  }
});

// 2. POST /questions - Yeni soru ekle (Soru ve şıkları tek seferde oluşturur)
router.post("/questions", authMiddleware, async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).userId;
    const { deckId, questionText, options, correctOptionIndex } = req.body;

    // Destenin sahibini kontrol et
    const deck = await prisma.deck.findUnique({ where: { id: deckId } });
    if (!deck) return res.status(404).json({ error: "Deste bulunamadı." });
    if (deck.authorId !== userId) return res.status(403).json({ error: "Bu desteye soru ekleme yetkiniz yok." });

    // Soru ve şıkları aynı anda veritabanına kaydet
    const newQuestion = await prisma.question.create({
      data: {
        questionText,
        correctOptionIndex,
        deckId,
        options: {
          create: options.map((text: string) => ({ text }))
        }
      },
      include: { options: true }
    });

    res.status(201).json({ message: "Soru başarıyla eklendi.", question: newQuestion });
  } catch (error) {
    res.status(500).json({ error: "Soru eklenemedi." });
  }
});

// 3. DELETE /questions/:id - Soruyu sil
router.delete("/questions/:id", authMiddleware, async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).userId;
    const questionId = req.params.id;

    // Önce soruyu ve bağlı olduğu desteyi bul
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: { deck: true }
    });

    if (!question) return res.status(404).json({ error: "Soru bulunamadı." });
    if (question.deck.authorId !== userId) return res.status(403).json({ error: "Bu soruyu silme yetkiniz yok." });

    await prisma.question.delete({ where: { id: questionId } });
    res.json({ message: "Soru başarıyla silindi." });
  } catch (error) {
    res.status(500).json({ error: "Soru silinemedi." });
  }
});

export default router;