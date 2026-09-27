import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '../users/user.entity.js';
import { CategoriesService } from './categories.service.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { ListCategoriesDto } from './dto/list-categories.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';

// Storefront đọc công khai (khách chưa login vẫn xem danh mục), ghi ADMIN.
// (= shop thật: ai cũng xem được menu, chỉ admin sửa được menu)
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Public()
  @Get()
  list(@Query() query: ListCategoriesDto) {
    return this.categories.findAll(query);
  }

  // Đặt TRƯỚC @Get(':id'): Express match theo thứ tự khai báo, 'tree' mà rơi
  // vào ':id' là ParseUUIDPipe 400 ngay.
  @Public()
  @Get('tree')
  tree() {
    return this.categories.tree();
  }

  @Public()
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.categories.findOne(id);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateCategoryDto) {
    return this.categories.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categories.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(200)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.categories.remove(id);
    return { id, deleted: true, hard: true };
  }
}
