# Aplicación Web de Firma Electrónica para la Municipalidad de Monte Patria

<div align="center">
<img src="https://nestjs.com/img/logo-small.svg" width="250" >
Desarrollado con NestJS
</div>

## 📑 Descripción General del Proyecto

Esta aplicación web facilita la gestión de firmas electrónicas avanzadas para la Municipalidad de Monte Patria. Integra la API FirmaGob del gobierno chileno y está construida sobre NestJS, ofreciendo una solución robusta y eficiente para la administración municipal.

### 🌟 Características Principales

- 📝 Integración seamless con la API FirmaGob
- 📁 Sistema de carga y gestión de documentos
- 🔐 Autenticación y autorización de usuarios
- ✅ Verificación de firmas
- 📊 Registro detallado de auditoría para documentos firmados

## 🛠️ Tecnologías Utilizadas

| Tecnología | Descripción |
|------------|-------------|
| [NestJS](https://nestjs.com/) | Framework progresivo de Node.js para aplicaciones servidor escalables |
| [API FirmaGob](https://firma.digital.gob.cl/) | API oficial de firma electrónica del gobierno chileno |

## 📋 Requisitos Previos

Asegúrese de contar con:

- Node.js (versión 14 o posterior)
- Credenciales de acceso para la API FirmaGob

## 🚀 Instalación

1. **Clone el repositorio:**
   ```bash
   git clone https://github.com/c4rloncho/firma-electronica-backend.git
   ```

2. **Navegue al directorio del proyecto:**
   ```bash
   cd firma-electronica-backend
   ```

3. **Instale las dependencias:**
   ```bash
   npm install
   ```

4. **Configure las variables de entorno:**
   
   Cree un archivo `.env` en el directorio raíz con el siguiente contenido:
   ```env
   API_TOKEN_KEY=su_clave_proporcionada
   JWT_SECRET=su_secreto_api_proporcionada
   API_URL=pagina_de_la_api
   ```

## ▶️ Ejecución de la Aplicación

Para iniciar la aplicación en modo desarrollo:

```bash
npm run start:dev
```


<div align="center">

**Desarrollado y mantenido por la Municipalidad de Monte Patria**

<img src="https://permisodecirculacion.cl/wp-content/uploads/2022/01/MONTE.jpg" width=200>

</div>
