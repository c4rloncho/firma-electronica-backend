// src/signature/services/signature-image.service.ts

import { Injectable } from '@nestjs/common';
import { createCanvas, loadImage } from 'canvas';
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
    const canvas = createCanvas(400, 100);
    const ctx = canvas.getContext('2d');
  
    // Fondo blanco
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, 400, 100);
  
    // Cargar y dibujar la imagen de firma
    const image = await loadImage(imageBuffer);
    ctx.drawImage(image, 0, 0, 100, 100);
  
    // Texto simple
    ctx.font = '12px Arial';
    ctx.fillStyle = 'black';
    ctx.fillText(`Nombre: ${funcionario.nombre}`, 120, 30);
    ctx.fillText(`Cargo: ${funcionario.cargo}`, 120, 50);
    ctx.fillText(`RUT: ${funcionario.rut}`, 120, 70);
    ctx.fillText(`Fecha: ${fecha}`, 120, 90);
  
    return canvas.toBuffer();
  }

  private calculateSignaturePosition(
    signerOrder: number,
    heightImage: number,
    signaturesLength: number
  ): SignaturePosition {
    return {
      llx: 50,
      lly: 100,
      urx: 250,
      ury: 200,
      page: -1
    };
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
              <page>lAST  </page>
              <image>BASE64</image>
              <BASE64VALUE>${base64Image}</BASE64VALUE>
            </Visible>
          </Signature>
        </Application>
      </AgileSignerConfig>
    `.trim();
  }
}