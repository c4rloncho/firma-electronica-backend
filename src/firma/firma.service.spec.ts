import { Test, TestingModule } from '@nestjs/testing';
import { FirmaService } from './firma.service';

describe('FirmaService', () => {
  let service: FirmaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FirmaService],
    }).compile();

    service = module.get<FirmaService>(FirmaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
