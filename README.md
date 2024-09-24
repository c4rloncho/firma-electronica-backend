# Aplicación Web de Firma Electrónica para la Municipalidad de Monte Patria

Este proyecto es una aplicación web para firmas electrónicas avanzadas, desarrollada para la Municipalidad de Monte Patria. Utiliza la API proporcionada por el gobierno chileno (FirmaGob) y está construida usando NestJS.

## Descripción General del Proyecto

La aplicación permite a los usuarios firmar documentos electrónicamente utilizando firmas electrónicas avanzadas, agilizando los procesos administrativos dentro de la municipalidad.

### Características Principales

- Integración con la API FirmaGob para firmas electrónicas
- Carga y gestión de documentos
- Autenticación y autorización de usuarios
- Verificación de firmas
- Registro de auditoría para documentos firmados

## Tecnologías Utilizadas

- [NestJS](https://nestjs.com/) - Un marco de trabajo progresivo de Node.js para crear aplicaciones del lado del servidor eficientes y escalables
- [API FirmaGob](https://firma.digital.gob.cl/) - API de firma electrónica del gobierno chileno

## Requisitos Previos

Antes de comenzar, asegúrese de cumplir con los siguientes requisitos:

- Node.js (versión 14 o posterior)
- Credenciales de acceso para la API FirmaGob

## Instalación

1. Clone el repositorio:
   ```
   git clone https://github.com/c4rloncho/firma-electronica-backend.git
   ```

2. Navegue al directorio del proyecto:
   ```
   cd firma-electronica-backend
   ```

3. Instale las dependencias:
   ```
   npm install
   ```

4. Cree un archivo `.env` en el directorio raíz y agregue sus credenciales de la API FirmaGob:
   ```
   API_TOKEN_KEY=su_clave_proporcionada
   JWT_SECRET=su_secreto_api_proporcionada
   API_URL= pagina_de_la_api
   ```

## Ejecución de la Aplicación

Para ejecutar la aplicación en modo de desarrollo:

```
npm run start:dev
```

## Licencia

[Especifique la licencia bajo la cual se libera este proyecto]



Este proyecto es desarrollado y mantenido por la Municipalidad de Monte Patria.
