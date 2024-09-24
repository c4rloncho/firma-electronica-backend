import { Test, TestingModule } from '@nestjs/testing';
import { FirmaController } from './firma.controller';
import { FirmaService } from './firma.service';

describe('FirmaController', () => {
  let controller: FirmaController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FirmaController],
      providers: [FirmaService],
    }).compile();

    controller = module.get<FirmaController>(FirmaController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
