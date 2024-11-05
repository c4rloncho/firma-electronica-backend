import { Injectable } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as Client from 'ssh2-sftp-client';
import { Readable } from 'stream';

@Injectable()
export class RemoteStorageService {
  private sftp: Client;

  constructor(
    private configservice:ConfigService,
  ) {
    this.sftp = new Client();
  }

  async connect() {
    if (!this.sftp.sftp) {
      await this.sftp.connect({
        host: this.configservice.get<string>('SFTP_HOST'),
        port: this.configservice.get<string>('SFTP_PORT'),
        username: this.configservice.get<string>('SFTP_USERNAME'),
        password: this.configservice.get<string>('SFTP_PASSWORD'),
        algorithms: {
          serverHostKey: ['ssh-rsa', 'ssh-dss', 'ecdsa-sha2-nistp256', 'ecdsa-sha2-nistp384', 'ecdsa-sha2-nistp521', 'ssh-ed25519']
        },
       // hostVerifier: () => true
      });
    }
  }

  async getFileStream(remoteFilePath: string): Promise<Readable> {
    try {
      await this.connect();
      return this.sftp.createReadStream(remoteFilePath);
    } catch (error) {
      console.error(`Error al obtener el stream del archivo: ${error.message}`);
      throw error;
    }
  }
  
  // Verificar y crear directorio en SFTP si no existe
  async ensureRemoteDirectory(remoteDir: string) {
    try {
      await this.sftp.stat(remoteDir);
    } catch (err) {
      if (err.code === 2) {
        await this.sftp.mkdir(remoteDir, true); // Crear directorio recursivamente
      } else {
        throw err;
      }
    }
  }

  async uploadFile(buffer: Buffer, remotePath: string): Promise<void> {
    try {
      await this.connect();

      // Verificar y crear el directorio en el servidor remoto si no existe
      const remoteDir = remotePath.substring(0, remotePath.lastIndexOf('/'));
      await this.createRemoteDirectoryIfNotExists(remoteDir);

      // Verificar si el archivo remoto ya existe y eliminarlo si es así
      await this.deleteRemoteFileIfExists(remotePath);

      // Subir el archivo al servidor remoto
      await this.uploadBuffer(buffer, remotePath);
      console.log(`Archivo subido exitosamente a ${remotePath}`);
    } catch (error) {
      console.error('Error al subir archivo al servidor SFTP:', error);
      throw error;
    } finally {
      await this.disconnect();
    }
  }

  private async createRemoteDirectoryIfNotExists(remoteDir: string): Promise<void> {
    try {
      await this.sftp.stat(remoteDir);
    } catch (err) {
      if (err.code === 'ENOENT') {
        console.log(`El directorio remoto no existe, creando: ${remoteDir}`);
        await this.sftp.mkdir(remoteDir, true);
      } else {
        throw err;
      }
    }
  }

  private async deleteRemoteFileIfExists(remotePath: string): Promise<void> {
    try {
      await this.sftp.stat(remotePath);
      console.log(`El archivo ya existe en ${remotePath}, se reemplazará.`);
      await this.sftp.delete(remotePath);
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.error(`Error al verificar o eliminar el archivo remoto: ${err.message}`);
        throw err;
      }
    }
  }
  async deleteFile(remotePath: string): Promise<void> {
    try {
      await this.connect();
      // Usar delete en lugar de unlink
      await this.sftp.delete(remotePath);
      console.log(`Archivo eliminado exitosamente: ${remotePath}`);
    } catch (error) {
      console.error(`Error al eliminar el archivo remoto: ${error.message}`);
      throw error;
    } finally {
      await this.disconnect();
    }
  }
  private async uploadBuffer(buffer: Buffer, remotePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const readableStream = new Readable();
      readableStream.push(buffer);
      readableStream.push(null);

      const writeStream = this.sftp.createWriteStream(remotePath);

      writeStream.on('close', () => {
        resolve();
      });

      writeStream.on('error', (error) => {
        reject(error);
      });

      readableStream.pipe(writeStream);
    });
  }

   async disconnect(): Promise<void> {
    if (this.sftp && this.sftp.sftp) {
      await this.sftp.end();
    }
  }
  
}
