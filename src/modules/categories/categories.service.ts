import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { escapeLike } from '../../common/utils/escape-like.util.js';
import { isUniqueViolation } from '../../common/utils/postgres-error.util.js';
import { slugify } from '../../common/utils/slugify.util.js';
import { Product } from '../products/product.entity.js';
import { Category } from './category.entity.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { ListCategoriesDto } from './dto/list-categories.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';
import type { Page } from '../users/users.service.js';

// Node cây trả về cho GET /categories/tree — entity phẳng + children lồng nhau.
// Dùng interface riêng thay vì trả entity có children relation: relation children
// LAZY nên entity gốc không có sẵn, build tường minh thì type tường minh.
export interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  children: CategoryNode[];
}

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly repo: Repository<Category>,
    // DataSource (@Global) để đếm product theo category mà KHÔNG import
    // ProductsModule (tránh circular Categories <-> Products).
    private readonly dataSource: DataSource,
  ) {}

  async findAll(query: ListCategoriesDto): Promise<Page<Category>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const qb = this.repo.createQueryBuilder('category');
    if (query.q) {
      qb.andWhere('(category.name ILIKE :q OR category.slug ILIKE :q)', {
        q: `%${escapeLike(query.q)}%`,
      });
    }
    qb.orderBy('category.name', 'ASC').skip((page - 1) * limit).take(limit);
    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // Build cây trong memory từ 1 query find() (2 query cho cả cây dù sâu mấy).
  // So với đệ quy query từng tầng (N query): 1 query + O(n) memory luôn thắng
  // khi cây vừa (vài trăm node). Cây chục nghìn node mới cần nested-set (ltree).
  async tree(): Promise<CategoryNode[]> {
    const all = await this.repo.find({ order: { name: 'ASC' } });
    const nodes = new Map<string, CategoryNode>(
      all.map((c) => [
        c.id,
        {
          id: c.id,
          name: c.name,
          slug: c.slug,
          description: c.description,
          parentId: c.parentId,
          children: [],
        },
      ]),
    );
    const roots: CategoryNode[] = [];
    for (const node of nodes.values()) {
      // Guard tự trỏ chính mình: write-path đã chặn (update check), đây là
      // phòng thủ tầng 2 để JSON.stringify không đệ quy vô hạn nếu data cũ bẩn.
      if (node.parentId && node.parentId !== node.id && nodes.has(node.parentId)) {
        nodes.get(node.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }
    return roots;
  }

  async findOne(id: string): Promise<Category> {
    const category = await this.repo.findOne({ where: { id } });
    if (!category) throw new NotFoundException(`category ${id} không tồn tại`);
    return category;
  }

  async create(dto: CreateCategoryDto): Promise<Category> {
    const slug = slugify(dto.slug ?? dto.name);
    if (!slug) {
      throw new BadRequestException('Tên không tạo được slug — đặt slug tường minh');
    }
    if (dto.parentId) await this.findOne(dto.parentId); // 404 nếu cha không có

    try {
      return await this.repo.save(
        this.repo.create({
          name: dto.name.trim(),
          slug,
          description: dto.description?.trim() ?? null,
          parentId: dto.parentId ?? null,
        }),
      );
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictException('Tên hoặc slug danh mục đã tồn tại');
      }
      throw err;
    }
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<Category> {
    const category = await this.findOne(id);

    if (dto.parentId !== undefined) {
      if (dto.parentId === id) {
        throw new BadRequestException('Danh mục không thể là cha của chính nó');
      }
      if (dto.parentId !== null) {
        await this.findOne(dto.parentId);
        await this.assertNoCycle(id, dto.parentId);
      }
      category.parentId = dto.parentId;
    }
    // Rename KHÔNG tự đổi slug (URL ổn định) — muốn đổi slug gửi tường minh.
    if (dto.name !== undefined) category.name = dto.name.trim();
    if (dto.slug !== undefined) {
      const slug = slugify(dto.slug);
      if (!slug) throw new BadRequestException('Slug không hợp lệ');
      category.slug = slug;
    }
    if (dto.description !== undefined) {
      category.description = dto.description?.trim() ?? null;
    }

    try {
      return await this.repo.save(category);
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictException('Tên hoặc slug danh mục đã tồn tại');
      }
      throw err;
    }
  }

  // Xóa CỨNG nhưng có điều kiện: còn con hoặc còn product -> 409.
  // (= RESTRICT ở tầng service với message đẹp; FK phía DB là chốt chặn cuối.)
  async remove(id: string): Promise<void> {
    await this.findOne(id);
    const children = await this.repo.count({ where: { parentId: id } });
    if (children > 0) {
      throw new ConflictException(
        `Danh mục còn ${children} danh mục con — chuyển hoặc xóa con trước`,
      );
    }
    const products = await this.dataSource
      .getRepository(Product)
      .count({ where: { categoryId: id } });
    if (products > 0) {
      throw new ConflictException(
        `Danh mục còn ${products} sản phẩm — chuyển category trước khi xóa`,
      );
    }
    await this.repo.delete({ id });
  }

  // Đi ngược chuỗi cha: nếu gặp lại id đang sửa là cycle (A con B, B con A).
  // visited-set để chắc chắn dừng dù data cũ đã bẩn sẵn cycle.
  private async assertNoCycle(id: string, newParentId: string): Promise<void> {
    const visited = new Set<string>([id]);
    let cursor: string | null = newParentId;
    while (cursor) {
      if (visited.has(cursor)) {
        throw new BadRequestException('parentId tạo vòng lặp trong cây danh mục');
      }
      visited.add(cursor);
      const parent = await this.repo.findOne({ where: { id: cursor } });
      cursor = parent?.parentId ?? null;
    }
  }
}
