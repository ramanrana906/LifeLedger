import { ConflictException, Injectable } from '@nestjs/common';
import { compare, hash } from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async registerUser(email: string, password: string, name?: string) {
    const normalizedEmail = email.toLowerCase();
    const existing = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      throw new ConflictException('An account with this email already exists.');
    }

    const passwordHash = await hash(password, 12);
    const user = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        name: name?.trim() || normalizedEmail,
        passwordHash,
      },
    });

    return { id: user.id, email: user.email, name: user.name };
  }

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user || !(await compare(password, user.passwordHash))) {
      return null;
    }

    return { id: user.id, email: user.email, name: user.name };
  }
}
