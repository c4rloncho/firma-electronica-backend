// src/signature/services/signature-image.service.ts

import { Injectable } from '@nestjs/common';
import { createCanvas, loadImage } from 'canvas';
import { PDFAcroButton, PDFDocument } from 'pdf-lib';
import { Funcionario } from 'src/funcionario/entities/funcionario.entity';
interface SignaturePosition {
  llx: number;  // Lower Left X
  lly: number;  // Lower Left Y
  urx: number;  // Upper Right X
  ury: number;  // Upper Right Y
  page: number; // Página donde va la firma
}
@Injectable()
export class SignatureImageService {

  async convertImageToBase64(imageBuffer: Buffer): Promise<string> {
    return imageBuffer.toString('base64');
  }



  async  createSignatureImage(
    imageBuffer: Buffer,
    funcionario: { cargo: string; nombre: string; rut: string },
    fecha: string
  ): Promise<Buffer> {
    // Aumentar dimensiones del canvas
    const canvas = createCanvas(650, 260);  // Duplicamos el tamaño original
    const ctx = canvas.getContext('2d');

 ;

    // Agregar borde para visualización
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 2;  // Borde más grueso
    ctx.strokeRect(0, 0, canvas.width, canvas.height);

    // Cargar la imagen de la firma desde el buffer
    const signatureImage = await loadImage(imageBuffer);

    // Aumentar dimensiones máximas para la imagen
    const maxHeight = 195;  // Duplicamos altura máxima
    const maxWidth = 520;   // Duplicamos ancho máximo
    let newWidth = signatureImage.width*1.1;
    let newHeight = signatureImage.height*1.1;

    // Ajustar proporcionalmente si excede límites
    if (newHeight > maxHeight) {
      const ratio = maxHeight / newHeight;
      newWidth *= ratio;
      newHeight = maxHeight;
    }
    if (newWidth > maxWidth) {
      const ratio = maxWidth / newWidth;
      newHeight *= ratio;
      newWidth = maxWidth;
    }

    // Dibujar la imagen centrada verticalmente
    ctx.drawImage(
      signatureImage,
      10,  // Más margen izquierdo
      (canvas.height - newHeight) / 2,
      newWidth,
      newHeight
    );

    // Aumentar tamaño del texto
    ctx.font = '22px Arial';  // Texto más grande
    ctx.fillStyle = '#000000';

    // Ajustar posiciones del texto
    const textX = newWidth + 30;  // Más espacio después de la imagen
    let textY = 60;  // Ajustar posición inicial del texto
    const lineHeight = 35;  // Más espacio entre líneas

    // Agregar un poco de estilo al texto con fuente más grande
    const drawText = (label: string, value: string, y: number) => {
      ctx.font = 'bold 22px Arial';  // Texto en negrita más grande
      ctx.fillText(label, textX, y);
      ctx.font = '22px Arial';  // Texto normal más grande
      ctx.fillText(value, textX + ctx.measureText(label).width + 10, y);
    };

    // Dibujar la información con mejor formato
    drawText('Nombre: ', funcionario.nombre, textY);
    drawText('Cargo: ', funcionario.cargo, textY + lineHeight);
    drawText('RUT: ', funcionario.rut, textY + lineHeight * 2);
    drawText('Fecha: ', fecha, textY + lineHeight * 3);

    return canvas.toBuffer();
  }
  private calculateSignaturePosition(
    signerOrder: number,
    heightImage: number,
    signaturesLength: number,
    totalPages: number
  ): SignaturePosition {
    // Dimensiones fijas de la firma
    const signatureWidth = 240;
    const signatureHeight = 120;
    
    // Posiciones base X
    const leftX = 50;
    const rightX = 340;
    
    // Determinar página y posición
    let page = totalPages;
    let row = 0;
    
    if (signaturesLength <= 2) {
      page = totalPages;
    } 
    else if (heightImage > 25) {
      page = signerOrder <= 2 ? totalPages - 1 : totalPages;
    }
    else {
      if (heightImage <= 14) {
        const firmasPerPage = 6;
        const pageOffset = Math.floor((signerOrder - 1) / firmasPerPage);
        page = totalPages - Math.ceil(signaturesLength / firmasPerPage) + pageOffset + 1;
        row = Math.floor(((signerOrder - 1) % firmasPerPage) / 2);
      } 
      else {
        const firmasPerPage = 4;
        const pageOffset = Math.floor((signerOrder - 1) / firmasPerPage);
        page = totalPages - Math.ceil(signaturesLength / firmasPerPage) + pageOffset + 1;
        row = Math.floor(((signerOrder - 1) % firmasPerPage) / 2);
      }
    }
    
    // Calcular posición X (izquierda o derecha)
    const isLeftPosition = (signerOrder % 2) === 1;
    const x = isLeftPosition ? leftX : rightX;
    
    // Calcular posición Y según heightImage y row
    let y = 700; // Posición base
    
    if (heightImage > 25) {
      // Ajuste para la parte inferior de la página
      if (heightImage === 30) {
        y = 150; // Posición muy abajo en la página
      } else {
        y = 250 + ((30 - heightImage) * 20); // Ajuste gradual para valores entre 26-29
      }
    }
    else if (heightImage <= 14) {
      // Tres filas posibles
      const rowHeight = 200;
      y = 700 - (row * rowHeight);
    }
    else {
      // Dos filas posibles
      const rowHeight = 250;
      y = 650 - (row * rowHeight);
    }
    
    return {
      llx: x,
      lly: y - signatureHeight,
      urx: x + signatureWidth,
      ury: y,
      page: page
    };
  }

  async createSignatureLayout(
    imageBuffer: Buffer,
    funcionario: Funcionario,
    fecha: string,
    heightImage: number,
    signerOrder: number,
    signaturesLength:number,
    pages:number,
  ): Promise<string> {
    const combinedImage = await this.createSignatureImage(imageBuffer, funcionario, fecha);
    const base64Image = await this.convertImageToBase64(combinedImage);

    // Calcular posición
    const position = this.calculateSignaturePosition(signerOrder, heightImage,signaturesLength,pages);

    // Crear XML con las posiciones calculadas
    return `
      <AgileSignerConfig>
        <Application id="THIS-CONFIG">
          <pdfPassword/>
          <Signature>
            <Visible active="true" layer2="false" label="true" pos="1">
              <llx>${position.llx}</llx>
              <lly>${position.lly}</lly>
              <urx>${position.urx}</urx>
              <ury>${position.ury}</ury>
              <page>${position.page}</page>
              <image>BASE64</image>
              <BASE64VALUE>${base64Image}</BASE64VALUE>
            </Visible>
          </Signature>
        </Application>
      </AgileSignerConfig>
    `.trim();
  }
}