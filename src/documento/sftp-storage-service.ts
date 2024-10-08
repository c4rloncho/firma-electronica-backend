import { Injectable } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as Client from 'ssh2-sftp-client';

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

  async disconnect() {
    if (this.sftp.sftp) {
      await this.sftp.end();
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

  async uploadFile(localPath: string, remotePath: string) {
    try {
      await this.connect();
  
      // Verificar y crear el directorio en el servidor remoto si no existe
      const remoteDir = remotePath.substring(0, remotePath.lastIndexOf('/'));
  
      try {
        await this.sftp.stat(remoteDir); // Verificar si el directorio remoto existe
      } catch (err) {
        if (err.code === 'ENOENT') { // Si el directorio no existe
          console.log(`El directorio remoto no existe, creando: ${remoteDir}`);
          await this.sftp.mkdir(remoteDir, true); // Crear el directorio recursivamente
        } else {
          throw err; // Lanzar otros errores si ocurren
        }
      }
  
    // Verificar si el archivo remoto ya existe y eliminarlo si es así
    try {
      await this.sftp.stat(remotePath); // Verificar si el archivo ya existe
      console.log(`El archivo ya existe en ${remotePath}, se reemplazará.`);
      await this.sftp.delete(remotePath); // Eliminar el archivo existente
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.error(`Error al verificar o eliminar el archivo remoto: ${err.message}`);
        throw err; // Lanzar si hay un error diferente
      }
      // Si el error es ENOENT, significa que el archivo no existe, así que continuamos
    }

    // Subir el archivo al servidor remoto
    await this.sftp.put(localPath, remotePath);
    console.log(`Archivo subido exitosamente a ${remotePath}`);
  } catch (error) {
    console.error('Error al subir archivo al servidor SFTP:', error);
    throw error;
  } finally {
    await this.disconnect();
  }
  }
  
}
