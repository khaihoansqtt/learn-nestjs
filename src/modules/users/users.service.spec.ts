import { ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryFailedError } from 'typeorm';
import { verifyPassword } from './password.util.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { ListUsersDto } from './dto/list-users.dto.js';
import { UsersService } from './users.service.js';
import { User } from './user.entity.js';

// Mock thuần — không đụng DB (unit test phải chạy dưới 1s, không cần Docker).
// Integration với DB thật nằm ở e2e (test/users.e2e-spec.ts).
function createQbMock() {
  const qb = {
    withDeleted: vi.fn(),
    andWhere: vi.fn(),
    orderBy: vi.fn(),
    skip: vi.fn(),
    take: vi.fn(),
    getManyAndCount: vi.fn().mockResolvedValue([[], 0]),
  };
  // Các method builder trả về chính nó để nối chuỗi.
  qb.withDeleted.mockReturnValue(qb);
  qb.andWhere.mockReturnValue(qb);
  qb.orderBy.mockReturnValue(qb);
  qb.skip.mockReturnValue(qb);
  qb.take.mockReturnValue(qb);
  return qb;
}

describe('UsersService', () => {
  let repo: {
    findOne: ReturnType<typeof vi.fn>;
    createQueryBuilder: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    softDelete: ReturnType<typeof vi.fn>;
    restore: ReturnType<typeof vi.fn>;
  };
  let qb: ReturnType<typeof createQbMock>;
  let service: UsersService;

  beforeEach(() => {
    qb = createQbMock();
    repo = {
      findOne: vi.fn().mockResolvedValue(null),
      createQueryBuilder: vi.fn().mockReturnValue(qb),
      create: vi.fn().mockImplementation((x: Partial<User>) => x),
      save: vi.fn().mockImplementation(async (x: Partial<User>) => x),
      softDelete: vi.fn().mockResolvedValue({ affected: 1 }),
      restore: vi.fn().mockResolvedValue({ affected: 1 }),
    };
    service = new UsersService(repo as never);
  });

  describe('findAll (phân trang)', () => {
    it('page=2 limit=10 -> skip 10, take 10, sắp xếp createdAt DESC', async () => {
      const query = Object.assign(new ListUsersDto(), {
        page: 2,
        limit: 10,
      });
      await service.findAll(query);

      expect(qb.skip).toHaveBeenCalledWith(10);
      expect(qb.take).toHaveBeenCalledWith(10);
      expect(qb.orderBy).toHaveBeenCalledWith('user.createdAt', 'DESC');
    });

    it('tính totalPages từ total', async () => {
      qb.getManyAndCount.mockResolvedValue([[], 25]);
      const result = await service.findAll(new ListUsersDto());
      expect(result).toMatchObject({
        total: 25,
        page: 1,
        limit: 10,
        totalPages: 3,
      });
    });

    it('includeDeleted=true -> withDeleted()', async () => {
      const query = Object.assign(new ListUsersDto(), {
        includeDeleted: true,
      });
      await service.findAll(query);
      expect(qb.withDeleted).toHaveBeenCalled();
    });

    it('q -> WHERE ILIKE trên email và fullName (parameterized, không nối string)', async () => {
      const query = Object.assign(new ListUsersDto(), { q: 'khai' });
      await service.findAll(query);

      const [sql, params] = qb.andWhere.mock.calls[0] as [string, object];
      expect(sql).toContain('user.email ILIKE :q');
      expect(sql).toContain('user.fullName ILIKE :q');
      expect(params).toEqual({ q: '%khai%' });
    });
  });

  describe('findOne', () => {
    it('không thấy -> NotFoundException', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findOne('id-x')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('thấy -> trả user', async () => {
      const user = { id: 'id-1', email: 'a@b.c' };
      repo.findOne.mockResolvedValue(user);
      await expect(service.findOne('id-1')).resolves.toBe(user);
    });
  });

  describe('create', () => {
    const dto: CreateUserDto = {
      email: 'khai@shop.dev',
      password: 'MatKhau@123',
      fullName: 'Khai Hoan',
    };

    it('lưu passwordHash đã hash, KHÔNG giữ plaintext', async () => {
      repo.save.mockImplementation(async (x: Partial<User>) => x);

      const saved = await service.create(dto);

      expect(repo.create).toHaveBeenCalled();
      expect(saved.passwordHash).not.toBe(dto.password);
      expect(saved.passwordHash).toMatch(/^scrypt\$/);
      expect(verifyPassword(dto.password, saved.passwordHash!)).toBe(true);
    });

    it('email trùng -> ConflictException 409', async () => {
      repo.findOne.mockResolvedValue({ id: 'existing' });
      await expect(service.create(dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('race 23505 (check trước không chặn kịp) vẫn thành 409', async () => {
      repo.findOne.mockResolvedValue(null); // check trước: không thấy
      repo.save.mockRejectedValue(
        new QueryFailedError('INSERT...', [], Object.assign(new Error('dup'), { code: '23505' })),
      );
      await expect(service.create(dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('lỗi DB khác 23505 thì NÉM RA, không nuốt thành 409', async () => {
      repo.findOne.mockResolvedValue(null);
      repo.save.mockRejectedValue(
        new QueryFailedError('INSERT...', [], Object.assign(new Error('fk'), { code: '23503' })),
      );
      await expect(service.create(dto)).rejects.toBeInstanceOf(
        QueryFailedError,
      );
    });
  });

  describe('remove / restore (soft-delete)', () => {
    it('remove -> softDelete (UPDATE deletedAt), KHÔNG xóa cứng', async () => {
      repo.findOne.mockResolvedValue({ id: 'id-1' });
      await service.remove('id-1');
      expect(repo.softDelete).toHaveBeenCalledWith({ id: 'id-1' });
    });

    it('remove user đã xóa mềm -> 404 (findOne tự lọc deletedAt)', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.remove('id-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(repo.softDelete).not.toHaveBeenCalled();
    });

    it('restore idempotent: chưa xóa thì không gọi restore', async () => {
      repo.findOne.mockResolvedValue({ id: 'id-1', deletedAt: null });
      await service.restore('id-1');
      expect(repo.restore).not.toHaveBeenCalled();
    });

    it('restore bản đã xóa -> gọi restore rồi ĐỌC LẠI từ DB (không trả object cũ)', async () => {
      const stale = { id: 'id-1', deletedAt: new Date('2026-01-01') };
      const fresh = { id: 'id-1', deletedAt: null };
      repo.findOne
        .mockResolvedValueOnce(stale) // lần 1: withDeleted -> thấy bản đã xóa
        .mockResolvedValueOnce(fresh); // lần 2: đọc lại sau restore
      const result = await service.restore('id-1');
      expect(repo.restore).toHaveBeenCalledWith({ id: 'id-1' });
      expect(repo.findOne).toHaveBeenCalledTimes(2);
      expect(result).toBe(fresh);
    });
  });

  describe('normalize + escape (review M1-M4)', () => {
    it('create chuẩn hóa email hoa/thừa khoảng trắng trước khi lưu', async () => {
      await service.create({
        email: '  KHAI@Shop.Dev ',
        password: 'MatKhau@123',
        fullName: '  Khai Hoan  ',
      });
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'khai@shop.dev',
          fullName: 'Khai Hoan',
        }),
      );
    });

    it('create check trùng bằng email ĐÃ normalize', async () => {
      repo.findOne.mockResolvedValue(null);
      await service.create({
        email: 'A@X.COM',
        password: 'MatKhau@123',
        fullName: 'Ab',
      });
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { email: 'a@x.com' },
      });
    });

    it("q chứa '%' '_' -> escape, không match tất cả", async () => {
      const query = Object.assign(new ListUsersDto(), { q: '100%_x' });
      await service.findAll(query);
      const [, params] = qb.andWhere.mock.calls[0] as [string, object];
      expect(params).toEqual({ q: '%100\\%\\_x%' });
    });

    it('update isActive=false (khóa tài khoản không cần xóa)', async () => {
      const user = { id: 'id-1', email: 'a@b.c', isActive: true };
      repo.findOne.mockResolvedValue(user);
      const saved = await service.update('id-1', { isActive: false });
      expect(saved.isActive).toBe(false);
    });
  });
});
