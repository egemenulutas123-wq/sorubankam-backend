import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const router = Router();
const prisma = new PrismaClient();

// --- KAYIT OLMA (REGISTER) ENDPOINT'İ ---
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, username } = req.body;

    if (!email || !password || !username) {
      res.status(400).json({ error: 'Email, password ve username alanları zorunludur.' });
      return;
    }

    const existingProfile = await prisma.profile.findFirst({
      where: {
        OR: [
          { email },
          { username }
        ]
      }
    });

    if (existingProfile) {
      res.status(409).json({ error: 'Bu email veya kullanıcı adı zaten kullanımda.' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newProfile = await prisma.profile.create({
      data: {
        email,
        username,
        password: hashedPassword,
      },
    });

    const jwtSecret = process.env.JWT_SECRET;
    
    if (!jwtSecret) {
      res.status(500).json({ error: 'Sunucu konfigürasyon hatası (JWT_SECRET eksik).' });
      return;
    }

    const token = jwt.sign(
      { id: newProfile.id, email: newProfile.email },
      jwtSecret,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Kullanıcı başarıyla oluşturuldu.',
      token,
      profile: {
        id: newProfile.id,
        email: newProfile.email,
        username: newProfile.username,
        fullName: newProfile.fullName,
        xpCurrent: newProfile.xpCurrent
      }
    });
  } catch (error: any) {
    console.log("🔥 İŞTE GERÇEK HATA (REGISTER):", error);
    res.status(500).json({ 
        error: 'Sunucu tarafında bir hata oluştu.',
        detay: error.message || String(error)
    });
  }
});

// --- GİRİŞ YAPMA (LOGIN) ENDPOINT'İ ---
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email ve password alanları zorunludur.' });
      return;
    }

    const profile = await prisma.profile.findUnique({
      where: { email }
    });

    if (!profile) {
      res.status(401).json({ error: 'Geçersiz email veya şifre.' });
      return;
    }

    const isPasswordValid = await bcrypt.compare(password, profile.password);

    if (!isPasswordValid) {
      res.status(401).json({ error: 'Geçersiz email veya şifre.' });
      return;
    }

    const jwtSecret = process.env.JWT_SECRET;
    
    if (!jwtSecret) {
      res.status(500).json({ error: 'Sunucu konfigürasyon hatası (JWT_SECRET eksik).' });
      return;
    }

    const token = jwt.sign(
      { id: profile.id, email: profile.email },
      jwtSecret,
      { expiresIn: '7d' }
    );

    res.status(200).json({
      message: 'Giriş başarılı.',
      token,
      profile: {
        id: profile.id,
        email: profile.email,
        username: profile.username,
        fullName: profile.fullName,
        xpCurrent: profile.xpCurrent
      }
    });
  } catch (error: any) {
    console.log("🔥 İŞTE GERÇEK HATA (LOGIN):", error);
    res.status(500).json({ 
        error: 'Sunucu tarafında bir hata oluştu.',
        detay: error.message || String(error)
    });
  }
});

export default router;