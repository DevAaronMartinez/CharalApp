# Comunidad Salud

App móvil y API para conectar personas con enfermedades crónicas, discapacidades o síndromes. Permite compartir lo que ayuda, ver recomendaciones por condición, ubicar concentraciones de la comunidad en un mapa y encontrar clínicas/servicios útiles.

## Estructura del proyecto

```
charal3/
├── mobile/     # App Expo 54 (React Native)
└── backend/    # API Express preparada para AWS Lambda
```

## Funcionalidades

- **Comunidad**: publicar consejos y ver personas que necesitan ayuda
- **Recomendaciones**: tips personalizados por tipo de condición
- **Mapa**: concentración de usuarios + clínicas y servicios de salud
- **Medicinas (AR)**: escaneo de envases con cámara AR (ViroReact) u OCR
- **Evidencias de salud**: foto del baumanómetro/glucómetro con **VLM on-device** ([React Native ExecuTorch](https://executorch.swmansion.com/)) o OCR; el usuario confirma y recibe orientación educativa

## Requisitos

- Node.js 20+
- npm
- Expo Go (modo básico) o **development build** para AR con ViroReact y VLM on-device

## AR con ViroReact (Medicinas)

El escaneo de medicamentos usa [@reactvision/react-viro](https://github.com/ReactVision/viro) en builds nativos:

- **Expo Go**: cámara clásica + OCR por backend (sin AR 3D).
- **Development build** (recomendado para AR):

```bash
cd mobile
npm install
npx expo prebuild
npx expo run:ios    # o run:android
```

Tras compilar, la pestaña **Medicinas** muestra cámara AR con marco 3D, cápsula flotante y captura congelada para OCR.

## VLM on-device (presión / glucosa)

En **Perfil → Evaluar mi evidencia**, la app puede leer la pantalla del monitor con un VLM local (LFM2.5-VL 1.6B cuantizado) vía [React Native ExecuTorch](https://docs.swmansion.com/react-native-executorch/docs/fundamentals/getting-started):

- La imagen **no se sube** a un LLM en la nube.
- La primera vez descarga el modelo (~cientos de MB) y queda en el dispositivo.
- **Requiere development build** (no Expo Go). En Expo Go se usa cámara + OCR del backend y confirmación manual.
- Tras detectar valores, el usuario confirma contexto y recibe la evaluación educativa (reglas clínicas locales en la API).

```bash
cd mobile
npx expo prebuild
npx expo run:ios    # o run:android
```


### 1. Backend (API local)

```bash
cd backend
npm install
npm run dev
```

La API corre en `http://localhost:3001/api`

**Cuenta demo:**
- Email: `maria@example.com`
- Contraseña: `demo123`

### 2. App móvil (Expo 54)

```bash
cd mobile
npm install
npx expo start
```

- En **iOS Simulator**: usa `http://localhost:3001`
- En **Android Emulator**: usa `http://10.0.2.2:3001`
- En **dispositivo físico**: cambia `extra.apiUrl` en `mobile/app.json` a la IP de tu máquina, ej. `http://192.168.1.10:3001`

## Despliegue serverless en AWS

El backend usa [Serverless Framework](https://www.serverless.com/) con API Gateway HTTP + Lambda + **DynamoDB** (persistencia real).

### Desplegar con un solo comando

```bash
cd backend
npm install
npm run deploy:full
```

Esto crea Lambda, API Gateway, tablas DynamoDB y carga datos demo.

**API en producción:** `https://3j3ozimwr1.execute-api.us-east-1.amazonaws.com`

Verifica con:
```bash
curl https://3j3ozimwr1.execute-api.us-east-1.amazonaws.com/api/health
# {"status":"ok","storage":"dynamodb"}
```

### Solo deploy (sin seed)

```bash
npm run deploy
npm run seed   # requiere USERS_TABLE y POSTS_TABLE en env
```

### Desarrollo local con Serverless Offline

```bash
cd backend
npm run offline
```

## API Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/auth/login` | Iniciar sesión |
| POST | `/api/auth/register` | Registrarse |
| GET | `/api/auth/me` | Usuario actual (requiere token) |
| GET | `/api/conditions` | Listar condiciones |
| GET | `/api/conditions/:id/recommendations` | Recomendaciones por condición |
| GET | `/api/posts` | Publicaciones de la comunidad |
| POST | `/api/posts` | Crear publicación |
| GET | `/api/users` | Usuarios (filtro por condición/needsHelp) |
| GET | `/api/users/clusters` | Concentraciones geográficas |
| GET | `/api/services` | Clínicas y servicios |
| PATCH | `/api/users/me` | Actualizar perfil |

## Condiciones incluidas (seed)

Diabetes, Fibromialgia, Autismo (TEA), Esclerosis Múltiple, Depresión Crónica, Síndrome de Down, Artritis Reumatoide, Discapacidad Visual, Discapacidad Motriz, Epilepsia.

## Notas de producción

- Usuarios y publicaciones se guardan en **DynamoDB** (`comunidad-salud-api-users-dev`, `comunidad-salud-api-posts-dev`).
- Autenticación con **JWT** (stateless, compatible con Lambda).
- Condiciones, recomendaciones y servicios siguen en seed estático (solo lectura).
- Configura `JWT_SECRET` como variable de entorno antes de deploy en producción real.

## Tecnologías

- **Mobile**: Expo SDK 54, Expo Router, React Native Maps, Expo Location
- **Backend**: Express 4, serverless-http, Serverless Framework 3
- **Cloud**: AWS Lambda + API Gateway HTTP API
