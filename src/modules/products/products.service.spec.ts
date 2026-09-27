import { ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryFailedError } from 'typeorm';
import { ListProductsDto } from './dto/list-products.dto.js';
import { ProductsService } from './products.service.js';

function createQbMock() {
  const qb = {
    leftJoinAndSelect: vi.fn(),
    withDeleted: vi.fn(),
    andWhere: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    skip: vi.fn(),
    take: vi.fn(),
    getOne: vi.fn().mockResolvedValue(null),
    getManyAndCount: vi.fn().mockResolvedValue([[], 0]),
  };
  qb.leftJoinAndSelect.mockReturnValue(qb);
  qb.withDeleted.mockReturnValue(qb);
  qb.andWhere.mockReturnValue(qb);
  qb.where.mockReturnValue(qb);
  qb.orderBy.mockReturnValue(qb);
  qb.skip.mockReturnValue(qb);
  qb.take.mockReturnValue(qb);
  return qb;
}

describe('ProductsService', () => {
  let repo: {
    createQueryBuilder: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    softDelete: ReturnType<typeof vi.fn>;
    restore: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
  };
  let categories: { findOne: ReturnType<typeof vi.fn> };
  let qb: ReturnType<typeof createQbMock>;
  let service: ProductsService;

  beforeEach(() => {
    qb = createQbMock();
    repo = {
      createQueryBuilder: vi.fn().mockReturnValue(qb),
      create: vi.fn().mockImplementation((x: object) => x),
      save: vi.fn().mockImplementation(async (x: object) => x),
      softDelete: vi.fn().mockResolvedValue({ affected: 1 }),
      restore: vi.fn().mockResolvedValue({ affected: 1 }),
      findOne: vi.fn().mockResolvedValue(null),
    };
    categories = { findOne: vi.fn().mockResolvedValue({ id: 'cat-1' }) };
    service = new ProductsService(repo as never, categories as never);
  });

  describe('findAll (chống N+1)', () => {
    it('luôn JOIN category trong CÙNG query (không query lẻ từng dòng)', async () => {
      await service.findAll(new ListProductsDto());
      expect(qb.leftJoinAndSelect).toHaveBeenCalledWith(
        'product.category',
        'category',
      );
    });

    it('filter giá + tồn kho + category thành WHERE', async () => {
      const query = Object.assign(new ListProductsDto(), {
        minPrice: 100,
        maxPrice: 500,
        inStock: true,
        categoryId: 'cat-1',
      });
      await service.findAll(query);
      const wheres = qb.andWhere.mock.calls.map((c) => (c as string[])[0]);
      expect(wheres.some((w) => w.includes('product.price >='))).toBe(true);
      expect(wheres.some((w) => w.includes('product.price <='))).toBe(true);
      expect(wheres.some((w) => w.includes('product.stock > 0'))).toBe(true);
      expect(wheres.some((w) => w.includes('product.categoryId ='))).toBe(true);
    });
  });

  describe('create', () => {
    it('category không tồn tại -> 404 trước khi insert', async () => {
      categories.findOne.mockRejectedValue(
        new NotFoundException('category nope không tồn tại'),
      );
      await expect(
        service.create({
          name: 'X',
          price: 10,
          categoryId: 'nope',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('trùng slug -> 409', async () => {
      repo.save.mockRejectedValue(
        new QueryFailedError(
          'INSERT...',
          [],
          Object.assign(new Error('dup'), { code: '23505' }),
        ),
      );
      await expect(
        service.create({ name: 'X', price: 10, categoryId: 'cat-1' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('FK race (category bị xóa giữa chừng) 23503 -> 404', async () => {
      repo.save.mockRejectedValue(
        new QueryFailedError(
          'INSERT...',
          [],
          Object.assign(new Error('fk'), { code: '23503' }),
        ),
      );
      await expect(
        service.create({ name: 'X', price: 10, categoryId: 'cat-1' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('create thành công trả shape đã JOIN category (re-fetch sau save)', async () => {
      const joined = { id: 'p9', slug: 'x', category: { id: 'cat-1' } };
      repo.save.mockResolvedValue({ id: 'p9' });
      qb.getOne.mockResolvedValue(joined);
      const res = await service.create({
        name: 'X',
        price: 10,
        categoryId: 'cat-1',
      });
      expect(res).toBe(joined);
    });
  });

  describe('update', () => {
    it('rename không đổi slug (re-fetch trả đúng object đã mutate)', async () => {
      const stored = { id: 'p1', slug: 'cu', categoryId: 'cat-1', name: 'Cu' };
      qb.getOne.mockResolvedValue(stored); // findOne đầu + re-fetch sau save
      const kept = await service.update('p1', { name: 'Moi' });
      expect(kept.slug).toBe('cu');
      expect(kept.name).toBe('Moi');
    });

    it('gửi slug mới thì đổi (slugify)', async () => {
      const stored = { id: 'p1', slug: 'cu', categoryId: 'cat-1' };
      qb.getOne.mockResolvedValue(stored);
      const changed = await service.update('p1', { slug: 'Moi Tot' });
      expect(changed.slug).toBe('moi-tot');
    });
  });
});
