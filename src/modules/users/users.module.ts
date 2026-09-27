import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

@Module({
  // forFeature = khai báo "module này dùng entity User" -> đăng ký repository
  // provider vào DI. (= Spring JpaRepository interface + @EnableJpaRepositories)
  // TypeOrmModule.forFeature KHÔNG cần lặp lại ở chỗ khác: ai inject
  // @InjectRepository(User) đều phải nằm trong module có forFeature([User]).
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
