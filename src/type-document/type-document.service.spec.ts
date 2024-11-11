import { Test, TestingModule } from '@nestjs/testing';
import { TypeDocumentService } from './type-document.service';

describe('TypeDocumentService', () => {
  let service: TypeDocumentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TypeDocumentService],
    }).compile();

    service = module.get<TypeDocumentService>(TypeDocumentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
