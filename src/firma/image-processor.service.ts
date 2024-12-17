// src/signature/services/signature-image.service.ts

import { Injectable } from '@nestjs/common';
import { createCanvas, loadImage } from 'canvas';
import { PDFAcroButton, PDFDocument } from 'pdf-lib';
import { Funcionario } from 'src/funcionario/entities/funcionario.entity';
interface SignaturePosition {
  llx: number; // Lower Left X
  lly: number; // Lower Left Y
  urx: number; // Upper Right X
  ury: number; // Upper Right Y
  page: number; // Página donde va la firma
}
@Injectable()
export class SignatureImageService {
  private readonly PAGE_HEIGHT = 900;
  private readonly MARGIN_LEFT = 50;
  private readonly HORIZONTAL_GAP = 20;

  // Dimensiones para firmadores
  private readonly SIGNER_WIDTH = 210;
  private readonly SIGNER_HEIGHT = 80;
  private readonly SIGNER_MARGIN_BOTTOM = 60;

  // Dimensiones para visadores
  private readonly VALIDATOR_WIDTH = 120;
  private readonly VALIDATOR_HEIGHT = 40;
  private readonly VALIDATOR_MARGIN_BOTTOM = 0;
  private readonly MARGIN_TOP = 10;
  private readonly ROW_HEIGHT = 150;

  async convertImageToBase64(imageBuffer: Buffer): Promise<string> {
    return imageBuffer.toString('base64');
  }
  async createSignatureImage(
    imageBuffer: Buffer,
    funcionario: { cargo: string; nombre: string; rut: string },
    fecha: string,
    signerType: string,
  ): Promise<Buffer> {
    const isVisador = signerType === 'visador';

    if (isVisador) {
      // Canvas pequeño solo para iniciales
      const canvas = createCanvas(200, 100);
      const ctx = canvas.getContext('2d');

      // Obtener iniciales del nombre
      const iniciales = funcionario.nombre
        .split(' ')
        .map((palabra) => palabra[0])
        .join('');

      // Configurar estilo del texto
      ctx.fillStyle = '#000000';
      const fontSize = Math.min(canvas.width * 0.5, canvas.height * 0.7); // Calcular tamaño de fuente proporcionalmente
      ctx.font = `bold ${fontSize}px Arial`;

      // Centrar las iniciales en el canvas
      const textMetrics = ctx.measureText(iniciales);
      const x = (canvas.width - textMetrics.width) / 2;
      const y = (canvas.height + fontSize * 0.35) / 2; // Ajustar posición vertical

      // Dibujar iniciales
      ctx.fillText(iniciales, x, y);

      return canvas.toBuffer();
    } else {
      // Lógica original para firmantes normales
      const canvas = createCanvas(670, 263);
      const ctx = canvas.getContext('2d');

      // Cargar y dibujar la imagen de firma
      const signatureImage = await loadImage(imageBuffer);
      const maxHeight = 195;
      const maxWidth = 520;
      let newWidth = signatureImage.width * 1.1;
      let newHeight = signatureImage.height * 1.1;

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

      ctx.drawImage(
        signatureImage,
        0,
        (canvas.height - newHeight) / 2,
        newWidth,
        newHeight,
      );

      // Configuración del texto
      ctx.font = '24px Arial';
      ctx.fillStyle = '#000000';

      const textX = newWidth + 30;
      let textY = 90;
      const lineHeight = 35;

      const formatNombre = (nombre: string): string[] => {
        const MAX_LENGTH = 25;
        const palabras = nombre.split(' ');

        if (nombre.length <= MAX_LENGTH) {
          return [nombre];
        }

        let primeraParte = '';
        let segundaParte = '';
        let longitudActual = 0;

        for (let i = 0; i < palabras.length; i++) {
          if (longitudActual + palabras[i].length <= MAX_LENGTH) {
            if (primeraParte) primeraParte += ' ';
            primeraParte += palabras[i];
            longitudActual += palabras[i].length + 1;
          } else {
            if (segundaParte) segundaParte += ' ';
            segundaParte += palabras[i];
          }
        }

        return [primeraParte, segundaParte].filter((part) => part);
      };

      const drawText = (label: string, value: string, y: number) => {
        ctx.font = 'bold 24px Arial';
        ctx.fillText(label, textX, y);

        if (label === 'Nombre: ') {
          const nombrePartes = formatNombre(value);
          ctx.font = '24px Arial';

          nombrePartes.forEach((parte, index) => {
            ctx.fillText(
              parte,
              textX + ctx.measureText(label).width + 10,
              y + index * lineHeight,
            );
          });

          return nombrePartes.length;
        } else {
          ctx.font = '24px Arial';
          ctx.fillText(value, textX + ctx.measureText(label).width + 10, y);
          return 1;
        }
      };

      let currentY = textY;
      const nombreLineas = drawText('Nombre: ', funcionario.nombre, currentY);
      currentY += lineHeight * nombreLineas;
      drawText('Cargo: ', funcionario.cargo, currentY);
      currentY += lineHeight;
      drawText('RUT : ', funcionario.rut, currentY);
      currentY += lineHeight;
      drawText('Fecha: ', fecha, currentY);

      return canvas.toBuffer();
    }
  }

