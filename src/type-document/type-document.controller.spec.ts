import { Test, TestingModule } from '@nestjs/testing';
import { TypeDocumentController } from './type-document.controller';
import { TypeDocumentService } from './type-document.service';

describe('TypeDocumentController', () => {
  let controller: TypeDocumentController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TypeDocumentController],
      providers: [TypeDocumentService],
    }).compile();

    controller = module.get<TypeDocumentController>(TypeDocumentController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
