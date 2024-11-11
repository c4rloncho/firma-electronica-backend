import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, ParseIntPipe } from '@nestjs/common';
import { TypeDocumentService } from './type-document.service';
import { CreateTypeDocumentDto } from './dto/create-type-document.dto';
import { UpdateTypeDocumentDto } from './dto/update-type-document.dto';
import {  Roles } from 'src/auth/roles.decorator';
import { RolesGuard } from 'src/auth/roles.guard';
import { Rol } from 'src/enums/rol.enum';
import { AuthGuard } from '@nestjs/passport';

@Controller('type-document')
export class TypeDocumentController {
  constructor(private readonly typeDocumentService: TypeDocumentService) {}

  @Post()
  @Roles(Rol.ADMIN)
  @UseGuards(AuthGuard('jwt') ,RolesGuard)
  create(@Body() createTypeDocumentDto: CreateTypeDocumentDto) {
    return this.typeDocumentService.create(createTypeDocumentDto);
  }

  @Get()
  findAll() {
    return this.typeDocumentService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.typeDocumentService.findOne(+id);
  }

  @Patch(':id')
  
  update(@Param('id') id: string, @Body() updateTypeDocumentDto: UpdateTypeDocumentDto) {
    return this.typeDocumentService.update(+id, updateTypeDocumentDto);
  }

  @Delete(':id')
  @Roles(Rol.ADMIN)
  @UseGuards(AuthGuard('jwt') ,RolesGuard)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.typeDocumentService.remove(id);
  }
}
