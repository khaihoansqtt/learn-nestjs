import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryFailedError } from 'typeorm';
import { CategoriesService } from './categories.service.js';
import { ListCategoriesDto } from './dto/list-categories.dto.js';

function createQbMock() {
  const qb = {
    andWhere: vi.fn(),
    orderBy: vi.fn(),
    skip: vi.fn(),
    take: vi.fn(),
    getManyAndCount: vi.fn().mockResolvedValue([[], 0]),
  };
  qb.andWhere.mockReturnValue(qb);
  qb.orderBy.mockReturnValue(qb);
  qb.skip.mockReturnValue(qb);
  qb.take.mockReturnValue(qb);
  return qb;
}

function uniqueErr() {
  return new QueryFailedError(
    'INSERT...',
    [],
    Object.assign(new Error('dup'), { code: '23505' }),
  );
}

describe('CategoriesService', () => {
  let repo: {
    find: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    createQueryBuilder: ReturnType<typeof vi.fn>;
  };
  let productRepo: { count: ReturnType<typeof vi.fn> };
  let qb: ReturnType<typeof createQbMock>;
  let service: CategoriesService;

  beforeEach(() => {
    qb = createQbMock();
    repo = {
      find: vi.fn().mockResolvedValue([]),
      findOne: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockImplementation((x: object) => x),
      save: vi.fn().mockImplementation(async (x: object) => x),
      delete: vi.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: vi.fn().mockReturnValue(qb),
    };
    productRepo = { count: vi.fn().mockResolvedValue(0) };
    const ds = { getRepository: vi.fn().mockReturnValue(productRepo) };
    service = new CategoriesService(repo as never, ds as never);
  });

  describe('tree', () => {
    it('1 query duy nhất, lồng đúng cha-con-cháu', async () => {
      repo.find.mockResolvedValue([
        { id: 'root', name: 'Gốc', slug: 'goc', description: null, parentId: null },
        { id: 'child', name: 'Con', slug: 'con', description: null, parentId: 'root' },
        { id: 'grand', name: 'Cháu', slug: 'chau', description: null, parentId: 'child' },
        { id: 'orphan', name: 'Mồ côi', slug: 'mo-coi', description: null, parentId: 'missing' },
      ]);
      const tree = await service.tree();
      expect(repo.find).toHaveBeenCalledTimes(1);
      expect(tree.map((n) => n.id).sort()).toEqual(['orphan', 'root']);
      const root = tree.find((n) => n.id === 'root')!;
      expect(root.children.map((n) => n.id)).toEqual(['child']);
      expect(root.children[0].children.map((n) => n.id)).toEqual(['grand']);
    });
  });

  describe('create', () => {
    it('tự sinh slug từ name tiếng Việt', async () => {
      await service.create({ name: 'Điện Thoại' });
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ slug: 'dien-thoai' }),
      );
    });

    it('tên không slug hóa được -> 400', async () => {
      await expect(service.create({ name: '!!!' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('parentId không tồn tại -> 404', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(
        service.create({ name: 'Con', parentId: 'nope' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('trùng slug -> 409', async () => {
      repo.save.mockRejectedValue(uniqueErr());
      await expect(service.create({ name: 'Gốc' })).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('update', () => {
    it('tự làm cha chính mình -> 400', async () => {
      repo.findOne.mockResolvedValue({ id: 'a', parentId: null });
      await expect(service.update('a', { parentId: 'a' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('tạo vòng lặp A->B->A -> 400', async () => {
      repo.findOne.mockImplementation(async ({ where: { id } }: never) => {
        if ((id as string) === 'a') return { id: 'a', parentId: null };
        if ((id as string) === 'b') return { id: 'b', parentId: 'a' };
        return null;
      });
      await expect(service.update('a', { parentId: 'b' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rename không tự đổi slug', async () => {
      const cat = { id: 'a', name: 'Cu', slug: 'cu', parentId: null };
      repo.findOne.mockResolvedValue(cat);
      const saved = await service.update('a', { name: 'Moi' });
      expect(saved.slug).toBe('cu');
      expect(saved.name).toBe('Moi');
    });
  });

  describe('remove', () => {
    it('còn con -> 409, không gọi delete', async () => {
      repo.findOne.mockResolvedValue({ id: 'a' });
      repo.count.mockResolvedValue(2);
      await expect(service.remove('a')).rejects.toBeInstanceOf(ConflictException);
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('còn product -> 409', async () => {
      repo.findOne.mockResolvedValue({ id: 'a' });
      repo.count.mockResolvedValue(0);
      productRepo.count.mockResolvedValue(3);
      await expect(service.remove('a')).rejects.toBeInstanceOf(ConflictException);
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('trống -> xóa cứng', async () => {
      repo.findOne.mockResolvedValue({ id: 'a' });
      await service.remove('a');
      expect(repo.delete).toHaveBeenCalledWith({ id: 'a' });
    });
  });

  describe('findAll', () => {
    it('q escape LIKE đặc biệt', async () => {
      const query = Object.assign(new ListCategoriesDto(), { q: '50%_x' });
      await service.findAll(query);
      const [, params] = qb.andWhere.mock.calls[0] as [string, object];
      expect(params).toEqual({ q: '%50\\%\\_x%' });
    });
  });
});
