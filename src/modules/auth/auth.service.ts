import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ChangePasswordDto } from './dto/change-password.dto';
import { generateTokens } from 'src/common';
import { LoginDto } from './dto/login.dto';
import { PrismaService } from 'src/prisma';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });

    if (!user || user.deletedAt)
      throw new UnauthorizedException("Username yoki parol noto'g'ri");

    if (!user.isActive)
      throw new UnauthorizedException('Kechirasiz siz bloklangansiz');

    const passwordMatch = await bcrypt.compare(dto.password, user.passwordHash);

    if (!passwordMatch) {
      throw new UnauthorizedException("Username yoki parol noto'g'ri");
    }

    const tokens = await generateTokens(
      this.jwtService,
      user.id,
      user.username,
      user.role,
    );
    await this.saveRefreshToken(user.id, tokens.refreshToken);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        departmentId: user.departmentId,
      },
    };
  }

  async logout(refreshToken: string, userId: string) {
    const tokens = await this.prisma.refreshToken.findMany({
      where: { userId, revokedAt: null },
    });

    for (const token of tokens) {
      const match = await bcrypt.compare(refreshToken, token.tokenHash);
      if (match) {
        await this.prisma.refreshToken.update({
          where: { id: token.id },
          data: { revokedAt: new Date() },
        });
        break;
      }
    }

    return { message: 'Tizimdan muvaffaqiyatli chiqdingiz' };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) throw new UnauthorizedException('Foydalanuvchi topilmadi');

    const match = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!match) {
      throw new BadRequestException("Joriy parol noto'g'ri");
    }

    const newHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return { message: "Parol muvaffaqiyatli o'zgartirildi" };
  }

  async refresh(
    userId: string,
    refreshTokenId: string,
    username: string,
    role: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, deletedAt: null, isActive: true },
    });
    if (!user) {
      throw new UnauthorizedException(
        "Foydalanuvchi bloklangan yoki o'chirilgan",
      );
    }

    const tokens = await generateTokens(
      this.jwtService,
      user.id,
      user.username,
      user.role,
    );

    await this.prisma.refreshToken.update({
      where: { id: refreshTokenId },
      data: { revokedAt: new Date() },
    });

    await this.saveRefreshToken(userId, tokens.refreshToken);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  private async saveRefreshToken(userId: string, token: string) {
    const tokenHash = await bcrypt.hash(token, 10);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await this.prisma.refreshToken.create({
      data: { userId, tokenHash, expiresAt },
    });
  }
}