  calculateSignaturePosition(
    signerOrder: number,
    heightImage: number,
    totalSigners: number,
    totalValidators: number,
    totalPages: number,
    signerType: string,
  ): SignaturePosition {
    const adjustedOrder = signerType === 'firmador'
      ? this.getAdjustedSignerOrder(signerOrder, totalValidators)
      : signerOrder;

    if (signerType === 'visador') {
      return this.calculateValidatorPosition(
        signerOrder,
        totalSigners,
        totalValidators,
        totalPages,
        heightImage
      );
    } else {
      return this.calculateSignerPosition(
        adjustedOrder,
        heightImage,
        totalSigners,
        totalPages
      );
    }
  }

  private getAdjustedSignerOrder(currentOrder: number, totalValidators: number): number {
    return currentOrder - totalValidators;
  }

  private calculateValidatorPosition(
    currentOrder: number,
    totalSigners: number,
    totalValidators: number,
    totalPages: number,
    heightImage: number,
  ): SignaturePosition {
    let page: number;
    if (heightImage >= 25) {
      page = totalSigners > 2 ? totalPages - 1 : totalPages;
    } else {
      const firmasPorPagina = heightImage <= 15 ? 8 : 4;
      page = totalSigners <= firmasPorPagina ? totalPages : totalPages - 1;
    }

    const x = this.MARGIN_LEFT + (currentOrder - 1) * (this.VALIDATOR_WIDTH + this.HORIZONTAL_GAP);
    const y = this.VALIDATOR_MARGIN_BOTTOM + this.VALIDATOR_HEIGHT;

    return {
      llx: x,
      lly: y - this.VALIDATOR_HEIGHT,
      urx: x + this.VALIDATOR_WIDTH,
      ury: y,
      page: page,
    };
  }

  private calculateSignerPosition(
    currentOrder: number,
    heightImage: number,
    totalSigners: number,
    totalPages: number,
  ): SignaturePosition {
    let page: number;
    let firmasPorPagina: number;

    if (heightImage >= 25) {
      firmasPorPagina = 2;
      page = totalSigners > 2 && currentOrder <= 2 ? totalPages - 1 : totalPages;
    } else {
      firmasPorPagina = heightImage <= 15 ? 8 : 4;
      const paginaActual = Math.ceil(currentOrder / firmasPorPagina);
      const totalPaginas = Math.ceil(totalSigners / firmasPorPagina);
      page = totalSigners <= firmasPorPagina ? totalPages : totalPages - totalPaginas + paginaActual;
    }

    const x = this.MARGIN_LEFT + (currentOrder % 2 === 0 ? this.SIGNER_WIDTH + this.HORIZONTAL_GAP : 0);

    let y: number;
    if (heightImage >= 25) {
      if (heightImage === 30) {
        y = 200;  // Parte más baja
      } else {
        y = 200 + (30 - heightImage) * 20;
      }
    } else {
      const row = Math.floor((currentOrder - 1) / 2);

      const baseY = 800 - (heightImage * 20);  // Proporción más natural
      
      y = baseY - (row * 100);
      
    }

    return {
      llx: x,
      lly: y - this.SIGNER_HEIGHT,
      urx: x + this.SIGNER_WIDTH,
      ury: y,
      page: page,
    };
  }

  async createSignatureLayout(
    imageBuffer: Buffer,
    funcionario: Funcionario,
    fecha: string,
    heightImage: number,
    signerOrder: number,
    pages: number,
    signerType: string,
    totalSigners: number,
    totalValidator: number,
  ): Promise<string> {
    const combinedImage = await this.createSignatureImage(
      imageBuffer,
      funcionario,
      fecha,
      signerType,
    );
    const base64Image = await this.convertImageToBase64(combinedImage);

    console.log('Debug de firma:', {
      orden: signerOrder,
      tipo: signerType,
      totalFirmadores: totalSigners,
      totalVisadores: totalValidator,
      paginas: pages,
      altura: heightImage,
    });

    const position = this.calculateSignaturePosition(
      signerOrder,
      heightImage,
      totalSigners,
      totalValidator,
      pages,
      signerType,
    );

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
