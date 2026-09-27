import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoriesModule } from '../categories/categories.module.js';
import { Product } from './product.entity.js';
import { ProductsController } from './products.controller.js';
import { ProductsService } from './products.service.js';

@Module({
  // Import CategoriesModule để dùng CategoriesService (không forFeature lại
  // Category ở đây — 1 entity 1 chủ sở hữu repository, tránh 2 nguồn sự thật).
  imports: [CategoriesModule, TypeOrmModule.forFeature([Product])],
  controllers: [ProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}
