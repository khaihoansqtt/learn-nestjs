import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoriesController } from './categories.controller.js';
import { CategoriesService } from './categories.service.js';
import { Category } from './category.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Category])],
  controllers: [CategoriesController],
  providers: [CategoriesService],
  // Export để ProductsModule tái dùng findOne (check category 404 thống nhất).
  exports: [CategoriesService],
})
export class CategoriesModule {}
