import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { escapeLike } from '../../common/utils/escape-like.util.js';
import { isUniqueViolation } from '../../common/utils/postgres-error.util.js';
import { hashPassword } from './password.util.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { ListUsersDto } from './dto/list-users.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { User, UserRole } from './user.entity.js';

// Trang dữ liệu trả về API — map 1-1 với Page<T> của Spring Data
// (items ~ content, total ~ totalElements, totalPages ~ totalPages).
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Chuẩn hóa email TRƯỚC mọi so sánh/lưu: 'A@X.com' và 'a@x.com' là 1 người.
// Không làm bước này -> unique index varchar (case-sensitive) cho qua 2 tài
// khoản trùng nhau về mặt ý nghĩa. (= Spring: normalize trong service/mapper,
// hoặc CITEXT phía DB.)
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
  ) {}

  // Phân trang + filter + sort — thay thế findBy + Pageable của Spring Data.
  // Dùng QueryBuilder vì cần OR giữa các cột (email ILIKE OR fullName ILIKE)
  // kết hợp AND filter — findAndCount không diễn đạt gọn được.
  async findAll(query: ListUsersDto): Promise<Page<User>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const qb = this.repo.createQueryBuilder('user');
    // QueryBuilder TỰ thêm "deletedAt IS NULL" — withDeleted() là cách gỡ nó.
    // (= findAll(..., QuerydslPredicateSpecification) nhưng có cờ bật/tắt).
    if (query.includeDeleted) qb.withDeleted();
    if (query.q) {
      qb.andWhere('(user.email ILIKE :q OR user.fullName ILIKE :q)', {
        q: `%${escapeLike(query.q)}%`,
      });
    }
    if (query.role) qb.andWhere('user.role = :role', { role: query.role });
    if (query.isActive !== undefined) {
      qb.andWhere('user.isActive = :isActive', {
        isActive: query.isActive,
      });
    }
    // sort đã qua IsIn whitelist (list-users.dto) nên nối thẳng được.
    qb.orderBy(
      `user.${query.sort ?? 'createdAt'}`,
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

  async findOne(id: string): Promise<User> {
    // findOne của TypeORM TỰ lọc bản soft-deleted -> đã xóa = không tìm thấy.
    const user = await this.repo.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`user ${id} không tồn tại`);
    return user;
  }

  async create(dto: CreateUserDto): Promise<User> {
    // Normalize TRƯỚC check trùng — nếu không 'A@x.com' qua mặt được check
    // rồi đâm vào 23505 (vẫn 409 đúng, nhưng message kém + tốn 1 query lỗi).
    const email = normalizeEmail(dto.email);
    const fullName = dto.fullName.trim();

    // Check trước để trả message thân thiện, check lại bằng index unique
    // (23505) vì giữa 2 dòng này vẫn có race.
    const exists = await this.repo.findOne({ where: { email } });
    if (exists) throw new ConflictException(`email ${email} đã tồn tại`);

    try {
      // KHÔNG BAO GIỜ lưu password plaintext — hash ngay ở service layer.
      // role ?? CUSTOMER tường minh: không ỷ vào chuyện TypeORM bỏ qua
      // undefined để DB default nhảy vào (hành vi ORM, không phải hợp đồng).
      return await this.repo.save(
        this.repo.create({
          email,
          fullName,
          role: dto.role ?? UserRole.CUSTOMER,
          passwordHash: hashPassword(dto.password),
        }),
      );
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictException(`email ${email} đã tồn tại`);
      }
      throw err;
    }
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id); // đã 404 nếu không có

    if (dto.email !== undefined && normalizeEmail(dto.email) !== user.email) {
      const emailTaken = normalizeEmail(dto.email);
      const taken = await this.repo.findOne({ where: { email: emailTaken } });
      if (taken && taken.id !== id) {
        throw new ConflictException(`email ${emailTaken} đã tồn tại`);
      }
    }

    // Merge thủ công field cho phép — KHÔNG Object.assign(dto) vì UpdateUserDto
    // có thể chứa field không nên ghi đè (mảng whitelist = chống mass-assignment
    // ở tầng service, phòng khi quên ValidationPipe).
    if (dto.email !== undefined) user.email = normalizeEmail(dto.email);
    if (dto.fullName !== undefined) user.fullName = dto.fullName.trim();
    if (dto.role !== undefined) user.role = dto.role;
    if (dto.isActive !== undefined) user.isActive = dto.isActive;
    if (dto.password !== undefined) user.passwordHash = hashPassword(dto.password);

    try {
      return await this.repo.save(user);
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictException(`email ${dto.email} đã tồn tại`);
      }
      throw err;
    }
  }

  // XÓA MỀM — không DROP dòng. (= Hibernate @SQLDelete: UPDATE deleted_at=now())
  async remove(id: string): Promise<void> {
    await this.findOne(id); // ném 404 nếu đã bị xóa mềm rồi
    await this.repo.softDelete({ id });
  }

  // Khôi phục bản đã xóa mềm — cần đọc bản đã xóa nên findOne riêng với withDeleted.
  async restore(id: string): Promise<User> {
    const deleted = await this.repo.findOne({ where: { id }, withDeleted: true });
    if (!deleted) throw new NotFoundException(`user ${id} không tồn tại`);
    if (!deleted.deletedAt) return deleted; // idempotent: chưa xóa thì thôi
    await this.repo.restore({ id });
    // Đọc lại từ DB thay vì trả object cũ (tránh stale nếu sau này restore
    // chạm thêm cột, trigger, hoặc concurrent update chen giữa).
    return (await this.repo.findOne({ where: { id } }))!;
  }
}
