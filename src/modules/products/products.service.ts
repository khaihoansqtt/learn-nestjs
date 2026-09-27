import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { escapeLike } from '../../common/utils/escape-like.util.js';
import {
  isFkViolation,
  isUniqueViolation,
} from '../../common/utils/postgres-error.util.js';
import { slugify } from '../../common/utils/slugify.util.js';
import { CategoriesService } from '../categories/categories.service.js';
import type { Page } from '../users/users.service.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { ListProductsDto } from './dto/list-products.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { Product } from './product.entity.js';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly repo: Repository<Product>,
    // Tái dùng CategoriesService.findOne để check category (404 thống nhất)
    // thay vì query riêng — ProductsModule import CategoriesModule (xem module).
    private readonly categories: CategoriesService,
  ) {}

  // List kèm category NHÚNG SẴN qua 1 JOIN duy nhất (leftJoinAndSelect).
  // Phản-pattern N+1: find() product rồi mỗi dòng query category 1 lần
  // (1 + N query). Ở đây getManyAndCount = 2 query CỐ ĐỊNH dù page bao nhiêu dòng.
  // Test e2e đếm query chứng minh (xem products.e2e-spec 'không N+1').
  async findAll(query: ListProductsDto): Promise<Page<Product>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const qb = this.repo
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category');
    if (query.includeDeleted) qb.withDeleted();
    if (query.q) {
      qb.andWhere('(product.name ILIKE :q OR product.slug ILIKE :q)', {
        q: `%${escapeLike(query.q)}%`,
      });
    }
    if (query.categoryId) {
      qb.andWhere('product.categoryId = :categoryId', {
        categoryId: query.categoryId,
      });
    }
    // minPrice/maxPrice là number đã validate — so numeric trực tiếp, pg lo cast.
    if (query.minPrice !== undefined) {
      qb.andWhere('product.price >= :minPrice', { minPrice: query.minPrice });
    }
    if (query.maxPrice !== undefined) {
      qb.andWhere('product.price <= :maxPrice', { maxPrice: query.maxPrice });
    }
    if (query.isActive !== undefined) {
      qb.andWhere('product.isActive = :isActive', {
        isActive: query.isActive,
      });
    }
    if (query.inStock) qb.andWhere('product.stock > 0');
    qb.orderBy(
      `product.${query.sort ?? 'createdAt'}`,
      (query.order ?? 'desc').toUpperCase() as 'ASC' | 'DESC',
    );
    qb.skip((page - 1) * limit).take(limit);

    const [items, total] = await qb.getManyAndCount();
    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // findOne cũng JOIN category để shape response NHẤT QUÁN với list
  // (client không phải handle 2 dạng có/không category).
  async findOne(id: string): Promise<Product> {
    const product = await this.repo
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .where('product.id = :id', { id })
      .getOne();
    if (!product) throw new NotFoundException(`product ${id} không tồn tại`);
    return product;
  }

  async create(dto: CreateProductDto): Promise<Product> {
    const slug = slugify(dto.slug ?? dto.name);
    if (!slug) {
      throw new BadRequestException('Tên không tạo được slug — đặt slug tường minh');
    }
    // 404 sớm với message đẹp; FK RESTRICT phía DB là chốt chặn race
    // (category bị xóa đúng lúc giữa check và insert -> 23503 -> 404).
    await this.categories.findOne(dto.categoryId);

    try {
      // Save rồi ĐỌC LẠI bằng findOne (có JOIN category): entity vừa save
      // không có relation category loaded (chỉ có categoryId) — trả thẳng
      // là shape thiếu category, lệch với list/findOne.
      const saved = await this.repo.save(
        this.repo.create({
          name: dto.name.trim(),
          slug,
          description: dto.description?.trim() ?? null,
          price: dto.price,
          stock: dto.stock ?? 0,
          isActive: dto.isActive ?? true,
          categoryId: dto.categoryId,
        }),
      );
      return this.findOne(saved.id);
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictException('Slug sản phẩm đã tồn tại');
      }
      if (isFkViolation(err)) {
        throw new NotFoundException(`category ${dto.categoryId} không tồn tại`);
      }
      throw err;
    }
  }

  async update(id: string, dto: UpdateProductDto): Promise<Product> {
    const product = await this.findOne(id);

    if (dto.categoryId !== undefined && dto.categoryId !== product.categoryId) {
      await this.categories.findOne(dto.categoryId);
      product.categoryId = dto.categoryId;
    }
    if (dto.name !== undefined) product.name = dto.name.trim();
    // Rename không tự đổi slug (URL ổn định) — chỉ đổi khi gửi tường minh.
    if (dto.slug !== undefined) {
      const slug = slugify(dto.slug);
      if (!slug) throw new BadRequestException('Slug không hợp lệ');
      product.slug = slug;
    }
    if (dto.description !== undefined) {
      product.description = dto.description?.trim() ?? null;
    }
    if (dto.price !== undefined) product.price = dto.price;
    if (dto.stock !== undefined) product.stock = dto.stock;
    if (dto.isActive !== undefined) product.isActive = dto.isActive;

    try {
      // Save rồi đọc lại: product đang giữ object category CŨ trong memory
      // (nếu đổi categoryId) — trả thẳng là category nhúng bị stale.
      await this.repo.save(product);
      return this.findOne(id);
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictException('Slug sản phẩm đã tồn tại');
      }
      if (isFkViolation(err)) {
        throw new NotFoundException(`category ${dto.categoryId} không tồn tại`);
      }
      throw err;
    }
  }

  // Xóa MỀM như users (giữ lịch sử cho đơn hàng M8).
  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.repo.softDelete({ id });
  }

  async restore(id: string): Promise<Product> {
    const deleted = await this.repo.findOne({ where: { id }, withDeleted: true });
    if (!deleted) throw new NotFoundException(`product ${id} không tồn tại`);
    if (!deleted.deletedAt) {
      return this.findOne(id); // idempotent: trả shape có category
    }
    await this.repo.restore({ id });
    return this.findOne(id);
  }
}
