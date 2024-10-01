import { Test, TestingModule } from '@nestjs/testing';
import { DelegateService } from './delegate.service';

describe('DelegateService', () => {
  let service: DelegateService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DelegateService],
    }).compile();

    service = module.get<DelegateService>(DelegateService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
