import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { authMiddleware } from "../middleware/auth";
import { isToday, isYesterday } from "date-fns";
import { checkAndAwardBadges } from "../services/checkBadges";

const router = Router();
const prisma = new PrismaClient();

// 1. POST /attempts
router.post("/attempts", authMiddleware, async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).userId;
    const { questionId, selectedOption, isCorrect } = req.body;

    if (!questionId || selectedOption === undefined || isCorrect === undefined) {
      return res.status(400).json({ error: "Eksik bilgi gönderildi." });
    }

    const parsedOption = parseInt(String(selectedOption), 10);
    if (isNaN(parsedOption)) {
      return res.status(400).json({ error: "selectedOption geçerli bir sayı olmalıdır." });
    }

    const profile = await prisma.profile.findUnique({ where: { id: userId } });
    if (!profile) return res.status(404).json({ error: "Profil bulunamadı." });

    const newXp = isCorrect ? profile.xpCurrent + 10 : profile.xpCurrent;

    let newCurrentStreak = profile.currentStreak;
    const lastActive = profile.lastActiveDate;

    if (!lastActive) {
      newCurrentStreak = 1;
    } else {
      if (isToday(lastActive)) {
        newCurrentStreak = profile.currentStreak;
      } else if (isYesterday(lastActive)) {
        newCurrentStreak = profile.currentStreak + 1;
      } else {
        newCurrentStreak = 1;
      }
    }

    const newLongestStreak = Math.max(newCurrentStreak, profile.longestStreak);

    const result = await prisma.$transaction([
      prisma.attempt.create({
        data: { 
          userId, 
          questionId, 
          selectedOption: String(parsedOption), 
          isCorrect 
        }
      }),
      prisma.profile.update({
        where: { id: userId },
        data: {
          xpCurrent: newXp,
          currentStreak: newCurrentStreak,
          longestStreak: newLongestStreak,
          lastActiveDate: new Date(),
        },
        select: { xpCurrent: true, currentStreak: true, longestStreak: true }
      })
    ]);

    const newBadges = await checkAndAwardBadges(userId);

    res.status(201).json({
      message: "Cevap başarıyla kaydedildi.",
      attempt: result[0],
      profile: result[1],
      newBadges
    });

  } catch (error) {
    res.status(500).json({ error: "Cevap kaydedilirken hata oluştu." });
  }
});

// 2. GET /attempts/stats
router.get("/attempts/stats", authMiddleware, async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).userId;

    const attempts = await prisma.attempt.findMany({
      where: { userId },
      include: {
        question: { include: { deck: true } }
      }
    });

    if (attempts.length === 0) {
      return res.json({ totalAttempts: 0, totalQuestions: 0, totalCorrect: 0, totalWrong: 0, successRate: 0, byCategory: [] });
    }

    const latestAttemptsMap = new Map<string, any>();
    attempts.forEach(attempt => {
      const existing = latestAttemptsMap.get(attempt.questionId);
      if (!existing || new Date(attempt.answeredAt).getTime() > new Date(existing.answeredAt).getTime()) {
        latestAttemptsMap.set(attempt.questionId, attempt);
      }
    });

    const uniqueAttempts = Array.from(latestAttemptsMap.values());
    const toplamSoru = uniqueAttempts.length;
    const toplamDogru = uniqueAttempts.filter(a => a.isCorrect).length;
    const toplamYanlis = toplamSoru - toplamDogru;
    
    const successRate = toplamSoru > 0 ? Number(((toplamDogru / toplamSoru) * 100).toFixed(2)) : 0;

    const categoryStats: Record<string, { total: number; correct: number }> = {};

    uniqueAttempts.forEach(attempt => {
      const category = attempt.question.deck.category || "Genel";
      if (!categoryStats[category]) categoryStats[category] = { total: 0, correct: 0 };
      categoryStats[category].total += 1;
      if (attempt.isCorrect) categoryStats[category].correct += 1;
    });

    const byCategory = Object.keys(categoryStats).map(category => {
      const stats = categoryStats[category];
      return {
        category,
        successRate: stats.total > 0 ? Number(((stats.correct / stats.total) * 100).toFixed(2)) : 0
      };
    });

    res.json({ 
      totalAttempts: attempts.length, 
      totalQuestions: toplamSoru, 
      totalCorrect: toplamDogru, 
      totalWrong: toplamYanlis, 
      successRate, 
      byCategory 
    });

  } catch (error) {
    res.status(500).json({ error: "İstatistikler getirilirken hata oluştu." });
  }
});

// 3. GET /attempts/wrong
router.get("/attempts/wrong", authMiddleware, async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).userId;

    const wrongAttempts = await prisma.attempt.findMany({
      where: { userId, isCorrect: false },
      include: {
        question: {
          include: { deck: true }
        }
      }
    });

    const wrongMap: Record<string, { count: number; question: any }> = {};

    wrongAttempts.forEach(attempt => {
      const qId = attempt.questionId;
      if (!wrongMap[qId]) {
        wrongMap[qId] = { count: 0, question: attempt.question };
      }
      wrongMap[qId].count += 1;
    });

    const result = Object.values(wrongMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map(item => ({
        id: item.question.id,
        questionText: item.question.questionText,
        tag: item.question.deck.category || "Genel",
        wrongsCount: item.count,
      }));

    res.json(result);

  } catch (error) {
    res.status(500).json({ error: "Yanlış sorular getirilirken hata oluştu." });
  }
});

// 4. GET /sessions
router.get("/sessions", authMiddleware, async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).userId;

    const attempts = await prisma.attempt.findMany({
      where: { userId },
      include: {
        question: {
          include: { deck: true }
        }
      },
      orderBy: { answeredAt: "desc" },
    });

    if (attempts.length === 0) return res.json([]);

    const sessionMap: Record<string, any[]> = {};

    attempts.forEach(attempt => {
      const dateKey = new Date(attempt.answeredAt).toLocaleDateString("tr-TR", {
        day: "numeric",
        month: "long",
        year: "numeric"
      });

      if (!sessionMap[dateKey]) sessionMap[dateKey] = [];

      const existing = sessionMap[dateKey].find(
        s => s.deckId === attempt.question.deck.id
      );

      if (!existing) {
        sessionMap[dateKey].push({
          deckId: attempt.question.deck.id,
          title: attempt.question.deck.title,
          subject: attempt.question.deck.category || "Genel",
          type: "Quiz",
          subtitle: attempt.question.deck.category || "Genel",
          time: new Date(attempt.answeredAt).toLocaleTimeString("tr-TR", {
            hour: "2-digit",
            minute: "2-digit"
          }),
          score: 0,
          _corrects: 0,
          _total: 0,
        });
      }

      const session = sessionMap[dateKey].find(
        s => s.deckId === attempt.question.deck.id
      );
      if (session) {
        session._total += 1;
        if (attempt.isCorrect) session._corrects += 1;
        session.score = Math.round((session._corrects / session._total) * 100);
      }
    });

    const result = Object.entries(sessionMap).map(([date, items]) => ({
      date,
      items: items.map(({ _corrects, _total, deckId, ...rest }) => rest)
    }));

    res.json(result);

  } catch (error) {
    res.status(500).json({ error: "Çalışma geçmişi getirilirken hata oluştu." });
  }
});

export default router;