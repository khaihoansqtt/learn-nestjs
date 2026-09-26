import { AppDataSource } from './data-source.js';
import { seedAdmin } from './seed.js';

// CLI database một-một-ơi cho project: build rồi chạy dist
//   node dist/database/cli.js run    -> chạy các migration chưa apply
//   node dist/database/cli.js revert -> LÙI 1 migration gần nhất (down)
//   node dist/database/cli.js show   -> liệt kê migration đã/chưa chạy
//   node dist/database/cli.js seed   -> chèn dữ liệu nền (admin)
//
// Vì sao chạy trên dist chứ không ts-node/tsx? Entity dùng emitDecoratorMetadata,
// mà esbuild (tsx) KHÔNG sinh decorator metadata -> TypeORM đọc sai column type
// âm thầm. tsc + node là đường chắc chắn nhất.
const action = process.argv[2];

async function main(): Promise<void> {
  await AppDataSource.initialize();

  switch (action) {
    case 'run': {
      // migrationsRun vẫn false trong options: PHẢI chạy lệnh này tường minh
      // (auto-run ở mọi lần boot dev thì vui, nhưng deploy prod chạy migration
      // khi nào, trước hay sau app start, là quyết định của pipeline).
      const executed = await AppDataSource.runMigrations();
      console.log(
        executed.length
          ? `[migrate] đã chạy ${executed.length} migration: ${executed.map((m) => m.name).join(', ')}`
          : '[migrate] không có migration nào chờ chạy',
      );
      break;
    }
    case 'revert': {
      await AppDataSource.undoLastMigration();
      console.log('[migrate] đã lùi 1 migration gần nhất');
      break;
    }
    case 'show': {
      const pending = await AppDataSource.showMigrations();
      console.log(
        pending
          ? '[migrate] CÒN migration chưa chạy (xem log chi tiết phía trên)'
          : '[migrate] tất cả migration đã chạy',
      );
      break;
    }
    case 'seed': {
      await seedAdmin(AppDataSource);
      break;
    }
    default:
      console.log('Dùng: node dist/database/cli.js <run|revert|show|seed>');
      process.exitCode = 1;
  }

  await AppDataSource.destroy();
}

main().catch((err) => {
  console.error('[db-cli] lỗi:', err);
  process.exit(1);
});
