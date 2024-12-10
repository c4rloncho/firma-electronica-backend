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

  private calculateSignaturePosition(
    signerOrder: number,
    heightImage: number,
    signaturesLength: number,
    totalPages: number,
    signerType: string,
  ): SignaturePosition {
    // Dimensiones para firmas normales
    const signatureWidth = 210;
    const signatureHeight = 80;

    // Dimensiones reducidas para visadores
    const visadorWidth = 75;
    const visadorHeight = 25;
    const visadorSpacing = 10;

    // Coordenadas base
    const leftX = 50;
    const rightX = 340;

    // Determinar cuántas firmas caben por página basado en heightImage
    const firmasPorPagina = heightImage >= 30 ? 2 : 4;

    // Contar visadores y firmantes
    const isVisador = signerType === 'visador';
    const visadoresCount = Array.from({ length: signaturesLength }).filter(
      (_, index) => signerType === 'visador',
    ).length;
    const firmantesCount = signaturesLength - visadoresCount;

    if (isVisador) {
      // Lógica para visadores en última página
      const visadorOrder = signerOrder - (signaturesLength - visadoresCount);
      const pageWidth = 595;
      const totalWidth =
        visadoresCount * visadorWidth + (visadoresCount - 1) * visadorSpacing;
      const startX = (pageWidth - totalWidth) / 2;

      const x = startX + (visadorOrder - 1) * (visadorWidth + visadorSpacing);
      const y = 100;

      return {
        llx: x,
        lly: y - visadorHeight,
        urx: x + visadorWidth,
        ury: y,
        page: totalPages,
      };
    } else {
      // Lógica para firmantes normales
      const firmanteOrder = signerOrder;
      const isLeftPosition = firmanteOrder % 2 === 1;
      const x = isLeftPosition ? leftX : rightX;

      // Calcular página basado en cuántas firmas caben por página
      const currentPair = Math.ceil(firmanteOrder / 2);
      const pairsPerPage = firmasPorPagina / 2;
      const pageOffset = Math.floor((currentPair - 1) / pairsPerPage);
      const page = totalPages - 1 - pageOffset;

      // Calcular posición Y
      let baseY = 700;
      if (heightImage >= 30) {
        baseY = 150;
      } else if (heightImage > 25) {
        baseY = 250 + (30 - heightImage) * 20;
      }

      // Ajustar Y según la posición en la página
      const pairInPage = (currentPair - 1) % pairsPerPage;
      const yOffset = heightImage >= 30 ? 150 : 100; // Menor espacio entre filas si hay más firmas
      const y = baseY - pairInPage * yOffset;

      return {
        llx: x,
        lly: y - signatureHeight,
        urx: x + signatureWidth,
        ury: y,
        page: page,
      };
    }
  }
  async createSignatureLayout(
    imageBuffer: Buffer,
    funcionario: Funcionario,
    fecha: string,
    heightImage: number,
    signerOrder: number,
    signaturesLength: number,
    pages: number,
    signerType: string,
  ): Promise<string> {
    const combinedImage = await this.createSignatureImage(
      imageBuffer,
      funcionario,
      fecha,
      signerType,
    );
    const base64Image = await this.convertImageToBase64(combinedImage);
    // Calcular posición
    const position = this.calculateSignaturePosition(
      signerOrder,
      heightImage,
      signaturesLength,
      pages,
      signerType,
    );

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
