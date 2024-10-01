import { Test, TestingModule } from '@nestjs/testing';
import { DelegateController } from './delegate.controller';

describe('DelegateController', () => {
  let controller: DelegateController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DelegateController],
    }).compile();

    controller = module.get<DelegateController>(DelegateController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
