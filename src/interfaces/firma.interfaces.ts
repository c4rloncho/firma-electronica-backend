export interface SignedFile {
    content: string;
    status: string;
    contentType: string;
    description: string | null;
    checksum_original: string;
    checksum_signed: string;
    documentStatus: string;
  }
  
export interface SignResponse {
    files: SignedFile[];
    metadata: {
      otpExpired: boolean;
      filesSigned: number;
      signedFailed: number;
      objectsReceived: number;
    };
    idSolicitud: number;
  }
  
export interface User{
  rut:string;
  name:string;
  rol:string;

}
export interface PendingSignature {
  id: number;
  name: string;
  fileName: string;
  signatureType: 'Titular' | 'Delegado';
  ownerRut: string;
  fecha: Date | null;
  isMyTurn: boolean;
}

export interface SignatureEvent {
  documentId: number;
  path: string;
  checksum: string;
  timestamp: Date;
}