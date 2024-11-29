// src/signature/services/signature-image.service.ts

import { Injectable } from '@nestjs/common';
import { createCanvas, loadImage } from 'canvas';
import { Funcionario } from 'src/funcionario/entities/funcionario.entity';

@Injectable()
export class SignatureImageService {

  async convertImageToBase64(imageBuffer: Buffer): Promise<string> {
    return imageBuffer.toString('base64');
  }

  async createSignatureImage(
    imageBuffer: Buffer,
    funcionario: Funcionario,
    fecha: string,
  ): Promise<Buffer> {
    try {
      console.log('Iniciando creación de imagen');
      // Reducimos el factor de escala
      const SCALE_FACTOR = 2;
      const FONT_SIZE = 20; // Tamaño de fuente fijo, sin escalar
      
      console.log('Creando canvas temporal');
      const tempCanvas = createCanvas(1, 1);
      const tempCtx = tempCanvas.getContext('2d');
      tempCtx.font = `bold ${FONT_SIZE}px Arial`;
      
      console.log('Midiendo textos');
      const textWidths = [
        funcionario.nombre,
        funcionario.cargo,
        `RUT: ${funcionario.rut}`,
        `Fecha: ${fecha}`
      ].map(text => {
        const width = tempCtx.measureText(text).width;
        console.log(`Ancho del texto "${text}": ${width}`);
        return width;
      });
      
      const maxTextWidth = Math.max(...textWidths);
      console.log('Ancho máximo de texto:', maxTextWidth);
      
      // Reducimos las dimensiones del logo
      const logoWidth = 150 * SCALE_FACTOR;
      const logoHeight = 100 * SCALE_FACTOR;
      
      // Ajustamos las dimensiones del canvas
      const canvasWidth = logoWidth + maxTextWidth + (30 * SCALE_FACTOR);
      const canvasHeight = 100 * SCALE_FACTOR;
      
      console.log('Dimensiones del canvas:', { canvasWidth, canvasHeight });
      
      console.log('Creando canvas principal');
      const canvas = createCanvas(canvasWidth, canvasHeight);
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
  
      console.log('Cargando imagen');
      const image = await loadImage(imageBuffer);
      console.log('Dimensiones de imagen original:', { width: image.width, height: image.height });
      
      const scale = Math.min(
        logoWidth / image.width,
        logoHeight / image.height
      );
      console.log('Factor de escala para imagen:', scale);
      
      const imgWidth = image.width * scale;
      const imgHeight = image.height * scale;
      console.log('Dimensiones de imagen escalada:', { imgWidth, imgHeight });
      
      const imgX = 20;
      const imgY = (canvasHeight - imgHeight) / 2;
      console.log('Posición de imagen:', { imgX, imgY });
      
      console.log('Dibujando imagen');
      ctx.drawImage(image, imgX, imgY, imgWidth, imgHeight);
  
      console.log('Configurando texto');
      ctx.fillStyle = 'black';
      ctx.font = ` ${FONT_SIZE}px Arial`;
      ctx.textAlign = 'left';
      
      const textX = imgX + imgWidth + 40;
      const lineHeight = FONT_SIZE * 1.5;
      const textStartY = (canvasHeight / 2) - (lineHeight * 1.5);
      
      console.log('Dibujando textos');
      ctx.fillText(funcionario.nombre, textX, textStartY);
      ctx.fillText(funcionario.cargo, textX, textStartY + lineHeight);
      ctx.fillText(`RUT: ${funcionario.rut}`, textX, textStartY + lineHeight * 2);
      ctx.fillText(`Fecha: ${fecha}`, textX, textStartY + lineHeight * 3);
  
      console.log('Generando buffer');
      return canvas.toBuffer('image/png', {
        compressionLevel: 0,
        filters: canvas.PNG_ALL_FILTERS,
        resolution: 300 // Reducimos también la resolución
      });
    } catch (error) {
      console.error('Error detallado:', error);
      console.error('Stack trace:', error.stack);
      throw new Error(`Error al crear la imagen de firma: ${error.message}`);
    }
  }

  private calculateSignaturePosition(
    signerOrder: number,
    heightImage: number,
    signaturesLength: number,
    signatureWidth: number = 300,
    signatureHeight: number = 200,
  ): { llx: number; lly: number; urx: number; ury: number; page: string } {
    const PAGE_WIDTH = 595;
    const PAGE_HEIGHT = 842;
    const MARGIN = 50;
    const SIGNATURES_PER_ROW = 2;
    
    // Calcular posición en la fila
    const col = (signerOrder - 1) % SIGNATURES_PER_ROW;
    const availableWidth = PAGE_WIDTH - (2 * MARGIN);
    const signatureSpacing = availableWidth / SIGNATURES_PER_ROW;
    const llx = MARGIN + (col * signatureSpacing);
    const urx = llx + signatureWidth;

    let lly, ury, page;

    if (heightImage > 25) {
      if (signerOrder <= 2) {
        // Si son solo 2 firmas, van en la última página
        // Si hay más, van en la penúltima
        page = signaturesLength <= 2 ? 'LAST' : '-2';
        // Posición en parte inferior de la página
        lly = MARGIN;
        ury = lly + signatureHeight;
      } else {
        // Firmas 3+ van en la última página
        page = 'LAST';
        // Calcular posición vertical basada en el orden
        const row = Math.floor((signerOrder - 3) / SIGNATURES_PER_ROW);
        lly = PAGE_HEIGHT - (MARGIN + signatureHeight + (row * (signatureHeight + 20)));
        ury = lly + signatureHeight;
      }
    } else {
      // Todas las firmas van en la última página
      page = 'LAST';
      const row = Math.floor((signerOrder - 1) / SIGNATURES_PER_ROW);
      lly = PAGE_HEIGHT - (MARGIN + signatureHeight + (row * (signatureHeight + 20)));
      ury = lly + signatureHeight;
    }

    return { llx, lly, urx, ury, page };
  }

  async createSignatureLayout(
    imageBuffer: Buffer,
    funcionario: Funcionario,
    fecha: string,
    heightImage: number,
    signerOrder: number,
    signaturesLength:number,
  ): Promise<string> {
    const combinedImage = await this.createSignatureImage(imageBuffer, funcionario, fecha);
    const base64Image = await this.convertImageToBase64(combinedImage);

    // Calcular posición
    const position = this.calculateSignaturePosition(signerOrder, heightImage,signaturesLength);

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